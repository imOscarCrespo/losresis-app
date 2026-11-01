// Puente entre la Agenda y la ficha del curso.
//
// Un día de curso con inscripción es una copia que la base crea en la agenda del
// residente (sync_course_enrollment_agenda) y lleva el curso en
// `metadata.course_id`. Pulsarlo abre la ficha: es el único sitio donde se
// gestiona el curso.

/**
 * Id del curso al que lleva un evento de la Agenda, o null si el evento no es
 * un día de curso propio con inscripción (un curso apuntado a mano no lleva
 * course_enrollment_id y se sigue editando como cualquier evento).
 */
export const getAgendaEventCourseId = (event, userId) => {
  if (!event || event.event_type !== "course") return null;
  if (userId && event.user_id && event.user_id !== userId) return null;

  const metadata = event.metadata || {};
  if (!metadata.course_enrollment_id) return null;

  const courseId = metadata.course_id;
  return typeof courseId === "string" && courseId.trim() ? courseId : null;
};

// Errores de PostgREST que quieren decir que el curso no existe o el residente
// ya no lo ve: `.single()` sin filas (PGRST116) o un id que no es uuid (22P02).
const UNAVAILABLE_CODES = new Set(["PGRST116", "22P02"]);

/**
 * Qué decirle al residente cuando la ficha no carga: "unavailable" si el curso
 * ya no está (borrado u oculto por RLS) y "failed" para lo demás (sin conexión,
 * error del servidor), que se puede reintentar.
 */
export const classifyCourseLoadError = (error) =>
  UNAVAILABLE_CODES.has(error?.code) ? "unavailable" : "failed";
