import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "../components/KeyboardAwareScrollView";
import { KeyboardAwareTextInput } from "../components/KeyboardAwareTextInput";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { StarRating } from "../components/StarRating";
import { useMyReview } from "../hooks/useMyReview";
import { COLORS } from "../constants/colors";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = COLORS.BACKGROUND;
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#F1F5F9";

export default function ReviewComposerScreen({
  userProfile,
  mode = "create",
  onBack,
  onSuccess,
}) {
  const [answers, setAnswers] = useState({});
  const [freeComment, setFreeComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const {
    reviewQuestions,
    existingReview,
    loading,
    loadingQuestions,
    error,
    clearError,
    fetchReviewQuestions,
    handleCreateReview,
    handleUpdateReview,
  } = useMyReview(
    userProfile?.id,
    userProfile?.hospital_id,
    userProfile?.speciality_id
  );

  const isEditing = mode === "edit";

  useEffect(() => {
    fetchReviewQuestions();
  }, [fetchReviewQuestions]);

  useEffect(() => {
    if (!existingReview?.review_answer) return;

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
  }, [existingReview]);

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
    const unansweredRequired = reviewQuestions.filter((question) => {
      if (question.is_optional) return false;
      const answer = answers[question.id];
      if (question.type === "rating") return !answer?.rating;
      if (question.type === "text") {
        return !answer?.textValue || answer.textValue.trim() === "";
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

    const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      rating: answer.rating,
      textValue: answer.textValue,
    }));

    let ok = false;
    if (isEditing && existingReview?.id) {
      ok = await handleUpdateReview(
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
      ok = !!result;
    }

    if (ok) {
      onSuccess?.(isEditing ? "updated" : "created");
    }
  }, [
    answers,
    existingReview,
    freeComment,
    handleCreateReview,
    handleUpdateReview,
    isAnonymous,
    isEditing,
    onSuccess,
    reviewQuestions,
  ]);

  return (
    <HeroScreenLayout
      title={isEditing ? "Editar reseña" : "Nueva reseña"}
      onBack={onBack}
      contentStyle={styles.contentSurface}
      rightSlot={
        <TouchableOpacity
          style={[styles.headerAction, loading && styles.headerActionDisabled]}
          onPress={() => void handleSubmit()}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Text style={styles.headerCta}>
              {isEditing ? "Actualizar" : "Enviar"}
            </Text>
          )}
        </TouchableOpacity>
      }
    >
      {loadingQuestions || (isEditing && loading && !existingReview) ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando preguntas...</Text>
        </View>
      ) : (
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          bottomPadding={32}
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#B91C1C" />
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={18} color="#B91C1C" />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.anonCard}>
            <View style={styles.anonCardRow}>
              <View style={styles.anonCardIcon}>
                <Ionicons name="eye-off-outline" size={20} color={WHITE} />
              </View>
              <View style={styles.anonCardText}>
                <Text style={styles.anonCardTitle}>Reseña anónima</Text>
                <Text style={styles.anonCardSubtitle}>
                  Tu nombre no será visible para otros usuarios.
                </Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: "#D1D5DB", true: PRIMARY }}
                thumbColor={WHITE}
              />
            </View>
            {isAnonymous ? (
              <View style={styles.anonInfo}>
                <Text style={styles.anonInfoText}>
                  <Text style={styles.anonInfoStrong}>Nota: </Text>
                  Los administradores pueden ver tu identidad para moderación.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.questionsSection}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionLabelText}>
                Evalúa los siguientes aspectos
              </Text>
            </View>

            {reviewQuestions.map((question) => (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.questionHeaderRow}>
                  <View style={styles.questionHeaderText}>
                    <Text style={styles.questionText}>{question.text}</Text>
                    {question.is_optional ? (
                      <Text style={styles.optionalText}>Pregunta opcional</Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.typeBadge,
                      question.type === "rating"
                        ? styles.typeBadgeRating
                        : styles.typeBadgeText,
                    ]}
                  >
                    <Text style={styles.typeBadgeLabel}>
                      {question.type === "rating" ? "Rating" : "Texto"}
                    </Text>
                  </View>
                </View>

                {question.type === "rating" ? (
                  <View style={styles.ratingRow}>
                    <StarRating
                      rating={answers[question.id]?.rating || 0}
                      onRatingChange={(rating) =>
                        handleRatingChange(question.id, rating)
                      }
                      size={28}
                    />
                    <Text style={styles.ratingValue}>
                      {answers[question.id]?.rating
                        ? `${answers[question.id].rating}/5`
                        : "Sin calificar"}
                    </Text>
                  </View>
                ) : (
                  <KeyboardAwareTextInput
                    style={styles.textInput}
                    multiline
                    numberOfLines={3}
                    value={answers[question.id]?.textValue || ""}
                    onChangeText={(text) => handleTextChange(question.id, text)}
                    placeholder="Escribe tu respuesta aquí..."
                    placeholderTextColor={TEXT_LIGHT}
                    keyboardAwareOptions={{ extraScrollSpace: 40 }}
                  />
                )}
              </View>
            ))}
          </View>

          <View style={styles.freeCommentFormBlock}>
            <View style={styles.sectionLabelRow}>
              <View style={[styles.sectionBar, styles.sectionBarSecondary]} />
              <Text style={styles.sectionLabelText}>
                Comentario adicional (opcional)
              </Text>
            </View>
            <KeyboardAwareTextInput
              style={[styles.textInput, styles.freeCommentInput]}
              multiline
              value={freeComment}
              onChangeText={setFreeComment}
              placeholder="Comparte detalles adicionales sobre tu experiencia..."
              placeholderTextColor={TEXT_LIGHT}
              keyboardAwareOptions={{ extraScrollSpace: 40 }}
            />
          </View>
        </KeyboardAwareScrollView>
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentSurface: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  headerCta: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
  headerAction: {
    minWidth: 92,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(103,12,245,0.10)",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.24)",
  },
  headerActionDisabled: {
    opacity: 0.7,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: TEXT_MEDIUM,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#B91C1C",
    lineHeight: 18,
    fontWeight: "600",
  },
  anonCard: {
    backgroundColor: `${PRIMARY}08`,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  anonCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  anonCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  anonCardText: {
    flex: 1,
  },
  anonCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 2,
  },
  anonCardSubtitle: {
    fontSize: 12,
    color: TEXT_MEDIUM,
    lineHeight: 17,
  },
  anonInfo: {
    marginTop: 12,
    padding: 10,
    backgroundColor: `${PRIMARY}10`,
    borderRadius: 8,
  },
  anonInfoText: {
    fontSize: 12,
    color: ACCENT,
    lineHeight: 17,
  },
  anonInfoStrong: {
    fontWeight: "700",
  },
  questionsSection: {
    marginBottom: 20,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionBar: {
    width: 4,
    height: 16,
    borderRadius: 999,
    backgroundColor: PRIMARY,
  },
  sectionBarSecondary: {
    backgroundColor: SECONDARY,
  },
  sectionLabelText: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: 0.2,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    backgroundColor: WHITE,
  },
  questionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  questionHeaderText: {
    flex: 1,
    marginRight: 10,
  },
  questionText: {
    fontSize: 14,
    fontWeight: "600",
    color: ACCENT,
    lineHeight: 20,
    marginBottom: 3,
  },
  optionalText: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: "500",
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeBadgeRating: {
    backgroundColor: `${PRIMARY}0D`,
    borderColor: `${PRIMARY}26`,
  },
  typeBadgeText: {
    backgroundColor: `${SECONDARY}0D`,
    borderColor: `${SECONDARY}26`,
  },
  typeBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ratingValue: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    fontWeight: "600",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: ACCENT,
    textAlignVertical: "top",
    backgroundColor: BG_LIGHT,
  },
  freeCommentFormBlock: {
    marginBottom: 8,
  },
  freeCommentInput: {
    minHeight: 90,
  },
});
