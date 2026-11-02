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
 *   - { kind: "locked", message }: no cumple la asistencia mínima.
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

  return null;
};

/** Respuestas vacías del formulario. */
export const emptySurveyAnswers = () => ({
  overall_rating: null,
  content_rating: null,
  speakers_rating: null,
  organization_rating: null,
  would_recommend: null,
  comments: "",
});

/** El formulario se puede enviar cuando todas las preguntas obligatorias tienen respuesta. */
export const isSurveyComplete = (answers) =>
  SURVEY_RATING_QUESTIONS.every((question) => {
    const value = answers?.[question.key];
    return Number.isInteger(value) && value >= 1 && value <= 5;
  }) && typeof answers?.would_recommend === "boolean";
