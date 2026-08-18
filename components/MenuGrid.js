import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Icon } from "./Icon";
import { COLORS } from "../constants/colors";
import {
  canWriteResidentHospitalReview,
  hasResidentFeatureAccess,
  isResidentLockedMissingCorporateEmail,
} from "../utils/residentAccess";
import { useEmailReviewStatus } from "../hooks/useEmailReviewStatus";

const GRID_COLUMNS = 2;
const ICON_SIZE = 40;

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Item individual del grid con diseño moderno
 */
const MenuGridItem = ({
  item,
  onPress,
  disabled = false,
  showBadge = false,
}) => {
  // Colores por defecto si no están definidos
  const backgroundColor = disabled ? COLORS.GRAY : item.color || COLORS.PRIMARY;
  const lightColor = item.lightColor || COLORS.BADGE_BLUE_BG;

  return (
    <TouchableOpacity
      style={[styles.gridItem, disabled && styles.gridItemDisabled]}
      onPress={() => !disabled && onPress(item)}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
      accessibilityLabel={item.name}
      accessibilityRole="button"
    >
      <View style={[styles.gridItemContent, { backgroundColor }]}>
        {showBadge ? <View style={styles.notificationBadge} /> : null}
        {/* Overlay con gradiente sutil */}
        <View style={styles.gradientOverlay} />

        {/* Icono en círculo blanco en la esquina superior derecha */}
        <View style={styles.iconCircle}>
          <Icon
            name={item.icon}
            size={24}
            color={disabled ? COLORS.GRAY_DARK : backgroundColor}
          />
        </View>

        {/* Contenido principal */}
        <View style={styles.contentContainer}>
          <Text
            style={[
              styles.gridItemTitle,
              disabled && styles.gridItemTitleDisabled,
            ]}
            numberOfLines={2}
          >
            {item.name}
          </Text>

          {/* Información adicional opcional */}
          {item.description && (
            <Text
              style={[
                styles.gridItemSubtitle,
                disabled && styles.gridItemSubtitleDisabled,
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}
        </View>

        {/* Badge "Próximamente" si aplica */}
        {(item.comingSoon || item.commingSoon) && (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Próximamente</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Componente Grid de menú con 2 columnas (diseño moderno 2x2)
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
  residentHasReview = true,
  residentReviewGateStatus = "soft",
  residentReviewGateBypassed = false,
  showNotificationsBadge = false,
}) => {
  const { request: emailReviewRequest } = useEmailReviewStatus(userProfile?.id);
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

      if (
        item.requiredFeatureKey === "clinical_assistant_chat" &&
        !userProfile?.can_use_clinical_assistant
      ) {
        return false;
      }

      if (
        item.requiredFeatureKey === "photo_study_analysis" &&
        !userProfile?.can_use_photo_study
      ) {
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

      // Ocultar "Reseñas" a perfiles residentes en el menú principal
      if (item.id === "reseñas" && userProfile.is_resident) {
        return false;
      }

      if (item.id === "mi-resena" && userProfile.is_resident && residentHasReview) {
        return false;
      }

      if (
        item.id === "mi-resena" &&
        userProfile.is_resident &&
        !canWriteResidentHospitalReview(userProfile, { emailReviewRequest })
      ) {
        return false;
      }

      // Salud mental: visible para todo residente aunque esté bloqueado por el
      // gate (los recursos de ayuda no deben ocultarse; la propia pantalla bloquea
      // solo el cuestionario). Ver docs/analisis-residente/06-plan-implementacion-salud-mental.md.
      if (item.id === "mentalHealth") {
        return userProfile.is_resident;
      }

      // Si es solo para estudiantes
      if (item.studentOnly) {
        return userProfile.is_student;
      }

      // Si es solo para residentes
      if (item.residentOnly) {
        return hasResidentFeatureAccess(userProfile);
      }

      // Si es solo para doctores/residentes
      if (item.doctorOnly) {
        return userProfile.is_doctor || hasResidentFeatureAccess(userProfile);
      }

      // Si es solo para super admin
      if (item.superAdminOnly) {
        return userProfile.is_super_admin;
      }

      // Items sin restricciones
      return true;
    });
  }, [
    navigationItems,
    footerItems,
    userProfile,
    residentHasReview,
    residentReviewGateBypassed,
    emailReviewRequest,
  ]);

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

  // Determinar si un item debe estar deshabilitado
  const isItemDisabled = (item) => {
    // Si tiene comingSoon (o commingSoon por compatibilidad), deshabilitar
    if (item.comingSoon || item.commingSoon) {
      return true;
    }

    if (
      userProfile?.is_resident &&
      !userProfile?.is_super_admin &&
      !residentReviewGateBypassed &&
      !residentHasReview &&
      residentReviewGateStatus === "hard"
    ) {
      return !["mi-resena", "usuario", "contacto", "mentalHealth"].includes(
        item.id
      );
    }

    if (isResidentLockedMissingCorporateEmail(userProfile)) {
      return !["inicio", "usuario", "contacto", "mentalHealth"].includes(
        item.id
      );
    }
    return false;
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
        <Icon name="grid-outline" size={48} color={COLORS.GRAY} />
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
              onPress={handleItemPress}
              disabled={isItemDisabled(item)}
              showBadge={item.id === "notifications" && showNotificationsBadge}
            />
          ))}
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
    padding: 12,
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 12,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
  },
  gridItemDisabled: {
    opacity: 0.5,
  },
  gridItemContent: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    // Sombra sutil
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  notificationBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.RED,
    borderWidth: 2,
    borderColor: COLORS.WHITE,
    zIndex: 3,
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 24,
  },
  iconCircle: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    // Sombra del círculo
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingRight: 8,
  },
  gridItemTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
    lineHeight: 24,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gridItemSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 16,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gridItemTitleDisabled: {
    color: "rgba(255, 255, 255, 0.6)",
  },
  gridItemSubtitleDisabled: {
    color: "rgba(255, 255, 255, 0.5)",
  },
  comingSoonBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
