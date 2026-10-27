import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Icon } from "../../Icon";
import { LibroEditorScreen } from "../LibroEditorScreen";
import { LibroDateField } from "../LibroDateField";
import {
  CLINICAL_CASE_BLOCKS,
  CLINICAL_CASE_REVIEW_FIELDS,
  CLINICAL_CASE_STATUS,
  PRIVACY_NOTICE,
  REFLECTION_PROMPTS,
  REVIEW_OUTCOME_LABELS,
  displayStatusOf,
  formValuesFor,
  formatCaseDate,
  isLockedByReview,
  missingFieldsFor,
  reviewsOf,
} from "../../../utils/clinicalCases";

const OUTCOME_STYLE = {
  reviewed: CLINICAL_CASE_STATUS.reviewed,
  changes_requested: CLINICAL_CASE_STATUS.changes_requested,
};

/** Una revisión del tutor: chip, los cuatro textos y quién y cuándo. */
const ReviewCard = ({ review, compact = false }) => {
  const outcome = OUTCOME_STYLE[review.outcome] || OUTCOME_STYLE.reviewed;
  const fields = CLINICAL_CASE_REVIEW_FIELDS.filter((field) => review[field.key]?.trim());
  return (
    <View style={[styles.reviewCard, compact && styles.reviewPast]}>
      <View style={styles.reviewHeader}>
        <View style={[styles.statusChip, { backgroundColor: outcome.background }]}>
          <Text style={[styles.statusText, { color: outcome.color }]}>
            {REVIEW_OUTCOME_LABELS[review.outcome] || outcome.label}
          </Text>
        </View>
        <Text style={styles.reviewMeta} numberOfLines={1}>
          {[review.reviewer_name, formatCaseDate(review.created_at)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {fields.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <Text style={styles.readValue}>{review[field.key].trim()}</Text>
        </View>
      ))}
    </View>
  );
};

/**
 * «Revisión del tutor»: la última revisión y, plegadas, las anteriores (el
 * historial se conserva entero).
 */
const TutorReview = ({ reviews }) => {
  const [showPast, setShowPast] = useState(false);
  const [latest, ...past] = reviews;
  return (
    <View style={styles.reviewBlock} testID="clinical-case-tutor-review">
      <Text style={styles.blockTitle}>Revisión del tutor</Text>
      <ReviewCard review={latest} />
      {past.length ? (
        <>
          <TouchableOpacity onPress={() => setShowPast((prev) => !prev)} activeOpacity={0.8}>
            <Text style={styles.reviewToggle}>
              {showPast
                ? "Ocultar revisiones anteriores"
                : `Ver revisiones anteriores (${past.length})`}
            </Text>
          </TouchableOpacity>
          {showPast ? past.map((review) => <ReviewCard key={review.id} review={review} compact />) : null}
        </>
      ) : null}
    </View>
  );
};

/**
 * La ficha de un caso clínico en tres bloques (identificación, descripción
 * clínica y reflexión personal), con el modelo del portafolio de Sant Pau.
 *
 * «Guardar borrador» solo pide el título; «Marcar como completado» pide la
 * ficha entera salvo servicio y rotación. Un caso completado se puede seguir
 * editando y volver a borrador, salvo que el tutor ya lo haya revisado: entonces
 * queda en solo lectura. Si el tutor pide modificaciones, el caso vuelve a
 * borrador con su revisión arriba y «Volver a enviar».
 *
 * Sin campos de identificación del paciente, a propósito: el aviso de arriba
 * lo recuerda.
 */
