import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const USER_TYPES = [
  {
    id: "student",
    label: "Estudiante",
    subtitle: "Estudiante de medicina",
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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tipo de Usuario</Text>
      <View style={styles.cardsContainer}>
        {USER_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.card,
                isSelected && styles.cardActive,
              ]}
              onPress={() => onTypeChange(type.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={type.icon}
                size={32}
                color={isSelected ? type.color : "#6B7280"}
              />
              <Text
                style={[
                  styles.cardTitle,
                  isSelected && { color: type.color },
                ]}
              >
                {type.label}
              </Text>
              <Text style={styles.cardSubtitle}>{type.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  cardsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E5EA",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  cardActive: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F8FF",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 8,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});

