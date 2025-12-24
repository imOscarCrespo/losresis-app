import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { useExternalRotations } from "../hooks/useExternalRotations";
import { useResidentReviewCheck } from "../hooks/useResidentReviewCheck";
import {
  useExternalRotationReview,
  useExternalRotationReviewsList,
} from "../hooks/useExternalRotationReviews";
import {
  ScreenHeader,
  SelectFilter,
  ConfirmationModal,
  RotationModal,
  RotationReviewModal,
  MyRotationReviewCard,
  RotationMap,
  RotationCard,
  RotationReviewListCard,
  FloatingActionButton,
} from "../components";
import { supabase } from "../config/supabase";

/**
 * Pantalla de Rotaciones Externas - Refactorizada
 * Permite ver y gestionar rotaciones externas de residentes
 */
export const ExternalRotationsScreen = ({ userProfile, navigation }) => {
  const userId = userProfile?.id;
  const isResident = userProfile?.is_resident;

  // Tab state
  const [activeTab, setActiveTab] = useState("map");

  // Modals state
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [showRotationDeleteConfirm, setShowRotationDeleteConfirm] =
    useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReviewDeleteConfirm, setShowReviewDeleteConfirm] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);

  // Filters state
  const [specialties, setSpecialties] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedMonthYear, setSelectedMonthYear] = useState("");

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

  // Hooks de rotaciones
  const {
    rotations,
    userRotations,
    loading: loadingRotations,
    error: errorRotations,
    success: successRotations,
    createRotation,
    updateRotation,
    deleteRotation,
    clearError: clearRotationError,
    clearSuccess: clearRotationSuccess,
  } = useExternalRotations(userId, selectedSpecialty, selectedMonthYear);

  const existingRotation = userRotations.length > 0 ? userRotations[0] : null;

  // Hooks de reseñas
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

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

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

  // ============================================================================
  // ROTATION HANDLERS
  // ============================================================================

  const handleOpenRotationModal = () => {
    setShowRotationModal(true);
  };

  const handleSubmitRotation = async (formData, hasEndDate) => {
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
      setShowRotationModal(false);
    }
  };

  const handleDeleteRotation = async () => {
    if (!showRotationDeleteConfirm) return;

    const success = await deleteRotation(showRotationDeleteConfirm);
    if (success) {
      setShowRotationDeleteConfirm(null);
    }
  };

  // ============================================================================
  // REVIEW HANDLERS
  // ============================================================================

  const handleStartReview = () => {
    if (!existingRotation) {
      Alert.alert(
        "Rotación requerida",
        "Primero debes crear tu rotación externa para poder escribir una reseña"
      );
      return;
    }
    loadReviewQuestions();
    setShowReviewModal(true);
    setIsEditingReview(false);
  };

  const handleEditReview = () => {
    loadReviewQuestions();
    setShowReviewModal(true);
    setIsEditingReview(true);
  };

  const handleSubmitReview = async (reviewData) => {
    if (!existingRotation) {
      Alert.alert("Error", "No se encontró la rotación");
      return;
    }

    // Validar campos obligatorios
    if (
      !reviewData.hospitalName.trim() ||
      !reviewData.city.trim() ||
      !reviewData.country.trim()
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
      const answer = reviewData.answers[q.id];
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
    const formattedAnswers = Object.entries(reviewData.answers).map(
      ([questionId, answer]) => ({
        question_id: questionId,
        rating_value: answer.rating,
        text_value: answer.textValue,
      })
    );

    const reviewPayload = {
      userId,
      rotationId: existingRotation.id,
      externalHospitalName: reviewData.hospitalName.trim(),
      city: reviewData.city.trim(),
      country: reviewData.country.trim(),
      answers: formattedAnswers,
    };

    let success = false;
    if (existingReview) {
      success = await updateReviewData(existingReview.id, reviewPayload);
    } else {
      success = await createReview(reviewPayload);
    }

    if (success) {
      setShowReviewModal(false);
      fetchReviews();
      checkExistingReview();
    }
  };

  const handleDeleteReview = async () => {
    if (!existingReview) return;

    const success = await deleteReviewData(existingReview.id);
    if (success) {
      setShowReviewDeleteConfirm(false);
      fetchReviews();
      checkExistingReview();
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderAlerts = () => (
    <>
      {successRotations && (
        <View style={styles.successAlert}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.SUCCESS} />
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertText}>{successRotations}</Text>
          </View>
          <TouchableOpacity onPress={clearRotationSuccess}>
            <Ionicons name="close" size={20} color={COLORS.SUCCESS} />
          </TouchableOpacity>
        </View>
      )}

      {errorRotations && (
        <View style={styles.errorAlert}>
          <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertText}>{errorRotations}</Text>
          </View>
          <TouchableOpacity onPress={clearRotationError}>
            <Ionicons name="close" size={20} color={COLORS.ERROR} />
          </TouchableOpacity>
        </View>
      )}

      {successReview && (
        <View style={styles.successAlert}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.SUCCESS} />
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
    </>
  );

  const renderMapTab = () => (
    <>
      {renderAlerts()}

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

      {/* Map */}
      <RotationMap
        rotations={rotations}
        userId={userId}
        loading={loadingRotations}
      />

      {/* Lista de rotaciones (fallback si no hay mapa) */}
      {rotations.length > 0 && (
        <View style={styles.listContainer}>
          {rotations.map((rotation) => (
            <RotationCard
              key={rotation.id}
              rotation={rotation}
              isOwn={rotation.user_id === userId}
            />
          ))}
        </View>
      )}

      {/* User's Rotations */}
      {userRotations.length > 0 && (
        <View style={styles.userRotationsContainer}>
          <Text style={styles.sectionTitle}>Mis Rotaciones Externas</Text>
          {userRotations.map((rotation) => (
            <RotationCard
              key={rotation.id}
              rotation={rotation}
              isOwn={true}
              onDelete={() => setShowRotationDeleteConfirm(rotation.id)}
            />
          ))}
        </View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenRotationModal}>
        <Ionicons
          name={existingRotation ? "pencil" : "add"}
          size={24}
          color={COLORS.WHITE}
        />
      </TouchableOpacity>
    </>
  );

  const renderReviewsTab = () => (
    <>
      {renderAlerts()}

      {/* User's Review Card */}
      {existingRotation && (
        <MyRotationReviewCard
          existingReview={existingReview}
          onEdit={handleEditReview}
          onDelete={() => setShowReviewDeleteConfirm(true)}
          onCreate={handleStartReview}
        />
      )}

      {/* Info para crear rotación primero */}
      {!existingRotation && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={32} color={COLORS.ORANGE} />
          <Text style={styles.infoCardText}>
            Para poder crear una reseña, primero debes registrar tu rotación
            externa en la pestaña "Mapa".
          </Text>
          <TouchableOpacity
            style={styles.goToMapButton}
            onPress={() => setActiveTab("map")}
          >
            <Text style={styles.goToMapButtonText}>Ir al Mapa</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

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
            : "Mi Reseña"
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
            Mi Reseña
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === "map" ? renderMapTab() : renderReviewsTab()}
      </ScrollView>

      {/* Floating Action Button - Solo en tab de reseñas y si hay rotación */}
      {activeTab === "reviews" && existingRotation && (
        <FloatingActionButton
          onPress={existingReview ? handleEditReview : handleStartReview}
          icon={existingReview ? "pencil" : "add"}
          backgroundColor={COLORS.PRIMARY}
          bottom={20}
          right={20}
        />
      )}

      {/* Modals */}
      <RotationModal
        visible={showRotationModal}
        onClose={() => setShowRotationModal(false)}
        onSubmit={handleSubmitRotation}
        existingRotation={existingRotation}
        userPhone={userProfile?.phone}
        loading={loadingRotations}
      />

      <ConfirmationModal
        visible={!!showRotationDeleteConfirm}
        title="Confirmar Eliminación"
        message="¿Estás seguro de que quieres eliminar esta rotación?"
        onConfirm={handleDeleteRotation}
        onCancel={() => setShowRotationDeleteConfirm(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      <RotationReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
        existingReview={existingReview}
        questions={reviewQuestions}
        loadingQuestions={loadingQuestions}
        loading={loadingReview}
        isEditing={isEditingReview}
      />

      <ConfirmationModal
        visible={showReviewDeleteConfirm}
        title="Eliminar Reseña"
        message="¿Estás seguro de que quieres eliminar esta reseña? Esta acción no se puede deshacer."
        onConfirm={handleDeleteReview}
        onCancel={() => setShowReviewDeleteConfirm(false)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

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
  listContainer: {
    gap: 12,
    marginBottom: 16,
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
});
