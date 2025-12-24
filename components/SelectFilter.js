import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const [searchText, setSearchText] = useState("");

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

  // Filtrar opciones basándose en el texto de búsqueda
  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) {
      return options;
    }
    const searchLower = searchText.toLowerCase().trim();
    return options.filter((option) => {
      // Asegurar que optionName sea siempre un string
      const optionName =
        typeof option === "string"
          ? option
          : option.label ||
            option.name ||
            String(option.value || option.id || "");
      return optionName.toLowerCase().includes(searchLower);
    });
  }, [options, searchText]);

  const handleSelect = (option) => {
    const optionValue = option.value || option.id || option;
    handleChange(optionValue === value ? "" : optionValue);
    setModalVisible(false);
    setSearchText(""); // Limpiar búsqueda al seleccionar
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSearchText(""); // Limpiar búsqueda al cerrar el modal
  };

  const renderOption = ({ item }) => {
    const optionValue = item.value || item.id || item;
    // Asegurar que optionName sea siempre un string
    const optionName =
      typeof item === "string"
        ? item
        : item.label ||
          item.name ||
          String(item.value || item.id || "");
    const isSelected = optionValue === value;

    return (
      <TouchableOpacity
        style={[styles.optionItem, isSelected && styles.optionItemSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.optionText, isSelected && styles.optionTextSelected]}
        >
          {optionName}
        </Text>
        {isSelected && <Ionicons name="checkmark" size={20} color="#007AFF" />}
      </TouchableOpacity>
    );
  };

  // Preparar datos para la lista (incluir opción de limpiar si hay selección)
  const listData = useMemo(() => {
    const data = [];
    // Agregar opción de limpiar selección solo si hay una selección activa
    if (value && !required) {
      data.push({ id: "", name: placeholder, value: "", label: placeholder });
    }
    // Agregar opciones filtradas
    data.push(...filteredOptions);
    return data;
  }, [filteredOptions, value, placeholder, required]);

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
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleModalClose}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleModalClose}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={0}
          >
            <View
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{label || placeholder}</Text>
                <TouchableOpacity
                  onPress={handleModalClose}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Campo de búsqueda */}
              {enableSearch && (
                <View style={styles.searchContainer}>
                  <Ionicons
                    name="search"
                    size={20}
                    color="#999"
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar..."
                    placeholderTextColor="#999"
                    value={searchText}
                    onChangeText={setSearchText}
                    autoFocus={false}
                  />
                  {searchText.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchText("")}
                      style={styles.clearSearchButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <FlatList
                data={listData}
                renderItem={renderOption}
                keyExtractor={(item, index) =>
                  (item.id || item).toString() + index
                }
                style={styles.optionsList}
                contentContainerStyle={styles.optionsListContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No se encontraron resultados
                    </Text>
                  </View>
                }
              />
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
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
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  required: {
    color: "#FF3B30",
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectButtonDisabled: {
    backgroundColor: "#F9FAFB",
    opacity: 0.6,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
    marginRight: 8,
  },
  selectTextPlaceholder: {
    color: "#999",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "70%",
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1a1a1a",
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 4,
  },
  optionsList: {
    flex: 1,
  },
  optionsListContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  optionItemSelected: {
    backgroundColor: "#F0F8FF",
  },
  optionText: {
    fontSize: 16,
    color: "#1a1a1a",
    flex: 1,
  },
  optionTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
