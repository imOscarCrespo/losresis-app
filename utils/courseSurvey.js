import { formatDateOnly } from "./dateUtils";

/**
 * Encuesta de satisfacción y certificado de asistencia de un curso con
 * inscripción en la app (ClickUp 124b4z9vjxf y 124b4z9vn8w). Todo sale de
 * `get_course_enrollment_summary`; la base decide si la encuesta está abierta
 * (y lo vuelve a comprobar al enviarla con `submit_course_survey`). Aquí solo
 * se decide qué se enseña.
 */

export const SURVEY_RATING_QUESTIONS = [
  { key: "overall_rating", label: "Valoración general del curso" },
  { key: "content_rating", label: "Contenido" },
  { key: "speakers_rating", label: "Ponentes" },
  { key: "organization_rating", label: "Organización" },
];

export const SURVEY_COMMENTS_MAX_LENGTH = 2000;

/**
 * Estado del bloque «Encuesta y certificado» del detalle del curso:
 *   - null: no hay nada que enseñar (curso externo, no inscrito, sin días, o
 *     una base anterior a la encuesta).
 *   - { kind: "certificate", certificate }: ya hizo la encuesta.
 *   - { kind: "pending", message }: el curso aún no ha llegado al último día.
 *   - { kind: "locked", message }: no cumple la asistencia mínima o, sin
 *     mínimo, no ha ido a ninguna sesión.
 *   - { kind: "available" }: puede hacer la encuesta.
 */
export const describeCourseSurvey = (summary) => {
  if (!summary || summary.enrollment_mode !== "in_app" || !summary.is_enrolled) {
    return null;
  }
  if (!("survey_available" in summary)) return null;

  if (summary.survey_submitted && summary.certificate) {
    return { kind: "certificate", certificate: summary.certificate };
  }
  if (!summary.survey_opens_on) return null;

  if (summary.survey_available) return { kind: "available" };

  if (summary.today && summary.today < summary.survey_opens_on) {
    return {
      kind: "pending",
      message: `La encuesta se abrirá el ${formatDateOnly(
        summary.survey_opens_on
      )}, el último día del curso. Al completarla obtendrás tu certificado de asistencia.`,
    };
  }

  if (summary.meets_min_attendance === false) {
    const percent = Number.isFinite(summary.attendance_percent) ? summary.attendance_percent : 0;
    return {
      kind: "locked",
      message: `Has asistido al ${percent} % de las sesiones. Para obtener el certificado necesitas un ${summary.min_attendance_percent} %.`,
    };
  }

  // Sin mínimo también hace falta haber ido a alguna sesión.
  if (summary.attended_count === 0) {
    return {
      kind: "locked",
      message:
        "No tienes ninguna sesión registrada. Para obtener el certificado tienes que haber asistido al menos a una.",
    };
  }

  return null;
};

// ---------------------------------------------------------------------------
// Preguntas de la encuesta (petición del Hospital de Manresa, 2026-11-13).
//
// Cada organización puede tener su plantilla; el resumen de inscripción trae
// las preguntas efectivas del curso en `summary.survey_questions`:
//   { id, type: 'rating' | 'yes_no' | 'text', label, required }
// y se envían con `submit_course_survey_answers` como `{ [id]: valor }`.
// Con una base anterior (sin `survey_questions`) se usa la encuesta fija de
// siempre y la RPC antigua `submit_course_survey`.
// ---------------------------------------------------------------------------

export const SURVEY_QUESTION_TYPES = ["rating", "yes_no", "text"];

/** La plantilla de LosResis: igual que `course_survey_default_questions()` en la base. */
export const DEFAULT_SURVEY_QUESTIONS = [
  ...SURVEY_RATING_QUESTIONS.map(({ key, label }) => ({
    id: key,
    type: "rating",
    label,
    required: true,
  })),
  { id: "would_recommend", type: "yes_no", label: "¿Recomendarías este curso?", required: true },
  { id: "comments", type: "text", label: "Comentarios", required: false },
];

const normalizeQuestion = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!id || !label || !SURVEY_QUESTION_TYPES.includes(raw.type)) return null;
  return { id, type: raw.type, label, required: raw.required === true };
};

/**
 * Formulario de la encuesta de un curso:
 *   - { questions, dynamic: true } si la base manda `survey_questions`.
 *   - { questions: DEFAULT_SURVEY_QUESTIONS, dynamic: false } si no (base
 *     anterior): se envía con la RPC antigua.
 * Las preguntas de un tipo que esta versión no conoce se saltan.
 */
export const surveyFormFor = (summary) => {
  const raw = summary?.survey_questions;
  if (!Array.isArray(raw)) {
    return { questions: DEFAULT_SURVEY_QUESTIONS, dynamic: false };
  }
  const seen = new Set();
  const questions = raw.map(normalizeQuestion).filter((question) => {
    if (!question || seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
  return { questions, dynamic: true };
};

/** Respuestas vacías del formulario: null en valoración y sí/no, "" en texto. */
export const emptySurveyAnswers = (questions = DEFAULT_SURVEY_QUESTIONS) =>
  Object.fromEntries(
    (questions || []).map((question) => [question.id, question.type === "text" ? "" : null])
  );

const isAnswered = (question, value) => {
  switch (question.type) {
    case "rating":
      return Number.isInteger(value) && value >= 1 && value <= 5;
    case "yes_no":
      return typeof value === "boolean";
    case "text":
      return typeof value === "string" && value.trim() !== "";
    default:
      return false;
  }
};

/** El formulario se puede enviar cuando todas las preguntas obligatorias tienen respuesta. */
export const isSurveyComplete = (answers, questions = DEFAULT_SURVEY_QUESTIONS) =>
  (questions || []).every(
    (question) => !question.required || isAnswered(question, answers?.[question.id])
  );

/**
 * `p_answers` de `submit_course_survey_answers`: `{ [id]: valor }` solo con lo
 * respondido (las opcionales en blanco no van) y el texto recortado.
 */
export const buildSurveyAnswersPayload = (answers, questions = DEFAULT_SURVEY_QUESTIONS) => {
  const payload = {};
  (questions || []).forEach((question) => {
    const value = answers?.[question.id];
    if (!isAnswered(question, value)) return;
    payload[question.id] =
      question.type === "text" ? value.trim().slice(0, SURVEY_COMMENTS_MAX_LENGTH) : value;
  });
  return payload;
};
