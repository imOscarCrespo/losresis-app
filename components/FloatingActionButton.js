import React from "react";
import { TouchableOpacity, StyleSheet, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

/**
 * Componente de botón flotante (FAB) para acciones principales
 * Se posiciona en la esquina inferior derecha de la pantalla
 *
 * @param {Function} onPress - Callback cuando se presiona el botón
 * @param {string} icon - Nombre del icono de Ionicons (default: "add")
 * @param {string} backgroundColor - Color de fondo del botón (default: COLORS.PRIMARY)
 * @param {string} iconColor - Color del icono (default: COLORS.WHITE)
 * @param {number} size - Tamaño del botón (default: 56)
 * @param {number} bottom - Distancia desde abajo (default: 20)
 * @param {number} right - Distancia desde la derecha (default: 20)
 */
export const FloatingActionButton = ({
  onPress,
  icon = "add",
  backgroundColor = COLORS.PRIMARY,
  iconColor = COLORS.WHITE,
  size = 56,
  bottom = 20,
  right = 20,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor,
          width: size,
          height: size,
          borderRadius: size / 2,
          bottom,
          right,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={size * 0.5} color={iconColor} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    // Sombra para iOS
    shadowColor: COLORS.BLACK,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    // Sombra adicional para Android
    ...(Platform.OS === "android" && {
      elevation: 8,
    }),
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});
