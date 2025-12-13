import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

const GRID_COLUMNS = 3;
const ICON_SIZE = 32;

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Item individual del grid
 */
const MenuGridItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityLabel={item.name}
      accessibilityRole="button"
    >
      <View style={styles.gridItemContent}>
        <View style={styles.iconContainer}>
          <Ionicons name={item.icon} size={ICON_SIZE} color={COLORS.PRIMARY} />
        </View>
        <Text style={styles.gridItemText} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Componente Grid de menú con 3 columnas
 * Muestra las opciones de navegación excluyendo las del footer
 *
 * @param {object} props
 * @param {array} props.navigationItems - Array de items de navegación
 * @param {array} props.footerItems - Array de items del footer (para excluir)
 * @param {object} props.userProfile - Perfil del usuario
 * @param {function} props.onItemPress - Callback cuando se presiona un item
 */
export const MenuGrid = ({
  navigationItems = [],
  footerItems = [],
  userProfile,
  onItemPress,
}) => {
  // Filtrar items según el tipo de usuario y excluir los del footer
  const filteredItems = useMemo(() => {
    if (!navigationItems || navigationItems.length === 0) return [];

    // IDs de items del footer para excluir
    const footerIds = footerItems.map((item) => item.id);

    return navigationItems.filter((item) => {
      // Excluir items del footer
      if (footerIds.includes(item.id)) {
        return false;
      }

      // Excluir "menu" ya que estamos dentro de él
      if (item.id === "menu") {
        return false;
      }

      // Filtrar según el tipo de usuario
      if (!userProfile) {
        // Si no hay perfil, mostrar solo items sin restricciones
        return !item.studentOnly && !item.doctorOnly && !item.superAdminOnly;
      }

      // Si es super admin, mostrar todo excepto los del footer
      if (userProfile.is_super_admin) {
        return true;
      }

      // Si es solo para estudiantes
      if (item.studentOnly) {
        return userProfile.is_student;
      }

      // Si es solo para doctores/residentes
      if (item.doctorOnly) {
        return userProfile.is_doctor || userProfile.is_resident;
      }

      // Si es solo para super admin
      if (item.superAdminOnly) {
        return userProfile.is_super_admin;
      }

      // Items sin restricciones
      return true;
    });
  }, [navigationItems, footerItems, userProfile]);

  // Calcular número de filas necesarias
  const rows = Math.ceil(filteredItems.length / GRID_COLUMNS);

  // Agrupar items en filas
  const gridRows = useMemo(() => {
    const rowsArray = [];
    for (let i = 0; i < rows; i++) {
      const start = i * GRID_COLUMNS;
      const end = start + GRID_COLUMNS;
      rowsArray.push(filteredItems.slice(start, end));
    }
    return rowsArray;
  }, [filteredItems, rows]);

  // Mapeo de IDs de navigationItems a IDs de pantallas (screen)
  // Basado en footerConfig.js para mantener consistencia
  const mapItemIdToScreen = (itemId, footerItemsList) => {
    // Buscar en los items del footer si existe un mapeo
    const footerItem = footerItemsList.find((item) => item.id === itemId);
    if (footerItem && footerItem.screen) {
      return footerItem.screen;
    }

    // Mapeo manual para items que no están en el footer
    const idMap = {
      comunidad: "comunity",
      "mi-resena": "myReview",
      "libro-residente": "residenceLibrary",
      preferencias: "myPreferences",
    };
    return idMap[itemId] || itemId;
  };

  const handleItemPress = (item) => {
    if (onItemPress) {
      // Mapear el ID del item al ID de la pantalla
      const screenId = mapItemIdToScreen(item.id, footerItems);
      onItemPress({ ...item, screenId });
    }
  };

  if (filteredItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="grid-outline" size={48} color={COLORS.GRAY} />
        <Text style={styles.emptyText}>No hay opciones disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.gridContainer}>
      {gridRows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row.map((item) => (
            <MenuGridItem
              key={item.id}
              item={item}
              onPress={() => handleItemPress(item)}
            />
          ))}
          {/* Rellenar espacios vacíos en la última fila */}
          {row.length < GRID_COLUMNS &&
            Array.from({ length: GRID_COLUMNS - row.length }).map(
              (_, index) => (
                <View key={`empty-${index}`} style={styles.gridItem} />
              )
            )}
        </View>
      ))}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  gridContainer: {
    padding: 16,
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  gridItem: {
    flex: 1,
    marginHorizontal: 6,
    aspectRatio: 1,
    maxWidth: "33.33%",
  },
  gridItemContent: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.GRAY_LIGHT,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gridItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: "center",
  },
});
