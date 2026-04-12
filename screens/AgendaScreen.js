import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { BottomMenuHeroHeader } from "../components/BottomMenuHeroHeader";
import { useAgendaEvents } from "../hooks/useAgendaEvents";
import { useShiftPurchaseRequests } from "../hooks/useShiftPurchaseRequests";
import { useShiftSwapRequests } from "../hooks/useShiftSwapRequests";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";
import {
  agendaEventTypeLabels,
  mapAgendaEventToLegacyShift,
} from "../services/agendaService";
import { TeamCalendarView } from "./TeamCalendarView";

LocaleConfig.locales.es = {
  monthNames: [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ],
  monthNamesShort: [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ],
  dayNames: [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ],
  dayNamesShort: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  today: "Hoy",
};
LocaleConfig.defaultLocale = "es";

const AGENDA_ACCENT = "#670CF5";
const AGENDA_ACCENT_ALT = "#A100C2";

const EVENT_TYPE_OPTIONS = [
  {
    id: "shift",
    label: "Guardia",
    description: "Registrar turno de guardia",
    icon: "medkit-outline",
    color: "#7C3AED",
    lightColor: "#F3E8FF",
  },
  {
    id: "course",
    label: "Curso",
    description: "Formación y talleres",
    icon: "school-outline",
    color: "#2563EB",
    lightColor: "#DBEAFE",
  },
  {
    id: "conference",
    label: "Congreso",
    description: "Eventos médicos y ponencias",
    icon: "mic-outline",
    color: "#F97316",
    lightColor: "#FFEDD5",
  },
  {
    id: "study",
    label: "Estudio",
    description: "Sesiones de estudio personal",
    icon: "book-outline",
    color: "#8B5CF6",
    lightColor: "#F3E8FF",
  },
  {
    id: "research",
    label: "Investigación",
    description: "Protocolos y papers",
    icon: "flask",
    color: "#059669",
    lightColor: "#D1FAE5",
  },
  {
    id: "day_off",
    label: "Día libre",
    description: "Descanso y tiempo personal",
    icon: "cafe-outline",
    color: "#DB2777",
    lightColor: "#FCE7F3",
  },
  {
    id: "reminder",
    label: "Recordatorio",
    description: "Notas rápidas y pendientes",
    icon: "notifications-outline",
    color: "#0F766E",
    lightColor: "#CCFBF1",
  },
];

const RESEARCH_STATUS_OPTIONS = ["En curso", "Publicado"];
const RESEARCH_ROLE_OPTIONS = [
  "Investigador principal",
  "Co-investigador",
  "Colaborador",
  "Tesista",
];
const CONFERENCE_ROLE_OPTIONS = ["Asistente", "Ponente", "Póster / Comunicación"];
const SHIFT_DURATION_OPTIONS = ["24h", "12h"];
const REMINDER_OPTIONS = [
  { value: null, label: "Sin recordatorio" },
  { value: 1, label: "1 día antes" },
  { value: 3, label: "3 días antes" },
  { value: 5, label: "5 días antes" },
];
const MULTI_DAY_DURATION_OPTIONS = [2, 3, 4, 5, 7];
const DATE_TOGGLE_TYPES = new Set(["course", "conference"]);
const DIRECT_DATE_TYPES = new Set(["study", "research"]);
const FIXED_DATE_TYPES = new Set(["shift", "day_off", "reminder"]);
const TITLE_FIELD_TYPES = new Set([
  "course",
  "conference",
  "study",
  "research",
  "reminder",
]);

const monthTitle = (date) =>
  date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

const normalizeDate = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
};

