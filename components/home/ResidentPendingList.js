import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "../Icon";

/**
 * "Te toca a ti": lo único accionable del residente, en una sola lista.
 *
 * Reúne cosas que hoy viven en pantallas distintas (Autoevaluación, Tutorías,
 * Recordatorios del servicio, Nóminas, Salud mental) y que sin esta lista solo
 * se descubren entrando una por una. Es deliberadamente **una lista de deberes,
 * no un resumen**: si algo no tiene acción pendiente, no aparece. Las
 * Evaluaciones del tutor, por ejemplo, se leen pero no se completan, así que
 * nunca entran aquí (mismo criterio que `teachingModuleBadge`).
 *
 * Con la lista vacía se pinta el estado "todo al día": es la recompensa de
 * haberlo cerrado todo, y sin él la sección desaparecería sin explicar por qué.
 */
export const ResidentPendingList = ({ items = [], loading = false, onPress }) => {
  const isEmpty = items.length === 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.bar} />
        <Text style={styles.title}>Te toca a ti</Text>
        {!isEmpty && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{items.length}</Text>
          </View>
        )}
      </View>

      {isEmpty ? (
        <View style={styles.card}>
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="checkmark-circle" size={26} color="#047857" />
            </View>
            <Text style={styles.emptyTitle}>
              {loading ? "Comprobando…" : "Todo al día"}
            </Text>
            <Text style={styles.emptyText}>
              {loading
                ? "Estamos revisando qué tienes pendiente."
                : "No tienes nada pendiente de enviar ni de cerrar."}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.row, index > 0 && styles.rowDivided]}
              onPress={() => onPress?.(item)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.meta}`}
            >
              <View style={[styles.rowIcon, { backgroundColor: item.tint }]}>
                <Icon name={item.icon} size={20} color={item.color} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.rowMeta, item.urgent && styles.rowMetaUrgent]}
                  numberOfLines={1}
                >
                  {item.meta}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Sin padding ni margen horizontal propio: el contenedor del inicio
  // (styles.content de HomeDashboardScreen) ya mete los 16 de los lados, y el
  // `gap` de residentTopStack la separación vertical.
  wrap: {},
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  bar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: "#670CF5",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  countPill: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  countPillText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowDivided: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  rowMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  rowMetaUrgent: {
    color: "#B42318",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D1FAE5",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
  },
});

export default ResidentPendingList;
