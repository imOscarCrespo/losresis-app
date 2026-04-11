/**
 * Componente reutilizable para mostrar el contador de filtros aplicados
 * @param {object} props
 * @param {number} props.count - Número de filtros activos
 * @param {object} props.style - Estilos adicionales
 * @param {string} props.variant - Variante del badge ('badge' | 'text')
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";

export const FilterCountBadge = ({ count = 0, style, variant = "badge" }) => {
  if (count === 0) {
    return null;
  }

  if (variant === "text") {
    return (
      <Text style={[styles.textBadge, style]}>
        {count} {count === 1 ? "filtro aplicado" : "filtros aplicados"}
      </Text>
    );
  }

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  badgeText: {
    color: COLORS.WHITE,
    fontSize: 12,
    fontWeight: "600",
  },
  textBadge: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
    marginLeft: 8,
    fontWeight: "400",
  },
});
