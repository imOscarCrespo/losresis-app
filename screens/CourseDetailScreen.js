import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCourseById, deleteCourse } from "../services/lectureService";
import { getCurrentUser } from "../services/authService";
import { formatDateOnly, formatShortDate } from "../utils/dateUtils";
import { openURL } from "../utils/courseUtils";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const CARD_BORDER = "#F1F5F9";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";
const DANGER = "#EF4444";

function InfoPill({ icon, text, accent = "purple" }) {
  return (
    <View
      style={[
        styles.infoPill,
        accent === "purple" && styles.infoPillPurple,
        accent === "green" && styles.infoPillGreen,
        accent === "blue" && styles.infoPillBlue,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={
          accent === "purple"
            ? PRIMARY
            : accent === "green"
              ? SECONDARY
              : "#2563EB"
        }
      />
      <Text
        style={[
          styles.infoPillText,
          accent === "purple" && styles.infoPillTextPurple,
          accent === "green" && styles.infoPillTextGreen,
          accent === "blue" && styles.infoPillTextBlue,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function CourseDetailScreen({
  courseId,
  onBack,
  onEdit,
  onDelete,
}) {
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    posthogLogger.logScreen("CourseDetailScreen", { courseId });
  }, [courseId]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { success, user } = await getCurrentUser();
        if (success && user) {
          setCurrentUserId(user.id);
        }
      } catch (err) {
        console.error("Error loading current user:", err);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadCourse = async () => {
      if (!courseId) {
        setError("ID de curso requerido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const fetchedCourse = await getCourseById(courseId);
        setCourse(fetchedCourse);
      } catch (err) {
        console.error("Error fetching course:", err);
        setError("No se pudo cargar el curso");
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseId]);

  const sortedDates = useMemo(
    () => (Array.isArray(course?.event_dates) ? [...course.event_dates].sort() : []),
    [course?.event_dates]
  );

  const dateLabel = useMemo(() => {
    if (sortedDates.length === 0) return "Sin fecha";
    if (sortedDates.length === 1) return formatDateOnly(sortedDates[0]);
    return `${formatDateOnly(sortedDates[0])} - ${formatDateOnly(
      sortedDates[sortedDates.length - 1]
    )}`;
  }, [sortedDates]);

  const quickStats = useMemo(
    () =>
      [
        { key: "date", icon: "calendar-outline", label: dateLabel, accent: "purple" },
        course?.teaching_hours
          ? {
              key: "hours",
              icon: "time-outline",
              label: course.teaching_hours,
              accent: "blue",
            }
          : null,
        course?.price_text
          ? {
              key: "price",
              icon: "cash-outline",
              label: course.price_text,
              accent: "green",
            }
          : null,
        course?.seats_available != null && course?.seats_available !== ""
          ? {
              key: "seats",
              icon: "people-outline",
              label: `${course.seats_available} plazas`,
              accent: "purple",
            }
          : null,
      ].filter(Boolean),
    [course?.price_text, course?.seats_available, course?.teaching_hours, dateLabel]
  );

  const canEditCourse = Boolean(
    currentUserId && course?.created_by_id && currentUserId === course.created_by_id
  );

  const handleRegister = useCallback(() => {
    if (course?.registration_url) {
      openURL(course.registration_url);
    }
  }, [course?.registration_url]);

  const handleDelete = useCallback(() => {
    if (!course?.id) return;

    Alert.alert(
      "Eliminar curso",
      "Esta acción eliminará el curso y no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCourse(course.id);
              onDelete?.(course.id);
            } catch (err) {
              console.error("Error deleting course:", err);
              Alert.alert("Error", "No se pudo eliminar el curso.");
            }
          },
        },
      ]
    );
  }, [course?.id, onDelete]);

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.stateText}>Cargando curso...</Text>
      </View>
    );
  }

  if (error || !course) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.stateIconWrap}>
          <Ionicons name="alert-circle-outline" size={32} color={DANGER} />
        </View>
        <Text style={styles.stateTitle}>{error || "Curso no encontrado"}</Text>
        <Text style={styles.stateText}>
          Revisa el identificador o vuelve al listado para seguir explorando.
        </Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Volver a cursos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 32, 40) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: Math.max(insets.top + 8, 20) }]}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topBarButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {canEditCourse ? (
              <View style={styles.topBarActions}>
                {onEdit ? (
                  <TouchableOpacity
                    style={styles.topBarGhostButton}
                    onPress={() => onEdit(course.id)}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.topBarGhostText}>Editar</Text>
                  </TouchableOpacity>
                ) : null}
                {onDelete ? (
                  <TouchableOpacity
                    style={styles.topBarGhostButton}
                    onPress={handleDelete}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.topBarSpacer} />
            )}
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Ionicons name="school-outline" size={16} color={PRIMARY} />
              <Text style={styles.heroBadgeText}>Curso</Text>
            </View>

            <Text style={styles.heroTitle}>{course.title}</Text>

            {course.organization ? (
              <Text style={styles.heroSubtitle}>{course.organization}</Text>
            ) : null}

            <View style={styles.heroMeta}>
              {course.hospital?.name ? (
                <View style={styles.heroMetaRow}>
                  <Ionicons name="business-outline" size={16} color={MUTED} />
                  <Text style={styles.heroMetaText}>
                    {course.hospital.name}
                    {course.hospital.city ? ` · ${course.hospital.city}` : ""}
                  </Text>
                </View>
              ) : null}

              {course.venue_name ? (
                <View style={styles.heroMetaRow}>
                  <Ionicons name="location-outline" size={16} color={MUTED} />
                  <Text style={styles.heroMetaText}>{course.venue_name}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.quickStats}>
              {quickStats.map((item) => (
                <InfoPill
                  key={item.key}
                  icon={item.icon}
                  text={item.label}
                  accent={item.accent}
                />
              ))}
            </View>

            {course.registration_url ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRegister}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonText}>Ir a inscripción</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>
          {sortedDates.length > 1 ? (
            <SectionCard title="Calendario">
              {sortedDates.map((date) => (
                <View key={date} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <Text style={styles.timelineText}>{formatShortDate(date)}</Text>
                </View>
              ))}
            </SectionCard>
          ) : null}

          {course.venue_name || course.venue_address ? (
            <SectionCard title="Ubicación">
              {course.venue_name ? (
                <Text style={styles.cardTitle}>{course.venue_name}</Text>
              ) : null}
              {course.venue_address ? (
                <Text style={styles.cardBody}>{course.venue_address}</Text>
              ) : null}
            </SectionCard>
          ) : null}

          {course.speciality || course.course_code || course.course_directors ? (
            <SectionCard title="Datos del curso">
              {course.speciality ? (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Especialidad</Text>
                  <Text style={styles.dataValue}>{course.speciality.name}</Text>
                </View>
              ) : null}
              {course.course_code ? (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Código</Text>
                  <Text style={styles.dataValue}>{course.course_code}</Text>
                </View>
              ) : null}
              {course.course_directors ? (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Dirección</Text>
                  <Text style={styles.dataValue}>{course.course_directors}</Text>
                </View>
              ) : null}
            </SectionCard>
          ) : null}

          {course.objectives ? (
            <SectionCard title="Objetivos">
              <Text style={styles.cardBody}>{course.objectives}</Text>
            </SectionCard>
          ) : null}

          {course.more_info ? (
            <SectionCard title="Más información">
              <Text style={styles.cardBody}>{course.more_info}</Text>
            </SectionCard>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: BG_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  stateText: {
    marginTop: 10,
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
  },
  secondaryButton: {
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}24`,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  hero: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  topBarButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBarGhostButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  topBarGhostText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  topBarSpacer: {
    width: 42,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}12`,
  },
  heroBadgeText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 31,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
  },
  heroMeta: {
    gap: 10,
    marginTop: 18,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroMetaText: {
    flex: 1,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  quickStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  infoPillPurple: {
    backgroundColor: `${PRIMARY}10`,
  },
  infoPillGreen: {
    backgroundColor: `${SECONDARY}12`,
  },
  infoPillBlue: {
    backgroundColor: "#DBEAFE",
  },
  infoPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  infoPillTextPurple: {
    color: PRIMARY,
  },
  infoPillTextGreen: {
    color: SECONDARY,
  },
  infoPillTextBlue: {
    color: "#2563EB",
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: PRIMARY,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
  timelineText: {
    fontSize: 15,
    color: ACCENT,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 15,
    color: MUTED,
    lineHeight: 23,
  },
  dataRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED_LIGHT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
    lineHeight: 22,
  },
});