const formatDateKey = (date) => {
  const normalizedDate = normalizeDate(date);
  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
  const day = String(normalizedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateRangesInclude = (targetDate, startDate, endDate) => {
  if (!targetDate || !startDate) return false;
  const effectiveEndDate = endDate || startDate;
  return targetDate >= startDate && targetDate <= effectiveEndDate;
};

const formatHumanDate = (value) => {
  if (!value) return "Sin fecha";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

const formatLongDate = (value) => {
  if (!value) return "Sin fecha";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatTimeLabel = (value) => {
  if (!value) return "Sin hora";
  return value.slice(0, 5);
};

const addDaysToDateString = (value, daysToAdd) => {
  if (!value) return "";

  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  return formatDateKey(date);
};

const chipMeta = {
  shift: {
    submitText: "Guardar guardia",
  },
  course: {
    titleLabel: "Nombre del curso",
    titlePlaceholder: "Ej. Soporte Vital Avanzado",
    submitText: "Guardar curso",
  },
  research: {
    titleLabel: "Título",
    titlePlaceholder: "Ej. Revisión de casos clínicos",
    submitText: "Guardar investigación",
  },
  study: {
    titleLabel: "Tema de estudio",
    titlePlaceholder: "Ej. Hematología",
    submitText: "Guardar sesión",
  },
  conference: {
    titleLabel: "Nombre del congreso",
    titlePlaceholder: "Ej. Congreso Nacional de Residentes",
    submitText: "Guardar congreso",
  },
  day_off: {
    submitText: "Guardar día libre",
  },
  reminder: {
    titleLabel: "Nombre",
    titlePlaceholder: "Ej. Entregar documentación",
    submitText: "Guardar recordatorio",
  },
};

const emptyFormForType = (type, defaultDate = "") => ({
  event_type: type,
  title: type === "day_off" ? "Día libre" : "",
  hasDate:
    FIXED_DATE_TYPES.has(type) || DIRECT_DATE_TYPES.has(type)
      ? true
      : false,
  event_date: defaultDate || "",
  end_date: "",
  duration_days: 2,
  notes: "",
  metadata: {
    study_minutes: "",
    research_status: RESEARCH_STATUS_OPTIONS[0],
    research_role: "",
    conference_role: CONFERENCE_ROLE_OPTIONS[0],
    shift_duration: SHIFT_DURATION_OPTIONS[0],
    reminder_offset_days: null,
  },
});

const formFromEvent = (event) => ({
  event_type: event.event_type,
  title: event.title || "",
  hasDate:
    FIXED_DATE_TYPES.has(event.event_type) ||
    DIRECT_DATE_TYPES.has(event.event_type) ||
    Boolean(event.end_date)
      ? true
      : false,
  event_date: event.event_date || "",
  end_date: event.end_date || "",
  duration_days:
    event.end_date && event.event_date
      ? Math.max(
          Math.round(
            (new Date(`${event.end_date}T12:00:00`) -
              new Date(`${event.event_date}T12:00:00`)) /
              (1000 * 60 * 60 * 24)
          ) + 1,
          2
        )
      : 2,
  notes: event.notes || "",
  metadata: {
    study_minutes: event.metadata?.study_minutes ? String(event.metadata.study_minutes) : "",
    research_status: event.metadata?.research_status || RESEARCH_STATUS_OPTIONS[0],
    research_role: event.metadata?.research_role || "",
    conference_role: event.metadata?.conference_role || CONFERENCE_ROLE_OPTIONS[0],
    shift_duration: event.metadata?.shift_duration || SHIFT_DURATION_OPTIONS[0],
    reminder_offset_days:
      typeof event.metadata?.reminder_offset_days === "number"
        ? event.metadata.reminder_offset_days
        : null,
  },
});

const buildPayloadFromForm = (form, existingEvent = null, selectedDate = "") => {
  const metadata =
    existingEvent?.metadata && typeof existingEvent.metadata === "object"
      ? { ...existingEvent.metadata }
      : {};

  if (form.event_type === "shift") {
    metadata.shift_duration = form.metadata.shift_duration;
  }

  if (form.event_type === "research") {
    metadata.research_status = form.metadata.research_status;
    metadata.research_role = form.metadata.research_role.trim();
  }

  if (form.event_type === "study") {
    metadata.study_minutes = form.metadata.study_minutes
      ? Number(form.metadata.study_minutes)
      : null;
  }

  if (form.event_type === "conference") {
    metadata.conference_role = form.metadata.conference_role;
  }

  const eventDate = form.hasDate
    ? form.event_date || existingEvent?.event_date || selectedDate || null
    : form.event_date || existingEvent?.event_date || selectedDate || null;
  const computedEndDate = DATE_TOGGLE_TYPES.has(form.event_type)
    ? form.hasDate
      ? addDaysToDateString(eventDate, Math.max((form.duration_days || 2) - 1, 1))
      : null
    : existingEvent?.end_date || null;
  const preservedStartTime = eventDate ? existingEvent?.start_time || null : null;
  const preservedEndTime = eventDate ? existingEvent?.end_time || null : null;

  metadata.reminder_offset_days = eventDate
    ? form.metadata.reminder_offset_days ?? null
    : null;

  return {
    event_type: form.event_type,
    title: form.title.trim(),
    event_date: eventDate,
    end_date: computedEndDate,
    start_time: preservedStartTime,
    end_time: preservedEndTime,
    all_day: preservedStartTime || preservedEndTime ? existingEvent?.all_day ?? false : true,
    notes: form.notes.trim(),
    metadata,
  };
};

const EventChip = ({ label, selected, onPress, color }) => (
  <TouchableOpacity
    style={[
      styles.choiceChip,
      selected && {
        borderColor: color,
        backgroundColor: `${color}15`,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Text style={[styles.choiceChipText, selected && { color }]}>{label}</Text>
  </TouchableOpacity>
);

export const AgendaScreen = ({ userProfile }) => {
  const insets = useSafeAreaInsets();
  const userId = userProfile?.id;
  const today = normalizeDate();
  const todayString = formatDateKey(today);
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [visibleMonth, setVisibleMonth] = useState(today);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [showTeamCalendar, setShowTeamCalendar] = useState(false);
  const [form, setForm] = useState(emptyFormForType("shift", todayString));

  const {
    events,
    loading,
    saving,
    upcomingEvents,
    unscheduledEvents,
    createEvent,
    updateEvent,
    removeEvent,
  } = useAgendaEvents(userId);

  const { swapRequests } = useShiftSwapRequests(userId);
  const { purchaseRequests } = useShiftPurchaseRequests(userId);

  useEffect(() => {
    posthogLogger.logScreen("AgendaScreen");
  }, []);

  const selectedTypeMeta = useMemo(() => {
    return (
      EVENT_TYPE_OPTIONS.find((option) => option.id === form.event_type) ||
      EVENT_TYPE_OPTIONS[0]
    );
  }, [form.event_type]);

  const pendingShiftRequests = swapRequests.length + purchaseRequests.length;
  const showsPrimaryTitleField = TITLE_FIELD_TYPES.has(form.event_type);
  const effectiveReminderDate = useMemo(() => {
    if (DATE_TOGGLE_TYPES.has(form.event_type)) {
      return form.hasDate ? form.event_date : selectedDate;
    }

    return form.event_date || "";
  }, [form.event_type, form.hasDate, form.event_date, selectedDate]);

  const residentLegendOptions = useMemo(() => {
    if (!userProfile?.is_resident) {
      return EVENT_TYPE_OPTIONS;
    }

    const eventTypesWithDate = new Set(
      events
        .filter((event) => event.event_date)
        .map((event) => event.event_type)
    );

    return EVENT_TYPE_OPTIONS.filter((option) => eventTypesWithDate.has(option.id));
  }, [events, userProfile?.is_resident]);

  const markedDates = useMemo(() => {
    const marks = {};

    events.forEach((event) => {
      if (!event.event_date) return;

      const config =
        EVENT_TYPE_OPTIONS.find((option) => option.id === event.event_type) ||
        EVENT_TYPE_OPTIONS[0];

      const startDate = new Date(`${event.event_date}T00:00:00`);
      const endDate = new Date(`${(event.end_date || event.event_date)}T00:00:00`);

      for (
        let cursor = new Date(startDate);
        cursor <= endDate;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const dateKey = formatDateKey(cursor);

        if (!marks[dateKey]) {
          marks[dateKey] = { dots: [] };
        }

        const alreadyPresent = marks[dateKey].dots.some(
          (dot) => dot.key === event.event_type
        );

        if (!alreadyPresent) {
          marks[dateKey].dots.push({
            key: event.event_type,
            color: config.color,
          });
        }
      }
    });

    marks[todayString] = {
      ...(marks[todayString] || {}),
      ...(marks[todayString]?.dots ? { dots: marks[todayString].dots } : {}),
      today: true,
    };

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      ...(marks[selectedDate]?.dots ? { dots: marks[selectedDate].dots } : {}),
      selected: true,
      selectedColor: AGENDA_ACCENT,
    };

    return marks;
  }, [events, selectedDate, todayString]);

  const selectedDayEvents = useMemo(() => {
    return events.filter((event) =>
      dateRangesInclude(selectedDate, event.event_date, event.end_date)
    );
  }, [events, selectedDate]);

  const legacyUserShifts = useMemo(() => {
    return events
      .map(mapAgendaEventToLegacyShift)
      .filter(Boolean);
  }, [events]);

  const openCreateFlow = (type, defaultDate = selectedDate) => {
    setEditingEvent(null);
    setForm(emptyFormForType(type, defaultDate));
    setTypeModalVisible(false);
    setEditorVisible(true);
  };

  const openEditFlow = (event) => {
    setEditingEvent(event);
    setForm(formFromEvent(event));
    setEditorVisible(true);
  };

  const closeEditor = () => {
    setEditorVisible(false);
    setEditingEvent(null);
  };

  const closeDeleteDialog = () => {
    setDeleteCandidate(null);
  };

  const patchForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const patchMetadata = (field, value) => {
    setForm((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [field]: value,
      },
    }));
  };

  const handleDateToggle = (value) => {
    patchForm("hasDate", value);

    if (value) {
      if (!form.event_date) {
        patchForm("event_date", selectedDate);
      }
      patchForm("duration_days", form.duration_days || 2);
      return;
    }

    patchForm("event_date", selectedDate);
    patchForm("end_date", "");
  };

  const validateForm = () => {
    if (form.event_type === "shift" && !form.event_date) {
      return "Selecciona una fecha para el evento.";
    }

    if (DATE_TOGGLE_TYPES.has(form.event_type) && !form.event_date) {
      return "Selecciona una fecha para el evento.";
    }

    if (TITLE_FIELD_TYPES.has(form.event_type) && !form.title.trim()) {
      return "Completa el campo principal del evento.";
    }

    if (
      DATE_TOGGLE_TYPES.has(form.event_type) &&
      form.hasDate &&
      !form.duration_days
    ) {
      return "Selecciona cuántos días dura el evento.";
    }

    return null;
  };

  const handleSave = async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      Alert.alert("Revisa el formulario", validationMessage);
      return;
    }

    const payload = buildPayloadFromForm(
      {
        ...form,
        title:
          form.event_type === "shift"
            ? "Guardia"
            : form.event_type === "day_off"
              ? "Día libre"
              : form.title.trim() || "Recordatorio",
      },
      editingEvent,
      selectedDate
    );

    const result = editingEvent
      ? await updateEvent(editingEvent.id, payload)
      : await createEvent(payload);

    if (!result.success) {
      Alert.alert("No se pudo guardar", result.message);
      return;
    }

    closeEditor();
  };

  const handleDelete = async () => {
    const eventToDelete = deleteCandidate;
    closeDeleteDialog();

    if (!eventToDelete) {
      return;
    }

    const result = await removeEvent(eventToDelete);
    if (!result.success) {
      Alert.alert("No se pudo eliminar", result.message);
      return;
    }

    closeEditor();
  };

  if (showTeamCalendar) {
    return (
      <TeamCalendarView
        userProfile={userProfile}
        userShifts={legacyUserShifts}
        onClose={() => setShowTeamCalendar(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BottomMenuHeroHeader
          title="Agenda de residencia"
          subtitle="Calendario unificado para guardias, cursos, estudio e hitos de tu residencia."
          rightSlot={
            <TouchableOpacity
              style={styles.heroIconButton}
              onPress={() => setShowTeamCalendar(true)}
            >
              <Ionicons name="people-outline" size={20} color={COLORS.WHITE} />
            </TouchableOpacity>
          }
          bottomContent={
            <View style={styles.heroMonthCard}>
              <TouchableOpacity
                style={styles.heroArrow}
                onPress={() =>
                  setVisibleMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() - 1,
                      1
                    )
                  )
                }
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.PRIMARY} />
              </TouchableOpacity>
              <View>
                <Text style={styles.heroMonthLabel}>Calendario</Text>
                <Text style={styles.heroMonthValue}>
                  {monthTitle(visibleMonth)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.heroArrow}
                onPress={() =>
                  setVisibleMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() + 1,
                      1
                    )
                  )
                }
              >
                <Ionicons name="chevron-forward" size={18} color={COLORS.PRIMARY} />
              </TouchableOpacity>
            </View>
          }
        />

        <View style={styles.body}>
          <View style={styles.calendarCard}>
            <Calendar
              key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`}
              firstDay={1}
              current={formatDateKey(
                new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                1
              )
              )}
              markedDates={markedDates}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              onMonthChange={(month) =>
                setVisibleMonth(new Date(month.year, month.month - 1, 1))
              }
              markingType="multi-dot"
              hideArrows
              enableSwipeMonths
              theme={{
                calendarBackground: COLORS.WHITE,
                textMonthFontWeight: "700",
                textDayHeaderFontWeight: "700",
                selectedDayBackgroundColor: AGENDA_ACCENT,
                todayTextColor: AGENDA_ACCENT,
                dotColor: AGENDA_ACCENT,
              }}
              renderHeader={() => <View />}
            />

            {residentLegendOptions.length > 0 ? (
              <View style={styles.legend}>
                {residentLegendOptions.map((option) => (
                  <View key={option.id} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: option.color },
                      ]}
                    />
                    <Text style={styles.legendText}>{option.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {pendingShiftRequests > 0 ? (
            <View style={styles.infoCard}>
              <Ionicons name="notifications-outline" size={18} color={AGENDA_ACCENT} />
              <Text style={styles.infoCardText}>
                Tienes {pendingShiftRequests} solicitudes pendientes relacionadas con tus guardias.
              </Text>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{formatLongDate(selectedDate)}</Text>
              <Text style={styles.sectionSubtitle}>Eventos del día seleccionado</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={AGENDA_ACCENT} />
              <Text style={styles.loadingText}>Cargando agenda...</Text>
            </View>
          ) : selectedDayEvents.length > 0 ? (
            selectedDayEvents.map((event) => {
              const option = EVENT_TYPE_OPTIONS.find(
                (item) => item.id === event.event_type
              );

              return (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventRow}
                  activeOpacity={0.88}
                  onPress={() => openEditFlow(event)}
                >
                  <View
                    style={[
                      styles.eventIcon,
                      { backgroundColor: option?.lightColor || COLORS.PURPLE_LIGHT },
                    ]}
                  >
                    <Ionicons
                      name={option?.icon || "calendar-outline"}
                      size={18}
                      color={option?.color || AGENDA_ACCENT}
                    />
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventMeta}>
                      {agendaEventTypeLabels[event.event_type]}
                      {event.start_time ? ` · ${formatTimeLabel(event.start_time)}` : ""}
                      {event.metadata?.location ? ` · ${event.metadata.location}` : ""}
                    </Text>
                    {event.notes ? (
                      <Text style={styles.eventNotes} numberOfLines={2}>
                        {event.notes}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.GRAY} />
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-clear-outline" size={28} color={COLORS.GRAY} />
              <Text style={styles.emptyCardTitle}>Sin eventos en esta fecha</Text>
              <Text style={styles.emptyCardText}>
                Añade una guardia, sesión de estudio o un día libre para empezar a construir tu agenda.
              </Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Próximos eventos</Text>
              <Text style={styles.sectionSubtitle}>
                Lo que tienes programado en los próximos 5 días
              </Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => {
                const option = EVENT_TYPE_OPTIONS.find(
                  (item) => item.id === event.event_type
                );

                return (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.upcomingCard}
                    activeOpacity={0.9}
                    onPress={() => openEditFlow(event)}
                  >
                    <View
                      style={[
                        styles.upcomingBanner,
                        { backgroundColor: option?.lightColor || COLORS.PURPLE_LIGHT },
                      ]}
                    >
                      <Ionicons
                        name={option?.icon || "calendar-outline"}
                        size={30}
                        color={option?.color || AGENDA_ACCENT}
                      />
                      <View style={styles.upcomingDateBadge}>
                        <Text style={styles.upcomingDateText}>
                          {formatHumanDate(event.event_date)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.upcomingBody}>
                      <Text style={styles.upcomingTitle}>{event.title}</Text>
                      <Text style={styles.upcomingMeta}>
                        {agendaEventTypeLabels[event.event_type]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyUpcomingCard}>
                <Text style={styles.emptyCardTitle}>Nada programado todavía</Text>
                <Text style={styles.emptyCardText}>
                  Los próximos eventos aparecerán aquí cuando empieces a registrar actividad.
                </Text>
              </View>
            )}
          </ScrollView>

          {unscheduledEvents.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Pendientes de fecha</Text>
                  <Text style={styles.sectionSubtitle}>
                    Eventos guardados sin día asignado
                  </Text>
                </View>
              </View>

              {unscheduledEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.unscheduledCard}
                  onPress={() => openEditFlow(event)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.unscheduledTitle}>{event.title}</Text>
                  <Text style={styles.unscheduledMeta}>
                    {agendaEventTypeLabels[event.event_type]} · Sin fecha
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>

      <FloatingActionButton
        onPress={() => setTypeModalVisible(true)}
        icon="add"
        backgroundColor={AGENDA_ACCENT}
        bottom={28}
        right={24}
      />

      <Modal
        visible={typeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setTypeModalVisible(false)}
        >
          <Pressable style={styles.typeSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Añadir a la agenda</Text>
              <TouchableOpacity
                style={styles.closeCircle}
                onPress={() => setTypeModalVisible(false)}
              >
                <Ionicons name="close" size={16} color={COLORS.GRAY} />
              </TouchableOpacity>
            </View>

            {EVENT_TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.typeRow}
                activeOpacity={0.9}
                onPress={() => openCreateFlow(option.id)}
              >
                <View
                  style={[
                    styles.typeIconWrap,
                    { backgroundColor: option.lightColor },
                  ]}
                >
                  <Ionicons name={option.icon} size={20} color={option.color} />
                </View>
                <View style={styles.typeRowBody}>
                  <Text style={styles.typeRowTitle}>{option.label}</Text>
                  <Text style={styles.typeRowDescription}>
                    {option.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editorVisible}
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          style={styles.editorContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.editorScroll,
              {
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: Math.max(insets.bottom, 36),
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.editorHeader}>
              <TouchableOpacity style={styles.headerCircle} onPress={closeEditor}>
                <Ionicons name="arrow-back" size={20} color={AGENDA_ACCENT} />
              </TouchableOpacity>
              <Text style={styles.editorTitle}>
                {editingEvent ? "Editar evento" : `Añadir ${selectedTypeMeta.label.toLowerCase()}`}
              </Text>
              <View style={styles.headerCirclePlaceholder} />
            </View>

            <View
              style={[
                styles.editorHero,
                { backgroundColor: selectedTypeMeta.lightColor },
              ]}
            >
              <View
                style={[
                  styles.editorHeroIcon,
                  { backgroundColor: `${selectedTypeMeta.color}22` },
                ]}
              >
                <Ionicons
                  name={selectedTypeMeta.icon}
                  size={26}
                  color={selectedTypeMeta.color}
                />
              </View>
              <View style={styles.editorHeroText}>
                <Text style={[styles.editorHeroEyebrow, { color: selectedTypeMeta.color }]}>
                  Nuevo registro
                </Text>
                <Text style={styles.editorHeroDescription}>
                  Completa la información principal para que aparezca en tu agenda.
                </Text>
              </View>
            </View>

            {showsPrimaryTitleField ? (
              <View style={styles.editorSection}>
                <Text style={styles.inputLabel}>
                  {chipMeta[form.event_type].titleLabel}
                </Text>
                <TextInput
                  value={form.title}
                  onChangeText={(value) => patchForm("title", value)}
                  placeholder={chipMeta[form.event_type].titlePlaceholder}
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
              </View>
            ) : null}

            {form.event_type === "research" ? (
              <>
                <View style={styles.editorSection}>
                  <Text style={styles.inputLabel}>Estado del proyecto</Text>
                  <View style={styles.choiceRow}>
                    {RESEARCH_STATUS_OPTIONS.map((option) => (
                      <EventChip
                        key={option}
                        label={option}
                        color={selectedTypeMeta.color}
                        selected={form.metadata.research_status === option}
                        onPress={() => patchMetadata("research_status", option)}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.editorSection}>
                  <Text style={styles.inputLabel}>Rol en la investigación</Text>
                  <View style={styles.choiceRow}>
                    {RESEARCH_ROLE_OPTIONS.map((option) => (
                      <EventChip
                        key={option}
                        label={option}
                        color={selectedTypeMeta.color}
                        selected={form.metadata.research_role === option}
                        onPress={() => patchMetadata("research_role", option)}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            {form.event_type === "study" ? (
              <View style={styles.editorSection}>
                <Text style={styles.inputLabel}>Duración (minutos)</Text>
                <TextInput
                  value={form.metadata.study_minutes}
                  onChangeText={(value) => patchMetadata("study_minutes", value)}
                  placeholder="Ej. 120"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  style={styles.textInput}
                />
              </View>
            ) : null}

            {form.event_type === "conference" ? (
              <>
                <View style={styles.editorSection}>
                  <Text style={styles.inputLabel}>Rol en el congreso</Text>
                  <View style={styles.choiceRow}>
                    {CONFERENCE_ROLE_OPTIONS.map((option) => (
                      <EventChip
                        key={option}
                        label={option}
                        color={selectedTypeMeta.color}
                        selected={form.metadata.conference_role === option}
                        onPress={() => patchMetadata("conference_role", option)}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            {form.event_type === "shift" ? (
              <>
                <View style={styles.editorSection}>
                  <Text style={styles.inputLabel}>Duración</Text>
                  <View style={styles.choiceRow}>
                    {SHIFT_DURATION_OPTIONS.map((option) => (
                      <EventChip
                        key={option}
                        label={option}
                        color={selectedTypeMeta.color}
                        selected={form.metadata.shift_duration === option}
                        onPress={() => patchMetadata("shift_duration", option)}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            {DATE_TOGGLE_TYPES.has(form.event_type) ? (
              <>
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.toggleTitle}>Asignar fecha</Text>
                    <Text style={styles.toggleDescription}>
                      Actívalo si el evento ocupa varios días.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDateToggle(!form.hasDate)}
                    activeOpacity={0.85}
                    style={[
                      styles.toggleSwitch,
                      form.hasDate && {
                        backgroundColor: selectedTypeMeta.color,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleCircle,
                        form.hasDate && styles.toggleCircleActive,
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                {form.hasDate ? (
                  <View style={styles.editorSection}>
                    <Text style={styles.inputLabel}>Duración</Text>
                    <View style={styles.choiceRow}>
                      {MULTI_DAY_DURATION_OPTIONS.map((option) => (
                        <EventChip
                          key={option}
                          label={`${option} días`}
                          color={selectedTypeMeta.color}
                          selected={form.duration_days === option}
                          onPress={() => patchForm("duration_days", option)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            <View style={styles.editorSection}>
              <Text style={styles.inputLabel}>Notas</Text>
              <TextInput
                value={form.notes}
                onChangeText={(value) => patchForm("notes", value)}
                placeholder="Añade contexto, ubicación o detalles útiles"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.textInput, styles.textArea]}
              />
            </View>

            {effectiveReminderDate ? (
              <View style={styles.editorSection}>
                <Text style={styles.inputLabel}>Recordatorio</Text>
                <View style={styles.choiceRow}>
                  {REMINDER_OPTIONS.map((option) => (
                    <EventChip
                      key={option.label}
                      label={option.label}
                      color={selectedTypeMeta.color}
                      selected={form.metadata.reminder_offset_days === option.value}
                      onPress={() =>
                        patchMetadata("reminder_offset_days", option.value)
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Guardando..." : chipMeta[form.event_type].submitText}
              </Text>
            </TouchableOpacity>

            {editingEvent ? (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => setDeleteCandidate(editingEvent)}
                activeOpacity={0.9}
              >
                <Text style={styles.deleteButtonText}>Eliminar evento</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <ConfirmationModal
            visible={Boolean(deleteCandidate)}
            title="Eliminar evento"
            message="Esta acción eliminará el evento de tu agenda. Si es una guardia, también se eliminará de la tabla legacy de shifts."
            confirmText="Eliminar"
            onCancel={closeDeleteDialog}
            onConfirm={handleDelete}
            useModal={false}
          />
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F5F8",
  },
  scrollContent: {
    paddingBottom: 112,
  },
  heroIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroMonthCard: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: COLORS.PRIMARY,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  heroArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.18)",
  },
  heroMonthLabel: {
    color: COLORS.TEXT_LIGHT,
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 1.1,
    textAlign: "center",
  },
  heroMonthValue: {
    color: "#1B3A70",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  body: {
    marginTop: -18,
    paddingHorizontal: 14,
    gap: 16,
  },
  calendarCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 2,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 12,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  infoCard: {
    borderRadius: 16,
    backgroundColor: "#F8F5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  infoCardText: {
    flex: 1,
    color: "#5B21B6",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textTransform: "capitalize",
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  loadingCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  eventRow: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  eventIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  eventMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  eventNotes: {
    marginTop: 6,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  emptyCardTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyCardText: {
    marginTop: 6,
    textAlign: "center",
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
  upcomingCard: {
    width: 220,
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    marginRight: 12,
    overflow: "hidden",
  },
  upcomingBanner: {
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingDateBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  upcomingDateText: {
    fontSize: 11,
    fontWeight: "800",
    color: AGENDA_ACCENT,
  },
  upcomingBody: {
    padding: 14,
  },
  upcomingTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  upcomingMeta: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyUpcomingCard: {
    width: 250,
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    padding: 18,
  },
  unscheduledCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
  },
  unscheduledTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  unscheduledMeta: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  typeSheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  closeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  typeRowBody: {
    flex: 1,
  },
  typeRowTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  typeRowDescription: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
  },
  editorContainer: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  editorScroll: {
    padding: 16,
    paddingBottom: 36,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEAFE",
  },
  headerCirclePlaceholder: {
    width: 42,
    height: 42,
  },
  editorTitle: {
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 8,
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  editorHero: {
    marginTop: 18,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  editorHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  editorHeroText: {
    flex: 1,
  },
  editorHeroEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  editorHeroDescription: {
    marginTop: 6,
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
  },
  editorSection: {
    marginTop: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  textInput: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0F172A",
  },
  textArea: {
    minHeight: 108,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.WHITE,
  },
  choiceChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  toggleRow: {
    marginTop: 18,
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  toggleDescription: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
    maxWidth: "88%",
    lineHeight: 18,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    padding: 2,
    flexShrink: 0,
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  toggleCircleActive: {
    transform: [{ translateX: 20 }],
  },
  timeRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  timeField: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  timeLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "700",
  },
  timeValue: {
    marginTop: 6,
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "800",
  },
  primaryButton: {
    marginTop: 22,
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AGENDA_ACCENT,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: "800",
  },
  deleteButton: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF1F2",
  },
  deleteButtonText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "800",
  },
});

export default AgendaScreen;
