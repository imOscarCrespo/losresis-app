import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { agendaEventTypeLabels } from "../../services/agendaService";
import { Icon } from "../Icon";

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MAX_DOTS_PER_DAY = 3;
const MAX_DETAIL_ROWS = 4;

// Un color por tipo de evento, para poder leer la semana sin leyenda: el morado
// de marca es la guardia, que es lo que el residente busca primero.
const TYPE_COLORS = {
  shift: "#670CF5",
  service: "#0E7490",
  tutoring: "#6D28D9",
  course: "#2563EB",
  conference: "#0891B2",
  study: "#CA8A04",
  research: "#059669",
  reminder: "#F97316",
  day_off: "#94A3B8",
};

const DEFAULT_COLOR = "#94A3B8";

// El plural de cada tipo, para la frase-resumen. Solo los que se resumen: el
// resto cae en "eventos".
const TYPE_PHRASES = {
  shift: ["guardia", "guardias"],
  service: ["evento del servicio", "eventos del servicio"],
  tutoring: ["tutoría", "tutorías"],
  course: ["curso", "cursos"],
  conference: ["congreso", "congresos"],
  study: ["sesión de estudio", "sesiones de estudio"],
  research: ["investigación", "investigaciones"],
  day_off: ["día libre", "días libres"],
  reminder: ["recordatorio", "recordatorios"],
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/** El lunes de la semana que contiene `today`. La semana española empieza en L. */
const startOfWeek = (today) => {
  const monday = startOfDay(today);
  const weekday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - weekday);
  return monday;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const formatTimeLabel = (value) => String(value || "").slice(0, 5);

const formatDayHeading = (date, isToday) => {
  const label = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return isToday ? `Hoy · ${label}` : capitalized;
};

/**
 * El horario de un evento tal y como se lee **desde un día concreto**.
 *
 * En los eventos de varios días el horario es un TRAMO CONTINUO (ADR 0011): la
 * hora de inicio pertenece al primer día y la de fin al último. Pintar
 * "09:00 – 18:00" en los tres días de un congreso diría justo lo que esas
 * columnas no significan, así que cada día enseña solo su extremo del tramo.
 */
const formatDayTimeLabel = (event, dayDate) => {
  const start = parseDate(event.event_date);
  const end = parseDate(event.end_date) || start;

  if (!event.start_time && !event.end_time) {
    // Los eventos que proyecta el panel pueden venir con all_day = false y sin
    // horas: ahí la hora está por concretar, no es de todo el día.
    return event.all_day === false ? "Hora por concretar" : "Todo el día";
  }

  const spansDays = Boolean(start && end && end.getTime() !== start.getTime());

  if (!spansDays) {
    return event.start_time && event.end_time
      ? `${formatTimeLabel(event.start_time)} – ${formatTimeLabel(event.end_time)}`
      : formatTimeLabel(event.start_time || event.end_time);
  }

  const dayTime = dayDate.getTime();

  if (start && dayTime === start.getTime()) {
    return event.start_time
      ? `Desde ${formatTimeLabel(event.start_time)}`
      : "Todo el día";
  }

  if (end && dayTime === end.getTime()) {
    return event.end_time
      ? `Hasta ${formatTimeLabel(event.end_time)}`
      : "Todo el día";
  }

  return "Todo el día";
};

/**
 * "Esta semana": los siete días de la semana en curso con un punto por evento,
 * y el detalle del día que el residente toque.
 *
 * No sustituye a la Agenda ni repite la tarjeta de "próximo evento" de la
 * cabecera: responde a otra pregunta, "¿cómo viene la semana?", que hoy solo se
 * puede contestar abriendo el calendario y contando a ojo. Los eventos de varios
 * días (una rotación, un congreso) pintan punto en cada día que ocupan.
 *
 * El día arranca seleccionado en **hoy**: es lo que el residente viene a mirar,
 * y así la tarjeta ya dice algo antes del primer toque. Tocar un día no navega
 * —para eso está el botón de la esquina— sino que abre su detalle aquí mismo,
 * que es la diferencia entre "hay dos puntos el jueves" y "el jueves tienes
 * guardia".
 */
export const ResidentWeekStrip = ({ events = [], onPress }) => {
  const [selectedKey, setSelectedKey] = useState(() =>
    formatDateKey(startOfDay(new Date()))
  );

  const week = useMemo(() => {
    const today = startOfDay(new Date());
    const monday = startOfWeek(today);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        date,
        key: formatDateKey(date),
        isToday: date.getTime() === today.getTime(),
        events: [],
      };
    });

    const totals = new Map();

    (events || []).forEach((event) => {
      const start = parseDate(event.event_date);
      if (!start) return;
      const end = parseDate(event.end_date) || start;

      let touchesWeek = false;
      days.forEach((day) => {
        if (day.date >= start && day.date <= end) {
          day.events.push(event);
          touchesWeek = true;
        }
      });

      if (touchesWeek) {
        totals.set(event.event_type, (totals.get(event.event_type) || 0) + 1);
      }
    });

    // Dentro del día, el mismo orden que la Agenda: por hora de inicio, y los
    // de todo el día primero.
    days.forEach((day) => {
      day.events.sort((left, right) =>
        String(left.start_time || "00:00:00").localeCompare(
          String(right.start_time || "00:00:00")
        )
      );
    });

    // La frase-resumen: los tipos más numerosos primero, y como mucho tres, que
    // es lo que cabe en una línea sin truncar.
    const summary = [...totals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([type, count]) => {
        const phrase = TYPE_PHRASES[type];
        if (!phrase) return `${count} evento${count === 1 ? "" : "s"}`;
        return `${count} ${count === 1 ? phrase[0] : phrase[1]}`;
      })
      .join(" · ");

    const total = [...totals.values()].reduce((sum, count) => sum + count, 0);

    return { days, summary, total };
  }, [events]);

  // Si la semana cambia bajo los pies (la app abierta a medianoche, o un
  // refresco), el día guardado puede no estar: se cae a hoy, que sí está.
  const selectedDay =
    week.days.find((day) => day.key === selectedKey) ||
    week.days.find((day) => day.isToday) ||
    week.days[0];

  const detailEvents = selectedDay.events.slice(0, MAX_DETAIL_ROWS);
  const hiddenCount = selectedDay.events.length - detailEvents.length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Esta semana</Text>
        <Text style={styles.summary} numberOfLines={1}>
          {week.total > 0 ? week.summary : "Semana libre"}
        </Text>
      </View>

      <View style={styles.daysRow}>
        {week.days.map((day) => {
          const isSelected = day.key === selectedDay.key;

          return (
            <TouchableOpacity
              key={day.key}
              style={styles.day}
              onPress={() => setSelectedKey(day.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${formatDayHeading(day.date, day.isToday)}: ${
                day.events.length === 0
                  ? "nada en la agenda"
                  : `${day.events.length} evento${
                      day.events.length === 1 ? "" : "s"
                    }`
              }`}
            >
              <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                {DAY_LABELS[(day.date.getDay() + 6) % 7]}
              </Text>
              <View
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  day.isToday && styles.dayCellToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                    day.isToday && styles.dayNumberToday,
                  ]}
                >
                  {day.date.getDate()}
                </Text>
              </View>
              <View style={styles.dotsRow}>
                {day.events.slice(0, MAX_DOTS_PER_DAY).map((event, index) => (
                  <View
                    key={`${event.id || event.event_type}-${index}`}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          TYPE_COLORS[event.event_type] || DEFAULT_COLOR,
                      },
                    ]}
                  />
                ))}
                {day.events.length > MAX_DOTS_PER_DAY && (
                  <Text style={styles.dotsOverflow}>
                    +{day.events.length - MAX_DOTS_PER_DAY}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.detail}>
        <Text style={styles.detailHeading}>
          {formatDayHeading(selectedDay.date, selectedDay.isToday)}
        </Text>

        {detailEvents.length === 0 ? (
          <Text style={styles.detailEmpty}>Nada en la agenda este día</Text>
        ) : (
          detailEvents.map((event, index) => (
            <View
              key={`${event.id || event.event_type}-${index}`}
              style={styles.detailRow}
            >
              <View
                style={[
                  styles.detailDot,
                  {
                    backgroundColor:
                      TYPE_COLORS[event.event_type] || DEFAULT_COLOR,
                  },
                ]}
              />
              <Text style={styles.detailTitle} numberOfLines={1}>
                {event.title || agendaEventTypeLabels[event.event_type] || "Evento"}
              </Text>
              <Text style={styles.detailTime} numberOfLines={1}>
                {formatDayTimeLabel(event, selectedDay.date)}
              </Text>
            </View>
          ))
        )}

        {hiddenCount > 0 && (
          <Text style={styles.detailMore}>
            +{hiddenCount} más en tu agenda
          </Text>
        )}
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity
          style={styles.agendaButton}
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Abrir la agenda"
        >
          <Text style={styles.agendaButtonText}>Ver agenda</Text>
          <Icon name="arrow-forward" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    // Ni margen horizontal ni marginTop: los pone el contenedor del inicio
    // (padding de styles.content y gap de residentTopStack).
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  summary: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  daysRow: {
    flexDirection: "row",
  },
  day: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
  },
  dayLabelToday: {
    color: "#670CF5",
  },
  dayCell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  // El día elegido se marca en gris y hoy siempre en morado: cuando coinciden
  // gana el morado (dayCellToday va después en el array de estilos).
  dayCellSelected: {
    backgroundColor: "#E2E8F0",
  },
  dayCellToday: {
    backgroundColor: "#670CF5",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  dayNumberSelected: {
    color: "#0F172A",
    fontWeight: "800",
  },
  dayNumberToday: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotsOverflow: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
  },
  detail: {
    marginTop: 14,
    paddingTop: 12,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  detailHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: "#670CF5",
  },
  detailEmpty: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  detailTime: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  detailMore: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  agendaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#670CF5",
  },
  agendaButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

export default ResidentWeekStrip;
