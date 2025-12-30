import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReviewDetail } from "../hooks/useReviewDetail";
import { formatLongDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import { StudentQuestionsSection } from "../components/StudentQuestionsSection";
import posthogLogger from "../services/posthogService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_SIZE = (SCREEN_WIDTH - 64) / 4; // 4 columnas con padding

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Renderizar estrellas de rating
 * Memoizado para evitar re-renders innecesarios
 */
const StarRating = React.memo(({ rating }) => {
  if (!rating || rating < 0 || rating > 5) return null;

  return (
    <View style={styles.starContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={16}
          color={star <= rating ? COLORS.WARNING : COLORS.GRAY_LIGHT}
        />
      ))}
      <Text style={styles.ratingText}>({rating}/5)</Text>
    </View>
  );
});

StarRating.displayName = "StarRating";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Pantalla de detalle de reseña
 */
export default function ReviewDetailScreen({ reviewId, onBack, userProfile }) {
  const { review, loading, error, fetchReviewDetail } = useReviewDetail();
  const [selectedImage, setSelectedImage] = useState(null);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("ReviewDetailScreen", { reviewId });
  }, [reviewId]);

  // Validar reviewId
  useEffect(() => {
    if (!reviewId) {
      console.warn("ReviewDetailScreen: reviewId is required");
      return;
    }
    fetchReviewDetail(reviewId);
  }, [reviewId, fetchReviewDetail]);

  // Separar respuestas por tipo (memoizado)
  const { ratingAnswers, textAnswers } = useMemo(() => {
    if (!review?.answers || !Array.isArray(review.answers)) {
      return { ratingAnswers: [], textAnswers: [] };
    }

    return {
      ratingAnswers: review.answers.filter(
        (answer) => answer.question?.type === "rating"
      ),
      textAnswers: review.answers.filter(
        (answer) => answer.question?.type === "text"
      ),
    };
  }, [review?.answers]);

  // Obtener URL de Supabase para imágenes (memoizado)
  const getImageUrl = useCallback((imagePath) => {
    if (!imagePath) return "";
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      console.warn("EXPO_PUBLIC_SUPABASE_URL is not defined");
      return "";
    }
    return `${supabaseUrl}/storage/v1/object/public/review-images/${imagePath}`;
  }, []);

  // Manejar cierre del modal de imagen
  const handleCloseImageModal = useCallback(() => {
    setSelectedImage(null);
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
            <Text style={styles.backButtonText}>Volver al listado</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>
            Cargando detalle de la reseña...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !review) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
            <Text style={styles.backButtonText}>Volver al listado</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={COLORS.ERROR} />
          <Text style={styles.errorTitle}>Error al cargar la reseña</Text>
          <Text style={styles.errorText}>
            {error || "No se pudo encontrar la reseña solicitada."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.backButtonText}>Volver al listado</Text>
        </TouchableOpacity>
      </View>

      {/* Review Information Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Información de la Reseña</Text>

        <View style={styles.infoGrid}>
          {/* User Information */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={20} color={COLORS.GRAY} />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>
                  {review.is_anonymous ? (
                    <Text style={styles.anonymousText}>Residente Anónimo</Text>
                  ) : (
                    `${review.user?.name || ""} ${review.user?.surname || ""}`
                  )}
                </Text>
                <Text style={styles.infoLabel}>
                  {review.is_anonymous
                    ? "Reseña anónima"
                    : review.user?.resident_year
                    ? `R${review.user.resident_year} - Residente`
                    : "Usuario"}
                </Text>
                {review.is_anonymous && (
                  <View style={styles.anonymousBadge}>
                    <Text style={styles.anonymousBadgeText}>
                      Reseña Anónima
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Date and Status */}
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color={COLORS.GRAY} />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>
                  {formatLongDate(review.created_at)}
                </Text>
                <View style={styles.statusContainer}>
                  {review.approved_at ? (
                    <View style={styles.statusBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={COLORS.SUCCESS}
                      />
                      <Text style={styles.statusTextApproved}>Aprobada</Text>
                    </View>
                  ) : (
                    <View style={styles.statusBadgePending}>
                      <Ionicons name="time" size={16} color={COLORS.WARNING} />
                      <Text style={styles.statusTextPending}>
                        Pendiente de aprobación
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Hospital and Specialty */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Ionicons name="business" size={20} color={COLORS.PRIMARY} />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{review.hospital?.name}</Text>
                <Text style={styles.infoLabel}>
                  {review.hospital?.city}, {review.hospital?.region}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="school" size={20} color={COLORS.PURPLE} />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{review.speciality?.name}</Text>
                <Text style={styles.infoLabel}>Especialidad</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Answers Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Respuestas</Text>

        {review.answers && review.answers.length > 0 ? (
          <View>
            {/* Rating Questions */}
            {ratingAnswers.length > 0 && (
              <View style={styles.answersSection}>
                <Text style={styles.answersSectionTitle}>
                  Preguntas de Rating
                </Text>
                <View style={styles.ratingList}>
                  {ratingAnswers.map((answer) => (
                    <View
                      key={`${answer.review_id}-${answer.question_id}`}
                      style={styles.ratingCard}
                    >
                      <Text style={styles.questionText}>
                        {answer.question?.text}
                      </Text>
                      {answer.rating_value && (
                        <StarRating rating={answer.rating_value} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Text Questions */}
            {textAnswers.length > 0 && (
              <View style={styles.answersSection}>
                <Text style={styles.answersSectionTitle}>
                  Preguntas de Texto
                </Text>
                <View style={styles.textAnswersList}>
                  {textAnswers.map((answer) => (
                    <View
                      key={`${answer.review_id}-${answer.question_id}`}
                      style={styles.textAnswerCard}
                    >
                      <Text style={styles.questionText}>
                        {answer.question?.text}
                      </Text>
                      {answer.text_value && (
                        <View style={styles.textAnswerContent}>
                          <Text style={styles.textAnswerText}>
                            {answer.text_value}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyAnswersContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={COLORS.GRAY}
            />
            <Text style={styles.emptyAnswersText}>
              No hay respuestas registradas para esta reseña.
            </Text>
          </View>
        )}
      </View>

      {/* Free Comment */}
      {review.free_comment && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comentario adicional:</Text>
          <View style={styles.commentContainer}>
            <Text style={styles.commentText}>{review.free_comment}</Text>
          </View>
        </View>
      )}

      {/* Images */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Imágenes de la reseña{" "}
          {review.images &&
            review.images.length > 0 &&
            `(${review.images.length})`}
        </Text>
        {review.images && review.images.length > 0 ? (
          <View style={styles.imagesGrid}>
            {review.images.map((image) => (
              <TouchableOpacity
                key={image.id}
                style={styles.imageContainer}
                onPress={() => setSelectedImage(getImageUrl(image.path))}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: getImageUrl(image.path) }}
                  style={styles.image}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyImagesContainer}>
            <Ionicons name="images-outline" size={48} color={COLORS.GRAY} />
            <Text style={styles.emptyImagesText}>
              No hay imágenes en esta reseña
            </Text>
          </View>
        )}
      </View>

      {/* Student Questions Section */}
      {userProfile && review?.hospital_id && review?.speciality_id && (
        <StudentQuestionsSection
          hospitalId={review.hospital_id}
          specialityId={review.speciality_id}
          userProfile={userProfile}
        />
      )}

      {/* Image Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={handleCloseImageModal}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.PRIMARY,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 0,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 16,
  },
  infoGrid: {
    gap: 16,
  },
  infoSection: {
    gap: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  anonymousText: {
    color: COLORS.GRAY,
  },
  anonymousBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.GRAY_LIGHT,
    marginTop: 4,
  },
  anonymousBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  statusContainer: {
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusBadgePending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusTextApproved: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.SUCCESS,
  },
  statusTextPending: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.WARNING,
  },
  answersSection: {
    marginBottom: 24,
  },
  answersSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 16,
  },
  ratingList: {
    gap: 12,
  },
  ratingCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  questionText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
    lineHeight: 20,
  },
  starContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginLeft: 4,
    fontWeight: "600",
  },
  textAnswersList: {
    gap: 16,
  },
  textAnswerCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
    paddingLeft: 16,
    marginBottom: 4,
  },
  textAnswerContent: {
    backgroundColor: COLORS.GRAY_LIGHT,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  textAnswerText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    lineHeight: 20,
  },
  emptyAnswersContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyAnswersText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  commentContainer: {
    backgroundColor: COLORS.GRAY_LIGHT,
    padding: 16,
    borderRadius: 12,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    lineHeight: 20,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  emptyImagesContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyImagesText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalCloseButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
  },
  imageModalImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
  },
});
