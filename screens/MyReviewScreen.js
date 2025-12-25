import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StarRating } from "../components/StarRating";
import { ScreenHeader } from "../components/ScreenHeader";
import { useMyReview } from "../hooks/useMyReview";
import { useHospitals } from "../hooks/useHospitals";
import { formatShortDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";

/**
 * Pantalla para crear/editar/ver la reseña del usuario residente
 */
export default function MyReviewScreen({
  userProfile,
  navigation,
  onReviewCreated,
  onReviewDeleted,
}) {
  // Estados locales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [answers, setAnswers] = useState({});
  const [freeComment, setFreeComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Obtener datos del hospital y especialidad
  const { hospitals, specialties } = useHospitals();
  const hospital = hospitals.find((h) => h.id === userProfile?.hospital_id);
  const specialty = specialties.find(
    (s) => s.id === userProfile?.speciality_id
  );

  // Hook de reseña
  const {
    reviewQuestions,
    existingReview,
    loading,
    loadingQuestions,
    error,
    success,
    fetchReviewQuestions,
    handleCreateReview,
    handleUpdateReview,
    handleDeleteReview,
    clearError,
    clearSuccess,
  } = useMyReview(
    userProfile?.id,
    userProfile?.hospital_id,
    userProfile?.speciality_id
  );

  // Verificar si es residente
  const isResident = userProfile?.is_resident;

  // Cargar datos existentes en el formulario cuando se edita
  useEffect(() => {
    if (existingReview && existingReview.review_answer) {
      const existingAnswers = {};
      existingReview.review_answer.forEach((answer) => {
        if (answer.question_id) {
          existingAnswers[answer.question_id] = {
            rating: answer.rating_value || undefined,
            textValue: answer.text_value || undefined,
          };
        }
      });
      setAnswers(existingAnswers);
      setFreeComment(existingReview.free_comment || "");
      setIsAnonymous(existingReview.is_anonymous || false);
    }
  }, [existingReview]);

  // Handlers
  const handleStartReview = useCallback(() => {
    setAnswers({});
    setFreeComment("");
    setIsAnonymous(false);
    fetchReviewQuestions();
    setIsModalOpen(true);
    setIsEditing(false);
  }, [fetchReviewQuestions]);

  const handleEditReview = useCallback(() => {
    fetchReviewQuestions();
    setIsModalOpen(true);
    setIsEditing(true);
  }, [fetchReviewQuestions]);

  const handleRatingChange = useCallback((questionId, rating) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], rating },
    }));
  }, []);

  const handleTextChange = useCallback((questionId, textValue) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], textValue },
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validar preguntas obligatorias
    const unansweredRequired = reviewQuestions.filter((q) => {
      if (q.is_optional) return false;
      const answer = answers[q.id];
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
    const formattedAnswers = Object.entries(answers).map(
      ([questionId, answer]) => ({
        questionId,
        rating: answer.rating,
        textValue: answer.textValue,
      })
    );

    let success = false;
    if (existingReview) {
      success = await handleUpdateReview(
        existingReview.id,
        formattedAnswers,
        freeComment,
        isAnonymous
      );
    } else {
      const result = await handleCreateReview(
        formattedAnswers,
        freeComment,
        isAnonymous
      );
      success = !!result;
    }

    if (success) {
      setIsModalOpen(false);
      // Si se creó una nueva review (no se estaba editando), notificar al padre
      if (!existingReview && onReviewCreated) {
        onReviewCreated();
      }
    }
  }, [
    reviewQuestions,
    answers,
    freeComment,
    isAnonymous,
    existingReview,
    handleCreateReview,
    handleUpdateReview,
    onReviewCreated,
  ]);

  const handleCancel = useCallback(() => {
    setIsModalOpen(false);
    setIsEditing(false);
    clearError();
    clearSuccess();
  }, [clearError, clearSuccess]);

  const handleDelete = useCallback(async () => {
    if (!existingReview) return;

    const success = await handleDeleteReview(existingReview.id);
    if (success) {
      setShowDeleteConfirmation(false);
      setAnswers({});
      setFreeComment("");
      setIsAnonymous(false);
      // Notificar al padre que se eliminó la review
      if (onReviewDeleted) {
        onReviewDeleted();
      }
    }
  }, [existingReview, handleDeleteReview, onReviewDeleted]);

  // Si no es residente, mostrar mensaje
  if (!isResident) {
    return (
      <View style={styles.container}>
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

  // Si no tiene hospital o especialidad configurados
  if (!hospital || !specialty) {
    return (
      <View style={styles.container}>
        <View style={styles.messageCard}>
          <View style={styles.iconCircle}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={COLORS.ORANGE}
            />
          </View>
          <Text style={styles.messageTitle}>Perfil incompleto</Text>
          <Text style={styles.messageText}>
            Para crear una reseña, necesitas tener asignado un hospital y una
            especialidad en tu perfil.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        title="Mi Reseña"
        subtitle={
          existingReview
            ? "Gestiona tu reseña del hospital"
            : "Comparte tu experiencia como residente"
        }
        notificationCount={0}
        onNotificationPress={() => {
          // TODO: Implementar navegación a notificaciones
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Alert */}
        {success && (
          <View style={styles.successAlert}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.GREEN} />
            <View style={styles.alertTextContainer}>
              <Text style={styles.alertTitle}>
                {!existingReview
                  ? "Reseña eliminada"
                  : isEditing
                  ? "Reseña actualizada"
                  : "Reseña creada"}
              </Text>
              <Text style={styles.alertText}>
                {!existingReview
                  ? "Tu reseña ha sido eliminada correctamente."
                  : `Tu reseña ha sido ${
                      isEditing ? "actualizada" : "enviada"
                    } correctamente y está pendiente de moderación.`}
              </Text>
            </View>
            <TouchableOpacity onPress={clearSuccess} style={styles.alertClose}>
              <Ionicons name="close" size={20} color={COLORS.GREEN} />
            </TouchableOpacity>
          </View>
        )}

        {/* Error Alert */}
        {error && (
          <View style={styles.errorAlert}>
            <Ionicons name="alert-circle" size={20} color={COLORS.RED} />
            <View style={styles.alertTextContainer}>
              <Text style={styles.alertTitle}>Error</Text>
              <Text style={styles.alertText}>{error}</Text>
            </View>
            <TouchableOpacity onPress={clearError} style={styles.alertClose}>
              <Ionicons name="close" size={20} color={COLORS.RED} />
            </TouchableOpacity>
          </View>
        )}

        {/* Hospital y Especialidad Info */}
        <View style={styles.infoRow}>
          <View style={[styles.infoCard, styles.hospitalCard]}>
            <View style={styles.infoHeader}>
              <Ionicons name="business" size={24} color={COLORS.PRIMARY} />
              <Text style={styles.infoTitle}>Tu Hospital</Text>
            </View>
            <Text style={styles.infoValue}>{hospital.name}</Text>
            <Text style={styles.infoSubtext}>
              {hospital.city}, {hospital.region}
            </Text>
          </View>

          <View style={[styles.infoCard, styles.specialtyCard]}>
            <View style={styles.infoHeader}>
              <Ionicons name="school" size={24} color={COLORS.PURPLE} />
              <Text style={styles.infoTitle}>Tu Especialidad</Text>
            </View>
            <Text style={styles.infoValue}>{specialty.name}</Text>
            <Text style={styles.infoSubtext}>
              Año de residencia: R{userProfile.resident_year || "N/A"}
            </Text>
          </View>
        </View>

        {/* Estado de la Reseña */}
        <View style={styles.reviewStatusCard}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>
                Cargando información de reseña...
              </Text>
            </View>
          ) : existingReview ? (
            // Reseña existente
            <View>
              <View style={styles.reviewHeader}>
                <View>
                  <Text style={styles.reviewTitle}>Tu Reseña</Text>
                  <Text style={styles.reviewDate}>
                    Creada el {formatShortDate(existingReview.created_at)}
                  </Text>
                  <View style={styles.badgesRow}>
                    <View
                      style={[
                        styles.badge,
                        existingReview.is_approved
                          ? styles.badgeApproved
                          : styles.badgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          existingReview.is_approved
                            ? styles.badgeTextApproved
                            : styles.badgeTextPending,
                        ]}
                      >
                        {existingReview.is_approved
                          ? "Aprobada"
                          : "Pendiente de moderación"}
                      </Text>
                    </View>
                    {existingReview.is_anonymous && (
                      <View style={[styles.badge, styles.badgeAnonymous]}>
                        <Text
                          style={[styles.badgeText, styles.badgeTextAnonymous]}
                        >
                          Anónima
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    onPress={handleEditReview}
                    style={[styles.actionButton, styles.editButton]}
                  >
                    <Ionicons name="pencil" size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowDeleteConfirmation(true)}
                    style={[styles.actionButton, styles.deleteButton]}
                  >
                    <Ionicons name="trash" size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Mostrar respuestas existentes */}
              {existingReview.review_answer &&
                existingReview.review_answer.length > 0 && (
                  <View style={styles.answersSection}>
                    <Text style={styles.sectionTitle}>Respuestas:</Text>
                    {existingReview.review_answer.map((answer) => (
                      <View key={answer.question_id} style={styles.answerCard}>
                        <View style={styles.answerHeader}>
                          <Text style={styles.answerQuestion}>
                            {answer.question?.text}
                          </Text>
                          <View
                            style={[
                              styles.answerBadge,
                              answer.question?.type === "rating"
                                ? styles.answerBadgeRating
                                : styles.answerBadgeText,
                            ]}
                          >
                            <Text style={styles.answerBadgeText}>
                              {answer.question?.type === "rating"
                                ? "Rating"
                                : "Texto"}
                            </Text>
                          </View>
                        </View>
                        {answer.question?.type === "rating" &&
                          answer.rating_value && (
                            <View style={styles.answerRating}>
                              <StarRating
                                rating={answer.rating_value}
                                size={16}
                                disabled
                              />
                              <Text style={styles.ratingText}>
                                ({answer.rating_value}/5)
                              </Text>
                            </View>
                          )}
                        {answer.question?.type === "text" &&
                          answer.text_value && (
                            <View style={styles.answerTextBox}>
                              <Text style={styles.answerText}>
                                {answer.text_value}
                              </Text>
                            </View>
                          )}
                      </View>
                    ))}
                  </View>
                )}

              {/* Comentario libre */}
              {existingReview.free_comment && (
                <View style={styles.freeCommentSection}>
                  <Text style={styles.sectionTitle}>Comentario adicional:</Text>
                  <Text style={styles.freeCommentText}>
                    {existingReview.free_comment}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            // Sin reseña - Prompt para crear
            <View>
              <View style={styles.warningBanner}>
                <Ionicons name="alert-circle" size={20} color={COLORS.RED} />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Completa tu reseña</Text>
                  <Text style={styles.warningText}>
                    Para desbloquear todas las funcionalidades de la plataforma,
                    por favor añade tu reseña. ¡Ayudarás mucho a otros
                    estudiantes!
                  </Text>
                </View>
              </View>

              <View style={styles.createReviewSection}>
                <View style={styles.createReviewIcon}>
                  <Ionicons name="star" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.createReviewTitle}>
                  ¡Crea tu primera reseña!
                </Text>
                <Text style={styles.createReviewText}>
                  Ayuda a otros residentes compartiendo tu experiencia en{" "}
                  {hospital.name} - {specialty.name}
                </Text>
                <TouchableOpacity
                  onPress={handleStartReview}
                  style={styles.createReviewButton}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.createReviewButtonText}>
                    Añadir Reseña
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal de formulario de reseña */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        onRequestClose={handleCancel}
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEditing ? "Editar Reseña" : "Nueva Reseña"}
            </Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          {loadingQuestions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Cargando preguntas...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Toggle Anónimo */}
              <View style={styles.anonymousCard}>
                <View style={styles.anonymousHeader}>
                  <View style={styles.anonymousIcon}>
                    <Ionicons name="star" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.anonymousTextContainer}>
                    <Text style={styles.anonymousTitle}>Reseña Anónima</Text>
                    <Text style={styles.anonymousSubtitle}>
                      Tu reseña se mostrará de forma anónima a otros usuarios
                    </Text>
                  </View>
                  <Switch
                    value={isAnonymous}
                    onValueChange={setIsAnonymous}
                    trackColor={{
                      false: "#D1D5DB",
                      true: COLORS.PRIMARY,
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                {isAnonymous && (
                  <View style={styles.anonymousInfo}>
                    <Text style={styles.anonymousInfoText}>
                      <Text style={styles.anonymousInfoBold}>Información:</Text>{" "}
                      Tu reseña será visible para otros usuarios pero sin
                      mostrar tu nombre. Los administradores podrán ver tu
                      identidad para moderación.
                    </Text>
                  </View>
                )}
              </View>

              {/* Preguntas */}
              <View style={styles.questionsSection}>
                <Text style={styles.questionsSectionTitle}>
                  Evalúa los siguientes aspectos:
                </Text>
                {reviewQuestions.map((question) => (
                  <View key={question.id} style={styles.questionCard}>
                    <View style={styles.questionHeader}>
                      <View style={styles.questionTextContainer}>
                        <Text style={styles.questionText}>{question.text}</Text>
                        {question.is_optional && (
                          <Text style={styles.optionalText}>
                            ⓘ Esta pregunta es opcional
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.questionTypeBadge,
                          question.type === "rating"
                            ? styles.ratingBadge
                            : styles.textBadge,
                        ]}
                      >
                        <Text style={styles.questionTypeBadgeText}>
                          {question.type === "rating" ? "Rating" : "Texto"}
                        </Text>
                      </View>
                    </View>

                    {question.type === "rating" ? (
                      <View style={styles.ratingContainer}>
                        <StarRating
                          rating={answers[question.id]?.rating || 0}
                          onRatingChange={(rating) =>
                            handleRatingChange(question.id, rating)
                          }
                          size={28}
                        />
                        <Text style={styles.ratingLabel}>
                          {answers[question.id]?.rating
                            ? `${answers[question.id]?.rating}/5`
                            : "Sin calificar"}
                        </Text>
                      </View>
                    ) : (
                      <TextInput
                        style={styles.textInput}
                        multiline
                        numberOfLines={3}
                        value={answers[question.id]?.textValue || ""}
                        onChangeText={(text) =>
                          handleTextChange(question.id, text)
                        }
                        placeholder="Escribe tu respuesta aquí..."
                        placeholderTextColor={COLORS.GRAY}
                      />
                    )}
                  </View>
                ))}
              </View>

              {/* Comentario libre */}
              <View style={styles.freeCommentContainer}>
                <Text style={styles.freeCommentLabel}>
                  Comentario adicional (opcional)
                </Text>
                <TextInput
                  style={[styles.textInput, styles.freeCommentInput]}
                  multiline
                  numberOfLines={4}
                  value={freeComment}
                  onChangeText={setFreeComment}
                  placeholder="Comparte detalles adicionales sobre tu experiencia..."
                  placeholderTextColor={COLORS.GRAY}
                />
              </View>

              {/* Botones de acción */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={handleCancel}
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  style={[styles.modalButton, styles.submitButton]}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {isEditing ? "Actualizar Reseña" : "Enviar Reseña"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        visible={showDeleteConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContainer}>
            <Text style={styles.deleteModalTitle}>Confirmar Eliminación</Text>
            <Text style={styles.deleteModalText}>
              ¿Estás seguro de que quieres eliminar tu reseña? Esta acción no se
              puede deshacer y perderás todas las respuestas asociadas.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                onPress={() => setShowDeleteConfirmation(false)}
                style={[
                  styles.deleteModalButton,
                  styles.deleteModalCancelButton,
                ]}
                disabled={loading}
              >
                <Text style={styles.deleteModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={[
                  styles.deleteModalButton,
                  styles.deleteModalConfirmButton,
                ]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Eliminar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  messageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginTop: 32,
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
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
    textAlign: "center",
  },
  messageText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    lineHeight: 20,
  },
  successAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  alertTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 18,
  },
  alertClose: {
    padding: 4,
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  hospitalCard: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  specialtyCard: {
    backgroundColor: "#F5F3FF",
    borderColor: "#DDD6FE",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  reviewStatusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.GRAY,
  },
  reviewHeader: {
    marginBottom: 20,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeApproved: {
    backgroundColor: "#ECFDF5",
  },
  badgePending: {
    backgroundColor: "#FEF3C7",
  },
  badgeAnonymous: {
    backgroundColor: "#EFF6FF",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  badgeTextApproved: {
    color: "#059669",
  },
  badgeTextPending: {
    color: "#D97706",
  },
  badgeTextAnonymous: {
    color: "#2563EB",
  },
  reviewActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  editButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  deleteButton: {
    backgroundColor: COLORS.RED,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  answersSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  answerCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
    paddingLeft: 12,
    marginBottom: 16,
  },
  answerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  answerQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.GRAY_DARK,
    marginRight: 8,
  },
  answerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  answerBadgeRating: {
    backgroundColor: "#FEF3C7",
  },
  answerBadgeText: {
    backgroundColor: "#F5F3FF",
  },
  answerRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingText: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  answerTextBox: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },
  answerText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    lineHeight: 20,
  },
  freeCommentSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
  },
  freeCommentText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    lineHeight: 20,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  warningTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#991B1B",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: "#7F1D1D",
    lineHeight: 18,
  },
  createReviewSection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  createReviewIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createReviewTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  createReviewText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  createReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  createReviewButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  anonymousCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  anonymousHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  anonymousIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  anonymousTextContainer: {
    flex: 1,
  },
  anonymousTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 2,
  },
  anonymousSubtitle: {
    fontSize: 13,
    color: COLORS.GRAY,
  },
  anonymousInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#DBEAFE",
    borderRadius: 8,
  },
  anonymousInfoText: {
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
  anonymousInfoBold: {
    fontWeight: "600",
  },
  questionsSection: {
    marginBottom: 20,
  },
  questionsSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 16,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  questionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  questionText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  optionalText: {
    fontSize: 13,
    color: COLORS.PRIMARY,
  },
  questionTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingBadge: {
    backgroundColor: "#FEF3C7",
  },
  textBadge: {
    backgroundColor: "#F5F3FF",
  },
  questionTypeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ratingLabel: {
    fontSize: 13,
    color: COLORS.GRAY,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.GRAY_DARK,
    textAlignVertical: "top",
  },
  freeCommentContainer: {
    marginBottom: 20,
  },
  freeCommentLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  freeCommentInput: {
    minHeight: 100,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  deleteModalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: "100%",
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  deleteModalText: {
    fontSize: 14,
    color: COLORS.GRAY,
    lineHeight: 20,
    marginBottom: 20,
  },
  deleteModalActions: {
    flexDirection: "row",
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteModalCancelButton: {
    backgroundColor: "#F3F4F6",
  },
  deleteModalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  deleteModalConfirmButton: {
    backgroundColor: COLORS.RED,
  },
  deleteModalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
