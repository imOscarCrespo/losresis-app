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

/** Tarjeta de carpeta del mockup: icono pastel, emoji, nombre, contador y flecha. */
export const FolderRow = ({ folder, count = 0, onPress, onLongPress, onMore, testID }) => {
  const color = folderColor(folder.color);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Carpeta ${folder.name}, ${formatElementCount(count)}`}
      testID={testID}
    >
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
      {onMore ? (
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
      <Icon name="chevron-forward" size={20} color={COLORS.TEXT_LIGHT} />
    </TouchableOpacity>
  );
};

/** Fila de nota, foto, PDF o enlace. */
export const ItemRow = ({ item, folderName, onPress, onMore, showFolder = false, testID }) => {
  const meta = [ITEM_TYPE_LABELS[item.type], showFolder ? folderName || "Sin clasificar" : null, formatShortDate(item.updated_at)]
    .filter(Boolean)
    .join(" · ");

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onMore}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${ITEM_TYPE_LABELS[item.type]} ${item.title}`}
      testID={testID}
    >
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
      {onMore ? (
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
    </TouchableOpacity>
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
