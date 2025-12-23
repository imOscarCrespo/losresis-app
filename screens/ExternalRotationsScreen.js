import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS } from "../constants/colors";
import { useExternalRotations } from "../hooks/useExternalRotations";
import { useResidentReviewCheck } from "../hooks/useResidentReviewCheck";
import {
  useExternalRotationReview,
  useExternalRotationReviewsList,
} from "../hooks/useExternalRotationReviews";
import { ScreenHeader } from "../components/ScreenHeader";
import { InfoBanner } from "../components/InfoBanner";
import { SelectFilter } from "../components/SelectFilter";
import { StarRating } from "../components/StarRating";
import { supabase } from "../config/supabase";
import { formatShortDate } from "../utils/dateUtils";

// Intentar importar MapView
let MapView = null;
let Marker = null;
let Callout = null;
let PROVIDER_DEFAULT = null;
let MAP_AVAILABLE = false;

try {
  const MapModule = require("react-native-maps");
  MapView = MapModule.default;
  Marker = MapModule.Marker;
  Callout = MapModule.Callout;
  PROVIDER_DEFAULT = MapModule.PROVIDER_DEFAULT;
  MAP_AVAILABLE = true;
  console.log("✅ MapView disponible");
} catch (error) {
  console.log("⚠️ MapView no disponible:", error.message);
  MAP_AVAILABLE = false;
}

/**
 * Pantalla de Rotaciones Externas
 * Permite ver y gestionar rotaciones externas de residentes
 */
