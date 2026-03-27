import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHospitals } from "../hooks/useHospitals";
import { ScreenHeader } from "../components/ScreenHeader";
import { ScreenScaffold } from "../components/ScreenScaffold";
import {
  getMyRoommateBundle,
  getRoommateCandidates,
  getRoommateMatches,
  getRoommateQuestions,
  getRoommateSavedFilter,
  saveRoommateBundle,
  saveRoommateSavedFilter,
  saveRoommateSwipe,
} from "../services/roommateService";
import { RoommateSwipeDeck } from "../components/roommate/RoommateSwipeDeck";
import { RoommateProfileDetailModal } from "../components/roommate/RoommateProfileDetailModal";
import { RoommateFiltersModal } from "../components/roommate/RoommateFiltersModal";
import { RoommateProfileEditor } from "../components/roommate/RoommateProfileEditor";
import {
  ROOMMATE_FORM_DEFAULTS,
  ROOMMATE_THEME,
  getRoommateAvatarUrl,
  getBudgetLabel,
  getRoommateDisplayName,
  getRoommateInitials,
  getRoommateTags,
} from "../utils/roommateUtils";

const TABS = [
  { id: "discover", label: "Swipe", icon: "sparkles-outline" },
  { id: "matches", label: "Matches", icon: "heart-outline" },
  { id: "profile", label: "Mi perfil", icon: "person-outline" },
];

