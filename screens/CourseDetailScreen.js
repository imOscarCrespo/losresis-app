import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCourseById, deleteCourse } from "../services/lectureService";
import { getCurrentUser } from "../services/authService";
import { formatShortDate, formatDateOnly } from "../utils/dateUtils";
import { openURL } from "../utils/courseUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla de detalle de curso.
 * Muestra solo los bloques con datos; los opcionales se ocultan si no existen.
 */
export default function CourseDetailScreen({
  courseId,
  onBack,
  onEdit,
  onDelete,
  userProfile,
}) {
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
        if (success && user) setCurrentUserId(user.id);
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
        setError("Error al cargar el curso");
      } finally {
        setLoading(false);
      }
    };
    loadCourse();
  }, [courseId]);

  const formatDateRange = () => {
    if (!course?.event_dates || course.event_dates.length === 0) return "";
    if (course.event_dates.length === 1) {
      return formatDateOnly(course.event_dates[0]);
    }
    const start = formatDateOnly(course.event_dates[0]);
    const end = formatDateOnly(course.event_dates[course.event_dates.length - 1]);
    return `${start} – ${end}`;
  };

  const handleRegister = useCallback(() => {
    if (course?.registration_url) openURL(course.registration_url);
  }, [course]);

  const handleEdit = useCallback(() => {
    if (onEdit && course?.id) onEdit(course.id);
  }, [onEdit, course?.id]);

  const handleDelete = useCallback(() => {
    if (!course?.id) return;
    Alert.alert(
      "Eliminar curso",
      "¿Estás seguro de que quieres eliminar este curso? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCourse(course.id);
              if (onDelete) onDelete(course.id);
            } catch (err) {
              console.error("Error deleting course:", err);
              Alert.alert("Error", "No se pudo eliminar el curso.");
            }
          },
        },
      ]
    );
  }, [course?.id, onDelete]);

  const canEditCourse =
    currentUserId &&
    course?.created_by_id &&
    course.created_by_id === currentUserId;
  const hasLocation = course?.venue_name || course?.venue_address;
  const hasCourseMeta =
    course?.hospital ||
    course?.speciality ||
    course?.course_code ||
    course?.course_directors;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={COLORS.GRAY_DARK} />
            <Text style={styles.backButtonText}>Volver a Cursos</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando curso...</Text>
        </View>
      </View>
    );
  }

  if (error || !course) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={COLORS.GRAY_DARK} />
            <Text style={styles.backButtonText}>Volver a Cursos</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={56} color={COLORS.ERROR} />
          <Text style={styles.errorTitle}>{error || "Curso no encontrado"}</Text>
          <Text style={styles.errorText}>
            {error
              ? "No se pudo cargar la información del curso."
              : "El curso que buscas no existe o ha sido eliminado."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header fijo */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.GRAY_DARK} />
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
        {canEditCourse && (onEdit || onDelete) && (
          <View style={styles.headerActions}>
            {onEdit && (
              <TouchableOpacity onPress={handleEdit} style={styles.headerActionButton} activeOpacity={0.7}>
                <Ionicons name="pencil-outline" size={20} color={COLORS.PRIMARY} />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.headerActionButton}
                activeOpacity={0.7}
                accessibilityLabel="Eliminar curso"
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.ERROR} />
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.content}>
        {/* Bloque principal: título y organización */}
        <View style={styles.heroCard}>
          <Text style={styles.title}>{course.title}</Text>
          {course.organization ? (
            <Text style={styles.organization}>{course.organization}</Text>
          ) : null}
        </View>

        {/* Resumen: fechas (siempre) + duración, precio, plazas (si existen) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Resumen</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.PRIMARY} />
              <Text style={styles.summaryValue}>{formatDateRange()}</Text>
              {course.event_dates?.length > 1 && (
                <Text style={styles.summaryHint}>
                  {course.event_dates.length} días
                </Text>
              )}
            </View>
            {course.teaching_hours ? (
              <View style={styles.summaryItem}>
                <Ionicons name="time-outline" size={18} color={COLORS.GRAY} />
                <Text style={styles.summaryValue}>{course.teaching_hours}</Text>
              </View>
            ) : null}
            {course.price_text ? (
              <View style={[styles.summaryItem, styles.summaryItemHighlight]}>
                <Ionicons name="cash-outline" size={18} color={COLORS.SUCCESS} />
                <Text style={[styles.summaryValue, styles.summaryValuePrice]}>
                  {course.price_text}
                </Text>
              </View>
            ) : null}
            {course.seats_available != null && course.seats_available !== "" ? (
              <View style={styles.summaryItem}>
                <Ionicons name="people-outline" size={18} color={COLORS.GRAY} />
                <Text style={styles.summaryValue}>
                  {course.seats_available} plazas
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Ubicación (solo si hay datos) */}
        {hasLocation && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ubicación</Text>
            <View style={styles.card}>
              {course.venue_name ? (
                <Text style={styles.venueName}>{course.venue_name}</Text>
              ) : null}
              {course.venue_address ? (
                <Text style={styles.venueAddress}>{course.venue_address}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Datos del curso: hospital, especialidad, código, directores (solo si hay alguno) */}
        {hasCourseMeta && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Datos del curso</Text>
            <View style={styles.card}>
              {course.hospital && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Hospital</Text>
                  <Text style={styles.dataValue}>
                    {course.hospital.name}
                    {course.hospital.city ? ` · ${course.hospital.city}` : ""}
                  </Text>
                </View>
              )}
              {course.speciality && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Especialidad</Text>
                  <Text style={[styles.dataValue, styles.dataValueSpecialty]}>
                    {course.speciality.name}
                  </Text>
                </View>
              )}
              {course.course_code && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Código</Text>
                  <Text style={styles.dataValue}>{course.course_code}</Text>
                </View>
              )}
              {course.course_directors && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Directores</Text>
                  <Text style={styles.dataValue}>{course.course_directors}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Objetivos (solo si hay) */}
        {course.objectives ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Objetivos</Text>
            <View style={styles.card}>
              <Text style={styles.bodyText}>{course.objectives}</Text>
            </View>
          </View>
        ) : null}

        {/* Más información (solo si hay) */}
        {course.more_info ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Más información</Text>
            <View style={styles.card}>
              <Text style={styles.bodyText}>{course.more_info}</Text>
            </View>
          </View>
        ) : null}

        {/* CTA inscripción (solo si hay URL) */}
        {course.registration_url ? (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleRegister}
            activeOpacity={0.85}
          >
            <Ionicons name="link" size={22} color={COLORS.WHITE} />
            <Text style={styles.ctaButtonText}>Inscribirse en el curso</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.bottomSpacer} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.BORDER,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  headerActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  editButtonText: {
    fontSize: 15,
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  deleteButtonText: {
    fontSize: 15,
    color: COLORS.ERROR,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.GRAY,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    lineHeight: 20,
  },
  content: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  heroCardUpcoming: {
    borderColor: COLORS.ORANGE + "50",
    backgroundColor: COLORS.ORANGE + "08",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    lineHeight: 28,
    marginBottom: 6,
  },
  organization: {
    fontSize: 15,
    color: COLORS.GRAY,
    lineHeight: 22,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.GRAY,
    letterSpacing: 0.3,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.WHITE,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    minWidth: 0,
  },
  summaryItemHighlight: {
    borderColor: COLORS.SUCCESS + "40",
    backgroundColor: COLORS.SUCCESS_LIGHT + "40",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  summaryValuePrice: {
    color: COLORS.SUCCESS,
  },
  summaryHint: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginLeft: 2,
  },
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  venueName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  venueAddress: {
    fontSize: 15,
    color: COLORS.GRAY,
    lineHeight: 22,
  },
  dataRow: {
    marginBottom: 12,
  },
  dataLabel: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dataValue: {
    fontSize: 15,
    color: COLORS.GRAY_DARK,
    fontWeight: "500",
    lineHeight: 22,
  },
  dataValueSpecialty: {
    color: COLORS.PURPLE,
  },
  bodyText: {
    fontSize: 15,
    color: COLORS.GRAY_DARK,
    lineHeight: 24,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  bottomSpacer: {
    height: 24,
  },
});
