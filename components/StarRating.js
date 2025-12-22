import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Componente de valoración por estrellas
 * @param {number} rating - Valoración actual (0-5)
 * @param {function} onRatingChange - Callback al cambiar la valoración
 * @param {number} maxRating - Máximo de estrellas (por defecto 5)
 * @param {number} size - Tamaño de las estrellas (por defecto 24)
 * @param {string} color - Color de las estrellas seleccionadas
 * @param {boolean} disabled - Si está deshabilitado
 */
export const StarRating = ({
  rating = 0,
  onRatingChange,
  maxRating = 5,
  size = 24,
  color = "#FFD700",
  disabled = false,
}) => {
  const handlePress = (value) => {
    if (!disabled && onRatingChange) {
      onRatingChange(value);
    }
  };

  return (
    <View style={styles.container}>
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= rating;

        return (
          <TouchableOpacity
            key={index}
            onPress={() => handlePress(starValue)}
            disabled={disabled}
            style={styles.starButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isFilled ? "star" : "star-outline"}
              size={size}
              color={isFilled ? color : "#D1D5DB"}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
});


