import React, { useState, useEffect, useRef } from "react";
import { AppState, View, Text, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenLayout } from "../components/ScreenLayout";
import { BackNavigationButton } from "../components/BackNavigationButton";
import { PlaceholderScreen } from "../components/PlaceholderScreen";
import { SwipeBackWrapper } from "../components/SwipeBackWrapper";
import HospitalsScreen from "./HospitalsScreen";
import HospitalDetailScreen from "./HospitalDetailScreen";
import HospitalInfoScreen from "./HospitalInfoScreen";
import MirSimulatorScreen from "./MirSimulatorScreen";
import MirOrientationScreen from "./MirOrientationScreen";
import MirProjectedScoreScreen from "./MirProjectedScoreScreen";
import ProfileScreen from "./ProfileScreen";
import ProfileEditScreen from "./ProfileEditScreen";
import MyConnectionsScreen from "./MyConnectionsScreen";
import MenuScreen from "./MenuScreen";
import MyPreferencesScreen from "./MyPreferencesScreen";
import ComunityScreen from "./ComunityScreen";
import ResidentsDirectoryScreen from "./ResidentsDirectoryScreen";
import MyReviewScreen from "./MyReviewScreen";
import ResidenceLibraryScreen from "./ResidenceLibraryScreen";
import ReviewsScreen from "./ReviewsScreen";
import ReviewDetailScreen from "./ReviewDetailScreen";
import ArticlesScreen from "./ArticlesScreen";
import ArticleDetailScreen from "./ArticleDetailScreen";
import CourseDetailScreen from "./CourseDetailScreen";
import HomeDashboardScreen from "./HomeDashboardScreen";
import HousingScreen from "./HousingScreen";
import HousingAdDetailScreen from "./HousingAdDetailScreen";
import CreateHousingAdScreen from "./CreateHousingAdScreen";
import CreateRoommateProfileScreen from "./CreateRoommateProfileScreen";
import CreateCourseScreen from "./CreateCourseScreen";
import ReviewComposerScreen from "./ReviewComposerScreen";
import ContactScreen from "./ContactScreen";
import AgendaScreen from "./AgendaScreen";
import { ExternalRotationsScreen } from "./ExternalRotationsScreen";
import { LecturesScreen } from "./LecturesScreen";
import LeisureScreen from "./LeisureScreen";
import LeisureForumScreen from "./LeisureForumScreen";
import SportsSelectionScreen from "./SportsSelectionScreen";
import ThreadDetailScreen from "./ThreadDetailScreen";
import ClinicalAssistantScreen from "./ClinicalAssistantScreen";
import NotificationSettingsScreen from "../src/screens/settings/NotificationSettingsScreen";
import NotificationsScreen from "../src/screens/notifications/NotificationsScreen";
import { setNotificationNavigationHandler } from "../src/services/push/notificationRouter";
import { openDirectChat } from "../services/directChatsService";
import SpecialityQuizScreen from "./SpecialityQuizScreen";
import GroupsScreen from "./GroupsScreen";
import GroupChatScreen from "./GroupChatScreen";
import RoommateScreen from "./RoommateScreen";
import MentalHealthScreen from "./MentalHealthScreen";
import ResidentPayoutsScreen from "./ResidentPayoutsScreen";
import ResidentPayoutDetailScreen from "./ResidentPayoutDetailScreen";
import ResidentPayoutEntryScreen from "./ResidentPayoutEntryScreen";
import { getCurrentUser, getUserProfile } from "../services/authService";
import { getFooterConfig } from "../constants/footerConfig";
import posthogLogger from "../services/posthogService";
import { DEV_USER_TYPE } from "../config/devConfig";
import { getClinicalAssistantAccess } from "../services/featureAccessService";
import {
  isQualifiedResidentSection,
  registerQualifiedResidentAction,
} from "../services/residentReviewGateService";
import {
  isResidentLockedMissingCorporateEmail,
  shouldBypassResidentReviewGate,
} from "../utils/residentAccess";
import { getResidentTransitionConfig } from "../services/residentTransitionConfigService";

/**
 * Aplica el override de tipo de usuario definido en devConfig.js.
 * Solo actúa si DEV_USER_TYPE tiene un valor distinto de null.
 */
const applyDevUserType = (profile) => {
  if (!DEV_USER_TYPE || !profile) return profile;

  const overrides = {
    is_resident: false,
    is_student: false,
    is_doctor: false,
    is_super_admin: false,
  };

  if (DEV_USER_TYPE === "resident") {
    overrides.is_resident = true;
  } else if (DEV_USER_TYPE === "student") {
    overrides.is_student = true;
  } else if (DEV_USER_TYPE === "admin") {
    overrides.is_resident = true;
    overrides.is_super_admin = true;
  }

  console.log(`🛠️ [DEV] Simulando usuario tipo: "${DEV_USER_TYPE}"`);
  return { ...profile, ...overrides };
};

const GENERIC_BACK_SECTIONS = new Set([
  "menu",
  "myPreferences",
  "myReview",
  "residenceLibrary",
  "libro-residente",
  "articulos",
  "vivienda",
  "roomies",
  "ocio",
  "notifications",
  "clinicalAssistant",
  "specialityQuiz",
  "rotaciones-externas",
  "cursos",
  "residentPayouts",
  "residentPayoutDetail",
  "residentPayoutEntry",
  "mentalHealth",
]);

const DASHBOARD_NAVIGATION_STATE_VERSION = 1;
const DASHBOARD_NAVIGATION_STORAGE_KEY_PREFIX =
  "@losresis:dashboardNavigation:";
const DEFAULT_RESIDENT_PAYOUT_ROUTE_PARAMS = {
  initialYear: null,
  initialMonth: null,
  lockInitialPeriod: false,
};

const getDashboardNavigationStorageKey = (userId) =>
  `${DASHBOARD_NAVIGATION_STORAGE_KEY_PREFIX}${userId}`;

const parseStoredDashboardNavigation = (value) => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (parsed?.version !== DASHBOARD_NAVIGATION_STATE_VERSION) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("Error parsing stored dashboard navigation:", error);
    return null;
  }
};

