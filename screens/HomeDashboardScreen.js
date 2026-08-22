import React, { useState, useMemo, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  useWindowDimensions,
  Alert,
  Linking,
} from "react-native";
import { Icon } from "../components/Icon";
import ResidentPendingList from "../components/home/ResidentPendingList";
import ResidentWeekStrip from "../components/home/ResidentWeekStrip";
import ResidentYearSummary from "../components/home/ResidentYearSummary";
import { useResidentHomeSummary } from "../hooks/useResidentHomeSummary";
import { QuickActionsMenu } from "../components/QuickActionsMenu";
import {
  Book,
  Money,
  Users,
  Heart,
  House,
  AirplaneTilt,
  Brain,
  GraduationCap,
  Star,
  Stethoscope,
  ChalkboardTeacher,
  NotePencil,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHospitals } from "../hooks/useHospitals";
import { useAgendaEvents } from "../hooks/useAgendaEvents";
import { useEmailReviewStatus } from "../hooks/useEmailReviewStatus";
import { agendaEventTypeLabels } from "../services/agendaService";
import { getHospitalRatings } from "../services/reviewsService";
import { getMirSimulatorStats } from "../services/mirSimulatorService";
import {
  getResidentTeachingModules,
  teachingModuleBadge,
} from "../services/docenciaService";
import { getLastQuizSessionForUser } from "../services/specialityQuizService";
import {
  getDashboardAdvertisements,
  getDashboardAudience,
  isAdvertisementActionable,
  openAdvertisement,
} from "../services/dashboardAdvertisementService";
import {
  formatPayoutPeriodLabel,
  getCurrentPayoutReminderTargetDate,
  getResidentPayoutForMonth,
  shouldShowPayoutReminder,
} from "../services/residentPayoutService";
import { getAgendaEvents } from "../services/agendaService";
import { countMonthShiftsByCategory } from "../services/shiftPayrollService";
import posthogLogger from "../services/posthogService";
import {
  LANDLORD_PORTAL_URL,
  LANDLORD_PORTAL_LABEL,
} from "../constants/housing";
import {
  formatResidentTransitionDeadline,
  hasResidentFeatureAccess,
  isResidentLockedMissingCorporateEmail,
  isSeasonalResidentPending,
  shouldBypassResidentReviewGate,
} from "../utils/residentAccess";
import { getResidentTransitionConfig } from "../services/residentTransitionConfigService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const AGENDA_HERO_CACHE_KEY_PREFIX = "@losresis:dashboardAgendaHero:";
const QUIZ_SPECIALITY_MAP = {
  1: [
    "Medicina Interna",
    "Neurología",
    "Reumatología",
    "Nefrología",
    "Neumología",
    "Enfermedades Infecciosas",
  ],
  2: [
    "Cirugía General",
    "Traumatología",
    "Neurocirugía",
    "Cirugía Cardiovascular",
    "Urología",
    "Cardiología Intervencionista",
  ],
  3: [
    "Medicina de Familia",
    "Pediatría",
    "Geriatría",
    "Psiquiatría",
    "Cuidados Paliativos",
    "Oncología Médica",
  ],
  4: [
    "Medicina Preventiva",
    "Salud Pública",
    "Farmacología Clínica",
    "Genética",
    "Medicina Nuclear",
  ],
};

function getTopQuizSpeciality(session) {
  const persistedTop = Array.isArray(session?.top_results)
    ? session.top_results.find((item) => item?.speciality_name || item?.name)
    : null;
  if (persistedTop) {
    return persistedTop.speciality_name || persistedTop.name || null;
  }

  const weightedScores = session?.raw_scores?.weighted_scores;
  if (!weightedScores) return null;

  const rankedProfiles = Object.entries(weightedScores)
    .map(([key, score]) => ({
      key: Number(key),
      score: Number(score) || 0,
    }))
    .sort((a, b) => b.score - a.score);

  const topProfile = rankedProfiles[0];
  if (!topProfile) return null;

  const topSpecialities = QUIZ_SPECIALITY_MAP[topProfile.key] || [];
  return topSpecialities[0] || null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "BUENOS DÍAS";
  if (h < 20) return "BUENAS TARDES";
  return "BUENAS NOCHES";
}

function getGreetingSentence() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function eventIncludesDate(event, targetDate) {
  if (!event?.event_date || !targetDate) return false;

  const start = new Date(`${event.event_date}T00:00:00`);
  const end = new Date(`${(event.end_date || event.event_date)}T23:59:59`);
  return targetDate >= start && targetDate <= end;
}

