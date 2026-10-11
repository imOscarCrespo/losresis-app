import { supabase } from "../config/supabase";

/**
 * Inscripción en la app y fichaje de asistencia a cursos (enrollment_mode
 * 'in_app'). Todo pasa por RPC: las tablas no se escriben desde el cliente.
 */

// Las RPC lanzan un código legible en el mensaje; aquí se traduce.
const ERROR_MESSAGES = {
  not_authenticated: "Necesitas haber iniciado sesión.",
  course_not_found: "No hemos encontrado este curso.",
  course_not_open: "Este curso no admite inscripción en la app.",
  course_finished: "Este curso ya ha terminado.",
  course_full: "El curso está completo.",
  cancel_not_allowed: "El curso ya ha empezado y no se puede cancelar la inscripción.",
  not_enrolled: "No estás inscrito en este curso.",
  no_session_today: "Hoy no hay sesión de este curso.",
  checkin_closed: "El fichaje aún no está abierto.",
  invalid_code: "Código incorrecto o caducado.",
};

const DEFAULT_ERROR = "Algo ha fallado. Inténtalo de nuevo.";

export const translateCourseEnrollmentError = (error) => {
  const code = typeof error === "string" ? error : error?.message;
  return ERROR_MESSAGES[code] || DEFAULT_ERROR;
};

const callRpc = async (name, params) => {
  try {
    const { data, error } = await supabase.rpc(name, params);
    if (error) {
      return {
        success: false,
        data: null,
        error: translateCourseEnrollmentError(error),
        errorCode: error.message,
      };
    }
    return { success: true, data, error: null, errorCode: null };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: DEFAULT_ERROR,
      errorCode: error?.message ?? null,
    };
  }
};

/**
 * { enrollment_mode, status, seats_available, enrolled_count, is_enrolled,
 *   is_full, is_finished, can_cancel, attended_dates[], session_dates[], today,
 *   is_session_today, checkin_open_now }
 */
export const getCourseEnrollmentSummary = (courseId) =>
  callRpc("get_course_enrollment_summary", { p_course_id: courseId });

/** data.status: 'enrolled' | 'already_enrolled' */
export const enrollInCourse = (courseId) =>
  callRpc("enroll_in_course", { p_course_id: courseId });

export const cancelCourseEnrollment = (courseId) =>
  callRpc("cancel_course_enrollment", { p_course_id: courseId });

/** data.status: 'checked_in' | 'already_checked_in' */
export const checkInCourse = (courseId, code) =>
  callRpc("check_in_course", {
    p_course_id: courseId,
    p_code: String(code ?? "").replace(/\D/g, ""),
  });

export default {
  getCourseEnrollmentSummary,
  enrollInCourse,
  cancelCourseEnrollment,
  checkInCourse,
  translateCourseEnrollmentError,
};
