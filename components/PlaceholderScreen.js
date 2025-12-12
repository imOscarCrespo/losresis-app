import React from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * Componente reutilizable para pantallas placeholder
 * Muestra un título centrado con fondo blanco
 */
export const PlaceholderScreen = ({ title, textTransform = "none" }) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { textTransform }]}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
});
