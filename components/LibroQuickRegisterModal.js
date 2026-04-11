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
import { Ionicons } from "@expo/vector-icons";
import { SelectFilter } from "./SelectFilter";

const TRACKING_MODE_COPY = {
  counter: {
    title: "Contador",
    cta: "Guardar procedimiento",
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

  const handleSubmit = () => {
    if (!selectedNode) return;

    const parsedCount = requiresCount ? Math.max(parseInt(count || "1", 10), 1) : 1;

    onSubmit({
      nodeId: selectedNode.id,
      count: parsedCount,
      performed_at: performedAt,
      notes: notes.trim() || null,
      kind: "counter",
      payload:
        trackingMode === "checklist"
          ? { completed: true }
          : trackingMode === "note"
            ? { mode: "note" }
            : {},
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
              <Ionicons name="close" size={22} color="#1B0977" />
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
              <Text style={styles.label}>Notas</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder={trackingCopy.notesPlaceholder}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryButton, (!selectedNode || loading) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={!selectedNode || loading}
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
