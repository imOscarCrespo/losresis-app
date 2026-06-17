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
import { Icon } from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  deleteCourse,
  getCourseById,
  toggleCourseLike,
} from "../services/lectureService";
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
      <Icon
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

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Icon name={icon} size={15} color={PRIMARY} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
  const [favoriteLoading, setFavoriteLoading] = useState(false);

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
        const fetchedCourse = await getCourseById(courseId, currentUserId);
        setCourse(fetchedCourse);
      } catch (err) {
        console.error("Error fetching course:", err);
        setError("No se pudo cargar el curso");
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseId, currentUserId]);

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

  const handleToggleFavorite = useCallback(async () => {
    if (!course?.id || favoriteLoading) {
      return;
    }

    if (!currentUserId) {
      Alert.alert(
        "Inicia sesión",
        "Necesitas haber iniciado sesión para guardar cursos."
      );
      return;
    }

    try {
      setFavoriteLoading(true);
      const liked = await toggleCourseLike(currentUserId, course.id);
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              is_liked: liked,
            }
          : prev
      );
    } catch (err) {
      console.error("Error toggling course like:", err);
      Alert.alert("Error", "No se pudo guardar el curso.");
    } finally {
      setFavoriteLoading(false);
    }
  }, [course?.id, currentUserId, favoriteLoading]);

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
          <Icon name="alert-circle-outline" size={32} color={DANGER} />
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
    <HeroScreenLayout
      title="Cursos"
      onBack={onBack}
      rightSlot={
        canEditCourse ? (
          <View style={styles.headerActions}>
            {onEdit ? (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => onEdit(course.id)}
                activeOpacity={0.7}
              >
                <Icon name="pencil-outline" size={18} color="#670CF5" />
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                style={[styles.headerIconButton, styles.headerDangerButton]}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Icon name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null
      }
    >
        <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 32, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Icon name="school-outline" size={16} color={PRIMARY} />
              <Text style={styles.heroBadgeText}>Curso</Text>
            </View>
            {course.is_liked ? (
              <View style={styles.savedBadge}>
                <Icon name="heart" size={14} color={SECONDARY} />
                <Text style={styles.savedBadgeText}>Guardado</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroTitle}>{course.title}</Text>

          {course.organization ? (
            <Text style={styles.heroSubtitle}>{course.organization}</Text>
          ) : null}

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

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.favoriteButton,
                course.is_liked && styles.favoriteButtonActive,
                favoriteLoading && styles.favoriteButtonDisabled,
              ]}
              onPress={handleToggleFavorite}
              activeOpacity={0.88}
              disabled={favoriteLoading}
            >
              <Icon
                name={course.is_liked ? "heart" : "heart-outline"}
                size={18}
                color={course.is_liked ? "#FFFFFF" : PRIMARY}
              />
              <Text
                style={[
                  styles.favoriteButtonText,
                  course.is_liked && styles.favoriteButtonTextActive,
                ]}
              >
                {course.is_liked ? "En mis cursos" : "Guardar"}
              </Text>
            </TouchableOpacity>

            {course.registration_url ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRegister}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonText}>Inscribirme</Text>
                <Icon name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>
          {(course.hospital?.name || course.venue_name || course.venue_address) && (
            <SectionCard title="Dónde se imparte">
              {course.hospital?.name ? (
                <InfoRow
                  icon="business-outline"
                  label="Hospital"
                  value={`${course.hospital.name}${
                    course.hospital.city ? ` · ${course.hospital.city}` : ""
                  }`}
                />
              ) : null}
              {course.venue_name ? (
                <InfoRow icon="location-outline" label="Sede" value={course.venue_name} />
              ) : null}
              {course.venue_address ? (
                <InfoRow
                  icon="navigate-outline"
                  label="Dirección"
                  value={course.venue_address}
                />
              ) : null}
            </SectionCard>
          )}

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

          {course.speciality || course.course_code || course.course_directors ? (
            <SectionCard title="Ficha del curso">
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

          {course.registration_url ? (
            <SectionCard title="Inscripción">
              <Text style={styles.cardBody}>
                Accede al enlace oficial para revisar plazas, requisitos y el
                formulario de inscripción.
              </Text>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={handleRegister}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionText}>Abrir enlace</Text>
                <Icon name="open-outline" size={16} color={PRIMARY} />
              </TouchableOpacity>
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
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(103,12,245,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerDangerButton: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginTop: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${SECONDARY}14`,
  },
  savedBadgeText: {
    color: SECONDARY,
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
  quickStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
    alignItems: "flex-start",
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "100%",
    flexShrink: 1,
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
    flexShrink: 1,
    lineHeight: 18,
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
  actionsRow: {
    marginTop: 18,
    gap: 12,
  },
  favoriteButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${PRIMARY}24`,
    backgroundColor: `${PRIMARY}08`,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  favoriteButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  favoriteButtonDisabled: {
    opacity: 0.7,
  },
  favoriteButtonText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  favoriteButtonTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
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
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: {
    flex: 1,
    gap: 3,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED_LIGHT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    lineHeight: 22,
    color: ACCENT,
    fontWeight: "600",
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
  secondaryAction: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}10`,
    borderWidth: 1,
    borderColor: `${PRIMARY}18`,
  },
  secondaryActionText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
});
