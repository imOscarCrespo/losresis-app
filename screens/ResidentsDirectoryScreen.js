import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import FilterRadioModal from "../components/FilterRadioModal";
import { getCommunityUsers } from "../services/communityService";
import {
  getHospitalsCatalog,
  getSpecialitiesCatalog,
} from "../services/staticCatalogService";
import { openDirectChat } from "../services/directChatsService";
import { getResidentState, RESIDENT_STATE } from "../utils/residentAccess";
import posthogLogger from "../services/posthogService";

const PAGE_SIZE = 25;
const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const CARD_BORDER = "#F1F5F9";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";
const DANGER = "#EF4444";
const WARNING_BG = "#FEF3C7";
const WARNING_BORDER = "#FDE68A";
const WARNING_TEXT = "#92400E";

function ResidentCard({ user, canChat, onPressChat, isStartingChat }) {
  return (
    <View style={styles.userCard}>
      <View style={styles.userAvatar}>
        <Ionicons name="person-outline" size={22} color={PRIMARY} />
      </View>

      <View style={styles.userCardBody}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.name} {user.surname}
        </Text>

        {user.specialty_name ? (
          <View style={styles.userMetaRow}>
            <Ionicons name="medkit-outline" size={14} color={PRIMARY} />
            <Text style={styles.userMetaText} numberOfLines={1}>
              {user.specialty_name}
            </Text>
          </View>
        ) : null}

        {user.hospital_name ? (
          <View style={styles.userMetaRow}>
            <Ionicons name="business-outline" size={14} color={MUTED_LIGHT} />
            <Text style={styles.userMetaText} numberOfLines={1}>
              {user.hospital_name}
            </Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.chatBtn, !canChat && styles.chatBtnDisabled]}
        onPress={onPressChat}
        disabled={!canChat || isStartingChat}
        activeOpacity={0.85}
      >
        {isStartingChat ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={canChat ? "#FFFFFF" : MUTED}
            />
            <Text
              style={[
                styles.chatBtnText,
                !canChat && styles.chatBtnTextDisabled,
              ]}
            >
              Chatear
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function ResidentsDirectoryScreen({
  currentUserId,
  currentUserProfile,
  onSectionChange,
  onBack,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [openModal, setOpenModal] = useState(null);
  const [startingChatUserId, setStartingChatUserId] = useState(null);

  const residentState = useMemo(
    () => getResidentState(currentUserProfile),
    [currentUserProfile]
  );
  const canChat = residentState === RESIDENT_STATE.ACTIVE;

  const specialtyOptions = useMemo(
    () =>
      (getSpecialitiesCatalog() || [])
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    []
  );
  const hospitalOptions = useMemo(
    () =>
      (getHospitalsCatalog() || [])
        .map((h) => ({ id: h.id, name: h.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    []
  );

  const selectedSpecialtyName = useMemo(
    () => specialtyOptions.find((o) => o.id === selectedSpecialty)?.name,
    [specialtyOptions, selectedSpecialty]
  );
  const selectedHospitalName = useMemo(
    () => hospitalOptions.find((o) => o.id === selectedHospital)?.name,
    [hospitalOptions, selectedHospital]
  );
  const hasActiveFilters = Boolean(selectedSpecialty || selectedHospital);

  useEffect(() => {
    posthogLogger.logScreen("ResidentsDirectoryScreen");
  }, []);

  const mapUser = useCallback(
    (u) => ({
      id: u.id,
      name: u.name,
      surname: u.surname,
      specialty_id: u.speciality_id,
      specialty_name: u.specialities?.name || null,
      hospital_id: u.hospital_id,
      hospital_name: u.hospital_name,
      work_email: u.work_email,
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const {
        success,
        users: rawUsers,
        hasMore: more,
        error: fetchError,
      } = await getCommunityUsers(
        "",
        selectedSpecialty,
        selectedHospital,
        currentUserId || "",
        { page: 0, limit: PAGE_SIZE }
      );

      if (cancelled) return;

      if (!success) {
        setError(fetchError || "No se pudieron cargar los residentes");
        setUsers([]);
        setHasMore(false);
      } else {
        setUsers((rawUsers || []).map(mapUser));
        setHasMore(Boolean(more));
      }
      setPage(0);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedSpecialty, selectedHospital, currentUserId, mapUser]);

  const handleLoadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;

    const {
      success,
      users: rawUsers,
      hasMore: more,
    } = await getCommunityUsers(
      "",
      selectedSpecialty,
      selectedHospital,
      currentUserId || "",
      { page: nextPage, limit: PAGE_SIZE }
    );

    if (success) {
      setUsers((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        const next = (rawUsers || []).map(mapUser).filter((u) => !seen.has(u.id));
        return [...prev, ...next];
      });
      setHasMore(Boolean(more));
      setPage(nextPage);
    }
    setLoadingMore(false);
  }, [
    loading,
    loadingMore,
    hasMore,
    page,
    selectedSpecialty,
    selectedHospital,
    currentUserId,
    mapUser,
  ]);

  const clearFilters = useCallback(() => {
    setSelectedSpecialty("");
    setSelectedHospital("");
  }, []);

  const handlePressChat = useCallback(
    async (user) => {
      if (!canChat) return;
      setStartingChatUserId(user.id);
      const response = await openDirectChat({
        otherUserId: user.id,
        otherUserName: `${user.name || ""} ${user.surname || ""}`.trim(),
        onSectionChange,
      });
      setStartingChatUserId(null);

      if (!response?.success) {
        Alert.alert(
          "No se pudo abrir el chat",
          response?.error || "Inténtalo de nuevo en un momento."
        );
      }
    },
    [canChat, onSectionChange]
  );

  return (
    <HeroScreenLayout
      title="Residentes"
      onBack={onBack}
      overlay={
        <>
          <FilterRadioModal
            visible={openModal === "specialty"}
            onClose={() => setOpenModal(null)}
            title="Filtrar por especialidad"
            options={specialtyOptions}
            value={selectedSpecialty}
            onSelect={setSelectedSpecialty}
            placeholder="Todas las especialidades"
          />
          <FilterRadioModal
            visible={openModal === "hospital"}
            onClose={() => setOpenModal(null)}
            title="Filtrar por hospital"
            options={hospitalOptions}
            value={selectedHospital}
            onSelect={setSelectedHospital}
            placeholder="Todos los hospitales"
          />
        </>
      }
    >
      {!canChat ? (
        <View style={styles.banner}>
          <Ionicons name="warning-outline" size={18} color={WARNING_TEXT} />
          <Text style={styles.bannerText}>
            Verifica tu email corporativo para iniciar chats con otros
            residentes.
          </Text>
        </View>
      ) : null}

      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[styles.chip, selectedSpecialty && styles.chipActive]}
          onPress={() => setOpenModal("specialty")}
        >
          <Ionicons
            name="medkit-outline"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
          <Text
            style={[
              styles.chipText,
              selectedSpecialty && styles.chipTextActive,
            ]}
            numberOfLines={1}
          >
            {selectedSpecialtyName || "Especialidad"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedHospital && styles.chipActive]}
          onPress={() => setOpenModal("hospital")}
        >
          <Ionicons
            name="business-outline"
            size={16}
            color={selectedHospital ? PRIMARY : ACCENT}
          />
          <Text
            style={[
              styles.chipText,
              selectedHospital && styles.chipTextActive,
            ]}
            numberOfLines={1}
          >
            {selectedHospitalName || "Hospital"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedHospital ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        {hasActiveFilters ? (
          <TouchableOpacity style={styles.chipClear} onPress={clearFilters}>
            <Ionicons name="close-circle" size={16} color={DANGER} />
            <Text style={styles.chipClearText}>Limpiar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={20} color={DANGER} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.listWrap}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Cargando residentes…</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ResidentCard
                user={item}
                canChat={canChat}
                onPressChat={() => handlePressChat(item)}
                isStartingChat={startingChatUserId === item.id}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="people-outline" size={32} color={PRIMARY} />
                </View>
                <Text style={styles.emptyTitle}>
                  No hay residentes con estos filtros
                </Text>
                <Text style={styles.emptyText}>
                  Prueba a quitar el filtro de hospital o de especialidad.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: WARNING_BG,
    borderWidth: 1,
    borderColor: WARNING_BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: WARNING_TEXT,
    fontWeight: "500",
  },
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    maxWidth: 220,
  },
  chipActive: {
    borderColor: `${PRIMARY}55`,
    backgroundColor: `${PRIMARY}10`,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT,
    maxWidth: 150,
  },
  chipTextActive: {
    color: PRIMARY,
  },
  chipClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
  },
  chipClearText: {
    fontSize: 12,
    fontWeight: "700",
    color: DANGER,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    color: DANGER,
    fontSize: 13,
    fontWeight: "500",
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${PRIMARY}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  userCardBody: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: ACCENT,
  },
  userMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userMetaText: {
    flex: 1,
    fontSize: 12,
    color: MUTED,
  },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: SECONDARY,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    minWidth: 90,
    justifyContent: "center",
  },
  chatBtnDisabled: {
    backgroundColor: "#E5E7EB",
  },
  chatBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  chatBtnTextDisabled: {
    color: MUTED,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: MUTED,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  emptyIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: `${PRIMARY}12`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
  },
});
