// Las preguntas de la Autoevaluación anual, tal como llegan dentro de la solicitud.
//
// Conviven DOS formatos en la misma columna y la pantalla tiene que leer los dos:
//
//   * El snapshot tipado que congela el envío del panel (`send_self_assessment`):
//     objetos con id, tipo, opciones y escala.
//   * El array de textos de las solicitudes anteriores a las plantillas, cuyas
//     respuestas se guardaron indexadas POR EL TEXTO de la pregunta.
//
// La conversión unifica los dos en una sola forma, y para las viejas usa el propio
// texto como id: así hay un único camino de pintado y de guardado, y las respuestas
// que ya existen siguen encontrándose.

export const QUESTION_KIND = {
  SHORT_TEXT: "short_text",
  LONG_TEXT: "long_text",
  SINGLE_CHOICE: "single_choice",
  MULTI_CHOICE: "multi_choice",
  NUMERIC_SCALE: "numeric_scale",
  LIKERT: "likert",
  YES_NO: "yes_no",
};

const KINDS = new Set(Object.values(QUESTION_KIND));

/** El snapshot de una solicitud, en la forma única con la que se pinta. */
export const normalizeQuestions = (questions) => {
  if (!Array.isArray(questions)) return [];

  return questions.reduce((acc, raw, index) => {
    if (typeof raw === "string") {
      const title = raw.trim();
      if (!title) return acc;
      acc.push({
        id: raw,
        kind: QUESTION_KIND.LONG_TEXT,
        title,
        description: null,
        required: false,
        position: index,
        scale: null,
        options: [],
        legacy: true,
      });
      return acc;
    }

    if (!raw || typeof raw !== "object") return acc;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!raw.id || !title) return acc;

    acc.push({
      id: String(raw.id),
      kind: KINDS.has(raw.kind) ? raw.kind : QUESTION_KIND.LONG_TEXT,
      title,
      description:
        typeof raw.description === "string" && raw.description.trim()
          ? raw.description
          : null,
      required: raw.required === true,
      position: typeof raw.position === "number" ? raw.position : index,
      scale: raw.scale
        ? {
            min: Number(raw.scale.min ?? 1),
            max: Number(raw.scale.max ?? 10),
            minLabel: raw.scale.min_label || null,
            maxLabel: raw.scale.max_label || null,
          }
        : null,
      options: Array.isArray(raw.options)
        ? raw.options
            .filter((option) => option && option.id && option.label)
            .map((option, position) => ({
              id: String(option.id),
              label: String(option.label),
              position:
                typeof option.position === "number" ? option.position : position,
            }))
        : [],
      legacy: false,
    });
    return acc;
  }, []);
};

/**
 * Qué cuenta como no respondido.
 *
 * Un "No" en un sí/no es `false` y un 0 en una escala es 0: las dos son respuestas
 * y las dos las mata un truthy. Vacío es la ausencia, el texto en blanco y la lista
 * sin nada, y nada más.
 */
export const isBlankAnswer = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

/** La respuesta de una pregunta, buscándola como se guardó. */
export const answerOf = (question, answers, index) => {
  if (!answers) return null;
  const direct = answers[question.id];
  if (!isBlankAnswer(direct)) return direct;
  // Las primerísimas solicitudes llegaron a guardarse por índice.
  if (question.legacy && index !== undefined) {
    const byIndex = answers[String(index)];
    if (!isBlankAnswer(byIndex)) return byIndex;
  }
  return direct === undefined ? null : direct;
};

/** La respuesta en texto, para la vista de solo lectura. */
export const formatAnswer = (question, value) => {
  if (isBlankAnswer(value)) return null;

  const labelOf = (id) => {
    const option = question.options.find((each) => each.id === String(id));
    return option ? option.label : String(id);
  };

  switch (question.kind) {
    case QUESTION_KIND.YES_NO:
      return value === true || String(value) === "true" ? "Sí" : "No";
    case QUESTION_KIND.NUMERIC_SCALE:
      return question.scale ? `${value} de ${question.scale.max}` : String(value);
    case QUESTION_KIND.SINGLE_CHOICE:
    case QUESTION_KIND.LIKERT:
      return labelOf(value);
    case QUESTION_KIND.MULTI_CHOICE:
      return Array.isArray(value)
        ? value.map(labelOf).join(", ")
        : labelOf(value);
    default:
      return String(value);
  }
};

/** Cuántas ha contestado ya, para el "3 de 8" de la cabecera. */
export const countAnswered = (questions, answers) =>
  questions.filter(
    (question, index) => !isBlankAnswer(answerOf(question, answers, index))
  ).length;

/**
 * Las obligatorias que faltan. La base rechaza el envío si queda alguna
 * (`submit_hospital_self_assessment`); esto es para decírselo antes y en su idioma,
 * no para sustituir esa comprobación.
 */
export const missingRequired = (questions, answers) =>
  questions.filter(
    (question, index) =>
      question.required && isBlankAnswer(answerOf(question, answers, index))
  );

/** Los números de una escala, para pintar la fila de botones. */
export const scaleSteps = (question) => {
  const min = question.scale ? question.scale.min : 1;
  const max = question.scale ? question.scale.max : 10;
  if (max <= min) return [min];
  const steps = [];
  for (let value = min; value <= max && steps.length < 21; value += 1) {
    steps.push(value);
  }
  return steps;
};
