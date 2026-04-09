import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomMenuHeroHeader } from "../components/BottomMenuHeroHeader";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { usePersistedFilters } from "../hooks/usePersistedFilters";
import {
  getGroups,
  getUserMemberships,
  getGroupMemberCounts,
  getGroupUnreadCounts,
  joinGroup,
  getGroupCities,
} from "../services/groupService";
import { getDirectChats } from "../services/directChatsService";
import { getCurrentUser } from "../services/authService";
import posthogLogger from "../services/posthogService";

// ── Paleta ───────────────────────────────────────────────────────────
const PRIMARY = "#6D28D9";
const ACCENT = "#2E1065";
const GREEN = "#10B981";
const BG = "#F5F3FF";
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#EDE9FE";
const ERROR = "#EF4444";
const DEFAULT_RESIDENT_GROUPS_KEY_PREFIX = "@losresis:resident-default-groups:";
const TELEGRAM_BLUE = "#4C8DFF";
const TELEGRAM_GREEN = "#22C55E";

// ── Helpers ──────────────────────────────────────────────────────────
const getUserType = (userProfile) => {
  if (userProfile?.is_resident) return "resident";
  if (userProfile?.is_student) return "student";
  return "resident";
};

const getResidentDefaultGroupsStorageKey = (userId) =>
  `${DEFAULT_RESIDENT_GROUPS_KEY_PREFIX}${userId}`;

const getResidentCohortYear = (residentYear, now = new Date()) => {
  const parsedResidentYear = Number(residentYear);

  if (!Number.isInteger(parsedResidentYear) || parsedResidentYear < 1) {
    return null;
  }

  return now.getFullYear() - parsedResidentYear;
};

const getGroupCohortYear = (group) => {
  const parsedCohortYear = Number(group?.cohort_year);

  if (Number.isInteger(parsedCohortYear)) {
    return parsedCohortYear;
  }

  const matchedYear = group?.name?.match(/ - (\d{4})$/);
  if (!matchedYear) return null;

  const parsedMatchedYear = Number(matchedYear[1]);
  return Number.isInteger(parsedMatchedYear) ? parsedMatchedYear : null;
};

const getResidentDefaultMatchFlags = (group, residentContext) => {
  const isGeneralCityGroup = !group.speciality_id && !group.hospital_id;
  const isGeneralHospitalGroup = !group.speciality_id && !!group.hospital_id;
  const isGeneralSpecialityGroup =
    !!group.speciality_id && !group.city && !group.hospital_id;
  const isHospitalSpecialityGroup =
    !!group.speciality_id && !!group.hospital_id && !group.city;
  const isCitySpecialityGroup =
    !!group.speciality_id && !!group.city && !group.hospital_id;
  const matchesCity =
    isGeneralCityGroup &&
    !!residentContext.city &&
    group.city?.trim()?.toLowerCase() === residentContext.city;
  const matchesHospital =
    isGeneralHospitalGroup &&
    !!residentContext.hospitalId &&
    group.hospital_id === residentContext.hospitalId;
  const matchesSpeciality =
    isGeneralSpecialityGroup &&
    !!residentContext.specialityId &&
    residentContext.cohortYear != null &&
    group.speciality_id === residentContext.specialityId &&
    getGroupCohortYear(group) === residentContext.cohortYear;
  const matchesHospitalSpeciality =
    isHospitalSpecialityGroup &&
    !!residentContext.hospitalId &&
    !!residentContext.specialityId &&
    group.hospital_id === residentContext.hospitalId &&
    group.speciality_id === residentContext.specialityId;
  const matchesCitySpeciality =
    isCitySpecialityGroup &&
    !!residentContext.city &&
    !!residentContext.specialityId &&
    group.city?.trim()?.toLowerCase() === residentContext.city &&
    group.speciality_id === residentContext.specialityId;

  return {
    matchesCity,
    matchesHospital,
    matchesSpeciality,
    matchesHospitalSpeciality,
    matchesCitySpeciality,
  };
};

const isResidentDefaultGroup = (group, residentContext) => {
  const flags = getResidentDefaultMatchFlags(group, residentContext);

  return (
    flags.matchesCity ||
    flags.matchesHospital ||
    flags.matchesSpeciality ||
    flags.matchesHospitalSpeciality ||
    flags.matchesCitySpeciality
  );
};

const getCompactGroupName = (groupName) => {
  if (!groupName || typeof groupName !== "string") return "Grupo";

  const parts = groupName.split(" - ").map((part) => part.trim());

  if (parts.length !== 2) {
    return groupName;
  }

  const [hospitalName, specialityName] = parts;

  if (!hospitalName || !specialityName) {
    return groupName;
  }

  if (hospitalName.length <= 16) {
    return groupName;
  }

  return `${hospitalName.slice(0, 16).trimEnd()}... - ${specialityName}`;
};

const isCityOnlyGroup = (group) =>
  !!group?.city && !group?.speciality_id && !group?.hospital_id;

