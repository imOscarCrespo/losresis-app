import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../Icon";

// Acceso a "Organizar mis gastos" desde el detalle y la edición de una nómina.
export default function OrganizeExpensesPromptCard({ onPress, isOrganized = false }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Icon name="wallet-outline" size={22} color="#670CF5" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>¿Cómo organizas tu dinero este mes?</Text>
          <Text style={styles.subtitle}>
            Reparte tus gastos principales y descubre cuánto te queda disponible.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        testID="organize-expenses-button"
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <Text style={styles.buttonText}>
          {isOrganized ? "Ver mis gastos" : "Organizar mis gastos"}
        </Text>
        <Icon name="chevron-forward" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F4EEFF",
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B0977",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#4C1D95",
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
