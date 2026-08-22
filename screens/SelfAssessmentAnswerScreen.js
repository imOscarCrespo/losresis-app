import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import posthogLogger from "../services/posthogService";
import {
  saveSelfAssessmentDraft,
  submitSelfAssessment,
} from "../services/docenciaService";
import {
  QUESTION_KIND,
  answerOf,
  countAnswered,
  formatAnswer,
  isBlankAnswer,
  missingRequired,
  normalizeQuestions,
  scaleSteps,
} from "../utils/autoevaluacion";

/**
 * Responder la Autoevaluación anual. Es una PANTALLA, no una hoja modal.
 *
 * El motivo es el formulario: son las preguntas que Docencia haya diseñado, de siete
 * tipos, y se responden en varias sentadas. Una hoja a media altura pelea con el
 * teclado, no deja sitio para el enunciado y su gesto de cerrar es el mismo que el de
 * descartar, que es justo la confusión que no puede haber en algo que se envía una
 * vez al año.
 *
 * Las preguntas vienen CONGELADAS dentro de la solicitud, con su tipo, sus opciones y
 * su escala: son las que se publicaron, copiadas en el momento del envío. Si Docencia
 * saca luego otra versión de la plantilla, esta no cambia.
 *
 * Las respuestas se indexan por el ID de la pregunta (las solicitudes antiguas, por su
 * texto: ver utils/autoevaluacion). Reordenar o corregir una tilde en el panel no puede
 * desalinear lo que respondiste.
 */

const AUTOSAVE_MS = 1200;

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
  }).format(date);
};

