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
import { Filters } from "../components/Filters";
import { CourseCard } from "../components/CourseCard";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { filterCoursesBySearch } from "../utils/courseUtils";
import {
  prepareHospitalOptions,
  prepareSpecialtyOptions,
} from "../utils/profileOptions";
import posthogLogger from "../services/posthogService";

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
    showMyCourses,
    setShowMyCourses,
    currentUserId,
  } = useLectures();

  const { hospitals, specialties } = useHospitals();

  // Tracking de pantalla con PostHog
  React.useEffect(() => {
    posthogLogger.logScreen("LecturesScreen");
  }, []);

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
    const hospitalOptions = prepareHospitalOptions(hospitals);
    const specialtyOptions = prepareSpecialtyOptions(specialties);

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

  // Handle course card press (navigate to detail)
  const handleCoursePress = useCallback(
    (course) => {
      if (navigation?.navigate) {
        navigation.navigate("courseDetail", { courseId: course.id });
      }
    },
    [navigation]
  );

  if (loading && courses.length === 0) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Cursos</Text>
              <Text style={styles.resultsText}>Cargando...</Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando cursos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Cursos</Text>
            <Text style={styles.resultsText}>
              Mostrando{" "}
              <Text style={styles.resultsNumber}>{filteredCourses.length}</Text>{" "}
              cursos disponibles
            </Text>
          </View>
          {/* Toggle Mis Cursos */}
          <TouchableOpacity
            style={[
              styles.myCoursesToggle,
              showMyCourses && styles.myCoursesToggleActive,
            ]}
            onPress={() => setShowMyCourses(!showMyCourses)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showMyCourses ? "person" : "person-outline"}
              size={18}
              color={showMyCourses ? COLORS.WHITE : COLORS.PRIMARY}
            />
            <Text
              style={[
                styles.myCoursesToggleText,
                showMyCourses && styles.myCoursesToggleTextActive,
              ]}
            >
              Mis cursos
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtros genéricos */}
      <Filters
        filters={filtersConfig}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                  isMine={
                    !!currentUserId && course.created_by_id === currentUserId
                  }
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

      {/* Floating Action Button - Crear curso */}
      <FloatingActionButton
        onPress={() => {
          if (navigation?.navigate) {
            navigation.navigate("createCourse");
          }
        }}
        icon="add"
        backgroundColor={COLORS.PRIMARY}
        bottom={20}
        right={20}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  resultsText: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  resultsNumber: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  myCoursesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.WHITE,
  },
  myCoursesToggleActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  myCoursesToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  myCoursesToggleTextActive: {
    color: COLORS.WHITE,
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
    backgroundColor: `${COLORS.ERROR}15`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${COLORS.ERROR}30`,
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
  errorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ERROR,
  },
});

export default LecturesScreen;
