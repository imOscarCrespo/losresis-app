import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Componente Footer de navegación con iconos
 * @param {object} props
 * @param {function} props.onHospitalPress - Callback cuando se presiona el icono de hospital
 * @param {function} props.onStudentPress - Callback cuando se presiona el icono de estudiante
 * @param {function} props.onReviewsPress - Callback cuando se presiona el icono de reseñas
 * @param {string} props.activeTab - Tab activo: 'hospital', 'student', 'reviews'
 * @param {object} props.style - Estilos adicionales para el contenedor
 */
export const Footer = ({
  onHospitalPress,
  onStudentPress,
  onReviewsPress,
  activeTab,
  style,
}) => {
  const activeColor = "#007AFF";
  const inactiveColor = "#8E8E93";

  return (
    <View style={[styles.footerContainer, style]}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={onHospitalPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="medical"
          size={24}
          color={activeTab === "hospital" ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.navLabel,
            activeTab === "hospital" && styles.navLabelActive,
          ]}
        >
          Hospitales
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={onStudentPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="school"
          size={24}
          color={activeTab === "student" ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.navLabel,
            activeTab === "student" && styles.navLabelActive,
          ]}
        >
          Simulador MIR
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={onReviewsPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="star"
          size={24}
          color={activeTab === "reviews" ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.navLabel,
            activeTab === "reviews" && styles.navLabelActive,
          ]}
        >
          Reseñas
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  footerContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 4,
    fontWeight: "500",
  },
  navLabelActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
