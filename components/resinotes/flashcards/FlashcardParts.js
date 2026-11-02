import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { ResiNotesSheet } from "../ResiNotesSheet";
import { CARD_STATES, answerLines, cardDisplayState } from "../../../utils/flashcards";

/**
 * Piezas comunes de las tarjetas de repaso de ResiNotes (ClickUp 124b4z9w0z0).
 */

export const PrimaryButton = ({ label, onPress, disabled = false, loading = false, icon, testID, style }) => (
  <TouchableOpacity
    style={[styles.primary, (disabled || loading) && styles.disabled, style]}
    onPress={onPress}
    disabled={disabled || loading}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || loading, busy: loading }}
    testID={testID}
  >
    {loading ? <ActivityIndicator color={COLORS.WHITE} /> : <Text style={styles.primaryText}>{label}</Text>}
    {icon && !loading ? <Icon name={icon} size={18} color={COLORS.WHITE} /> : null}
  </TouchableOpacity>
);

export const SecondaryButton = ({ label, onPress, disabled = false, testID, style, danger = false, icon }) => (
  <TouchableOpacity
    style={[styles.secondary, danger && styles.secondaryDanger, disabled && styles.disabled, style]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
  >
    {icon ? <Icon name={icon} size={18} color={danger ? COLORS.ERROR : COLORS.PRIMARY} /> : null}
    <Text style={[styles.secondaryText, danger && styles.secondaryTextDanger]} numberOfLines={1} adjustsFontSizeToFit>
      {label}
    </Text>
  </TouchableOpacity>
);

/** Respuesta: una línea tal cual; varias, como lista con viñetas. */
export const AnswerBody = ({ answer, size = 16, color = COLORS.TEXT_DARK, testID }) => {
  const lines = answerLines(answer);
  if (lines.length <= 1) {
    return (
      <Text style={[styles.answerText, { fontSize: size, color, lineHeight: size * 1.45 }]} testID={testID}>
        {lines[0] || ""}
      </Text>
    );
  }
  return (
    <View style={styles.answerList} testID={testID}>
      {lines.map((line, idx) => (
        <View key={`${idx}-${line}`} style={styles.bulletRow}>
          <Text style={[styles.bullet, { fontSize: size, color }]}>•</Text>
          <Text style={[styles.answerText, styles.bulletText, { fontSize: size, color, lineHeight: size * 1.45 }]}>
            {line}
          </Text>
        </View>
      ))}
    </View>
  );
};

export const StateChip = ({ card, testID }) => {
  const meta = CARD_STATES[cardDisplayState(card)];
  return (
    <View style={[styles.chip, { backgroundColor: meta.bg }]} testID={testID}>
      <Text style={[styles.chipText, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
};

/** «Carpeta · Apunte» bajo una pregunta. */
export const SourceMeta = ({ card, folderName, style }) => {
  const title = card.source?.title;
  const parts = [folderName, title].filter(Boolean);
  if (!parts.length) {
    return (
      <View style={[styles.meta, style]}>
        <Icon name="pencil-outline" size={14} color={COLORS.TEXT_LIGHT} />
        <Text style={styles.metaText}>Creada a mano</Text>
      </View>
    );
  }
  return (
    <View style={[styles.meta, style]}>
      <Icon name="folder-outline" size={14} color={COLORS.TEXT_LIGHT} />
      <Text style={styles.metaText} numberOfLines={1}>
        {parts.join(" · ")}
      </Text>
    </View>
  );
};

/** Hoja para escribir o corregir una pregunta y su respuesta. */
export const CardEditorSheet = ({ visible, title, initial, onSubmit, onClose, notice }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setQuestion(initial?.question || "");
      setAnswer(initial?.answer || "");
      setSaving(false);
      setError(null);
    }
  }, [visible, initial]);

  const valid = question.trim().length > 0 && answer.trim().length > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({ question: question.trim(), answer: answer.trim() });
    } catch (e) {
      setError(e?.userMessage || "No se ha podido guardar. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  return (
    <ResiNotesSheet
      visible={visible}
      title={title}
      onClose={onClose}
      testID="flashcard-editor"
      footer={
        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label="Guardar" onPress={submit} disabled={!valid} loading={saving} testID="flashcard-editor-save" />
        </View>
      }
    >
      <Text style={styles.label}>Pregunta</Text>
      <TextInput
        value={question}
        onChangeText={setQuestion}
        maxLength={500}
        multiline
        style={styles.input}
        placeholder="¿Qué quieres recordar?"
        placeholderTextColor={COLORS.TEXT_LIGHT}
        accessibilityLabel="Pregunta"
        testID="flashcard-editor-question"
      />
      <Text style={styles.label}>Respuesta</Text>
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        maxLength={4000}
        multiline
        style={[styles.input, styles.inputTall]}
        placeholder="Una línea por cada punto"
        placeholderTextColor={COLORS.TEXT_LIGHT}
        accessibilityLabel="Respuesta"
        testID="flashcard-editor-answer"
      />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </ResiNotesSheet>
  );
};

export const InfoNotice = ({ children, icon = "information-circle-outline", tone = "info", testID }) => (
  <View style={[styles.infoBox, tone === "warning" && styles.infoBoxWarning]} testID={testID}>
    <Icon name={icon} size={20} color={tone === "warning" ? "#B45309" : COLORS.PRIMARY} />
    <Text style={[styles.infoText, tone === "warning" && styles.infoTextWarning]}>{children}</Text>
  </View>
);

export const flashcardStyles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 140 },
  center: { paddingVertical: 40, alignItems: "center", gap: 12 },
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: COLORS.PRIMARY, marginBottom: 8 },
  question: { fontSize: 18, fontWeight: "700", color: COLORS.PRIMARY_DARK, lineHeight: 25 },
  muted: { fontSize: 14, color: COLORS.TEXT_LIGHT, lineHeight: 20 },
  headerSubtitle: { fontSize: 16, color: COLORS.TEXT_LIGHT, marginTop: -6 },
  footerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: COLORS.BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.PRIMARY_DARK, textAlign: "center" },
  emptyText: { fontSize: 15, color: COLORS.TEXT_LIGHT, textAlign: "center", lineHeight: 21, paddingHorizontal: 12 },
});

