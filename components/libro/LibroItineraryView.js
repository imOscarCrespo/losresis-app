import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import {
  getLibroProgressLabel,
  isLibroProgressDone,
} from "../../data/libroSections";

/**
 * Arquetipo `itinerary`: el tutor define una LISTA y el residente completa una ficha
 * por elemento. Rotaciones y Competencias.
 *
 * Dos cosas que no se pueden tocar:
 *
 *  - El residente NO crea ni borra elementos. La lista es del tutor.
 *  - En Competencias el NIVEL lo pone el tutor al cerrar una evaluación
 *    (set_evaluation_competency escribe en libro_node_progress). Aquí se ve en solo
 *    lectura y el residente aporta su comentario. Si los dos escribieran la misma
 *    columna, la evaluación del tutor pisaría su autovaloración sin dejar rastro.
 *
 * La ficha se rellena en una PANTALLA (LibroFichaScreen), no en un modal: aquí solo
 * se lista y se avisa al Libro de qué elemento se ha abierto.
 */

export const LibroItineraryView = ({
  section,
  nodes = [],
  loading = false,
  readOnly = false,
  onOpenNode,
}) => {
  const done = useMemo(
    () =>
      nodes.filter((node) =>
        isLibroProgressDone(section, node.progress?.status || "pending")
      ).length,
    [nodes, section]
  );

  const durationText = (node) => {
    if (!node.duration_amount || !node.duration_unit) return "";
    const unit =
      node.duration_unit === "weeks"
        ? node.duration_amount === 1 ? "semana" : "semanas"
        : node.duration_amount === 1 ? "mes" : "meses";
    return `${node.duration_amount} ${unit}`;
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#670CF5" />
      </View>
    );
  }

  if (!nodes.length) {
    return (
      <View style={styles.empty}>
        <Icon name="list-outline" size={22} color="#670CF5" />
        <Text style={styles.emptyTitle}>Sin contenido todavía</Text>
        <Text style={styles.emptyText}>
          Tu tutor todavía no ha definido nada en este apartado. Cuando lo haga,
          aparecerá aquí.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Text style={styles.progressLine}>
        {`${done} de ${nodes.length} completadas`}
      </Text>

      {nodes.map((node) => {
        const status = node.progress?.status || "pending";
        const complete = isLibroProgressDone(section, status);
        const meta = [node.center, durationText(node)].filter(Boolean).join(" · ");

        return (
          <TouchableOpacity
            key={node.id}
            style={styles.item}
            onPress={() => (readOnly ? null : onOpenNode?.(node))}
            activeOpacity={readOnly ? 1 : 0.85}
          >
            <View
              style={[styles.itemMark, complete && styles.itemMarkDone]}
            >
              <Icon
                name={complete ? "checkmark" : "ellipse-outline"}
                size={14}
                color={complete ? "#FFFFFF" : "#94A3B8"}
              />
            </View>
            <View style={styles.itemCopy}>
              <Text style={styles.itemTitle}>{node.name}</Text>
              {meta || node.description ? (
                <Text style={styles.itemMeta} numberOfLines={2}>
                  {meta || node.description}
                </Text>
              ) : null}
              <Text style={[styles.itemStatus, complete && styles.itemStatusDone]}>
                {getLibroProgressLabel(section, status)}
              </Text>
            </View>
            {!readOnly ? (
              <Icon name="chevron-forward" size={16} color="#94A3B8" />
            ) : null}
          </TouchableOpacity>
        );
      })}

      <Text style={styles.footnote}>
        Esta lista la define tu tutor: puedes completar cada ficha, pero no añadir ni
        quitar elementos.
      </Text>
    </View>
  );
};

export default LibroItineraryView;

const styles = StyleSheet.create({
  loading: { paddingVertical: 28, alignItems: "center" },
  list: { gap: 8 },
  progressLine: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D28D9",
    marginBottom: 2,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  itemMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  itemMarkDone: { backgroundColor: "#059669" },
  itemCopy: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  itemMeta: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  itemStatus: { fontSize: 12, fontWeight: "600", color: "#94A3B8" },
  itemStatusDone: { color: "#059669" },
  footnote: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 17,
    marginTop: 6,
  },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
});