/** Una opción de selección: círculo para las únicas, cuadrado para las múltiples. */
const OptionRow = ({ label, selected, multiple, onPress }) => (
  <TouchableOpacity
    style={[styles.option, selected && styles.optionSelected]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View
      style={[
        multiple ? styles.checkbox : styles.radio,
        selected && styles.markSelected,
      ]}
    >
      {selected ? <Icon name="checkmark" size={12} color="#FFFFFF" /> : null}
    </View>
    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

/** El campo que le toca a cada tipo de pregunta. */
const AnswerField = ({ question, value, editable, onChange }) => {
  if (!editable) {
    const text = formatAnswer(question, value);
    return (
      <Text style={text ? styles.answerText : styles.answerEmpty}>
        {text || "Sin responder"}
      </Text>
    );
  }

  switch (question.kind) {
    case QUESTION_KIND.SHORT_TEXT:
      return (
        <TextInput
          style={styles.inputShort}
          value={typeof value === "string" ? value : ""}
          onChangeText={onChange}
          placeholder="Tu respuesta"
          placeholderTextColor="#94A3B8"
        />
      );

    case QUESTION_KIND.SINGLE_CHOICE:
    case QUESTION_KIND.LIKERT:
      return (
        <View style={styles.options}>
          {question.options.map((option) => (
            <OptionRow
              key={option.id}
              label={option.label}
              selected={String(value) === option.id}
              onPress={() => onChange(option.id)}
            />
          ))}
        </View>
      );

    case QUESTION_KIND.MULTI_CHOICE: {
      const marked = Array.isArray(value) ? value.map(String) : [];
      return (
        <View style={styles.options}>
          {question.options.map((option) => (
            <OptionRow
              key={option.id}
              label={option.label}
              multiple
              selected={marked.includes(option.id)}
              onPress={() =>
                onChange(
                  marked.includes(option.id)
                    ? marked.filter((id) => id !== option.id)
                    : [...marked, option.id]
                )
              }
            />
          ))}
        </View>
      );
    }

    case QUESTION_KIND.NUMERIC_SCALE:
      return (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scale}
          >
            {scaleSteps(question).map((step) => {
              const selected = Number(value) === step;
              return (
                <TouchableOpacity
                  key={step}
                  style={[styles.scaleStep, selected && styles.scaleStepSelected]}
                  onPress={() => onChange(step)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.scaleStepText,
                      selected && styles.scaleStepTextSelected,
                    ]}
                  >
                    {step}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {question.scale && (question.scale.minLabel || question.scale.maxLabel) ? (
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleLabel}>
                {question.scale.minLabel
                  ? `${question.scale.min} = ${question.scale.minLabel}`
                  : ""}
              </Text>
              <Text style={styles.scaleLabel}>
                {question.scale.maxLabel
                  ? `${question.scale.max} = ${question.scale.maxLabel}`
                  : ""}
              </Text>
            </View>
          ) : null}
        </View>
      );

    case QUESTION_KIND.YES_NO:
      return (
        <View style={styles.yesNo}>
          {[
            { label: "Sí", answer: true },
            { label: "No", answer: false },
          ].map((choice) => {
            const selected = value === choice.answer;
            return (
              <TouchableOpacity
                key={choice.label}
                style={[styles.yesNoButton, selected && styles.yesNoSelected]}
                onPress={() => onChange(choice.answer)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.yesNoText, selected && styles.yesNoTextSelected]}
                >
                  {choice.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );

    default:
      return (
        <TextInput
          style={styles.input}
          value={typeof value === "string" ? value : ""}
          onChangeText={onChange}
          placeholder="Tu respuesta"
          placeholderTextColor="#94A3B8"
          multiline
        />
      );
  }
};

export default function SelfAssessmentAnswerScreen({
  solicitud,
  onBack,
  onFinished,
}) {
  const [answers, setAnswers] = useState(solicitud.answers || {});
  const [saving, setSaving] = useState(false);
  // "saved" | "pending" | "saving" | "error": lo que se le dice del guardado solo.
  const [autoSave, setAutoSave] = useState("saved");
  const guardado = useRef(JSON.stringify(solicitud.answers || {}));

  const editable = solicitud.status === "pending";

  const questions = useMemo(
    () => normalizeQuestions(solicitud.questions),
    [solicitud]
  );
  const answeredCount = countAnswered(questions, answers);
  const faltanObligatorias = missingRequired(questions, answers);
  const progreso = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  useEffect(() => {
    posthogLogger.logScreen("SelfAssessmentAnswerScreen");
  }, []);

  /**
   * Guardado automático con retardo.
   *
   * Va con debounce porque cada tecla cambia el estado y no se va a llamar a la RPC
   * por letra. Al salir se vuelca lo que quede (`salir`), así que el retardo no puede
   * convertirse en la excusa por la que se pierde el último párrafo.
   */
  useEffect(() => {
    if (!editable) return undefined;

    const serializado = JSON.stringify(answers);
    if (serializado === guardado.current) return undefined;

    setAutoSave("pending");
    const timer = setTimeout(async () => {
      try {
        setAutoSave("saving");
        await saveSelfAssessmentDraft(solicitud.id, answers);
        guardado.current = serializado;
        setAutoSave("saved");
      } catch (error) {
        console.error("Error autosaving self assessment:", error);
        setAutoSave("error");
      }
    }, AUTOSAVE_MS);

    return () => clearTimeout(timer);
  }, [answers, editable, solicitud.id]);

  const salir = async () => {
    const pendiente = JSON.stringify(answers) !== guardado.current;
    onBack();

    if (pendiente && editable) {
      try {
        await saveSelfAssessmentDraft(solicitud.id, answers);
      } catch (error) {
        console.error("Error saving self assessment on close:", error);
      }
    }
    if (onFinished) await onFinished();
  };

  // Ahora que responder es una pantalla y no una hoja, el botón físico de Android
  // tiene que devolver a la lista. Sin esto se saldría de la sección entera, y con lo
  // último escrito todavía sin volcar.
  const salirRef = useRef(salir);
  salirRef.current = salir;

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      void salirRef.current();
      return true;
    });

    return () => subscription.remove();
  }, []);

  const reintentarGuardado = async () => {
    try {
      setAutoSave("saving");
      await saveSelfAssessmentDraft(solicitud.id, answers);
      guardado.current = JSON.stringify(answers);
      setAutoSave("saved");
    } catch (error) {
      console.error("Error retrying draft save:", error);
      setAutoSave("error");
    }
  };

  const enviar = () => {
    if (faltanObligatorias.length > 0) {
      Alert.alert(
        "Faltan respuestas obligatorias",
        faltanObligatorias.map((question) => `· ${question.title}`).join("\n")
      );
      return;
    }

    Alert.alert(
      "Enviar autoevaluación",
      answeredCount < questions.length
        ? `Has respondido ${answeredCount} de ${questions.length}. Una vez enviada no podrás cambiarla salvo que tu tutor la devuelva.`
        : "Una vez enviada no podrás cambiarla salvo que tu tutor la devuelva.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            setSaving(true);
            try {
              await submitSelfAssessment(solicitud.id, answers);
              posthogLogger.capture("resident_self_assessment_submitted", {
                answered: answeredCount,
                total: questions.length,
              });
              guardado.current = JSON.stringify(answers);
              onBack();
              if (onFinished) await onFinished();
            } catch (error) {
              Alert.alert(
                "No se pudo enviar",
                error?.message || "Inténtalo de nuevo en un momento."
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const limite = formatDate(solicitud.due_date);
  const subtitulo = [
    solicitud.period_label,
    solicitud.speciality_name,
    solicitud.residency_year ? `R${solicitud.residency_year}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const autoSaveCopy = {
    saved: "Se guarda solo",
    pending: "Guardando…",
    saving: "Guardando…",
    error: "No se pudo guardar. Toca para reintentar.",
  }[autoSave];

  return (
    <HeroScreenLayout
      title={solicitud.template_name || solicitud.period_label || "Autoevaluación"}
      subtitle={subtitulo || null}
      onBack={salir}
      keyboardAvoiding
      bottomContent={
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Text style={styles.heroProgress}>
              {editable
                ? `${answeredCount} de ${questions.length} respondidas`
                : "Enviada: solo lectura"}
            </Text>
            {limite ? (
              <Text style={styles.heroDue}>
                {editable ? `antes del ${limite}` : ""}
              </Text>
            ) : null}
          </View>
          {editable && questions.length ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progreso}%` }]} />
            </View>
          ) : null}
        </View>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {solicitud.reopen_reason ? (
          <View style={styles.reopened}>
            <Text style={styles.reopenedLabel}>Tu tutor te la ha devuelto</Text>
            <Text style={styles.reopenedText}>{solicitud.reopen_reason}</Text>
          </View>
        ) : null}

        {questions.length ? (
          questions.map((question, index) => {
            const value = answerOf(question, answers, index);
            const falta = question.required && isBlankAnswer(value) && editable;

            return (
              <View key={question.id} style={styles.question}>
                <Text style={styles.questionText}>
                  {`${index + 1}. ${question.title}`}
                  {question.required ? (
                    <Text style={styles.required}> *</Text>
                  ) : null}
                </Text>
                {question.description ? (
                  <Text style={styles.questionHelp}>{question.description}</Text>
                ) : null}

                <AnswerField
                  question={question}
                  value={value}
                  editable={editable}
                  onChange={(siguiente) =>
                    setAnswers((previas) => ({
                      ...previas,
                      [question.id]: siguiente,
                    }))
                  }
                />

                {falta ? (
                  <Text style={styles.requiredHint}>
                    Obligatoria: sin esto no se puede enviar.
                  </Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.answerEmpty}>
            Tu tutor no ha incluido preguntas en esta autoevaluación.
          </Text>
        )}

        {editable ? (
          <Text style={styles.footnote}>
            Se guarda solo mientras la respondes, así que puedes salir y seguir más
            tarde. Al enviarla queda bloqueada.
          </Text>
        ) : null}
      </ScrollView>

      {editable ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={enviar}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Enviar definitivamente</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statusButton}
            disabled={autoSave !== "error"}
            onPress={reintentarGuardado}
          >
            <Text
              style={[
                styles.statusText,
                autoSave === "error" && styles.statusError,
              ]}
            >
              {autoSaveCopy}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, paddingTop: 4 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heroProgress: { fontSize: 13, fontWeight: "700", color: "#4C1D95" },
  heroDue: { fontSize: 12, color: "#64748B" },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EDE9FE",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: "#670CF5" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32, gap: 20 },
  question: { gap: 6 },
  questionText: { fontSize: 15, fontWeight: "700", color: "#1B0977", lineHeight: 21 },
  questionHelp: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  required: { color: "#DC2626" },
  requiredHint: { fontSize: 11, color: "#B45309" },
  answerText: { fontSize: 14, color: "#0F172A", lineHeight: 21 },
  answerEmpty: { fontSize: 14, color: "#94A3B8", fontStyle: "italic" },
  footnote: { fontSize: 12, color: "#94A3B8", lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    minHeight: 110,
    textAlignVertical: "top",
  },
  inputShort: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  options: { gap: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  optionSelected: { borderColor: "#670CF5", backgroundColor: "#F5F3FF" },
  optionText: { flex: 1, fontSize: 14, color: "#0F172A" },
  optionTextSelected: { fontWeight: "700", color: "#4C1D95" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  markSelected: { borderColor: "#670CF5", backgroundColor: "#670CF5" },
  scale: { gap: 8, paddingVertical: 2 },
  scaleStep: {
    minWidth: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  scaleStepSelected: { borderColor: "#670CF5", backgroundColor: "#670CF5" },
  scaleStepText: { fontSize: 15, fontWeight: "700", color: "#475569" },
  scaleStepTextSelected: { color: "#FFFFFF" },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 12,
  },
  scaleLabel: { fontSize: 11, color: "#64748B", flexShrink: 1 },
  yesNo: { flexDirection: "row", gap: 8 },
  yesNoButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  yesNoSelected: { borderColor: "#670CF5", backgroundColor: "#670CF5" },
  yesNoText: { fontSize: 15, fontWeight: "700", color: "#475569" },
  yesNoTextSelected: { color: "#FFFFFF" },
  reopened: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 4,
  },
  reopenedLabel: { fontSize: 12, fontWeight: "700", color: "#B45309" },
  reopenedText: { fontSize: 14, color: "#78350F", lineHeight: 21 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: "#EEF0F6",
    backgroundColor: "#FFFFFF",
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  statusButton: { height: 40, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 13, fontWeight: "600", color: "#94A3B8" },
  statusError: { color: "#DC2626" },
});
