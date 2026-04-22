import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ScreenHeader";
import { KeyboardAwareScrollView } from "../components/KeyboardAwareScrollView";
import { useReviewDetail } from "../hooks/useReviewDetail";
import { formatLongDate } from "../utils/dateUtils";
import { StudentQuestionsSection } from "../components/StudentQuestionsSection";
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
const WARNING = "#FBBF24";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_SIZE = (SCREEN_WIDTH - 64) / 4;

// ============================================================================
// STAR RATING
// ============================================================================

const StarRating = React.memo(({ rating }) => {
  if (!rating || rating < 0 || rating > 5) return null;
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={16}
          color={star <= rating ? WARNING : "#CBD5E1"}
        />
      ))}
      <Text style={styles.ratingLabel}>({rating}/5)</Text>
    </View>
  );
});

StarRating.displayName = "StarRating";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ReviewDetailScreen({
  reviewId,
  onBack,
  userProfile,
  highlightedQuestionId = null,
  onHighlightedQuestionHandled,
}) {
  const { review, loading, error, fetchReviewDetail } = useReviewDetail();
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    posthogLogger.logScreen("ReviewDetailScreen", { reviewId });
  }, [reviewId]);

  useEffect(() => {
    if (!reviewId) {
      console.warn("ReviewDetailScreen: reviewId is required");
      return;
    }
    fetchReviewDetail(reviewId);
  }, [reviewId, fetchReviewDetail]);

  const { ratingAnswers, textAnswers } = useMemo(() => {
    if (!review?.answers || !Array.isArray(review.answers)) {
      return { ratingAnswers: [], textAnswers: [] };
    }
    return {
      ratingAnswers: review.answers.filter(
        (a) => a.question?.type === "rating"
      ),
      textAnswers: review.answers.filter(
        (a) => a.question?.type === "text"
      ),
    };
  }, [review?.answers]);

  const getImageUrl = useCallback((imagePath) => {
    if (!imagePath) return "";
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/storage/v1/object/public/review-images/${imagePath}`;
  }, []);

  const handleCloseImageModal = useCallback(() => setSelectedImage(null), []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Reseñas" onBack={onBack} compact />
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
        <ScreenHeader title="Reseñas" onBack={onBack} compact />
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
      <ScreenHeader title="Reseñas" onBack={onBack} compact />

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        bottomPadding={32}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información de la reseña</Text>

          {/* User row */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="person" size={18} color={TEXT_MEDIUM} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>
                {review.is_anonymous
                  ? "Residente Anónimo"
                  : `${review.user?.name || ""} ${review.user?.surname || ""}`.trim() || "Usuario"}
              </Text>
              <Text style={styles.infoLabel}>
                {review.is_anonymous
                  ? "Reseña anónima"
                  : review.user?.resident_year
                  ? `R${review.user.resident_year} · Residente`
                  : "Usuario"}
              </Text>
              <View style={styles.badgesRow}>
                {review.is_anonymous && (
                  <View style={styles.badgeGray}>
                    <Text style={styles.badgeGrayText}>Anónima</Text>
                  </View>
                )}
                {review.approved_at ? (
                  <View style={styles.badgeGreen}>
                    <Ionicons name="checkmark-circle" size={12} color={SECONDARY} />
                    <Text style={styles.badgeGreenText}>Aprobada</Text>
                  </View>
                ) : (
                  <View style={styles.badgeOrange}>
                    <Ionicons name="time-outline" size={12} color="#D97706" />
                    <Text style={styles.badgeOrangeText}>Pendiente</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Date row */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="calendar-outline" size={18} color={TEXT_MEDIUM} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>{formatLongDate(review.created_at)}</Text>
              <Text style={styles.infoLabel}>Fecha de publicación</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Hospital row */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="business" size={18} color={PRIMARY} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>{review.hospital?.name}</Text>
              <Text style={styles.infoLabel}>
                {review.hospital?.city}, {review.hospital?.region}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Specialty row */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="school" size={18} color={PRIMARY} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>{review.speciality?.name}</Text>
              <Text style={styles.infoLabel}>Especialidad</Text>
            </View>
          </View>
        </View>

        {/* Answers card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Respuestas</Text>

          {review.answers && review.answers.length > 0 ? (
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
                          {answer.question?.text}
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
              <Ionicons name="chatbubbles-outline" size={40} color={TEXT_LIGHT} />
              <Text style={styles.emptyInCardText}>
                No hay respuestas registradas para esta reseña.
              </Text>
            </View>
          )}
        </View>

        {/* Free comment */}
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

        {/* Images */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Imágenes
            {review.images && review.images.length > 0
              ? ` (${review.images.length})`
              : ""}
          </Text>
          {review.images && review.images.length > 0 ? (
            <View style={styles.imagesGrid}>
              {review.images.map((image) => (
                <TouchableOpacity
                  key={image.id}
                  style={styles.imageTile}
                  onPress={() => setSelectedImage(getImageUrl(image.path))}
                  activeOpacity={0.8}
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
            <View style={styles.emptyInCard}>
              <Ionicons name="images-outline" size={40} color={TEXT_LIGHT} />
              <Text style={styles.emptyInCardText}>
                No hay imágenes en esta reseña
              </Text>
            </View>
          )}
        </View>

        {/* Student questions */}
        {userProfile && review?.hospital_id && review?.speciality_id && (
          <StudentQuestionsSection
            hospitalId={review.hospital_id}
            specialityId={review.speciality_id}
            userProfile={userProfile}
            highlightedQuestionId={highlightedQuestionId}
            onHighlightedQuestionHandled={onHighlightedQuestionHandled}
          />
        )}

        <View style={{ height: 24 }} />
      </KeyboardAwareScrollView>

      {/* Image lightbox modal */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseImageModal}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={handleCloseImageModal}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={26} color={WHITE} />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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

  // ── Info rows ──
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: BG_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
    gap: 3,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
    lineHeight: 21,
  },
  infoLabel: {
    fontSize: 12,
    color: TEXT_MEDIUM,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 12,
  },

  // ── Badges ──
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  badgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${SECONDARY}15`,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${SECONDARY}30`,
  },
  badgeGreenText: {
    fontSize: 11,
    fontWeight: "700",
    color: SECONDARY,
  },
  badgeOrange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  badgeOrangeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  badgeGray: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${PRIMARY}10`,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
  },
  badgeGrayText: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
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
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingLabel: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    marginLeft: 6,
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

  // ── Free comment ──
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

  // ── Images ──
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageTile: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
  },
  image: {
    width: "100%",
    height: "100%",
  },

  // ── Lightbox ──
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxClose: {
    position: "absolute",
    top: 48,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
  },
});
