import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getRotationReviewWithAnswers } from "../services/externalRotationReviewService";
import { formatLongDate, formatShortDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import { StarRating } from "../components/StarRating";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla de detalle de reseña de rotación externa
 */
export default function RotationReviewDetailScreen({
  reviewId,
  onBack,
  userProfile,
}) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("RotationReviewDetailScreen", { reviewId });
  }, [reviewId]);

  // Cargar detalle de la reseña
  useEffect(() => {
    const fetchReviewDetail = async () => {
      if (!reviewId) {
        console.warn("RotationReviewDetailScreen: reviewId is required");
        setError("ID de reseña requerido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getRotationReviewWithAnswers(reviewId);
        setReview(data);
      } catch (err) {
        console.error("Error fetching rotation review detail:", err);
        setError(err.message || "Error al cargar la reseña");
      } finally {
        setLoading(false);
      }
    };

    fetchReviewDetail();
  }, [reviewId]);

  // Separar respuestas por tipo
  const { ratingAnswers, textAnswers } = useMemo(() => {
    if (
      !review?.external_rotation_review_answer ||
      !Array.isArray(review.external_rotation_review_answer)
    ) {
      return { ratingAnswers: [], textAnswers: [] };
    }

    return {
      ratingAnswers: review.external_rotation_review_answer.filter(
        (answer) => answer.external_rotation_question?.type === "rating"
      ),
      textAnswers: review.external_rotation_review_answer.filter(
        (answer) => answer.external_rotation_question?.type === "text"
      ),
    };
  }, [review?.external_rotation_review_answer]);

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

      {/* Content */}
      <View style={styles.content}>
        {/* Hospital Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.hospitalInfo}>
              <Ionicons name="business" size={24} color={COLORS.PRIMARY} />
              <Text style={styles.hospitalName}>
                {review.external_hospital_name}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location" size={18} color={COLORS.GRAY} />
            <Text style={styles.infoText}>
              {review.city}, {review.country}
            </Text>
          </View>

          {review.external_rotation && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={18} color={COLORS.GRAY} />
              <Text style={styles.infoText}>
                {formatShortDate(review.external_rotation.start_date)}
                {review.external_rotation.end_date &&
                  ` - ${formatShortDate(review.external_rotation.end_date)}`}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="time" size={18} color={COLORS.GRAY} />
            <Text style={styles.infoText}>
              {formatLongDate(review.created_at)}
            </Text>
          </View>
        </View>

        {/* Answers Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Respuestas</Text>

          {review.external_rotation_review_answer &&
          review.external_rotation_review_answer.length > 0 ? (
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
                          {answer.external_rotation_question?.text}
                        </Text>
                        {answer.rating_value && (
                          <View style={styles.ratingContainer}>
                            <StarRating
                              rating={answer.rating_value}
                              size={20}
                              disabled
                            />
                            <Text style={styles.ratingText}>
                              ({answer.rating_value}/5)
                            </Text>
                          </View>
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
                          {answer.external_rotation_question?.text}
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
                name="document-text-outline"
                size={48}
                color={COLORS.GRAY}
              />
              <Text style={styles.emptyAnswersText}>
                No hay respuestas disponibles
              </Text>
            </View>
          )}
        </View>

        {/* Free Comment Card */}
        {review.free_comment && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Comentario adicional</Text>
            <View style={styles.commentContent}>
              <Text style={styles.commentText}>{review.free_comment}</Text>
            </View>
          </View>
        )}
      </View>
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
    color: COLORS.PRIMARY,
    fontWeight: "600",
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
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
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
  cardHeader: {
    marginBottom: 16,
  },
  hospitalInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  hospitalName: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 16,
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
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingText: {
    fontSize: 14,
    color: COLORS.GRAY,
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
  },
  commentContent: {
    backgroundColor: COLORS.GRAY_LIGHT,
    padding: 16,
    borderRadius: 12,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    lineHeight: 20,
  },
});
