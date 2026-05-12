import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHospitals } from "../hooks/useHospitals";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { DirectChatButton } from "../components";
import {
  getMyRoommateBundle,
  getRoommateCandidates,
  getRoommateQuestions,
  getRoommateSavedFilter,
  saveRoommateBundle,
  saveRoommateSavedFilter,
} from "../services/roommateService";
import { openDirectChat } from "../services/directChatsService";
import { RoommateProfileDetailModal } from "../components/roommate/RoommateProfileDetailModal";
import { RoommateFiltersModal } from "../components/roommate/RoommateFiltersModal";
import { RoommateProfileEditor } from "../components/roommate/RoommateProfileEditor";
import { RoommateProfileListCard } from "../components/roommate/RoommateProfileListCard";
import {
  ROOMMATE_FORM_DEFAULTS,
  ROOMMATE_THEME,
  getBudgetLabel,
  getRoommateAvatarUrl,
  getRoommateDisplayName,
  getRoommateInitials,
  getRoommateTags,
} from "../utils/roommateUtils";
import { prepareHospitalOptions } from "../utils/profileOptions";

const TABS = [
  { id: "browse", label: "Perfiles", icon: "people-outline" },
  { id: "profile", label: "Mi perfil", icon: "person-outline" },
];

const normalizeInitialTab = (tab) => {
  if (tab === "profile") return "profile";
  return "browse";
};

