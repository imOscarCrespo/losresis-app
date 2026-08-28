import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Icon } from "./Icon";
import { PickerSheet } from "./PickerSheet";
import { Country, City } from "country-state-city";
import { COLORS } from "../constants/colors";
import { SelectFilter } from "./SelectFilter";

/**
 * Modal para crear o editar una rotación externa
 */
export const RotationModal = ({
  visible,
  onClose,
  onSubmit,
  existingRotation,
  userPhone,
  specialties = [],
  loading,
}) => {
  const [formData, setFormData] = useState({
    latitude: 40.4168,
    longitude: -3.7038,
    start_date: new Date(),
    end_date: null,
    hospital_name: "",
    service_name: "",
    speciality_id: "",
    notes: "",
    phone: userPhone || "",
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedCityName, setSelectedCityName] = useState("");
  const [cityCoordinates, setCityCoordinates] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(false);

  // Obtener todos los países
  const countryOptions = useMemo(() => {
    try {
      const countries = Country.getAllCountries();
      const options = [{ value: "", label: "Selecciona un país" }];

      countries
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((country) => {
          options.push({
            value: country.isoCode,
            label: country.name,
          });
        });

      return options;
    } catch (error) {
      console.error("Error cargando países:", error);
      return [{ value: "", label: "Error cargando países" }];
    }
  }, []);

  // Obtener ciudades del país seleccionado
  const cityOptions = useMemo(() => {
    if (!selectedCountryCode) {
      return [{ value: "", label: "Primero selecciona un país" }];
    }

    const cities = City.getCitiesOfCountry(selectedCountryCode);
    const options = [{ value: "", label: "Selecciona una ciudad" }];

    if (!cities || cities.length === 0) {
      return [{ value: "", label: "No hay ciudades disponibles" }];
    }

    // Ordenar ciudades alfabéticamente y crear opciones
    cities
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((city) => {
        options.push({
          value: JSON.stringify({
            name: city.name,
            latitude: city.latitude,
            longitude: city.longitude,
          }),
          label: city.name,
        });
      });

    return options;
  }, [selectedCountryCode]);

  const specialtyOptions = useMemo(() => {
    return specialties
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((specialty) => ({
        value: specialty.id,
        label: specialty.name,
      }));
  }, [specialties]);

  // Cargar datos existentes cuando se abre el modal
  useEffect(() => {
    if (visible) {
      if (existingRotation) {
        // Cargar datos básicos
        setFormData({
          latitude: existingRotation.latitude,
          longitude: existingRotation.longitude,
          start_date: new Date(existingRotation.start_date),
          end_date: existingRotation.end_date
            ? new Date(existingRotation.end_date)
            : null,
          hospital_name: existingRotation.hospital_name || "",
          service_name: existingRotation.service_name || "",
          speciality_id: existingRotation.speciality_id || "",
          notes: existingRotation.notes || "",
          phone: userPhone || "",
        });
        setHasEndDate(!!existingRotation.end_date);

        // Cargar país y ciudad directamente de la base de datos
        if (existingRotation.country) {
          // Buscar el código ISO del país por su nombre
          const countries = Country.getAllCountries();

          // Buscar el país de forma más flexible
          let foundCountry = countries.find(
            (c) =>
              c.name.toLowerCase() === existingRotation.country.toLowerCase() ||
              c.name === existingRotation.country
          );

          // Si no se encuentra, intentar buscar por nombre alternativo o código ISO
          if (!foundCountry) {
            // Buscar por nombre que contenga el texto (para casos como "Andorra" vs "Andorra la Vella")
            foundCountry = countries.find(
              (c) =>
                c.name
                  .toLowerCase()
                  .includes(existingRotation.country.toLowerCase()) ||
                existingRotation.country
                  .toLowerCase()
                  .includes(c.name.toLowerCase())
            );
          }

          if (foundCountry) {
            setSelectedCountryCode(foundCountry.isoCode);

            // Si también tenemos ciudad, buscar sus coordenadas
            if (existingRotation.city) {
              setSelectedCityName(existingRotation.city);
              const cities = City.getCitiesOfCountry(foundCountry.isoCode);

              // Buscar la ciudad de forma más flexible
              let foundCity = cities?.find(
                (c) =>
                  c.name.toLowerCase() ===
                    existingRotation.city.toLowerCase() ||
                  c.name === existingRotation.city
              );

              // Si no se encuentra, intentar búsqueda parcial
              if (!foundCity) {
                foundCity = cities?.find(
                  (c) =>
                    c.name
                      .toLowerCase()
                      .includes(existingRotation.city.toLowerCase()) ||
                    existingRotation.city
                      .toLowerCase()
                      .includes(c.name.toLowerCase())
                );
              }

              // Si no encontramos la ciudad pero tenemos coordenadas, usar las coordenadas guardadas
              if (
                !foundCity &&
                existingRotation.latitude &&
                existingRotation.longitude
              ) {
                setCityCoordinates({
                  latitude: existingRotation.latitude,
                  longitude: existingRotation.longitude,
                });
              }
              if (foundCity && foundCity.latitude && foundCity.longitude) {
                setCityCoordinates({
                  latitude: parseFloat(foundCity.latitude),
                  longitude: parseFloat(foundCity.longitude),
                });
              } else {
                // Si no encontramos la ciudad, usar las coordenadas guardadas
                setCityCoordinates({
                  latitude: existingRotation.latitude,
                  longitude: existingRotation.longitude,
                });
              }
            }
          } else if (existingRotation.city) {
            // Si no encontramos el país pero hay ciudad, solo establecer la ciudad
            setSelectedCityName(existingRotation.city);
            setCityCoordinates({
              latitude: existingRotation.latitude,
              longitude: existingRotation.longitude,
            });
          }
        } else if (existingRotation.city) {
          // Si solo hay ciudad sin país
          setSelectedCityName(existingRotation.city);
          setCityCoordinates({
            latitude: existingRotation.latitude,
            longitude: existingRotation.longitude,
          });
        }
      } else {
        setFormData({
          latitude: 40.4168,
          longitude: -3.7038,
          start_date: new Date(),
          end_date: null,
          hospital_name: "",
          service_name: "",
          speciality_id: "",
          notes: "",
          phone: userPhone || "",
        });
        setHasEndDate(false);
        setSelectedCountryCode("");
        setSelectedCityName("");
        setCityCoordinates(null);
      }
    }
  }, [visible, existingRotation, userPhone]);

  // Reset ciudad cuando cambia el país (solo si no estamos en modo edición con datos existentes)
  useEffect(() => {
    if (visible && !existingRotation) {
      // Solo resetear si no hay rotación existente (modo creación)
      setSelectedCityName("");
      setCityCoordinates(null);
    }
  }, [selectedCountryCode, visible, existingRotation]);

  const handleCountryChange = (countryCode) => {
    setSelectedCountryCode(countryCode);
  };

  const handleCityChange = (cityValue) => {
    if (!cityValue) {
      setSelectedCityName("");
      setCityCoordinates(null);
      return;
    }

    try {
      const cityData = JSON.parse(cityValue);
      setSelectedCityName(cityData.name);
      setCityCoordinates({
        latitude: parseFloat(cityData.latitude),
        longitude: parseFloat(cityData.longitude),
      });
      // Actualizar formData con las coordenadas
      setFormData({
        ...formData,
        latitude: parseFloat(cityData.latitude),
        longitude: parseFloat(cityData.longitude),
      });
    } catch (error) {
      console.error("Error parsing city data:", error);
      setSelectedCityName("");
      setCityCoordinates(null);
    }
  };

  const handleSubmit = () => {
    if (
      !selectedCountryCode ||
      !selectedCityName ||
      !cityCoordinates ||
      !formData.hospital_name.trim() ||
      !formData.speciality_id
    ) {
      // Mostrar error si no hay país/ciudad seleccionados
      return;
    }

    // Obtener el nombre del país seleccionado
    const selectedCountry = Country.getCountryByCode(selectedCountryCode);

    // Preparar datos con country y city
    const rotationData = {
      ...formData,
      country: selectedCountry?.name || "",
      city: selectedCityName,
      hospital_name: formData.hospital_name.trim(),
      service_name: formData.service_name.trim(),
      notes: formData.notes.trim(),
    };

    onSubmit(rotationData, hasEndDate);
  };

  const handleStartDateChange = (selectedDate) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, start_date: selectedDate });
    }
  };

  const handleEndDateChange = (selectedDate) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, end_date: selectedDate });
    }
  };

  const toggleHasEndDate = () => {
    const newHasEndDate = !hasEndDate;
    setHasEndDate(newHasEndDate);
    if (!newHasEndDate) {
      setFormData({ ...formData, end_date: null });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {existingRotation ? "Editar Rotación" : "Nueva Rotación"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.sectionTitle}>Destino</Text>
              <Text style={styles.sectionText}>
                Añade los datos básicos para que otros residentes puedan
                encontrarte y filtrar mejor.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Hospital de destino *</Text>
              <TextInput
                style={styles.input}
                value={formData.hospital_name}
                onChangeText={(text) =>
                  setFormData({ ...formData, hospital_name: text })
                }
                placeholder="Ej. Hospital Clínic"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Servicio / unidad</Text>
              <TextInput
                style={styles.input}
                value={formData.service_name}
                onChangeText={(text) =>
                  setFormData({ ...formData, service_name: text })
                }
                placeholder="Ej. Cardiología Pediátrica"
              />
            </View>

            <View style={styles.field}>
              <SelectFilter
                label="Especialidad"
                value={formData.speciality_id}
                onChange={(value) =>
                  setFormData({ ...formData, speciality_id: value })
                }
                options={specialtyOptions}
                placeholder="Selecciona una especialidad"
                required
              />
            </View>

            {/* Country Selector */}
            <View style={styles.field}>
              <SelectFilter
                label="País"
                value={selectedCountryCode}
                onChange={handleCountryChange}
                options={countryOptions}
                placeholder="Selecciona un país"
                required
              />
            </View>

            {/* City Selector - Solo habilitado si hay un país seleccionado */}
            <View style={styles.field}>
              <SelectFilter
                label="Ciudad"
                value={
                  selectedCityName
                    ? cityOptions.find((opt) => {
                        try {
                          const cityData = JSON.parse(opt.value);
                          return cityData.name === selectedCityName;
                        } catch {
                          return false;
                        }
                      })?.value || ""
                    : ""
                }
                onChange={handleCityChange}
                options={cityOptions}
                placeholder={
                  selectedCountryCode
                    ? "Selecciona una ciudad"
                    : "Primero selecciona un país"
                }
                disabled={!selectedCountryCode}
                required
              />
            </View>

            {/* Start Date */}
            <View style={styles.field}>
              <Text style={styles.label}>Fecha de inicio *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {formData.start_date.toLocaleDateString("es-ES")}
                </Text>
                <Icon
                  name="calendar-outline"
                  size={20}
                  color={COLORS.GRAY_DARK}
                />
              </TouchableOpacity>
              <PickerSheet
                visible={showStartDatePicker}
                value={formData.start_date}
                mode="date"
                title="Fecha de inicio"
                onConfirm={handleStartDateChange}
                onCancel={() => setShowStartDatePicker(false)}
              />
            </View>

            {/* End Date Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={toggleHasEndDate}
            >
              <View
                style={[styles.checkbox, hasEndDate && styles.checkboxChecked]}
              >
                {hasEndDate && (
                  <Icon name="checkmark" size={16} color={COLORS.WHITE} />
                )}
              </View>
              <Text style={styles.checkboxLabel}>¿Tiene fecha de fin?</Text>
            </TouchableOpacity>

            {/* End Date */}
            {hasEndDate && (
              <View style={styles.field}>
                <Text style={styles.label}>Fecha de fin</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {formData.end_date
                      ? formData.end_date.toLocaleDateString("es-ES")
                      : "Seleccionar fecha"}
                  </Text>
                  <Icon
                    name="calendar-outline"
                    size={20}
                    color={COLORS.GRAY_DARK}
                  />
                </TouchableOpacity>
                <PickerSheet
                  visible={showEndDatePicker}
                  value={formData.end_date || formData.start_date || new Date()}
                  mode="date"
                  title="Fecha de fin"
                  minimumDate={formData.start_date}
                  onConfirm={handleEndDateChange}
                  onCancel={() => setShowEndDatePicker(false)}
                />
              </View>
            )}

            {/* Phone */}
            <View style={styles.field}>
              <Text style={styles.label}>Teléfono (opcional)</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) =>
                  setFormData({ ...formData, phone: text })
                }
                keyboardType="phone-pad"
                placeholder="Teléfono de contacto"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Notas</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={formData.notes}
                onChangeText={(text) =>
                  setFormData({ ...formData, notes: text })
                }
                placeholder="Información útil para tu futura rotación"
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedCountryCode ||
                  !selectedCityName ||
                  !cityCoordinates ||
                  !formData.hospital_name.trim() ||
                  !formData.speciality_id) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={
                loading ||
                !selectedCountryCode ||
                !selectedCityName ||
                !cityCoordinates ||
                !formData.hospital_name.trim() ||
                !formData.speciality_id
              }
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {existingRotation ? "Actualizar" : "Crear"}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  overlayTouchable: {
    flex: 1,
  },
  content: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "75%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 14,
    color: COLORS.GRAY,
    lineHeight: 20,
  },
  input: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
  },
  notesInput: {
    minHeight: 92,
  },
  dateButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 14,
  },
  dateButtonText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  checkboxLabel: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    gap: 12,
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.GRAY,
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  coordinatesText: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 8,
    fontStyle: "italic",
  },
  cancelButton: {
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
});
