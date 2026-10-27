/**
 * «Preparación de mi tutoría»: lo que el residente prepara antes de cada tutoría.
 *
 * Vive en hospital_tutoring_preparation (no en resident_answers, que la app
 * publicada reescribe entero). Es un borrador privado hasta que lo envía; desde
 * entonces su tutor ve siempre la última versión, y no vuelve a borrador.
 *
 * Las claves las valida la RPC save_hospital_tutoring_preparation (losresis-db) y
 * las etiquetas están duplicadas en lib/tutoringPreparation.ts del panel: si
 * cambia una pregunta, cambia en los tres sitios.
 */

export const PREPARATION_SECTIONS = [
  {
    key: "A",
    title: "Evolución formativa",
    questions: [
      {
        key: "learnings",
        label: "¿Cuáles han sido tus principales aprendizajes durante este período?",
      },
      {
        key: "goals_achieved",
        label: "¿Qué objetivos formativos consideras que has alcanzado?",
      },
      { key: "improved", label: "¿En qué aspectos consideras que has mejorado?" },
    ],
  },
  {
    key: "B",
    title: "Rotaciones realizadas",
    questions: [
      {
        key: "rotations",
        label: "¿Cómo valorarías las rotaciones realizadas durante este período?",
      },
      { key: "difficulties", label: "¿Qué dificultades has encontrado?" },
      {
        key: "competencies_to_reinforce",
        label: "¿Qué competencias te gustaría reforzar?",
      },
    ],
  },
  {
    key: "C",
    title: "Guardias y actividad asistencial",
    questions: [
      { key: "on_call", label: "¿Cómo valorarías tu evolución durante las guardias?" },
      {
        key: "autonomy_supervision",
        label: "¿Consideras adecuado tu nivel de autonomía y supervisión?",
      },
    ],
  },
  {
    key: "D",
    title: "Reflexión personal",
    questions: [
      {
        key: "needs_improvement",
        label: "¿Qué aspectos consideras que necesitas mejorar?",
      },
      {
        key: "support_needs",
        label:
          "¿Hay alguna dificultad o necesidad de apoyo que quieras comentar con tu tutor?",
      },
    ],
  },
];

export const PROPOSED_GOALS_SECTION = {
  key: "E",
  title: "Objetivos para el siguiente período",
  label: "¿Qué objetivos te gustaría plantearte hasta la próxima tutoría?",
};

export const PREPARATION_KEYS = PREPARATION_SECTIONS.flatMap((section) =>
  section.questions.map((question) => question.key)
);

export const PREPARATION_STATUS = {
  NONE: "none",
  DRAFT: "draft",
  SENT: "sent",
};

/** Sin iniciar / borrador / enviada. Un borrador sin nada escrito no cuenta. */
export const preparationStatusOf = (preparation) => {
  if (!preparation) return PREPARATION_STATUS.NONE;
  if (preparation.status === "sent") return PREPARATION_STATUS.SENT;
  return hasPreparationContent(preparation.answers, preparation.proposed_goals)
    ? PREPARATION_STATUS.DRAFT
    : PREPARATION_STATUS.NONE;
};

const clean = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * Lo que se envía a la RPC: solo claves conocidas, textos recortados, sin vacíos.
 * La RPC normaliza otra vez; esto es para que «Enviar» sepa si hay algo.
 */
export const buildPreparationPayload = (answers, goals) => {
  const cleanAnswers = {};
  PREPARATION_KEYS.forEach((key) => {
    const value = clean(answers?.[key]);
    if (value) cleanAnswers[key] = value;
  });

  const cleanGoals = (Array.isArray(goals) ? goals : [])
    .map(clean)
    .filter(Boolean);

  return { answers: cleanAnswers, proposedGoals: cleanGoals };
};

export const hasPreparationContent = (answers, goals) => {
  const payload = buildPreparationPayload(answers, goals);
  return (
    Object.keys(payload.answers).length > 0 || payload.proposedGoals.length > 0
  );
};

/** Solo mientras está programada: finalizada o cancelada se ve en solo lectura. */
export const canEditPreparation = (tutoring) => tutoring?.status === "scheduled";

/** Para la analítica: cuántas preguntas contestadas y cuántos objetivos. */
export const preparationCounts = (answers, goals) => {
  const payload = buildPreparationPayload(answers, goals);
  return {
    answered: Object.keys(payload.answers).length,
    goals: payload.proposedGoals.length,
  };
};
