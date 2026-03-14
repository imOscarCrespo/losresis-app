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
import { StarRating } from "../components/StarRating";
import posthogLogger from "../services/posthogService";

// ============================================================================
// COLORS
// ============================================================================

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#F1F5F9";
const ERROR = "#EF4444";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RotationReviewDetailScreen({
  reviewId,
  onBack,
  userProfile,
}) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    posthogLogger.logScreen("RotationReviewDetailScreen", { reviewId });
  }, [reviewId]);

  useEffect(() => {
    const fetchReviewDetail = async () => {
      if (!reviewId) {
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
        setError(err.message || "Error al cargar la reseña");
      } finally {
        setLoading(false);
      }
    };
    fetchReviewDetail();
  }, [reviewId]);

  const { ratingAnswers, textAnswers } = useMemo(() => {
    if (
      !review?.external_rotation_review_answer ||
      !Array.isArray(review.external_rotation_review_answer)
    ) {
      return { ratingAnswers: [], textAnswers: [] };
    }
    return {
      ratingAnswers: review.external_rotation_review_answer.filter(
        (a) => a.external_rotation_question?.type === "rating"
      ),
      textAnswers: review.external_rotation_review_answer.filter(
        (a) => a.external_rotation_question?.type === "text"
      ),
    };
  }, [review?.external_rotation_review_answer]);

  // ── Back header ──
  const BackHeader = () => (
    <View style={styles.backHeader}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={ACCENT} />
        <Text style={styles.backBtnText}>Rotaciones</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <BackHeader />
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando reseña...</Text>
        </View>
      </View>
    );
  }

  if (error || !review) {
    return (
      <View style={styles.container}>
        <BackHeader />
        <View style={styles.stateContainer}>
          <View style={styles.stateIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={ERROR} />
          </View>
          <Text style={styles.errorTitle}>Error al cargar la reseña</Text>
          <Text style={styles.errorText}>
            {error || "No se pudo encontrar la reseña solicitada."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hospital info card */}
        <View style={styles.card}>
          {/* Hospital name */}
          <View style={styles.hospitalRow}>
            <View style={styles.hospitalIconWrap}>
              <Ionicons name="business" size={20} color={PRIMARY} />
            </View>
            <Text style={styles.hospitalName} numberOfLines={2}>
              {review.external_hospital_name}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Location */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="location-outline" size={17} color={TEXT_MEDIUM} />
            </View>
            <Text style={styles.infoText}>
              {review.city}, {review.country}
            </Text>
          </View>

          {/* Rotation dates */}
          {review.external_rotation && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="calendar-outline" size={17} color={TEXT_MEDIUM} />
              </View>
              <Text style={styles.infoText}>
                {formatShortDate(review.external_rotation.start_date)}
                {review.external_rotation.end_date &&
                  ` — ${formatShortDate(review.external_rotation.end_date)}`}
              </Text>
            </View>
          )}

          {/* Published date */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="time-outline" size={17} color={TEXT_MEDIUM} />
            </View>
            <Text style={styles.infoText}>
              {formatLongDate(review.created_at)}
            </Text>
          </View>
        </View>

        {/* Answers card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Respuestas</Text>

          {review.external_rotation_review_answer &&
          review.external_rotation_review_answer.length > 0 ? (
            <View>
              {/* Rating questions */}
              {ratingAnswers.length > 0 && (
                <View style={styles.answersSection}>
                  <View style={styles.sectionLabelRow}>
                    <View style={styles.sectionBar} />
                    <Text style={styles.sectionLabelText}>Valoraciones</Text>
                  </View>
                  <View style={styles.ratingList}>
                    {ratingAnswers.map((answer) => (
                      <View
                        key={`${answer.review_id}-${answer.question_id}`}
                        style={styles.ratingItem}
                      >
                        <Text style={styles.questionText}>
                          {answer.external_rotation_question?.text}
                        </Text>
                        {answer.rating_value && (
                          <View style={styles.ratingRow}>
                            <StarRating
                              rating={answer.rating_value}
                              size={18}
                              disabled
                            />
                            <Text style={styles.ratingLabel}>
                              ({answer.rating_value}/5)
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Text questions */}
              {textAnswers.length > 0 && (
                <View style={styles.answersSection}>
                  <View style={styles.sectionLabelRow}>
                    <View style={[styles.sectionBar, { backgroundColor: SECONDARY }]} />
                    <Text style={styles.sectionLabelText}>Comentarios</Text>
                  </View>
                  <View style={styles.textAnswersList}>
                    {textAnswers.map((answer) => (
                      <View
                        key={`${answer.review_id}-${answer.question_id}`}
                        style={styles.textAnswerItem}
                      >
                        <Text style={styles.questionText}>
                          {answer.external_rotation_question?.text}
                        </Text>
                        {answer.text_value && (
                          <View style={styles.textAnswerBox}>
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
            <View style={styles.emptyInCard}>
              <Ionicons name="document-text-outline" size={40} color={TEXT_LIGHT} />
              <Text style={styles.emptyInCardText}>
                No hay respuestas disponibles
              </Text>
            </View>
          )}
        </View>

        {/* Free comment card */}
        {review.free_comment && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Comentario adicional</Text>
            <View style={styles.commentBox}>
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color={PRIMARY}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.commentText}>{review.free_comment}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },

  // ── Back header ──
  backHeader: {
    backgroundColor: WHITE,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignSelf: "flex-start",
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: ACCENT,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
  },

  // ── States ──
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${ERROR}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 15,
    color: TEXT_MEDIUM,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: TEXT_MEDIUM,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Card ──
  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 16,
    letterSpacing: -0.1,
  },

  // ── Hospital card content ──
  hospitalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  hospitalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: `${PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hospitalName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: BG_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_MEDIUM,
    lineHeight: 18,
  },

  // ── Answers ──
  answersSection: {
    marginBottom: 20,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
  sectionLabelText: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  ratingList: {
    gap: 10,
  },
  ratingItem: {
    backgroundColor: BG_LIGHT,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  questionText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT,
    marginBottom: 10,
    lineHeight: 19,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingLabel: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    fontWeight: "600",
  },
  textAnswersList: {
    gap: 12,
  },
  textAnswerItem: {
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
    paddingLeft: 14,
  },
  textAnswerBox: {
    backgroundColor: BG_LIGHT,
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  textAnswerText: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    lineHeight: 19,
  },

  // ── Empty in card ──
  emptyInCard: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  emptyInCardText: {
    fontSize: 13,
    color: TEXT_LIGHT,
    textAlign: "center",
  },

  // ── Comment ──
  commentBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: `${PRIMARY}08`,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${PRIMARY}18`,
  },
  commentText: {
    flex: 1,
    fontSize: 14,
    color: ACCENT,
    lineHeight: 21,
  },
});
