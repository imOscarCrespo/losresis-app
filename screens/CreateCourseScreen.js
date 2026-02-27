import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SelectFilter } from "../components/SelectFilter";
import {
  KeyboardDismissAccessory,
  KEYBOARD_DISMISS_ACCESSORY_ID,
  KEYBOARD_DISMISS_ACCESSORY_ID_2,
} from "../components/KeyboardDismissAccessory";
import { useHospitals } from "../hooks/useHospitals";
import {
  prepareHospitalOptions,
  prepareSpecialtyOptions,
} from "../utils/profileOptions";
import {
  getCourseById,
  createCourse,
  updateCourse,
} from "../services/lectureService";
import { getCachedUserId } from "../services/authService";
import { formatShortDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

const initialFormData = {
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
};

/**
 * Pantalla para crear o editar un curso
 * @param {string} courseId - ID del curso a editar (opcional)
 */
export default function CreateCourseScreen({
  courseId,
  onBack,
  onSuccess,
  userProfile,
}) {
  const isEditMode = !!courseId;
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(isEditMode);
  const [error, setError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState(null);
  const [tempSelectedDate, setTempSelectedDate] = useState(null);

  const { hospitals, specialties } = useHospitals();

  useEffect(() => {
    const name = isEditMode
      ? "CreateCourseScreen_Edit"
      : "CreateCourseScreen_Create";
    posthogLogger.logScreen(name, { courseId, isEditMode });
  }, [isEditMode, courseId]);

  useEffect(() => {
    if (isEditMode && courseId) {
      const load = async () => {
        try {
          setLoadingCourse(true);
          const course = await getCourseById(courseId);
          setFormData({
            title: course.title || "",
            event_dates: Array.isArray(course.event_dates)
              ? [...course.event_dates]
              : [],
            teaching_hours: course.teaching_hours ?? "",
            price_text: course.price_text ?? "",
            course_directors: course.course_directors ?? "",
            organization: course.organization ?? "",
            venue_name: course.venue_name ?? "",
            venue_address: course.venue_address ?? "",
            seats_available:
              course.seats_available != null
                ? String(course.seats_available)
                : "",
            course_code: course.course_code ?? "",
            more_info: course.more_info ?? "",
            objectives: course.objectives ?? "",
            registration_url: course.registration_url ?? "",
            hospital_id: course.hospital_id ?? "",
            speciality_id: course.speciality_id ?? "",
          });
        } catch (err) {
          console.error("Error loading course:", err);
          setError("Error al cargar el curso");
        } finally {
          setLoadingCourse(false);
        }
      };
      load();
    }
  }, [isEditMode, courseId]);

  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  }, []);

  const handleAddDate = useCallback(() => {
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
      Keyboard.dismiss();
      setSelectedDateIndex(index);
      setTempSelectedDate(
        new Date(formData.event_dates[index] + "T00:00:00")
      );
      setShowDatePicker(true);
    },
    [formData.event_dates]
  );

  const handleRemoveDate = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      event_dates: prev.event_dates.filter((_, i) => i !== index),
    }));
  }, []);

  const handleConfirmDate = useCallback(() => {
    if (!tempSelectedDate) return;
    const y = tempSelectedDate.getFullYear();
    const m = String(tempSelectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(tempSelectedDate.getDate()).padStart(2, "0");
    const dateString = `${y}-${m}-${d}`;
    setFormData((prev) => {
      const newDates = [...prev.event_dates];
      if (
        selectedDateIndex !== null &&
        selectedDateIndex < newDates.length
      ) {
        newDates[selectedDateIndex] = dateString;
      } else {
        newDates.push(dateString);
      }
      return { ...prev, event_dates: newDates.sort() };
    });
    setShowDatePicker(false);
    setSelectedDateIndex(null);
    setTempSelectedDate(null);
  }, [selectedDateIndex, tempSelectedDate]);

  const handleDateChange = useCallback(
    (event, selectedDate) => {
      if (Platform.OS === "android") setShowDatePicker(false);
      if (event.type === "set" && selectedDate) {
        if (Platform.OS === "ios") {
          setTempSelectedDate(selectedDate);
        } else {
          const y = selectedDate.getFullYear();
          const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
          const d = String(selectedDate.getDate()).padStart(2, "0");
          const dateString = `${y}-${m}-${d}`;
          setFormData((prev) => {
            const newDates = [...prev.event_dates];
            if (
              selectedDateIndex !== null &&
              selectedDateIndex < newDates.length
            ) {
              newDates[selectedDateIndex] = dateString;
            } else {
              newDates.push(dateString);
            }
            return { ...prev, event_dates: newDates.sort() };
          });
          setSelectedDateIndex(null);
        }
      } else if (event.type === "dismissed") {
        setShowDatePicker(false);
        setSelectedDateIndex(null);
        setTempSelectedDate(null);
      }
    },
    [selectedDateIndex]
  );

  const validate = useCallback(() => {
    if (!formData.title.trim()) {
      setError("El título es obligatorio");
      return false;
    }
    if (!formData.event_dates || formData.event_dates.length === 0) {
      setError("Debes añadir al menos una fecha");
      return false;
    }
    const rawSpeciality =
      typeof formData.speciality_id === "string" && formData.speciality_id.trim();
    if (!rawSpeciality) {
      setError("La especialidad es obligatoria");
      return false;
    }
    setError("");
    return true;
  }, [formData.title, formData.event_dates, formData.speciality_id]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setLoading(true);
    setError("");

    try {
      const rawSeats = formData.seats_available.trim();
      const rawHospitalId =
        typeof formData.hospital_id === "string" &&
        formData.hospital_id.trim();
      const rawSpecialityId =
        typeof formData.speciality_id === "string" &&
        formData.speciality_id.trim();
      const createdBy = !isEditMode ? await getCachedUserId() : undefined;
      const payload = {
        ...(createdBy && { created_by_id: createdBy }),
        title: formData.title.trim(),
        event_dates: formData.event_dates,
        teaching_hours: formData.teaching_hours.trim() || null,
        price_text: formData.price_text.trim() || null,
        course_directors: formData.course_directors.trim() || null,
        organization: formData.organization.trim() || null,
        venue_name: formData.venue_name.trim() || null,
        venue_address: formData.venue_address.trim() || null,
        seats_available: rawSeats ? parseInt(rawSeats, 10) : null,
        course_code: formData.course_code.trim() || null,
        more_info: formData.more_info.trim() || null,
        objectives: formData.objectives.trim() || null,
        registration_url: formData.registration_url.trim() || null,
        hospital_id: rawHospitalId || null,
        speciality_id: rawSpecialityId || null,
      };

      if (isEditMode && courseId) {
        await updateCourse(courseId, payload);
        Alert.alert(
          "Curso actualizado",
          "El curso se ha actualizado correctamente",
          [{ text: "OK", onPress: () => { onSuccess?.(); onBack?.(); } }]
        );
      } else {
        await createCourse(payload);
        Alert.alert(
          "Curso creado",
          "El curso se ha creado correctamente",
          [{ text: "OK", onPress: () => { onSuccess?.(); onBack?.(); } }]
        );
      }
    } catch (err) {
      console.error("Error saving course:", err);
      setError(
        isEditMode
          ? "Error al actualizar el curso. Intenta de nuevo."
          : "Error al crear el curso. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }, [formData, isEditMode, courseId, validate, onSuccess, onBack]);

  const hospitalOptions = prepareHospitalOptions(hospitals);

  const specialtyOptions = prepareSpecialtyOptions(specialties);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? "Editar Curso" : "Crear Curso"}
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loadingCourse ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            <Text style={styles.loadingText}>Cargando curso...</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información básica</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Título del curso <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(t) => updateField("title", t)}
                placeholder="Ej: Curso de Radiología Avanzada"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
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
                        style={styles.removeDateBtn}
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

            <View style={styles.field}>
              <Text style={styles.label}>Duración</Text>
              <TextInput
                style={styles.input}
                value={formData.teaching_hours}
                onChangeText={(t) => updateField("teaching_hours", t)}
                placeholder="Ej: 3 días, 20 horas"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Código del curso</Text>
              <TextInput
                style={styles.input}
                value={formData.course_code}
                onChangeText={(t) => updateField("course_code", t)}
                placeholder="Ej: AC1318"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Organización</Text>
              <TextInput
                style={styles.input}
                value={formData.organization}
                onChangeText={(t) => updateField("organization", t)}
                placeholder="Ej: CDI Centro de Diagnóstico por la Imagen"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Directores del curso</Text>
              <TextInput
                style={styles.input}
                value={formData.course_directors}
                onChangeText={(t) => updateField("course_directors", t)}
                placeholder="Ej: Dr. Pablo Aguiar, Dra. Aida Niñerola"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            <View style={[styles.section, styles.sectionTop]}>
              <Text style={styles.sectionTitle}>Ubicación</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Lugar del evento</Text>
              <TextInput
                style={styles.input}
                value={formData.venue_name}
                onChangeText={(t) => updateField("venue_name", t)}
                placeholder="Ej: Centro Esther Koplowitz (CEK)"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            <View style={styles.field}>
              <SelectFilter
                label="Hospital"
                value={formData.hospital_id}
                onSelect={(v) => updateField("hospital_id", v)}
                options={hospitalOptions}
                placeholder="Seleccionar hospital (opcional)"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Dirección del evento</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={formData.venue_address}
                onChangeText={(t) => updateField("venue_address", t)}
                placeholder="Dirección completa"
                placeholderTextColor={COLORS.GRAY}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={[styles.section, styles.sectionTop]}>
              <Text style={styles.sectionTitle}>Información adicional</Text>
            </View>

            <View style={styles.field}>
              <SelectFilter
                label="Especialidad"
                value={formData.speciality_id}
                onSelect={(v) => updateField("speciality_id", v)}
                options={specialtyOptions}
                placeholder="Seleccionar especialidad"
                required
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Plazas disponibles</Text>
              <TextInput
                style={styles.input}
                value={formData.seats_available}
                onChangeText={(t) => updateField("seats_available", t)}
                placeholder="Ej: 50"
                placeholderTextColor={COLORS.GRAY}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Precio</Text>
              <TextInput
                style={styles.input}
                value={formData.price_text}
                onChangeText={(t) => updateField("price_text", t)}
                placeholder="Ej: 450 euros. Incluye comidas y café."
                placeholderTextColor={COLORS.GRAY}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>URL de inscripción</Text>
              <TextInput
                style={styles.input}
                value={formData.registration_url}
                onChangeText={(t) => updateField("registration_url", t)}
                placeholder="https://..."
                placeholderTextColor={COLORS.GRAY}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Objetivos del curso</Text>
              <TextInput
                inputAccessoryViewID={KEYBOARD_DISMISS_ACCESSORY_ID}
                style={[styles.input, styles.inputMultiline]}
                value={formData.objectives}
                onChangeText={(t) => updateField("objectives", t)}
                placeholder="Describe los objetivos del curso..."
                placeholderTextColor={COLORS.GRAY}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Más información</Text>
              <TextInput
                inputAccessoryViewID={KEYBOARD_DISMISS_ACCESSORY_ID_2}
                style={[styles.input, styles.inputMultiline]}
                value={formData.more_info}
                onChangeText={(t) => updateField("more_info", t)}
                placeholder="Información de contacto, teléfono, email..."
                placeholderTextColor={COLORS.GRAY}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEditMode ? "Actualizar Curso" : "Crear Curso"}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.bottomSpacing} />
          </>
        )}
      </ScrollView>

      <KeyboardDismissAccessory />

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
                  if (selectedDate) setTempSelectedDate(selectedDate);
                }}
                locale="es-ES"
                minimumDate={new Date()}
              />
            </View>
          ) : (
            <View style={styles.datePickerModalContainer}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerCancelText}>
                  Seleccionar fecha
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowDatePicker(false);
                    setSelectedDateIndex(null);
                    setTempSelectedDate(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={
                  selectedDateIndex !== null &&
                  formData.event_dates[selectedDateIndex]
                    ? new Date(
                        formData.event_dates[selectedDateIndex] + "T00:00:00"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.PRIMARY,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  headerPlaceholder: {
    width: 80,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.GRAY,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: `${COLORS.ERROR}15`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${COLORS.ERROR}30`,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ERROR,
  },
  section: {
    marginBottom: 16,
  },
  sectionTop: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  required: {
    color: COLORS.ERROR,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    backgroundColor: COLORS.WHITE,
  },
  inputMultiline: {
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
    backgroundColor: `${COLORS.PRIMARY}15`,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: `${COLORS.PRIMARY}30`,
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
  removeDateBtn: {
    padding: 4,
  },
  addDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: `${COLORS.PRIMARY}15`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLORS.PRIMARY}30`,
    borderStyle: "dashed",
  },
  addDateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  bottomSpacing: {
    height: 32,
  },
  datePickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
    elevation: 1000,
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
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
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
