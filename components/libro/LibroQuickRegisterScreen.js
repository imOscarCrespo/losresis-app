import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SelectFilter } from "../SelectFilter";
import { LibroEditorScreen } from "./LibroEditorScreen";
import { LibroDateField, toIsoDate } from "./LibroDateField";
import { LIBRO_PARTICIPATION_LEVELS } from "../../data/libroSections";

/**
 * La pantalla con la que el residente registra una actividad del arquetipo `tree`
 * (Actividad asistencial): un procedimiento hecho, una nota, un checklist.
 *
 * Cómo se registra lo decide el `tracking_mode` de la actividad, que pone el tutor
 * desde el panel: contador, participación, nota o checklist. El residente no lo elige.
 */

const TRACKING_MODE_COPY = {
  counter: {
    title: "Contador",
    cta: "Guardar procedimiento",
    notesPlaceholder: "Notas breves o contexto clínico",
  },
  participation: {
    title: "Por nivel de participación",
    cta: "Guardar registro",
    notesPlaceholder: "Notas breves o contexto clínico",
  },
  note: {
    title: "Nota",
    cta: "Guardar nota",
    notesPlaceholder: "Qué ocurrió o qué quieres guardar",
  },
  checklist: {
    title: "Checklist",
    cta: "Marcar registro",
    notesPlaceholder: "Checklist o recordatorio asociado",
  },
};

