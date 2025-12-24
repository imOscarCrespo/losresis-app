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
      console.log("📍 Países cargados:", countries.length);

      const options = [{ value: "", label: "Selecciona un país" }];

      countries
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((country) => {
          options.push({
            value: country.isoCode,
            label: country.name,
          });
        });

      console.log("📍 Opciones de países generadas:", options.length);
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
      setReviewAnswers({});
      setReviewFreeComment("");
      setReviewHospitalName("");
      setSelectedCountryCode("");
      setSelectedCityName("");
      setCityCoordinates(null);
    }
  }, [visible, isEditing, existingReview]);

  // Reset ciudad cuando cambia el país
  useEffect(() => {
    if (!isEditing) {
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
    // Obtener el nombre del país seleccionado
    const selectedCountry = Country.getCountryByCode(selectedCountryCode);

    onSubmit({
      answers: reviewAnswers,
      hospitalName: reviewHospitalName,
      city: selectedCityName,
      country: selectedCountry?.name || "",
      countryCode: selectedCountryCode,
      coordinates: cityCoordinates,
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
              {cityCoordinates && (
                <Text style={styles.coordinatesText}>
                  📍 Lat: {cityCoordinates.latitude.toFixed(4)}, Lon:{" "}
                  {cityCoordinates.longitude.toFixed(4)}
                </Text>
              )}
            </View>


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
