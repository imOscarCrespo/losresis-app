/**
 * Sesiones de un curso con inscripción en la app (ClickUp 124b4z9vn8v).
 *
 * Desde 2026-11-16 (Althaia, migración losresis-db
 * 20261116130000_course_sessions_same_day) un día puede tener varias sesiones
 * en franjas distintas, cada una con su QR: `get_course_enrollment_summary`
 * devuelve una entrada de `sessions` por sesión, con `id`, y la asistencia por
 * sesión en `attended_session_ids` (y el fichaje abierto en
 * `open_session_ids`).
 *
 * Con una base anterior (ADR 0039: una sesión es un día) las entradas de
 * `sessions` no traen `id`: se enseña una fila por día de `session_dates` con
 * la asistencia de `attended_dates`, como antes. Sin `sessions` (base aún más
 * antigua) solo salen las fechas.
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

const statusFor = (date, today, attended) => {
  if (attended) return STATUS.attended;
  if (today && date >= today) return STATUS.pending;
  return STATUS.missed;
};

const textOrNull = (value) => (typeof value === "string" && value.trim()) || null;

const sessionEntries = (summary) =>
  (Array.isArray(summary?.sessions) ? summary.sessions : []).filter((s) => s && s.session_date);

// Base nueva: todas las sesiones llevan `id`.
const hasSessionIds = (entries) => entries.length > 0 && entries.every((s) => Boolean(s.id));

const idSet = (value) => new Set(Array.isArray(value) ? value : []);

// Orden de la base: día y hora de inicio (sin hora, primero).
const bySessionOrder = (a, b) => {
  if (a.session_date !== b.session_date) return a.session_date < b.session_date ? -1 : 1;
  const sa = hourMinute(a.starts_at);
  const sb = hourMinute(b.starts_at);
  if (sa === sb) return 0;
  if (!sa) return -1;
  if (!sb) return 1;
  return sa < sb ? -1 : 1;
};

const describeBySession = (summary, entries) => {
  const attended = idSet(summary?.attended_session_ids);
  const open = idSet(summary?.open_session_ids);
  return [...entries].sort(bySessionOrder).map((data, index) => ({
    id: data.id,
    date: data.session_date,
    label: sessionLabel(data.title, index),
    time: formatSessionTime(data.starts_at, data.ends_at),
    location: textOrNull(data.location),
    status: statusFor(data.session_date, summary?.today, attended.has(data.id)),
    checkinOpen: open.has(data.id),
  }));
};

// Base anterior: una fila por día.
const describeByDay = (summary, entries) => {
  const dates = Array.isArray(summary?.session_dates) ? summary.session_dates : [];
  const byDate = new Map(entries.map((s) => [s.session_date, s]));
  const attended = new Set(Array.isArray(summary?.attended_dates) ? summary.attended_dates : []);
  const today = summary?.today;
  return [...dates].sort().map((date, index) => {
    const data = byDate.get(date) ?? {};
    return {
      id: null,
      date,
      label: sessionLabel(data.title, index),
      time: formatSessionTime(data.starts_at, data.ends_at),
      location: textOrNull(data.location),
      status: statusFor(date, today, attended.has(date)),
      checkinOpen: Boolean(today && date === today && summary?.checkin_open_now),
    };
  });
};

/**
 * Filas de "Tus sesiones": una por sesión (o por día con una base anterior),
 * en orden, con `id` (null en base anterior), fecha, nombre, horario, lugar,
 * estado (attended | pending | missed) y si su fichaje está abierto ahora.
 * [] si no hay resumen o no hay sesiones.
 */
export const describeCourseSessions = (summary) => {
  const entries = sessionEntries(summary);
  return hasSessionIds(entries)
    ? describeBySession(summary, entries)
    : describeByDay(summary, entries);
};

/**
 * Sesiones de hoy (puede haber varias), para la tarjeta "Asistencia de hoy".
 * [] si hoy no hay sesión.
 */
export const todaySessions = (summary) =>
  summary?.today ? describeCourseSessions(summary).filter((s) => s.date === summary.today) : [];

/**
 * Mensaje tras fichar con `check_in_course`. Nombra el curso y la sesión (su
 * nombre o, sin nombre, su horario) si la base los devuelve; si no (base
 * antigua), el mensaje de siempre.
 */
export const checkinSuccessMessage = (data) => {
  const course = typeof data?.course_title === "string" ? data.course_title.trim() : "";
  const session =
    textOrNull(data?.session_title) ||
    formatSessionTime(data?.session_starts_at, data?.session_ends_at);
  const where = [course, session].filter(Boolean).join(" · ");
  if (data?.status === "already_checked_in") {
    return where
      ? `Ya tenías registrada tu asistencia: ${where}.`
      : "Ya tenías la asistencia de hoy registrada.";
  }
  return where ? `Asistencia registrada: ${where}.` : "Asistencia registrada. ¡Buen curso!";
};

export const SESSION_STATUS = STATUS;