const formatChatTimestamp = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const diffMs =
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays < 7) {
    return date.toLocaleDateString("es-ES", { weekday: "short" });
  }

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
};

const buildInitials = (label) => {
  if (!label || typeof label !== "string") return "C";

  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "C";

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};

const getGroupSubtitle = (group, isMember) => {
  if (!group) return "Grupo";

  const metaParts = [];

  if (group.speciality?.name) {
    metaParts.push(group.speciality.name);
  }

  if (group.hospital?.name) {
    metaParts.push(group.hospital.name);
  } else if (group.city) {
    metaParts.push(group.city);
  }

  if (isMember) {
    return metaParts.join(" · ") || "Grupo";
  }

  if (metaParts.length) {
    return `Únete a ${metaParts.join(" · ")}`;
  }

  return "Únete para empezar a chatear";
};

const getGroupPreview = (group, isMember) => {
  if (isMember) {
    return Number(group.unread_count || 0) > 0
      ? "Tienes mensajes sin leer"
      : "Abrir conversación";
  }

  return "Toca para unirte al grupo";
};

const getAvatarTone = (item) => {
  if (item.kind === "direct") {
    return {
      backgroundColor: "#DBEAFE",
      color: TELEGRAM_BLUE,
    };
  }

  if (item.isMember) {
    return {
      backgroundColor: "#DCFCE7",
      color: "#15803D",
    };
  }

  return {
    backgroundColor: "#EDE9FE",
    color: PRIMARY,
  };
};

// ── RadioDot ─────────────────────────────────────────────────────────
function RadioDot({ selected }) {
  return (
    <View
      style={[
        filterModal.radioDot,
        selected ? filterModal.radioDotSelected : filterModal.radioDotUnselected,
      ]}
    >
      {selected && <View style={filterModal.radioDotInner} />}
    </View>
  );
}

