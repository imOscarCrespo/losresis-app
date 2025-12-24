import React, { useState } from "react";
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
 * Modal para agregar una entrada a un nodo
 * @param {Object} props
 * @param {boolean} props.visible - Si el modal es visible
 * @param {function} props.onClose - Callback para cerrar el modal
 * @param {function} props.onSubmit - Callback al enviar (recibe { count, residency_year, notes })
 * @param {Object} props.node - Nodo al que se le agregará la entrada
 * @param {boolean} props.loading - Si está cargando
 */
export const LibroEntryModal = ({
  visible,
  onClose,
  onSubmit,
  node,
  loading = false,
}) => {
  const [count, setCount] = useState("1");
  const [residencyYear, setResidencyYear] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const countNum = parseInt(count, 10);
    if (isNaN(countNum) || countNum < 1) {
      return;
    }

    onSubmit({
      count: countNum,
      residency_year: residencyYear ? parseInt(residencyYear, 10) : null,
      notes: notes.trim() || null,
    });

    // Reset form
    setCount("1");
    setResidencyYear("");
    setNotes("");
  };

  const handleClose = () => {
    setCount("1");
    setResidencyYear("");
    setNotes("");
    onClose();
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = currentYear; i >= currentYear - 10; i--) {
    yearOptions.push(i.toString());
  }

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
            <View>
              <Text style={styles.title}>Agregar Entrada</Text>
              {node && (
                <Text style={styles.subtitle}>{node.name}</Text>
              )}
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Contador */}
            <View style={styles.field}>
              <Text style={styles.label}>Cantidad *</Text>
              <TextInput
                style={styles.input}
                value={count}
                onChangeText={(text) => {
                  // Solo permitir números
                  const numericValue = text.replace(/[^0-9]/g, "");
                  setCount(numericValue || "1");
                }}
                keyboardType="number-pad"
                placeholder="1"
                autoFocus
              />
            </View>

            {/* Año de residencia */}
            <View style={styles.field}>
              <Text style={styles.label}>Año de residencia (opcional)</Text>
              <TextInput
                style={styles.input}
                value={residencyYear}
                onChangeText={(text) => {
                  // Solo permitir números y máximo 4 dígitos
                  const numericValue = text.replace(/[^0-9]/g, "").slice(0, 4);
                  setResidencyYear(numericValue);
                }}
                keyboardType="number-pad"
                placeholder="Ej: 2024"
                maxLength={4}
              />
            </View>

            {/* Notas */}
            <View style={styles.field}>
              <Text style={styles.label}>Notas (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Agregar notas adicionales..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading || !count || parseInt(count, 10) < 1) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || !count || parseInt(count, 10) < 1}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.submitButtonText}>Agregar</Text>
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
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  form: {
    flex: 1,
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
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 10,
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

export default LibroEntryModal;

