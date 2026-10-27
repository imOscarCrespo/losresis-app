import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { debriefStyles } from "./DebriefShell";
import {
  formatProcedureTotal,
  summarizeDebrief,
} from "../../utils/shiftDebrief";

/** Tu guardia en números: procedimientos, autonomía, aprendizajes y valoración. */
export const ShiftDebriefSummary = ({ debrief, showNotes = false }) => {
  const summary = summarizeDebrief(debrief);

  return (
    <View style={styles.wrap} testID="debrief-summary">
      <View style={debriefStyles.card}>
        <Text style={styles.total}>{formatProcedureTotal(summary.total)}</Text>
        {summary.procedures.map((item) => (
          <View
            key={`${item.node_id || "name"}-${item.name}`}
            style={styles.procRow}
          >
            <Text style={styles.procName}>{item.name}</Text>
            <Text style={styles.procCount}>{item.count}</Text>
          </View>
        ))}
      </View>

      <View style={debriefStyles.card}>
        <Row
          label="Autonomía"
          value={
            summary.autonomy
              ? `${summary.autonomy.emoji} ${summary.autonomy.short}`
              : null
          }
        />
        {showNotes && debrief?.autonomy_comment ? (
          <Text style={styles.note}>{debrief.autonomy_comment}</Text>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>Aprendizajes</Text>
          {summary.learnings.length ? (
            <View style={styles.chips}>
              {summary.learnings.map((item) => (
                <View key={item.value} style={styles.chip}>
                  <Text
                    style={styles.chipText}
                  >{`${item.emoji} ${item.short}`}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>—</Text>
          )}
        </View>
        {showNotes && debrief?.learning_note ? (
          <Text style={styles.note}>{debrief.learning_note}</Text>
        ) : null}
        <Row
          label="Valoración"
          value={
            summary.rating
              ? `${summary.rating.emoji} ${summary.rating.label}`
              : null
          }
        />
        {showNotes && debrief?.improvement_note ? (
          <Text
            style={styles.note}
          >{`Para la próxima: ${debrief.improvement_note}`}</Text>
        ) : null}
      </View>
    </View>
  );
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={value ? styles.value : styles.empty}>{value || "—"}</Text>
  </View>
);

export default ShiftDebriefSummary;

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  total: { fontSize: 16, fontWeight: "800", color: "#1B0977" },
  procRow: { flexDirection: "row", justifyContent: "space-between" },
  procName: { fontSize: 14, color: "#334155" },
  procCount: { fontSize: 14, fontWeight: "800", color: "#670CF5" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  label: {
    width: 96,
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    paddingTop: 2,
  },
  value: { flex: 1, fontSize: 14, color: "#1B0977" },
  empty: { flex: 1, fontSize: 14, color: "#94A3B8" },
  chips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F1EBFF",
  },
  chipText: { fontSize: 12, color: "#670CF5", fontWeight: "600" },
  note: { fontSize: 13, color: "#64748B", lineHeight: 18, fontStyle: "italic" },
});