export const LibroQuickRegisterScreen = ({
  onClose,
  onSubmit,
  categories = [],
  initialNode = null,
  loading = false,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialNode ? initialNode.parent_node_id || "" : categories[0]?.id || ""
  );
  const [selectedNodeId, setSelectedNodeId] = useState(initialNode?.id || "");
  const [count, setCount] = useState("1");
  const [performedAt, setPerformedAt] = useState(() => toIsoDate(new Date()));
  const [notes, setNotes] = useState("");
  const [participationLevel, setParticipationLevel] = useState("");

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ id: category.id, name: category.name })),
    [categories]
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const activityOptions = useMemo(
    () =>
      (selectedCategory?.children || []).map((node) => ({
        id: node.id,
        name: node.name,
      })),
    [selectedCategory]
  );

  const selectedNode = useMemo(() => {
    if (initialNode) return initialNode;
    return (
      selectedCategory?.children?.find((node) => node.id === selectedNodeId) || null
    );
  }, [initialNode, selectedCategory, selectedNodeId]);

  const trackingMode = selectedNode?.tracking_mode || "counter";
  const trackingCopy = TRACKING_MODE_COPY[trackingMode] || TRACKING_MODE_COPY.counter;
  const requiresCount = trackingMode === "counter";
  // El desglose por nivel lo activa el tutor desde el panel.
  const byParticipation = trackingMode === "participation";
  // comments_mode puede no venir (nodo anterior al rediseño, o libro montado por el
  // residente): entonces el comentario sigue siendo opcional, como siempre.
  const commentsRequired = selectedNode?.comments_mode === "required";
  const missingParticipation = byParticipation && !participationLevel;
  const missingComment = commentsRequired && !notes.trim();
  const canSubmit =
    Boolean(selectedNode) && !missingParticipation && !missingComment;

  // Un botón gris que no responde y sin explicación es indistinguible de un bug: el
  // residente no eligió este modo, lo activó su tutor desde el panel. Así que el
  // propio botón dice qué falta.
  const missingLabel = !selectedNode
    ? "Elige un procedimiento"
    : missingParticipation
      ? "Elige tu participación"
      : missingComment
        ? "Escribe el comentario"
        : null;

  const handleSubmit = () => {
    if (!selectedNode || !canSubmit) return;

    // Un registro por participación es un acto con su nivel, no una cantidad: cuenta
    // uno, igual que antes.
    const parsedCount = requiresCount
      ? Math.max(parseInt(count || "1", 10), 1)
      : 1;

    const payload = {};
    if (trackingMode === "checklist") {
      payload.completed = true;
    }
    if (trackingMode === "note") {
      payload.mode = "note";
    }
    if (byParticipation && participationLevel) {
      payload.participation_level = participationLevel;
    }

    onSubmit({
      nodeId: selectedNode.id,
      count: parsedCount,
      performed_at: performedAt,
      notes: notes.trim() || null,
      kind: "counter",
      payload,
    });
  };

  return (
    <LibroEditorScreen
      title={initialNode?.name || "Registro"}
      onClose={onClose}
      saving={loading}
      primaryLabel={missingLabel || trackingCopy.cta}
      primaryDisabled={!canSubmit}
      onPrimary={handleSubmit}
    >
      {!initialNode ? (
        <>
          <SelectFilter
            label="Rotación"
            value={selectedCategoryId}
            onSelect={(value) => {
              setSelectedCategoryId(value);
              setSelectedNodeId("");
            }}
            options={categoryOptions}
            placeholder="Seleccionar rotación"
            required
          />

          <SelectFilter
            label="Procedimiento"
            value={selectedNodeId}
            onSelect={setSelectedNodeId}
            options={activityOptions}
            placeholder="Seleccionar procedimiento"
            required
            disabled={!selectedCategory}
          />
        </>
      ) : null}

      {selectedNode ? (
        <View style={styles.modeCard}>
          <Text style={styles.modeTitle}>{trackingCopy.title}</Text>
          <Text style={styles.modeText}>
            {selectedNode.goal
              ? `Meta objetivo: ${selectedNode.goal}`
              : "Sin objetivo configurado"}
          </Text>
        </View>
      ) : null}

      {requiresCount ? (
        <View style={styles.field}>
          <Text style={styles.label}>Cantidad</Text>
          <TextInput
            style={styles.input}
            value={count}
            onChangeText={(text) => setCount(text.replace(/[^0-9]/g, "") || "1")}
            keyboardType="number-pad"
            placeholder="1"
          />
        </View>
      ) : null}

      {byParticipation ? (
        <View style={styles.field}>
          <Text style={styles.label}>¿Cuál fue tu participación?</Text>
          <View style={styles.levelRow}>
            {LIBRO_PARTICIPATION_LEVELS.map((level) => {
              const active = participationLevel === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.levelChip, active && styles.levelChipActive]}
                  onPress={() => setParticipationLevel(level)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.levelChipText,
                      active && styles.levelChipTextActive,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {missingParticipation ? (
            <Text style={styles.fieldHint}>
              Tu tutor pide el nivel de participación en cada registro de esta
              actividad.
            </Text>
          ) : null}
        </View>
      ) : null}

      <LibroDateField
        label="Fecha"
        value={performedAt}
        onChange={setPerformedAt}
        clearable={false}
        placeholder="Elige el día"
      />

      <View style={styles.field}>
        <Text style={styles.label}>
          {commentsRequired ? "Comentario (obligatorio)" : "Notas"}
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder={trackingCopy.notesPlaceholder}
          placeholderTextColor="#94A3B8"
          multiline
          textAlignVertical="top"
        />
        {missingComment ? (
          <Text style={styles.fieldHint}>
            Tu tutor pide un comentario en cada registro de esta actividad.
          </Text>
        ) : null}
      </View>
    </LibroEditorScreen>
  );
};

export default LibroQuickRegisterScreen;

const styles = StyleSheet.create({
  modeCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modeTitle: { fontSize: 14, fontWeight: "800", color: "#1B0977" },
  modeText: { marginTop: 4, fontSize: 13, color: "#64748B" },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569" },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  textArea: { minHeight: 110 },
  fieldHint: { fontSize: 12, color: "#B45309" },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  levelChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  levelChipActive: { backgroundColor: "#F4EFFE", borderColor: "#670CF5" },
  levelChipText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  levelChipTextActive: { color: "#680CF5" },
});