export default function RoommateScreen({
  userProfile,
  onBack,
  initialTab = "discover",
  initialMatchId = null,
}) {
  const insets = useSafeAreaInsets();
  const { uniqueCities } = useHospitals();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [questions, setQuestions] = useState([]);
  const [myBundle, setMyBundle] = useState(null);
  const [savedFilters, setSavedFilters] = useState(ROOMMATE_FORM_DEFAULTS.filters);
  const [candidates, setCandidates] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingBundle, setSavingBundle] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [selectedCompatibility, setSelectedCompatibility] = useState(0);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [lastMatchBundle, setLastMatchBundle] = useState(null);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const pendingMatchNavigationRef = useRef(initialMatchId);

  const hasProfile = Boolean(myBundle?.profile?.user_id);
  const hospitalCityOptions = useMemo(
    () => uniqueCities.map((city) => ({ id: city, name: city })),
    [uniqueCities]
  );

  useEffect(() => {
    setActiveTab(initialTab || "discover");
  }, [initialTab]);

  useEffect(() => {
    pendingMatchNavigationRef.current = initialMatchId;
  }, [initialMatchId]);

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

  const loadDiscovery = useCallback(
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

  const loadMatches = useCallback(async () => {
    if (!myBundle?.profile?.user_id) {
      setMatches([]);
      return;
    }

    const response = await getRoommateMatches(userProfile.id);
    if (response.success) {
      setMatches(response.matches || []);
    }
  }, [myBundle, userProfile.id]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (myBundle?.profile?.user_id) {
      loadDiscovery();
      loadMatches();
    } else {
      setCandidates([]);
      setMatches([]);
    }
  }, [myBundle?.profile?.user_id, savedFilters, loadDiscovery, loadMatches]);

  useEffect(() => {
    if (!pendingMatchNavigationRef.current || !matches.length) {
      return;
    }

    const matchToOpen = matches.find(
      (match) => match.id === pendingMatchNavigationRef.current
    );

    if (!matchToOpen) {
      return;
    }

    setActiveTab("matches");
    openBundle(matchToOpen.bundle, matchToOpen.compatibility);
    pendingMatchNavigationRef.current = null;
  }, [matches]);

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

  const handleSwipe = async (decision) => {
    const activeCandidate = candidates[0];
    if (!activeCandidate) return;

    setCandidates((current) => current.slice(1));
    const response = await saveRoommateSwipe(
      userProfile.id,
      activeCandidate.profile.user_id,
      decision
    );

    if (response.success && response.isMatch) {
      setLastMatchBundle(activeCandidate);
      setMatchModalVisible(true);
      loadMatches();
    }
  };

  const validateBundleBeforeSave = (bundleToValidate) => {
    const city = bundleToValidate?.profile?.city?.trim();
    const age = bundleToValidate?.profile?.age;
    const budgetMin = bundleToValidate?.profile?.budget_min_eur;
    const budgetMax = bundleToValidate?.profile?.budget_max_eur;
    const homePlan = bundleToValidate?.profile?.home_plan;
    const lookingFor = bundleToValidate?.profile?.looking_for;
    const preferredGender = bundleToValidate?.search?.preferred_gender;

    if (!city) {
      return "Selecciona una ciudad para tu perfil.";
    }

    if (!homePlan) {
      return "Selecciona tu plan de piso.";
    }

    if (!lookingFor) {
      return "Selecciona qué estás buscando.";
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
      setActiveTab("discover");
      await Promise.all([
        loadDiscovery(response.bundle, savedFilters),
        loadMatches(),
      ]);
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

  const candidateCountLabel = useMemo(() => {
    if (!candidates.length) return "Sin perfiles pendientes";
    return `${candidates.length} perfiles por descubrir`;
  }, [candidates.length]);
  const header = (
    <ScreenHeader
      title="Roomies"
      onBack={onBack}
      compact
      rightSlot={
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setFiltersVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="options-outline" size={18} color={ROOMMATE_THEME.PRIMARY} />
        </TouchableOpacity>
      }
    />
  );

  const renderHero = () => (
    <View style={styles.hero}>
      <Text style={styles.heroEyebrow}>ROOMIES LOSRESIS</Text>
      <Text style={styles.heroTitle}>Encuentra tu match de convivencia</Text>
      <Text style={styles.heroText}>
        Descubre perfiles compatibles, revisa matches y ajusta tus filtros desde el mismo flujo.
      </Text>
    </View>
  );

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
      <Text style={styles.emptyTitle}>Crea tu perfil roomie</Text>
      <Text style={styles.emptyDescription}>
        Completa un onboarding corto con hábitos, presupuesto y lo que buscas en
        convivencia. Después podrás swipear perfiles y ver matches.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setEditorVisible(true)}
      >
        <Text style={styles.primaryButtonText}>Empezar onboarding</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDiscover = () => {
    if (!hasProfile) {
      return renderNoProfile();
    }

    return (
      <View style={styles.discoverWrap}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Descubrir perfiles</Text>
            <Text style={styles.sectionSubtitle}>{candidateCountLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.subtleAction}
            onPress={() => setFiltersVisible(true)}
          >
            <Ionicons name="options-outline" size={16} color={ROOMMATE_THEME.PRIMARY} />
            <Text style={styles.subtleActionText}>Filtros</Text>
          </TouchableOpacity>
        </View>

        <RoommateSwipeDeck
          candidates={candidates}
          onSwipe={handleSwipe}
          onOpenFilters={() => setFiltersVisible(true)}
          onOpenProfile={(bundle) => openBundle(bundle, bundle.compatibility)}
        />
      </View>
    );
  };

  const renderMatches = () => {
    if (!hasProfile) {
      return renderNoProfile();
    }

    if (!matches.length) {
      return (
        <View style={styles.emptyCard}>
          <View style={styles.emptyBadge}>
            <Ionicons name="heart-outline" size={28} color={ROOMMATE_THEME.SECONDARY} />
          </View>
          <Text style={styles.emptyTitle}>Todavía no hay matches</Text>
          <Text style={styles.emptyDescription}>
            Cuando dos personas se dan like mutuamente, aparecerán aquí para que
            revises sus perfiles con calma.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setActiveTab("discover")}
          >
            <Text style={styles.primaryButtonText}>Ir al swipe</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.listWrap}>
        {matches.map((match) => (
          <TouchableOpacity
            key={match.id}
            style={styles.matchCard}
            onPress={() => openBundle(match.bundle, match.compatibility)}
          >
            <View style={styles.matchAvatar}>
              {getRoommateAvatarUrl(match.bundle.profile.avatar_url) ? (
                <Image
                  source={{ uri: getRoommateAvatarUrl(match.bundle.profile.avatar_url) }}
                  style={styles.matchAvatarImage}
                />
              ) : (
                <Text style={styles.matchAvatarText}>
                  {getRoommateInitials(match.bundle.profile)}
                </Text>
              )}
            </View>
            <View style={styles.matchInfo}>
              <Text style={styles.matchName}>
                {getRoommateDisplayName(match.bundle.profile)}
              </Text>
              <Text style={styles.matchMeta}>
                {match.bundle.profile.speciality?.name ||
                  match.bundle.profile.occupation_label ||
                  match.bundle.profile.city}
              </Text>
              <Text style={styles.matchMeta}>
                {getBudgetLabel(match.bundle.profile)}
              </Text>
            </View>
            <View style={styles.matchRight}>
              <View style={styles.matchPill}>
                <Text style={styles.matchPillText}>{match.compatibility}%</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={ROOMMATE_THEME.MUTED}
              />
            </View>
          </TouchableOpacity>
        ))}
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
              <Text style={styles.summaryLabel}>Presupuesto</Text>
              <Text style={styles.summaryValue}>
                {getBudgetLabel(myBundle.profile)}
              </Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Entrada</Text>
              <Text style={styles.summaryValue}>
                {myBundle.profile.move_in_date || "Flexible"}
              </Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Visible</Text>
              <Text style={styles.summaryValue}>
                {myBundle.profile.is_visible ? "Sí" : "No"}
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
      <ScreenScaffold header={header} contentSurfaceStyle={styles.contentSurface}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ROOMMATE_THEME.PRIMARY} />
          <Text style={styles.loadingText}>Preparando roommate matching...</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <>
      <ScreenScaffold header={header} contentSurfaceStyle={styles.contentSurface}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: 36 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ROOMMATE_THEME.PRIMARY}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {renderHero()}
          {renderTabs()}

          {activeTab === "discover" && renderDiscover()}
          {activeTab === "matches" && renderMatches()}
          {activeTab === "profile" && renderProfile()}
        </ScrollView>
      </ScreenScaffold>

      <RoommateProfileEditor
        visible={editorVisible}
        mode={hasProfile ? "edit" : "create"}
        questions={questions}
        initialBundle={myBundle || ROOMMATE_FORM_DEFAULTS}
        cityOptions={hospitalCityOptions}
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
      />

      <RoommateProfileDetailModal
        visible={matchModalVisible}
        onClose={() => setMatchModalVisible(false)}
        bundle={lastMatchBundle}
        compatibility={lastMatchBundle?.compatibility || 0}
        actions={
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setMatchModalVisible(false);
              setActiveTab("matches");
            }}
          >
            <Text style={styles.primaryButtonText}>Ver matches</Text>
          </TouchableOpacity>
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
    borderColor: "#E9DFFF",
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
  discoverWrap: {
    paddingHorizontal: 18,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
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
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  subtleActionText: {
    color: ROOMMATE_THEME.PRIMARY,
    fontWeight: "800",
  },
  emptyCard: {
    marginHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    gap: 14,
  },
  emptyBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3EEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyDescription: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryButton: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    paddingVertical: 16,
    borderRadius: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  listWrap: {
    paddingHorizontal: 18,
    gap: 14,
  },
  matchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  matchAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  matchAvatarImage: {
    width: "100%",
    height: "100%",
  },
  matchAvatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  matchInfo: {
    flex: 1,
    gap: 4,
  },
  matchName: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 17,
    fontWeight: "800",
  },
  matchMeta: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 13,
    fontWeight: "600",
  },
  matchRight: {
    alignItems: "flex-end",
    gap: 10,
  },
  matchPill: {
    backgroundColor: "#E3FBF2",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  matchPillText: {
    color: ROOMMATE_THEME.SECONDARY,
    fontSize: 12,
    fontWeight: "900",
  },
  profileWrap: {
    paddingHorizontal: 18,
    gap: 16,
  },
  profileHero: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  profileAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
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
    fontSize: 28,
    fontWeight: "900",
  },
  profileName: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  profileMeta: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 15,
    fontWeight: "700",
  },
  profileMetaMuted: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 14,
    fontWeight: "600",
  },
  profileTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  profileTag: {
    backgroundColor: "#F3EEFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profileTagText: {
    color: ROOMMATE_THEME.PRIMARY,
    fontSize: 12,
    fontWeight: "800",
  },
  profileInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    gap: 16,
  },
  profileText: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryBox: {
    width: "47%",
    borderRadius: 18,
    backgroundColor: "#F6F1FF",
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
    color: ROOMMATE_THEME.TEXT,
    fontSize: 15,
    fontWeight: "800",
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 15,
    fontWeight: "700",
  },
});
