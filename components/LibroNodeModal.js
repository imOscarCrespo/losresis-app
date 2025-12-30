import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

/**
 * Modal para agregar o editar un nodo del libro
 * @param {Object} props
 * @param {boolean} props.visible - Si el modal es visible
 * @param {function} props.onClose - Callback para cerrar el modal
 * @param {function} props.onSubmit - Callback al enviar (recibe { name, parent_node_id })
 * @param {Object} props.existingNode - Nodo existente para editar (opcional)
 * @param {Array} props.parentNodes - Lista de nodos padre disponibles (opcional)
 * @param {Object} props.selectedParent - Padre preseleccionado para crear hijo (opcional)
 * @param {boolean} props.loading - Si está cargando
 */
export const LibroNodeModal = ({
  visible,
  onClose,
  onSubmit,
  existingNode = null,
  parentNodes = [],
  selectedParent = null,
  loading = false,
}) => {
  const [name, setName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [goal, setGoal] = useState("");

  useEffect(() => {
    if (existingNode) {
      setName(existingNode.name || "");
      setSelectedParentId(existingNode.parent_node_id || null);
      setGoal(existingNode.goal?.toString() || "");
    } else {
      setName("");
      // Si hay un padre preseleccionado, usarlo; si no, null
      setSelectedParentId(selectedParent?.id || null);
      setGoal("");
    }
  }, [existingNode, selectedParent, visible]);

  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }

    const submitData = {
      name: name.trim(),
      parent_node_id: existingNode
        ? existingNode.parent_node_id
        : selectedParentId,
    };

    // Si tiene un padre (es un hijo), incluir el goal
    const isChild = existingNode
      ? existingNode.parent_node_id
      : selectedParentId;

    if (isChild) {
      const goalNum = goal.trim() ? parseInt(goal.trim(), 10) : null;
      if (goalNum && goalNum > 0) {
        submitData.goal = goalNum;
      } else if (existingNode && !goal.trim()) {
        // Si se está editando y se borra el goal, mantener null
        submitData.goal = null;
      }
    }

    onSubmit(submitData);
  };

  const handleClose = () => {
    setName("");
    setSelectedParentId(null);
    setGoal("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {existingNode ? "Editar Nodo" : "Nuevo Nodo"}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* Nombre del nodo */}
            <View style={styles.field}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Partos eutócicos"
                autoFocus
              />
            </View>

            {/* Campo de objetivo (solo si se seleccionó un padre o si es edición de un hijo) */}
            {(selectedParentId ||
              (existingNode && existingNode.parent_node_id)) && (
              <View style={styles.field}>
                <Text style={styles.label}>Objetivo (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={goal}
                  onChangeText={(text) => {
                    // Solo permitir números
                    const numericValue = text.replace(/[^0-9]/g, "");
                    setGoal(numericValue);
                  }}
                  keyboardType="number-pad"
                  placeholder="Ej: 50"
                />
                <Text style={styles.helperText}>
                  Si no se especifica, se usará 50 por defecto
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!name.trim() || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!name.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {existingNode ? "Actualizar" : "Crear"}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  overlayTouchable: {
    flex: 1,
  },
  content: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "50%",
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  form: {
    flex: 1,
    maxHeight: "100%",
  },
  formContent: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    backgroundColor: COLORS.WHITE,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  parentOptionText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
  },
  parentOptionTextSelected: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  submitButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.GRAY_MEDIUM,
  },
  submitButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: COLORS.GRAY_DARK,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default LibroNodeModal;