const showClinicalAssistantAccessAlert = () => {
  Alert.alert(
    "Acceso no disponible",
    "No tienes acceso a esta funcionalidad."
  );
};

export default function DashboardScreen({
  onSignOut: onSignOutProp,
  residentHasReview = true,
  residentReviewGateState = null,
  residentReviewGateConfig = null,
  onReviewCreated,
  onReviewDeleted,
  showUpdateBanner = false,
  updateUrl = null,
}) {
  const [userProfile, setUserProfile] = useState(null);
  const [residentTransitionConfig, setResidentTransitionConfig] = useState(null);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [showHospitalInfoScreen, setShowHospitalInfoScreen] = useState(false);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState(null);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedHousingAdId, setSelectedHousingAdId] = useState(null);
  const [creatingHousingAd, setCreatingHousingAd] = useState(false);
  const [editingHousingAdId, setEditingHousingAdId] = useState(null);
  const [editingRoommateProfile, setEditingRoommateProfile] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [reviewComposerMode, setReviewComposerMode] = useState(null);
  const [previousSection, setPreviousSection] = useState(null); // Para volver a la sección correcta
  const [sectionHistory, setSectionHistory] = useState([]);
  const [leisureForumType, setLeisureForumType] = useState(null); // Tipo de foro: "Fiesta" o "Deporte"
  const [selectedThreadId, setSelectedThreadId] = useState(null); // ID del thread seleccionado
  const [selectedGroupId, setSelectedGroupId] = useState(null); // ID del grupo de chat
  const [selectedGroupName, setSelectedGroupName] = useState(null); // Nombre del grupo de chat
  const [roommateInitialTab, setRoommateInitialTab] = useState("discover");
  const [selectedRoommateMatchId, setSelectedRoommateMatchId] = useState(null);
  const [myReviewAutoOpenCreate, setMyReviewAutoOpenCreate] = useState(false);
  const [myReviewAutoFocusQuestions, setMyReviewAutoFocusQuestions] =
    useState(false);
  const [profileAutoFocusWorkEmail, setProfileAutoFocusWorkEmail] =
    useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [residentPayoutRouteParams, setResidentPayoutRouteParams] = useState(
    DEFAULT_RESIDENT_PAYOUT_ROUTE_PARAMS
  );
  const [mirSimulatorInitialScore, setMirSimulatorInitialScore] = useState(null);
  const [localResidentGateState, setLocalResidentGateState] =
    useState(residentReviewGateState);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const hydratedUserIdRef = useRef(null);
  const screenLayoutProps = {
    showUpdateBanner,
    updateUrl,
  };

  // Determinar sección inicial según el tipo de usuario (primera pestaña = Inicio)
  const getInitialSection = (profile) => {
    if (!profile) return "inicio";
    const footerConfig = getFooterConfig(profile);
    return footerConfig[0]?.screen || "inicio";
  };

  const [currentSection, setCurrentSection] = useState(() =>
    getInitialSection(null)
  );

  // Cargar perfil del usuario
  useEffect(() => {
    loadUserProfile({ forceRefresh: true });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadUserProfile({ forceRefresh: true }).catch((error) => {
          console.warn("Error revalidando perfil del dashboard:", error);
        });
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const hydrateNavigation = async () => {
      if (loadingProfile) {
        return;
      }

      const defaultSection = getInitialSection(userProfile);
      const currentUserId = userProfile?.id || null;

      if (hydratedUserIdRef.current === currentUserId) {
        setIsNavigationReady(true);
        return;
      }

      if (!currentUserId) {
        if (!isCancelled) {
          hydratedUserIdRef.current = null;
          setCurrentSection(defaultSection);
          setIsNavigationReady(true);
        }
        return;
      }

      try {
        const storageKey = getDashboardNavigationStorageKey(currentUserId);
        const storedValue = await AsyncStorage.getItem(storageKey);
        const snapshot = parseStoredDashboardNavigation(storedValue);

        if (isCancelled) {
          return;
        }

        const currentSectionToRestore =
          typeof snapshot?.currentSection === "string" && snapshot.currentSection
            ? snapshot.currentSection
            : defaultSection;

        setCurrentSection(currentSectionToRestore);
        setSelectedHospital(snapshot?.selectedHospital ?? null);
        setShowHospitalInfoScreen(Boolean(snapshot?.showHospitalInfoScreen));
        setSelectedSpecialtyId(snapshot?.selectedSpecialtyId ?? null);
        setSelectedReviewId(snapshot?.selectedReviewId ?? null);
        setSelectedArticleId(snapshot?.selectedArticleId ?? null);
        setSelectedCourseId(snapshot?.selectedCourseId ?? null);
        setSelectedHousingAdId(snapshot?.selectedHousingAdId ?? null);
        setCreatingHousingAd(Boolean(snapshot?.creatingHousingAd));
        setEditingHousingAdId(snapshot?.editingHousingAdId ?? null);
        setEditingRoommateProfile(Boolean(snapshot?.editingRoommateProfile));
        setCreatingCourse(Boolean(snapshot?.creatingCourse));
        setEditingCourseId(snapshot?.editingCourseId ?? null);
        setReviewComposerMode(snapshot?.reviewComposerMode ?? null);
        setPreviousSection(snapshot?.previousSection ?? null);
        setSectionHistory(Array.isArray(snapshot?.sectionHistory) ? snapshot.sectionHistory : []);
        setLeisureForumType(snapshot?.leisureForumType ?? null);
        setSelectedThreadId(snapshot?.selectedThreadId ?? null);
        setSelectedGroupId(snapshot?.selectedGroupId ?? null);
        setSelectedGroupName(snapshot?.selectedGroupName ?? null);
        setRoommateInitialTab(snapshot?.roommateInitialTab || "discover");
        setSelectedRoommateMatchId(snapshot?.selectedRoommateMatchId ?? null);
        setMyReviewAutoOpenCreate(Boolean(snapshot?.myReviewAutoOpenCreate));
        setMyReviewAutoFocusQuestions(Boolean(snapshot?.myReviewAutoFocusQuestions));
        setSelectedQuestionId(snapshot?.selectedQuestionId ?? null);
        setResidentPayoutRouteParams({
          initialYear: snapshot?.residentPayoutRouteParams?.initialYear ?? null,
          initialMonth: snapshot?.residentPayoutRouteParams?.initialMonth ?? null,
          lockInitialPeriod: Boolean(
            snapshot?.residentPayoutRouteParams?.lockInitialPeriod
          ),
        });
        hydratedUserIdRef.current = currentUserId;
        setIsNavigationReady(true);
      } catch (error) {
        console.error("Error restoring dashboard navigation:", error);
        if (!isCancelled) {
          hydratedUserIdRef.current = currentUserId;
          setCurrentSection(defaultSection);
          setIsNavigationReady(true);
        }
      }
    };

    hydrateNavigation();

    return () => {
      isCancelled = true;
    };
  }, [loadingProfile, userProfile?.id]);

  useEffect(() => {
    const persistNavigation = async () => {
      if (!isNavigationReady || !userProfile?.id) {
        return;
      }

      try {
        const storageKey = getDashboardNavigationStorageKey(userProfile.id);
        const snapshot = {
          version: DASHBOARD_NAVIGATION_STATE_VERSION,
          currentSection,
          selectedHospital,
          showHospitalInfoScreen,
          selectedSpecialtyId,
          selectedReviewId,
          selectedArticleId,
          selectedCourseId,
          selectedHousingAdId,
          creatingHousingAd,
          editingHousingAdId,
          editingRoommateProfile,
          creatingCourse,
          editingCourseId,
          reviewComposerMode,
          previousSection,
          sectionHistory,
          leisureForumType,
          selectedThreadId,
          selectedGroupId,
          selectedGroupName,
          roommateInitialTab,
          selectedRoommateMatchId,
          myReviewAutoOpenCreate,
          myReviewAutoFocusQuestions,
          selectedQuestionId,
          residentPayoutRouteParams,
        };

        await AsyncStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch (error) {
        console.error("Error saving dashboard navigation:", error);
      }
    };

    persistNavigation();
  }, [
    isNavigationReady,
    userProfile?.id,
    currentSection,
    selectedHospital,
    showHospitalInfoScreen,
    selectedSpecialtyId,
    selectedReviewId,
    selectedArticleId,
    selectedCourseId,
    selectedHousingAdId,
    creatingHousingAd,
    editingHousingAdId,
    editingRoommateProfile,
    creatingCourse,
    editingCourseId,
    reviewComposerMode,
    previousSection,
    sectionHistory,
    leisureForumType,
    selectedThreadId,
    selectedGroupId,
    selectedGroupName,
    roommateInitialTab,
    selectedRoommateMatchId,
    myReviewAutoOpenCreate,
    myReviewAutoFocusQuestions,
    selectedQuestionId,
    residentPayoutRouteParams,
  ]);

  useEffect(() => {
    setLocalResidentGateState(residentReviewGateState);
  }, [residentReviewGateState]);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("DashboardScreen");
  }, []);

  // Tracking de cambios de sección
  useEffect(() => {
    if (currentSection) {
      posthogLogger.logScreen(`DashboardScreen_${currentSection}`, {
        section: currentSection,
      });
    }
  }, [currentSection]);

  useEffect(() => {
    const cleanup = setNotificationNavigationHandler((data) => {
      // Solicitud de conexión: llevar a la bandeja, donde se acepta/rechaza inline.
      if (data?.destination_section === "notifications") {
        handleSectionChange("notifications");
        return;
      }

      // Conexión aceptada: abrir el chat directo con el otro residente.
      if (data?.destination_section === "directChat" && data?.other_user_id) {
        openDirectChat({
          otherUserId: data.other_user_id,
          otherUserName: "",
          onSectionChange: handleSectionChange,
        });
        return;
      }

      if (data?.destination_section === "groupChat" && data?.group_id) {
        handleSectionChange("groupChat", {
          groupId: data.group_id,
          groupName: data.group_name || "Grupo",
        });
        return;
      }

      if (data?.destination_section === "myReview") {
        handleSectionChange("myReview", {
          focusQuestions: true,
          questionId: data.question_id,
        });
        return;
      }

      if (data?.destination_section === "mentalHealth") {
        handleSectionChange("mentalHealth");
        return;
      }

      if (data?.entity_type === "review" && data?.entity_id) {
        handleSectionChange("reviewDetail", {
          reviewId: data.entity_id,
          questionId: data.question_id,
        });
        return;
      }

      if (data?.entity_type === "comment" && data?.entity_id) {
        handleSectionChange("threadDetail", { threadId: data.entity_id });
        return;
      }

      if (data?.entity_type === "roommate_match" && data?.entity_id) {
        handleSectionChange("roomies", {
          initialTab: "matches",
          matchId: data.entity_id,
        });
        return;
      }

      if (data?.entity_type === "course" && data?.entity_id) {
        handleSectionChange("courseDetail", { courseId: data.entity_id });
      }
    });

    return cleanup;
  }, []);

  const loadUserProfile = async ({ forceRefresh = false } = {}) => {
    try {
      setLoadingProfile(true);
      const { success: userSuccess, user } = await getCurrentUser();
      if (userSuccess && user) {
        const { success: profileSuccess, profile } = await getUserProfile(
          user.id,
          { forceRefresh }
        );
        if (profileSuccess && profile) {
          const { enabled: canUseClinicalAssistant } =
            await getClinicalAssistantAccess(user.id);
          setUserProfile(
            applyDevUserType({
              ...profile,
              can_use_clinical_assistant: canUseClinicalAssistant,
            })
          );
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { config } = await getResidentTransitionConfig();
      if (!cancelled) setResidentTransitionConfig(config || null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const residentReviewGateBypassed = shouldBypassResidentReviewGate(
    userProfile,
    residentTransitionConfig
  );
  const residentGateEnabled =
    userProfile?.is_resident &&
    !userProfile?.is_super_admin &&
    !residentReviewGateBypassed &&
    !residentHasReview;
  const residentGateStatus = localResidentGateState?.status || "soft";
  const residentGatePromptVisible = Boolean(localResidentGateState?.promptVisible);
  const residentGateBudget = {
    qualifiedActionsCount: localResidentGateState?.qualifiedActionsCount || 0,
    sessionsCount: localResidentGateState?.sessionsCount || 0,
    hardGateActionLimit: residentReviewGateConfig?.hardGateActionLimit || 8,
    hardGateSessionLimit: residentReviewGateConfig?.hardGateSessionLimit || 2,
    promptActionThreshold: residentReviewGateConfig?.promptActionThreshold || 5,
  };
  const residentHardGateAllowedSections = new Set([
    "inicio",
    "myReview",
    "usuario",
    "contacto",
    // Salud mental siempre accesible: los recursos de ayuda no deben quedar
    // detrás del gate de reseña (la propia pantalla bloquea el cuestionario).
    "mentalHealth",
  ]);

  useEffect(() => {
    if (
      isResidentLockedMissingCorporateEmail(userProfile) &&
      !["inicio", "usuario", "profileEdit", "contacto", "mentalHealth"].includes(
        currentSection
      )
    ) {
      setCurrentSection("usuario");
    }
  }, [currentSection, userProfile]);

  useEffect(() => {
    if (
      loadingProfile ||
      !isNavigationReady ||
      currentSection !== "clinicalAssistant" ||
      !userProfile ||
      userProfile.can_use_clinical_assistant
    ) {
      return;
    }

    showClinicalAssistantAccessAlert();
    setCurrentSection(getDefaultSection());
  }, [
    currentSection,
    isNavigationReady,
    loadingProfile,
    userProfile,
  ]);

  const showResidentGateAlert = () => {
    Alert.alert(
      "Ayuda a los que vienen detrás",
      "Tu experiencia como residente puede ayudar muchísimo a futuros MIR a elegir mejor su plaza. Solo te llevará menos de 2 minutos.",
      [
        {
          text: "Escribir mi reseña",
          onPress: () => {
            posthogLogger.capture("resident_review_gate_prompt_clicked", {
              source: "hard_gate_alert",
              status: residentGateStatus,
            });
            setCurrentSection("myReview");
          },
        },
        { text: "Más tarde", style: "cancel" },
      ]
    );
  };

  const handleSectionChange = async (sectionId, params = {}) => {
    if (
      isResidentLockedMissingCorporateEmail(userProfile) &&
      !["inicio", "usuario", "profileEdit", "contacto"].includes(sectionId)
    ) {
      Alert.alert(
        "Correo corporativo requerido",
        "La ventana temporal MIR ya ha terminado. Añade tu correo corporativo en el perfil para recuperar el acceso completo."
      );
      setCurrentSection("usuario");
      return;
    }

    if (sectionId === "clinicalAssistant" && !userProfile?.can_use_clinical_assistant) {
      showClinicalAssistantAccessAlert();
      setCurrentSection(getDefaultSection());
      return;
    }

    if (
      residentGateEnabled &&
      residentGateStatus === "hard" &&
      !residentHardGateAllowedSections.has(sectionId)
    ) {
      posthogLogger.capture("resident_review_gate_blocked_navigation", {
        section: sectionId,
        current_section: currentSection,
      });
      showResidentGateAlert();
      return;
    }

    const footerSections = new Set(
      getFooterConfig(userProfile).map((item) => item.screen)
    );
    const isFooterSection = footerSections.has(sectionId);
    const shouldTrackBack = GENERIC_BACK_SECTIONS.has(sectionId);

    if (sectionId !== currentSection) {
      if (shouldTrackBack) {
        const originSection = params.fromSection || currentSection;
        setSectionHistory((prev) => {
          if (prev[prev.length - 1] === originSection) {
            return prev;
          }
          return [...prev, originSection];
        });
      } else if (isFooterSection) {
        setSectionHistory([]);
      }
    }

    setCurrentSection(sectionId);
    // Limpiar selecciones cuando cambiamos de sección
    if (
      sectionId !== "hospitalDetail" &&
      sectionId !== "reviewDetail" &&
      sectionId !== "articleDetail" &&
      sectionId !== "courseDetail" &&
      sectionId !== "housingDetail" &&
      sectionId !== "createHousingAd" &&
      sectionId !== "editHousingAd" &&
      sectionId !== "editRoommateProfile" &&
      sectionId !== "createCourse" &&
      sectionId !== "editCourse" &&
      sectionId !== "groupChat"
    ) {
      setSelectedHospital(null);
      setSelectedSpecialtyId(null);
      setSelectedReviewId(null);
      setSelectedArticleId(null);
      setSelectedCourseId(null);
      setSelectedHousingAdId(null);
      setCreatingHousingAd(false);
      setEditingHousingAdId(null);
      setEditingRoommateProfile(false);
      setCreatingCourse(false);
      setEditingCourseId(null);
      setReviewComposerMode(null);
      setMyReviewAutoOpenCreate(false);
      setMyReviewAutoFocusQuestions(false);
      setSelectedQuestionId(null);
      setPreviousSection(null); // Limpiar la sección anterior al cambiar de sección
    }
    if (sectionId === "myReview") {
      setMyReviewAutoOpenCreate(Boolean(params.autoOpenCreateReview));
      setMyReviewAutoFocusQuestions(Boolean(params.focusQuestions));
      setSelectedQuestionId(params.questionId || null);
    }
    if (
      sectionId === "usuario" ||
      sectionId === "profile" ||
      sectionId === "profileEdit"
    ) {
      setProfileAutoFocusWorkEmail(Boolean(params.autoFocusWorkEmail));
    }
    // Si es reviewDetail, guardar el reviewId
    if (sectionId === "reviewDetail" && params.reviewId) {
      setSelectedReviewId(params.reviewId);
      setSelectedQuestionId(params.questionId || null);
    }
    // Si es articleDetail, guardar el articleId
    if (sectionId === "articleDetail" && params.articleId) {
      setSelectedArticleId(params.articleId);
    }
    // Si es courseDetail, guardar el courseId
    if (sectionId === "courseDetail" && params.courseId) {
      setPreviousSection(params.fromSection || currentSection);
      setSelectedCourseId(params.courseId);
    }
    // Si es housingDetail, guardar el adId
    if (sectionId === "housingDetail" && params.adId) {
      setSelectedHousingAdId(params.adId);
    }
    // Si es createHousingAd, activar modo creación
    if (sectionId === "createHousingAd") {
      setCreatingHousingAd(true);
    }
    // Si es editHousingAd, activar modo edición
    if (sectionId === "editHousingAd" && params.adId) {
      setEditingHousingAdId(params.adId);
    }
    // Si es editRoommateProfile, activar pantalla de edición/creación de perfil roomie
    if (sectionId === "editRoommateProfile") {
      setEditingRoommateProfile(true);
    }
    // Si es createCourse, activar pantalla de crear curso
    if (sectionId === "createCourse") {
      setCreatingCourse(true);
    }
    // Si es editCourse, activar pantalla de editar curso
    if (sectionId === "editCourse" && params.courseId) {
      setEditingCourseId(params.courseId);
    }
    // Si es leisureForum, guardar el tipo de foro
    if (sectionId === "leisureForum" && params.forumType) {
      setLeisureForumType(params.forumType);
    }
    // Si volvemos a ocio o sportsSelection, limpiar el tipo de foro
    if (sectionId === "ocio" || sectionId === "sportsSelection") {
      setLeisureForumType(null);
    }
    // Si es threadDetail, guardar el threadId
    if (sectionId === "threadDetail" && params.threadId) {
      setPreviousSection(params.fromSection || currentSection);
      setSelectedThreadId(params.threadId);
    }
    // Si volvemos desde threadDetail, limpiar el threadId
    if (sectionId === "leisureForum") {
      setSelectedThreadId(null);
    }
    // Si es groupChat, guardar groupId y nombre
    if (sectionId === "groupChat" && params.groupId) {
      setSelectedGroupId(params.groupId);
      setSelectedGroupName(params.groupName || "Grupo");
    }
    // Permitir entrar por la sección de chats con un chat concreto preabierto
    if (sectionId === "grupos" && params.groupId) {
      setSelectedGroupId(params.groupId);
      setSelectedGroupName(params.groupName || "Grupo");
    }
    // Si volvemos a la lista de chats sin un chat concreto, limpiar selección
    if (sectionId === "grupos" && !params.groupId) {
      setSelectedGroupId(null);
      setSelectedGroupName(null);
    }
    if (sectionId === "roomies") {
      setRoommateInitialTab(params.initialTab || "discover");
      setSelectedRoommateMatchId(params.matchId || null);
    } else {
      setRoommateInitialTab("discover");
      setSelectedRoommateMatchId(null);
    }

    if (
      sectionId === "nota-mir" ||
      sectionId === "mirSimulator" ||
      sectionId === "orientador-mir"
    ) {
      setMirSimulatorInitialScore(params.initialScore ?? null);
    } else {
      setMirSimulatorInitialScore(null);
    }

    if (sectionId === "residentPayouts") {
      setResidentPayoutRouteParams({
        initialYear: params.initialYear || null,
        initialMonth: params.initialMonth || null,
        lockInitialPeriod: Boolean(params.lockInitialPeriod),
      });
    } else if (sectionId === "residentPayoutDetail") {
      setResidentPayoutRouteParams({
        initialYear: params.initialYear || null,
        initialMonth: params.initialMonth || null,
        lockInitialPeriod: false,
      });
    } else if (sectionId === "residentPayoutEntry") {
      setResidentPayoutRouteParams({
        initialYear: params.initialYear || null,
        initialMonth: params.initialMonth || null,
        lockInitialPeriod: Boolean(params.lockInitialPeriod),
      });
    } else {
      setResidentPayoutRouteParams({
        initialYear: null,
        initialMonth: null,
        lockInitialPeriod: false,
      });
    }

    if (
      residentGateEnabled &&
      userProfile?.id &&
      isQualifiedResidentSection(sectionId)
    ) {
      const { state, counted, hardLockedChanged } =
        await registerQualifiedResidentAction(userProfile.id, {
          sectionId,
          actionType: "section_visit",
        });

      setLocalResidentGateState(state);

      if (counted) {
        posthogLogger.capture("resident_review_gate_qualified_action", {
          action_type: "section_visit",
          current_section: sectionId,
          budget_count: state.qualifiedActionsCount,
          sessions_count: state.sessionsCount,
        });
      }

      if (state?.promptVisible && !residentGatePromptVisible) {
        posthogLogger.capture("resident_review_gate_prompt_shown", {
          budget_count: state.qualifiedActionsCount,
          sessions_count: state.sessionsCount,
        });
      }

      if (hardLockedChanged) {
        posthogLogger.capture("resident_review_gate_hard_locked", {
          budget_count: state.qualifiedActionsCount,
          sessions_count: state.sessionsCount,
        });
      }
    }
  };

  const handleBackFromGenericSection = () => {
    let nextSection = getDefaultSection();

    setSectionHistory((prev) => {
      if (!prev.length) {
        return prev;
      }

      const nextHistory = [...prev];
      nextSection = nextHistory.pop() || getDefaultSection();
      return nextHistory;
    });

    setCurrentSection(nextSection);
  };

  const renderSectionWithBackButton = (section) => (
    <View style={styles.sectionShell}>
      <BackNavigationButton onPress={handleBackFromGenericSection} />
      <View style={styles.sectionBody}>{section}</View>
    </View>
  );

  const handleHospitalSelect = (hospital, specialtyId, fromSection = null) => {
    setSelectedHospital(hospital);
    setShowHospitalInfoScreen(false);
    setSelectedSpecialtyId(specialtyId || null);
    // Guardar la sección de origen para poder volver a ella
    setPreviousSection(fromSection || currentSection);
    // No cambiar currentSection aquí, se maneja en HospitalsScreen
  };

  // Obtener la primera sección del footer según el tipo de usuario
  const getDefaultSection = () => {
    const footerConfig = getFooterConfig(userProfile);
    return footerConfig[0]?.screen || "inicio";
  };

  const handleBackFromDetail = () => {
    setShowHospitalInfoScreen(false);
    setSelectedHospital(null);
    setSelectedSpecialtyId(null);
    // Volver a la sección de origen si existe, sino a la sección por defecto
    setCurrentSection(previousSection || getDefaultSection());
    setPreviousSection(null); // Limpiar la sección anterior
  };

  const handleBackFromMirSimulator = () => {
    setCurrentSection(getDefaultSection());
  };

  const handleBackFromProfile = () => {
    setCurrentSection(getDefaultSection());
  };

  const handleBackFromThreadDetail = () => {
    setSelectedThreadId(null);
    setCurrentSection(previousSection || "leisureForum");
    setPreviousSection(null);
  };

  const handleBackFromGroupChat = () => {
    setSelectedGroupId(null);
    setSelectedGroupName(null);
    setCurrentSection("grupos");
  };

  const handleSignOut = async () => {
    try {
      if (userProfile?.id) {
        await AsyncStorage.removeItem(
          getDashboardNavigationStorageKey(userProfile.id)
        );
      }
      hydratedUserIdRef.current = null;
    } catch (error) {
      console.error("Error clearing dashboard navigation on sign out:", error);
    }

    await onSignOutProp();
  };

  // Si estamos en el chat de un grupo
  if (selectedGroupId) {
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection="grupos"
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
        hideFooter
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromGroupChat}>
          <GroupChatScreen
            groupId={selectedGroupId}
            groupName={selectedGroupName}
            userProfile={userProfile}
            onBack={handleBackFromGroupChat}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del thread
  if (selectedThreadId) {
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection="ocio"
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromThreadDetail}>
          <ThreadDetailScreen
            threadId={selectedThreadId}
            onBack={handleBackFromThreadDetail}
            userProfile={userProfile}
            onSectionChange={handleSectionChange}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del hospital
  if (selectedHospital) {
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromDetail}>
          {showHospitalInfoScreen ? (
            <HospitalInfoScreen
              hospital={selectedHospital}
              onBack={() => setShowHospitalInfoScreen(false)}
            />
          ) : (
            <HospitalDetailScreen
              hospital={selectedHospital}
              selectedSpecialtyId={selectedSpecialtyId}
              onBack={handleBackFromDetail}
              onOpenHospitalInfo={() => setShowHospitalInfoScreen(true)}
            />
          )}
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle de reseña
  if (selectedReviewId) {
    const handleBackFromReview = () => {
      setSelectedReviewId(null);
      setCurrentSection("reseñas");
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromReview}>
          <ReviewDetailScreen
            reviewId={selectedReviewId}
            onBack={handleBackFromReview}
            userProfile={userProfile}
            highlightedQuestionId={selectedQuestionId}
            onHighlightedQuestionHandled={() => setSelectedQuestionId(null)}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del artículo
  if (selectedArticleId) {
    const handleBackFromArticle = () => {
      setSelectedArticleId(null);
      setCurrentSection("articulos");
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromArticle}>
          <ArticleDetailScreen
            articleId={selectedArticleId}
            onBack={handleBackFromArticle}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de crear curso
  if (creatingCourse) {
    const handleBackFromCreateCourse = () => {
      setCreatingCourse(false);
      setCurrentSection("cursos");
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromCreateCourse}>
          <CreateCourseScreen
            onBack={handleBackFromCreateCourse}
            onSuccess={() => {
              setCreatingCourse(false);
              setCurrentSection("cursos");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de editar curso
  if (editingCourseId) {
    const handleBackFromEditCourse = () => {
      setEditingCourseId(null);
      setCurrentSection("cursos");
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromEditCourse}>
          <CreateCourseScreen
            courseId={editingCourseId}
            onBack={handleBackFromEditCourse}
            onSuccess={() => {
              setEditingCourseId(null);
              setCurrentSection("cursos");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  if (reviewComposerMode) {
    const handleBackFromReviewComposer = () => {
      setReviewComposerMode(null);
      setCurrentSection("myReview");
    };

    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromReviewComposer}>
          <ReviewComposerScreen
            userProfile={userProfile}
            mode={reviewComposerMode}
            onBack={handleBackFromReviewComposer}
            onSuccess={(result) => {
              setReviewComposerMode(null);
              setCurrentSection("myReview");
              if (result === "created") {
                onReviewCreated?.();
              }
            }}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del curso
  if (selectedCourseId) {
    const handleBackFromCourse = () => {
      setSelectedCourseId(null);
      setCurrentSection(previousSection || "cursos");
      setPreviousSection(null);
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromCourse}>
          <CourseDetailScreen
            courseId={selectedCourseId}
            onBack={handleBackFromCourse}
            onEdit={(courseId) => {
              setSelectedCourseId(null);
              setEditingCourseId(courseId);
              setCurrentSection("cursos");
            }}
            onDelete={() => {
              setSelectedCourseId(null);
              setCurrentSection("cursos");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del anuncio de vivienda
  if (selectedHousingAdId) {
    const handleBackFromHousing = () => {
      setSelectedHousingAdId(null);
      setCurrentSection("vivienda");
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromHousing}>
          <HousingAdDetailScreen
            adId={selectedHousingAdId}
            onBack={handleBackFromHousing}
            userProfile={userProfile}
            onSectionChange={handleSectionChange}
            onEdit={(adId) => {
              // Por ahora solo volvemos, luego se puede implementar edición
              console.log("Edit housing ad:", adId);
              setSelectedHousingAdId(null);
              setCurrentSection("vivienda");
            }}
            onDelete={(adId) => {
              // El delete se maneja dentro del componente
              setSelectedHousingAdId(null);
              setCurrentSection("vivienda");
            }}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de crear anuncio de vivienda
  if (creatingHousingAd) {
    const handleBackFromCreateHousing = () => {
      setCreatingHousingAd(false);
      setCurrentSection("vivienda");
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromCreateHousing}>
          <CreateHousingAdScreen
            onBack={handleBackFromCreateHousing}
            onSuccess={() => {
              // Anuncio creado exitosamente
              setCreatingHousingAd(false);
              setCurrentSection("vivienda");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  if (editingRoommateProfile) {
    const handleBackFromEditRoommate = () => {
      setEditingRoommateProfile(false);
      setCurrentSection("roomies");
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromEditRoommate}>
          <CreateRoommateProfileScreen
            onBack={handleBackFromEditRoommate}
            onSuccess={() => {
              setEditingRoommateProfile(false);
              setCurrentSection("roomies");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de editar anuncio de vivienda
  if (editingHousingAdId) {
    const handleBackFromEditHousing = () => {
      setEditingHousingAdId(null);
      setCurrentSection("vivienda");
    };
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromEditHousing}>
          <CreateHousingAdScreen
            adId={editingHousingAdId}
            onBack={handleBackFromEditHousing}
            onSuccess={() => {
              // Anuncio editado exitosamente
              setEditingHousingAdId(null);
              setCurrentSection("vivienda");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Renderizar según la sección activa
  const renderSection = () => {
    switch (currentSection) {
      case "inicio":
        return (
          <HomeDashboardScreen
            userProfile={userProfile}
            residentHasReview={residentHasReview}
            residentReviewGateStatus={residentGateStatus}
            residentReviewGateBypassed={residentReviewGateBypassed}
            residentReviewGateBudget={residentGateBudget}
            onHospitalSelect={handleHospitalSelect}
            onSectionChange={handleSectionChange}
          />
        );

      case "hospitals":
      case "hospitales":
        return (
          <HospitalsScreen
            onHospitalSelect={handleHospitalSelect}
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
          />
        );

      case "mirSimulator":
      case "nota-mir":
        return (
          <MirSimulatorScreen
            onBack={handleBackFromMirSimulator}
            userProfile={userProfile}
            initialScore={mirSimulatorInitialScore}
          />
        );

      case "orientador-mir":
        return (
          <MirOrientationScreen
            onBack={handleBackFromMirSimulator}
            userProfile={userProfile}
            initialScore={mirSimulatorInitialScore}
          />
        );

      case "nota-proyectada":
        return (
          <MirProjectedScoreScreen
            onBack={handleBackFromMirSimulator}
            userProfile={userProfile}
            onOpenSimulator={(order) =>
              handleSectionChange("nota-mir", { initialScore: order })
            }
            onOpenOrientation={(order) =>
              handleSectionChange("orientador-mir", { initialScore: order })
            }
            onOpenProfile={() => handleSectionChange("profile")}
          />
        );

      case "specialityQuiz":
        return (
          <SpecialityQuizScreen
            userProfile={userProfile}
            onBack={handleBackFromGenericSection}
            onSectionChange={handleSectionChange}
          />
        );

      case "profile":
      case "usuario":
        return (
          <ProfileScreen
            userProfile={userProfile}
            onBack={handleBackFromProfile}
            onSignOut={handleSignOut}
            onProfileUpdated={loadUserProfile}
            onSectionChange={handleSectionChange}
          />
        );

      case "profileEdit":
        return (
          <ProfileEditScreen
            onBack={() => handleSectionChange("usuario")}
            onProfileUpdated={loadUserProfile}
            autoFocusWorkEmail={profileAutoFocusWorkEmail}
            onAutoFocusWorkEmailHandled={() =>
              setProfileAutoFocusWorkEmail(false)
            }
          />
        );

      case "myConnections":
        return (
          <MyConnectionsScreen
            onBack={() => handleSectionChange("usuario")}
            onSectionChange={handleSectionChange}
          />
        );

      case "notificationSettings":
        return (
          <NotificationSettingsScreen
            userId={userProfile?.id}
            onBack={() => handleSectionChange("usuario")}
          />
        );

      case "notifications":
        return (
          <NotificationsScreen
            userId={userProfile?.id}
            onBack={handleBackFromGenericSection}
            onNavigateToEntity={(screenId, entityId) => {
              if (screenId === "reviewDetail") {
                handleSectionChange("reviewDetail", entityId);
              } else if (screenId === "myReview") {
                handleSectionChange("myReview", entityId);
              } else if (screenId === "threadDetail") {
                handleSectionChange("threadDetail", { threadId: entityId });
              } else if (screenId === "roomies") {
                handleSectionChange("roomies", {
                  initialTab: "matches",
                  matchId: entityId,
                });
              } else if (screenId === "groupChat") {
                handleSectionChange("groupChat", {
                  groupId: entityId.groupId,
                  groupName: entityId.groupName,
                });
              } else if (screenId === "courseDetail") {
                handleSectionChange("courseDetail", { courseId: entityId });
              } else if (screenId === "directChat" && entityId?.otherUserId) {
                openDirectChat({
                  otherUserId: entityId.otherUserId,
                  otherUserName: "",
                  onSectionChange: handleSectionChange,
                });
              }
            }}
          />
        );

      case "clinicalAssistant":
        return (
          <ClinicalAssistantScreen
            userProfile={userProfile}
            onBack={handleBackFromGenericSection}
          />
        );

      // Nuevas pantallas placeholder
      case "menu":
        return (
          <MenuScreen
            onSectionChange={handleSectionChange}
            onBack={handleBackFromGenericSection}
            currentSection={currentSection}
            userProfile={userProfile}
            residentHasReview={residentHasReview}
            residentReviewGateStatus={residentGateStatus}
            residentReviewGateBypassed={residentReviewGateBypassed}
          />
        );

      case "myPreferences":
        return (
          <MyPreferencesScreen
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
            onHospitalSelect={handleHospitalSelect}
            onBack={handleBackFromGenericSection}
          />
        );

      case "comunity":
        return (
          <ComunityScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            residentReviewGateStatus={residentGateStatus}
          />
        );

      case "residentsDirectory":
        return (
          <ResidentsDirectoryScreen
            currentUserId={userProfile?.id}
            currentUserProfile={userProfile}
            onSectionChange={handleSectionChange}
            onBack={handleBackFromGenericSection}
          />
        );

      case "myReview":
        return (
          <MyReviewScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            onReviewCreated={onReviewCreated}
            onReviewDeleted={onReviewDeleted}
            autoOpenCreateReview={myReviewAutoOpenCreate}
            autoFocusQuestions={myReviewAutoFocusQuestions}
            highlightedQuestionId={selectedQuestionId}
            onAutoOpenCreateReviewHandled={() => setMyReviewAutoOpenCreate(false)}
            onAutoFocusQuestionsHandled={() => setMyReviewAutoFocusQuestions(false)}
            onHighlightedQuestionHandled={() => setSelectedQuestionId(null)}
            onCreateReview={() => setReviewComposerMode("create")}
            onEditReview={() => setReviewComposerMode("edit")}
            onBack={handleBackFromGenericSection}
          />
        );

      case "residenceLibrary":
      case "libro-residente":
        return (
          <ResidenceLibraryScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            onBack={handleBackFromGenericSection}
            residentHasReview={residentHasReview}
            residentReviewGateStatus={residentGateStatus}
          />
        );

      // Pantalla de artículos
      case "articulos":
        return (
          <ArticlesScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
            onBack={handleBackFromGenericSection}
          />
        );

      // Pantalla de vivienda
      case "vivienda":
        return (
          <HousingScreen
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
            onBack={handleBackFromGenericSection}
          />
        );

      case "roomies":
        return (
          <RoommateScreen
            userProfile={userProfile}
            onBack={handleBackFromGenericSection}
            onSectionChange={handleSectionChange}
            initialTab={roommateInitialTab}
            initialMatchId={selectedRoommateMatchId}
          />
        );

      // Pantalla de ocio
      case "ocio":
        return (
          <LeisureScreen
            onSectionChange={handleSectionChange}
            onBack={handleBackFromGenericSection}
            userProfile={userProfile}
          />
        );

      // Pantalla de selección de deportes
      case "sportsSelection":
        return (
          <SportsSelectionScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
          />
        );

      // Pantalla del foro de ocio (Fiesta o Deporte)
      case "leisureForum":
        return (
          <LeisureForumScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
            forumType={leisureForumType}
          />
        );

      // Pantalla de contacto
      case "contacto":
        return (
          <ContactScreen
            userProfile={userProfile}
            onBack={() => handleSectionChange("usuario")}
          />
        );

      // Pantalla de agenda
      case "agenda":
      case "guardias":
        return (
          <AgendaScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            onNavigateToSection={handleSectionChange}
          />
        );

      // Secciones del menú (placeholder)
      case "rotaciones-externas":
        return (
          <ExternalRotationsScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            onBack={handleBackFromGenericSection}
          />
        );

      case "cursos":
        return (
          <LecturesScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            onBack={handleBackFromGenericSection}
          />
        );

      case "residentPayouts":
        return (
          <ResidentPayoutsScreen
            userProfile={userProfile}
            onBack={handleBackFromGenericSection}
            onOpenDetail={(params = {}) =>
              handleSectionChange("residentPayoutDetail", {
                initialYear: params.initialYear || new Date().getFullYear(),
                initialMonth: params.initialMonth || new Date().getMonth() + 1,
              })
            }
            onCreateEntry={(params = {}) =>
              handleSectionChange("residentPayoutEntry", {
                initialYear: params.initialYear || new Date().getFullYear(),
                initialMonth: params.initialMonth || new Date().getMonth() + 1,
                lockInitialPeriod: Boolean(params.lockInitialPeriod),
              })
            }
          />
        );

      case "residentPayoutDetail":
        return (
          <SwipeBackWrapper onSwipeBack={handleBackFromGenericSection}>
            <ResidentPayoutDetailScreen
              userProfile={userProfile}
              onBack={handleBackFromGenericSection}
              onEdit={(params = {}) =>
                handleSectionChange("residentPayoutEntry", {
                  initialYear: params.initialYear || residentPayoutRouteParams.initialYear,
                  initialMonth:
                    params.initialMonth || residentPayoutRouteParams.initialMonth,
                  lockInitialPeriod: Boolean(params.lockInitialPeriod),
                })
              }
              initialYear={residentPayoutRouteParams.initialYear}
              initialMonth={residentPayoutRouteParams.initialMonth}
            />
          </SwipeBackWrapper>
        );

      case "residentPayoutEntry":
        return (
          <SwipeBackWrapper onSwipeBack={handleBackFromGenericSection}>
            <ResidentPayoutEntryScreen
              userProfile={userProfile}
              onBack={handleBackFromGenericSection}
              initialYear={residentPayoutRouteParams.initialYear}
              initialMonth={residentPayoutRouteParams.initialMonth}
              lockInitialPeriod={residentPayoutRouteParams.lockInitialPeriod}
            />
          </SwipeBackWrapper>
        );

      case "mentalHealth":
        return (
          <MentalHealthScreen
            userProfile={userProfile}
            onBack={handleBackFromGenericSection}
          />
        );

      case "grupos":
        return (
          <GroupsScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
          />
        );

      case "foro":
      case "jobs":
      case "faq-reseñas":
        return <PlaceholderScreen title={currentSection} />;

      // Pantalla de reseñas
      case "reseñas":
        return (
          <ReviewsScreen
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
          />
        );

      default:
        // Fallback: mostrar placeholder genérico
        return <PlaceholderScreen title={currentSection} />;
    }
  };

  if (loadingProfile || !isNavigationReady) {
    return (
      <ScreenLayout
        {...screenLayoutProps}
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      {...screenLayoutProps}
      userProfile={userProfile}
      activeSection={currentSection === "roomies" ? "vivienda" : currentSection}
      isProfileIncomplete={isProfileIncomplete}
      onSectionChange={handleSectionChange}
    >
      {renderSection()}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionShell: {
    flex: 1,
  },
  sectionBody: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
});
