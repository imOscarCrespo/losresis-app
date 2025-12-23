import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { useLectures } from "../hooks/useLectures";
import { useHospitals } from "../hooks/useHospitals";
import { ScreenHeader } from "../components/ScreenHeader";
import { InfoBanner } from "../components/InfoBanner";
import { Filters } from "../components/Filters";
import { CourseCard } from "../components/CourseCard";
import { filterCoursesBySearch } from "../utils/courseUtils";

/**
 * Pantalla de Cursos y Formaciones
 */
export const LecturesScreen = ({ userProfile, navigation }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [showAllCourses, setShowAllCourses] = useState(false);

  const {
    courses,
    loading,
    error,
    hasMore,
    totalCount,
    setFilters,
    clearFilters,
    loadMoreCourses,
  } = useLectures();

  const { hospitals, specialties } = useHospitals();

  // Update filters when selections change
  React.useEffect(() => {
    setFilters({
      hospital_id: selectedHospital,
      speciality_id: selectedSpecialty,
    });
  }, [selectedHospital, selectedSpecialty, setFilters]);

  // Filter courses by search term
  const filteredCourses = useMemo(
    () => filterCoursesBySearch(courses, searchTerm),
    [courses, searchTerm]
  );

  // Displayed courses (with "show more" logic)
  const displayedCourses = useMemo(
    () => (showAllCourses ? filteredCourses : filteredCourses.slice(0, 20)),
    [showAllCourses, filteredCourses]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedHospital("");
    setSelectedSpecialty("");
    clearFilters();
  }, [clearFilters]);

  // Configurar filtros para el componente genérico
  const filtersConfig = useMemo(() => {
    const hospitalOptions = hospitals
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((hospital) => ({
        id: hospital.id,
        name: hospital.name,
      }));

    const specialtyOptions = specialties
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((specialty) => ({
        id: specialty.id,
        name: specialty.name,
      }));

    return [
      {
        id: "search",
        type: "search",
        label: "Buscar por título o contenido",
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Curso de radiología...",
      },
      {
        id: "hospital",
        type: "select",
        label: "Filtrar por hospital",
        value: selectedHospital,
        onSelect: setSelectedHospital,
        options: hospitalOptions,
        placeholder: "Todos los hospitales",
      },
      {
        id: "specialty",
        type: "select",
        label: "Filtrar por especialidad",
        value: selectedSpecialty,
        onSelect: setSelectedSpecialty,
        options: specialtyOptions,
        placeholder: "Todas las especialidades",
      },
    ];
  }, [searchTerm, selectedHospital, selectedSpecialty, hospitals, specialties]);

  const hasActiveFilters = useMemo(() => {
    return !!(searchTerm || selectedHospital || selectedSpecialty);
  }, [searchTerm, selectedHospital, selectedSpecialty]);

  // Handle course card press (for future navigation to detail)
  const handleCoursePress = useCallback((course) => {
    // TODO: Navigate to course detail screen
    console.log("Course pressed:", course.id);
  }, []);

  if (loading && courses.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Cursos y Formaciones"
          subtitle="Cargando..."
          notificationCount={0}
          onNotificationPress={() => {}}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando cursos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Cursos y Formaciones"
        subtitle={`${filteredCourses.length} cursos disponibles`}
        notificationCount={0}
        onNotificationPress={() => {}}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filtros genéricos */}
        <Filters
          filters={filtersConfig}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Error Message */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Courses Grid */}
        {filteredCourses.length > 0 ? (
          <>
            <View style={styles.coursesGrid}>
              {displayedCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onPress={() => handleCoursePress(course)}
                />
              ))}
            </View>

            {/* Show More Button */}
            {!showAllCourses &&
              filteredCourses.length > displayedCourses.length && (
                <View style={styles.showMoreContainer}>
                  <TouchableOpacity
                    onPress={() => setShowAllCourses(true)}
                    style={styles.showMoreButton}
                  >
                    <Text style={styles.showMoreButtonText}>
                      Mostrar todos los cursos (
                      {filteredCourses.length - displayedCourses.length} más)
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.showMoreSubtext}>
                    Mostrando {displayedCourses.length} de{" "}
                    {filteredCourses.length} cursos
                  </Text>
                </View>
              )}

            {/* Load More from API */}
            {hasMore && showAllCourses && (
              <View style={styles.loadMoreContainer}>
                <TouchableOpacity
                  onPress={loadMoreCourses}
                  disabled={loading}
                  style={styles.loadMoreButton}
                >
                  <Text style={styles.loadMoreButtonText}>
                    {loading ? "Cargando..." : "Cargar más cursos"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="school-outline" size={64} color={COLORS.GRAY} />
            </View>
            <Text style={styles.emptyStateTitle}>No se encontraron cursos</Text>
            <Text style={styles.emptyStateText}>
              Intenta ajustar los filtros para encontrar más resultados
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity
                onPress={handleClearFilters}
                style={styles.emptyStateClearButton}
              >
                <Text style={styles.emptyStateClearButtonText}>
                  Limpiar filtros
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.ERROR + "15",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.ERROR + "30",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ERROR,
  },
  coursesGrid: {
    gap: 16,
  },
  showMoreContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  showMoreButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  showMoreButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  showMoreSubtext: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 8,
  },
  loadMoreContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  loadMoreButton: {
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  loadMoreButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: "center",
    marginBottom: 24,
  },
  emptyStateClearButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyStateClearButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
});

export default LecturesScreen;
