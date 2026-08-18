import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "./Icon";
import { SelectFilter } from "./SelectFilter";
import { LIBRO_PARTICIPATION_LEVELS } from "../data/libroSections";

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

export const LibroQuickRegisterModal = ({
  visible,
  onClose,
  onSubmit,
  categories = [],
  initialNode = null,
  loading = false,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [count, setCount] = useState("1");
  const [performedAt, setPerformedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [participationLevel, setParticipationLevel] = useState("");

  useEffect(() => {
    if (!visible) return;

    if (initialNode) {
      setSelectedNodeId(initialNode.id);
      setSelectedCategoryId(initialNode.parent_node_id || "");
    } else {
      setSelectedNodeId("");
      setSelectedCategoryId(categories[0]?.id || "");
    }

    setCount("1");
    setPerformedAt(new Date().toISOString().slice(0, 10));
    setNotes("");
    setParticipationLevel("");
  }, [visible, initialNode, categories]);

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
  // comments_mode puede no venir (nodo anterior al rediseño, o libro montado por
  // el residente): entonces el comentario sigue siendo opcional, como siempre.
  const commentsRequired = selectedNode?.comments_mode === "required";
  const missingParticipation = byParticipation && !participationLevel;
  const missingComment = commentsRequired && !notes.trim();
  const canSubmit =
    Boolean(selectedNode) && !missingParticipation && !missingComment;

  const handleSubmit = () => {
    if (!selectedNode || !canSubmit) return;

    // Un registro por participación es un acto con su nivel, no una cantidad:
    // cuenta uno, igual que antes.
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Registro rápido</Text>
              <Text style={styles.subtitle}>
                Selecciona un procedimiento y guarda el registro en segundos.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={22} color="#1B0977" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!initialNode ? (
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
            ) : null}

            {!initialNode ? (
              <SelectFilter
                label="Procedimiento"
                value={selectedNodeId}
                onSelect={setSelectedNodeId}
                options={activityOptions}
                placeholder="Seleccionar procedimiento"
                required
                disabled={!selectedCategory}
              />
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
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Fecha</Text>
              <TextInput
                style={styles.input}
                value={performedAt}
                onChangeText={setPerformedAt}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {commentsRequired ? "Comentario (obligatorio)" : "Notas"}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder={trackingCopy.notesPlaceholder}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {missingComment ? (
                <Text style={styles.fieldHint}>
                  Tu tutor pide un comentario en cada registro de esta actividad.
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryButton, (!canSubmit || loading) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{trackingCopy.cta}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default LibroQuickRegisterModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B0977",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modeCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1B0977",
  },
  modeText: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#1B0977",
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0F172A",
  },
  textArea: {
    minHeight: 110,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#B45309",
  },
  levelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  levelChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  levelChipActive: {
    backgroundColor: "#F4EFFE",
    borderColor: "#680CF5",
  },
  levelChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  levelChipTextActive: {
    color: "#680CF5",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
