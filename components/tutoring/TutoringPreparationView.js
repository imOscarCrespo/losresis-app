import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import { HeroScreenLayout } from "../HeroScreenLayout";
import {
  PREPARATION_SECTIONS,
  PROPOSED_GOALS_SECTION,
  canEditPreparation,
  hasPreparationContent,
} from "../../utils/tutoringPreparation";

/**
 * «Preparación de mi tutoría»: el formulario guiado (apartados A–E).
 *
 * Mientras no se envía es un borrador que solo ve el residente. Enviada, su tutor
 * ve siempre la última versión guardada y el botón de borrador pasa a «Guardar
 * cambios». Con la tutoría finalizada o cancelada se ve en solo lectura.
 *
 * `onSave(answers, goals, send)` guarda; quien la abre recarga y la cierra.
 */
export default function TutoringPreparationView({
  tutoring,
  preparation,
  subtitle,
  onSave,
  onClose,
}) {
  const editable = canEditPreparation(tutoring);
  const isSent = preparation?.status === "sent";

  const initialAnswers = useMemo(() => ({ ...(preparation?.answers || {}) }), [preparation]);
  const initialGoals = useMemo(() => {
    const goals = Array.isArray(preparation?.proposed_goals) ? preparation.proposed_goals : [];
    return goals.length ? [...goals] : editable ? [""] : [];
  }, [preparation, editable]);

  const [answers, setAnswers] = useState(initialAnswers);
  const [goals, setGoals] = useState(initialGoals);
  const [saving, setSaving] = useState(false);

  const dirty =
    JSON.stringify(answers) !== JSON.stringify(initialAnswers) ||
    JSON.stringify(goals) !== JSON.stringify(initialGoals);
  const canSend = hasPreparationContent(answers, goals);

  const handleBack = () => {
    if (!editable || !dirty || saving) {
      onClose();
      return;
    }
    Alert.alert("Tienes cambios sin guardar", "Si sales ahora, se perderán.", [
      { text: "Seguir editando", style: "cancel" },
      { text: "Salir sin guardar", style: "destructive", onPress: onClose },
    ]);
  };

  const save = async (send) => {
    setSaving(true);
    try {
      await onSave(answers, goals, send);
    } catch (error) {
      Alert.alert("No se pudo guardar", "Inténtalo de nuevo en un momento.");
      setSaving(false);
    }
  };

  const confirmSend = () => {
    Alert.alert(
      "¿Enviar la preparación a tu tutor?",
      "Podrás seguir editándola hasta la tutoría. Tu tutor verá siempre la última versión.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Enviar", onPress: () => save(true) },
      ]
    );
  };

  const updateGoal = (index, text) =>
    setGoals((prev) => prev.map((goal, i) => (i === index ? text : goal)));
  const removeGoal = (index) => setGoals((prev) => prev.filter((_, i) => i !== index));
  const addGoal = () => setGoals((prev) => [...prev, ""]);

  const readOnlyText = (value) => (
    <Text style={[styles.answerText, !value && styles.answerEmpty]}>
      {value || "Sin respuesta"}
    </Text>
  );

  const footer = editable ? (
    <View style={styles.footer}>
      {isSent ? (
        <TouchableOpacity
          testID="tutoring-preparation-save-changes"
          style={[styles.primaryButton, (saving || !canSend) && styles.buttonDisabled]}
          onPress={() => save(false)}
          disabled={saving || !canSend}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Guardar cambios</Text>
          )}
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            testID="tutoring-preparation-send"
            style={[styles.primaryButton, (saving || !canSend) && styles.buttonDisabled]}
            onPress={confirmSend}
            disabled={saving || !canSend}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="paper-plane-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Enviar preparación al tutor</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="tutoring-preparation-save-draft"
            style={[styles.secondaryButton, saving && styles.buttonDisabled]}
            onPress={() => save(false)}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Guardar borrador</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  ) : null;

  return (
    <HeroScreenLayout
      title="Preparación de mi tutoría"
      subtitle={subtitle}
      onBack={handleBack}
      keyboardAvoiding
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.notice}>
          <Icon
            name={isSent ? "checkmark-circle-outline" : "lock-closed-outline"}
            size={16}
            color={isSent ? "#047857" : "#475569"}
          />
          <Text style={styles.noticeText}>
            {!editable
              ? "Esta tutoría ya no admite cambios en la preparación."
              : isSent
              ? "Ya la has enviado. Tu tutor ve la última versión que guardes."
              : "Mientras sea un borrador solo la ves tú. Tu tutor la verá cuando la envíes."}
          </Text>
        </View>

        {PREPARATION_SECTIONS.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {section.key}. {section.title}
            </Text>
            {section.questions.map((question) => (
              <View key={question.key} style={styles.question}>
                <Text style={styles.questionLabel}>{question.label}</Text>
                {editable ? (
                  <TextInput
                    testID={`tutoring-preparation-${question.key}`}
                    style={styles.input}
                    value={answers[question.key] || ""}
                    onChangeText={(text) =>
                      setAnswers((prev) => ({ ...prev, [question.key]: text }))
                    }
                    placeholder="Escribe tu respuesta"
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                ) : (
                  readOnlyText(answers[question.key])
                )}
              </View>
            ))}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {PROPOSED_GOALS_SECTION.key}. {PROPOSED_GOALS_SECTION.title}
          </Text>
          <Text style={styles.questionLabel}>{PROPOSED_GOALS_SECTION.label}</Text>
          <Text style={styles.hint}>
            Son propuestas: tu tutor decidirá contigo los objetivos de mejora.
          </Text>
          {editable ? (
            <>
              {goals.map((goal, index) => (
                <View key={index} style={styles.goalRow}>
                  <TextInput
                    testID={`tutoring-preparation-goal-${index}`}
                    style={[styles.input, styles.goalInput]}
                    value={goal}
                    onChangeText={(text) => updateGoal(index, text)}
                    placeholder={`Objetivo ${index + 1}`}
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                  <TouchableOpacity
                    testID={`tutoring-preparation-goal-remove-${index}`}
                    style={styles.removeButton}
                    onPress={() => removeGoal(index)}
                    accessibilityLabel="Quitar objetivo"
                  >
                    <Icon name="trash-outline" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                testID="tutoring-preparation-add-goal"
                style={styles.addButton}
                onPress={addGoal}
                activeOpacity={0.85}
              >
                <Icon name="add" size={16} color="#670CF5" />
                <Text style={styles.addButtonText}>Añadir objetivo</Text>
              </TouchableOpacity>
            </>
          ) : goals.length ? (
            goals.map((goal, index) => (
              <Text key={index} style={styles.answerText}>
                • {goal}
              </Text>
            ))
          ) : (
            readOnlyText("")
          )}
        </View>

        {footer}
      </ScrollView>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 18, paddingBottom: 60 },
  notice: {
    flexDirection: "row",
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  noticeText: { flex: 1, fontSize: 13, color: "#475569", lineHeight: 19 },
  section: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  question: { gap: 6 },
  questionLabel: { fontSize: 13, fontWeight: "700", color: "#475569", lineHeight: 18 },
  hint: { fontSize: 12, color: "#64748B", lineHeight: 17, marginTop: -6 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    minHeight: 72,
    textAlignVertical: "top",
  },
  answerText: { fontSize: 14, color: "#0F172A", lineHeight: 21 },
  answerEmpty: { color: "#94A3B8", fontStyle: "italic" },
  goalRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  goalInput: { flex: 1, minHeight: 48 },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    marginTop: 4,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#D9C8FD",
    backgroundColor: "#F5F0FF",
  },
  addButtonText: { fontSize: 14, fontWeight: "700", color: "#670CF5" },
  footer: { gap: 10 },
  primaryButton: {
    flexDirection: "row",
    gap: 8,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#670CF5",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: { color: "#670CF5", fontSize: 15, fontWeight: "700" },
  buttonDisabled: { opacity: 0.5 },
});
