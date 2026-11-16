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
  course_restricted: "Este curso está reservado a los residentes del hospital que lo organiza.",
  cancel_not_allowed: "El curso ya ha empezado y no se puede cancelar la inscripción.",
  not_enrolled: "No estás inscrito en este curso.",
  no_session_today: "Hoy no hay sesión de este curso.",
  checkin_closed: "El fichaje aún no está abierto.",
  invalid_code: "Código incorrecto o caducado.",
  survey_not_open_yet: "La encuesta se abre el último día del curso.",
  min_attendance_not_met:
    "No llegas a la asistencia mínima del curso, así que no puedes hacer la encuesta ni obtener el certificado.",
  invalid_survey_answer: "Responde a todas las preguntas de la encuesta.",
  invalid_answers:
    "Alguna respuesta no es válida o falta una pregunta obligatoria. Revisa la encuesta e inténtalo de nuevo.",
  app_update_required: "Actualiza la app para poder responder a la encuesta de este curso.",
  no_attendance:
    "No tienes ninguna sesión registrada en este curso, así que no puedes obtener el certificado.",
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
 *   is_full, is_finished, can_cancel, attended_dates[], session_dates[],
 *   sessions[] ({ id, session_date, title, starts_at, ends_at, location }),
 *   attended_session_ids[], open_session_ids[], today, is_session_today,
 *   checkin_open_now, attendance_percent, attended_count, ...,
 *   survey_opens_on, survey_available, survey_submitted, certificate }
 *
 * Desde 2026-11-16 un día puede tener varias sesiones (franjas con su QR):
 * `sessions` trae una entrada por sesión con su `id` (uuid), ordenadas por día
 * y hora de inicio ("HH:MM" o null), y dos pueden compartir `session_date`.
 * `attended_session_ids` son las sesiones a las que asistió el usuario y
 * `open_session_ids` las de hoy con el fichaje abierto. `attended_dates` y
 * `session_dates` siguen siendo días sin repetir; `attended_count` y
 * `attendance_percent` cuentan sesiones. Una base anterior no trae `id` ni
 * las listas por sesión (ver utils/courseSessions).
 */
export const getCourseEnrollmentSummary = (courseId) =>
  callRpc("get_course_enrollment_summary", { p_course_id: courseId });

/**
 * data.status: 'enrolled' | 'already_enrolled'. Puede fallar con
 * `course_restricted` (curso reservado a los residentes del hospital que lo
 * organiza; la RLS ya suele ocultarlo).
 */
export const enrollInCourse = (courseId) =>
  callRpc("enroll_in_course", { p_course_id: courseId });

export const cancelCourseEnrollment = (courseId) =>
  callRpc("cancel_course_enrollment", { p_course_id: courseId });

/**
 * data: { status: 'checked_in' | 'already_checked_in', session_date,
 *   session_id, session_starts_at, session_ends_at ("HH:MM" o null),
 *   course_title, session_title }. La base busca entre las sesiones de hoy
 * con el fichaje abierto la que corresponde al código.
 */
export const checkInCourse = (courseId, code) =>
  callRpc("check_in_course", {
    p_course_id: courseId,
    p_code: String(code ?? "").replace(/\D/g, ""),
  });

/**
 * Envía la encuesta de satisfacción y emite el certificado (ClickUp
 * 124b4z9vjxf). La base comprueba la asistencia mínima.
 * data: { status: 'submitted' | 'already_submitted', certificate: { code,
 *   issued_at, course_title, attended_count, session_count } }
 */
export const submitCourseSurvey = (courseId, answers) =>
  callRpc("submit_course_survey", {
    p_course_id: courseId,
    p_overall_rating: answers?.overall_rating ?? null,
    p_content_rating: answers?.content_rating ?? null,
    p_speakers_rating: answers?.speakers_rating ?? null,
    p_organization_rating: answers?.organization_rating ?? null,
    p_would_recommend: typeof answers?.would_recommend === "boolean" ? answers.would_recommend : null,
    p_comments: String(answers?.comments ?? "").trim() || null,
  });

/**
 * Encuesta con las preguntas del curso (`summary.survey_questions`, petición
 * del Hospital de Manresa 2026-11-13). `answers` es `{ [id]: valor }` (ver
 * `buildSurveyAnswersPayload` en utils/courseSurvey). Mismo `data` que
 * `submitCourseSurvey`; la base valida contra las preguntas efectivas del
 * curso (`invalid_answers`).
 */
export const submitCourseSurveyAnswers = (courseId, answers) =>
  callRpc("submit_course_survey_answers", {
    p_course_id: courseId,
    p_answers: answers && typeof answers === "object" ? answers : {},
  });

export default {
  getCourseEnrollmentSummary,
  submitCourseSurvey,
  submitCourseSurveyAnswers,
  enrollInCourse,
  cancelCourseEnrollment,
  checkInCourse,
  translateCourseEnrollmentError,
};
