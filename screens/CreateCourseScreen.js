import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyboardDismissAccessory,
  KEYBOARD_DISMISS_ACCESSORY_ID,
  KEYBOARD_DISMISS_ACCESSORY_ID_2,
} from "../components/KeyboardDismissAccessory";
import { useHospitals } from "../hooks/useHospitals";
import {
  getCourseById,
  createCourse,
  updateCourse,
} from "../services/lectureService";
import { getCachedUserId } from "../services/authService";
import { formatShortDate } from "../utils/dateUtils";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const CARD_BORDER = "#F1F5F9";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";
const DANGER = "#EF4444";

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

function RadioDot({ selected }) {
  return (
    <View
      style={[
        sheet.radioDot,
        selected ? sheet.radioDotSelected : sheet.radioDotUnselected,
      ]}
    >
      {selected ? <View style={sheet.radioDotInner} /> : null}
    </View>
  );
}

function SelectionModal({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  placeholder,
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setTempValue(value);
    }
  }, [value, visible]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((option) => option.name.toLowerCase().includes(lower));
  }, [options, search]);

  const listData = useMemo(() => {
    const data = [];
    if (value) {
      data.push({ id: "", name: placeholder });
    }
    data.push(...filteredOptions);
    return data;
  }, [filteredOptions, placeholder, value]);

  const handleClose = useCallback(() => {
    setSearch("");
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onSelect(tempValue);
    setSearch("");
    onClose();
  }, [onClose, onSelect, tempValue]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={sheet.container}>
        <View style={[sheet.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={sheet.backBtn} onPress={handleClose}>
            <Ionicons name="arrow-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={sheet.title}>{title}</Text>
          <View style={sheet.backBtn} />
        </View>

        <View style={sheet.searchWrap}>
          <View style={sheet.searchInner}>
            <Ionicons name="search" size={20} color={MUTED_LIGHT} />
            <TextInput
              style={sheet.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar..."
              placeholderTextColor={MUTED_LIGHT}
              returnKeyType="done"
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color={MUTED_LIGHT} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView contentContainerStyle={sheet.listContent}>
          {listData.map((item, index) => {
            const isClear = item.id === "";
            const isSelected = !isClear && item.id === tempValue;
            return (
              <Pressable
                key={`${String(item.id ?? "")}-${index}`}
                style={({ pressed }) => [
                  sheet.option,
                  isSelected && sheet.optionSelected,
                  isClear && sheet.optionClear,
                  pressed && { opacity: 0.78 },
                ]}
                onPress={() => setTempValue(isClear ? "" : item.id)}
              >
                <Text
                  style={[
                    sheet.optionName,
                    isSelected && sheet.optionNameSelected,
                    isClear && sheet.optionNameClear,
                  ]}
                >
                  {item.name}
                </Text>
                {isClear ? null : <RadioDot selected={isSelected} />}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[sheet.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={sheet.confirmBtn} onPress={handleConfirm}>
            <Text style={sheet.confirmText}>Confirmar selección</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function FieldCard({
  label,
  required = false,
  children,
  hint,
}) {
  return (
    <View style={styles.fieldCard}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export default function CreateCourseScreen({
  courseId,
  onBack,
  onSuccess,
}) {
  const insets = useSafeAreaInsets();
  const isEditMode = Boolean(courseId);
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(isEditMode);
  const [error, setError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState(null);
  const [tempSelectedDate, setTempSelectedDate] = useState(null);
  const [openModal, setOpenModal] = useState(null);

  const { hospitals, specialties } = useHospitals();

  useEffect(() => {
    const name = isEditMode
      ? "CreateCourseScreen_Edit"
      : "CreateCourseScreen_Create";
    posthogLogger.logScreen(name, { courseId, isEditMode });
  }, [courseId, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !courseId) return;

    const loadCourse = async () => {
      try {
        setLoadingCourse(true);
        const course = await getCourseById(courseId);
        setFormData({
          title: course.title || "",
          event_dates: Array.isArray(course.event_dates) ? [...course.event_dates] : [],
          teaching_hours: course.teaching_hours ?? "",
          price_text: course.price_text ?? "",
          course_directors: course.course_directors ?? "",
          organization: course.organization ?? "",
          venue_name: course.venue_name ?? "",
          venue_address: course.venue_address ?? "",
          seats_available:
            course.seats_available != null ? String(course.seats_available) : "",
          course_code: course.course_code ?? "",
          more_info: course.more_info ?? "",
          objectives: course.objectives ?? "",
          registration_url: course.registration_url ?? "",
          hospital_id: course.hospital_id ?? "",
          speciality_id: course.speciality_id ?? "",
        });
      } catch (err) {
        console.error("Error loading course:", err);
        setError("No se pudo cargar el curso");
      } finally {
        setLoadingCourse(false);
      }
    };

    loadCourse();
  }, [courseId, isEditMode]);

  const hospitalOptions = useMemo(
    () =>
      hospitals
        .filter((hospital) => hospital?.id && hospital?.name)
        .map((hospital) => ({ id: hospital.id, name: hospital.name })),
    [hospitals]
  );
  const specialtyOptions = useMemo(
    () =>
      specialties
        .filter((specialty) => specialty?.id && specialty?.name)
        .map((specialty) => ({ id: specialty.id, name: specialty.name })),
    [specialties]
  );

  const selectedHospitalName = useMemo(
    () => hospitalOptions.find((item) => item.id === formData.hospital_id)?.name,
    [formData.hospital_id, hospitalOptions]
  );
  const selectedSpecialtyName = useMemo(
    () => specialtyOptions.find((item) => item.id === formData.speciality_id)?.name,
    [formData.speciality_id, specialtyOptions]
  );

  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  }, []);

  const resetDatePickerState = useCallback(() => {
    setShowDatePicker(false);
    setSelectedDateIndex(null);
    setTempSelectedDate(null);
  }, []);

  const handleAddDate = useCallback(() => {
    Keyboard.dismiss();
    setSelectedDateIndex(formData.event_dates.length);
    const referenceDate =
      formData.event_dates.length > 0
        ? new Date(`${formData.event_dates[formData.event_dates.length - 1]}T00:00:00`)
        : new Date();
    setTempSelectedDate(referenceDate);
    setShowDatePicker(true);
  }, [formData.event_dates]);

  const handleEditDate = useCallback(
    (index) => {
      Keyboard.dismiss();
      setSelectedDateIndex(index);
      setTempSelectedDate(new Date(`${formData.event_dates[index]}T00:00:00`));
      setShowDatePicker(true);
    },
    [formData.event_dates]
  );

  const handleRemoveDate = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      event_dates: prev.event_dates.filter((_, currentIndex) => currentIndex !== index),
    }));
  }, []);

  const upsertDate = useCallback(
    (value) => {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      const normalized = `${year}-${month}-${day}`;

      setFormData((prev) => {
        const nextDates = [...prev.event_dates];

        if (selectedDateIndex !== null && selectedDateIndex < nextDates.length) {
          nextDates[selectedDateIndex] = normalized;
        } else {
          nextDates.push(normalized);
        }

        return { ...prev, event_dates: nextDates.sort() };
      });
    },
    [selectedDateIndex]
  );

  const handleDateChange = useCallback(
    (event, selectedDate) => {
      if (Platform.OS === "android") {
        if (event.type === "set" && selectedDate) {
          upsertDate(selectedDate);
        }
        resetDatePickerState();
        return;
      }

      if (selectedDate) {
        setTempSelectedDate(selectedDate);
      }
    },
    [resetDatePickerState, upsertDate]
  );

  const handleConfirmDate = useCallback(() => {
    if (!tempSelectedDate) return;
    upsertDate(tempSelectedDate);
    resetDatePickerState();
  }, [resetDatePickerState, tempSelectedDate, upsertDate]);

  const validate = useCallback(() => {
    if (!formData.title.trim()) {
      setError("El título es obligatorio");
      return false;
    }

    if (formData.event_dates.length === 0) {
      setError("Debes añadir al menos una fecha");
      return false;
    }

    if (!formData.speciality_id?.trim()) {
      setError("La especialidad es obligatoria");
      return false;
    }

    setError("");
    return true;
  }, [formData.event_dates.length, formData.speciality_id, formData.title]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setLoading(true);
    setError("");

    try {
      const rawSeats = formData.seats_available.trim();
      const createdBy = !isEditMode ? await getCachedUserId() : undefined;
      const payload = {
        ...(createdBy ? { created_by_id: createdBy } : {}),
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
        hospital_id: formData.hospital_id?.trim() || null,
        speciality_id: formData.speciality_id?.trim() || null,
      };

      if (isEditMode) {
        await updateCourse(courseId, payload);
        Alert.alert("Curso actualizado", "Los cambios se han guardado correctamente.", [
          {
            text: "OK",
            onPress: () => {
              onSuccess?.();
              onBack?.();
            },
          },
        ]);
      } else {
        await createCourse(payload);
        Alert.alert("Curso creado", "El curso se ha publicado correctamente.", [
          {
            text: "OK",
            onPress: () => {
              onSuccess?.();
              onBack?.();
            },
          },
        ]);
      }
    } catch (err) {
      console.error("Error saving course:", err);
      setError(
        isEditMode
          ? "No se pudo actualizar el curso. Inténtalo de nuevo."
          : "No se pudo crear el curso. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }, [courseId, formData, isEditMode, onBack, onSuccess, validate]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 32, 40),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: Math.max(insets.top + 8, 20) }]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={onBack}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>
              {isEditMode ? "Editar curso" : "Nuevo curso"}
            </Text>
            <View style={styles.topBarSpacer} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Ionicons name="create-outline" size={16} color={PRIMARY} />
              <Text style={styles.heroBadgeText}>
                {isEditMode ? "Edición" : "Publicación"}
              </Text>
            </View>

            <Text style={styles.heroTitle}>
              {isEditMode ? "Actualiza la información del curso" : "Comparte una nueva formación"}
            </Text>

            <Text style={styles.heroText}>
              Mantén el formato visual de la nueva UX: información clave arriba,
              secciones limpias y llamadas a la acción claras.
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {loadingCourse ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.loadingText}>Cargando curso...</Text>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={20} color={DANGER} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Información principal</Text>
                <Text style={styles.sectionText}>
                  Los campos marcados con asterisco son obligatorios.
                </Text>
              </View>

              <FieldCard label="Título" required>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(text) => updateField("title", text)}
                  placeholder="Ej. Curso de Radiología Intervencionista"
                  placeholderTextColor={MUTED_LIGHT}
                />
              </FieldCard>

              <FieldCard
                label="Fechas"
                required
                hint="Añade una o varias fechas. Puedes reordenarlas editando la lista."
              >
                {formData.event_dates.length > 0 ? (
                  <View style={styles.dateList}>
                    {formData.event_dates.map((date, index) => (
                      <View key={`${date}-${index}`} style={styles.dateItem}>
                        <TouchableOpacity
                          style={styles.dateItemBody}
                          onPress={() => handleEditDate(index)}
                        >
                          <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
                          <Text style={styles.dateItemText}>{formatShortDate(date)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.dateDeleteButton}
                          onPress={() => handleRemoveDate(index)}
                        >
                          <Ionicons name="close-circle" size={20} color={DANGER} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}

                <TouchableOpacity style={styles.addDateButton} onPress={handleAddDate}>
                  <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
                  <Text style={styles.addDateText}>Añadir fecha</Text>
                </TouchableOpacity>
              </FieldCard>

              <FieldCard label="Especialidad" required>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setOpenModal("speciality")}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      !selectedSpecialtyName && styles.selectorPlaceholder,
                    ]}
                  >
                    {selectedSpecialtyName || "Seleccionar especialidad"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={MUTED_LIGHT} />
                </TouchableOpacity>
              </FieldCard>

              <FieldCard label="Organización">
                <TextInput
                  style={styles.input}
                  value={formData.organization}
                  onChangeText={(text) => updateField("organization", text)}
                  placeholder="Entidad organizadora"
                  placeholderTextColor={MUTED_LIGHT}
                />
              </FieldCard>

              <FieldCard label="Duración">
                <TextInput
                  style={styles.input}
                  value={formData.teaching_hours}
                  onChangeText={(text) => updateField("teaching_hours", text)}
                  placeholder="Ej. 20 horas · 3 jornadas"
                  placeholderTextColor={MUTED_LIGHT}
                />
              </FieldCard>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ubicación</Text>
                <Text style={styles.sectionText}>
                  Completa la sede para que la tarjeta del curso quede consistente con el listado.
                </Text>
              </View>

              <FieldCard label="Lugar del evento">
                <TextInput
                  style={styles.input}
                  value={formData.venue_name}
                  onChangeText={(text) => updateField("venue_name", text)}
                  placeholder="Nombre de la sede"
                  placeholderTextColor={MUTED_LIGHT}
                />
              </FieldCard>

              <FieldCard label="Hospital asociado">
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setOpenModal("hospital")}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      !selectedHospitalName && styles.selectorPlaceholder,
                    ]}
                  >
                    {selectedHospitalName || "Seleccionar hospital"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={MUTED_LIGHT} />
                </TouchableOpacity>
              </FieldCard>

              <FieldCard label="Dirección">
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={formData.venue_address}
                  onChangeText={(text) => updateField("venue_address", text)}
                  placeholder="Dirección completa"
                  placeholderTextColor={MUTED_LIGHT}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </FieldCard>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Datos complementarios</Text>
                <Text style={styles.sectionText}>
                  Añade metadatos y contenido de apoyo para la vista detalle.
                </Text>
              </View>

              <FieldCard label="Código del curso">
                <TextInput
                  style={styles.input}
                  value={formData.course_code}
                  onChangeText={(text) => updateField("course_code", text)}
                  placeholder="Ej. AC1318"
                  placeholderTextColor={MUTED_LIGHT}
                />
              </FieldCard>

              <FieldCard label="Dirección académica">
                <TextInput
                  style={styles.input}
                  value={formData.course_directors}
                  onChangeText={(text) => updateField("course_directors", text)}
                  placeholder="Personas responsables"
                  placeholderTextColor={MUTED_LIGHT}
                />
              </FieldCard>

              <FieldCard label="Plazas disponibles">
                <TextInput
                  style={styles.input}
                  value={formData.seats_available}
                  onChangeText={(text) => updateField("seats_available", text)}
                  placeholder="Ej. 50"
                  placeholderTextColor={MUTED_LIGHT}
                  keyboardType="numeric"
                />
              </FieldCard>

              <FieldCard label="Precio">
                <TextInput
                  style={styles.input}
                  value={formData.price_text}
                  onChangeText={(text) => updateField("price_text", text)}
                  placeholder="Ej. 450 €"
                  placeholderTextColor={MUTED_LIGHT}
                />
              </FieldCard>

              <FieldCard label="URL de inscripción">
                <TextInput
                  style={styles.input}
                  value={formData.registration_url}
                  onChangeText={(text) => updateField("registration_url", text)}
                  placeholder="https://..."
                  placeholderTextColor={MUTED_LIGHT}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </FieldCard>

              <FieldCard label="Objetivos">
                <TextInput
                  inputAccessoryViewID={KEYBOARD_DISMISS_ACCESSORY_ID}
                  style={[styles.input, styles.inputMultiline]}
                  value={formData.objectives}
                  onChangeText={(text) => updateField("objectives", text)}
                  placeholder="Describe los objetivos del curso"
                  placeholderTextColor={MUTED_LIGHT}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </FieldCard>

              <FieldCard label="Más información">
                <TextInput
                  inputAccessoryViewID={KEYBOARD_DISMISS_ACCESSORY_ID_2}
                  style={[styles.input, styles.inputMultiline]}
                  value={formData.more_info}
                  onChangeText={(text) => updateField("more_info", text)}
                  placeholder="Contacto, notas o condiciones"
                  placeholderTextColor={MUTED_LIGHT}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </FieldCard>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      {isEditMode ? "Guardar cambios" : "Publicar curso"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <KeyboardDismissAccessory />

      <SelectionModal
        visible={openModal === "hospital"}
        onClose={() => setOpenModal(null)}
        title="Seleccionar hospital"
        options={hospitalOptions}
        value={formData.hospital_id}
        onSelect={(value) => updateField("hospital_id", value)}
        placeholder="Sin hospital"
      />
      <SelectionModal
        visible={openModal === "speciality"}
        onClose={() => setOpenModal(null)}
        title="Seleccionar especialidad"
        options={specialtyOptions}
        value={formData.speciality_id}
        onSelect={(value) => updateField("speciality_id", value)}
        placeholder="Sin especialidad"
      />

      {showDatePicker ? (
        <View style={styles.dateOverlay}>
          <TouchableOpacity style={styles.dateOverlayTouch} onPress={resetDatePickerState} />
          <View style={styles.dateSheet}>
            {Platform.OS === "ios" ? (
              <>
                <View style={styles.dateSheetHeader}>
                  <TouchableOpacity onPress={resetDatePickerState}>
                    <Text style={styles.dateSheetCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleConfirmDate}>
                    <Text style={styles.dateSheetConfirm}>Seleccionar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempSelectedDate || new Date()}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  locale="es-ES"
                  minimumDate={new Date()}
                />
              </>
            ) : (
              <DateTimePicker
                value={tempSelectedDate || new Date()}
                mode="date"
                display="default"
                onChange={handleDateChange}
                locale="es-ES"
                minimumDate={new Date()}
              />
            )}
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
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
    alignItems: "center",
    justifyContent: "space-between",
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
  topBarTitle: {
    color: "#FFFFFF",
    fontSize: 16,
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
  heroText: {
    marginTop: 8,
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 14,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: MUTED,
    fontSize: 15,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: DANGER,
    lineHeight: 20,
  },
  sectionHeader: {
    marginTop: 6,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  sectionText: {
    marginTop: 4,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  fieldCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: ACCENT,
  },
  fieldHint: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  required: {
    color: DANGER,
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: ACCENT,
  },
  inputMultiline: {
    minHeight: 110,
    paddingTop: 14,
  },
  selector: {
    marginTop: 12,
    minHeight: 52,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectorText: {
    flex: 1,
    fontSize: 15,
    color: ACCENT,
    fontWeight: "600",
  },
  selectorPlaceholder: {
    color: MUTED_LIGHT,
    fontWeight: "500",
  },
  dateList: {
    marginTop: 12,
    gap: 8,
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: `${PRIMARY}10`,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateItemBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  dateItemText: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
  dateDeleteButton: {
    paddingLeft: 12,
  },
  addDateButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: `${PRIMARY}26`,
  },
  addDateText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: PRIMARY,
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  dateOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
    justifyContent: "flex-end",
  },
  dateOverlayTouch: {
    flex: 1,
  },
  dateSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  dateSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  dateSheetCancel: {
    color: MUTED,
    fontSize: 15,
    fontWeight: "600",
  },
  dateSheetConfirm: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
});

const sheet = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ACCENT,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  option: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionSelected: {
    borderColor: `${PRIMARY}40`,
    backgroundColor: `${PRIMARY}10`,
  },
  optionClear: {
    backgroundColor: "#F8FAFC",
  },
  optionName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  optionNameSelected: {
    color: PRIMARY,
  },
  optionNameClear: {
    color: MUTED,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  radioDotSelected: {
    borderColor: PRIMARY,
  },
  radioDotUnselected: {
    borderColor: "#CBD5E1",
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
});
