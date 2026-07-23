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
import { Icon } from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { BottomMenuHeroHeader } from "../components/BottomMenuHeroHeader";
import { ShareConnectionsPicker } from "../components/ShareConnectionsPicker";
import { useAgendaEvents } from "../hooks/useAgendaEvents";
import { useSharedAgendaEvents } from "../hooks/useSharedAgendaEvents";
import { useTeamShifts } from "../hooks/useTeamShifts";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";
import {
  agendaEventTypeLabels,
  getAgendaEventShareUserIds,
} from "../services/agendaService";
import { getMyConnections } from "../services/connectionsService";

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
const TEAM_SHIFT_COLOR = "#F97316";

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
const SHIFT_DURATION_OPTIONS = ["24h", "17h", "12h"];
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

const monthTitle = (date) => {
  const label = date.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

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

// Construye las filas de información que se muestran en el detalle de solo
// lectura de un evento compartido por una Conexión.
const buildSharedEventDetailRows = (event) => {
  if (!event) return [];

  const rows = [];
  const metadata = event.metadata || {};

  rows.push({
    key: "owner",
    icon: "person-circle-outline",
    label: "Compartido por",
    value: event.owner_name || "Conexión",
  });

  if (event.event_date) {
    const dateValue = event.end_date && event.end_date !== event.event_date
      ? `${formatLongDate(event.event_date)} – ${formatLongDate(event.end_date)}`
      : formatLongDate(event.event_date);
    rows.push({ key: "date", icon: "calendar-outline", label: "Fecha", value: dateValue });
  }

  if (!event.all_day && (event.start_time || event.end_time)) {
    const timeValue = event.end_time
      ? `${formatTimeLabel(event.start_time)} – ${formatTimeLabel(event.end_time)}`
      : formatTimeLabel(event.start_time);
    rows.push({ key: "time", icon: "time-outline", label: "Hora", value: timeValue });
  }

  if (metadata.shift_duration) {
    rows.push({
      key: "shift_duration",
      icon: "hourglass-outline",
      label: "Duración",
      value: metadata.shift_duration,
    });
  }

  if (metadata.shift_is_holiday) {
    rows.push({
      key: "shift_is_holiday",
      icon: "calendar-outline",
      label: "Festivo",
      value: "Sí",
    });
  }

  if (metadata.research_status) {
    rows.push({
      key: "research_status",
      icon: "flask-outline",
      label: "Estado",
      value: metadata.research_status,
    });
  }

  if (metadata.research_role) {
    rows.push({
      key: "research_role",
      icon: "ribbon-outline",
      label: "Rol",
      value: metadata.research_role,
    });
  }

  if (metadata.conference_role) {
    rows.push({
      key: "conference_role",
      icon: "people-outline",
      label: "Participación",
      value: metadata.conference_role,
    });
  }

  if (metadata.study_minutes) {
    rows.push({
      key: "study_minutes",
      icon: "book-outline",
      label: "Tiempo de estudio",
      value: `${metadata.study_minutes} min`,
    });
  }

  if (metadata.location) {
    rows.push({
      key: "location",
      icon: "location-outline",
      label: "Ubicación",
      value: metadata.location,
    });
  }

  return rows;
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
    shift_is_holiday: false,
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
    shift_is_holiday: Boolean(event.metadata?.shift_is_holiday),
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
    metadata.shift_is_holiday = Boolean(form.metadata.shift_is_holiday);
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

export const AgendaScreen = ({ userProfile, navigation }) => {
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
  const [form, setForm] = useState(emptyFormForType("shift", todayString));
  const [shiftSelectionMode, setShiftSelectionMode] = useState(false);
  const [selectedShiftDates, setSelectedShiftDates] = useState(new Set());
  const [batchShiftDates, setBatchShiftDates] = useState([]);
  const [connections, setConnections] = useState([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [shareUserIds, setShareUserIds] = useState([]);
  const [sharePickerVisible, setSharePickerVisible] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);

  const {
    events,
    loading,
    saving,
    upcomingEvents,
    unscheduledEvents,
    createEvent,
    createEventsBatch,
    updateEvent,
    removeEvent,
  } = useAgendaEvents(userId);

  const { sharedEvents } = useSharedAgendaEvents(userId);
  const {
    teamShifts,
    setCurrentMonth: setTeamMonth,
    setCurrentYear: setTeamYear,
  } = useTeamShifts(
    userId,
    userProfile?.hospital_id,
    userProfile?.speciality_id
  );

  useEffect(() => {
    posthogLogger.logScreen("AgendaScreen");
  }, []);

  // Mantener las guardias de equipo en sincronia con el mes visible del calendario.
  useEffect(() => {
    setTeamMonth(visibleMonth.getMonth());
    setTeamYear(visibleMonth.getFullYear());
  }, [visibleMonth, setTeamMonth, setTeamYear]);

  // Cargar las Conexiones del residente la primera vez que se abre el editor de un
  // evento compartible (no-guardia).
  useEffect(() => {
    if (!editorVisible || connectionsLoaded || form.event_type === "shift") {
      return;
    }
    let active = true;
    (async () => {
      const { success, connections: rows } = await getMyConnections();
      if (active && success) {
        setConnections(rows);
        setConnectionsLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [editorVisible, connectionsLoaded, form.event_type]);

  const selectedTypeMeta = useMemo(() => {
    return (
      EVENT_TYPE_OPTIONS.find((option) => option.id === form.event_type) ||
      EVENT_TYPE_OPTIONS[0]
    );
  }, [form.event_type]);

  const showsPrimaryTitleField = TITLE_FIELD_TYPES.has(form.event_type);
  const showsShareField = form.event_type !== "shift";
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

  const shiftOccupiedDates = useMemo(() => {
    return new Set(
      events
        .filter((e) => e.event_type === "shift" && e.event_date)
        .map((e) => e.event_date)
    );
  }, [events]);

  const eventsByDate = useMemo(() => {
    const map = {};

    events.forEach((event) => {
      if (!event.event_date) return;

      const startDate = new Date(`${event.event_date}T00:00:00`);
      const endDate = new Date(`${(event.end_date || event.event_date)}T00:00:00`);

      for (
        let cursor = new Date(startDate);
        cursor <= endDate;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const dateKey = formatDateKey(cursor);
        if (!map[dateKey]) {
          map[dateKey] = [];
        }
        map[dateKey].push(event);
      }
    });

    Object.keys(map).forEach((dateKey) => {
      map[dateKey].sort((left, right) => {
        const leftTime = left.start_time || "00:00:00";
        const rightTime = right.start_time || "00:00:00";
        return leftTime.localeCompare(rightTime);
      });
    });

    return map;
  }, [events]);

  const MAX_BADGES_PER_DAY = 3;

  const selectedDayEvents = useMemo(() => {
    return events.filter((event) =>
      dateRangesInclude(selectedDate, event.event_date, event.end_date)
    );
  }, [events, selectedDate]);

  // Guardias de equipo indexadas por fecha (solo-lectura, etiquetadas con nombre).
  const teamShiftsByDate = useMemo(() => {
    const map = {};
    (teamShifts || []).forEach((shift) => {
      if (!shift.date) return;
      if (!map[shift.date]) {
        map[shift.date] = [];
      }
      map[shift.date].push(shift);
    });
    return map;
  }, [teamShifts]);

  // Eventos compartidos conmigo, expandidos por rango de fechas (solo-lectura).
  const sharedEventsByDate = useMemo(() => {
    const map = {};
    (sharedEvents || []).forEach((event) => {
      if (!event.event_date) return;
      const startDate = new Date(`${event.event_date}T00:00:00`);
      const endDate = new Date(
        `${event.end_date || event.event_date}T00:00:00`
      );
      for (
        let cursor = new Date(startDate);
        cursor <= endDate;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const dateKey = formatDateKey(cursor);
        if (!map[dateKey]) {
          map[dateKey] = [];
        }
        map[dateKey].push(event);
      }
    });
    return map;
  }, [sharedEvents]);

  const selectedDayTeamShifts = useMemo(
    () => teamShiftsByDate[selectedDate] || [],
    [teamShiftsByDate, selectedDate]
  );

  const selectedDaySharedEvents = useMemo(
    () => sharedEventsByDate[selectedDate] || [],
    [sharedEventsByDate, selectedDate]
  );

  const exitShiftSelectionMode = () => {
    setShiftSelectionMode(false);
    setSelectedShiftDates(new Set());
    setBatchShiftDates([]);
  };

  const toggleShiftDate = (dateString) => {
    setSelectedShiftDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateString)) {
        next.delete(dateString);
      } else {
        next.add(dateString);
      }
      return next;
    });
  };

  const confirmShiftSelection = () => {
    const dates = Array.from(selectedShiftDates).sort();
    setBatchShiftDates(dates);
    setEditingEvent(null);
    setForm(emptyFormForType("shift", dates[0]));
    setEditorVisible(true);
  };

  const openCreateFlow = (type, defaultDate = selectedDate) => {
    if (type === "shift") {
      const initial = shiftOccupiedDates.has(defaultDate)
        ? new Set()
        : new Set([defaultDate]);
      setSelectedShiftDates(initial);
      setShiftSelectionMode(true);
      setTypeModalVisible(false);
      return;
    }
    setEditingEvent(null);
    setForm(emptyFormForType(type, defaultDate));
    setShareUserIds([]);
    setTypeModalVisible(false);
    setEditorVisible(true);
  };

  const openEditFlow = (event) => {
    setEditingEvent(event);
    setForm(formFromEvent(event));
    setShareUserIds([]);
    setEditorVisible(true);

    if (event.event_type !== "shift") {
      getAgendaEventShareUserIds(event.id)
        .then((ids) => setShareUserIds(ids))
        .catch((error) =>
          console.error("Error loading event shares:", error)
        );
    }
  };

  // Los eventos compartidos por una Conexión son de solo lectura: el residente
  // puede abrir su detalle pero solo el creador (owner) puede editarlos.
  const openSharedDetail = (event) => {
    setDetailEvent(event);
  };

  const closeSharedDetail = () => {
    setDetailEvent(null);
  };

  const closeEditor = () => {
    setEditorVisible(false);
    setEditingEvent(null);
    setBatchShiftDates([]);
    setShareUserIds([]);
    setSharePickerVisible(false);
    exitShiftSelectionMode();
  };

  // Desde el selector vacío de "Compartir con": llevar al residente al
  // directorio de Residentes para que pueda crear conexiones.
  // El picker es un Modal anidado dentro del Modal del editor, así que hay que
  // cerrarlos en secuencia (interno -> externo) y navegar solo cuando ya no
  // queda ningún Modal en pantalla. Si navegamos mientras un Modal sigue
  // (des)montándose, DashboardScreen desmonta AgendaScreen y la ventana nativa
  // del Modal queda huérfana => pantalla en negro.
  const handleAddConnection = () => {
    setSharePickerVisible(false);
    setTimeout(() => {
      closeEditor();
      setTimeout(() => {
        navigation?.navigate?.("residentsDirectory");
      }, 320);
    }, 280);
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
    if (batchShiftDates.length > 0) {
      return null;
    }

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

    if (batchShiftDates.length > 0) {
      const sharedData = {
        notes: form.notes.trim(),
        metadata: {
          shift_duration: form.metadata.shift_duration,
          shift_is_holiday: Boolean(form.metadata.shift_is_holiday),
          reminder_offset_days: form.metadata.reminder_offset_days ?? null,
        },
      };
      const result = await createEventsBatch(batchShiftDates, sharedData);
      const failedCount = result.failed?.length ?? 0;
      const createdCount = result.created?.length ?? 0;
      if (failedCount > 0) {
        Alert.alert(
          createdCount > 0 ? "Guardias creadas parcialmente" : "Error al crear guardias",
          createdCount > 0
            ? `${createdCount} de ${batchShiftDates.length} guardias creadas. ${failedCount} no pudieron guardarse, inténtalo de nuevo.`
            : "No se pudieron guardar las guardias. Inténtalo de nuevo."
        );
      }
      closeEditor();
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

    const shares = payload.event_type === "shift" ? undefined : shareUserIds;

    const result = editingEvent
      ? await updateEvent(editingEvent.id, payload, shares)
      : await createEvent(payload, shares);

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

  return (
    <View style={styles.container}>
      <View style={styles.heroShell}>
        <BottomMenuHeroHeader
          title="Agenda de residencia"
          subtitle="Calendario unificado para guardias, cursos, estudio e hitos de tu residencia."
        />
      </View>

      <View style={styles.contentShell}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarMonthHeader}>
              <TouchableOpacity
                style={styles.calendarMonthArrow}
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
                <Icon name="chevron-back" size={18} color={AGENDA_ACCENT} />
              </TouchableOpacity>
              <Text style={styles.calendarMonthValue}>
                {monthTitle(visibleMonth)}
              </Text>
              <TouchableOpacity
                style={styles.calendarMonthArrow}
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
                <Icon name="chevron-forward" size={18} color={AGENDA_ACCENT} />
              </TouchableOpacity>
            </View>
            {shiftSelectionMode ? (
              <View style={styles.selectionBanner}>
                <Icon
                  name={selectedShiftDates.size === 0 ? "calendar-outline" : "checkmark-circle"}
                  size={18}
                  color="#7C3AED"
                />
                <Text style={styles.selectionBannerText}>
                  {selectedShiftDates.size === 0
                    ? "Toca los días que tengas guardia"
                    : `${selectedShiftDates.size} ${selectedShiftDates.size === 1 ? "seleccionada" : "seleccionadas"}`}
                </Text>
              </View>
            ) : null}
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
              onMonthChange={(month) =>
                setVisibleMonth(new Date(month.year, month.month - 1, 1))
              }
              hideArrows
              disableMonthChange
              theme={{
                calendarBackground: COLORS.WHITE,
                textMonthFontWeight: "700",
                textDayHeaderFontWeight: "700",
                selectedDayBackgroundColor: AGENDA_ACCENT,
                todayTextColor: AGENDA_ACCENT,
                dotColor: AGENDA_ACCENT,
              }}
              renderHeader={() => <View />}
              dayComponent={({ date, state }) => {
                if (!date) return <View style={styles.dayCell} />;

                const dateString = date.dateString;
                const isOtherMonth = state === "disabled";
                const isToday = dateString === todayString;

                if (shiftSelectionMode) {
                  const isOccupied = shiftOccupiedDates.has(dateString);
                  const isSelected = selectedShiftDates.has(dateString);
                  const blocked = isOtherMonth || isOccupied;

                  return (
                    <TouchableOpacity
                      style={styles.dayCell}
                      activeOpacity={blocked ? 1 : 0.7}
                      disabled={blocked}
                      onPress={() => toggleShiftDate(dateString)}
                    >
                      <View
                        style={[
                          styles.dayNumberWrap,
                          isSelected && styles.dayNumberSelectedShift,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            isOtherMonth && styles.dayNumberOtherMonth,
                            isOccupied && styles.dayNumberOccupied,
                            isToday && !isSelected && styles.dayNumberToday,
                            isSelected && styles.dayNumberSelectedText,
                          ]}
                        >
                          {date.day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }

                const ownItems = (isOtherMonth ? [] : eventsByDate[dateString] || []).map(
                  (event) => {
                    const typeMeta =
                      EVENT_TYPE_OPTIONS.find((o) => o.id === event.event_type) ||
                      EVENT_TYPE_OPTIONS[0];
                    return {
                      key: `own-${event.id}`,
                      color: typeMeta.color,
                      label: event.title || agendaEventTypeLabels[event.event_type],
                      onPress: () => openEditFlow(event),
                    };
                  }
                );

                const teamItems = (isOtherMonth ? [] : teamShiftsByDate[dateString] || []).map(
                  (shift) => ({
                    key: `team-${shift.id}`,
                    color: TEAM_SHIFT_COLOR,
                    label: `${shift.user_name || "Compañero"} Gua`,
                    onPress: () => setSelectedDate(dateString),
                  })
                );

                const sharedItems = (
                  isOtherMonth ? [] : sharedEventsByDate[dateString] || []
                ).map((event) => {
                  const typeMeta =
                    EVENT_TYPE_OPTIONS.find((o) => o.id === event.event_type) ||
                    EVENT_TYPE_OPTIONS[0];
                  return {
                    key: `shared-${event.id}`,
                    color: typeMeta.color,
                    label: `${event.owner_name || "Conexión"} ${
                      event.title || agendaEventTypeLabels[event.event_type]
                    }`,
                    onPress: () => openSharedDetail(event),
                  };
                });

                const dayItems = [...ownItems, ...teamItems, ...sharedItems];
                const isSelected = dateString === selectedDate;
                const visibleItems = dayItems.slice(0, MAX_BADGES_PER_DAY);
                const extraCount = dayItems.length - visibleItems.length;

                return (
                  <TouchableOpacity
                    style={styles.dayCell}
                    activeOpacity={isOtherMonth ? 1 : 0.7}
                    disabled={isOtherMonth}
                    onPress={() => setSelectedDate(dateString)}
                  >
                    <View
                      style={[
                        styles.dayNumberWrap,
                        isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          isOtherMonth && styles.dayNumberOtherMonth,
                          isToday && !isSelected && styles.dayNumberToday,
                          isSelected && styles.dayNumberSelectedText,
                        ]}
                      >
                        {date.day}
                      </Text>
                    </View>

                    <View style={styles.dayBadges}>
                      {visibleItems.map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          style={[styles.dayBadge, { backgroundColor: item.color }]}
                          activeOpacity={0.8}
                          onPress={item.onPress}
                        >
                          <Text style={styles.dayBadgeText} numberOfLines={1}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {extraCount > 0 ? (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setSelectedDate(dateString)}
                        >
                          <Text style={styles.dayBadgeMore}>+{extraCount} más</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {!shiftSelectionMode && residentLegendOptions.length > 0 ? (
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

          {!shiftSelectionMode ? (
            <>
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
          ) : (
            <>
              {selectedDayEvents.map((event) => {
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
                      <Icon
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
                    <Icon name="chevron-forward" size={18} color={COLORS.GRAY} />
                  </TouchableOpacity>
                );
              })}

              {selectedDayTeamShifts.map((shift) => (
                <View key={`team-${shift.id}`} style={styles.eventRow}>
                  <View
                    style={[styles.eventIcon, { backgroundColor: "#FFEDD5" }]}
                  >
                    <Icon name="medkit-outline" size={18} color={TEAM_SHIFT_COLOR} />
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle}>
                      {`${shift.user_name || "Compañero"} ${shift.user_surname || ""}`.trim()}
                    </Text>
                    <Text style={styles.eventMeta}>Guardia · Equipo</Text>
                  </View>
                </View>
              ))}

              {selectedDaySharedEvents.map((event) => {
                const option = EVENT_TYPE_OPTIONS.find(
                  (item) => item.id === event.event_type
                );

                return (
                  <TouchableOpacity
                    key={`shared-${event.id}`}
                    style={styles.eventRow}
                    activeOpacity={0.88}
                    onPress={() => openSharedDetail(event)}
                  >
                    <View
                      style={[
                        styles.eventIcon,
                        { backgroundColor: option?.lightColor || COLORS.PURPLE_LIGHT },
                      ]}
                    >
                      <Icon
                        name={option?.icon || "calendar-outline"}
                        size={18}
                        color={option?.color || AGENDA_ACCENT}
                      />
                    </View>
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventMeta}>
                        {`${event.owner_name || "Conexión"} · ${
                          agendaEventTypeLabels[event.event_type]
                        }`}
                        {event.start_time ? ` · ${formatTimeLabel(event.start_time)}` : ""}
                      </Text>
                      {event.notes ? (
                        <Text style={styles.eventNotes} numberOfLines={2}>
                          {event.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="chevron-forward" size={18} color={COLORS.GRAY} />
                  </TouchableOpacity>
                );
              })}

              {selectedDayEvents.length === 0 &&
              selectedDayTeamShifts.length === 0 &&
              selectedDaySharedEvents.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Icon name="calendar-clear-outline" size={28} color={COLORS.GRAY} />
                  <Text style={styles.emptyCardTitle}>Sin eventos en esta fecha</Text>
                  <Text style={styles.emptyCardText}>
                    Añade una guardia, sesión de estudio o un día libre para empezar a construir tu agenda.
                  </Text>
                </View>
              ) : null}
            </>
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
                      <Icon
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
            </>
          ) : null}
          </View>
        </ScrollView>
      </View>

      {shiftSelectionMode ? (
        <View style={styles.shiftSelectionBar}>
          <TouchableOpacity onPress={exitShiftSelectionMode} style={styles.selectionBarCancel}>
            <Text style={styles.selectionBarCancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.selectionBarCount}>
            {selectedShiftDates.size === 0
              ? "Selecciona fechas"
              : `${selectedShiftDates.size} ${selectedShiftDates.size === 1 ? "guardia" : "guardias"}`}
          </Text>
          <TouchableOpacity
            onPress={confirmShiftSelection}
            disabled={selectedShiftDates.size === 0}
            style={[
              styles.selectionBarConfirm,
              selectedShiftDates.size === 0 && styles.selectionBarConfirmDisabled,
            ]}
          >
            <Text style={styles.selectionBarConfirmText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FloatingActionButton
          onPress={() => setTypeModalVisible(true)}
          icon="add"
          backgroundColor={AGENDA_ACCENT}
          bottom={28}
          right={24}
        />
      )}

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
                <Icon name="close" size={16} color={COLORS.GRAY} />
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
                  <Icon name={option.icon} size={20} color={option.color} />
                </View>
                <View style={styles.typeRowBody}>
                  <Text style={styles.typeRowTitle}>{option.label}</Text>
                  <Text style={styles.typeRowDescription}>
                    {option.description}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!detailEvent}
        transparent
        animationType="slide"
        onRequestClose={closeSharedDetail}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeSharedDetail}>
          <Pressable style={styles.detailSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            {detailEvent
              ? (() => {
                  const detailMeta =
                    EVENT_TYPE_OPTIONS.find(
                      (item) => item.id === detailEvent.event_type
                    ) || EVENT_TYPE_OPTIONS[0];
                  const detailRows = buildSharedEventDetailRows(detailEvent);

                  return (
                    <>
                      <View style={styles.sheetHeader}>
                        <View style={styles.detailHeaderText}>
                          <View
                            style={[
                              styles.detailHeaderIcon,
                              { backgroundColor: detailMeta.lightColor },
                            ]}
                          >
                            <Icon
                              name={detailMeta.icon}
                              size={20}
                              color={detailMeta.color}
                            />
                          </View>
                          <View style={styles.detailHeaderTitles}>
                            <Text style={styles.sheetTitle} numberOfLines={2}>
                              {detailEvent.title ||
                                agendaEventTypeLabels[detailEvent.event_type]}
                            </Text>
                            <Text style={styles.detailHeaderSubtitle}>
                              {agendaEventTypeLabels[detailEvent.event_type]}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.closeCircle}
                          onPress={closeSharedDetail}
                        >
                          <Icon name="close" size={16} color={COLORS.GRAY} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.detailReadonlyBadge}>
                        <Icon
                          name="lock-closed-outline"
                          size={13}
                          color={COLORS.GRAY}
                        />
                        <Text style={styles.detailReadonlyText}>
                          Solo lectura · únicamente quien lo creó puede editarlo
                        </Text>
                      </View>

                      {detailRows.map((row) => (
                        <View key={row.key} style={styles.detailRow}>
                          <Icon
                            name={row.icon}
                            size={18}
                            color={AGENDA_ACCENT}
                          />
                          <View style={styles.detailRowText}>
                            <Text style={styles.detailRowLabel}>{row.label}</Text>
                            <Text style={styles.detailRowValue}>{row.value}</Text>
                          </View>
                        </View>
                      ))}

                      {detailEvent.notes ? (
                        <View style={styles.detailNotesBlock}>
                          <Text style={styles.detailRowLabel}>Notas</Text>
                          <Text style={styles.detailNotesText}>
                            {detailEvent.notes}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  );
                })()
              : null}
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
                <Icon name="arrow-back" size={20} color={AGENDA_ACCENT} />
              </TouchableOpacity>
              <Text style={styles.editorTitle}>
                {editingEvent
                  ? "Editar evento"
                  : batchShiftDates.length > 1
                    ? `Añadir ${batchShiftDates.length} guardias`
                    : `Añadir ${selectedTypeMeta.label.toLowerCase()}`}
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
                <Icon
                  name={selectedTypeMeta.icon}
                  size={26}
                  color={selectedTypeMeta.color}
                />
              </View>
              <View style={styles.editorHeroText}>
                <Text style={[styles.editorHeroEyebrow, { color: selectedTypeMeta.color }]}>
                  {batchShiftDates.length > 1 ? `${batchShiftDates.length} guardias` : "Nuevo registro"}
                </Text>
                <Text style={styles.editorHeroDescription}>
                  {batchShiftDates.length > 1
                    ? `Se crearán ${batchShiftDates.length} guardias con la configuración que elijas.`
                    : "Completa la información principal para que aparezca en tu agenda."}
                </Text>
              </View>
            </View>

            {batchShiftDates.length > 0 ? (
              <View style={styles.editorSection}>
                <Text style={styles.inputLabel}>
                  Fechas seleccionadas ({batchShiftDates.length})
                </Text>
                <View style={styles.choiceRow}>
                  {batchShiftDates.map((date) => (
                    <View key={date} style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>{formatHumanDate(date)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

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

                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.toggleTitle}>Festivo</Text>
                    <Text style={styles.toggleDescription}>
                      Márcalo si la guardia cae en día festivo.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      patchMetadata(
                        "shift_is_holiday",
                        !form.metadata.shift_is_holiday
                      )
                    }
                    activeOpacity={0.85}
                    style={[
                      styles.toggleSwitch,
                      form.metadata.shift_is_holiday && {
                        backgroundColor: selectedTypeMeta.color,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleCircle,
                        form.metadata.shift_is_holiday &&
                          styles.toggleCircleActive,
                      ]}
                    />
                  </TouchableOpacity>
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

            {showsShareField ? (
              <View style={styles.editorSection}>
                <Text style={styles.inputLabel}>Compartir con</Text>
                <TouchableOpacity
                  style={styles.shareSelector}
                  activeOpacity={0.85}
                  onPress={() => setSharePickerVisible(true)}
                  disabled={!connectionsLoaded}
                >
                  <Icon
                    name="people-outline"
                    size={20}
                    color={selectedTypeMeta.color}
                  />
                  <Text style={styles.shareSelectorText}>
                    {shareUserIds.length > 0
                      ? `${shareUserIds.length} ${
                          shareUserIds.length === 1 ? "conexión" : "conexiones"
                        }`
                      : connectionsLoaded
                        ? "Elegir conexiones"
                        : "Cargando conexiones..."}
                  </Text>
                  <Icon name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              </View>
            ) : null}

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
                {saving
                  ? "Guardando..."
                  : batchShiftDates.length > 1
                    ? `Crear ${batchShiftDates.length} guardias`
                    : chipMeta[form.event_type].submitText}
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

          <ShareConnectionsPicker
            visible={sharePickerVisible}
            onClose={() => setSharePickerVisible(false)}
            connections={connections}
            selectedIds={shareUserIds}
            onConfirm={setShareUserIds}
            onAddConnection={handleAddConnection}
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
  heroShell: {
    position: "relative",
  },
  contentShell: {
    flex: 1,
    position: "relative",
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
    backgroundColor: "rgba(103,12,245,0.10)",
  },
  body: {
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
  calendarMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 6,
  },
  calendarMonthArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3E8FF",
  },
  calendarMonthValue: {
    flex: 1,
    textAlign: "center",
    color: "#1B0977",
    fontSize: 17,
    fontWeight: "800",
  },
  selectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  dayCell: {
    minHeight: 78,
    width: "100%",
    alignItems: "center",
    paddingTop: 2,
    paddingHorizontal: 2,
  },
  dayNumberWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  dayNumberSelected: {
    backgroundColor: AGENDA_ACCENT,
  },
  dayNumberSelectedShift: {
    backgroundColor: "#7C3AED",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  dayNumberOtherMonth: {
    color: "#CBD5E1",
  },
  dayNumberOccupied: {
    color: "#CBD5E1",
  },
  dayNumberToday: {
    color: AGENDA_ACCENT,
    fontWeight: "800",
  },
  dayNumberSelectedText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  dayBadges: {
    width: "100%",
    gap: 2,
    alignItems: "stretch",
  },
  dayBadge: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dayBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dayBadgeMore: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
    marginTop: 1,
  },
  selectionBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#5B21B6",
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
  detailSheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  detailHeaderText: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  detailHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeaderTitles: {
    flex: 1,
  },
  detailHeaderSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.GRAY,
    marginTop: 2,
  },
  detailReadonlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  detailReadonlyText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.GRAY,
    flex: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  detailRowText: {
    flex: 1,
  },
  detailRowLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailRowValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginTop: 2,
  },
  detailNotesBlock: {
    marginTop: 16,
  },
  detailNotesText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
    marginTop: 6,
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
  shareSelector: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shareSelectorText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
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
  shiftSelectionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8,
  },
  selectionBarCancel: {
    padding: 10,
  },
  selectionBarCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  selectionBarCount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  selectionBarConfirm: {
    backgroundColor: "#7C3AED",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  selectionBarConfirmDisabled: {
    backgroundColor: "#E2E8F0",
  },
  selectionBarConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dateBadge: {
    borderRadius: 999,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7C3AED",
  },
});

export default AgendaScreen;
