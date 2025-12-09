import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Componente de filtro de selección (dropdown)
 * @param {object} props
 * @param {string} props.label - Etiqueta del filtro
 * @param {string} props.value - Valor seleccionado actual
 * @param {function} props.onSelect - Callback cuando se selecciona una opción
 * @param {array} props.options - Array de opciones [{id: string, name: string}]
 * @param {string} props.placeholder - Texto placeholder cuando no hay selección
 * @param {object} props.style - Estilos adicionales
 */
export const SelectFilter = ({
  label,
  value,
  onSelect,
  options = [],
  placeholder = "Seleccionar...",
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState("");

  const selectedOption = options.find(
    (opt) => opt.id === value || opt === value
  );
  const displayText = selectedOption
    ? selectedOption.name || selectedOption
    : placeholder;

  // Filtrar opciones basándose en el texto de búsqueda
  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) {
      return options;
    }
    const searchLower = searchText.toLowerCase().trim();
    return options.filter((option) => {
      const optionName = (option.name || option || "").toLowerCase();
      return optionName.includes(searchLower);
    });
  }, [options, searchText]);

  const handleSelect = (option) => {
    const optionValue = option.id || option;
    onSelect(optionValue === value ? "" : optionValue);
    setModalVisible(false);
    setSearchText(""); // Limpiar búsqueda al seleccionar
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSearchText(""); // Limpiar búsqueda al cerrar el modal
  };

  const renderOption = ({ item }) => {
    const optionValue = item.id || item;
    const optionName = item.name || item;
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
    if (value) {
      data.push({ id: "", name: placeholder });
    }
    // Agregar opciones filtradas
    data.push(...filteredOptions);
    return data;
  }, [filteredOptions, value, placeholder]);

  return (
    <View style={[styles.container, !label && styles.containerNoLabel, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
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
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity
                onPress={handleModalClose}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Campo de búsqueda */}
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

            <FlatList
              data={listData}
              renderItem={renderOption}
              keyExtractor={(item, index) =>
                (item.id || item).toString() + index
              }
              style={styles.optionsList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    No se encontraron resultados
                  </Text>
                </View>
              }
            />
          </View>
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
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
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
    maxHeight: 400,
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
