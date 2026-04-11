import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

/**
 * Componente de filtro de búsqueda por texto
 * @param {object} props
 * @param {string} props.label - Etiqueta del filtro
 * @param {string} props.value - Valor actual del filtro
 * @param {function} props.onChangeText - Callback cuando cambia el texto
 * @param {string} props.placeholder - Texto placeholder
 * @param {object} props.style - Estilos adicionales
 */
export const SearchFilter = ({
  label,
  value,
  onChangeText,
  placeholder = "Buscar...",
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons
          name="search"
          size={20}
          color={COLORS.TEXT_LIGHT}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.TEXT_LIGHT}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
  },
});
