import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../Icon";
import { StarRating } from "../StarRating";
import { KeyboardAwareScrollView } from "../KeyboardAwareScrollView";
import { KeyboardAwareTextInput } from "../KeyboardAwareTextInput";
import {
  DEFAULT_SURVEY_QUESTIONS,
  SURVEY_COMMENTS_MAX_LENGTH,
  emptySurveyAnswers,
  isSurveyComplete,
} from "../../utils/courseSurvey";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";
const BORDER = "#E2E8F0";
const DANGER = "#EF4444";

const questionLabel = (question) =>
  question.required ? question.label : `${question.label} (opcional)`;

/**
 * Encuesta de satisfacción de un curso (ClickUp 124b4z9vjxf). Al enviarla, la
 * base emite el certificado. Pinta las preguntas que recibe (valoración 1-5,
 * sí/no o texto; ver `surveyFormFor` en utils/courseSurvey) y
 * `onSubmit(answers)` —`{ [id]: valor }`— devuelve `{ ok, error }`.
 */
export function CourseSurveyModal({
  visible,
  courseTitle,
  questions = DEFAULT_SURVEY_QUESTIONS,
  onClose,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState(() => emptySurveyAnswers(questions));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setAnswers(emptySurveyAnswers(questions));
      setError(null);
      setSubmitting(false);
    }
    // Solo al abrir: si el resumen se refresca con el modal abierto no se borra lo respondido.
  }, [visible]);

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const complete = isSurveyComplete(answers, questions);

  const handleSubmit = async () => {
    if (!complete || submitting) return;
    setSubmitting(true);
    const result = await onSubmit(answers);
    setSubmitting(false);
    if (!result?.ok) {
      setError(result?.error || "Algo ha fallado. Inténtalo de nuevo.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Cerrar encuesta"
            testID="course-survey-close"
          >
            <Icon name="close" size={22} color={ACCENT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Encuesta del curso</Text>
          <View style={styles.closeButton} />
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          bottomPadding={insets.bottom + 24}
        >
          <Text style={styles.courseTitle}>{courseTitle}</Text>
          <Text style={styles.intro}>
            Tu opinión ayuda a mejorar el curso. Al enviarla obtendrás tu certificado de
            asistencia.
          </Text>

          {questions.map((question) => (
            <View key={question.id} style={styles.question}>
              <Text style={styles.questionLabel}>{questionLabel(question)}</Text>
              {question.type === "rating" ? (
                <StarRating
                  rating={answers[question.id] ?? 0}
                  onRatingChange={(value) => setAnswer(question.id, value)}
                  size={32}
                  color="#F59E0B"
                  disabled={submitting}
                  testIDPrefix={`survey-${question.id}`}
                />
              ) : question.type === "yes_no" ? (
                <View style={styles.choiceRow}>
                  {[
                    { value: true, label: "Sí", suffix: "yes" },
                    { value: false, label: "No", suffix: "no" },
                  ].map((option) => {
                    const selected = answers[question.id] === option.value;
                    return (
                      <TouchableOpacity
                        key={option.suffix}
                        style={[styles.choice, selected && styles.choiceSelected]}
                        onPress={() => setAnswer(question.id, option.value)}
                        disabled={submitting}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        testID={`survey-${question.id}-${option.suffix}`}
                      >
                        <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <KeyboardAwareTextInput
                  value={answers[question.id] ?? ""}
                  onChangeText={(value) => setAnswer(question.id, value)}
                  placeholder={
                    question.id === "comments"
                      ? "¿Qué mejorarías? ¿Qué te ha resultado más útil?"
                      : "Escribe tu respuesta"
                  }
                  placeholderTextColor={MUTED_LIGHT}
                  multiline
                  maxLength={SURVEY_COMMENTS_MAX_LENGTH}
                  editable={!submitting}
                  style={styles.comments}
                  testID={`survey-${question.id}`}
                />
              )}
            </View>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submit, (!complete || submitting) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!complete || submitting}
            activeOpacity={0.88}
            testID="survey-submit"
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Enviar y obtener certificado</Text>
            )}
          </TouchableOpacity>
          {!complete ? (
            <Text style={styles.hint}>
              Responde a todas las preguntas que no son opcionales para enviarla.
            </Text>
          ) : null}
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FE" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: ACCENT },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  courseTitle: { fontSize: 20, fontWeight: "800", color: ACCENT, marginBottom: 6 },
  intro: { fontSize: 14, color: MUTED, lineHeight: 20, marginBottom: 12 },
  question: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 16,
    marginTop: 12,
    gap: 10,
  },
  questionLabel: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  choiceRow: { flexDirection: "row", gap: 10 },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  choiceSelected: { borderColor: PRIMARY, backgroundColor: "#F3ECFF" },
  choiceText: { fontSize: 15, fontWeight: "600", color: MUTED },
  choiceTextSelected: { color: PRIMARY },
  comments: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#0F172A",
    textAlignVertical: "top",
  },
  error: { color: DANGER, fontSize: 14, marginTop: 14, textAlign: "center" },
  submit: {
    marginTop: 20,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  hint: { color: MUTED, fontSize: 13, textAlign: "center", marginTop: 10 },
});

export default CourseSurveyModal;
