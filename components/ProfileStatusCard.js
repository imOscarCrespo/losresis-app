import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Componente que muestra el estado del perfil (completo/incompleto)
 */
export const ProfileStatusCard = ({ isComplete }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons
          name={isComplete ? "checkmark-circle" : "alert-circle"}
          size={24}
          color={isComplete ? "#059669" : "#D97706"}
        />
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: isComplete ? "#059669" : "#D97706" },
            ]}
          >
            {isComplete ? "Perfil completo" : "Perfil incompleto"}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: isComplete ? "#047857" : "#B45309" },
            ]}
          >
            {isComplete
              ? "Tu perfil está completo y tienes acceso a todas las funciones"
              : "Completa tu perfil para desbloquear todas las funcionalidades"}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
