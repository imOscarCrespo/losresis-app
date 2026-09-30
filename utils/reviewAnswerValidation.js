// Validación previa de las respuestas de texto obligatorias de la reseña de
// hospital. Misma regla que el trigger `enforce_meaningful_review_answer_text`
// (losresis-db/20260930120000_review_answer_meaningful_text.sql): si se cambia
// aquí, hay que cambiarla allí.

const STRENGTHS_QUESTION_ID = "f16aae2c-d61e-4cc2-b5f0-f7c7fb10f9fe";
const STRENGTHS_MIN_LENGTH = 10;

const FILLER_ANSWERS = new Set([
  "nada",
  "nose",
  "nosé",
  "nolose",
  "nolosé",
  "ns",
  "nc",
  "nsnc",
  "na",
  "asdf",
  "test",
  "prueba",
  "xd",
  "ok",
  "idk",
]);

const EXAMPLES_BY_QUESTION_ID = {
  "330daeec-8e78-42cb-a159-e18418d25bae": "4-5 al mes, con adjunto de presencia",
  "d2591ea4-9eed-4e3c-9083-eda6a49842c8": "Sí, todas, también las del sábado",
  "61b905d4-1a4f-4a75-9003-3ccf74797880": "De 8 a 15h",
  [STRENGTHS_QUESTION_ID]: "Buen ambiente, poca investigación",
};

const toCore = (value) =>
  value.toLowerCase().replace(/[^0-9a-zà-öø-ÿ]/g, "");

/**
 * Devuelve el mensaje a mostrar bajo la pregunta si la respuesta no vale, o
 * null si es válida. Sólo valida preguntas de texto obligatorias.
 */
export const getReviewTextAnswerProblem = (question, value) => {
  if (!question || question.type !== "text" || question.is_optional) return null;

  const trimmed = (value || "").trim();
  if (!trimmed) return "Esta pregunta es obligatoria.";

  const example = EXAMPLES_BY_QUESTION_ID[question.id];
  const exampleHint = example ? ` Por ejemplo: «${example}».` : "";

  const core = toCore(trimmed);
  const isFiller =
    core.length < 2 || /^(.)\1*$/.test(core) || FILLER_ANSWERS.has(core);
  if (isFiller) {
    return `Esto no nos sirve como respuesta. Cuéntanos cómo es en tu servicio, con un par de palabras basta.${exampleHint}`;
  }

  if (question.id === STRENGTHS_QUESTION_ID && trimmed.length < STRENGTHS_MIN_LENGTH) {
    return `Cuéntanos un poco más: al menos un punto fuerte o uno débil.${exampleHint}`;
  }

  return null;
};

/**
 * true si la reseña tiene una respuesta válida para cada pregunta de texto
 * obligatoria. `answers` son filas de review_answer ({question_id, text_value}).
 */
export const hasMeaningfulRequiredTextAnswers = (questions, answers) => {
  const textByQuestionId = new Map(
    (answers || []).map((answer) => [answer.question_id, answer.text_value])
  );
  return (questions || [])
    .filter((question) => question.type === "text" && !question.is_optional)
    .every(
      (question) =>
        getReviewTextAnswerProblem(question, textByQuestionId.get(question.id)) === null
    );
};
