import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
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

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";

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
  onHospitalSelect,
  onSectionChange,
}) {
  const insets = useSafeAreaInsets();
  const [searchInput, setSearchInput] = useState("");
  const [hospitalRatings, setHospitalRatings] = useState({});
  const [mirStats, setMirStats] = useState({ count: 0, lastGrade: null });
  const [lastQuizTop, setLastQuizTop] = useState(null);
  const [residentCourses, setResidentCourses] = useState([]);
  const [loadingResidentCourses, setLoadingResidentCourses] = useState(false);

  const {
    hospitals,
    specialties,
    filteredHospitals,
    searchTerm,
    setSearchTerm,
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
      if (success && data?.top_results?.length) {
        setLastQuizTop(data.top_results[0].name);
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

  const displayName = useMemo(() => {
    const name = userProfile?.name || "";
    const surname = userProfile?.surname || "";
    return [name, surname].filter(Boolean).join(" ").trim() || "Usuario";
  }, [userProfile]);

  const firstName = userProfile?.name || displayName.split(" ")[0] || "Usuario";
  const lastName = userProfile?.surname || displayName.split(" ").slice(1).join(" ") || "";
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
  const residentMeta = [residentSpecialty?.name, residentYearLabel]
    .filter(Boolean)
    .join(" · ");
  const currentWeekdayIndex = getCurrentWeekdayIndex();
  const residentQuickActions = useMemo(
    () => [
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
        label: "Comunidad",
        icon: "people-outline",
        section: "comunity",
        tint: "#EDE9FE",
        color: "#7C3AED",
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
        label: "Vivienda",
        icon: "home-outline",
        section: "vivienda",
        tint: "#E5E7EB",
        color: "#475569",
      },
    ],
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

  const handleSearchSubmit = () => setSearchTerm(searchInput.trim());

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header púrpura */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerBlur} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>
              {userProfile?.is_resident ? residentMeta : getGreeting()}
            </Text>
            {userProfile?.is_resident ? (
              <Text style={styles.userName}>
                {getGreetingSentence()}, {firstName}
              </Text>
            ) : (
              <Text style={styles.userName}>
                {firstName}
                {lastName ? (
                  <Text style={styles.userNameSecondary}> {lastName}</Text>
                ) : null}
              </Text>
            )}
            <Text style={styles.headerSubtitle}>
              {userProfile?.is_resident
                ? residentHospital?.name || "Tu hospital"
                : "Tu próxima residencia te espera"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifButton}
            onPress={() => {}}
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

            {/* Fila inferior: top especialidad */}
            <TouchableOpacity
              style={styles.studentStatRowFull}
              onPress={() => onSectionChange?.("specialityQuiz")}
              activeOpacity={0.75}
            >
              <Text style={styles.studentStatLabel}>Top especialidad</Text>
              <Text style={styles.studentStatValueMd} numberOfLines={1}>
                {lastQuizTop ?? "—"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.residentHeroCard}>
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
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => onSectionChange?.("grupos")}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "#6D28D920" }]}>
              <Ionicons name="people" size={22} color="#6D28D9" />
            </View>
            <Text style={styles.quickActionLabel}>Grupos</Text>
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
      )}

      {/* Quick actions para residentes */}
      {userProfile?.is_resident && (
        <View style={styles.residentTopStack}>
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
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar hospital o especialidad..."
              placeholderTextColor="#9CA3AF"
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hospitales</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{filteredHospitals.length} RESULTADOS</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              <TouchableOpacity style={styles.filterChip}>
                <Ionicons name="options" size={14} color={ACCENT} />
                <Text style={styles.filterChipText}>Ordenar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterChip}>
                <Ionicons name="location" size={14} color={ACCENT} />
                <Text style={styles.filterChipText}>Provincia</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterChip}>
                <Ionicons name="medkit" size={14} color={ACCENT} />
                <Text style={styles.filterChipText}>Especialidad</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

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

      {userProfile?.is_resident && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Novedades para vosotros</Text>
          <TouchableOpacity
            style={styles.promoCard}
            onPress={() => onSectionChange?.("cursos")}
            activeOpacity={0.88}
          >
            <View style={styles.promoImage}>
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>PROMOCIÓN</Text>
              </View>
            </View>
            <View style={styles.promoBody}>
              <Text style={styles.promoTitle}>Máster en Ginecología Oncológica</Text>
              <Text style={styles.promoDescription}>
                Inscripciones abiertas para la nueva convocatoria 2026. Especialízate con
                los mejores profesionales.
              </Text>
              <View style={styles.promoFooter}>
                <View style={styles.promoMetaRow}>
                  <View style={styles.promoMetaItem}>
                    <Ionicons name="thumbs-up-outline" size={16} color="#6B7280" />
                    <Text style={styles.promoMetaText}>850</Text>
                  </View>
                  <View style={styles.promoMetaItem}>
                    <Ionicons name="chatbubble-outline" size={16} color="#6B7280" />
                    <Text style={styles.promoMetaText}>12</Text>
                  </View>
                </View>
                <View style={styles.promoSave}>
                  <Ionicons name="bookmark-outline" size={16} color={PRIMARY} />
                  <Text style={styles.promoSaveText}>Guardar</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
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
    padding: 24,
    marginBottom: 16,
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
    marginBottom: 24,
  },
  greeting: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
  },
  userNameSecondary: {
    color: SECONDARY,
    fontStyle: "italic",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
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
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  residentHeroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
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
    gap: 12,
    marginBottom: 24,
  },
  quickActionBtn: {
    flex: 1,
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
    marginBottom: 24,
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
  roomiesTitle: {
    fontSize: 16,
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 44,
    paddingRight: 16,
    marginBottom: 24,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    position: "absolute",
    left: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ACCENT,
    padding: 0,
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
  badge: {
    backgroundColor: "rgba(27,9,119,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(27,9,119,0.5)",
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(27,9,119,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
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
  promoCard: {
    marginTop: 12,
    backgroundColor: "#FFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(27,9,119,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  promoImage: {
    height: 128,
    backgroundColor: "#D9CCFF",
    justifyContent: "flex-start",
    padding: 16,
  },
  promoBadge: {
    alignSelf: "flex-start",
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  promoBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
  },
  promoBody: {
    padding: 18,
  },
  promoTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 24,
  },
  promoDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
    marginTop: 8,
  },
  promoFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  promoMetaRow: {
    flexDirection: "row",
    gap: 16,
  },
  promoMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promoMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  promoSave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promoSaveText: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
  },

  // Student activity analytics card
  studentPrepCard: {
    backgroundColor: "rgba(27,9,119,0.4)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  studentPrepLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 16,
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
    marginVertical: 14,
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
