import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS } from "../constants/colors";
import { useLectures } from "../hooks/useLectures";
import { useHospitals } from "../hooks/useHospitals";
import { ScreenHeader } from "../components/ScreenHeader";
import { Filters } from "../components/Filters";
import { CourseCard } from "../components/CourseCard";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { SelectFilter } from "../components/SelectFilter";
import { filterCoursesBySearch } from "../utils/courseUtils";
import { formatShortDate } from "../utils/dateUtils";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla de Cursos y Formaciones
 */
export const LecturesScreen = ({ userProfile, navigation }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    courses,
    loading,
    error,
    hasMore,
    totalCount,
    setFilters,
    clearFilters,
    loadMoreCourses,
    createCourse,
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

  // Handle course card press (navigate to detail)
  const handleCoursePress = useCallback(
    (course) => {
      if (navigation?.navigate) {
        navigation.navigate("courseDetail", { courseId: course.id });
      }
    },
    [navigation]
  );

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    event_dates: [],
    teaching_hours: "",
    price_text: "",
    course_directors: "",
    organization: "",
    venue_name: "",
    venue_address: "",
    seats_available: "",
    course_code: "",
    more_info: "",
    objectives: "",
    registration_url: "",
    hospital_id: "",
    speciality_id: "",
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState(null);
  const [tempSelectedDate, setTempSelectedDate] = useState(null);

  // Handle add course modal
  const handleOpenAddModal = useCallback(() => {
    setShowAddModal(true);
    setFormError("");
    setFormData({
      title: "",
      event_dates: [],
      teaching_hours: "",
      price_text: "",
      course_directors: "",
      organization: "",
      venue_name: "",
      venue_address: "",
      seats_available: "",
      course_code: "",
      more_info: "",
      objectives: "",
      registration_url: "",
      hospital_id: "",
      speciality_id: "",
    });
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setFormError("");
    setSelectedDateIndex(null);
    setTempSelectedDate(null);
    setShowDatePicker(false);
  }, []);

  // Handle date selection
  const handleAddDate = useCallback(() => {
    // Cerrar el teclado antes de abrir el date picker
    Keyboard.dismiss();
    setSelectedDateIndex(formData.event_dates.length);
    const defaultDate =
      formData.event_dates.length > 0
        ? new Date(
            formData.event_dates[formData.event_dates.length - 1] + "T00:00:00"
          )
        : new Date();
    setTempSelectedDate(defaultDate);
    setShowDatePicker(true);
  }, [formData.event_dates]);

  const handleEditDate = useCallback(
    (index) => {
      // Cerrar el teclado antes de abrir el date picker
      Keyboard.dismiss();
      setSelectedDateIndex(index);
      const existingDate = new Date(formData.event_dates[index] + "T00:00:00");
      setTempSelectedDate(existingDate);
      setShowDatePicker(true);
    },
    [formData.event_dates]
  );

  const handleRemoveDate = useCallback(
    (index) => {
      const newDates = formData.event_dates.filter((_, i) => i !== index);
      setFormData({ ...formData, event_dates: newDates });
    },
    [formData]
  );

  const handleConfirmDate = useCallback(() => {
    if (!tempSelectedDate) return;

    const year = tempSelectedDate.getFullYear();
    const month = String(tempSelectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(tempSelectedDate.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;

    const newDates = [...formData.event_dates];
    if (selectedDateIndex !== null && selectedDateIndex < newDates.length) {
      newDates[selectedDateIndex] = dateString;
    } else {
      newDates.push(dateString);
    }

    setFormData({ ...formData, event_dates: newDates.sort() });
    setShowDatePicker(false);
    setSelectedDateIndex(null);
    setTempSelectedDate(null);
  }, [formData, selectedDateIndex, tempSelectedDate]);

  const handleDateChange = useCallback(
    (event, selectedDate) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }

      if (event.type === "set" && selectedDate) {
        if (Platform.OS === "ios") {
          setTempSelectedDate(selectedDate);
        } else {
          const year = selectedDate.getFullYear();
          const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
          const day = String(selectedDate.getDate()).padStart(2, "0");
          const dateString = `${year}-${month}-${day}`;

          const newDates = [...formData.event_dates];
          if (
            selectedDateIndex !== null &&
            selectedDateIndex < newDates.length
          ) {
            newDates[selectedDateIndex] = dateString;
          } else {
            newDates.push(dateString);
          }

          setFormData({ ...formData, event_dates: newDates.sort() });
          setSelectedDateIndex(null);
        }
      } else if (event.type === "dismissed") {
        setShowDatePicker(false);
        setSelectedDateIndex(null);
        setTempSelectedDate(null);
      }
    },
    [formData, selectedDateIndex]
  );

  // Handle submit course
  const handleSubmitCourse = useCallback(async () => {
    // Validation
    if (!formData.title.trim()) {
      setFormError("El título es obligatorio");
      return;
    }

    if (!formData.event_dates || formData.event_dates.length === 0) {
      setFormError("Debes añadir al menos una fecha");
      return;
    }

    setFormError("");

    try {
      const courseData = {
        title: formData.title.trim(),
        event_dates: formData.event_dates,
        teaching_hours: formData.teaching_hours.trim() || null,
        price_text: formData.price_text.trim() || null,
        course_directors: formData.course_directors.trim() || null,
        organization: formData.organization.trim() || null,
        venue_name: formData.venue_name.trim() || null,
        venue_address: formData.venue_address.trim() || null,
        seats_available: formData.seats_available.trim() || null,
        course_code: formData.course_code.trim() || null,
        more_info: formData.more_info.trim() || null,
        objectives: formData.objectives.trim() || null,
        registration_url: formData.registration_url.trim() || null,
        hospital_id: formData.hospital_id || null,
        speciality_id: formData.speciality_id || null,
      };

      await createCourse(courseData);
      handleCloseAddModal();
    } catch (err) {
      console.error("Error creating course:", err);
      setFormError("Error al crear el curso. Intenta de nuevo.");
    }
  }, [formData, createCourse, handleCloseAddModal]);

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

      {/* Floating Action Button */}
      {/* <FloatingActionButton
        onPress={handleOpenAddModal}
        icon="add"
        backgroundColor={COLORS.PRIMARY}
        bottom={20}
        right={20}
      /> */}

      {/* Modal para añadir curso */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={handleCloseAddModal}
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo Curso</Text>
            <TouchableOpacity
              onPress={handleCloseAddModal}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {formError && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          )}

          {/* Form */}
          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Título (requerido) */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>
                Título del curso <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={formData.title}
                onChangeText={(text) =>
                  setFormData({ ...formData, title: text })
                }
                placeholder="Ej: Curso de Radiología Avanzada"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            {/* Fechas (requerido) */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>
                Fechas del curso <Text style={styles.required}>*</Text>
              </Text>
              {formData.event_dates.length > 0 && (
                <View style={styles.datesList}>
                  {formData.event_dates.map((date, index) => (
                    <View key={index} style={styles.dateItem}>
                      <TouchableOpacity
                        onPress={() => handleEditDate(index)}
                        style={styles.dateItemContent}
                      >
                        <Ionicons
                          name="calendar"
                          size={16}
                          color={COLORS.PRIMARY}
                        />
                        <Text style={styles.dateText}>
                          {formatShortDate(date)}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveDate(index)}
                        style={styles.removeDateButton}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={COLORS.ERROR}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity
                onPress={handleAddDate}
                style={styles.addDateButton}
              >
                <Ionicons name="add-circle" size={20} color={COLORS.PRIMARY} />
                <Text style={styles.addDateButtonText}>Añadir fecha</Text>
              </TouchableOpacity>
            </View>

            {/* Organización */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Organización</Text>
              <TextInput
                style={styles.textInput}
                value={formData.organization}
                onChangeText={(text) =>
                  setFormData({ ...formData, organization: text })
                }
                placeholder="Ej: Sociedad Española de Radiología"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            {/* Hospital */}
            <View style={styles.formField}>
              <SelectFilter
                label="Hospital"
                value={formData.hospital_id}
                onSelect={(value) =>
                  setFormData({ ...formData, hospital_id: value })
                }
                options={hospitals
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((hospital) => ({
                    id: hospital.id,
                    name: hospital.name,
                  }))}
                placeholder="Seleccionar hospital (opcional)"
              />
            </View>

            {/* Especialidad */}
            <View style={styles.formField}>
              <SelectFilter
                label="Especialidad"
                value={formData.speciality_id}
                onSelect={(value) =>
                  setFormData({ ...formData, speciality_id: value })
                }
                options={specialties
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((specialty) => ({
                    id: specialty.id,
                    name: specialty.name,
                  }))}
                placeholder="Seleccionar especialidad (opcional)"
              />
            </View>

            {/* Lugar del evento */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Lugar del evento</Text>
              <TextInput
                style={styles.textInput}
                value={formData.venue_name}
                onChangeText={(text) =>
                  setFormData({ ...formData, venue_name: text })
                }
                placeholder="Nombre del lugar"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            {/* Dirección */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Dirección</Text>
              <TextInput
                style={styles.textInput}
                value={formData.venue_address}
                onChangeText={(text) =>
                  setFormData({ ...formData, venue_address: text })
                }
                placeholder="Dirección completa"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            {/* Horas lectivas */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Horas lectivas</Text>
              <TextInput
                style={styles.textInput}
                value={formData.teaching_hours}
                onChangeText={(text) =>
                  setFormData({ ...formData, teaching_hours: text })
                }
                placeholder="Ej: 40 horas"
                placeholderTextColor={COLORS.GRAY}
                keyboardType="numeric"
              />
            </View>

            {/* Precio */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Precio</Text>
              <TextInput
                style={styles.textInput}
                value={formData.price_text}
                onChangeText={(text) =>
                  setFormData({ ...formData, price_text: text })
                }
                placeholder="Ej: 500€ o Gratuito"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            {/* Plazas disponibles */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Plazas disponibles</Text>
              <TextInput
                style={styles.textInput}
                value={formData.seats_available}
                onChangeText={(text) =>
                  setFormData({ ...formData, seats_available: text })
                }
                placeholder="Número de plazas"
                placeholderTextColor={COLORS.GRAY}
                keyboardType="numeric"
              />
            </View>

            {/* Código del curso */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Código del curso</Text>
              <TextInput
                style={styles.textInput}
                value={formData.course_code}
                onChangeText={(text) =>
                  setFormData({ ...formData, course_code: text })
                }
                placeholder="Código único del curso"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            {/* Directores del curso */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Directores del curso</Text>
              <TextInput
                style={styles.textInput}
                value={formData.course_directors}
                onChangeText={(text) =>
                  setFormData({ ...formData, course_directors: text })
                }
                placeholder="Nombres de los directores"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            {/* Objetivos */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Objetivos</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.objectives}
                onChangeText={(text) =>
                  setFormData({ ...formData, objectives: text })
                }
                placeholder="Objetivos del curso..."
                placeholderTextColor={COLORS.GRAY}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Más información */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Más información</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.more_info}
                onChangeText={(text) =>
                  setFormData({ ...formData, more_info: text })
                }
                placeholder="Información adicional sobre el curso..."
                placeholderTextColor={COLORS.GRAY}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* URL de inscripción */}
            <View style={styles.formField}>
              <Text style={styles.formLabel}>URL de inscripción</Text>
              <TextInput
                style={styles.textInput}
                value={formData.registration_url}
                onChangeText={(text) =>
                  setFormData({ ...formData, registration_url: text })
                }
                placeholder="https://..."
                placeholderTextColor={COLORS.GRAY}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitCourse}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? "Creando..." : "Crear Curso"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCloseAddModal}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Date Picker Overlay - Dentro del modal del formulario */}
          {showDatePicker && (
            <View style={styles.datePickerOverlay}>
              <TouchableOpacity
                style={styles.datePickerOverlayTouchable}
                activeOpacity={1}
                onPress={() => {
                  setShowDatePicker(false);
                  setSelectedDateIndex(null);
                  setTempSelectedDate(null);
                }}
              />
              {Platform.OS === "ios" ? (
                <View style={styles.datePickerModalContainer}>
                  <View style={styles.datePickerHeader}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowDatePicker(false);
                        setSelectedDateIndex(null);
                        setTempSelectedDate(null);
                      }}
                      style={styles.datePickerCancelButton}
                    >
                      <Text style={styles.datePickerCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleConfirmDate}
                      style={styles.datePickerDoneButton}
                    >
                      <Text style={styles.datePickerDoneText}>Seleccionar</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={tempSelectedDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setTempSelectedDate(selectedDate);
                      }
                    }}
                    locale="es-ES"
                    minimumDate={new Date()}
                  />
                </View>
              ) : (
                <View style={styles.datePickerModalContainer}>
                  <View style={styles.datePickerHeader}>
                    <Text style={styles.datePickerTitle}>
                      Seleccionar fecha
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowDatePicker(false);
                        setSelectedDateIndex(null);
                        setTempSelectedDate(null);
                      }}
                      style={styles.datePickerCloseButton}
                    >
                      <Ionicons
                        name="close"
                        size={24}
                        color={COLORS.GRAY_DARK}
                      />
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={
                      selectedDateIndex !== null &&
                      formData.event_dates[selectedDateIndex]
                        ? new Date(
                            formData.event_dates[selectedDateIndex] +
                              "T00:00:00"
                          )
                        : new Date()
                    }
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    locale="es-ES"
                    minimumDate={new Date()}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  closeButton: {
    padding: 4,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.ERROR + "15",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.ERROR + "30",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ERROR,
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  required: {
    color: COLORS.ERROR,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    backgroundColor: COLORS.WHITE,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  datesList: {
    marginBottom: 12,
    gap: 8,
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.PRIMARY + "15",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "30",
  },
  dateItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.GRAY_DARK,
  },
  removeDateButton: {
    padding: 4,
  },
  addDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.PRIMARY + "15",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "30",
    borderStyle: "dashed",
  },
  addDateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  submitButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  datePickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
    elevation: 1000, // Para Android
  },
  datePickerOverlayTouchable: {
    flex: 1,
  },
  datePickerModalContainer: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "50%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  datePickerCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  datePickerCancelText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    fontWeight: "600",
  },
  datePickerCloseButton: {
    padding: 4,
  },
  datePickerDoneButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  datePickerDoneText: {
    fontSize: 16,
    color: COLORS.WHITE,
    fontWeight: "600",
  },
});

export default LecturesScreen;
