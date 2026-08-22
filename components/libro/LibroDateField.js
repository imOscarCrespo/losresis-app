import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../Icon";

/**
 * El selector de fecha del Libro del Residente: un calendario MENSUAL, no un campo
 * de texto.
 *
 * Todas las fechas del libro se escribían a mano en formato AAAA-MM-DD (la ficha de
 * una rotación, la fecha de un curso, el día de un registro). Escribir una fecha con
 * el teclado numérico es lento y admite basura: "2026-13-45" se guardaba tal cual y
 * luego no se podía ordenar ni filtrar por ella.
 *
 * El calendario se despliega EN LÍNEA, no en un modal: los formularios del libro ya
 * son pantallas (no modales), y abrir un modal encima de una pantalla para elegir un
 * día es justo la incomodidad que se quitó.
 *
 * El valor sigue siendo el mismo string AAAA-MM-DD que se guardaba antes: esto
 * cambia cómo se elige la fecha, no cómo se almacena.
 */

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// La semana empieza en lunes, como en España.
const WEEK_DAY_NAMES = ["L", "M", "X", "J", "V", "S", "D"];

const pad = (value) => String(value).padStart(2, "0");

export const toIsoDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Parsea AAAA-MM-DD sin pasar por `new Date(string)`, que interpreta ese formato
 * como UTC: con el móvil en un huso al oeste, "2026-08-21" se convertía en el 20.
 */
export const parseIsoDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatLibroDate = (value) => {
  const date = parseIsoDate(value);
  if (!date) return "";

  return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
};

// Los huecos del principio para que el día 1 caiga en su columna, y los días del mes.
const buildMonthCells = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() es 0 para domingo; la rejilla empieza en lunes.
  const leading = (firstDay.getDay() + 6) % 7;

  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
};

export const LibroDateField = ({
  label,
  value,
  onChange,
  placeholder = "Sin fecha",
  hint = null,
  required = false,
  disabled = false,
  clearable = true,
}) => {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const today = new Date();

  const [cursor, setCursor] = useState(() => {
    const anchor = selected || today;
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const moveMonth = (delta) => {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const openCalendar = () => {
    // Al abrirlo se vuelve al mes de la fecha elegida: si la cambió hace rato y
    // navegó por otros meses, el calendario no se queda donde lo dejó.
    const anchor = selected || today;
    setCursor({ year: anchor.getFullYear(), month: anchor.getMonth() });
    setOpen(true);
  };

  const handleSelectDay = (day) => {
    onChange?.(toIsoDate(new Date(cursor.year, cursor.month, day)));
    setOpen(false);
  };

  const handleToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    onChange?.(toIsoDate(today));
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.input, disabled && styles.inputDisabled]}
        onPress={() => (open ? setOpen(false) : openCalendar())}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value || placeholder}` : undefined}
      >
        <Icon name="calendar-outline" size={18} color="#670CF5" />
        <Text style={[styles.inputText, !value && styles.inputPlaceholder]}>
          {formatLibroDate(value) || placeholder}
        </Text>
        {value && clearable && !disabled ? (
          <TouchableOpacity
            onPress={() => {
              onChange?.("");
              setOpen(false);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Quitar la fecha"
          >
            <Icon name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : (
          <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
        )}
      </TouchableOpacity>

      {open && !disabled ? (
        <View style={styles.calendar}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              style={styles.monthNav}
              onPress={() => moveMonth(-1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
            >
              <Icon name="chevron-back" size={18} color="#670CF5" />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {`${MONTH_NAMES[cursor.month]} ${cursor.year}`}
            </Text>
            <TouchableOpacity
              style={styles.monthNav}
              onPress={() => moveMonth(1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
            >
              <Icon name="chevron-forward" size={18} color="#670CF5" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEK_DAY_NAMES.map((day, index) => (
              <View key={`${day}-${index}`} style={styles.weekCell}>
                <Text style={styles.weekCellText}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (!day) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const isSelected =
                !!selected &&
                selected.getFullYear() === cursor.year &&
                selected.getMonth() === cursor.month &&
                selected.getDate() === day;
              const isToday =
                today.getFullYear() === cursor.year &&
                today.getMonth() === cursor.month &&
                today.getDate() === day;

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={styles.dayCell}
                  onPress={() => handleSelectDay(day)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View
                    style={[
                      styles.dayPill,
                      isToday && !isSelected && styles.dayPillToday,
                      isSelected && styles.dayPillSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isToday && !isSelected && styles.dayTextToday,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.todayButton}
            onPress={handleToday}
            activeOpacity={0.85}
          >
            <Text style={styles.todayButtonText}>Hoy</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
};

export default LibroDateField;

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569" },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  inputDisabled: { opacity: 0.6 },
  inputText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0F172A" },
  inputPlaceholder: { fontWeight: "400", color: "#94A3B8" },
  calendar: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthNav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F3FF",
  },
  monthLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    color: "#1B0977",
    textTransform: "capitalize",
  },
  weekRow: { flexDirection: "row" },
  weekCell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 4 },
  weekCellText: { fontSize: 11, fontWeight: "700", color: "#94A3B8" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  dayPill: {
    flex: 1,
    alignSelf: "stretch",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillToday: { borderWidth: 1, borderColor: "#C4B5FD" },
  dayPillSelected: { backgroundColor: "#670CF5" },
  dayText: { fontSize: 13, fontWeight: "600", color: "#334155" },
  dayTextToday: { color: "#670CF5", fontWeight: "800" },
  dayTextSelected: { color: "#FFFFFF", fontWeight: "800" },
  todayButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F5F3FF",
  },
  todayButtonText: { fontSize: 13, fontWeight: "700", color: "#670CF5" },
  hint: { fontSize: 12, color: "#64748B", lineHeight: 17 },
});
