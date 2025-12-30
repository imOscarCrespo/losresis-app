import React, { useMemo, memo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReviews } from "../hooks/useReviews";
import { useHospitals } from "../hooks/useHospitals";
import { Filters } from "../components/Filters";
import { ScreenHeader } from "../components/ScreenHeader";
import { prepareHospitalOptions } from "../utils/profileOptions";
import { formatShortDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Card de resumen de reseña
 * Memoizado para evitar re-renders innecesarios
 */
const ReviewSummaryCard = memo(({ summary, onPress }) => {
  if (!summary) return null;

  return (
    <TouchableOpacity
      style={styles.reviewCard}
      onPress={() => onPress(summary)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name="business" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.hospitalName} numberOfLines={1}>
            {summary.hospital_name}
          </Text>
        </View>
      </View>

      <Text style={styles.locationText} numberOfLines={1}>
        {summary.hospital_city} • {summary.hospital_region}
      </Text>

      <View style={styles.specialtyRow}>
        <Ionicons name="school" size={16} color={COLORS.PURPLE} />
        <Text style={styles.specialtyText} numberOfLines={1}>
          {summary.speciality_name}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          {formatShortDate(summary.latest_review_date)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

ReviewSummaryCard.displayName = "ReviewSummaryCard";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Pantalla de listado de reseñas
 */
export default function ReviewsScreen({
  onSectionChange,
  currentSection,
  userProfile,
}) {
  const {
    reviewSummaries,
    loading,
    error,
    selectedHospital,
    setSelectedHospital,
    selectedSpecialty,
    setSelectedSpecialty,
    hospitalSearchTerm,
    setHospitalSearchTerm,
    clearFilters,
  } = useReviews();

  const { hospitals, specialties } = useHospitals();

  // Preparar opciones para los selectores
  const hospitalOptions = useMemo(() => {
    const prepared = prepareHospitalOptions(hospitals);
    // Añadir opción "Todos los hospitales"
    return [{ id: "", name: "Todos los hospitales" }, ...prepared];
  }, [hospitals]);

  const specialtyOptions = useMemo(() => {
    const sorted = specialties
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((specialty) => ({
        id: specialty.id,
        name: specialty.name,
      }));
    // Añadir opción "Todas las especialidades"
    return [{ id: "", name: "Todas las especialidades" }, ...sorted];
  }, [specialties]);

  // Configurar los filtros para el componente genérico
  const filtersConfig = useMemo(() => {
    return [
      {
        id: "search",
        type: "search",
        label: "Buscar por nombre de hospital",
        value: hospitalSearchTerm,
        onChange: setHospitalSearchTerm,
        placeholder: "Hospital Universitario...",
      },
      {
        id: "hospital",
        type: "select",
        label: "Hospital",
        value: selectedHospital,
        onSelect: setSelectedHospital,
        options: hospitalOptions,
        placeholder: "Seleccionar hospital",
      },
      {
        id: "specialty",
        type: "select",
        label: "Especialidad",
        value: selectedSpecialty,
        onSelect: setSelectedSpecialty,
        options: specialtyOptions,
        placeholder: "Seleccionar especialidad",
      },
    ];
  }, [
    hospitalSearchTerm,
    selectedHospital,
    selectedSpecialty,
    hospitalOptions,
    specialtyOptions,
  ]);

  // Verificar si hay filtros activos
  const hasActiveFilters = useMemo(() => {
    return !!(hospitalSearchTerm || selectedHospital || selectedSpecialty);
  }, [hospitalSearchTerm, selectedHospital, selectedSpecialty]);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("ReviewsScreen");
  }, []);

  const handleReviewPress = (summary) => {
    if (onSectionChange && summary.review_id) {
      // Navegar al detalle de la reseña pasando el reviewId como parámetro
      onSectionChange("reviewDetail", { reviewId: summary.review_id });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        title="Reseñas"
        subtitle={`Mostrando ${reviewSummaries.length} reseñas`}
        notificationCount={0}
        onNotificationPress={() => {
          // TODO: Implementar navegación a notificaciones
        }}
      />

      {/* Filtros genéricos */}
      <Filters
        filters={filtersConfig}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando reseñas...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.GRAY} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : reviewSummaries.length === 0 ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.emptyContentContainer}
        >
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={64}
              color={COLORS.GRAY}
            />
            <Text style={styles.emptyTitle}>
              Aún no hay reseñas disponibles
            </Text>
            <Text style={styles.emptySubtitle}>
              Estamos trabajando para que los residentes compartan sus
              experiencias, aunque nos está costando llegar a toda la comunidad.
            </Text>
            <Text style={styles.emptySubtitle}>
              ¿Nos ayudas compartiendo la aplicación? Tu apoyo nos ayuda a
              generar más ruido entre la comunidad médica y conseguir más
              reseñas.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          {reviewSummaries.map((summary) => (
            <ReviewSummaryCard
              key={`${summary.hospital_id}-${summary.speciality_id}-${summary.review_id}`}
              summary={summary}
              onPress={handleReviewPress}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: "#666",
  },
  resultsNumber: {
    color: "#007AFF",
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
    fontSize: 16,
    color: COLORS.GRAY,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    paddingTop: 0,
    justifyContent: "space-between",
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginBottom: 12,
  },
  specialtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  specialtyText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_LIGHT,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
});