// ── FilterModal ───────────────────────────────────────────────────────
function FilterModal({ visible, onClose, title, options, value, onSelect, placeholder }) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    if (visible) setTempValue(value);
  }, [visible, value]);

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  const handleConfirm = () => {
    onSelect(tempValue);
    setSearch("");
    onClose();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(lower));
  }, [options, search]);

  const listData = useMemo(() => {
    const data = [];
    if (value) data.push({ id: "", name: placeholder });
    data.push(...filtered);
    return data;
  }, [filtered, value, placeholder]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: WHITE }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[filterModal.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={filterModal.backBtn} onPress={handleClose}>
            <Ionicons name="arrow-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={filterModal.title}>{title}</Text>
          <View style={filterModal.backBtn} />
        </View>

        <View style={filterModal.searchWrap}>
          <View style={filterModal.searchInner}>
            <Ionicons name="search" size={20} color={TEXT_LIGHT} />
            <TextInput
              style={filterModal.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar..."
              placeholderTextColor={TEXT_LIGHT}
              returnKeyType="done"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color={TEXT_LIGHT} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={listData}
          keyExtractor={(item, i) => String(item.id ?? "") + i}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={filterModal.listContent}
          renderItem={({ item }) => {
            const isSelected = item.id !== "" && item.id === tempValue;
            const isClear = item.id === "";
            return (
              <TouchableOpacity
                style={[
                  filterModal.option,
                  isSelected && filterModal.optionSelected,
                  isClear && filterModal.optionClear,
                ]}
                onPress={() => setTempValue(isClear ? "" : item.id)}
                activeOpacity={0.75}
              >
                <View style={filterModal.optionBody}>
                  <Text
                    style={[
                      filterModal.optionName,
                      isSelected && filterModal.optionNameSelected,
                      isClear && filterModal.optionNameClear,
                    ]}
                  >
                    {item.name}
                  </Text>
                </View>
                {!isClear && <RadioDot selected={isSelected} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={filterModal.empty}>
              <Text style={filterModal.emptyText}>Sin resultados</Text>
            </View>
          }
        />

        <View style={[filterModal.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={filterModal.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text style={filterModal.confirmText}>Confirmar selección</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChatListRow({ item, joiningId, onPress }) {
  const unreadCount = Number(item.unread_count || 0);
  const isJoinableGroup = item.kind === "group" && !item.isMember;
  const isJoining = isJoinableGroup && joiningId === item.id;
  const avatarTone = getAvatarTone(item);
  const timestampLabel = formatChatTimestamp(item.sortTimestamp);

  return (
    <TouchableOpacity
      style={styles.chatRow}
      onPress={() => onPress(item)}
      activeOpacity={0.78}
    >
      <View
        style={[
          styles.chatAvatar,
          { backgroundColor: avatarTone.backgroundColor },
        ]}
      >
        {item.kind === "group" ? (
          <Ionicons name="people" size={20} color={avatarTone.color} />
        ) : (
          <Text style={[styles.chatAvatarText, { color: avatarTone.color }]}>
            {buildInitials(item.title)}
          </Text>
        )}
      </View>

      <View style={styles.chatMain}>
        <View style={styles.chatTopRow}>
          <Text
            style={[
              styles.chatTitle,
              unreadCount > 0 && styles.chatTitleUnread,
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>

          <Text
            style={[
              styles.chatTime,
              unreadCount > 0 && styles.chatTimeUnread,
            ]}
          >
            {timestampLabel}
          </Text>
        </View>

        <View style={styles.chatMetaRow}>
          <Text style={styles.chatSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>

        <View style={styles.chatBottomRow}>
          <Text
            style={[
              styles.chatPreview,
              unreadCount > 0 && styles.chatPreviewUnread,
            ]}
            numberOfLines={1}
          >
            {item.preview}
          </Text>

          {isJoinableGroup ? (
            <View
              style={[
                styles.chatJoinPill,
                isJoining && styles.chatJoinPillLoading,
              ]}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <Ionicons name="add" size={14} color={WHITE} />
                  <Text style={styles.chatJoinPillText}>Unirse</Text>
                </>
              )}
            </View>
          ) : unreadCount > 0 ? (
            <View style={styles.chatUnreadBadge}>
              <Text style={styles.chatUnreadBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── FilterChip ────────────────────────────────────────────────────────
function FilterChip({ label, active, icon, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons name={icon} size={14} color={active ? PRIMARY : ACCENT} />
      )}
      <Text
        style={[styles.chipText, active && styles.chipTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons
        name="chevron-down"
        size={14}
        color={active ? PRIMARY : TEXT_MEDIUM}
      />
    </TouchableOpacity>
  );
}

// ── GroupsScreen ──────────────────────────────────────────────────────
export default function GroupsScreen({ onSectionChange, userProfile }) {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [directChats, setDirectChats] = useState([]);
  const [memberGroupIds, setMemberGroupIds] = useState(new Set());
  const [persistedResidentGroupIds, setPersistedResidentGroupIds] = useState(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const [relatedGroupCounts, setRelatedGroupCounts] = useState({});
  const [unreadByGroupId, setUnreadByGroupId] = useState({});
  const [availableCities, setAvailableCities] = useState([]);
  const [openModal, setOpenModal] = useState(null); // 'city' | null
  const [isExploringAll, setIsExploringAll] = useState(false);
  const [cityExplorerVisible, setCityExplorerVisible] = useState(false);
  const [cityExplorerSearch, setCityExplorerSearch] = useState("");
  const [cityExplorerGroups, setCityExplorerGroups] = useState([]);
  const [cityExplorerLoading, setCityExplorerLoading] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const {
    filters,
    isLoading: filtersLoading,
    updateFilter,
    clearAllFilters: clearPersistedFilters,
  } = usePersistedFilters(
    "groups",
    {
      cityFilter: null,
      showMyGroups: false,
    },
    { enableDebounce: true, debounceMs: 500 }
  );
  const cityFilter = filters.cityFilter || null;
  const showMyGroups = Boolean(filters.showMyGroups);
  const setCityFilter = useCallback(
    (value) => updateFilter("cityFilter", value),
    [updateFilter]
  );
  const setShowMyGroups = useCallback(
    (value) => updateFilter("showMyGroups", Boolean(value)),
    [updateFilter]
  );

  const userType = getUserType(userProfile);
  const isResidentUser = !!userProfile?.is_resident;
  const isStudentUser = !!userProfile?.is_student;
  const studentCity = userProfile?.city?.trim()?.toLowerCase() || null;
  const residentCity = userProfile?.city?.trim()?.toLowerCase() || null;
  const residentHospitalId = userProfile?.hospital_id || null;
  const residentSpecialityId = userProfile?.speciality_id || null;
  const residentCohortYear = useMemo(
    () => getResidentCohortYear(userProfile?.resident_year),
    [userProfile?.resident_year]
  );
  const residentContext = useMemo(
    () => ({
      city: residentCity,
      cohortYear: residentCohortYear,
      hospitalId: residentHospitalId,
      specialityId: residentSpecialityId,
    }),
    [residentCity, residentCohortYear, residentHospitalId, residentSpecialityId]
  );
  const shouldShowExploreFilters = isExploringAll;
  const activeQueryFilters = useMemo(() => {
    if (!shouldShowExploreFilters) return {};

    return {
      city: cityFilter || undefined,
    };
  }, [shouldShowExploreFilters, cityFilter]);

  useEffect(() => {
    posthogLogger.logScreen("GroupsScreen", { userType });
  }, [userType]);

  useEffect(() => {
    const loadUser = async () => {
      const { success, user } = await getCurrentUser();
      if (success && user) setCurrentUserId(user.id);
    };
    loadUser();
  }, []);

  const loadData = useCallback(
    async (userId) => {
      setError(null);

      const uid = userId ?? currentUserId;
      let nextPersistedResidentGroupIds = new Set();

      const [groupsResult, membershipsResult, citiesResult, directChatsResult] =
        await Promise.all([
          getGroups(userType, activeQueryFilters),
          uid
            ? getUserMemberships(uid)
            : Promise.resolve({ success: true, memberships: [] }),
          getGroupCities(userType),
          uid ? getDirectChats() : Promise.resolve({ success: true, chats: [] }),
        ]);

      if (!groupsResult.success) {
        setError(groupsResult.error || "Error al cargar los grupos");
      } else {
        setGroups(groupsResult.groups || []);
      }

      if (membershipsResult.success) {
        const nextMemberGroupIds = new Set(
          (membershipsResult.memberships || []).map((m) => m.group_id)
        );
        setMemberGroupIds(nextMemberGroupIds);

        const unreadResult = await getGroupUnreadCounts(
          Array.from(nextMemberGroupIds)
        );
        if (unreadResult.success) {
          setUnreadByGroupId(unreadResult.unreadByGroupId);
        } else {
          setUnreadByGroupId({});
        }

        if (uid && isResidentUser) {
          try {
            const persistedGroupIdsRaw = await AsyncStorage.getItem(
              getResidentDefaultGroupsStorageKey(uid)
            );
            const persistedGroupIds = persistedGroupIdsRaw
              ? JSON.parse(persistedGroupIdsRaw)
              : [];
            nextPersistedResidentGroupIds = new Set(persistedGroupIds);
            setPersistedResidentGroupIds(nextPersistedResidentGroupIds);
          } catch (storageError) {
            console.error(
              "Error loading persisted resident groups:",
              storageError
            );
            nextPersistedResidentGroupIds = new Set();
            setPersistedResidentGroupIds(new Set());
          }
        } else {
          nextPersistedResidentGroupIds = new Set();
          setPersistedResidentGroupIds(new Set());
        }

        if (groupsResult.success) {
          const sourceGroups = groupsResult.groups || [];
          const relatedGroupIds = isResidentUser && !isExploringAll
            ? sourceGroups
                .filter((group) => {
                  const isMember = nextMemberGroupIds.has(group.id);
                  const isPersistedResidentGroup =
                    nextPersistedResidentGroupIds.has(group.id);

                  return (
                    isMember ||
                    isPersistedResidentGroup ||
                    isResidentDefaultGroup(group, residentContext)
                  );
                })
                .map((group) => group.id)
            : [];

          const countsResult = await getGroupMemberCounts(relatedGroupIds);
          if (countsResult.success) {
            setRelatedGroupCounts(countsResult.countsByGroupId);
          } else {
            setRelatedGroupCounts({});
          }
        }
      } else {
        setPersistedResidentGroupIds(new Set());
        setRelatedGroupCounts({});
        setUnreadByGroupId({});
      }

      if (citiesResult.success) setAvailableCities(citiesResult.cities);
      if (directChatsResult.success) {
        setDirectChats(directChatsResult.chats || []);
      } else {
        setDirectChats([]);
      }
    },
    [
      userType,
      currentUserId,
      activeQueryFilters,
      isResidentUser,
      isExploringAll,
      residentContext,
    ]
  );

  // Cargar usuario y después datos
  useEffect(() => {
    if (filtersLoading) {
      return undefined;
    }

    let cancelled = false;
    const init = async () => {
      setLoading(true);
      const { success, user } = await getCurrentUser();
      const uid = success && user ? user.id : null;
      if (!cancelled) {
        setCurrentUserId(uid);
        await loadData(uid);
        setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType, isExploringAll, cityFilter, filtersLoading]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDirectChatPress = useCallback(
    (chat) => {
      if (!chat?.group_id) return;

      onSectionChange?.("groupChat", {
        groupId: chat.group_id,
        groupName: chat.display_name || "Chat privado",
      });
    },
    [onSectionChange]
  );

  const openCityExplorer = useCallback(async () => {
    setCityExplorerVisible(true);
    setCityExplorerSearch("");
    setCityExplorerLoading(true);

    try {
      const groupsResult = await getGroups(userType, {});

      if (!groupsResult.success) {
        Alert.alert(
          "Error",
          groupsResult.error || "No se pudieron cargar los grupos de ciudad"
        );
        setCityExplorerVisible(false);
        return;
      }

      setCityExplorerGroups(
        (groupsResult.groups || []).filter((group) => isCityOnlyGroup(group))
      );
    } finally {
      setCityExplorerLoading(false);
    }
  }, [userType]);

  const closeCityExplorer = useCallback(() => {
    setCityExplorerVisible(false);
    setCityExplorerSearch("");
  }, []);

  const handleGroupPress = useCallback(
    async (group) => {
      if (!currentUserId) return;

      const isMember = memberGroupIds.has(group.id);

      if (isMember) {
        setUnreadByGroupId((prev) => ({
          ...prev,
          [group.id]: {
            ...(prev[group.id] || {}),
            unreadCount: 0,
          },
        }));
        onSectionChange?.("groupChat", {
          groupId: group.id,
          groupName: group.name,
        });
        return;
      }

      // Unirse y navegar al chat
      setJoiningId(group.id);
      try {
        const { success, error: joinError } = await joinGroup(
          group.id,
          currentUserId
        );

        if (success) {
          if (
            isResidentUser &&
            !isExploringAll &&
            isResidentDefaultGroup(group, residentContext)
          ) {
            const nextPersistedGroupIds = new Set([
              ...persistedResidentGroupIds,
              group.id,
            ]);
            setPersistedResidentGroupIds(nextPersistedGroupIds);
            try {
              await AsyncStorage.setItem(
                getResidentDefaultGroupsStorageKey(currentUserId),
                JSON.stringify([...nextPersistedGroupIds])
              );
            } catch (storageError) {
              console.error(
                "Error persisting resident default group:",
                storageError
              );
            }
          }

          setMemberGroupIds((prev) => new Set([...prev, group.id]));
          setUnreadByGroupId((prev) => ({
            ...prev,
            [group.id]: { unreadCount: 0, lastMessageAt: null },
          }));
          setGroups((prev) =>
            prev.map((g) =>
              g.id === group.id
                ? { ...g, member_count: g.member_count + 1 }
                : g
            )
          );
          onSectionChange?.("groupChat", {
            groupId: group.id,
            groupName: group.name,
          });
        } else {
          Alert.alert("Error", joinError || "No se pudo unir al grupo");
        }
      } finally {
        setJoiningId(null);
      }
    },
    [
      currentUserId,
      memberGroupIds,
      onSectionChange,
      isResidentUser,
      isExploringAll,
      residentContext,
      persistedResidentGroupIds,
    ]
  );

  const handleCityExplorerGroupPress = useCallback(
    async (group) => {
      closeCityExplorer();
      await handleGroupPress(group);
    },
    [closeCityExplorer, handleGroupPress]
  );

  const handleChatItemPress = useCallback(
    async (item) => {
      if (item.kind === "direct") {
        handleDirectChatPress(item);
        return;
      }

      await handleGroupPress(item);
    },
    [handleDirectChatPress, handleGroupPress]
  );

  const hasFilters = !!cityFilter;
  const showResidentScopeNote = isResidentUser && !isExploringAll;
  const showStudentScopeNote = isStudentUser && !isExploringAll;

  const filteredGroups = useMemo(() => {
    let nextGroups = groups;

    if (isResidentUser && !isExploringAll) {
      nextGroups = groups.filter((group) => {
        const isMember = memberGroupIds.has(group.id);
        const isPersistedResidentGroup = persistedResidentGroupIds.has(group.id);

        return (
          isMember ||
          isPersistedResidentGroup ||
          isResidentDefaultGroup(group, residentContext)
        );
      });
    }

    if (isStudentUser && !isExploringAll) {
      nextGroups = groups.filter((group) => {
        const isMember = memberGroupIds.has(group.id);
        const matchesStudentCity =
          !!studentCity &&
          !group.speciality_id &&
          !group.hospital_id &&
          group.city?.trim()?.toLowerCase() === studentCity;

        return isMember || matchesStudentCity;
      });
    }

    if (shouldShowExploreFilters && !showMyGroups) {
      nextGroups = nextGroups.filter(
        (group) => !group.speciality_id && !group.hospital_id
      );
    }

    if (showMyGroups) {
      nextGroups = nextGroups.filter((group) => memberGroupIds.has(group.id));
    }

    return nextGroups;
  }, [
    groups,
    showMyGroups,
    memberGroupIds,
    persistedResidentGroupIds,
    isResidentUser,
    isStudentUser,
    isExploringAll,
    shouldShowExploreFilters,
    studentCity,
    residentContext,
  ]);

  const displayGroups = useMemo(
    () =>
      filteredGroups
        .map((group) => ({
          ...group,
          member_count:
            showResidentScopeNote && relatedGroupCounts[group.id] != null
              ? relatedGroupCounts[group.id]
              : group.member_count,
          unread_count: unreadByGroupId[group.id]?.unreadCount || 0,
        }))
        .sort((a, b) => {
          const aIsMember = memberGroupIds.has(a.id);
          const bIsMember = memberGroupIds.has(b.id);

          if (aIsMember !== bIsMember) {
            return aIsMember ? -1 : 1;
          }

          return a.name.localeCompare(b.name, "es");
        }),
    [
      filteredGroups,
      showResidentScopeNote,
      relatedGroupCounts,
      unreadByGroupId,
      memberGroupIds,
    ]
  );

  const cityOptions = useMemo(
    () => availableCities.map((c) => ({ id: c, name: c })),
    [availableCities]
  );
  const cityExplorerSections = useMemo(() => {
    const normalizedSearch = cityExplorerSearch.trim().toLowerCase();
    const filteredGroups = cityExplorerGroups.filter((group) => {
      if (!normalizedSearch) return true;

      return (
        group.name?.toLowerCase().includes(normalizedSearch) ||
        group.city?.toLowerCase().includes(normalizedSearch)
      );
    });

    const groupedByCity = filteredGroups.reduce((acc, group) => {
      const cityName = group.city?.trim() || "Otras ciudades";

      if (!acc[cityName]) {
        acc[cityName] = [];
      }

      acc[cityName].push(group);
      return acc;
    }, {});

    return Object.entries(groupedByCity)
      .sort(([cityA], [cityB]) => cityA.localeCompare(cityB, "es"))
      .map(([cityName, groupsInCity]) => ({
        cityName,
        groups: groupsInCity.sort((a, b) => a.name.localeCompare(b.name, "es")),
      }));
  }, [cityExplorerGroups, cityExplorerSearch]);
  const normalizedChatSearch = chatSearch.trim().toLowerCase();
  const mergedChatItems = useMemo(() => {
    const directItems = directChats.map((chat) => {
      const metaParts = [
        chat.other_user_speciality_name,
        chat.other_user_hospital_name || chat.other_user_city,
      ].filter(Boolean);

      return {
        ...chat,
        id: chat.group_id,
        key: `direct-${chat.group_id}`,
        title: chat.display_name || "Chat privado",
        subtitle: metaParts.join(" · ") || "Conversación privada",
        preview: chat.last_message_preview || "Abrir chat directo",
        sortTimestamp: chat.last_message_at || null,
        isMember: true,
        rank: 0,
        searchableText: [
          chat.display_name,
          chat.other_user_speciality_name,
          chat.other_user_hospital_name,
          chat.other_user_city,
          chat.last_message_preview,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });

    const groupItems = displayGroups.map((group) => {
      const isMember = memberGroupIds.has(group.id);

      return {
        ...group,
        kind: "group",
        key: `group-${group.id}`,
        title: getCompactGroupName(group.name),
        subtitle: getGroupSubtitle(group, isMember),
        preview: getGroupPreview(group, isMember),
        sortTimestamp: unreadByGroupId[group.id]?.lastMessageAt || null,
        isMember,
        rank: isMember ? 0 : 2,
        searchableText: [
          group.name,
          group.city,
          group.speciality?.name,
          group.hospital?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });

    return [...directItems, ...groupItems]
      .filter((item) =>
        normalizedChatSearch ? item.searchableText.includes(normalizedChatSearch) : true
      )
      .sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }

        const aUnread = Number(a.unread_count || 0);
        const bUnread = Number(b.unread_count || 0);
        if (aUnread !== bUnread) {
          return bUnread - aUnread;
        }

        const aTime = a.sortTimestamp ? new Date(a.sortTimestamp).getTime() : 0;
        const bTime = b.sortTimestamp ? new Date(b.sortTimestamp).getTime() : 0;
        if (aTime !== bTime) {
          return bTime - aTime;
        }

        return a.title.localeCompare(b.title, "es");
      });
  }, [
    directChats,
    displayGroups,
    memberGroupIds,
    unreadByGroupId,
    normalizedChatSearch,
  ]);
  const ListHeader = (
    <View style={styles.listHeader}>
      {showResidentScopeNote ? (
        <View style={styles.scopeBanner}>
          <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
          <Text style={styles.scopeBannerText}>
            Mostramos los grupos a los que ya te has unido, los de tu ciudad y
            los de tu hospital, además del grupo de tu especialidad y cohorte.
            Usa el botón flotante para buscar más grupos.
          </Text>
        </View>
      ) : showStudentScopeNote ? (
        <View style={styles.scopeBanner}>
          <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
          <Text style={styles.scopeBannerText}>
            Mostramos tus grupos y el de la ciudad vinculada a tu perfil. Usa
            el botón flotante para buscar otras ciudades y unirte a varios
            grupos a la vez.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersRow}
        >
          <FilterChip
            label={cityFilter || "Ciudad"}
            active={!!cityFilter}
            icon="business-outline"
            onPress={() => setOpenModal("city")}
          />
        </ScrollView>
      )}

      <View style={styles.telegramSearchWrap}>
        <Ionicons name="search" size={18} color={TEXT_LIGHT} />
        <TextInput
          style={styles.telegramSearchInput}
          value={chatSearch}
          onChangeText={setChatSearch}
          placeholder="Buscar chats o grupos"
          placeholderTextColor={TEXT_LIGHT}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {chatSearch ? (
          <TouchableOpacity onPress={() => setChatSearch("")} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={TEXT_LIGHT} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>
          {showMyGroups ? "Mis chats" : "Todos los chats"}
        </Text>
        {hasFilters ? (
          <TouchableOpacity
            style={styles.sectionAction}
            onPress={() => clearPersistedFilters()}
            activeOpacity={0.75}
          >
            <Text style={styles.sectionActionText}>Restablecer filtros</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="people-outline" size={40} color={PRIMARY} />
      </View>
      <Text style={styles.emptyTitle}>
        {normalizedChatSearch
          ? "No hemos encontrado resultados"
          : showMyGroups && directChats.length === 0
          ? "Aún no tienes chats"
          : "No hay chats disponibles"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {normalizedChatSearch
          ? "Prueba con otro nombre, ciudad o especialidad"
          : showMyGroups && directChats.length === 0
          ? "Únete a un grupo o abre un chat directo para empezar"
          : shouldShowExploreFilters && hasFilters
          ? "Prueba con otros filtros"
          : showResidentScopeNote || showStudentScopeNote
          ? "Usa el botón flotante para explorar todos los grupos disponibles"
          : "Próximamente habrá más grupos disponibles"}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.heroShell}>
        <BottomMenuHeroHeader
          title="Chats"
          subtitle="Conversaciones y grupos en una sola bandeja."
          rightSlot={
            <TouchableOpacity
              style={[styles.myGroupsChip, showMyGroups && styles.myGroupsChipActive]}
              onPress={() => setShowMyGroups(!showMyGroups)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showMyGroups ? "person" : "person-outline"}
                size={14}
                color={showMyGroups ? WHITE : ACCENT}
              />
              <Text
                style={[
                  styles.myGroupsChipText,
                  showMyGroups && styles.myGroupsChipTextActive,
                ]}
              >
                Solo míos
              </Text>
            </TouchableOpacity>
          }
        />
      </View>

      <View style={styles.contentShell}>
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Cargando grupos...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Ionicons name="alert-circle" size={48} color={ERROR} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadData()}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={mergedChatItems}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <ChatListRow
                item={item}
                joiningId={joiningId}
                onPress={handleChatItemPress}
              />
            )}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            ListFooterComponent={<View style={{ height: 40 }} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={PRIMARY}
                colors={[PRIMARY]}
              />
            }
          />
        )}
      </View>
      <FilterModal
        visible={shouldShowExploreFilters && openModal === "city"}
        onClose={() => setOpenModal(null)}
        title="Filtrar por ciudad"
        options={cityOptions}
        value={cityFilter || ""}
        onSelect={(v) => setCityFilter(v || null)}
        placeholder="Todas las ciudades"
      />
      <FloatingActionButton
        onPress={openCityExplorer}
        icon="search"
        backgroundColor={PRIMARY}
        bottom={24 + insets.bottom}
        right={20}
        style={styles.cityExplorerFab}
      />
      <Modal
        visible={cityExplorerVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCityExplorer}
      >
        <Pressable style={styles.cityExplorerBackdrop} onPress={closeCityExplorer}>
          <Pressable style={styles.cityExplorerSheet} onPress={() => {}}>
            <View style={styles.cityExplorerHandle} />
            <View style={styles.cityExplorerHeader}>
              <View style={styles.cityExplorerHeaderTextWrap}>
                <Text style={styles.cityExplorerTitle}>Grupos por ciudad</Text>
                <Text style={styles.cityExplorerSubtitle}>
                  Busca una ciudad y únete al grupo que quieras.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.cityExplorerClose}
                onPress={closeCityExplorer}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={TEXT_MEDIUM} />
              </TouchableOpacity>
            </View>

            <View style={styles.cityExplorerSearchWrap}>
              <Ionicons name="search" size={18} color={TEXT_LIGHT} />
              <TextInput
                style={styles.cityExplorerSearchInput}
                value={cityExplorerSearch}
                onChangeText={setCityExplorerSearch}
                placeholder="Buscar ciudad o grupo"
                placeholderTextColor={TEXT_LIGHT}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {cityExplorerSearch ? (
                <TouchableOpacity
                  onPress={() => setCityExplorerSearch("")}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={18} color={TEXT_LIGHT} />
                </TouchableOpacity>
              ) : null}
            </View>

            {cityExplorerLoading ? (
              <View style={styles.cityExplorerState}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={styles.cityExplorerStateText}>
                  Cargando grupos de ciudad...
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.cityExplorerContent}
              >
                {cityExplorerSections.length ? (
                  cityExplorerSections.map((section) => (
                    <View key={section.cityName} style={styles.cityExplorerSection}>
                      {section.groups.map((group) => {
                        const isMember = memberGroupIds.has(group.id);
                        const isJoining = joiningId === group.id;

                        return (
                          <TouchableOpacity
                            key={group.id}
                            style={styles.cityExplorerGroupRow}
                            onPress={() => handleCityExplorerGroupPress(group)}
                            activeOpacity={0.85}
                          >
                            <View style={styles.cityExplorerGroupInfo}>
                              <Text
                                style={styles.cityExplorerGroupName}
                                numberOfLines={1}
                              >
                                {group.name}
                              </Text>
                            </View>

                            {isMember ? (
                              <View style={styles.cityExplorerJoinedBadge}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={14}
                                  color={GREEN}
                                />
                                <Text style={styles.cityExplorerJoinedBadgeText}>
                                  Unido
                                </Text>
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.cityExplorerJoinBadge,
                                  isJoining && styles.cityExplorerJoinBadgeLoading,
                                ]}
                              >
                                {isJoining ? (
                                  <ActivityIndicator size="small" color={WHITE} />
                                ) : (
                                  <>
                                    <Ionicons name="add" size={14} color={WHITE} />
                                    <Text style={styles.cityExplorerJoinBadgeText}>
                                      Unirse
                                    </Text>
                                  </>
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))
                ) : (
                  <View style={styles.cityExplorerState}>
                    <Ionicons name="search-outline" size={28} color={TEXT_LIGHT} />
                    <Text style={styles.cityExplorerStateText}>
                      No hemos encontrado grupos para esa búsqueda.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  heroShell: {
    position: "relative",
    zIndex: 2,
    elevation: 2,
  },
  contentShell: {
    flex: 1,
    marginTop: -18,
    position: "relative",
    zIndex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 4,
  },
  telegramSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EEF2F6",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  telegramSearchInput: {
    flex: 1,
    fontSize: 15,
    color: ACCENT,
    paddingVertical: 0,
  },
  directSection: {
    marginBottom: 20,
    gap: 12,
  },
  directChatsList: {
    gap: 12,
  },
  myGroupsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  myGroupsChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  myGroupsChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT,
  },
  myGroupsChipTextActive: {
    color: WHITE,
  },

  // Filter chips
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 4,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
    paddingRight: 24,
  },
  scopeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  scopeBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MEDIUM,
    fontWeight: "500",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: {
    backgroundColor: PRIMARY + "12",
    borderColor: PRIMARY + "40",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT,
    flexShrink: 1,
    maxWidth: 120,
  },
  chipTextActive: {
    color: PRIMARY,
  },
  chipClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  chipClearText: {
    fontSize: 13,
    fontWeight: "600",
    color: ERROR,
  },

  // Section row
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 6,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionAction: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: PRIMARY + "10",
    borderWidth: 1,
    borderColor: PRIMARY + "20",
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
  },

  // Card
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
  },
  chatAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  chatAvatarText: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  chatMain: {
    flex: 1,
    minWidth: 0,
  },
  chatTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    gap: 12,
  },
  chatTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 21,
  },
  chatTitleUnread: {
    fontWeight: "800",
  },
  chatTime: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_LIGHT,
  },
  chatTimeUnread: {
    color: TELEGRAM_GREEN,
  },
  chatMetaRow: {
    marginBottom: 4,
  },
  chatSubtitle: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    fontWeight: "500",
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatPreview: {
    flex: 1,
    fontSize: 14,
    color: TEXT_LIGHT,
    fontWeight: "500",
  },
  chatPreviewUnread: {
    color: TEXT_MEDIUM,
    fontWeight: "600",
  },
  chatUnreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TELEGRAM_GREEN,
  },
  chatUnreadBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: WHITE,
  },
  chatJoinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TELEGRAM_BLUE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chatJoinPillLoading: {
    minWidth: 78,
    justifyContent: "center",
  },
  chatJoinPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: WHITE,
  },

  // States
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG,
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: TEXT_MEDIUM,
  },
  errorText: {
    fontSize: 15,
    color: ERROR,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  retryButtonText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PRIMARY + "10",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_MEDIUM,
    textAlign: "center",
    lineHeight: 20,
  },
  cityExplorerBackdrop: {
    flex: 1,
    backgroundColor: "#0F172A66",
    justifyContent: "flex-end",
  },
  cityExplorerFab: {
    zIndex: 20,
    elevation: 20,
  },
  cityExplorerSheet: {
    height: "82%",
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  cityExplorerHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 14,
  },
  cityExplorerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  cityExplorerHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  cityExplorerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: ACCENT,
  },
  cityExplorerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MEDIUM,
  },
  cityExplorerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cityExplorerSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  cityExplorerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: ACCENT,
    paddingVertical: 0,
  },
  cityExplorerContent: {
    paddingBottom: 20,
    gap: 16,
    flexGrow: 1,
  },
  cityExplorerSection: {
    gap: 10,
  },
  cityExplorerGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FAFAFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cityExplorerGroupInfo: {
    flex: 1,
  },
  cityExplorerGroupName: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  cityExplorerJoinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cityExplorerJoinBadgeLoading: {
    minWidth: 78,
    justifyContent: "center",
  },
  cityExplorerJoinBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: WHITE,
  },
  cityExplorerJoinedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: GREEN + "15",
    borderWidth: 1,
    borderColor: GREEN + "30",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cityExplorerJoinedBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: GREEN,
  },
  cityExplorerState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 32,
  },
  cityExplorerStateText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_MEDIUM,
    textAlign: "center",
  },
});

// ── FilterModal styles ────────────────────────────────────────────────
const filterModal = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: ACCENT,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: WHITE,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: ACCENT,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + "08",
  },
  optionClear: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  optionBody: { flex: 1 },
  optionName: {
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  optionNameSelected: {
    color: PRIMARY,
    fontWeight: "700",
  },
  optionNameClear: {
    color: ERROR,
    fontWeight: "600",
  },
  radioDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioDotSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  radioDotUnselected: {
    borderColor: "#CBD5E1",
    backgroundColor: "transparent",
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: WHITE,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  empty: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: TEXT_LIGHT,
  },
});
