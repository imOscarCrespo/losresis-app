/**
 * Sesiones de un curso con inscripción en la app (ClickUp 124b4z9vn8v). Una
 * sesión es un día del curso; `get_course_enrollment_summary` devuelve los
 * días (`session_dates`) y, desde la 1.0.95, sus datos opcionales
 * (`sessions`: nombre, horario y lugar). Con un resumen sin `sessions` (base
 * antigua) se enseñan solo las fechas, como antes.
 */

const STATUS = {
  attended: "attended",
  pending: "pending",
  missed: "missed",
};

const hourMinute = (value) => (typeof value === "string" ? value.slice(0, 5) : "");

/** "09:00 – 14:00", "Desde las 09:00", "Hasta las 14:00" o "". */
export const formatSessionTime = (startsAt, endsAt) => {
  const start = hourMinute(startsAt);
  const end = hourMinute(endsAt);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Desde las ${start}`;
  if (end) return `Hasta las ${end}`;
  return "";
};

/** Nombre de la sesión: el suyo o "Sesión N" por su posición. */
export const sessionLabel = (title, index) =>
  (typeof title === "string" && title.trim()) || `Sesión ${index + 1}`;

const sessionStatus = (date, today, attended) => {
  if (attended.has(date)) return STATUS.attended;
  if (today && date >= today) return STATUS.pending;
  return STATUS.missed;
};

/**
 * Filas de "Tus sesiones": una por día del curso, en orden, con su nombre,
 * horario, lugar y si asistió. [] si no hay resumen o no hay días.
 */
export const describeCourseSessions = (summary) => {
  const dates = Array.isArray(summary?.session_dates) ? summary.session_dates : [];
  const byDate = new Map(
    (Array.isArray(summary?.sessions) ? summary.sessions : [])
      .filter((s) => s && s.session_date)
      .map((s) => [s.session_date, s])
  );
  const attended = new Set(Array.isArray(summary?.attended_dates) ? summary.attended_dates : []);
  return [...dates].sort().map((date, index) => {
    const data = byDate.get(date) ?? {};
    return {
      date,
      label: sessionLabel(data.title, index),
      time: formatSessionTime(data.starts_at, data.ends_at),
      location: (typeof data.location === "string" && data.location.trim()) || null,
      status: sessionStatus(date, summary?.today, attended),
    };
  });
};

/** La sesión de hoy (o null), para la tarjeta "Asistencia de hoy". */
export const todaySession = (summary) =>
  describeCourseSessions(summary).find((s) => s.date === summary?.today) ?? null;

/**
 * Mensaje tras fichar con `check_in_course`. Nombra el curso y la sesión si
 * la base los devuelve; si no (base antigua), el mensaje de siempre.
 */
export const checkinSuccessMessage = (data) => {
  const course = typeof data?.course_title === "string" ? data.course_title.trim() : "";
  const session = typeof data?.session_title === "string" ? data.session_title.trim() : "";
  const where = [course, session].filter(Boolean).join(" · ");
  if (data?.status === "already_checked_in") {
    return where
      ? `Ya tenías registrada tu asistencia: ${where}.`
      : "Ya tenías la asistencia de hoy registrada.";
  }
  return where ? `Asistencia registrada: ${where}.` : "Asistencia registrada. ¡Buen curso!";
};

export const SESSION_STATUS = STATUS;
