import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../Icon";
import { COLORS } from "../../constants/colors";
import {
  ITEM_TYPE_ICONS,
  ITEM_TYPE_LABELS,
  folderColor,
  formatElementCount,
  formatShortDate,
} from "../../utils/resinotes";

/*
 * Modos de una fila (pasada B):
 *   * normal: tocar abre, pulsación larga hace `onLongPress`;
 *   * selección (`selected` true/false): tocar marca o desmarca, con casilla;
 *   * ordenar (`order` = { onUp, onDown } con null si no se puede): la fila
 *     deja de ser un botón (si no, VoiceOver y Maestro no verían ↑ ↓) y enseña
 *     los dos botones.
 */
const OrderButtons = ({ label, order, testID }) => (
  <View style={styles.orderButtons}>
    <TouchableOpacity
      onPress={order.onUp || undefined}
      disabled={!order.onUp}
      style={[styles.orderButton, !order.onUp && styles.orderButtonDisabled]}
      accessibilityRole="button"
      accessibilityLabel={`Subir ${label}`}
      accessibilityState={{ disabled: !order.onUp }}
      testID={testID ? `${testID}-up` : undefined}
    >
      <Icon name="arrow-up" size={18} color={order.onUp ? COLORS.PRIMARY : COLORS.GRAY_MEDIUM} />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={order.onDown || undefined}
      disabled={!order.onDown}
      style={[styles.orderButton, !order.onDown && styles.orderButtonDisabled]}
      accessibilityRole="button"
      accessibilityLabel={`Bajar ${label}`}
      accessibilityState={{ disabled: !order.onDown }}
      testID={testID ? `${testID}-down` : undefined}
    >
      <Icon name="arrow-down" size={18} color={order.onDown ? COLORS.PRIMARY : COLORS.GRAY_MEDIUM} />
    </TouchableOpacity>
  </View>
);

const Checkbox = ({ checked }) => (
  <Icon name={checked ? "checkbox-outline" : "square-outline"} size={24} color={checked ? COLORS.PRIMARY : COLORS.TEXT_LIGHT} />
);

/** El contenedor de la fila según el modo. */
const RowShell = ({ order, selected, onPress, onLongPress, label, testID, children }) => {
  if (order) {
    return (
      <View style={[styles.card, styles.cardOrdering]} accessible={false} testID={testID}>
        {children}
      </View>
    );
  }
  const selecting = selected !== undefined;
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      accessibilityRole={selecting ? "checkbox" : "button"}
      accessibilityState={selecting ? { checked: Boolean(selected) } : undefined}
      accessibilityLabel={label}
      testID={testID}
    >
      {children}
    </TouchableOpacity>
  );
};

/** Tarjeta de carpeta del mockup: icono pastel, emoji, nombre, contador y flecha. */
export const FolderRow = ({ folder, count = 0, onPress, onLongPress, onMore, selected, order, testID }) => {
  const color = folderColor(folder.color);
  const selecting = selected !== undefined;
  return (
    <RowShell
      order={order}
      selected={selected}
      onPress={onPress}
      onLongPress={onLongPress}
      label={`Carpeta ${folder.name}, ${formatElementCount(count)}`}
      testID={testID}
    >
      {selecting ? <Checkbox checked={selected} /> : null}
      <View style={[styles.iconBox, { backgroundColor: color.bg }]}>
        <Icon name="folder-outline" size={24} color={color.fg} />
      </View>
      {folder.emoji ? <Text style={styles.emoji}>{folder.emoji}</Text> : null}
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {folder.name}
        </Text>
        <Text style={styles.subtitle}>{formatElementCount(count)}</Text>
      </View>
      {order ? <OrderButtons label={folder.name} order={order} testID={testID} /> : null}
      {onMore && !order && !selecting ? (
        <TouchableOpacity
          onPress={onMore}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Opciones de ${folder.name}`}
          style={styles.more}
        >
          <Icon name="ellipsis-horizontal" size={20} color={COLORS.TEXT_LIGHT} />
        </TouchableOpacity>
      ) : null}
      {order || selecting ? null : <Icon name="chevron-forward" size={20} color={COLORS.TEXT_LIGHT} />}
    </RowShell>
  );
};

/** Fila de nota, foto, PDF o enlace. */
export const ItemRow = ({ item, folderName, onPress, onMore, onLongPress, showFolder = false, selected, order, testID }) => {
  const selecting = selected !== undefined;
  const meta = [ITEM_TYPE_LABELS[item.type], showFolder ? folderName || "Sin clasificar" : null, formatShortDate(item.updated_at)]
    .filter(Boolean)
    .join(" · ");

  return (
    <RowShell
      order={order}
      selected={selected}
      onPress={onPress}
      onLongPress={onLongPress || onMore}
      label={`${ITEM_TYPE_LABELS[item.type]} ${item.title}`}
      testID={testID}
    >
      {selecting ? <Checkbox checked={selected} /> : null}
      <View style={[styles.iconBox, styles.itemIconBox]}>
        <Icon name={ITEM_TYPE_ICONS[item.type]} size={22} color={COLORS.PRIMARY} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title || "Sin título"}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {item.is_pinned ? <Icon name="pin" size={16} color={COLORS.PRIMARY} /> : null}
      {item.is_favorite ? <Icon name="star" size={16} color="#F59E0B" /> : null}
      {order ? <OrderButtons label={item.title} order={order} testID={testID} /> : null}
      {onMore && !order && !selecting ? (
        <TouchableOpacity
          onPress={onMore}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Opciones de ${item.title}`}
          style={styles.more}
          testID={testID ? `${testID}-more` : undefined}
        >
          <Icon name="ellipsis-horizontal" size={20} color={COLORS.TEXT_LIGHT} />
        </TouchableOpacity>
      ) : null}
    </RowShell>
  );
};

/** Estado vacío / error con el estilo de la app. */
export const ResiNotesEmpty = ({ emoji = "🧠", title, message, actionLabel, onAction }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyEmoji}>{emoji}</Text>
    <Text style={styles.emptyTitle}>{title}</Text>
    {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    {actionLabel ? (
      <TouchableOpacity style={styles.emptyButton} onPress={onAction} accessibilityRole="button">
        <Text style={styles.emptyButtonText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
    minHeight: 64,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIconBox: { backgroundColor: COLORS.PRIMARY_LIGHT },
  cardSelected: { borderColor: COLORS.PRIMARY, backgroundColor: "#F7F3FF" },
  cardOrdering: { borderStyle: "dashed" },
  orderButtons: { flexDirection: "row", gap: 6 },
  orderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  orderButtonDisabled: { backgroundColor: "#F1F5F9" },
  emoji: { fontSize: 22 },
  texts: { flex: 1 },
  title: { fontSize: 16, fontWeight: "600", color: COLORS.PRIMARY_DARK },
  subtitle: { fontSize: 13, color: COLORS.TEXT_LIGHT, marginTop: 2 },
  more: { paddingHorizontal: 2 },
  empty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: COLORS.PRIMARY_DARK, textAlign: "center" },
  emptyMessage: { fontSize: 14, color: COLORS.TEXT_LIGHT, textAlign: "center", marginTop: 6, lineHeight: 20 },
  emptyButton: {
    marginTop: 16,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  emptyButtonText: { color: COLORS.WHITE, fontWeight: "700", fontSize: 15 },
});
