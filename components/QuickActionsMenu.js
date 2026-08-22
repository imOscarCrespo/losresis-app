import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { DotsSix, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Este componente usa un gris oscuro neutro a propósito: no debe usar nunca el
// morado de marca (#670CF5). Ver AGENTS.md ("Icon Library Convention").
const NEUTRAL_DARK = "#334155";

// Cuántos iconos se ven en la home. El último es siempre "Ver más opciones"
// cuando hay acciones que no caben.
const VISIBLE_SLOTS = 4;

const MORE_SECTION = "__more__";

const ActionTile = ({ action, onPress, showDot = false, large = false }) => {
  const Icon = action.icon;
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress?.(action)}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <View
        style={[
          styles.iconWrap,
          large && styles.iconWrapLarge,
          { backgroundColor: action.tint },
        ]}
      >
        <Icon size={large ? 28 : 24} color={action.color} weight="duotone" />
        {!!action.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{action.badge}</Text>
          </View>
        )}
        {/* Si lo nuevo se queda dentro del modal, al menos que el icono que lo
            abre avise de que hay algo nuevo ahí dentro. */}
        {showDot && !action.badge && <View style={styles.dotBadge} />}
      </View>
      <Text style={[styles.label, large && styles.labelLarge]} numberOfLines={2}>
        {action.label}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Menú de acciones rápidas de la home.
 *
 * Muestra solo tres accesos más un cuarto icono "Ver más opciones" que abre un
 * modal con el resto de acciones. Antes era un carrusel horizontal paginado: el
 * usuario no veía que había más iconos fuera de pantalla, así que las acciones
 * que no caían en la primera página no existían para él.
 *
 * El modal no repite los accesos que ya están en la fila: es la continuación de
 * la lista, no la lista entera.
 *
 * @param {object} props
 * @param {array} props.actions - [{ label, icon, section, tint, color, badge? }]
 * @param {function} props.onPress - callback(section) al pulsar una acción
 * @param {string} [props.moreLabel] - etiqueta del cuarto icono
 * @param {string} [props.modalTitle] - título del modal
 */
export const QuickActionsMenu = ({
  actions = [],
  onPress,
  moreLabel = "Ver más opciones",
  modalTitle = "¿Qué quieres hacer?",
}) => {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);

  const hasOverflow = actions.length > VISIBLE_SLOTS;

  const visibleActions = useMemo(
    () => (hasOverflow ? actions.slice(0, VISIBLE_SLOTS - 1) : actions),
    [actions, hasOverflow]
  );

  // El modal solo lista lo que NO cabe en la fila: si repitiera los accesos ya
  // visibles, el usuario vería el mismo icono dos veces y no sabría en qué se
  // diferencian.
  const hiddenActions = useMemo(
    () => (hasOverflow ? actions.slice(VISIBLE_SLOTS - 1) : []),
    [actions, hasOverflow]
  );

  const hiddenHasBadge = useMemo(
    () => hiddenActions.some((action) => !!action.badge),
    [hiddenActions]
  );

  const moreAction = useMemo(
    () => ({
      label: moreLabel,
      icon: DotsSix,
      section: MORE_SECTION,
      tint: "#E2E8F0",
      color: NEUTRAL_DARK,
    }),
    [moreLabel]
  );

  if (actions.length === 0) return null;

  const handlePress = (action) => {
    if (action.section === MORE_SECTION) {
      setMenuVisible(true);
      return;
    }
    setMenuVisible(false);
    onPress?.(action.section);
  };

  const rowActions = hasOverflow
    ? [...visibleActions, moreAction]
    : visibleActions;
  // Huecos invisibles para que con menos de cuatro acciones los iconos se
  // queden en sus columnas en lugar de repartirse por toda la fila.
  const spacers = Math.max(0, VISIBLE_SLOTS - rowActions.length);

  return (
    <View>
      <View style={styles.row}>
        {rowActions.map((action) => (
          <ActionTile
            key={action.label}
            action={action}
            onPress={handlePress}
            showDot={action.section === MORE_SECTION && hiddenHasBadge}
          />
        ))}
        {Array.from({ length: spacers }).map((_, index) => (
          <View key={`spacer-${index}`} style={styles.item} />
        ))}
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{modalTitle}</Text>
            <ScrollView
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {hiddenActions.map((action) => (
                <View key={action.label} style={styles.gridCell}>
                  <ActionTile action={action} onPress={handlePress} large />
                </View>
              ))}
            </ScrollView>
            <View
              style={[
                styles.sheetFooter,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setMenuVisible(false)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <X size={24} color="#FFFFFF" weight="bold" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconWrapLarge: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  badge: {
    position: "absolute",
    top: -7,
    right: -13,
    minWidth: 34,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#15803D",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  labelLarge: {
    fontSize: 12,
    lineHeight: 16,
  },
  dotBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#15803D",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: NEUTRAL_DARK,
    textAlign: "center",
    lineHeight: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  gridCell: {
    width: "33.333%",
    paddingVertical: 12,
  },
  sheetFooter: {
    alignItems: "center",
    paddingTop: 12,
  },
  closeBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NEUTRAL_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
});
