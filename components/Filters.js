import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SearchFilter } from "./SearchFilter";
import { SelectFilter } from "./SelectFilter";

/**
 * Componente genérico de filtros
 * @param {object} props
 * @param {array} props.filters - Array de configuración de filtros
 * @param {function} props.onClearFilters - Callback para limpiar todos los filtros
 * @param {boolean} props.hasActiveFilters - Si hay filtros activos
 * @param {object} props.style - Estilos adicionales
 */
export const Filters = ({
  filters = [],
  onClearFilters,
  hasActiveFilters,
  style,
}) => {
  if (filters.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="filter" size={20} color="#007AFF" />
          <Text style={styles.headerTitle}>Filtros</Text>
        </View>
        {hasActiveFilters && onClearFilters && (
          <TouchableOpacity onPress={onClearFilters} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Limpiar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersScroll}
      >
        {filters.map((filter, index) => {
          if (filter.type === "search") {
            return (
              <SearchFilter
                key={filter.id || index}
                label={filter.label}
                value={filter.value}
                onChangeText={filter.onChange}
                placeholder={filter.placeholder}
                style={styles.filterItem}
              />
            );
          }

          if (filter.type === "select") {
            return (
              <SelectFilter
                key={filter.id || index}
                label={filter.label}
                value={filter.value}
                onSelect={filter.onSelect}
                options={filter.options || []}
                placeholder={filter.placeholder}
                style={styles.filterItem}
              />
            );
          }

          return null;
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginLeft: 8,
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
  filtersScroll: {
    paddingHorizontal: 16,
  },
  filterItem: {
    width: 280,
    marginRight: 16,
  },
});
