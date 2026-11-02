/**
 * Progreso de asistencia del residente en un curso con inscripción en la app
 * (ClickUp 124b4z9vn8w). Los números salen de `get_course_enrollment_summary`,
 * que los calcula en la base con `course_attendance_status`: aquí solo se
 * decide qué se enseña.
 *
 * Devuelve null si no hay nada que enseñar (curso externo o no inscrito).
 */
export const describeCourseAttendance = (summary) => {
  if (!summary || summary.enrollment_mode !== "in_app" || !summary.is_enrolled) {
    return null;
  }
  const sessions = Array.isArray(summary.session_dates) ? summary.session_dates.length : 0;
  if (sessions === 0) return null;

  const percent = Number.isFinite(summary.attendance_percent) ? summary.attendance_percent : 0;
  const minPercent = Number.isFinite(summary.min_attendance_percent)
    ? summary.min_attendance_percent
    : null;

  if (minPercent == null) {
    return { percent, minPercent: null, meets: true, tone: "neutral", message: null };
  }

  const meets = summary.meets_min_attendance === true;
  let message;
  if (meets) {
    message = "Cumples la asistencia mínima para obtener el certificado.";
  } else if (summary.is_finished) {
    message = `Has asistido al ${percent} % de las sesiones. Para obtener el certificado necesitas un ${minPercent} %.`;
  } else {
    message = `Para obtener el certificado necesitas asistir al ${minPercent} % de las sesiones.`;
  }

  return {
    percent,
    minPercent,
    meets,
    tone: meets ? "success" : summary.is_finished ? "danger" : "neutral",
    message,
  };
};
