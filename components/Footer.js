import React, { useMemo, memo, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFooterConfig } from "../constants/footerConfig";
import { useUnreadNotificationBuckets } from "../src/hooks/useUnreadNotificationBuckets";

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  ACTIVE: "#670CF5",
  INACTIVE: "#8E8E93",
};

const ICON_SIZE = 24;
const TEXT_SIZE = 10;

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Item individual del footer (v2: icono + texto + punto activo en púrpura)
 */
const FooterItem = memo(({ item, isActive, onPress, showBadge = false }) => {
  return (
    <TouchableOpacity
      style={styles.footerItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={item.label}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <View style={styles.iconWrapper}>
        <Ionicons
          name={item.icon}
          size={ICON_SIZE}
          color={isActive ? COLORS.ACTIVE : COLORS.INACTIVE}
        />
        {showBadge ? <View style={styles.unreadBadge} /> : null}
      </View>
      <Text
        style={[styles.footerLabel, isActive && styles.footerLabelActive]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
      {isActive && <View style={styles.activeDot} />}
    </TouchableOpacity>
  );
});

FooterItem.displayName = "FooterItem";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Componente Footer v2
 * Mismo menú para todos: Inicio, Hospitales, MIR, Vivienda, Perfil
 * Activo: icono y texto en púrpura + punto debajo
 *
 * @param {object} props
 * @param {object} props.userProfile - Perfil del usuario
 * @param {string} props.activeSection - ID de la sección activa
 * @param {function} props.onSectionChange - Callback cuando se cambia de sección
 * @param {object} props.style - Estilos adicionales
 */
export const Footer = ({
  userProfile,
  activeSection,
  onSectionChange,
  style,
}) => {
  // Obtener configuración del footer según el tipo de usuario
  const footerItems = useMemo(() => {
    return getFooterConfig(userProfile);
  }, [userProfile]);
  const { hasChatUnread, refresh } = useUnreadNotificationBuckets(userProfile?.id);

  useEffect(() => {
    refresh();
  }, [activeSection, refresh]);

  const handleItemPress = useCallback(
    (screenId) => {
      if (onSectionChange) {
        onSectionChange(screenId);
      }
    },
    [onSectionChange]
  );

  return (
    <View style={[styles.footerContainer, style]}>
      {footerItems.map((item) => {
        const isActive =
          activeSection === item.screen || activeSection === item.id;
        return (
          <FooterItem
            key={item.id}
            item={item}
            isActive={isActive}
            showBadge={item.id === "grupos" && hasChatUnread}
            onPress={() => handleItemPress(item.screen)}
          />
        );
      })}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  footerContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 60,
  },
  footerItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 52,
  },
  iconWrapper: {
    position: "relative",
  },
  footerLabel: {
    fontSize: TEXT_SIZE,
    color: COLORS.INACTIVE,
    marginTop: 4,
    fontWeight: "500",
    textAlign: "center",
  },
  footerLabelActive: {
    color: COLORS.ACTIVE,
    fontWeight: "700",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.ACTIVE,
    marginTop: 4,
  },
  unreadBadge: {
    position: "absolute",
    top: -2,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
