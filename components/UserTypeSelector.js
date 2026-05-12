import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotionPressable } from "./MotionPressable";
import { COLORS } from "../constants/colors";

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
    color: COLORS.PRIMARY,
  },
  {
    id: "host",
    label: "Anunciante de vivienda",
    subtitle: "Publica anuncios y responde a interesados",
    icon: "home",
    color: "#D97706",
  },
];

/**
 * Componente para seleccionar el tipo de usuario
 */
export const UserTypeSelector = ({ selectedType, onTypeChange }) => {
  const isResidentSelected = selectedType === "resident";
  const residentHelperText =
    "Te pediremos hospital, especialidad y año. Si ya tienes email corporativo, úsalo para validarlo al momento. Si aún no lo tienes por el periodo de transición MIR, podrás completar el resto ahora y añadirlo después.";

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
          <Ionicons name="sparkles-outline" size={18} color={COLORS.PRIMARY_DARK} />
          <Text style={styles.helperText}>
            {residentHelperText}
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
    color: COLORS.PRIMARY_DARK,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.TEXT_LIGHT,
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
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  optionCardActive: {
    borderColor: "#D8B4FE",
    backgroundColor: COLORS.PRIMARY_SOFT,
    shadowColor: COLORS.PRIMARY_DARK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  optionCardPressed: {
    backgroundColor: COLORS.SURFACE_SUBTLE,
    borderColor: COLORS.GRAY_MEDIUM,
  },
  optionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.GRAY_LIGHT,
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
    color: COLORS.TEXT_DARK,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
    lineHeight: 18,
  },
  optionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.GRAY_MEDIUM,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE,
  },
  helperCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: "#D8B4FE",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  helperText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.TEXT_MEDIUM,
  },
});
