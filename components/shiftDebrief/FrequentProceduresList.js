import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../Icon";
import { debriefStyles } from "./DebriefShell";
import { procedureKey } from "../../utils/shiftDebrief";

/**
 * La lista de procedimientos frecuentes: quitar, subir/bajar y añadir. Sirve
 * para la configuración inicial y para «Editar mis procedimientos».
 */
export const FrequentProceduresList = ({
  items = [],
  onRemove,
  onMove,
  onAdd,
}) => (
  <View style={styles.wrap}>
    <Text style={debriefStyles.sectionLabel}>
      Mis procedimientos frecuentes
    </Text>

    {items.length ? (
      <View style={debriefStyles.card}>
        {items.map((item, index) => (
          <View
            key={procedureKey(item)}
            style={styles.row}
            testID={`frequent-${item.name}`}
          >
            <TouchableOpacity
              onPress={() => onRemove?.(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Quitar ${item.name}`}
            >
              <View style={styles.removeDot}>
                <Icon name="remove" size={14} color="#FFFFFF" weight="bold" />
              </View>
            </TouchableOpacity>
            <View style={styles.copy}>
              <Text style={styles.name}>{item.name}</Text>
              {!item.node_id ? (
                <Text style={styles.meta}>Solo en tus guardias</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => onMove?.(index, -1)}
              disabled={index === 0}
              style={[styles.move, index === 0 && styles.moveDisabled]}
              accessibilityLabel={`Subir ${item.name}`}
            >
              <Icon name="chevron-up" size={18} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onMove?.(index, 1)}
              disabled={index === items.length - 1}
              style={[
                styles.move,
                index === items.length - 1 && styles.moveDisabled,
              ]}
              accessibilityLabel={`Bajar ${item.name}`}
            >
              <Icon name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    ) : (
      <Text style={styles.empty}>
        Aún no has elegido ninguno. Añade los que haces habitualmente en tus
        guardias.
      </Text>
    )}

    <TouchableOpacity
      style={debriefStyles.ghostButton}
      onPress={onAdd}
      testID="frequent-add"
    >
      <Icon name="add" size={18} color="#670CF5" />
      <Text style={debriefStyles.ghostButtonText}>Añadir procedimiento</Text>
    </TouchableOpacity>
  </View>
);

export default FrequentProceduresList;

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  removeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
  },
  copy: { flex: 1, gap: 1 },
  name: { fontSize: 15, color: "#1B0977", fontWeight: "600" },
  meta: { fontSize: 11, color: "#94A3B8" },
  move: { padding: 6 },
  moveDisabled: { opacity: 0.25 },
  empty: { fontSize: 13, color: "#64748B", lineHeight: 19 },
});
