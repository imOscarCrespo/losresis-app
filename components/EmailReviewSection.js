import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Componente para mostrar la sección de revisión manual de email
 * cuando el email de trabajo no es válido
 */
export const EmailReviewSection = ({
  workEmail,
  onSubmit,
  onCancel,
  isSubmitting,
  isSubmitted,
}) => {
  const instructions = [
    "Verifica que el email que has puesto es realmente tu email de trabajo del hospital",
    "Haz clic en \"Solicitar revisión manual\" para que nuestro equipo revise tu caso",
    "Te contactaremos pronto para confirmar tu email y activar tu cuenta",
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail" size={24} color="#D97706" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>¿Tu email de trabajo no es válido?</Text>
          <Text style={styles.subtitle}>
            No te preocupes, esto puede pasar. Si el email que has puesto es
            realmente tu email de trabajo del hospital, podemos revisarlo
            manualmente para ti.
          </Text>
        </View>
      </View>

      <View style={styles.emailDisplayBox}>
        <Text style={styles.emailLabel}>Email que has introducido:</Text>
        <Text style={styles.emailValue} numberOfLines={1}>
          {workEmail}
        </Text>
      </View>

      <View style={styles.instructionsBox}>
        <Text style={styles.instructionsTitle}>¿Qué necesitas hacer?</Text>
        <View style={styles.instructionsList}>
          {instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.buttonPrimary,
            (isSubmitting || isSubmitted) && styles.buttonDisabled,
          ]}
          onPress={onSubmit}
          disabled={isSubmitting || isSubmitted}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : isSubmitted ? (
            <Text style={styles.buttonText}>Solicitud enviada ✓</Text>
          ) : (
            <Text style={styles.buttonText}>Solicitar revisión manual</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buttonCancel}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonCancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  header: {
    flexDirection: "row",
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#78350F",
    lineHeight: 20,
  },
  emailDisplayBox: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  emailLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  instructionsBox: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  instructionsList: {
    // Spacing handled by instructionItem marginBottom
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  instructionNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 2,
  },
  instructionNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#D97706",
  },
  buttonDisabled: {
    backgroundColor: "#FCD34D",
    opacity: 0.7,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonCancelText: {
    color: "#D97706",
    fontSize: 14,
    fontWeight: "600",
  },
});

