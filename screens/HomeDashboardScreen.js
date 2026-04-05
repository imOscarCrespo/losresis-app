import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHospitals } from "../hooks/useHospitals";
import { useAgendaEvents } from "../hooks/useAgendaEvents";
import { agendaEventTypeLabels } from "../services/agendaService";
import { getCourses } from "../services/lectureService";
import { getHospitalRatings } from "../services/reviewsService";
import { getMirSimulatorStats } from "../services/mirSimulatorService";
import { getLastQuizSessionForUser } from "../services/specialityQuizService";
import {
  getDashboardAdvertisements,
  getDashboardAudience,
} from "../services/dashboardAdvertisementService";
import {
  formatPayoutPeriodLabel,
  getCurrentPayoutReminderTargetDate,
  getResidentPayoutForMonth,
  shouldShowPayoutReminder,
} from "../services/residentPayoutService";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
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

function getCurrentWeekdayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function getStartOfWeek(value = new Date()) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(12, 0, 0, 0);
  return date;
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

  if (event?.start_time && event?.end_time) {
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

function formatCourseDateLabel(course) {
  const dates = Array.isArray(course?.event_dates)
    ? [...course.event_dates].sort()
    : [];

  if (dates.length === 0) return "Sin fecha";

  return new Date(`${dates[0]}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getCourseKindLabel(course) {
  if (course?.title?.toLowerCase().includes("congreso")) {
    return "Congreso";
  }

  return "Curso";
}

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
  const [residentCourses, setResidentCourses] = useState([]);
  const [loadingResidentCourses, setLoadingResidentCourses] = useState(false);
  const [dashboardAds, setDashboardAds] = useState([]);
  const [loadingDashboardAds, setLoadingDashboardAds] = useState(false);
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [payoutReminderTarget, setPayoutReminderTarget] = useState(null);
  const [showPayoutReminder, setShowPayoutReminder] = useState(false);

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

    const loadResidentCourses = async () => {
      if (!userProfile?.is_resident || !userProfile?.speciality_id) {
        if (isMounted) {
          setResidentCourses([]);
          setLoadingResidentCourses(false);
        }
        return;
      }

      setLoadingResidentCourses(true);
      try {
        const result = await getCourses({
          specialityId: userProfile.speciality_id,
          page: 0,
        });

        if (isMounted) {
          setResidentCourses((result.courses || []).slice(0, 6));
        }
      } catch (error) {
        console.error("Error loading resident courses:", error);
        if (isMounted) {
          setResidentCourses([]);
        }
      } finally {
        if (isMounted) {
          setLoadingResidentCourses(false);
        }
      }
    };

    loadResidentCourses();

    return () => {
      isMounted = false;
    };
  }, [userProfile?.is_resident, userProfile?.speciality_id]);

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
      if (!userProfile?.id || !userProfile?.is_resident) {
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

        setPayoutReminderTarget(targetDate);
        setShowPayoutReminder(
          shouldShowPayoutReminder({
            userProfile,
            existingRecord,
          })
        );
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
  }, [userProfile?.id, userProfile?.is_resident]);

  const displayName = useMemo(() => {
    const name = userProfile?.name || "";
    const surname = userProfile?.surname || "";
    return [name, surname].filter(Boolean).join(" ").trim() || "Usuario";
  }, [userProfile]);

  const firstName = useMemo(() => {
    const sourceName = (userProfile?.name || displayName).trim();
    return sourceName.split(/\s+/)[0] || "Usuario";
  }, [displayName, userProfile?.name]);
  const residentHospital = useMemo(
    () => hospitals.find((hospital) => hospital.id === userProfile?.hospital_id),
    [hospitals, userProfile?.hospital_id]
  );
  const residentSpecialty = useMemo(
    () => specialties.find((specialty) => specialty.id === userProfile?.speciality_id),
    [specialties, userProfile?.speciality_id]
  );
  const residentYearLabel = userProfile?.resident_year
    ? `R${userProfile.resident_year}`
    : "Residente";
  const residentNeedsReview = userProfile?.is_resident && !residentHasReview;
  const residentMeta = [residentSpecialty?.name, residentYearLabel]
    .filter(Boolean)
    .join(" · ");
  const currentWeekdayIndex = getCurrentWeekdayIndex();
  const residentQuickActions = useMemo(
    () =>
      [
        {
          label: "Libro de residentes",
          icon: "book-outline",
          section: "residenceLibrary",
          tint: "#DBEAFE",
          color: "#2563EB",
        },
        {
          label: "Cursos / Congresos",
          icon: "school-outline",
          section: "cursos",
          tint: "#FFEDD5",
          color: "#F97316",
        },
        {
          label: "Mi reseña",
          icon: "star-outline",
          section: "myReview",
          tint: "#F3E8FF",
          color: "#9333EA",
        },
        {
          label: "Rotaciones externas",
          icon: "airplane-outline",
          section: "rotaciones-externas",
          tint: "#CCFBF1",
          color: "#0F766E",
        },
        {
          label: "Nóminas",
          icon: "cash-outline",
          section: "residentPayouts",
          tint: "#F4EEFF",
          color: "#670CF5",
        },
        {
          label: "Vivienda",
          icon: "home-outline",
          section: "vivienda",
          tint: "#E5E7EB",
          color: "#475569",
        },
      ].filter(Boolean),
    []
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
  const residentHeroConfig = getAgendaHeroConfig(residentHeroEvent.event?.event_type);
  const residentHeroEyebrowText = loadingAgendaEvents
    ? "CARGANDO"
    : residentHeroEvent.state === "today"
      ? "HOY"
      : residentHeroEvent.state === "upcoming"
        ? "PRÓXIMO EVENTO"
        : "AGENDA";
  const residentHeroStatusText = loadingAgendaEvents
    ? "..."
    : residentHeroEvent.state === "today"
      ? "EN CURSO"
      : residentHeroEvent.state === "upcoming"
        ? "PRÓXIMO"
        : "SIN EVENTOS";
  const showResidentHeroTopRow =
    loadingAgendaEvents || residentHeroEvent.state !== "empty";
  const residentHeroTitle = loadingAgendaEvents
    ? "Cargando agenda..."
    : residentHeroEvent.event?.title ||
      agendaEventTypeLabels[residentHeroEvent.event?.event_type] ||
      "Agenda vacía";
  const residentHeroSubtitle = loadingAgendaEvents
    ? "Buscando eventos en tu calendario"
    : residentHeroEvent.state === "today"
      ? `${formatAgendaHeaderDate(residentHeroEvent.event?.event_date)} · ${formatAgendaHeaderTime(
          residentHeroEvent.event
        )}`
      : residentHeroEvent.state === "upcoming"
        ? `${formatAgendaHeaderDate(
            residentHeroEvent.event?.event_date
          )} · ${formatAgendaHeaderTime(residentHeroEvent.event)}`
        : "Añade una guardia, curso o recordatorio.";
  const residentHeroFooter = loadingAgendaEvents
    ? "Sincronizando tu agenda"
    : residentHeroEvent.state === "today"
      ? `${agendaEventTypeLabels[residentHeroEvent.event?.event_type] || "Evento"} en tu agenda de hoy`
      : residentHeroEvent.state === "upcoming"
        ? `Tu siguiente ${
            agendaEventTypeLabels[residentHeroEvent.event?.event_type]?.toLowerCase() || "evento"
          } ya está programado`
        : "";
  const weekOverview = useMemo(() => {
    const startOfWeek = getStartOfWeek();

    return ["L", "M", "X", "J", "V", "S", "D"].map((dayLabel, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);

      const matchingEvent = agendaEvents.find((event) => eventIncludesDate(event, date));
      const agendaHeroConfig = getAgendaHeroConfig(matchingEvent?.event_type);

      return {
        day: dayLabel,
        icon: matchingEvent ? agendaHeroConfig.icon : "add",
        hasEvent: Boolean(matchingEvent),
        event: matchingEvent || null,
      };
    });
  }, [agendaEvents]);

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
    if (!ad?.target_section) return;
    onSectionChange?.(ad.target_section);
  };

  const renderAdvertisementCard = (ad) => {
    const actionable = Boolean(ad?.target_section);
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
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
              {firstName}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {userProfile?.is_resident
                ? [residentMeta, residentHospital?.name || "Tu hospital"]
                    .filter(Boolean)
                    .join(" · ")
                : "Tu próxima residencia te espera"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifButton}
            onPress={() => onSectionChange?.("notifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Card puntuación MIR (residentes) / CTA prep MIR (estudiantes) */}
        {userProfile?.is_student ? (
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
        ) : residentNeedsReview ? (
          <View style={styles.residentHeroCard}>
            <View style={styles.residentHeroTopRow}>
              <Text style={styles.residentHeroEyebrow}>MI RESEÑA</Text>
              <View style={styles.residentStatusPill}>
                <Text style={styles.residentStatusPillText}>
                  {residentReviewGateStatus === "hard" ? "OBLIGATORIO" : "PENDIENTE"}
                </Text>
              </View>
            </View>
            <View style={styles.residentReviewHeroMain}>
              <View style={styles.residentReviewHeroHeader}>
                <View style={styles.residentHeroIconWrap}>
                  <Ionicons name="star-outline" size={22} color="#FFF" />
                </View>
                <View style={styles.residentHeroTextWrap}>
                  <Text style={styles.residentHeroTitle}>Deja tu reseña</Text>
                  <Text style={styles.residentHeroSubtitle}>
                    Cuéntale al resto cómo es {residentHospital?.name || "tu hospital"}.
                    Mantendremos este acceso destacado hasta que la publiques.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.residentReviewHeroButton}
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
                <Text style={styles.residentHeroButtonText}>Abrir mi reseña</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.residentHeroFooter}>
              En cuanto la envíes, este bloque desaparece del inicio.
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
                <Ionicons name={residentHeroConfig.icon} size={22} color="#FFF" />
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
                <Ionicons name="business-outline" size={22} color="#475569" />
              </View>
              <Text style={styles.quickActionLabel}>Vivienda</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => onSectionChange?.("reseñas")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${SECONDARY}20` }]}>
                <Ionicons name="star-outline" size={22} color={SECONDARY} />
              </View>
              <Text style={styles.quickActionLabel}>Reseñas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => onSectionChange?.("myPreferences")}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${ACCENT}20` }]}>
                <Ionicons name="heart-outline" size={22} color={ACCENT} />
              </View>
              <Text style={styles.quickActionLabel}>Preferencias</Text>
            </TouchableOpacity>
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
                <Ionicons name="cash-outline" size={20} color="#670CF5" />
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
                  Guarda la nómina, guardias y extras del mes antes de que cierre la ventana.
                </Text>
              </View>
              <View style={styles.payoutBannerArrow}>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={styles.residentWeekCard}>
            <View style={styles.residentCardHeader}>
              <Text style={styles.residentCardTitle}>Semana actual</Text>
              <TouchableOpacity
                onPress={() => onSectionChange?.("agenda")}
                activeOpacity={0.75}
              >
                <Text style={styles.residentCardLink}>Ver agenda</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.residentWeekRow}>
              {weekOverview.map((item, index) => {
                const isActive = index === currentWeekdayIndex;
                const isAdd = item.icon === "add";

                return (
                  <View
                    key={item.day}
                    style={[styles.residentWeekItem, isActive && styles.residentWeekItemActive]}
                  >
                    <Text
                      style={[
                        styles.residentWeekDay,
                        isActive && styles.residentWeekDayActive,
                      ]}
                    >
                      {item.day}
                    </Text>
                    {isAdd ? (
                      <Ionicons
                        name="add"
                        size={16}
                        color={isActive ? PRIMARY : "#C7CCD8"}
                      />
                    ) : (
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={isActive ? PRIMARY : item.hasEvent ? ACCENT : "#C7CCD8"}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.residentActionsCard}>
            <View style={styles.residentActionsGrid}>
              {residentQuickActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={styles.residentActionItem}
                  onPress={() => onSectionChange?.(action.section)}
                  activeOpacity={0.78}
                >
                  <View
                    style={[
                      styles.residentActionIconWrap,
                      { backgroundColor: action.tint },
                    ]}
                  >
                    <Ionicons name={action.icon} size={22} color={action.color} />
                  </View>
                  <Text style={styles.residentActionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
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

          <TouchableOpacity
            style={styles.roomiesBanner}
            onPress={() => onSectionChange?.("roomies")}
            activeOpacity={0.9}
          >
            <View style={styles.roomiesBannerContent}>
              <View style={styles.roomiesBadge}>
                <Ionicons name="heart" size={18} color={PRIMARY} />
              </View>
              <View style={styles.roomiesTextWrap}>
                <Text style={styles.roomiesBrandTitle}>RoomiesMIR</Text>
                <Text style={styles.roomiesTitle}>Nuevo: matching de convivencia</Text>
                <Text style={styles.roomiesText}>
                  Crea tu perfil roomie, responde el quiz y swipea futuros compis de piso.
                </Text>
              </View>
            </View>
            <View style={styles.roomiesArrow}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

        </View>
      )}

      {userProfile?.is_student && (
        <TouchableOpacity
          style={styles.roomiesBanner}
          onPress={() => onSectionChange?.("roomies")}
          activeOpacity={0.9}
        >
          <View style={styles.roomiesBannerContent}>
            <View style={styles.roomiesBadge}>
              <Ionicons name="heart" size={18} color={PRIMARY} />
            </View>
            <View style={styles.roomiesTextWrap}>
              <Text style={styles.roomiesBrandTitle}>RoomiesMIR</Text>
              <Text style={styles.roomiesTitle}>Nuevo: matching de convivencia</Text>
              <Text style={styles.roomiesText}>
                Crea tu perfil roomie, responde el quiz y swipea futuros compis de piso.
              </Text>
            </View>
          </View>
          <View style={styles.roomiesArrow}>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
            <View style={styles.specialityQuizBadge}>
              <Text style={styles.specialityQuizBadgeText}>TEST MIR</Text>
            </View>

            <View style={styles.specialityQuizTextWrap}>
              <Text style={styles.specialityQuizTitle}>
                Descubre tus especialidades MIR más afines
              </Text>
              <Text style={styles.specialityQuizText}>
                Haz el test y obtén un ranking de especialidades con porcentaje de afinidad.
              </Text>
              <View style={styles.specialityQuizMetaRow}>
                <Ionicons name="sparkles-outline" size={15} color="#0F766E" />
                <Text style={styles.specialityQuizMetaText}>
                  Especialidad top: {lastQuizTopSpeciality ?? "pendiente"}
                </Text>
              </View>
            </View>

            <View style={styles.specialityQuizArrow}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
                        <Ionicons name="location" size={12} color="#6B7280" />
                        <Text style={styles.hospitalCardMeta}>
                          {hospital.city}, {hospital.region}
                        </Text>
                      </View>
                      <View style={styles.hospitalCardRow}>
                        <Ionicons name="school" size={12} color={SECONDARY} />
                        <Text style={styles.hospitalCardSpecialty}>
                          {hospital.specialtyCount ?? 0} especialidades MIR
                        </Text>
                      </View>
                      <View style={styles.hospitalCardDivider} />
                      <View style={styles.hospitalCardRow}>
                        <Ionicons name="star" size={14} color="#FBBF24" />
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
                <Ionicons name="home" size={40} color={SECONDARY} />
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
                        <Ionicons name="star" size={14} color="#FBBF24" />
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

      {userProfile?.is_resident && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.residentCoursesTitle}>Próximos cursos y congresos</Text>
          </View>
          {loadingResidentCourses ? (
            <ActivityIndicator size="small" color={PRIMARY} style={styles.loader} />
          ) : residentCourses.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.residentCoursesRow}
            >
              {residentCourses.slice(0, 2).map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={styles.residentCourseCard}
                  onPress={() => onSectionChange?.("cursos")}
                  activeOpacity={0.86}
                >
                  <Text
                    style={[
                      styles.residentCourseKind,
                      getCourseKindLabel(course) === "Congreso"
                        ? styles.residentCourseKindCongress
                        : styles.residentCourseKindCourse,
                    ]}
                  >
                    {getCourseKindLabel(course)}
                  </Text>
                  <Text style={styles.residentCourseName} numberOfLines={2}>
                    {course.title}
                  </Text>
                  <Text style={styles.residentCourseMeta} numberOfLines={1}>
                    {formatCourseDateLabel(course)}
                    {course.hospital?.name ? ` · ${course.hospital.name}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.residentCoursesEmpty}
              onPress={() => onSectionChange?.("cursos")}
              activeOpacity={0.84}
            >
              <Ionicons name="school-outline" size={20} color={PRIMARY} />
              <Text style={styles.residentCoursesEmptyTitle}>
                Sin cursos para tu especialidad
              </Text>
              <Text style={styles.residentCoursesEmptyText}>
                Revisa las formaciones disponibles o crea una nueva.
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -6,
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
  },
  residentReviewHeroMain: {
    gap: 14,
  },
  residentReviewHeroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
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
  },
  residentHeroButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
  },
  residentHeroFooter: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 12,
    fontStyle: "italic",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
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
  residentWeekCard: {
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
  residentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  residentCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: ACCENT,
  },
  residentCardLink: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
  },
  residentWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  residentWeekItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderRadius: 999,
  },
  residentWeekItemActive: {
    backgroundColor: "rgba(103,12,245,0.08)",
  },
  residentWeekDay: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9CA3AF",
  },
  residentWeekDayActive: {
    color: PRIMARY,
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
  residentActionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  residentActionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
    lineHeight: 14,
  },
  residentCoursesTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#334155",
  },
  residentCoursesRow: {
    gap: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  residentCourseCard: {
    width: 208,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(27,9,119,0.06)",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  residentCourseKind: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  residentCourseKindCourse: {
    color: "#2563EB",
  },
  residentCourseKindCongress: {
    color: "#F97316",
  },
  residentCourseName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 17,
  },
  residentCourseMeta: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 6,
    lineHeight: 14,
  },
  residentCoursesEmpty: {
    marginTop: 12,
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(27,9,119,0.06)",
    padding: 16,
    alignItems: "flex-start",
    gap: 6,
  },
  residentCoursesEmptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: ACCENT,
  },
  residentCoursesEmptyText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
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
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.10)",
  },
  roomiesBannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  roomiesBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  roomiesTextWrap: {
    flex: 1,
  },
  roomiesBrandTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: PRIMARY,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  roomiesTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: ACCENT,
    marginBottom: 4,
  },
  roomiesText: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(27,9,119,0.75)",
  },
  roomiesArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
  },
  specialityQuizBanner: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ECFEFF",
    padding: 18,
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
    gap: 14,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F766E",
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
