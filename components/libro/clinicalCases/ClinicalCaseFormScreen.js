import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "../../Icon";
import { LibroEditorScreen } from "../LibroEditorScreen";
import { LibroDateField } from "../LibroDateField";
import {
  CLINICAL_CASE_BLOCKS,
  CLINICAL_CASE_STATUS,
  PRIVACY_NOTICE,
  REFLECTION_PROMPTS,
  displayStatusOf,
  formValuesFor,
  formatCaseDate,
  missingFieldsFor,
} from "../../../utils/clinicalCases";

/**
 * La ficha de un caso clínico en tres bloques (identificación, descripción
 * clínica y reflexión personal), con el modelo del portafolio de Sant Pau.
 *
 * «Guardar borrador» solo pide el título; «Marcar como completado» pide la
 * ficha entera salvo servicio y rotación. Un caso completado se puede seguir
 * editando (la revisión del tutor, que lo bloquearía, llega en la fase 2) y
 * volver a borrador.
 *
 * Sin campos de identificación del paciente, a propósito: el aviso de arriba
 * lo recuerda.
 */
export const ClinicalCaseFormScreen = ({
  clinicalCase = null,
  requirement = null,
  readOnly = false,
  saving = false,
  onClose,
  onSave,
  onDelete,
}) => {
  const [values, setValues] = useState(() => formValuesFor(clinicalCase, requirement));
  const [missing, setMissing] = useState([]);
  const completed = clinicalCase?.status === "completed";
  const status = CLINICAL_CASE_STATUS[displayStatusOf(clinicalCase)];

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
      primaryLabel={readOnly ? "Volver" : completed ? "Guardar cambios" : "Marcar como completado"}
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
        ) : null}
      </View>

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
});
