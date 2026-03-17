import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SelectorModal } from "./SelectorModal";

/**
 * Componente de filtro de selección (dropdown)
 * @param {object} props
 * @param {string} props.label - Etiqueta del filtro
 * @param {string} props.value - Valor seleccionado actual
 * @param {function} props.onSelect - Callback cuando se selecciona una opción
 * @param {function} props.onChange - Alias de onSelect para compatibilidad
 * @param {array} props.options - Array de opciones [{id/value: string, name/label: string}]
 * @param {string} props.placeholder - Texto placeholder cuando no hay selección
 * @param {object} props.style - Estilos adicionales
 * @param {boolean} props.enableSearch - Si se habilita la búsqueda (por defecto true)
 * @param {boolean} props.disabled - Si el selector está deshabilitado
 * @param {boolean} props.required - Si el campo es obligatorio (muestra asterisco)
 */
export const SelectFilter = ({
  label,
  value,
  onSelect,
  onChange,
  options = [],
  placeholder = "Seleccionar...",
  style,
  enableSearch = true,
  disabled = false,
  required = false,
}) => {
  // Usar onChange si está disponible, sino onSelect
  const handleChange = onChange || onSelect;
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(
    (opt) => (opt.id || opt.value) === value || opt === value
  );

  // Asegurar que displayText sea siempre un string
  const displayText = selectedOption
    ? typeof selectedOption === "string"
      ? selectedOption
      : selectedOption.label ||
        selectedOption.name ||
        String(selectedOption.value || selectedOption.id || "")
    : placeholder;

  const normalizedOptions = options.map((option) => {
    if (typeof option === "string") {
      return { id: option, name: option };
    }

    return {
      ...option,
      id: option.id ?? option.value ?? "",
      name: option.name ?? option.label ?? String(option.id ?? option.value ?? ""),
    };
  });

  const handleSelect = (nextValue) => {
    handleChange(nextValue === value && !required ? "" : nextValue);
    setModalVisible(false);
  };

  return (
    <View style={[styles.container, !label && styles.containerNoLabel, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.selectButton, disabled && styles.selectButtonDisabled]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        <Text
          style={[
            styles.selectText,
            !selectedOption && styles.selectTextPlaceholder,
          ]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#1B0977" />
      </TouchableOpacity>

      <SelectorModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={label || placeholder}
        options={normalizedOptions}
        value={value}
        onSelect={handleSelect}
        placeholder={placeholder}
        allowClear={!required}
        enableSearch={enableSearch}
        emptyText={
          enableSearch ? "No se encontraron resultados" : "No hay opciones"
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  containerNoLabel: {
    marginBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1B0977",
    marginBottom: 8,
  },
  required: {
    color: "#FF3B30",
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectButtonDisabled: {
    backgroundColor: "#EEF2F7",
    opacity: 0.6,
  },
  selectText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginRight: 8,
  },
  selectTextPlaceholder: {
    color: "#94A3B8",
  },
});