function formatAgendaHeaderDate(value) {
  if (!value) return "Sin fecha";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function formatAgendaHeaderTime(event) {
  if (!event?.start_time && !event?.end_time) {
    return event?.all_day === false ? "Hora por concretar" : "Todo el día";
  }

  // En un evento de varios días el horario es un tramo continuo (ADR 0011): la
  // hora de fin es del último día, no de este. Aquí solo se pinta event_date,
  // así que enseñar "09:00 - 18:00" diría que acaba hoy a las 18:00.
  const spansDays = Boolean(
    event?.end_date && event?.event_date && event.end_date !== event.event_date
  );

  if (event?.start_time && event?.end_time && !spansDays) {
    return `${event.start_time.slice(0, 5)} - ${event.end_time.slice(0, 5)}`;
  }

  if (event?.start_time) {
    return event.start_time.slice(0, 5);
  }

  return event.end_time.slice(0, 5);
}

function getAgendaHeroConfig(eventType) {
  switch (eventType) {
    case "shift":
      return { icon: "medkit-outline", buttonText: "Ver calendario" };
    case "course":
      return { icon: "school-outline", buttonText: "Ver agenda" };
    case "conference":
      return { icon: "mic-outline", buttonText: "Ver agenda" };
    case "study":
      return { icon: "book-outline", buttonText: "Ver agenda" };
    case "research":
      return { icon: "flask-outline", buttonText: "Ver agenda" };
    case "day_off":
      return { icon: "cafe-outline", buttonText: "Ver agenda" };
    case "reminder":
      return { icon: "notifications-outline", buttonText: "Ver agenda" };
    default:
      return { icon: "calendar-outline", buttonText: "Abrir agenda" };
  }
}

const getAgendaHeroCacheKey = (userId) =>
  `${AGENDA_HERO_CACHE_KEY_PREFIX}${userId}`;

export default function HomeDashboardScreen({
  userProfile,
  residentHasReview = true,
  residentReviewGateStatus = "soft",
  residentReviewGateBudget = null,
  onHospitalSelect,
  onSectionChange,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hospitalRatings, setHospitalRatings] = useState({});
  const [mirStats, setMirStats] = useState({ count: 0, lastGrade: null });
  const [lastQuizTopSpeciality, setLastQuizTopSpeciality] = useState(null);
  const [dashboardAds, setDashboardAds] = useState([]);
  const [loadingDashboardAds, setLoadingDashboardAds] = useState(false);
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [payoutReminderTarget, setPayoutReminderTarget] = useState(null);
  const [showPayoutReminder, setShowPayoutReminder] = useState(false);
  const [payoutReminderShiftTotal, setPayoutReminderShiftTotal] = useState(0);
  const [cachedAgendaHeroSnapshot, setCachedAgendaHeroSnapshot] = useState(null);
  const [residentTransitionConfig, setResidentTransitionConfig] = useState(null);
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

  const {
    hospitals,
    specialties,
    filteredHospitals,
    loadingHospitals,
  } = useHospitals();
  const { events: agendaEvents, loading: loadingAgendaEvents } = useAgendaEvents(
    userProfile?.id
  );
  useEffect(() => {
    getHospitalRatings().then(({ success, ratings }) => {
      if (success) setHospitalRatings(ratings);
    });
  }, []);

  useEffect(() => {
    if (!userProfile?.id || !userProfile?.is_student) return;
    getMirSimulatorStats(userProfile.id).then((res) => {
      if (res.success) setMirStats({ count: res.count, lastGrade: res.lastGrade });
    });
    getLastQuizSessionForUser(userProfile.id).then(({ success, data }) => {
      if (success) {
        setLastQuizTopSpeciality(getTopQuizSpeciality(data));
      }
    });
  }, [userProfile?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardAds = async () => {
      setLoadingDashboardAds(true);

      const { success, ads } = await getDashboardAdvertisements(userProfile);
      if (!isMounted) return;

      setDashboardAds(success ? ads : []);
      setActiveAdIndex(0);
      setLoadingDashboardAds(false);
    };

    loadDashboardAds();

    return () => {
      isMounted = false;
    };
  }, [
    userProfile?.id,
    userProfile?.is_student,
    userProfile?.is_resident,
    userProfile?.is_doctor,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadPayoutReminder = async () => {
      if (!userProfile?.id || !hasResidentFeatureAccess(userProfile)) {
        if (isMounted) {
          setPayoutReminderTarget(null);
          setShowPayoutReminder(false);
        }
        return;
      }

      const targetDate = getCurrentPayoutReminderTargetDate();
      if (!targetDate) {
        if (isMounted) {
          setPayoutReminderTarget(null);
          setShowPayoutReminder(false);
        }
        return;
      }

      try {
        const existingRecord = await getResidentPayoutForMonth(
          userProfile.id,
          targetDate.year,
          targetDate.month
        );

        if (!isMounted) return;

        const show = shouldShowPayoutReminder({
          userProfile,
          existingRecord,
        });

        // Guardias del mes según la agenda, para personalizar el banner.
        // Si falla, el banner cae al copy genérico.
        let shiftTotal = 0;
        if (show) {
          try {
            const agendaEvents = await getAgendaEvents(userProfile.id);
            shiftTotal = countMonthShiftsByCategory(
              agendaEvents,
              targetDate.year,
              targetDate.month
            ).total;
          } catch (agendaError) {
            console.error(
              "Error loading agenda shifts for payout reminder:",
              agendaError
            );
          }
        }

        if (!isMounted) return;

        setPayoutReminderTarget(targetDate);
        setPayoutReminderShiftTotal(shiftTotal);
        setShowPayoutReminder(show);
      } catch (error) {
        console.error("Error loading payout reminder:", error);
        if (isMounted) {
          setPayoutReminderTarget(targetDate);
          setShowPayoutReminder(false);
        }
      }
    };

    loadPayoutReminder();

    return () => {
      isMounted = false;
    };
  }, [userProfile]);

  const displayName = useMemo(() => {
    const name = userProfile?.name || "";
    const surname = userProfile?.surname || "";
    return [name, surname].filter(Boolean).join(" ").trim() || "Usuario";
  }, [userProfile]);

  const firstName = useMemo(() => {
    const sourceName = (userProfile?.name || displayName).trim();
    return sourceName.split(/\s+/)[0] || "Usuario";
  }, [displayName, userProfile?.name]);
  const { request: emailReviewRequest } = useEmailReviewStatus(userProfile?.id);
  // Los caseros ya no publican gratis desde la app: su alta va por el portal
  // de propietarios, donde pagan la publicación.
  const openLandlordPortal = useCallback(() => {
    posthogLogger.capture("housing_landlord_portal_opened", {
      from: "host_home",
    });
    Linking.openURL(LANDLORD_PORTAL_URL).catch(() => {
      Alert.alert(
        "No se pudo abrir el portal",
        `Entra en ${LANDLORD_PORTAL_LABEL} desde tu navegador para publicar tu vivienda.`
      );
    });
  }, []);
  const isEmailReviewPending = emailReviewRequest?.status === "PENDING";
  const isEmailReviewRejected = emailReviewRequest?.status === "REJECTED";
  const residentInSeasonalGrace = isSeasonalResidentPending(userProfile);
  const residentEmailLocked = isResidentLockedMissingCorporateEmail(userProfile);
  const seasonalDaysRemaining = useMemo(() => {
    if (!residentInSeasonalGrace) return null;
    const expiresAtRaw = userProfile?.resident_transition_expires_at;
    if (!expiresAtRaw) return null;
    const expiresAt = new Date(expiresAtRaw);
    if (Number.isNaN(expiresAt.getTime())) return null;
    // Diferencia en días naturales (no horas), para que coincida con el día
    // en que se envía el push del recordatorio (cron a 3 días vista).
    const expiresDayMs = new Date(
      expiresAt.getFullYear(),
      expiresAt.getMonth(),
      expiresAt.getDate()
    ).getTime();
    const now = new Date();
    const todayDayMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const diffDays = Math.round((expiresDayMs - todayDayMs) / 86400000);
    return diffDays < 0 ? 0 : diffDays;
  }, [residentInSeasonalGrace, userProfile?.resident_transition_expires_at]);
  const showSeasonalGraceCountdown =
    residentInSeasonalGrace &&
    seasonalDaysRemaining !== null &&
    seasonalDaysRemaining <= 3;
  const residentNeedsReview =
    userProfile?.is_resident &&
    !residentHasReview &&
    !shouldBypassResidentReviewGate(userProfile, residentTransitionConfig) &&
    !isEmailReviewPending &&
    !isEmailReviewRejected;
  // Qué módulos de Docencia tiene activos este residente. "Activo" se deriva del
  // dato: el acceso aparece cuando TIENE al menos una tutoría, evaluación o
  // autoevaluación. No hay interruptor en el panel que consultar, y derivarlo así
  // evita además llevarle a una pantalla vacía.
  const [teachingModules, setTeachingModules] = useState({
    tutoring: { count: 0, pending: 0, nextAt: null },
    evaluations: { count: 0 },
    selfAssessments: { count: 0, pending: 0 },
  });

  useEffect(() => {
    let isMounted = true;

    if (!userProfile?.id || !userProfile?.is_resident) {
      setTeachingModules({
        tutoring: { count: 0, pending: 0, nextAt: null },
        evaluations: { count: 0 },
        selfAssessments: { count: 0, pending: 0 },
      });
      return () => {
        isMounted = false;
      };
    }

    getResidentTeachingModules(userProfile.id).then((modules) => {
      if (isMounted) setTeachingModules(modules);
    });

    return () => {
      isMounted = false;
    };
  }, [userProfile?.id, userProfile?.is_resident]);

  // El cuerpo del inicio del residente: lo que tiene pendiente y los tres
  // números de su año. Reaprovecha `teachingModules` (ya cargado para los badges)
  // y los eventos de agenda en lugar de volver a pedirlos.
  const {
    pending: residentPending,
    year: residentYearSummary,
    loading: loadingResidentSummary,
  } = useResidentHomeSummary({
    userProfile,
    agendaEvents,
    teachingModules,
    payoutBannerVisible: showPayoutReminder,
  });

  const handlePendingPress = useCallback(
    (item) => {
      posthogLogger.capture("resident_home_pending_clicked", {
        item: item.key,
      });
      onSectionChange?.(item.section, item.params);
    },
    [onSectionChange]
  );

  const residentQuickActions = useMemo(
    () =>
      [
        {
          label: "Libro de residentes",
          icon: Book,
          section: "residenceLibrary",
          tint: "#D1FAE5",
          color: "#059669",
        },
        {
          label: "Comunidad",
          icon: Users,
          section: "residentsDirectory",
          tint: "#DBEAFE",
          color: "#2563EB",
        },
        {
          label: "Nóminas",
          icon: Money,
          section: "residentPayouts",
          tint: "#FFEDD5",
          color: "#F97316",
        },
        {
          label: "RoomiesMIR",
          icon: Heart,
          section: "roomies",
          tint: "#FEF9C3",
          color: "#CA8A04",
        },
        {
          label: "Cursos y congresos",
          icon: GraduationCap,
          section: "cursos",
          tint: "#DBEAFE",
          color: "#2563EB",
        },
        {
          label: "Rotaciones externas",
          icon: AirplaneTilt,
          section: "rotaciones-externas",
          tint: "#EDE9FE",
          color: "#6D28D9",
        },
        {
          label: "Viviendas",
          icon: House,
          section: "vivienda",
          tint: "#E5E7EB",
          color: "#475569",
        },
        {
          label: "Salud mental",
          icon: Brain,
          section: "mentalHealth",
          tint: "#D1FAE5",
          color: "#059669",
        },
        {
          label: "Mi reseña",
          icon: Star,
          section: "myReview",
          tint: "#FFEDD5",
          color: "#F97316",
        },
        {
          label: "Chat clínico",
          icon: Stethoscope,
          section: "clinicalAssistant",
          tint: "#DCFCE7",
          color: "#15803D",
          badge: "NUEVO",
        },
        {
          label: "Tutorías",
          icon: ChalkboardTeacher,
          section: "tutorias",
          tint: "#EDE9FE",
          color: "#6D28D9",
          requiresModule: "tutoring",
          badge: teachingModuleBadge("tutoring", teachingModules.tutoring),
        },
        {
          label: "Autoevaluación",
          icon: NotePencil,
          section: "autoevaluacion",
          tint: "#FEF3C7",
          color: "#B45309",
          requiresModule: "selfAssessments",
          badge: teachingModuleBadge(
            "selfAssessments",
            teachingModules.selfAssessments
          ),
        },
      ].filter(
        (action) =>
          action.section !== "clinicalAssistant" ||
          userProfile?.can_use_clinical_assistant
      ).filter(
        // Sin filas no hay acceso: un icono que abre una pantalla vacía es peor que
        // no tener el icono.
        (action) =>
          !action.requiresModule ||
          (teachingModules[action.requiresModule]?.count || 0) > 0
      ),
    [userProfile?.can_use_clinical_assistant, teachingModules]
  );
  const residentHeroEvent = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const datedEvents = agendaEvents.filter((event) => event.event_date);
    const eventToday = datedEvents.find((event) => eventIncludesDate(event, today));

    if (eventToday) {
      return {
        state: "today",
        event: eventToday,
      };
    }

    const nextEvent = datedEvents.find((event) => {
      const start = new Date(`${event.event_date}T00:00:00`);
      return start > today;
    });

    if (nextEvent) {
      return {
        state: "upcoming",
        event: nextEvent,
      };
    }

    return {
      state: "empty",
      event: null,
    };
  }, [agendaEvents]);
  const agendaHeroSnapshot = useMemo(() => {
    return {
      state: residentHeroEvent.state,
      event: residentHeroEvent.event || null,
    };
  }, [residentHeroEvent.event, residentHeroEvent.state]);
  const effectiveAgendaHeroSnapshot =
    loadingAgendaEvents && cachedAgendaHeroSnapshot
      ? cachedAgendaHeroSnapshot
      : agendaHeroSnapshot;
  const residentHeroConfig = getAgendaHeroConfig(
    effectiveAgendaHeroSnapshot.event?.event_type
  );
  const residentHeroEyebrowText = effectiveAgendaHeroSnapshot.state === "today"
    ? "HOY"
    : effectiveAgendaHeroSnapshot.state === "upcoming"
        ? "PRÓXIMO EVENTO"
        : "AGENDA";
  const residentHeroStatusText = effectiveAgendaHeroSnapshot.state === "today"
      ? "EN CURSO"
      : effectiveAgendaHeroSnapshot.state === "upcoming"
        ? "PRÓXIMO"
        : "SIN EVENTOS";
  const showResidentHeroTopRow = effectiveAgendaHeroSnapshot.state !== "empty";
  const residentHeroTitle =
    effectiveAgendaHeroSnapshot.event?.title ||
      agendaEventTypeLabels[effectiveAgendaHeroSnapshot.event?.event_type] ||
      "Agenda vacía";
  const residentHeroSubtitle = effectiveAgendaHeroSnapshot.state === "today"
      ? `${formatAgendaHeaderDate(effectiveAgendaHeroSnapshot.event?.event_date)} · ${formatAgendaHeaderTime(
          effectiveAgendaHeroSnapshot.event
        )}`
      : effectiveAgendaHeroSnapshot.state === "upcoming"
        ? `${formatAgendaHeaderDate(
            effectiveAgendaHeroSnapshot.event?.event_date
          )} · ${formatAgendaHeaderTime(effectiveAgendaHeroSnapshot.event)}`
        : "Añade una guardia, curso o recordatorio.";
  const residentHeroFooter = effectiveAgendaHeroSnapshot.state === "today"
      ? `${agendaEventTypeLabels[effectiveAgendaHeroSnapshot.event?.event_type] || "Evento"} en tu agenda de hoy`
      : effectiveAgendaHeroSnapshot.state === "upcoming"
        ? `Tu siguiente ${
            agendaEventTypeLabels[effectiveAgendaHeroSnapshot.event?.event_type]?.toLowerCase() || "evento"
          } ya está programado`
        : "";
  useEffect(() => {
    let isMounted = true;

    const loadCachedAgendaHeroSnapshot = async () => {
      if (!userProfile?.id) {
        if (isMounted) {
          setCachedAgendaHeroSnapshot(null);
        }
        return;
      }

      try {
        const cachedValue = await AsyncStorage.getItem(
          getAgendaHeroCacheKey(userProfile.id)
        );

        if (!isMounted) return;

        setCachedAgendaHeroSnapshot(cachedValue ? JSON.parse(cachedValue) : null);
      } catch (error) {
        if (isMounted) {
          setCachedAgendaHeroSnapshot(null);
        }
      }
    };

    loadCachedAgendaHeroSnapshot();

    return () => {
      isMounted = false;
    };
  }, [userProfile?.id]);

  useEffect(() => {
    if (!userProfile?.id || loadingAgendaEvents) {
      return;
    }

    const snapshotToCache = {
      state: residentHeroEvent.state,
      event: residentHeroEvent.event || null,
    };

    setCachedAgendaHeroSnapshot(snapshotToCache);
    AsyncStorage.setItem(
      getAgendaHeroCacheKey(userProfile.id),
      JSON.stringify(snapshotToCache)
    ).catch(() => {});
  }, [
    loadingAgendaEvents,
    residentHeroEvent.event,
    residentHeroEvent.state,
    userProfile?.id,
  ]);

  const bestMatchHospitals = useMemo(
    () =>
      [...filteredHospitals]
        .sort((a, b) => {
          const rA = hospitalRatings[a.id]?.avgRating ?? 0;
          const rB = hospitalRatings[b.id]?.avgRating ?? 0;
          return rB - rA;
        })
        .slice(0, 3),
    [filteredHospitals, hospitalRatings]
  );
  const alsoInterestedHospitals = useMemo(
    () => filteredHospitals.slice(3, 7),
    [filteredHospitals]
  );
  const carouselCardWidth = Math.max(width - 32, 280);
  const carouselHasAds = dashboardAds.length > 0;
  const carouselItems = dashboardAds;

  const handleAdScrollEnd = (event) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / carouselCardWidth
    );
    setActiveAdIndex(nextIndex);
  };

  const handleAdPress = (ad) => {
    openAdvertisement(ad, { onSectionChange });
  };

  const renderAdvertisementCard = (ad) => {
    const actionable = isAdvertisementActionable(ad);
    const cardStyle = [styles.adCard, { width: carouselCardWidth }];
    const cardProps = actionable
      ? {
          activeOpacity: 0.9,
          onPress: () => handleAdPress(ad),
        }
      : {};

    const imageContent = ad?.image_url ? (
      <ImageBackground
        source={{ uri: ad.image_url }}
        style={styles.adImage}
        imageStyle={styles.adImageAsset}
      >
        <View style={styles.adPill}>
          <Text style={styles.adPillText}>Ad</Text>
        </View>
      </ImageBackground>
    ) : (
      <View style={[styles.adImage, styles.adImagePlaceholder]}>
        <View style={styles.adPlaceholderGlowPrimary} />
        <View style={styles.adPlaceholderGlowSecondary} />
        <View style={styles.adPill}>
          <Text style={styles.adPillText}>Ad</Text>
        </View>
      </View>
    );

    return (
      <TouchableOpacity key={ad.id} style={cardStyle} {...cardProps}>
        {imageContent}
      </TouchableOpacity>
    );
  };

  if (userProfile?.is_host) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: 16 }]}>
          <View style={styles.headerBlur} />
          <View style={styles.headerRow}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
                {firstName}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
                Gestiona tus anuncios de vivienda
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={openLandlordPortal}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: `${ACCENT}20` }]}>
              <Icon name="open-outline" size={22} color={ACCENT} />
            </View>
            <Text style={styles.quickActionLabel}>Publicar en el portal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => onSectionChange?.("vivienda")}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "#E2E8F0" }]}>
              <Icon name="business-outline" size={22} color="#475569" />
            </View>
            <Text style={styles.quickActionLabel}>Mis anuncios</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => onSectionChange?.("grupos")}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: `${SECONDARY}20` }]}>
              <Icon name="chatbubbles-outline" size={22} color={SECONDARY} />
            </View>
            <Text style={styles.quickActionLabel}>Chats</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Antes era un FlatList porque el cuerpo del inicio del residente era el feed
  // social (lista larga y virtualizada). El inicio ya no tiene lista larga: son
  // secciones de altura acotada, así que un ScrollView basta.
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header púrpura */}
      <View style={[styles.header, { paddingTop: 16 }]}>
        <View style={styles.headerBlur} />
        <View style={styles.headerRow}>
          <Text style={styles.greetingSentence} numberOfLines={2} ellipsizeMode="tail">
            {getGreetingSentence()}, {firstName}
          </Text>
        </View>

        {/* Card puntuación MIR (residentes) / CTA prep MIR (estudiantes) */}
        {isEmailReviewPending ? (
          <View style={styles.residentHeroCard}>
            <View style={styles.residentHeroTopRow}>
              <Text style={styles.residentHeroEyebrow}>VALIDACIÓN DE EMAIL</Text>
              <View style={styles.residentStatusPill}>
                <Text style={styles.residentStatusPillText}>EN REVISIÓN</Text>
              </View>
            </View>
            <View style={styles.residentReviewHeroMain}>
              <View style={styles.residentReviewHeroHeader}>
                <View style={styles.residentHeroIconWrap}>
                  <Icon name="hourglass-outline" size={22} color="#FFF" />
                </View>
                <View style={styles.residentHeroTextWrap}>
                  <Text style={styles.residentHeroTitle}>
                    Estamos validando tu email
                  </Text>
                  <Text style={styles.residentHeroSubtitle}>
                    Revisamos tu correo corporativo manualmente. Te avisaremos
                    por email en menos de 1 hora.
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.residentHeroFooter}>
              Hasta entonces no podrás activar el perfil de residente ni
              publicar tu reseña del hospital.
            </Text>
          </View>
        ) : userProfile?.is_student ? (
          <View style={styles.studentPrepCard}>
            <Text style={styles.studentPrepLabel}>TU ACTIVIDAD</Text>
            {/* Fila superior: métricas numéricas */}
            <View style={styles.studentStatsRow}>
              <TouchableOpacity
                style={styles.studentStatItem}
                onPress={() => onSectionChange?.("nota-mir")}
                activeOpacity={0.75}
              >
                <Text style={styles.studentStatValue}>
                  {mirStats.lastGrade
                    ? mirStats.lastGrade.toLocaleString("es-ES")
                    : "—"}
                </Text>
                <Text style={styles.studentStatLabel}>Última posición</Text>
              </TouchableOpacity>

              <View style={styles.studentStatDivider} />

              <TouchableOpacity
                style={styles.studentStatItem}
                onPress={() => onSectionChange?.("nota-mir")}
                activeOpacity={0.75}
              >
                <Text style={styles.studentStatValue}>
                  {mirStats.count > 0 ? mirStats.count : "—"}
                </Text>
                <Text style={styles.studentStatLabel}>Simulaciones</Text>
              </TouchableOpacity>
            </View>

            {/* Separador horizontal */}
            <View style={styles.studentStatRowDivider} />

            {/* Fila inferior: resultado del test de especialidad */}
            <TouchableOpacity
              style={styles.studentStatRowFull}
              onPress={() => onSectionChange?.("specialityQuiz")}
              activeOpacity={0.75}
            >
              <Text style={styles.studentStatLabel}>Especialidad más afín</Text>
              <Text style={styles.studentStatValueMd} numberOfLines={1}>
                {lastQuizTopSpeciality ?? "—"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : residentEmailLocked ? (
          <View style={styles.residentHeroCard}>
            <View style={styles.residentHeroTopRow}>
              <Text style={styles.residentHeroEyebrow}>PERFIL RESIDENTE</Text>
              <View style={styles.residentStatusPill}>
                <Text style={styles.residentStatusPillText}>BLOQUEADO</Text>
              </View>
            </View>
            <View style={styles.residentReviewHeroMain}>
              <View style={styles.residentReviewHeroHeader}>
                <View style={styles.residentHeroIconWrap}>
                  <Icon name="mail-outline" size={22} color="#FFF" />
                </View>
                <View style={styles.residentHeroTextWrap}>
                  <Text style={styles.residentHeroTitle}>Añade tu correo corporativo</Text>
                  <Text style={styles.residentHeroSubtitle}>
                    La ventana MIR temporal ya ha terminado. Completa tu correo
                    corporativo desde tu perfil para reactivar el acceso.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.residentReviewHeroButton}
                onPress={() =>
                  onSectionChange?.("profileEdit", { autoFocusWorkEmail: true })
                }
                activeOpacity={0.85}
              >
                <Text style={styles.residentHeroButtonText}>Ir a mi perfil</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : residentInSeasonalGrace ? (
          <View style={styles.residentHeroCard}>
            <View style={styles.residentHeroTopRow}>
              <Text style={styles.residentHeroEyebrow}>ALTA TEMPORAL MIR</Text>
              <View style={styles.residentStatusPill}>
                <Text style={styles.residentStatusPillText}>ACTIVA</Text>
              </View>
            </View>
            <View style={styles.residentReviewHeroMain}>
              <View style={styles.residentReviewHeroHeader}>
                <View style={styles.residentHeroTextWrap}>
                  <Text style={styles.residentHeroTitle}>Verifica tu correo corporativo</Text>
                  <Text style={styles.residentHeroSubtitle}>
                    Tu acceso temporal vence el{" "}
                    {formatResidentTransitionDeadline(
                      userProfile?.resident_transition_expires_at
                    ) || "—"}.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.residentReviewHeroButton}
                onPress={() =>
                  onSectionChange?.("profileEdit", { autoFocusWorkEmail: true })
                }
                activeOpacity={0.85}
              >
                <Text style={styles.residentHeroButtonText}>Añadir correo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : residentNeedsReview ? (
          <View style={[styles.residentHeroCard, styles.residentReviewReminderCard]}>
            <View style={styles.residentHeroTopRow}>
              <Text style={styles.residentHeroEyebrow}>TU EXPERIENCIA IMPORTA</Text>
              <View
                style={[styles.residentStatusPill, styles.residentReviewReminderPill]}
              >
                <Text style={styles.residentStatusPillText}>PENDIENTE</Text>
              </View>
            </View>
            <View style={styles.residentReviewHeroMain}>
              <View style={styles.residentHeroTextWrap}>
                <Text style={styles.residentHeroTitle}>
                  Deja tu reseña y desbloquea toda la app
                </Text>
                <Text style={styles.residentHeroSubtitle}>
                  Tu experiencia puede ayudar muchísimo a otros residentes a dcidir
                  mejor su elección
                </Text>
              </View>
              <View style={styles.residentReviewReminderBenefits}>
                <View style={styles.residentReviewReminderChip}>
                  <Icon name="timer-outline" size={14} color="#FFF" />
                  <Text style={styles.residentReviewReminderChipText}>
                    Menos de 2 min
                  </Text>
                </View>
                <View style={styles.residentReviewReminderChip}>
                  <Icon name="shield-checkmark-outline" size={14} color="#FFF" />
                  <Text style={styles.residentReviewReminderChipText}>
                    Opción anónima
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.residentReviewHeroButton,
                  styles.residentReviewReminderButton,
                ]}
                onPress={() => {
                  posthogLogger.capture("resident_review_gate_prompt_clicked", {
                    source: "home_dashboard",
                    status: residentReviewGateStatus,
                  });
                  onSectionChange?.("myReview", {
                    autoOpenCreateReview: true,
                  });
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.residentHeroButtonText,
                    styles.residentReviewReminderButtonText,
                  ]}
                >
                  Escribir mi reseña
                </Text>
                <Icon name="arrow-forward" size={16} color={PRIMARY} />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.residentHeroFooter, styles.residentReviewReminderFooter]}
            >
              En cuanto la envíes, desbloqueas todas tus funcionalidades y aquí volverá
              a mostrarse tu próximo evento de agenda.
            </Text>
          </View>
        ) : (
          <View style={styles.residentHeroCard}>
            {showResidentHeroTopRow && (
              <View style={styles.residentHeroTopRow}>
                <Text style={styles.residentHeroEyebrow}>{residentHeroEyebrowText}</Text>
                <View
                  style={[
                    styles.residentStatusPill,
                    residentHeroEvent.state === "empty" && styles.residentStatusPillMuted,
                  ]}
                >
                  <Text style={styles.residentStatusPillText}>{residentHeroStatusText}</Text>
                </View>
              </View>
            )}
            <View style={styles.residentHeroBody}>
              <View style={styles.residentHeroIconWrap}>
                <Icon name={residentHeroConfig.icon} size={22} color="#FFF" />
              </View>
              <View style={styles.residentHeroTextWrap}>
                <Text style={styles.residentHeroTitle}>{residentHeroTitle}</Text>
                <Text style={styles.residentHeroSubtitle}>{residentHeroSubtitle}</Text>
              </View>
              <TouchableOpacity
                style={styles.residentHeroButton}
                onPress={() => onSectionChange?.("agenda")}
                activeOpacity={0.85}
              >
                <Text style={styles.residentHeroButtonText}>
                  {residentHeroConfig.buttonText}
                </Text>
              </TouchableOpacity>
            </View>
            {!!residentHeroFooter && (
              <Text style={styles.residentHeroFooter}>{residentHeroFooter}</Text>
            )}
          </View>
        )}
      </View>

      {/* Quick actions para estudiantes */}
      {userProfile?.is_student && (
        <>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => onSectionChange?.("vivienda")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: "#E2E8F0" }]}>
                <Icon name="business-outline" size={22} color="#475569" />
              </View>
              <Text style={styles.quickActionLabel}>Vivienda</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => onSectionChange?.("reseñas")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${SECONDARY}20` }]}>
                <Icon name="star-outline" size={22} color={SECONDARY} />
              </View>
              <Text style={styles.quickActionLabel}>Reseñas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => onSectionChange?.("myPreferences")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${ACCENT}20` }]}>
                <Icon name="heart-outline" size={22} color={ACCENT} />
              </View>
              <Text style={styles.quickActionLabel}>Preferencias</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => onSectionChange?.("orientador-mir")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${PRIMARY}20` }]}>
                <Icon name="compass-outline" size={22} color={PRIMARY} />
              </View>
              <Text style={styles.quickActionLabel}>Orientador MIR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => onSectionChange?.("nota-proyectada")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${PRIMARY}20` }]}>
                <Icon name="trending-up-outline" size={22} color={PRIMARY} />
              </View>
              <Text style={styles.quickActionLabel}>Nota proyectada</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => {
                posthogLogger.capture("mir_question_bank_entry_clicked", {
                  source: "quick_action",
                });
                onSectionChange?.("mir-questions");
              }}
            >
              <View style={styles.quickActionNewBadge}>
                <Text style={styles.quickActionNewBadgeText}>NUEVO</Text>
              </View>
              <View style={[styles.quickActionIcon, { backgroundColor: `${PRIMARY}20` }]}>
                <Icon name="school-outline" size={22} color={PRIMARY} />
              </View>
              <Text style={styles.quickActionLabel}>Preguntas MIR</Text>
            </TouchableOpacity>
            {userProfile?.can_use_photo_study && (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                  posthogLogger.capture("study_photo_entry_clicked", {
                    source: "quick_action",
                  });
                  onSectionChange?.("study-photo");
                }}
              >
                <View style={styles.quickActionNewBadge}>
                  <Text style={styles.quickActionNewBadgeText}>NUEVO</Text>
                </View>
                <View style={[styles.quickActionIcon, { backgroundColor: `${ACCENT}20` }]}>
                  <Icon name="camera-outline" size={22} color={ACCENT} />
                </View>
                <Text style={styles.quickActionLabel}>Explícamelo fácil</Text>
              </TouchableOpacity>
            )}
          </View>

          {!loadingDashboardAds && carouselHasAds && (
            <View style={styles.section}>
              <ScrollView
                horizontal
                pagingEnabled
                decelerationRate="fast"
                snapToInterval={carouselCardWidth}
                snapToAlignment="start"
                disableIntervalMomentum={carouselItems.length <= 1}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.adCarouselRow}
                onMomentumScrollEnd={handleAdScrollEnd}
              >
                {carouselItems.map(renderAdvertisementCard)}
              </ScrollView>
              <View style={styles.adFooterRow}>
                <View style={styles.adPagination}>
                  {carouselItems.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.adPaginationDot,
                        index === activeAdIndex && styles.adPaginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {/* Quick actions para residentes */}
      {userProfile?.is_resident && (
        <View style={styles.residentTopStack}>
          {showSeasonalGraceCountdown ? (
            <TouchableOpacity
              style={styles.seasonalCountdownBanner}
              onPress={() =>
                onSectionChange?.("profileEdit", { autoFocusWorkEmail: true })
              }
              activeOpacity={0.9}
            >
              <View style={styles.seasonalCountdownIcon}>
                <Icon name="time-outline" size={20} color="#B45309" />
              </View>
              <View style={styles.seasonalCountdownCopy}>
                <Text style={styles.seasonalCountdownEyebrow}>
                  ALTA TEMPORAL MIR
                </Text>
                <Text style={styles.seasonalCountdownTitle}>
                  {seasonalDaysRemaining === 0
                    ? "Hoy termina la ventana temporal"
                    : seasonalDaysRemaining === 1
                    ? "Queda 1 día para añadir tu correo corporativo"
                    : `Quedan ${seasonalDaysRemaining} días para añadir tu correo corporativo`}
                </Text>
                <Text style={styles.seasonalCountdownText}>
                  Cuando termine el plazo perderás el acceso al resto de la app
                  hasta que actualices tu email.
                </Text>
              </View>
              <View style={styles.seasonalCountdownArrow}>
                <Icon name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : null}

          {showPayoutReminder && payoutReminderTarget ? (
            <TouchableOpacity
              style={styles.payoutBanner}
              onPress={() =>
                onSectionChange?.("residentPayoutEntry", {
                  initialYear: payoutReminderTarget.year,
                  initialMonth: payoutReminderTarget.month,
                  lockInitialPeriod: true,
                })
              }
              activeOpacity={0.9}
            >
              <View style={styles.payoutBannerIcon}>
                <Icon name="cash-outline" size={20} color="#670CF5" />
              </View>
              <View style={styles.payoutBannerCopy}>
                <Text style={styles.payoutBannerEyebrow}>CIERRE MENSUAL</Text>
                <Text style={styles.payoutBannerTitle}>
                  Añade tu nómina de{" "}
                  {formatPayoutPeriodLabel(
                    payoutReminderTarget.year,
                    payoutReminderTarget.month
                  )}
                </Text>
                <Text style={styles.payoutBannerText}>
                  {payoutReminderShiftTotal > 0
                    ? payoutReminderShiftTotal === 1
                      ? "Según tu agenda hiciste 1 guardia este mes. Registra tu nómina y comprueba que te la han pagado."
                      : `Según tu agenda hiciste ${payoutReminderShiftTotal} guardias este mes. Registra tu nómina y comprueba que te las han pagado.`
                    : "Guarda la nómina, guardias y extras del mes antes de que cierre la ventana."}
                </Text>
              </View>
              <View style={styles.payoutBannerArrow}>
                <Icon name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={styles.residentActionsRow}>
            <QuickActionsMenu
              actions={residentQuickActions}
              onPress={(section) => onSectionChange?.(section)}
            />
          </View>

          {/* Cuerpo del inicio del residente: los tres números de su año, cómo
              viene la semana y lo que tiene que hacer.

              El año abre el bloque porque es lo que sitúa al residente —dónde va
              de progreso, de guardias y de dinero— antes de entrar en el detalle
              de la semana y de los deberes sueltos. "Te toca a ti" cierra: es una
              lista que la mayoría de los días está vacía, y arriba gastaba el
              sitio más valioso del inicio para decir "todo al día".

              Aquí estaba el Feed social (ADR 0004). Se saca porque el inicio del
              residente pasa a ser su información personal, no la actividad de sus
              conexiones. El Feed no se ha reubicado todavía: `hooks/useFeed` y
              `components/feed/*` siguen en el repo intactos, y hasta que se le dé
              pantalla propia (Comunidad es el candidato) los Chapós a las
              Actividades de guardia de las conexiones no son alcanzables. */}
          <ResidentYearSummary
            year={residentYearSummary}
            userId={userProfile?.id}
            onPressSection={(section) => onSectionChange?.(section)}
          />

          <ResidentWeekStrip
            events={agendaEvents}
            onPress={() => onSectionChange?.("agenda")}
          />

          <ResidentPendingList
            items={residentPending}
            loading={loadingResidentSummary}
            onPress={handlePendingPress}
          />

          {!loadingDashboardAds && carouselHasAds && (
            <View style={styles.section}>
              <ScrollView
                horizontal
                pagingEnabled
                decelerationRate="fast"
                snapToInterval={carouselCardWidth}
                snapToAlignment="start"
                disableIntervalMomentum={carouselItems.length <= 1}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.adCarouselRow}
                onMomentumScrollEnd={handleAdScrollEnd}
              >
                {carouselItems.map(renderAdvertisementCard)}
              </ScrollView>
              <View style={styles.adFooterRow}>
                <View style={styles.adPagination}>
                  {carouselItems.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.adPaginationDot,
                        index === activeAdIndex && styles.adPaginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {userProfile?.is_student && (
        <TouchableOpacity
          style={styles.roomiesBanner}
          onPress={() => onSectionChange?.("roomies")}
          activeOpacity={0.9}
        >
          <View style={styles.roomiesBannerContent}>
            <View style={styles.roomiesTextWrap}>
              <Text style={styles.roomiesBrandTitle}>RoomiesMIR</Text>
              <Text style={styles.roomiesTitle}>Nuevo: matching de convivencia</Text>
              <Text style={styles.roomiesText}>
                Crea tu perfil roomie, responde el quiz y swipea futuros compis de piso.
              </Text>
            </View>
          </View>
          <View style={styles.roomiesArrow}>
            <Icon name="arrow-forward" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}

      {userProfile?.is_student && (
        <TouchableOpacity
          style={styles.specialityQuizBanner}
          onPress={() => onSectionChange?.("specialityQuiz")}
          activeOpacity={0.9}
        >
          <View style={styles.specialityQuizBannerGlow} />
          <View style={styles.specialityQuizBannerContent}>
            <View style={styles.specialityQuizTextWrap}>
              <View style={styles.specialityQuizBadge}>
                <Text style={styles.specialityQuizBadgeText}>TEST MIR</Text>
              </View>
              <Text style={styles.specialityQuizTitle}>
                Descubre tus especialidades MIR más afines
              </Text>
              <Text style={styles.specialityQuizText}>
                Haz el test y obtén un ranking de especialidades con porcentaje de afinidad.
              </Text>
              <View style={styles.specialityQuizMetaRow}>
                <Icon name="sparkles-outline" size={15} color="#0F766E" />
                <Text style={styles.specialityQuizMetaText}>
                  Especialidad top: {lastQuizTopSpeciality ?? "pendiente"}
                </Text>
              </View>
            </View>

            <View style={styles.specialityQuizArrow}>
              <Icon name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {userProfile?.is_student && (
        <TouchableOpacity
          style={styles.mirQuestionsBanner}
          onPress={() => {
            posthogLogger.capture("mir_question_bank_entry_clicked", {
              source: "home_banner",
            });
            onSectionChange?.("mir-questions");
          }}
          activeOpacity={0.9}
        >
          <View style={styles.mirQuestionsBannerGlow} />
          <View style={styles.mirQuestionsBannerContent}>
            <View style={styles.mirQuestionsTextWrap}>
              <View style={styles.mirQuestionsBadge}>
                <Text style={styles.mirQuestionsBadgeText}>PREGUNTAS MIR</Text>
              </View>
              <Text style={styles.mirQuestionsTitle}>
                Practica con preguntas MIR reales
              </Text>
              <Text style={styles.mirQuestionsText}>
                Responde preguntas de convocatorias oficiales, marca las importantes
                y repasa tus falladas con notas propias.
              </Text>
            </View>
            <View style={styles.mirQuestionsArrow}>
              <Icon name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {userProfile?.is_student && (
        <>
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionBarGreen} />
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionTitle}>Mejor match para ti</Text>
                <Text style={styles.sectionSubtitle}>
                  Basado en tu puntuación y especialidad
                </Text>
              </View>
            </View>
            {loadingHospitals ? (
              <ActivityIndicator size="small" color={PRIMARY} style={styles.loader} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCards}
              >
                {bestMatchHospitals.map((hospital, idx) => {
                  const rating = hospitalRatings[hospital.id];
                  return (
                    <TouchableOpacity
                      key={hospital.id}
                      style={[
                        styles.hospitalCard,
                        idx % 2 === 1 && styles.hospitalCardPurple,
                      ]}
                      onPress={() => onHospitalSelect?.(hospital, null, "inicio")}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.hospitalCardName} numberOfLines={2}>
                        {hospital.name}
                      </Text>
                      <View style={styles.hospitalCardRow}>
                        <Icon name="location" size={12} color="#6B7280" />
                        <Text style={styles.hospitalCardMeta}>
                          {hospital.city}, {hospital.region}
                        </Text>
                      </View>
                      <View style={styles.hospitalCardRow}>
                        <Icon name="school" size={12} color={SECONDARY} />
                        <Text style={styles.hospitalCardSpecialty}>
                          {hospital.specialtyCount ?? 0} especialidades MIR
                        </Text>
                      </View>
                      <View style={styles.hospitalCardDivider} />
                      <View style={styles.hospitalCardRow}>
                        <Icon name="star" size={14} color="#FBBF24" />
                        <Text style={styles.hospitalCardRating}>
                          {rating ? rating.avgRating.toFixed(1) : "–"}
                        </Text>
                        <Text style={styles.hospitalCardReviews}>
                          {rating
                            ? `· ${rating.reviewCount} reseña${rating.reviewCount !== 1 ? "s" : ""}`
                            : "· Sin reseñas"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <TouchableOpacity
            style={styles.housingBanner}
            onPress={() => onSectionChange?.("vivienda")}
            activeOpacity={0.9}
          >
            <View style={styles.housingBannerBlur} />
            <View style={styles.housingBannerContent}>
              <View>
                <View style={styles.housingBadge}>
                  <Text style={styles.housingBadgeText}>NUEVO</Text>
                </View>
                <Text style={styles.housingBannerTitle}>Buscar vivienda</Text>
                <Text style={styles.housingBannerSubtitle}>
                  Pisos y habitaciones cerca de tu hospital
                </Text>
              </View>
              <View style={styles.housingBannerIcon}>
                <Icon name="home" size={40} color={SECONDARY} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionBarPurple} />
              <Text style={[styles.sectionTitle, styles.sectionTitleOnly]}>
                También te puede interesar
              </Text>
            </View>
            {loadingHospitals ? (
              <ActivityIndicator size="small" color={PRIMARY} style={styles.loader} />
            ) : (
              <View style={styles.verticalCards}>
                {alsoInterestedHospitals.map((hospital, idx) => (
                  <TouchableOpacity
                    key={hospital.id}
                    style={[
                      styles.alsoCard,
                      idx % 2 === 1 && styles.alsoCardPurple,
                    ]}
                    onPress={() => onHospitalSelect?.(hospital, null, "inicio")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.alsoCardName}>{hospital.name}</Text>
                    <Text style={styles.alsoCardLocation}>
                      {hospital.city}, {hospital.region}
                    </Text>
                    <View style={styles.alsoCardRow}>
                      <View style={styles.alsoCardStars}>
                        <Icon name="star" size={14} color="#FBBF24" />
                        <Text style={styles.alsoCardRating}>4.7</Text>
                      </View>
                      <Text style={styles.alsoCardSpecialty}>
                        {hospital.specialtyCount ?? 0} especialidades
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    backgroundColor: PRIMARY,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerBlur: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  greeting: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 2,
  },
  userName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
  },
  greetingSentence: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  mirCard: {
    backgroundColor: "rgba(27,9,119,0.4)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  mirScore: {
    fontSize: 44,
    fontWeight: "800",
    color: "#FFF",
  },
  mirRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  mirDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SECONDARY,
  },
  mirText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFF",
  },
  mirRight: {
    alignItems: "flex-end",
  },
  mirLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.6)",
  },
  mirYear: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFF",
    marginTop: 2,
  },
  residentHeroCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    minHeight: 136,
  },
  residentReviewReminderCard: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.24)",
    shadowColor: "#18074D",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  residentHeroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  residentHeroEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.72)",
  },
  residentStatusPill: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  residentReviewReminderPill: {
    backgroundColor: "#F97316",
  },
  residentStatusPillMuted: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  residentStatusPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFF",
  },
  residentHeroBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
  },
  residentReviewHeroMain: {
    gap: 14,
  },
  residentHeroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  residentHeroTextWrap: {
    flex: 1,
  },
  residentHeroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
  },
  residentHeroSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    marginTop: 2,
  },
  residentHeroButton: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  residentReviewHeroButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  residentReviewReminderButton: {
    minWidth: 188,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  residentHeroButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
  },
  residentReviewReminderButtonText: {
    fontSize: 13,
  },
  residentHeroFooter: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 12,
    fontStyle: "italic",
  },
  residentReviewReminderBenefits: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  residentReviewReminderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  residentReviewReminderChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  residentReviewReminderFooter: {
    color: "rgba(255,255,255,0.7)",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    justifyContent: "space-between",
    marginBottom: 24,
  },
  quickActionBtn: {
    width: "31%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  quickActionNewBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#670CF5",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  quickActionNewBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  residentTopStack: {
    gap: 14,
    marginBottom: 24,
  },
  payoutBanner: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#670CF5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  payoutBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4EEFF",
  },
  payoutBannerCopy: {
    flex: 1,
  },
  payoutBannerEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#670CF5",
    marginBottom: 4,
  },
  payoutBannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B0977",
    textTransform: "capitalize",
  },
  payoutBannerText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    marginTop: 4,
  },
  payoutBannerArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  seasonalCountdownBanner: {
    borderRadius: 24,
    backgroundColor: "#FFFBEB",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.25)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  seasonalCountdownIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3C7",
  },
  seasonalCountdownCopy: {
    flex: 1,
  },
  seasonalCountdownEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#B45309",
    marginBottom: 4,
  },
  seasonalCountdownTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#78350F",
  },
  seasonalCountdownText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#92400E",
    marginTop: 4,
  },
  seasonalCountdownArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D97706",
  },
  residentActionsCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(27,9,119,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  residentActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 18,
  },
  residentActionItem: {
    width: "31%",
    alignItems: "center",
    gap: 8,
  },
  residentActionsRow: {
    marginHorizontal: -16,
  },
  sectionBarPurple: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#670CF5",
  },
  residentMetricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  residentMetricCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(27,9,119,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  residentMetricEmoji: {
    fontSize: 20,
    marginBottom: 8,
  },
  residentMetricTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: ACCENT,
  },
  residentMetricValue: {
    fontSize: 24,
    fontWeight: "800",
    color: PRIMARY,
    marginTop: 4,
  },
  residentMetricFoot: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  roomiesBanner: {
    borderRadius: 24,
    backgroundColor: "#F4EEFF",
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.10)",
  },
  roomiesBannerContent: {
    flex: 1,
    justifyContent: "center",
  },
  roomiesTextWrap: {
    flex: 1,
  },
  roomiesBrandTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: PRIMARY,
    lineHeight: 22,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  roomiesTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: ACCENT,
    lineHeight: 16,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roomiesText: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(27,9,119,0.75)",
  },
  roomiesArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    alignSelf: "center",
  },
  specialityQuizBanner: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ECFEFF",
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(13,148,136,0.14)",
  },
  specialityQuizBannerGlow: {
    position: "absolute",
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(45,212,191,0.16)",
  },
  specialityQuizBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  specialityQuizBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#0F766E",
    marginBottom: 10,
  },
  specialityQuizBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  specialityQuizTextWrap: {
    flex: 1,
  },
  specialityQuizTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#134E4A",
    lineHeight: 24,
    marginBottom: 6,
  },
  specialityQuizText: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(19,78,74,0.84)",
  },
  specialityQuizMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  specialityQuizMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F766E",
  },
  specialityQuizArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F766E",
    alignSelf: "center",
  },
  mirQuestionsBanner: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#F5F0FF",
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.14)",
  },
  mirQuestionsBannerGlow: {
    position: "absolute",
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(103,12,245,0.10)",
  },
  mirQuestionsBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mirQuestionsTextWrap: {
    flex: 1,
  },
  mirQuestionsBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#670CF5",
    marginBottom: 10,
  },
  mirQuestionsBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  mirQuestionsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2E1065",
    lineHeight: 24,
    marginBottom: 6,
  },
  mirQuestionsText: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(46,16,101,0.84)",
  },
  mirQuestionsArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
    alignSelf: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
  },
  sectionTitleBlock: {
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(27,9,119,0.5)",
    marginTop: 2,
    textTransform: "uppercase",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleOnly: {
    marginBottom: 0,
  },
  sectionBarGreen: {
    width: 4,
    height: 24,
    backgroundColor: SECONDARY,
    borderRadius: 2,
  },
  sectionBarPurple: {
    width: 4,
    height: 24,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
  adCarouselRow: {
    paddingBottom: 10,
  },
  adCard: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.10)",
    backgroundColor: "#FFFFFF",
  },
  adImage: {
    height: 132,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 16,
  },
  adImageAsset: {
    borderRadius: 24,
  },
  adImagePlaceholder: {
    backgroundColor: "#F6F0FF",
  },
  adPlaceholderGlowPrimary: {
    position: "absolute",
    top: -22,
    right: -12,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(103,12,245,0.14)",
  },
  adPlaceholderGlowSecondary: {
    position: "absolute",
    bottom: -30,
    left: -10,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(0,189,124,0.12)",
  },
  adPill: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(15,23,42,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  adPillText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFF",
  },
  adFooterRow: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 4,
  },
  adPagination: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adPaginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  adPaginationDotActive: {
    width: 20,
    backgroundColor: PRIMARY,
  },
  horizontalCards: {
    flexDirection: "row",
    gap: 16,
    paddingBottom: 16,
  },
  hospitalCard: {
    minWidth: 280,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderBottomWidth: 4,
    borderBottomColor: SECONDARY,
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  hospitalCardPurple: {
    borderBottomColor: PRIMARY,
    shadowColor: PRIMARY,
  },
  hospitalCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
  },
  hospitalCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  hospitalCardMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
  hospitalCardSpecialty: {
    fontSize: 12,
    fontWeight: "700",
    color: SECONDARY,
  },
  hospitalCardDivider: {
    height: 1,
    backgroundColor: "rgba(27,9,119,0.06)",
    marginVertical: 16,
  },
  hospitalCardRating: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  hospitalCardReviews: {
    fontSize: 12,
    color: "rgba(27,9,119,0.5)",
    marginLeft: 4,
  },
  loader: {
    marginVertical: 16,
  },
  clinicalCard: {
    backgroundColor: "#FFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(27,9,119,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  clinicalEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  clinicalTimeline: {
    gap: 14,
  },
  clinicalTimelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  clinicalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: "#D1D5DB",
  },
  clinicalDotActive: {
    backgroundColor: PRIMARY,
  },
  clinicalItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  clinicalItemMeta: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  clinicalCta: {
    marginTop: 18,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  clinicalCtaText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
  },
  calendarPromoCard: {
    marginBottom: 24,
    backgroundColor: "rgba(103,12,245,0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.08)",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  calendarPromoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(103,12,245,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarPromoTextWrap: {
    flex: 1,
  },
  calendarPromoTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: ACCENT,
  },
  calendarPromoSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 17,
  },
  housingBanner: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
  },
  housingBannerBlur: {
    position: "absolute",
    right: -32,
    bottom: -32,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(0,189,124,0.15)",
  },
  housingBannerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  housingBadge: {
    backgroundColor: SECONDARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  housingBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: ACCENT,
    letterSpacing: 0.5,
  },
  housingBannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
  },
  housingBannerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  housingBannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(0,189,124,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  verticalCards: {
    gap: 12,
  },
  alsoCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    borderBottomWidth: 4,
    borderBottomColor: SECONDARY,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  alsoCardPurple: {
    borderBottomColor: PRIMARY,
  },
  alsoCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  alsoCardLocation: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 4,
  },
  alsoCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  alsoCardStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alsoCardRating: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  alsoCardSpecialty: {
    fontSize: 12,
    fontWeight: "700",
    color: SECONDARY,
  },
  // Student activity analytics card
  studentPrepCard: {
    backgroundColor: "rgba(27,9,119,0.4)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  studentPrepLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 12,
  },
  studentStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  studentStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  studentStatValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    textAlign: "center",
  },
  studentStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  studentStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  studentStatRowDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 12,
  },
  studentStatRowFull: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  studentStatValueMd: {
    fontSize: 15,
    fontWeight: "700",
    color: SECONDARY,
    flexShrink: 1,
    textAlign: "right",
  },
});