export const ExternalRotationsScreen = ({ userProfile, navigation }) => {
  const userId = userProfile?.id;
  const isResident = userProfile?.is_resident;

  // Tab state
  const [activeTab, setActiveTab] = useState("map"); // 'map' o 'reviews'

  // Reviews state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReviewDeleteConfirm, setShowReviewDeleteConfirm] = useState(false);
  const [reviewAnswers, setReviewAnswers] = useState({});
  const [reviewFreeComment, setReviewFreeComment] = useState("");
  const [reviewHospitalName, setReviewHospitalName] = useState("");
  const [reviewCity, setReviewCity] = useState("");
  const [reviewCountry, setReviewCountry] = useState("");
  const [isEditingReview, setIsEditingReview] = useState(false);

  const [specialties, setSpecialties] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedMonthYear, setSelectedMonthYear] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Cargar especialidades
  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const { data, error } = await supabase
          .from("specialities")
          .select("*")
          .order("name", { ascending: true });

        if (error) {
          console.error("Error fetching specialties:", error);
          return;
        }

        setSpecialties(data || []);
      } catch (error) {
        console.error("Exception fetching specialties:", error);
      }
    };

    fetchSpecialties();
  }, []);

  // Form data
  const [formData, setFormData] = useState({
    latitude: 40.4168, // Madrid por defecto
    longitude: -3.7038,
    start_date: new Date(),
    end_date: null,
    phone: userProfile?.phone || "",
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(false);

  const {
    rotations,
    userRotations,
    loading,
    error,
    success,
    createRotation,
    updateRotation,
    deleteRotation,
    clearError,
    clearSuccess,
  } = useExternalRotations(userId, selectedSpecialty, selectedMonthYear);

  const { hasReview } = useResidentReviewCheck(userId, userProfile);

  const existingRotation = userRotations.length > 0 ? userRotations[0] : null;

  // Hooks para reseñas
  const {
    reviews: allReviews,
    loading: loadingReviews,
    error: errorReviews,
    fetchReviews,
  } = useExternalRotationReviewsList();

  const {
    existingReview,
    questions: reviewQuestions,
    loading: loadingReview,
    loadingQuestions,
    error: errorReview,
    success: successReview,
    checkExisting: checkExistingReview,
    loadQuestions: loadReviewQuestions,
    createReview,
    updateReview: updateReviewData,
    deleteReview: deleteReviewData,
    clearError: clearReviewError,
    clearSuccess: clearReviewSuccess,
  } = useExternalRotationReview(userId, existingRotation?.id);

  // Cargar reseñas cuando se cambia a la tab de reseñas
  useEffect(() => {
    if (activeTab === "reviews") {
      fetchReviews();
      if (existingRotation?.id) {
        checkExistingReview();
      }
    }
  }, [activeTab, existingRotation?.id]);

  // Generar opciones de mes/año
  const monthYearOptions = useMemo(() => {
    const months = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const currentYear = new Date().getFullYear();
    const options = [{ value: "", label: "Todos los meses" }];

    for (let year = currentYear; year <= currentYear + 2; year++) {
      for (let month = 0; month < 12; month++) {
        options.push({
          value: `${year}-${String(month + 1).padStart(2, "0")}`,
          label: `${months[month]} ${year}`,
        });
      }
    }
    return options;
  }, []);

  // Specialty options
  const specialtyOptions = useMemo(() => {
    const options = [{ value: "", label: "Todas las especialidades" }];
    specialties
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((specialty) => {
        options.push({
          value: specialty.id,
          label: specialty.name,
        });
      });
    return options;
  }, [specialties]);

  const handleOpenModal = () => {
    if (existingRotation) {
      // Cargar datos existentes
      setFormData({
        latitude: existingRotation.latitude,
        longitude: existingRotation.longitude,
        start_date: new Date(existingRotation.start_date),
        end_date: existingRotation.end_date
          ? new Date(existingRotation.end_date)
          : null,
        phone: userProfile?.phone || "",
      });
      setHasEndDate(!!existingRotation.end_date);
    } else {
      // Resetear formulario
      setFormData({
        latitude: 40.4168,
        longitude: -3.7038,
        start_date: new Date(),
        end_date: null,
        phone: userProfile?.phone || "",
      });
      setHasEndDate(false);
    }
    setShowAddModal(true);
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!formData.latitude || !formData.longitude) {
      Alert.alert("Error", "Las coordenadas son obligatorias");
      return;
    }

    if (!formData.start_date) {
      Alert.alert("Error", "La fecha de inicio es obligatoria");
      return;
    }

    const rotationData = {
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      start_date: formData.start_date.toISOString().split("T")[0],
      end_date:
        hasEndDate && formData.end_date
          ? formData.end_date.toISOString().split("T")[0]
          : null,
    };

    const success = existingRotation
      ? await updateRotation(existingRotation.id, rotationData, formData.phone)
      : await createRotation(rotationData, formData.phone);

    if (success) {
      setShowAddModal(false);
    }
  };

  const handleDelete = async (rotationId) => {
    const success = await deleteRotation(rotationId);
    if (success) {
      setShowDeleteConfirm(null);
    }
  };

  // ============================================================================
  // REVIEW HANDLERS
  // ============================================================================

  const handleStartReview = useCallback(() => {
    if (!existingRotation) {
      Alert.alert(
        "Rotación requerida",
        "Primero debes crear tu rotación externa para poder escribir una reseña"
      );
      return;
    }
    setReviewAnswers({});
    setReviewFreeComment("");
    setReviewHospitalName("");
    setReviewCity("");
    setReviewCountry("");
    loadReviewQuestions();
    setShowReviewModal(true);
    setIsEditingReview(false);
  }, [existingRotation, loadReviewQuestions]);

  const handleEditReview = useCallback(() => {
    loadReviewQuestions();
    setShowReviewModal(true);
    setIsEditingReview(true);
  }, [loadReviewQuestions]);

  // Cargar datos de reseña existente en el formulario
  useEffect(() => {
    if (existingReview && isEditingReview) {
      setReviewHospitalName(existingReview.external_hospital_name || "");
      setReviewCity(existingReview.city || "");
      setReviewCountry(existingReview.country || "");
      // Las respuestas se cargarían desde external_rotation_answer
      // Por ahora iniciamos vacío
      setReviewAnswers({});
      setReviewFreeComment("");
    }
  }, [existingReview, isEditingReview]);

  const handleReviewRatingChange = useCallback((questionId, rating) => {
    setReviewAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], rating },
    }));
  }, []);

  const handleReviewTextChange = useCallback((questionId, textValue) => {
    setReviewAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], textValue },
    }));
  }, []);

  const handleSubmitReview = useCallback(async () => {
    if (!existingRotation) {
      Alert.alert("Error", "No se encontró la rotación");
      return;
    }

    // Validar campos obligatorios
    if (
      !reviewHospitalName.trim() ||
      !reviewCity.trim() ||
      !reviewCountry.trim()
    ) {
      Alert.alert(
        "Campos obligatorios",
        "Por favor, completa el nombre del hospital, ciudad y país"
      );
      return;
    }

    // Validar preguntas obligatorias
    const unansweredRequired = reviewQuestions.filter((q) => {
      if (q.is_optional) return false;
      const answer = reviewAnswers[q.id];
      if (q.type === "rating") {
        return !answer?.rating;
      } else if (q.type === "text") {
        return !answer?.textValue || answer?.textValue.trim() === "";
      }
      return true;
    });

    if (unansweredRequired.length > 0) {
      Alert.alert(
        "Preguntas obligatorias",
        "Por favor, responde todas las preguntas obligatorias antes de enviar la reseña"
      );
      return;
    }

    // Formatear respuestas
    const formattedAnswers = Object.entries(reviewAnswers).map(
      ([questionId, answer]) => ({
        question_id: questionId,
        rating_value: answer.rating,
        text_value: answer.textValue,
      })
    );

    const reviewData = {
      userId,
      rotationId: existingRotation.id,
      externalHospitalName: reviewHospitalName.trim(),
      city: reviewCity.trim(),
      country: reviewCountry.trim(),
      answers: formattedAnswers,
    };

    let success = false;
    if (existingReview) {
      success = await updateReviewData(existingReview.id, reviewData);
    } else {
      success = await createReview(reviewData);
    }

    if (success) {
      setShowReviewModal(false);
      fetchReviews();
      checkExistingReview();
    }
  }, [
    existingRotation,
    reviewQuestions,
    reviewAnswers,
    reviewHospitalName,
    reviewCity,
    reviewCountry,
    userId,
    existingReview,
    updateReviewData,
    createReview,
    fetchReviews,
    checkExistingReview,
  ]);

  const handleDeleteReview = useCallback(async () => {
    if (!existingReview) return;

    const success = await deleteReviewData(existingReview.id);
    if (success) {
      setShowReviewDeleteConfirm(false);
      fetchReviews();
      checkExistingReview();
    }
  }, [existingReview, deleteReviewData, fetchReviews, checkExistingReview]);

  // Vista para no residentes
  if (!isResident) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Rotaciones Externas"
          subtitle="Funcionalidad para residentes"
          notificationCount={0}
          onNotificationPress={() => {}}
        />
        <View style={styles.messageCard}>
          <View style={styles.iconCircle}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={COLORS.ORANGE}
            />
          </View>
          <Text style={styles.messageTitle}>
            Funcionalidad solo para residentes
          </Text>
          <Text style={styles.messageText}>
            Esta funcionalidad está disponible únicamente para usuarios
            residentes.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Rotaciones Externas"
        subtitle={
          activeTab === "map"
            ? "Encuentra compañeros en tu destino"
            : "Reseñas de rotaciones externas"
        }
        notificationCount={0}
        onNotificationPress={() => {}}
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "map" && styles.activeTab]}
          onPress={() => setActiveTab("map")}
        >
          <Ionicons
            name="map"
            size={20}
            color={activeTab === "map" ? COLORS.PRIMARY : COLORS.GRAY}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "map" && styles.activeTabText,
            ]}
          >
            Mapa
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "reviews" && styles.activeTab]}
          onPress={() => setActiveTab("reviews")}
        >
          <Ionicons
            name="star"
            size={20}
            color={activeTab === "reviews" ? COLORS.PRIMARY : COLORS.GRAY}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "reviews" && styles.activeTabText,
            ]}
          >
            Reseñas
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* MAP TAB CONTENT */}
        {activeTab === "map" && (
          <>
            {/* Success Alert */}
            {success && (
              <View style={styles.successAlert}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={COLORS.SUCCESS}
                />
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertText}>{success}</Text>
                </View>
                <TouchableOpacity onPress={clearSuccess}>
                  <Ionicons name="close" size={20} color={COLORS.SUCCESS} />
                </TouchableOpacity>
              </View>
            )}

            {/* Error Alert */}
            {error && (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertText}>{error}</Text>
                </View>
                <TouchableOpacity onPress={clearError}>
                  <Ionicons name="close" size={20} color={COLORS.ERROR} />
                </TouchableOpacity>
              </View>
            )}

            {/* Filters */}
            <View style={styles.filtersContainer}>
              <SelectFilter
                label="Filtrar por especialidad"
                value={selectedSpecialty}
                onChange={setSelectedSpecialty}
                options={specialtyOptions}
                placeholder="Todas las especialidades"
              />

              <SelectFilter
                label="Filtrar por mes/año"
                value={selectedMonthYear}
                onChange={setSelectedMonthYear}
                options={monthYearOptions}
                placeholder="Todos los meses"
              />
            </View>

            {/* Map or List */}
            {MAP_AVAILABLE ? (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: 40.4168,
                    longitude: -3.7038,
                    latitudeDelta: 10,
                    longitudeDelta: 10,
                  }}
                  provider={PROVIDER_DEFAULT}
                >
                  {rotations.map((rotation) => {
                    const isOwnRotation = rotation.user_id === userId;
                    return (
                      <Marker
                        key={rotation.id}
                        coordinate={{
                          latitude: rotation.latitude,
                          longitude: rotation.longitude,
                        }}
                        pinColor={
                          isOwnRotation ? COLORS.SUCCESS : COLORS.PRIMARY
                        }
                      >
                        <Callout>
                          <View style={styles.calloutContainer}>
                            <Text style={styles.calloutName}>
                              {rotation.user_name} {rotation.user_surname}
                              {isOwnRotation && " (Tú)"}
                            </Text>
                            {rotation.user_email && (
                              <Text style={styles.calloutEmail}>
                                {rotation.user_email}
                              </Text>
                            )}
                            {rotation.user_phone && (
                              <Text style={styles.calloutPhone}>
                                {rotation.user_phone}
                              </Text>
                            )}
                            <Text style={styles.calloutDates}>
                              Desde:{" "}
                              {new Date(rotation.start_date).toLocaleDateString(
                                "es-ES"
                              )}
                            </Text>
                            <Text style={styles.calloutDates}>
                              Hasta:{" "}
                              {rotation.end_date
                                ? new Date(
                                    rotation.end_date
                                  ).toLocaleDateString("es-ES")
                                : "Actualidad"}
                            </Text>
                          </View>
                        </Callout>
                      </Marker>
                    );
                  })}
                </MapView>
              </View>
            ) : (
              <View style={styles.listContainer}>
                <View style={styles.mapUnavailableCard}>
                  <Ionicons name="map-outline" size={48} color={COLORS.GRAY} />
                  <Text style={styles.mapUnavailableTitle}>
                    Mapa no disponible
                  </Text>
                  <Text style={styles.mapUnavailableText}>
                    El mapa requiere un desarrollo build de Expo.
                  </Text>
                </View>

                {/* Lista de rotaciones */}
                {loading ? (
                  <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                ) : rotations.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="people-outline"
                      size={48}
                      color={COLORS.GRAY}
                    />
                    <Text style={styles.emptyStateText}>
                      No hay rotaciones externas para los filtros seleccionados
                    </Text>
                  </View>
                ) : (
                  rotations.map((rotation) => {
                    const isOwnRotation = rotation.user_id === userId;
                    return (
                      <View
                        key={rotation.id}
                        style={[
                          styles.rotationCard,
                          isOwnRotation && styles.ownRotationCard,
                        ]}
                      >
                        <View style={styles.rotationCardHeader}>
                          <Text style={styles.rotationCardName}>
                            {rotation.user_name} {rotation.user_surname}
                            {isOwnRotation && " (Tú)"}
                          </Text>
                        </View>
                        {rotation.user_email && (
                          <Text style={styles.rotationCardDetail}>
                            📧 {rotation.user_email}
                          </Text>
                        )}
                        {rotation.user_phone && (
                          <Text style={styles.rotationCardDetail}>
                            📞 {rotation.user_phone}
                          </Text>
                        )}
                        <Text style={styles.rotationCardDetail}>
                          📍 Lat: {rotation.latitude.toFixed(4)}, Lon:{" "}
                          {rotation.longitude.toFixed(4)}
                        </Text>
                        <Text style={styles.rotationCardDetail}>
                          📅 Desde:{" "}
                          {new Date(rotation.start_date).toLocaleDateString(
                            "es-ES"
                          )}
                        </Text>
                        <Text style={styles.rotationCardDetail}>
                          📅 Hasta:{" "}
                          {rotation.end_date
                            ? new Date(rotation.end_date).toLocaleDateString(
                                "es-ES"
                              )
                            : "Actualidad"}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* User's Rotations */}
            {userRotations.length > 0 && (
              <View style={styles.userRotationsContainer}>
                <Text style={styles.sectionTitle}>Mis Rotaciones Externas</Text>
                {userRotations.map((rotation) => (
                  <View key={rotation.id} style={styles.userRotationCard}>
                    <View style={styles.userRotationInfo}>
                      <Text style={styles.userRotationDate}>
                        📅 Desde:{" "}
                        {new Date(rotation.start_date).toLocaleDateString(
                          "es-ES"
                        )}
                      </Text>
                      <Text style={styles.userRotationDate}>
                        📅 Hasta:{" "}
                        {rotation.end_date
                          ? new Date(rotation.end_date).toLocaleDateString(
                              "es-ES"
                            )
                          : "Actualidad"}
                      </Text>
                      <Text style={styles.userRotationCoords}>
                        📍 Lat: {rotation.latitude.toFixed(4)}, Lon:{" "}
                        {rotation.longitude.toFixed(4)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => setShowDeleteConfirm(rotation.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={COLORS.ERROR}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Floating Action Button */}
            <TouchableOpacity style={styles.fab} onPress={handleOpenModal}>
              <Ionicons
                name={existingRotation ? "pencil" : "add"}
                size={24}
                color={COLORS.WHITE}
              />
            </TouchableOpacity>

            {/* Add/Edit Modal */}
            <Modal
              visible={showAddModal}
              transparent
              animationType="slide"
              onRequestClose={() => setShowAddModal(false)}
            >
              <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
              >
                <TouchableOpacity
                  style={styles.modalOverlayTouchable}
                  activeOpacity={1}
                  onPress={() => setShowAddModal(false)}
                />
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {existingRotation ? "Editar Rotación" : "Nueva Rotación"}
                    </Text>
                    <TouchableOpacity onPress={() => setShowAddModal(false)}>
                      <Ionicons
                        name="close"
                        size={24}
                        color={COLORS.GRAY_DARK}
                      />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.modalForm}
                    contentContainerStyle={styles.modalFormContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* Latitude */}
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Latitud *</Text>
                      <TextInput
                        style={styles.input}
                        value={String(formData.latitude)}
                        onChangeText={(text) =>
                          setFormData({ ...formData, latitude: text })
                        }
                        keyboardType="numeric"
                        placeholder="40.4168"
                      />
                    </View>

                    {/* Longitude */}
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Longitud *</Text>
                      <TextInput
                        style={styles.input}
                        value={String(formData.longitude)}
                        onChangeText={(text) =>
                          setFormData({ ...formData, longitude: text })
                        }
                        keyboardType="numeric"
                        placeholder="-3.7038"
                      />
                    </View>

                    {/* Start Date */}
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Fecha de inicio *</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowStartDatePicker(true)}
                      >
                        <Text style={styles.dateButtonText}>
                          {formData.start_date.toLocaleDateString("es-ES")}
                        </Text>
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color={COLORS.GRAY_DARK}
                        />
                      </TouchableOpacity>
                      {showStartDatePicker && (
                        <DateTimePicker
                          value={formData.start_date}
                          mode="date"
                          display={
                            Platform.OS === "ios" ? "spinner" : "default"
                          }
                          onChange={(event, selectedDate) => {
                            setShowStartDatePicker(Platform.OS === "ios");
                            if (selectedDate) {
                              setFormData({
                                ...formData,
                                start_date: selectedDate,
                              });
                            }
                          }}
                        />
                      )}
                    </View>

                    {/* End Date Checkbox */}
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => {
                        setHasEndDate(!hasEndDate);
                        if (hasEndDate) {
                          setFormData({ ...formData, end_date: null });
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          hasEndDate && styles.checkboxChecked,
                        ]}
                      >
                        {hasEndDate && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={COLORS.WHITE}
                          />
                        )}
                      </View>
                      <Text style={styles.checkboxLabel}>
                        ¿Tiene fecha de fin?
                      </Text>
                    </TouchableOpacity>

                    {/* End Date */}
                    {hasEndDate && (
                      <View style={styles.formField}>
                        <Text style={styles.formLabel}>Fecha de fin</Text>
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowEndDatePicker(true)}
                        >
                          <Text style={styles.dateButtonText}>
                            {formData.end_date
                              ? formData.end_date.toLocaleDateString("es-ES")
                              : "Seleccionar fecha"}
                          </Text>
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={COLORS.GRAY_DARK}
                          />
                        </TouchableOpacity>
                        {showEndDatePicker && (
                          <DateTimePicker
                            value={formData.end_date || new Date()}
                            mode="date"
                            display={
                              Platform.OS === "ios" ? "spinner" : "default"
                            }
                            onChange={(event, selectedDate) => {
                              setShowEndDatePicker(Platform.OS === "ios");
                              if (selectedDate) {
                                setFormData({
                                  ...formData,
                                  end_date: selectedDate,
                                });
                              }
                            }}
                            minimumDate={formData.start_date}
                          />
                        )}
                      </View>
                    )}

                    {/* Phone */}
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>Teléfono (opcional)</Text>
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
                  </ScrollView>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={COLORS.WHITE} />
                      ) : (
                        <Text style={styles.addButtonText}>
                          {existingRotation ? "Actualizar" : "Crear"}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setShowAddModal(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <Modal visible transparent animationType="fade">
                <View style={styles.confirmModalOverlay}>
                  <View style={styles.confirmModalContent}>
                    <Text style={styles.confirmModalTitle}>
                      Confirmar Eliminación
                    </Text>
                    <Text style={styles.confirmModalText}>
                      ¿Estás seguro de que quieres eliminar esta rotación?
                    </Text>
                    <View style={styles.confirmModalActions}>
                      <TouchableOpacity
                        style={styles.confirmModalCancel}
                        onPress={() => setShowDeleteConfirm(null)}
                      >
                        <Text style={styles.confirmModalCancelText}>
                          Cancelar
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmModalDelete}
                        onPress={() => handleDelete(showDeleteConfirm)}
                      >
                        <Text style={styles.confirmModalDeleteText}>
                          Eliminar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}
          </>
        )}

        {/* REVIEWS TAB CONTENT */}
        {activeTab === "reviews" && (
          <>
            {/* Success/Error Alerts */}
            {successReview && (
              <View style={styles.successAlert}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={COLORS.SUCCESS}
                />
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertText}>{successReview}</Text>
                </View>
                <TouchableOpacity onPress={clearReviewSuccess}>
                  <Ionicons name="close" size={20} color={COLORS.SUCCESS} />
                </TouchableOpacity>
              </View>
            )}

            {errorReview && (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertText}>{errorReview}</Text>
                </View>
                <TouchableOpacity onPress={clearReviewError}>
                  <Ionicons name="close" size={20} color={COLORS.ERROR} />
                </TouchableOpacity>
              </View>
            )}

            {/* User's Review Card */}
            {existingRotation && (
              <View style={styles.myReviewCard}>
                <Text style={styles.myReviewTitle}>Mi Reseña</Text>
                {existingReview ? (
                  <View style={styles.myReviewContent}>
                    <View style={styles.myReviewHeader}>
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={COLORS.SUCCESS}
                      />
                      <Text style={styles.myReviewStatusText}>
                        Reseña enviada
                        {existingReview.is_approved
                          ? " y aprobada"
                          : " (pendiente de aprobación)"}
                      </Text>
                    </View>
                    <View style={styles.myReviewActions}>
                      <TouchableOpacity
                        style={styles.myReviewEditButton}
                        onPress={handleEditReview}
                      >
                        <Ionicons
                          name="pencil"
                          size={18}
                          color={COLORS.PRIMARY}
                        />
                        <Text style={styles.myReviewEditText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.myReviewDeleteButton}
                        onPress={() => setShowReviewDeleteConfirm(true)}
                      >
                        <Ionicons name="trash" size={18} color={COLORS.ERROR} />
                        <Text style={styles.myReviewDeleteText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.myReviewEmpty}>
                    <Ionicons
                      name="star-outline"
                      size={48}
                      color={COLORS.GRAY}
                    />
                    <Text style={styles.myReviewEmptyText}>
                      Aún no has creado una reseña de tu rotación externa
                    </Text>
                    <TouchableOpacity
                      style={styles.createReviewButton}
                      onPress={handleStartReview}
                    >
                      <Ionicons name="add" size={20} color={COLORS.WHITE} />
                      <Text style={styles.createReviewButtonText}>
                        Crear Reseña
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {!existingRotation && (
              <View style={styles.infoCard}>
                <Ionicons
                  name="information-circle"
                  size={32}
                  color={COLORS.ORANGE}
                />
                <Text style={styles.infoCardText}>
                  Para poder crear una reseña, primero debes registrar tu
                  rotación externa en la pestaña "Mapa".
                </Text>
                <TouchableOpacity
                  style={styles.goToMapButton}
                  onPress={() => setActiveTab("map")}
                >
                  <Text style={styles.goToMapButtonText}>Ir al Mapa</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Reviews List */}
            {loadingReviews ? (
              <ActivityIndicator
                size="large"
                color={COLORS.PRIMARY}
                style={styles.loader}
              />
            ) : allReviews.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="star-outline" size={48} color={COLORS.GRAY} />
                <Text style={styles.emptyStateText}>
                  No hay reseñas de rotaciones externas disponibles
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>
                  Reseñas de la Comunidad ({allReviews.length})
                </Text>
                {allReviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewCardHeader}>
                      <Ionicons
                        name="business"
                        size={20}
                        color={COLORS.PRIMARY}
                      />
                      <Text style={styles.reviewHospitalName}>
                        {review.external_hospital_name}
                      </Text>
                    </View>
                    <Text style={styles.reviewLocation}>
                      {review.city}, {review.country}
                    </Text>
                    {review.external_rotation && (
                      <Text style={styles.reviewDates}>
                        {formatShortDate(review.external_rotation.start_date)}
                        {review.external_rotation.end_date &&
                          ` - ${formatShortDate(
                            review.external_rotation.end_date
                          )}`}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowReviewModal(false)}
          />
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditingReview ? "Editar Reseña" : "Nueva Reseña"}
              </Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalForm}
              contentContainerStyle={styles.modalFormContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {loadingQuestions ? (
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              ) : (
                <>
                  {/* Hospital Info Fields */}
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>
                      Nombre del Hospital{" "}
                      <Text style={styles.requiredIndicator}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={reviewHospitalName}
                      onChangeText={setReviewHospitalName}
                      placeholder="Hospital Universitario..."
                    />
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>
                      Ciudad <Text style={styles.requiredIndicator}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={reviewCity}
                      onChangeText={setReviewCity}
                      placeholder="Barcelona, Madrid..."
                    />
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>
                      País <Text style={styles.requiredIndicator}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={reviewCountry}
                      onChangeText={setReviewCountry}
                      placeholder="España, Francia..."
                    />
                  </View>

                  <View style={styles.sectionDivider}>
                    <Text style={styles.sectionDividerText}>
                      Preguntas sobre la rotación
                    </Text>
                  </View>

                  {reviewQuestions.map((question) => (
                    <View key={question.id} style={styles.questionContainer}>
                      <Text style={styles.questionText}>
                        {question.question_text}
                        {!question.is_optional && (
                          <Text style={styles.requiredIndicator}> *</Text>
                        )}
                      </Text>

                      {question.type === "rating" && (
                        <StarRating
                          rating={reviewAnswers[question.id]?.rating || 0}
                          onRatingChange={(rating) =>
                            handleReviewRatingChange(question.id, rating)
                          }
                          size={32}
                        />
                      )}

                      {question.type === "text" && (
                        <TextInput
                          style={styles.textInput}
                          value={reviewAnswers[question.id]?.textValue || ""}
                          onChangeText={(text) =>
                            handleReviewTextChange(question.id, text)
                          }
                          placeholder="Escribe tu respuesta..."
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                        />
                      )}
                    </View>
                  ))}

                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>
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

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleSubmitReview}
                disabled={loadingReview}
              >
                {loadingReview ? (
                  <ActivityIndicator color={COLORS.WHITE} />
                ) : (
                  <Text style={styles.addButtonText}>
                    {isEditingReview ? "Actualizar Reseña" : "Crear Reseña"}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowReviewModal(false)}
                disabled={loadingReview}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Review Confirmation */}
      {showReviewDeleteConfirm && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReviewDeleteConfirm(false)}
        >
          <View style={styles.confirmModalOverlay}>
            <View style={styles.confirmModalContent}>
              <Text style={styles.confirmModalTitle}>Eliminar Reseña</Text>
              <Text style={styles.confirmModalText}>
                ¿Estás seguro de que quieres eliminar esta reseña? Esta acción
                no se puede deshacer.
              </Text>
              <View style={styles.confirmModalActions}>
                <TouchableOpacity
                  style={styles.confirmModalCancel}
                  onPress={() => setShowReviewDeleteConfirm(false)}
                >
                  <Text style={styles.confirmModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmModalDelete}
                  onPress={handleDeleteReview}
                >
                  <Text style={styles.confirmModalDeleteText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    paddingBottom: 100,
  },
  // Tabs
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: COLORS.PRIMARY,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.GRAY,
  },
  activeTabText: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  loader: {
    marginTop: 32,
  },
  // Reviews Tab Styles
  myReviewCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  myReviewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  myReviewContent: {
    gap: 12,
  },
  myReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  myReviewStatusText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  myReviewActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  myReviewEditButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.PRIMARY + "15",
    paddingVertical: 10,
    borderRadius: 8,
  },
  myReviewEditText: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
    fontSize: 14,
  },
  myReviewDeleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.ERROR + "15",
    paddingVertical: 10,
    borderRadius: 8,
  },
  myReviewDeleteText: {
    color: COLORS.ERROR,
    fontWeight: "600",
    fontSize: 14,
  },
  myReviewEmpty: {
    alignItems: "center",
    paddingVertical: 20,
  },
  myReviewEmptyText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  createReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createReviewButtonText: {
    color: COLORS.WHITE,
    fontWeight: "600",
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoCardText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    lineHeight: 20,
  },
  goToMapButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  goToMapButtonText: {
    color: COLORS.WHITE,
    fontWeight: "600",
    fontSize: 14,
  },
  reviewCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  reviewHospitalName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  reviewLocation: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginBottom: 4,
  },
  reviewDates: {
    fontSize: 13,
    color: COLORS.GRAY,
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
  requiredIndicator: {
    color: COLORS.ERROR,
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
  sectionDivider: {
    marginVertical: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.BORDER,
  },
  sectionDividerText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY,
    textAlign: "center",
  },
  messageCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 32,
    margin: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.ORANGE + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
    textAlign: "center",
  },
  messageText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  successAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SUCCESS + "20",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.ERROR + "20",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
  },
  filtersContainer: {
    gap: 16,
    marginBottom: 16,
  },
  mapContainer: {
    height: 400,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  map: {
    flex: 1,
  },
  calloutContainer: {
    padding: 8,
    minWidth: 200,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  calloutEmail: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginBottom: 2,
  },
  calloutPhone: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginBottom: 2,
  },
  calloutDates: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  listContainer: {
    gap: 12,
  },
  mapUnavailableCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  mapUnavailableTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginTop: 12,
    marginBottom: 4,
  },
  mapUnavailableText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  emptyState: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    marginTop: 12,
  },
  rotationCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ownRotationCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.SUCCESS,
  },
  rotationCardHeader: {
    marginBottom: 8,
  },
  rotationCardName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  rotationCardDetail: {
    fontSize: 13,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  userRotationsContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  userRotationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SUCCESS + "20",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS + "40",
  },
  userRotationInfo: {
    flex: 1,
  },
  userRotationDate: {
    fontSize: 13,
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  userRotationCoords: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  modalForm: {
    flex: 1,
  },
  modalFormContent: {
    padding: 20,
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
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
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    gap: 12,
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  addButtonText: {
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
  // Confirmation modal
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmModalContent: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  confirmModalText: {
    fontSize: 16,
    color: COLORS.GRAY,
    marginBottom: 24,
  },
  confirmModalActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmModalCancel: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmModalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  confirmModalDelete: {
    flex: 1,
    backgroundColor: COLORS.ERROR,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmModalDeleteText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
});
