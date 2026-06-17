import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

// El punto activo usa un gris oscuro neutro a propósito: este componente no debe
// usar nunca el morado de marca (#670CF5).
const DOT_ACTIVE_COLOR = "#334155";

const ITEM_WIDTH = 64;
const ITEM_GAP = 18;
const PAGE_PADDING = 16;

/**
 * Divide los items en páginas según cuántos caben en el ancho disponible.
 */
const chunkIntoPages = (items, perPage) => {
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
};

/**
 * Menú horizontal de acciones rápidas paginado por pantalla.
 *
 * En lugar de un scroll libre (en el que el usuario no sabe que hay más
 * iconos fuera de pantalla), trocea las acciones en páginas de ancho completo
 * con snap y muestra puntos indicando en qué página está.
 *
 * @param {object} props
 * @param {array} props.actions - [{ label, icon, section, tint, color, badge? }]
 * @param {function} props.onPress - callback(section) al pulsar una acción
 */
export const QuickActionsPager = ({ actions = [], onPress }) => {
  const [width, setWidth] = useState(0);
  const [activePage, setActivePage] = useState(0);

  const itemsPerPage = useMemo(() => {
    if (!width) return actions.length || 1;
    const usable = width - PAGE_PADDING * 2;
    // Cada slot ocupa el icono más el gap que lo separa del siguiente; el último
    // no necesita gap, por eso sumamos un ITEM_GAP al ancho usable.
    const fit = Math.floor((usable + ITEM_GAP) / (ITEM_WIDTH + ITEM_GAP));
    return Math.max(1, fit);
  }, [width, actions.length]);

  const pages = useMemo(
    () => chunkIntoPages(actions, itemsPerPage),
    [actions, itemsPerPage]
  );

  const handleScrollEnd = (event) => {
    if (!width) return;
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    setActivePage(Math.min(Math.max(page, 0), pages.length - 1));
  };

  if (actions.length === 0) return null;

  const showDots = pages.length > 1;
  // El índice activo puede quedar desfasado si cambia el ancho (rotación, etc.).
  const safeActivePage = Math.min(activePage, pages.length - 1);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={pages.length > 1}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {pages.map((page, pageIndex) => (
            <View key={pageIndex} style={[styles.page, { width }]}>
              {page.map((action) => {
                const Icon = action.icon;
                return (
                <TouchableOpacity
                  key={action.label}
                  style={styles.item}
                  onPress={() => onPress?.(action.section)}
                  activeOpacity={0.78}
                >
                  <View style={[styles.iconWrap, { backgroundColor: action.tint }]}>
                    <Icon size={24} color={action.color} weight="duotone" />
                    {!!action.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{action.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.label} numberOfLines={1}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
                );
              })}
              {/* Huecos invisibles para que la última página mantenga sus iconos
                  en las mismas columnas que las páginas llenas (space-between). */}
              {Array.from({ length: itemsPerPage - page.length }).map((_, i) => (
                <View key={`spacer-${i}`} style={styles.item} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {showDots && (
        <View style={styles.pagination}>
          {pages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === safeActivePage && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: PAGE_PADDING,
  },
  item: {
    width: ITEM_WIDTH,
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
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
    lineHeight: 14,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    width: 20,
    backgroundColor: DOT_ACTIVE_COLOR,
  },
});
