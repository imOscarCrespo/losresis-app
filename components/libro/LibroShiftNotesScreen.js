import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "../Icon";
import { LibroEditorScreen } from "./LibroEditorScreen";
import { formatLibroDate } from "./LibroDateField";

/**
 * La pantalla de la observación de una guardia.
 *
 * La guardia no se registra aquí: viene de la Agenda (`agenda_events`), y lo único
 * que el residente escribe es su OBSERVACIÓN, que vive en `agenda_events.notes`. Es
 * la misma que ve en su Agenda, no una copia en el libro.
 */
export const LibroShiftNotesScreen = ({
  shift,
  saving = false,
  onClose,
  onSave,
}) => {
  const [notes, setNotes] = useState(shift?.notes || "");

  if (!shift) return null;

  return (
    <LibroEditorScreen
      title="Guardia"
      onClose={onClose}
      saving={saving}
      primaryLabel="Guardar"
      onPrimary={() => onSave?.(notes)}
    >
      <View style={styles.shiftCard}>
        <View style={styles.shiftIcon}>
          <Icon name="moon-outline" size={16} color="#EA580C" />
        </View>
        <View style={styles.shiftCopy}>
          <Text style={styles.shiftDate}>
            {formatLibroDate(shift.event_date) || "Sin fecha"}
          </Text>
          <Text style={styles.shiftMeta}>
            {shift.metadata?.shift_duration
              ? `Guardia de ${shift.metadata.shift_duration}`
              : "Guardia"}
          </Text>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Observaciones</Text>
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          placeholder="Qué hiciste, qué viste, con quién"
          placeholderTextColor="#94A3B8"
          multiline
        />
        <Text style={styles.fieldHint}>
          Es la misma observación que ves en tu Agenda, no una copia.
        </Text>
      </View>
    </LibroEditorScreen>
  );
};

export default LibroShiftNotesScreen;

const styles = StyleSheet.create({
  shiftCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  shiftIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  shiftCopy: { flex: 1, gap: 2 },
  shiftDate: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  shiftMeta: { fontSize: 12, color: "#9A3412" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    textAlignVertical: "top",
  },
  fieldHint: { fontSize: 12, color: "#64748B", lineHeight: 17 },
});