const styles = StyleSheet.create({
  primary: {
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primaryText: { color: COLORS.WHITE, fontSize: 16, fontWeight: "700" },
  secondary: {
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryDanger: { backgroundColor: COLORS.RED_LIGHT },
  secondaryText: { flexShrink: 1, color: COLORS.PRIMARY, fontSize: 16, fontWeight: "700" },
  secondaryTextDanger: { color: COLORS.ERROR },
  disabled: { opacity: 0.45 },
  answerText: { color: COLORS.TEXT_DARK },
  answerList: { gap: 4 },
  bulletRow: { flexDirection: "row", gap: 8 },
  bullet: { lineHeight: 23 },
  bulletText: { flex: 1 },
  chip: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: "700" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { flexShrink: 1, fontSize: 13, color: COLORS.TEXT_LIGHT },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  error: { color: COLORS.ERROR, fontSize: 14 },
  label: { fontSize: 13, fontWeight: "700", color: COLORS.TEXT_MEDIUM, marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
    minHeight: 52,
    textAlignVertical: "top",
  },
  inputTall: { minHeight: 110 },
  notice: { fontSize: 13, color: COLORS.TEXT_LIGHT, marginTop: 10, lineHeight: 18 },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
  },
  infoBoxWarning: { backgroundColor: "#FEF6DC" },
  infoText: { flex: 1, color: COLORS.PRIMARY_DARK, fontSize: 14, lineHeight: 20 },
  infoTextWarning: { color: "#92400E" },
});