export const ClinicalCaseFormScreen = ({
  clinicalCase = null,
  requirement = null,
  readOnly: readOnlyProp = false,
  saving = false,
  onClose,
  onSave,
  onDelete,
  onExportPdf,
}) => {
  const [values, setValues] = useState(() => formValuesFor(clinicalCase, requirement));
  const [exporting, setExporting] = useState(false);
  const [missing, setMissing] = useState([]);
  const completed = clinicalCase?.status === "completed";
  const displayStatus = displayStatusOf(clinicalCase);
  const status = CLINICAL_CASE_STATUS[displayStatus];
  const locked = isLockedByReview(clinicalCase);
  const readOnly = readOnlyProp || locked;
  const changesRequested = displayStatus === "changes_requested";
  const reviews = reviewsOf(clinicalCase);

  const setValue = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (missing.length) setMissing((prev) => prev.filter((label) => label !== key));
  };

  const submit = (complete) => {
    const lacking = missingFieldsFor(values, { complete });
    if (lacking.length) {
      setMissing(
        CLINICAL_CASE_BLOCKS.flatMap((block) => block.fields)
          .filter((field) => lacking.includes(field.label))
          .map((field) => field.key)
      );
      Alert.alert(
        complete ? "Faltan campos por completar" : "Falta el título",
        complete
          ? `Para marcarlo como completado rellena:\n${lacking.map((label) => `• ${label}`).join("\n")}\n\nSi aún no lo tienes, guárdalo como borrador.`
          : "Ponle un título al caso para guardarlo."
      );
      return;
    }
    onSave?.(values, { complete });
  };

  // Solo un caso completado: de un borrador no hay ficha que exportar. Sale lo
  // guardado, no lo que se esté editando.
  const canExport = completed && !!onExportPdf;

  const exportPdf = () => {
    const run = async (includeReview) => {
      setExporting(true);
      try {
        await onExportPdf(clinicalCase, { includeReview });
      } finally {
        setExporting(false);
      }
    };
    if (!reviews.length) {
      run(false);
      return;
    }
    Alert.alert("Exportar PDF", "¿Incluir la revisión del tutor?", [
      { text: "Cancelar", style: "cancel" },
      { text: "No", onPress: () => run(false) },
      { text: "Sí, incluirla", onPress: () => run(true) },
    ]);
  };

  const title = readOnly
    ? values.title || "Caso clínico"
    : clinicalCase
      ? "Editar caso clínico"
      : "Nuevo caso clínico";

  const renderField = (field) => {
    const value = values[field.key];
    const isMissing = missing.includes(field.key);

    if (field.type === "date") {
      return readOnly ? (
        <View key={field.key} style={styles.field}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <Text style={styles.readValue}>{formatCaseDate(value) || "—"}</Text>
        </View>
      ) : (
        <View key={field.key} style={styles.field}>
          <LibroDateField
            label={field.label}
            required
            value={value || ""}
            onChange={(next) => setValue(field.key, next)}
          />
          {isMissing ? <Text style={styles.error}>Falta la fecha.</Text> : null}
        </View>
      );
    }

    // La reflexión lleva su propio título de bloque: el rótulo sobra.
    const showLabel = field.key !== "reflection";

    return (
      <View key={field.key} style={styles.field}>
        {showLabel ? (
          <Text style={styles.fieldLabel}>
            {field.label}
            {field.required && !readOnly ? " *" : ""}
          </Text>
        ) : null}
        {readOnly ? (
          <Text style={styles.readValue}>{value ? String(value) : "—"}</Text>
        ) : (
          <TextInput
            style={[
              styles.input,
              field.multiline && styles.inputMultiline,
              field.key === "reflection" && styles.inputReflection,
              isMissing && styles.inputMissing,
            ]}
            value={value || ""}
            onChangeText={(text) => setValue(field.key, text)}
            placeholder={field.key === "reflection" ? "Escribe tu reflexión con libertad" : field.label}
            placeholderTextColor="#94A3B8"
            multiline={!!field.multiline}
            maxLength={field.multiline ? 20000 : 200}
            editable={!(field.key === "title" && requirement)}
            testID={`clinical-case-field-${field.key}`}
          />
        )}
      </View>
    );
  };

  return (
    <LibroEditorScreen
      title={title}
      onClose={onClose}
      saving={saving}
      primaryLabel={
        readOnly
          ? "Volver"
          : completed
            ? "Guardar cambios"
            : changesRequested
              ? "Volver a enviar"
              : "Marcar como completado"
      }
      onPrimary={readOnly ? onClose : () => submit(true)}
      primaryTestID="clinical-case-complete"
      secondaryLabel={readOnly ? null : completed ? "Volver a borrador" : "Guardar borrador"}
      onSecondary={readOnly ? null : () => submit(false)}
      secondaryTestID="clinical-case-save-draft"
      hideFooterWithKeyboard
      destructiveLabel={!readOnly && clinicalCase ? "Eliminar caso" : null}
      onDestructive={
        !readOnly && clinicalCase
          ? () =>
              Alert.alert("Eliminar caso clínico", "Se borrará de tu libro. No se puede deshacer.", [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: () => onDelete?.(clinicalCase) },
              ])
          : null
      }
    >
      <View style={styles.headerRow}>
        <View style={[styles.statusChip, { backgroundColor: status.background }]}>
          <Icon name={status.icon} size={13} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        {requirement ? (
          <Text style={styles.requirementTag} numberOfLines={1}>
            Requerido por tu hospital
          </Text>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        {canExport ? (
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
            onPress={exportPdf}
            disabled={exporting}
            accessibilityRole="button"
            testID="clinical-case-export-pdf"
          >
            <Icon name="download-outline" size={14} color="#6D28D9" />
            <Text style={styles.exportButtonText}>
              {exporting ? "Generando…" : "Exportar PDF"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {locked ? (
        <View style={styles.notice} testID="clinical-case-locked">
          <Icon name="lock-closed-outline" size={16} color="#047857" />
          <Text style={styles.noticeText}>
            Tu tutor ya ha revisado este caso: queda cerrado y no se puede editar.
          </Text>
        </View>
      ) : null}

      {changesRequested && !readOnly ? (
        <View style={[styles.notice, styles.noticeWarning]} testID="clinical-case-changes-requested">
          <Icon name="alert-circle-outline" size={16} color="#B45309" />
          <Text style={[styles.noticeText, styles.noticeWarningText]}>
            Tu tutor te ha pedido cambios. Revisa sus comentarios, corrige el caso y
            vuelve a enviarlo.
          </Text>
        </View>
      ) : null}

      {displayStatus === "pending_review" && !readOnly ? (
        <View style={[styles.notice, styles.noticePending]}>
          <Icon name="hourglass-outline" size={16} color="#6D28D9" />
          <Text style={[styles.noticeText, styles.noticePendingText]}>
            Enviado a tu tutor para que lo revise. Puedes seguir editándolo hasta
            que lo haga.
          </Text>
        </View>
      ) : null}

      {reviews.length ? <TutorReview reviews={reviews} /> : null}

      {requirement?.description ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsLabel}>Instrucciones</Text>
          <Text style={styles.instructionsText}>{requirement.description}</Text>
        </View>
      ) : null}

      {!readOnly ? (
        <View style={styles.privacy} testID="clinical-case-privacy">
          <Icon name="shield-checkmark-outline" size={16} color="#1D4ED8" />
          <Text style={styles.privacyText}>{PRIVACY_NOTICE}</Text>
        </View>
      ) : null}

      {CLINICAL_CASE_BLOCKS.map((block) => (
        <View key={block.key} style={styles.block}>
          <Text style={styles.blockTitle}>
            {block.key === "reflection" ? "¿Qué he aprendido de este caso?" : block.title}
          </Text>
          {block.fields.map(renderField)}
          {block.key === "reflection" && !readOnly ? (
            <View style={styles.prompts}>
              <Text style={styles.promptsTitle}>Preguntas orientativas</Text>
              {REFLECTION_PROMPTS.map((prompt) => (
                <Text key={prompt} style={styles.promptText}>{`• ${prompt}`}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ))}

      {completed && clinicalCase?.completed_at ? (
        <Text style={styles.footnote}>
          {`Completado el ${formatCaseDate(clinicalCase.completed_at)}`}
        </Text>
      ) : null}
    </LibroEditorScreen>
  );
};

export default ClinicalCaseFormScreen;

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: "700" },
  requirementTag: { flex: 1, fontSize: 12, fontWeight: "600", color: "#6D28D9" },
  headerSpacer: { flex: 1 },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#F5F3FF",
  },
  exportButtonDisabled: { opacity: 0.6 },
  exportButtonText: { fontSize: 12, fontWeight: "700", color: "#6D28D9" },
  instructions: { gap: 2, padding: 12, borderRadius: 14, backgroundColor: "#F5F3FF" },
  instructionsLabel: { fontSize: 11, fontWeight: "700", color: "#6D28D9", textTransform: "uppercase" },
  instructionsText: { fontSize: 13, color: "#1B0977", lineHeight: 19 },
  privacy: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
  },
  privacyText: { flex: 1, fontSize: 12, color: "#1E3A8A", lineHeight: 17 },
  block: {
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  blockTitle: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  readValue: { fontSize: 14, color: "#0F172A", lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  inputMultiline: { minHeight: 96, textAlignVertical: "top" },
  inputReflection: { minHeight: 150 },
  inputMissing: { borderColor: "#DC2626" },
  error: { fontSize: 12, fontWeight: "600", color: "#DC2626" },
  prompts: { gap: 3, padding: 12, borderRadius: 14, backgroundColor: "#F5F3FF" },
  promptsTitle: { fontSize: 12, fontWeight: "700", color: "#6D28D9", marginBottom: 2 },
  promptText: { fontSize: 12, color: "#4C1D95", lineHeight: 17 },
  footnote: { fontSize: 12, color: "#64748B", textAlign: "center" },
  notice: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
  },
  noticeText: { flex: 1, fontSize: 13, color: "#065F46", lineHeight: 18 },
  noticeWarning: { backgroundColor: "#FFFBEB" },
  noticeWarningText: { color: "#92400E", fontWeight: "600" },
  noticePending: { backgroundColor: "#F5F3FF" },
  noticePendingText: { color: "#4C1D95" },
  reviewBlock: {
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  reviewCard: { gap: 10 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewMeta: { flex: 1, fontSize: 12, color: "#64748B" },
  reviewToggle: { fontSize: 13, fontWeight: "700", color: "#670CF5" },
  reviewPast: { paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EEF0F6" },
});