export default function RoommateScreen({
  userProfile,
  onBack,
  onSectionChange,
  initialTab = "browse",
}) {
  const { hospitals } = useHospitals();
  const [activeTab, setActiveTab] = useState(normalizeInitialTab(initialTab));
  const [questions, setQuestions] = useState([]);
  const [myBundle, setMyBundle] = useState(null);
  const [savedFilters, setSavedFilters] = useState(ROOMMATE_FORM_DEFAULTS.filters);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingBundle, setSavingBundle] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [selectedCompatibility, setSelectedCompatibility] = useState(0);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const hasProfile = Boolean(myBundle?.profile?.user_id);
  const hospitalOptions = useMemo(
    () => prepareHospitalOptions(hospitals),
    [hospitals]
  );

  useEffect(() => {
    setActiveTab(normalizeInitialTab(initialTab));
  }, [initialTab]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [questionsResponse, bundleResponse, filtersResponse] =
        await Promise.all([
          getRoommateQuestions(),
          getMyRoommateBundle(userProfile.id),
          getRoommateSavedFilter(userProfile.id),
        ]);

      if (questionsResponse.success) {
        setQuestions(questionsResponse.questions || []);
      }

      if (bundleResponse.success) {
        setMyBundle(bundleResponse.bundle);
      }

      if (filtersResponse.success && filtersResponse.filters) {
        setSavedFilters({
          ...ROOMMATE_FORM_DEFAULTS.filters,
          ...filtersResponse.filters,
        });
      } else {
        setSavedFilters(ROOMMATE_FORM_DEFAULTS.filters);
      }
    } finally {
      setLoading(false);
    }
  }, [userProfile.id]);

  const loadCandidates = useCallback(
    async (bundle = myBundle, filters = savedFilters) => {
      if (!bundle?.profile?.user_id) {
        setCandidates([]);
        return;
      }

      const response = await getRoommateCandidates(userProfile.id, filters);
      if (response.success) {
        setCandidates(response.candidates || []);
      }
    },
    [myBundle, savedFilters, userProfile.id]
  );

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (myBundle?.profile?.user_id) {
      loadCandidates();
    } else {
      setCandidates([]);
    }
  }, [myBundle?.profile?.user_id, savedFilters, loadCandidates]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBase();
    setRefreshing(false);
  };

  const openBundle = (bundle, compatibility = 0) => {
    setSelectedBundle(bundle);
    setSelectedCompatibility(compatibility);
    setProfileModalVisible(true);
  };

  const validateBundleBeforeSave = (bundleToValidate) => {
    const city = bundleToValidate?.profile?.city?.trim();
    const hospitalId = bundleToValidate?.profile?.hospital_id?.trim();
    const age = bundleToValidate?.profile?.age;
    const budgetMin = bundleToValidate?.profile?.budget_min_eur;
    const budgetMax = bundleToValidate?.profile?.budget_max_eur;
    const homePlan = bundleToValidate?.profile?.home_plan;
    const preferredGender = bundleToValidate?.search?.preferred_gender;

    if (!hospitalId) {
      return "Selecciona el hospital más cercano para tu perfil.";
    }

    if (!city) {
      return "No se pudo determinar la ciudad desde el hospital seleccionado.";
    }

    if (!homePlan) {
      return "Selecciona tu plan de piso.";
    }

    if (!preferredGender) {
      return "Selecciona una preferencia de género.";
    }

    if (age && Number.isNaN(Number(age))) {
      return "La edad debe ser numérica.";
    }

    if (budgetMin && Number.isNaN(Number(budgetMin))) {
      return "El presupuesto mínimo debe ser numérico.";
    }

    if (budgetMax && Number.isNaN(Number(budgetMax))) {
      return "El presupuesto máximo debe ser numérico.";
    }

    if (
      budgetMin &&
      budgetMax &&
      !Number.isNaN(Number(budgetMin)) &&
      !Number.isNaN(Number(budgetMax)) &&
      Number(budgetMin) > Number(budgetMax)
    ) {
      return "El presupuesto mínimo no puede ser mayor que el máximo.";
    }

    return null;
  };

  const handleSaveProfile = async (bundleToSave) => {
    const validationError = validateBundleBeforeSave(bundleToSave);
    if (validationError) {
      Alert.alert("Error", validationError);
      return;
    }

    setSavingBundle(true);
    try {
      const response = await saveRoommateBundle(userProfile.id, bundleToSave);

      if (!response.success) {
        Alert.alert(
          "Error",
          response.error || "No se pudo guardar tu perfil roomie."
        );
        return;
      }

      setMyBundle(response.bundle);
      setEditorVisible(false);
      setActiveTab("browse");
      await loadCandidates(response.bundle, savedFilters);
      Alert.alert("Éxito", "Tu perfil roomie se ha guardado correctamente.");
    } catch (error) {
      Alert.alert(
        "Error",
        error?.message || "Se produjo un error inesperado al guardar el perfil."
      );
    } finally {
      setSavingBundle(false);
    }
  };

  const handleSaveFilters = async (filters) => {
    const response = await saveRoommateSavedFilter(userProfile.id, filters);
    if (response.success) {
      setSavedFilters({
        ...ROOMMATE_FORM_DEFAULTS.filters,
        ...response.filters,
      });
      setFiltersVisible(false);
    }
  };

  const handleOpenChat = async (bundle = selectedBundle) => {
    const otherUserId = bundle?.profile?.user_id;

    if (!otherUserId) {
      Alert.alert("Error", "No se pudo identificar el perfil para abrir el chat.");
      return;
    }

    try {
      setOpeningChat(true);
      const response = await openDirectChat({
        otherUserId,
        otherUserName: getRoommateDisplayName(bundle.profile),
        onSectionChange,
      });

      if (!response.success || !response.chat?.group_id) {
        Alert.alert(
          "Error",
          response.error || "No se pudo abrir la conversación privada."
        );
        return;
      }

      setProfileModalVisible(false);
    } catch (error) {
      Alert.alert(
        "Error",
        error?.message || "No se pudo abrir la conversación privada."
      );
    } finally {
      setOpeningChat(false);
    }
  };

  const candidateCountLabel = useMemo(() => {
    if (!candidates.length) return "Sin perfiles disponibles en tu ciudad";
    if (candidates.length === 1) return "1 perfil compatible cerca de ti";
    return `${candidates.length} perfiles compatibles en tu ciudad`;
  }, [candidates.length]);

  const heroProps = {
    title: "Roomies",
    subtitle:
      "Encuentra compañeros de piso afines cerca de tu hospital, ordenados según afinidad y estilo de vida.",
    onBack,
    rightSlot: hasProfile ? (
      <TouchableOpacity
        style={styles.headerAction}
        onPress={() => setFiltersVisible(true)}
        activeOpacity={0.75}
      >
        <Ionicons
          name="options-outline"
          size={18}
          color={ROOMMATE_THEME.PRIMARY}
        />
      </TouchableOpacity>
    ) : null,
  };

  const renderTabs = () => (
    <View style={styles.tabsRow}>
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabButton, active && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={active ? ROOMMATE_THEME.PRIMARY : ROOMMATE_THEME.MUTED}
            />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderNoProfile = () => (
    <View style={styles.emptyCard}>
      <View style={styles.emptyBadge}>
        <Ionicons name="home-outline" size={28} color={ROOMMATE_THEME.PRIMARY} />
      </View>
      <Text style={styles.emptyTitle}>Crea tu perfil RoomieMIR</Text>
      <Text style={styles.emptyDescription}>
        Completa tu perfil con tu hospital, presupuesto y preferencias de
        convivencia. Te mostraremos residentes compatibles ordenados por
        afinidad y cercanía
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setEditorVisible(true)}
      >
        <Text style={styles.primaryButtonText}>Crear mi perfil</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBrowse = () => {
    if (!hasProfile) {
      return renderNoProfile();
    }

    return (
      <View style={styles.listSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Perfiles recomendados</Text>
            <Text style={styles.sectionSubtitle}>{candidateCountLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.subtleAction}
            onPress={() => setFiltersVisible(true)}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color={ROOMMATE_THEME.PRIMARY}
            />
            <Text style={styles.subtleActionText}>Filtros</Text>
          </TouchableOpacity>
        </View>

        {candidates.length ? (
          <View style={styles.cardsList}>
            {candidates.map((candidate) => (
              <RoommateProfileListCard
                key={candidate.profile.user_id}
                candidate={candidate}
                onPress={(item) => openBundle(item, item.compatibility)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyBadge}>
              <Ionicons
                name="people-outline"
                size={28}
                color={ROOMMATE_THEME.SECONDARY}
              />
            </View>
            <Text style={styles.emptyTitle}>No hay perfiles ahora mismo</Text>
            <Text style={styles.emptyDescription}>
              Cuando entren más personas en {myBundle?.profile?.city || "tu ciudad"},
              aparecerán aquí ordenadas por probabilidad de match.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderProfile = () => {
    if (!hasProfile) {
      return renderNoProfile();
    }

    const tags = getRoommateTags(myBundle.profile, myBundle.lifestyle);

    return (
      <View style={styles.profileWrap}>
        <View style={styles.profileHero}>
          <View style={styles.profileAvatar}>
            {getRoommateAvatarUrl(myBundle.profile.avatar_url) ? (
              <Image
                source={{ uri: getRoommateAvatarUrl(myBundle.profile.avatar_url) }}
                style={styles.profileAvatarImage}
              />
            ) : (
              <Text style={styles.profileAvatarText}>
                {getRoommateInitials(myBundle.profile)}
              </Text>
            )}
          </View>
          <Text style={styles.profileName}>
            {getRoommateDisplayName(myBundle.profile)}
          </Text>
          <Text style={styles.profileMeta}>
            {myBundle.profile.speciality?.name ||
              myBundle.profile.occupation_label ||
              "Perfil roomie"}
          </Text>
          <Text style={styles.profileMetaMuted}>
            {myBundle.profile.hospital?.name || myBundle.profile.city}
          </Text>
          <View style={styles.profileTagsRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.profileTag}>
                <Text style={styles.profileTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.profileInfoCard}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <Text style={styles.profileText}>
            {myBundle.profile.bio ||
              "Aún no has añadido una bio. Cuéntales cómo sería convivir contigo."}
          </Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Hospital</Text>
              <Text style={styles.summaryValue}>
                {myBundle.profile.hospital?.name || "Sin hospital"}
              </Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Ciudad</Text>
              <Text style={styles.summaryValue}>
                {myBundle.profile.city || "Sin ciudad"}
              </Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Presupuesto</Text>
              <Text style={styles.summaryValue}>
                {getBudgetLabel(myBundle.profile)}
              </Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Buscando</Text>
              <Text style={styles.summaryValue}>
                {myBundle.profile.is_active ? "Activo" : "Pausado"}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setEditorVisible(true)}
        >
          <Text style={styles.primaryButtonText}>Editar perfil</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <HeroScreenLayout {...heroProps}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ROOMMATE_THEME.PRIMARY} />
          <Text style={styles.loadingText}>Preparando perfiles roomie...</Text>
        </View>
      </HeroScreenLayout>
    );
  }

  return (
    <>
      <HeroScreenLayout {...heroProps}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ROOMMATE_THEME.PRIMARY}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {renderTabs()}
          {activeTab === "browse" ? renderBrowse() : renderProfile()}
        </ScrollView>
      </HeroScreenLayout>

      <RoommateProfileEditor
        visible={editorVisible}
        mode={hasProfile ? "edit" : "create"}
        questions={questions}
        initialBundle={myBundle || ROOMMATE_FORM_DEFAULTS}
        hospitalOptions={hospitalOptions}
        hospitals={hospitals}
        onClose={() => setEditorVisible(false)}
        onSave={handleSaveProfile}
        saving={savingBundle}
      />

      <RoommateFiltersModal
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        initialFilters={savedFilters}
        onSave={handleSaveFilters}
      />

      <RoommateProfileDetailModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        bundle={selectedBundle}
        compatibility={selectedCompatibility}
        actions={
          <DirectChatButton
            style={[styles.primaryButton, openingChat && styles.buttonDisabled]}
            onPress={() => handleOpenChat(selectedBundle)}
            loading={openingChat}
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
  },
  content: {
    gap: 18,
    paddingBottom: 36,
  },
  hero: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 22,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    gap: 10,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  heroTitle: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
  },
  heroText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  tabsRow: {
    marginHorizontal: 18,
    marginTop: -4,
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
  },
  tabButtonActive: {
    borderWidth: 1,
    borderColor: "#DACDFF",
    backgroundColor: "#F8F4FF",
  },
  tabText: {
    color: ROOMMATE_THEME.MUTED,
    fontWeight: "800",
    fontSize: 13,
  },
  tabTextActive: {
    color: ROOMMATE_THEME.PRIMARY,
  },
  listSection: {
    paddingHorizontal: 18,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 4,
    color: ROOMMATE_THEME.MUTED,
    fontSize: 14,
    fontWeight: "600",
  },
  subtleAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  subtleActionText: {
    color: ROOMMATE_THEME.PRIMARY,
    fontWeight: "800",
    fontSize: 13,
  },
  cardsList: {
    gap: 14,
  },
  emptyCard: {
    marginHorizontal: 18,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  emptyBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: ROOMMATE_THEME.SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyDescription: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  profileWrap: {
    paddingHorizontal: 18,
    gap: 16,
  },
  profileHero: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
  },
  profileAvatarText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  profileName: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  profileMeta: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  profileMetaMuted: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  profileTagsRow: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  profileTag: {
    borderRadius: 999,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  profileTagText: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 12,
    fontWeight: "700",
  },
  profileInfoCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 22,
    gap: 16,
  },
  profileText: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 14,
    lineHeight: 22,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryBox: {
    width: "47%",
    borderRadius: 20,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
    padding: 14,
    gap: 6,
  },
  summaryLabel: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 14,
    fontWeight: "800",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingText: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 14,
    fontWeight: "700",
  },
});
