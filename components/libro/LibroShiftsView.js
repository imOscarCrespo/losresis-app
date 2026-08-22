import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";

/**
 * Arquetipo `automatic`: Guardias.
 *
 * No lo escribe nadie a mano. Las guardias ya viven en agenda_events y aquí solo se
 * enseñan, así que el residente no las registra dos veces. `notes` es la observación
 * que ya puso en su agenda: se muestra, no se duplica.
 *
 * Lo único que el residente escribe es su OBSERVACIÓN, que vive en
 * agenda_events.notes: la misma que ve en su Agenda, no una copia. No hay botón de
 * añadir guardia a propósito: haría creer que le toca registrarlas a mano.
 *
 * La observación se escribe en una PANTALLA (LibroShiftNotesScreen), no en un modal:
 * aquí solo se listan las guardias y se avisa al Libro de cuál se ha abierto.
 */

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
};

export const LibroShiftsView = ({
  shifts = [],
  loading = false,
  residencyYear,
  readOnly = false,
  onOpenShift,
}) => {
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#670CF5" />
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.notice}>
        <Icon name="sparkles-outline" size={16} color="#0369A1" />
        <Text style={styles.noticeText}>
          Se añaden solas desde tu Agenda. No tienes que registrarlas aquí.
        </Text>
      </View>

      {shifts.length ? (
        <>
          <Text style={styles.count}>{`${shifts.length} guardias en R${residencyYear}`}</Text>
          {shifts.map((shift) => (
            <TouchableOpacity
              key={shift.id}
              style={styles.item}
              onPress={() => (readOnly ? null : onOpenShift?.(shift))}
              activeOpacity={readOnly ? 1 : 0.85}
            >
              <View style={styles.itemMark}>
                <Icon name="moon-outline" size={14} color="#EA580C" />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{formatDate(shift.event_date)}</Text>
                {shift.metadata?.shift_duration ? (
                  <Text style={styles.itemMeta}>{shift.metadata.shift_duration}</Text>
                ) : null}
                <Text
                  style={[styles.itemNotes, !shift.notes && styles.itemNotesEmpty]}
                  numberOfLines={2}
                >
                  {shift.notes || (readOnly ? "Sin observaciones" : "Añadir observación")}
                </Text>
              </View>
              {!readOnly ? (
                <Icon name="create-outline" size={16} color="#94A3B8" />
              ) : null}
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <View style={styles.empty}>
          <Icon name="moon-outline" size={22} color="#EA580C" />
          <Text style={styles.emptyTitle}>Sin guardias en este año</Text>
          <Text style={styles.emptyText}>
            Cuando apuntes una guardia en tu Agenda, aparecerá aquí sola.
          </Text>
        </View>
      )}
    </View>
  );
};

export default LibroShiftsView;

const styles = StyleSheet.create({
  loading: { paddingVertical: 28, alignItems: "center" },
  list: { gap: 8 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  noticeText: { flex: 1, fontSize: 12, color: "#0369A1", lineHeight: 17 },
  count: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EA580C",
    marginTop: 4,
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
    backgroundColor: "#FFF7ED",
  },
  itemCopy: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  itemMeta: { fontSize: 12, fontWeight: "600", color: "#EA580C" },
  itemNotes: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  itemNotesEmpty: { color: "#A78BFA", fontWeight: "600" },
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
