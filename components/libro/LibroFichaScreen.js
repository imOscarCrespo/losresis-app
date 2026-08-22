import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LibroEditorScreen } from "./LibroEditorScreen";
import { LibroDateField } from "./LibroDateField";
import {
  LIBRO_PROGRESS_LABELS,
  getLibroProgressLabel,
} from "../../data/libroSections";

/**
 * La pantalla de la ficha de un elemento del arquetipo `itinerary`: una rotación o
 * una competencia.
 *
 * El residente NO crea ni borra elementos: la lista es de su tutor. Aquí solo
 * completa la ficha del elemento que abrió.
 *
 * En Competencias el NIVEL lo pone el tutor al cerrar una Evaluación
 * (`set_evaluation_competency` escribe en `libro_node_progress`). Se muestra en solo
 * lectura y el residente aporta su comentario: si los dos escribieran la misma
 * columna, la evaluación del tutor pisaría su autovaloración sin dejar rastro.
 */

// Los campos de la ficha, por apartado. Van en libro_node_progress.payload.
const FICHA_FIELDS = {
  rotations: [
    { key: "start_date", label: "Fecha de inicio", type: "date" },
    { key: "end_date", label: "Fecha de fin", type: "date" },
    { key: "center", label: "Centro real", placeholder: "Dónde la has hecho" },
    {
      key: "tutor",
      label: "Tutor de la rotación",
      placeholder: "Quién te la ha tutorizado",
    },
    {
      key: "notes",
      label: "Observaciones",
      placeholder: "Lo que quieras dejar anotado",
      multiline: true,
    },
  ],
  competencies: [
    {
      key: "comment",
      label: "Tu comentario",
      placeholder: "Cómo la estás trabajando",
      multiline: true,
    },
    {
      key: "evidence",
      label: "Evidencia",
      placeholder: "Casos, cursos o trabajos que la respalden",
      multiline: true,
    },
  ],
};

const statusOptions = (section) =>
  Object.keys(LIBRO_PROGRESS_LABELS[section] || {});

export const LibroFichaScreen = ({
  node,
  section,
  saving = false,
  onClose,
  onSave,
}) => {
  const [status, setStatus] = useState(node?.progress?.status || "pending");
  const [values, setValues] = useState(() => node?.progress?.payload || {});

  if (!node) return null;

  const fields = FICHA_FIELDS[section] || [];
  // El nivel de una competencia es del tutor: aquí no se ofrece cambiarlo.
  const statusIsEditable = section !== "competencies";

  return (
    <LibroEditorScreen
      title={node.name}
      onClose={onClose}
      saving={saving}
      primaryLabel="Guardar ficha"
      onPrimary={() => onSave?.({ status, payload: values })}
    >
      {node.description ? (
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>{node.description}</Text>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Estado</Text>
        {statusIsEditable ? (
          <View style={styles.statusRow}>
            {statusOptions(section).map((option) => {
              const active = option === status;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.statusChip, active && styles.statusChipActive]}
                  onPress={() => setStatus(option)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      active && styles.statusChipTextActive,
                    ]}
                  >
                    {getLibroProgressLabel(section, option)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.readOnlyStatus}>
            <Text style={styles.readOnlyStatusText}>
              {getLibroProgressLabel(section, status)}
            </Text>
            <Text style={styles.readOnlyStatusHint}>
              Lo actualiza tu tutor en tus evaluaciones.
            </Text>
          </View>
        )}
      </View>

      {fields.map((field) =>
        field.type === "date" ? (
          <LibroDateField
            key={field.key}
            label={field.label}
            value={values[field.key] || ""}
            onChange={(next) =>
              setValues((prev) => ({ ...prev, [field.key]: next }))
            }
          />
        ) : (
          <View key={field.key} style={styles.field}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              style={[styles.input, field.multiline && styles.inputMultiline]}
              value={values[field.key] || ""}
              onChangeText={(text) =>
                setValues((prev) => ({ ...prev, [field.key]: text }))
              }
              placeholder={field.placeholder}
              placeholderTextColor="#94A3B8"
              multiline={!!field.multiline}
            />
          </View>
        )
      )}
    </LibroEditorScreen>
  );
};

export default LibroFichaScreen;

const styles = StyleSheet.create({
  descriptionCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  descriptionText: { fontSize: 13, lineHeight: 19, color: "#5B21B6" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
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
  inputMultiline: { minHeight: 110, textAlignVertical: "top" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusChipActive: { backgroundColor: "#F5F3FF", borderColor: "#670CF5" },
  statusChipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  statusChipTextActive: { color: "#670CF5" },
  readOnlyStatus: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4,
  },
  readOnlyStatusText: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  readOnlyStatusHint: { fontSize: 12, color: "#64748B" },
});
