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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGroups,
  getUserMemberships,
  getGroupMemberCounts,
  getGroupUnreadCounts,
  joinGroup,
  getGroupCities,
} from "../services/groupService";
import { getCurrentUser } from "../services/authService";
import posthogLogger from "../services/posthogService";
import { FloatingActionButton } from "../components/FloatingActionButton";

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

// ── Helpers ──────────────────────────────────────────────────────────
const getUserType = (userProfile) => {
  if (userProfile?.is_resident) return "resident";
  if (userProfile?.is_student) return "student";
  return "resident";
};

const getResidentDefaultGroupsStorageKey = (userId) =>
  `${DEFAULT_RESIDENT_GROUPS_KEY_PREFIX}${userId}`;

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
    group.speciality_id === residentContext.specialityId;
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

// ── GroupCard ─────────────────────────────────────────────────────────
function GroupCard({ group, isMember, joiningId, onPress }) {
  const isJoining = joiningId === group.id;
  const locationLabel = group.hospital?.name || group.city || "Sin ubicación";
  const specialityLabel = group.speciality?.name || "Grupo general";
  const unreadCount = Number(group.unread_count || 0);

  return (
    <TouchableOpacity
      style={[styles.card, isMember && styles.cardJoined]}
      onPress={() => onPress(group)}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.cardIconWrap,
          { backgroundColor: isMember ? GREEN + "18" : PRIMARY + "12" },
        ]}
      >
        <Ionicons
          name="people"
          size={28}
          color={isMember ? GREEN : PRIMARY}
        />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={2}>
            {group.name}
          </Text>

          {isMember && unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="medical-outline" size={12} color={TEXT_MEDIUM} />
            <Text style={styles.metaText} numberOfLines={1}>
              {specialityLabel}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={12} color={TEXT_MEDIUM} />
            <Text style={styles.metaText} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.memberCount}>
            <Ionicons name="person-outline" size={12} color={TEXT_LIGHT} />
            <Text style={styles.memberCountText}>
              {group.member_count}{" "}
              {group.member_count === 1 ? "miembro" : "miembros"}
            </Text>
          </View>

          {isMember ? (
            <View style={styles.joinedBadge}>
              <Ionicons name="chatbubble" size={12} color={GREEN} />
              <Text style={styles.joinedBadgeText}>Entrar</Text>
            </View>
          ) : (
            <View style={[styles.joinBtn, isJoining && styles.joinBtnLoading]}>
              {isJoining ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <Ionicons name="add" size={14} color={WHITE} />
                  <Text style={styles.joinBtnText}>Unirse</Text>
                </>
              )}
            </View>
          )}
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
  const [memberGroupIds, setMemberGroupIds] = useState(new Set());
  const [persistedResidentGroupIds, setPersistedResidentGroupIds] = useState(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const [showMyGroups, setShowMyGroups] = useState(false);
  const [relatedGroupCounts, setRelatedGroupCounts] = useState({});
  const [unreadByGroupId, setUnreadByGroupId] = useState({});

  const [cityFilter, setCityFilter] = useState(null);
  const [availableCities, setAvailableCities] = useState([]);
  const [openModal, setOpenModal] = useState(null); // 'city' | null
  const [isExploringAll, setIsExploringAll] = useState(false);

  const userType = getUserType(userProfile);
  const isResidentUser = !!userProfile?.is_resident;
  const isStudentUser = !!userProfile?.is_student;
  const studentCity = userProfile?.city?.trim()?.toLowerCase() || null;
  const residentCity = userProfile?.city?.trim()?.toLowerCase() || null;
  const residentHospitalId = userProfile?.hospital_id || null;
  const residentSpecialityId = userProfile?.speciality_id || null;
  const residentContext = useMemo(
    () => ({
      city: residentCity,
      hospitalId: residentHospitalId,
      specialityId: residentSpecialityId,
    }),
    [residentCity, residentHospitalId, residentSpecialityId]
  );
  const canExploreAll = isResidentUser || isStudentUser;
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

      const [groupsResult, membershipsResult, citiesResult] =
        await Promise.all([
          getGroups(userType, activeQueryFilters),
          uid
            ? getUserMemberships(uid)
            : Promise.resolve({ success: true, memberships: [] }),
          getGroupCities(userType),
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
  }, [userType, isExploringAll, cityFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleToggleExploreAll = useCallback(() => {
    setIsExploringAll((prev) => {
      const nextValue = !prev;

      if (nextValue) {
        setShowMyGroups(false);
        setCityFilter(null);
      }

      return nextValue;
    });
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

  const hasFilters = !!cityFilter;
  const userTypeLabel = userType === "student" ? "Estudiantes" : "Residentes";
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
      filteredGroups.map((group) => ({
        ...group,
        member_count:
          showResidentScopeNote && relatedGroupCounts[group.id] != null
            ? relatedGroupCounts[group.id]
            : group.member_count,
        unread_count: unreadByGroupId[group.id]?.unreadCount || 0,
      })),
    [filteredGroups, showResidentScopeNote, relatedGroupCounts, unreadByGroupId]
  );

  const cityOptions = useMemo(
    () => availableCities.map((c) => ({ id: c, name: c })),
    [availableCities]
  );

  const ListHeader = (
    <View style={styles.listHeader}>
      {/* Título */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.screenTitle}>Grupos</Text>
          <Text style={styles.screenSubtitle}>
            {showResidentScopeNote
              ? "Tus grupos y tu entorno"
              : showStudentScopeNote
              ? "Tu ciudad"
              : userTypeLabel}
          </Text>
        </View>
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
            Mis grupos
          </Text>
        </TouchableOpacity>
      </View>

      {showResidentScopeNote ? (
        <View style={styles.scopeBanner}>
          <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
          <Text style={styles.scopeBannerText}>
            Mostramos los grupos a los que ya te has unido, los de tu ciudad y
            los de tu hospital. Usa el botón flotante para buscar más grupos.
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
          {hasFilters && (
            <TouchableOpacity
              style={styles.chipClear}
              onPress={() => {
                setCityFilter(null);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={14} color={ERROR} />
              <Text style={styles.chipClearText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Contador */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>
          {showMyGroups
            ? "Mis grupos"
            : showResidentScopeNote || showStudentScopeNote
            ? "Grupos para ti"
            : "Grupos disponibles"}
        </Text>
        <Text style={styles.sectionCount}>
          {displayGroups.length} {displayGroups.length === 1 ? "grupo" : "grupos"}
        </Text>
      </View>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="people-outline" size={40} color={PRIMARY} />
      </View>
      <Text style={styles.emptyTitle}>
        {showMyGroups
          ? "Aún no te has unido a ningún grupo"
          : "No hay grupos disponibles"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {showMyGroups
          ? "Únete a un grupo para chatear con otros compañeros"
          : shouldShowExploreFilters && hasFilters
          ? "Prueba con otros filtros"
          : showResidentScopeNote || showStudentScopeNote
          ? "Usa el botón flotante para explorar todos los grupos disponibles"
          : "Próximamente habrá más grupos disponibles"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Cargando grupos...</Text>
      </View>
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            isMember={memberGroupIds.has(item.id)}
            joiningId={joiningId}
            onPress={handleGroupPress}
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

      {canExploreAll ? (
        <FloatingActionButton
          onPress={handleToggleExploreAll}
          icon={isExploringAll ? "close" : "search"}
          backgroundColor={isExploringAll ? ACCENT : PRIMARY}
          bottom={24 + insets.bottom}
          right={20}
        />
      ) : null}

      <FilterModal
        visible={shouldShowExploreFilters && openModal === "city"}
        onClose={() => setOpenModal(null)}
        title="Filtrar por ciudad"
        options={cityOptions}
        value={cityFilter || ""}
        onSelect={(v) => setCityFilter(v || null)}
        placeholder="Todas las ciudades"
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  listContent: {
    paddingBottom: 16,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },

  // Title row
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    marginTop: 2,
    fontWeight: "500",
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

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    gap: 14,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardJoined: {
    borderColor: GREEN + "40",
    borderWidth: 1.5,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 22,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ERROR,
    alignSelf: "flex-start",
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: WHITE,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: TEXT_MEDIUM,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  memberCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberCountText: {
    fontSize: 12,
    color: TEXT_LIGHT,
  },
  joinedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: GREEN + "15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GREEN + "30",
  },
  joinedBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  joinBtnLoading: {
    opacity: 0.7,
    paddingHorizontal: 20,
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: "700",
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
