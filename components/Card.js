import React from "react";
import { View, StyleSheet } from "react-native";

/**
 * Componente Card reutilizable
 * @param {object} props
 * @param {React.ReactNode} props.children - Contenido del card
 * @param {object} props.style - Estilos adicionales
 */
export const Card = ({ children, style, ...props }) => {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});
