import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCourseById } from "../services/lectureService";
import { formatShortDate, formatDateOnly } from "../utils/dateUtils";
import { isCourseUpcoming, openURL } from "../utils/courseUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla de detalle de curso
 */
export default function CourseDetailScreen({ courseId, onBack, userProfile }) {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("CourseDetailScreen", { courseId });
  }, [courseId]);

  // Cargar curso al montar
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

  // Formatear rango de fechas
  const formatDateRange = () => {
    if (!course?.event_dates || course.event_dates.length === 0) return "";

    if (course.event_dates.length === 1) {
      return formatDateOnly(course.event_dates[0]);
    }

    const startDate = formatDateOnly(course.event_dates[0]);
    const endDate = formatDateOnly(
      course.event_dates[course.event_dates.length - 1]
    );
    return `${startDate} - ${endDate}`;
  };

  // Manejar inscripción
  const handleRegister = useCallback(() => {
    if (course?.registration_url) {
      openURL(course.registration_url);
    }
  }, [course]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.GRAY_DARK} />
            <Text style={styles.backButtonText}>Volver a Cursos</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={COLORS.ERROR} />
          <Text style={styles.errorTitle}>
            {error || "Curso no encontrado"}
          </Text>
          <Text style={styles.errorText}>
            {error
              ? "No se pudo cargar la información del curso."
              : "El curso que buscas no existe o ha sido eliminado."}
          </Text>
        </View>
      </View>
    );
  }

  const isUpcoming = isCourseUpcoming(course.event_dates);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.GRAY_DARK} />
          <Text style={styles.backButtonText}>Volver a Cursos</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Main Card */}
        <View style={[styles.mainCard, isUpcoming && styles.mainCardUpcoming]}>
          {/* Header con icono y título */}
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="school" size={32} color={COLORS.PRIMARY} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{course.title}</Text>
              {isUpcoming && (
                <View style={styles.upcomingBadge}>
                  <Text style={styles.upcomingBadgeText}>Próximo</Text>
                </View>
              )}
            </View>
          </View>

          {/* Organización */}
          {course.organization && (
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Ionicons name="business" size={20} color={COLORS.GRAY} />
                <Text style={styles.infoText}>{course.organization}</Text>
              </View>
            </View>
          )}

          {/* Fechas */}
          {course.event_dates && course.event_dates.length > 0 && (
            <View style={styles.infoSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar" size={20} color={COLORS.PRIMARY} />
                <Text style={styles.sectionTitle}>Fechas del curso</Text>
              </View>
              <Text style={styles.dateRangeText}>{formatDateRange()}</Text>
              {course.event_dates.length > 1 && (
                <Text style={styles.daysCountText}>
                  {course.event_dates.length} días de duración
                </Text>
              )}
            </View>
          )}

          {/* Información principal en grid */}
          <View style={styles.infoGrid}>
            {/* Horas lectivas */}
            {course.teaching_hours && (
              <View style={styles.infoCard}>
                <Ionicons name="time" size={24} color={COLORS.PRIMARY} />
                <Text style={styles.infoCardLabel}>Horas lectivas</Text>
                <Text style={styles.infoCardValue}>
                  {course.teaching_hours}
                </Text>
              </View>
            )}

            {/* Precio */}
            {course.price_text && (
              <View style={styles.infoCard}>
                <Ionicons name="cash" size={24} color={COLORS.SUCCESS} />
                <Text style={styles.infoCardLabel}>Precio</Text>
                <Text style={styles.infoCardValue}>{course.price_text}</Text>
              </View>
            )}

            {/* Plazas */}
            {course.seats_available && (
              <View style={styles.infoCard}>
                <Ionicons name="people" size={24} color={COLORS.PRIMARY} />
                <Text style={styles.infoCardLabel}>Plazas</Text>
                <Text style={styles.infoCardValue}>
                  {course.seats_available}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Ubicación Card */}
        {(course.venue_name || course.venue_address) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.sectionTitle}>Ubicación</Text>
            </View>
            {course.venue_name && (
              <Text style={styles.venueName}>{course.venue_name}</Text>
            )}
            {course.venue_address && (
              <Text style={styles.venueAddress}>{course.venue_address}</Text>
            )}
          </View>
        )}

        {/* Información adicional */}
        {(course.hospital || course.speciality) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="information-circle"
                size={20}
                color={COLORS.PRIMARY}
              />
              <Text style={styles.sectionTitle}>Información adicional</Text>
            </View>
            {course.hospital && (
              <View style={styles.infoRow}>
                <Ionicons name="business" size={18} color={COLORS.GRAY} />
                <Text style={styles.infoText}>
                  {course.hospital.name}
                  {course.hospital.city && ` - ${course.hospital.city}`}
                </Text>
              </View>
            )}
            {course.speciality && (
              <View style={styles.infoRow}>
                <Ionicons name="school" size={18} color={COLORS.PURPLE} />
                <Text style={[styles.infoText, styles.specialtyText]}>
                  {course.speciality.name}
                </Text>
              </View>
            )}
            {course.course_code && (
              <View style={styles.infoRow}>
                <Ionicons name="code" size={18} color={COLORS.GRAY} />
                <Text style={styles.infoText}>
                  Código: {course.course_code}
                </Text>
              </View>
            )}
            {course.course_directors && (
              <View style={styles.infoRow}>
                <Ionicons name="person" size={18} color={COLORS.GRAY} />
                <Text style={styles.infoText}>
                  Directores: {course.course_directors}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Objetivos */}
        {course.objectives && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="target" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.sectionTitle}>Objetivos</Text>
            </View>
            <Text style={styles.descriptionText}>{course.objectives}</Text>
          </View>
        )}

        {/* Más información */}
        {course.more_info && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.sectionTitle}>Más información</Text>
            </View>
            <Text style={styles.descriptionText}>{course.more_info}</Text>
          </View>
        )}

        {/* Botón de inscripción */}
        {course.registration_url && (
          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            activeOpacity={0.8}
          >
            <Ionicons name="link" size={24} color={COLORS.WHITE} />
            <Text style={styles.registerButtonText}>
              Inscribirse en el curso
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.GRAY,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  content: {
    padding: 16,
  },
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainCardUpcoming: {
    borderWidth: 2,
    borderColor: COLORS.ORANGE + "40",
    backgroundColor: COLORS.ORANGE + "08",
  },
  cardHeader: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    lineHeight: 32,
  },
  upcomingBadge: {
    backgroundColor: COLORS.ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  upcomingBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  infoSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.GRAY,
    lineHeight: 24,
  },
  specialtyText: {
    color: COLORS.PURPLE,
    fontWeight: "500",
  },
  dateRangeText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    fontWeight: "500",
    marginBottom: 4,
  },
  daysCountText: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  infoCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  infoCardLabel: {
    fontSize: 12,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  infoCardValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  venueName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  venueAddress: {
    fontSize: 16,
    color: COLORS.GRAY,
    lineHeight: 24,
  },
  descriptionText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    lineHeight: 24,
  },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
});
