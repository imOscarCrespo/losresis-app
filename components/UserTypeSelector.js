import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotionPressable } from "./MotionPressable";

const USER_TYPES = [
  {
    id: "student",
    label: "Estudiante/PostMir",
    subtitle: "Estudiante/PostMir de medicina",
    icon: "school",
    color: "#059669",
  },
  {
    id: "resident",
    label: "Residente",
    subtitle: "Médico residente",
    icon: "person",
    color: "#007AFF",
  },
];

/**
 * Componente para seleccionar el tipo de usuario
 */
export const UserTypeSelector = ({ selectedType, onTypeChange }) => {
  const isResidentSelected = selectedType === "resident";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¿Cómo usas la app ahora mismo?</Text>
      <Text style={styles.subtitle}>
        Esto adapta tu perfil y las funciones que verás dentro de la app.
      </Text>
      <View style={styles.optionsContainer}>
        {USER_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          return (
            <MotionPressable
              key={type.id}
              style={[styles.optionCard, isSelected && styles.optionCardActive]}
              pressedStyle={styles.optionCardPressed}
              onPress={() => onTypeChange(type.id)}
              scaleTo={0.97}
              pressedOpacity={0.96}
            >
              <View
                style={[
                  styles.optionIconWrap,
                  isSelected && { backgroundColor: `${type.color}14` },
                ]}
              >
                <Ionicons
                  name={type.icon}
                  size={22}
                  color={isSelected ? type.color : "#64748B"}
                />
              </View>
              <View style={styles.optionTextBlock}>
                <Text
                  style={[
                    styles.optionTitle,
                    isSelected && { color: type.color },
                  ]}
                >
                  {type.label}
                </Text>
                <Text style={styles.optionSubtitle}>{type.subtitle}</Text>
              </View>
              <View
                style={[
                  styles.optionCheck,
                  isSelected && {
                    borderColor: type.color,
                    backgroundColor: type.color,
                  },
                ]}
              >
                {isSelected ? (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                ) : null}
              </View>
            </MotionPressable>
          );
        })}
      </View>
      {isResidentSelected ? (
        <View style={styles.helperCard}>
          <Ionicons name="sparkles-outline" size={18} color="#1B0977" />
          <Text style={styles.helperText}>
            Te pediremos hospital, especialidad, año y email corporativo para
            activar tu perfil de residente.
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  optionCardActive: {
    borderColor: "#C7D2FE",
    backgroundColor: "#F8FAFF",
    shadowColor: "#1B0977",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  optionCardPressed: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
  },
  optionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  optionTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  optionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  helperCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D9E4FF",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  helperText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#334155",
  },
});
