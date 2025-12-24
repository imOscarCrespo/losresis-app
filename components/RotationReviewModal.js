import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { Country, City } from "country-state-city";
import { COLORS } from "../constants/colors";
import { StarRating } from "./StarRating";
import { SelectFilter } from "./SelectFilter";

/**
 * Modal para crear o editar una reseña de rotación externa
 */
export const RotationReviewModal = ({
  visible,
  onClose,
  onSubmit,
  existingReview,
  existingRotation,
  questions,
  loadingQuestions,
  loading,
  isEditing,
}) => {
  const [reviewAnswers, setReviewAnswers] = useState({});
  const [reviewFreeComment, setReviewFreeComment] = useState("");
  const [reviewHospitalName, setReviewHospitalName] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [selectedCityName, setSelectedCityName] = useState("");
  const [cityCoordinates, setCityCoordinates] = useState(null);

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
      console.error("❌ Error cargando países:", error);
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

  // Cargar datos existentes cuando se abre en modo edición
  useEffect(() => {
    if (visible && isEditing && existingReview) {
      setReviewHospitalName(existingReview.external_hospital_name || "");
      // Intentar encontrar el país por el nombre
      const countries = Country.getAllCountries();
      const foundCountry = countries.find(
        (c) =>
          c.name.toLowerCase() === existingReview.country?.toLowerCase() ||
          c.name === existingReview.country
      );
      if (foundCountry) {
        setSelectedCountryCode(foundCountry.isoCode);
      }
      setSelectedCityName(existingReview.city || "");
      setReviewAnswers({});
      setReviewFreeComment("");
      setCityCoordinates(null);
    } else if (visible && !isEditing) {
      // Modo creación: cargar datos de la rotación si existe
      setReviewAnswers({});
      setReviewFreeComment("");
      setReviewHospitalName("");

      if (existingRotation) {
        // Cargar país y ciudad de la rotación
        if (existingRotation.country) {
          const countries = Country.getAllCountries();
          const foundCountry = countries.find(
            (c) =>
              c.name.toLowerCase() === existingRotation.country.toLowerCase() ||
              c.name === existingRotation.country
          );
          if (foundCountry) {
            setSelectedCountryCode(foundCountry.isoCode);
            // La ciudad se establecerá en el useEffect que observa cityOptions
          }
        }
      } else {
        // Si no hay rotación, resetear campos
        setSelectedCountryCode("");
        setSelectedCityName("");
        setCityCoordinates(null);
      }
    }
  }, [visible, isEditing, existingReview, existingRotation]);

  // Ref para rastrear si estamos cargando datos iniciales
  const isInitialLoadRef = useRef(false);
  const pendingCityRef = useRef(null);

  // Cuando se abre el modal en modo creación, marcar que estamos en carga inicial
  useEffect(() => {
    if (visible && !isEditing && existingRotation?.city) {
      isInitialLoadRef.current = true;
      pendingCityRef.current = existingRotation.city;
    } else if (!visible) {
      isInitialLoadRef.current = false;
      pendingCityRef.current = null;
    }
  }, [visible, isEditing, existingRotation]);

  // Cuando cityOptions se actualiza y hay una ciudad pendiente, establecerla
  useEffect(() => {
    if (
      isInitialLoadRef.current &&
      pendingCityRef.current &&
      selectedCountryCode &&
      cityOptions.length > 1 // Más de 1 porque el primer elemento es el placeholder
    ) {
      const cityToSet = pendingCityRef.current;

      // Buscar la ciudad en las opciones
      const foundOption = cityOptions.find((opt) => {
        if (!opt.value) return false;
        try {
          const cityData = JSON.parse(opt.value);
          return (
            cityData.name === cityToSet ||
            cityData.name.toLowerCase() === cityToSet.toLowerCase() ||
            cityData.name.toLowerCase().includes(cityToSet.toLowerCase()) ||
            cityToSet.toLowerCase().includes(cityData.name.toLowerCase())
          );
        } catch {
          return false;
        }
      });

      if (foundOption) {
        try {
          const cityData = JSON.parse(foundOption.value);
          setSelectedCityName(cityData.name);
          setCityCoordinates({
            latitude: parseFloat(cityData.latitude),
            longitude: parseFloat(cityData.longitude),
          });
        } catch (e) {
          console.error("Error parsing city data:", e);
        }
      } else {
        setSelectedCityName(cityToSet);
        // Usar coordenadas de la rotación si están disponibles
        if (existingRotation?.latitude && existingRotation?.longitude) {
          setCityCoordinates({
            latitude: existingRotation.latitude,
            longitude: existingRotation.longitude,
          });
        }
      }

      // Limpiar el flag y la ciudad pendiente
      isInitialLoadRef.current = false;
      pendingCityRef.current = null;
    }
  }, [cityOptions, selectedCountryCode, existingRotation]);

  // Reset ciudad cuando cambia el país (solo si el usuario cambia el país manualmente)
  useEffect(() => {
    // Solo resetear si no estamos en modo edición y no es la carga inicial
    if (!isEditing && !isInitialLoadRef.current) {
      setSelectedCityName("");
      setCityCoordinates(null);
    }
  }, [selectedCountryCode, isEditing]);

  const handleRatingChange = (questionId, rating) => {
    setReviewAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], rating },
    }));
  };

  const handleTextChange = (questionId, textValue) => {
    setReviewAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], textValue },
    }));
  };

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
    } catch (error) {
      console.error("Error parsing city data:", error);
      setSelectedCityName("");
      setCityCoordinates(null);
    }
  };

  const handleSubmit = () => {
    let finalCity = selectedCityName;
    let finalCountry = "";
    let finalCountryCode = selectedCountryCode;
    let finalCoordinates = cityCoordinates;

    if (isEditing) {
      // En modo edición, usar los valores de los selectores
      const selectedCountry = Country.getCountryByCode(selectedCountryCode);
      finalCountry = selectedCountry?.name || "";
    } else {
      // En modo creación, usar los valores de existingRotation
      if (existingRotation) {
        finalCity = existingRotation.city || "";
        finalCountry = existingRotation.country || "";
        // Buscar el código ISO del país
        if (finalCountry) {
          const countries = Country.getAllCountries();
          const foundCountry = countries.find(
            (c) =>
              c.name.toLowerCase() === finalCountry.toLowerCase() ||
              c.name === finalCountry
          );
          if (foundCountry) {
            finalCountryCode = foundCountry.isoCode;
          }
        }
        // Usar coordenadas de la rotación
        if (existingRotation.latitude && existingRotation.longitude) {
          finalCoordinates = {
            latitude: existingRotation.latitude,
            longitude: existingRotation.longitude,
          };
        }
      }
    }

    onSubmit({
      answers: reviewAnswers,
      hospitalName: reviewHospitalName,
      city: finalCity,
      country: finalCountry,
      countryCode: finalCountryCode,
      coordinates: finalCoordinates,
      freeComment: reviewFreeComment,
    });
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
              {isEditing ? "Editar Reseña" : "Nueva Reseña"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hospital Name */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Nombre del Hospital <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={reviewHospitalName}
                onChangeText={setReviewHospitalName}
                placeholder="Hospital Universitario..."
              />
            </View>

            {/* Country Selector - Solo en modo edición */}
            {isEditing && (
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
            )}

            {/* City Selector - Solo en modo edición */}
            {isEditing && (
              <View style={styles.field}>
                <SelectFilter
                  label="Ciudad"
                  value={
                    selectedCityName
                      ? cityOptions.find((opt) => {
                          if (!opt.value) return false;
                          try {
                            const cityData = JSON.parse(opt.value);
                            // Búsqueda más flexible: exacta o que contenga el nombre
                            return (
                              cityData.name === selectedCityName ||
                              cityData.name.toLowerCase() ===
                                selectedCityName.toLowerCase() ||
                              cityData.name
                                .toLowerCase()
                                .includes(selectedCityName.toLowerCase()) ||
                              selectedCityName
                                .toLowerCase()
                                .includes(cityData.name.toLowerCase())
                            );
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
            )}

            {loadingQuestions ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                <Text style={styles.loadingText}>Cargando preguntas...</Text>
              </View>
            ) : (
              <>
                {questions.map((question) => (
                  <View key={question.id} style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                      {question.text}
                      {!question.is_optional && (
                        <Text style={styles.required}> *</Text>
                      )}
                    </Text>

                    {question.type === "rating" && (
                      <StarRating
                        rating={reviewAnswers[question.id]?.rating || 0}
                        onRatingChange={(rating) =>
                          handleRatingChange(question.id, rating)
                        }
                        size={32}
                      />
                    )}

                    {question.type === "text" && (
                      <TextInput
                        style={styles.textInput}
                        value={reviewAnswers[question.id]?.textValue || ""}
                        onChangeText={(text) =>
                          handleTextChange(question.id, text)
                        }
                        placeholder="Escribe tu respuesta..."
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                    )}
                  </View>
                ))}

                <View style={styles.field}>
                  <Text style={styles.label}>
                    Comentario adicional (opcional)
                  </Text>
                  <TextInput
                    style={[styles.input, { minHeight: 100 }]}
                    value={reviewFreeComment}
                    onChangeText={setReviewFreeComment}
                    placeholder="Comparte cualquier otra información..."
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.WHITE} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEditing ? "Actualizar Reseña" : "Crear Reseña"}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
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
    minHeight: "80%",
    maxHeight: "95%",
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
  required: {
    color: COLORS.ERROR,
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
  coordinatesText: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 6,
    fontStyle: "italic",
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.GRAY,
  },
  divider: {
    marginVertical: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.BORDER,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY,
    textAlign: "center",
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    minHeight: 100,
    textAlignVertical: "top",
  },
  actions: {
    padding: 20,
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
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
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
