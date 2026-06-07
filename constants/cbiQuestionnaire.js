/**
 * Cuestionario CBI (Copenhagen Burnout Inventory) — base de la Evaluación de bienestar.
 *
 * ⚠️ TEXTO PROVISIONAL: las preguntas de abajo son una traducción de trabajo, NO la
 * versión española validada del CBI (estudio PMID 23775105). Antes de lanzar hay que
 * sustituir el `text` de cada ítem por el texto exacto validado. La estructura (dominios,
 * escala, puntuación) sí es definitiva. Ver docs/adr/0001-cbi-no-clinico-para-salud-mental.md.
 *
 * Tres dominios: personal (6 ítems), laboral (7) y por pacientes (6) = 19 ítems.
 * El ítem `w7` está invertido (más energía = menos burnout): se puntúa 100 - valor.
 */

export const CBI_DOMAINS = {
  personal: {
    key: "personal",
    label: "Personal",
    scoreField: "personal_score",
    description: "Tu nivel de agotamiento físico y emocional general.",
  },
  work: {
    key: "work",
    label: "Laboral",
    scoreField: "work_score",
    description: "El desgaste relacionado con tu trabajo.",
  },
  patient: {
    key: "patient",
    label: "Con pacientes",
    scoreField: "patient_score",
    description: "El desgaste relacionado con la atención a pacientes.",
  },
};

/** Opciones de respuesta comunes a todos los ítems. Valor en escala 0-100. */
export const CBI_OPTIONS = [
  { label: "Nunca", value: 0 },
  { label: "Casi nunca", value: 25 },
  { label: "A veces", value: 50 },
  { label: "Casi siempre", value: 75 },
  { label: "Siempre", value: 100 },
];

/** Ítems cuya puntuación se invierte (100 - valor) antes de promediar. */
export const CBI_REVERSED_ITEM_IDS = ["w7"];

export const CBI_QUESTIONS = [
  // Burnout personal (6)
  { id: "p1", domain: "personal", text: "¿Con qué frecuencia te sientes agotado/a?" },
  { id: "p2", domain: "personal", text: "¿Con qué frecuencia te sientes físicamente exhausto/a?" },
  { id: "p3", domain: "personal", text: "¿Con qué frecuencia te sientes emocionalmente exhausto/a?" },
  { id: "p4", domain: "personal", text: '¿Con qué frecuencia piensas: "No aguanto más"?' },
  { id: "p5", domain: "personal", text: "¿Con qué frecuencia te sientes desgastado/a?" },
  { id: "p6", domain: "personal", text: "¿Con qué frecuencia te sientes débil y susceptible de enfermar?" },
  // Burnout laboral (7)
  { id: "w1", domain: "work", text: "¿Te cansa tu trabajo?" },
  { id: "w2", domain: "work", text: "¿Te agota trabajar todo el día?" },
  { id: "w3", domain: "work", text: "¿Sientes que tu trabajo te consume emocionalmente?" },
  { id: "w4", domain: "work", text: "¿Te sientes frustrado/a con tu trabajo?" },
  { id: "w5", domain: "work", text: "¿Te sientes al límite de tus fuerzas en el trabajo?" },
  { id: "w6", domain: "work", text: "¿Piensas que cada día de trabajo es interminable?" },
  {
    id: "w7",
    domain: "work",
    text: "¿Tienes energía suficiente para tu familia y amigos en tu tiempo libre?",
  },
  // Burnout por pacientes (6)
  { id: "pt1", domain: "patient", text: "¿Te cansa trabajar con los pacientes?" },
  { id: "pt2", domain: "patient", text: "¿Sientes que das más de lo que recibes cuando trabajas con pacientes?" },
  { id: "pt3", domain: "patient", text: "¿Estás cansado/a de trabajar con los pacientes?" },
  { id: "pt4", domain: "patient", text: "¿A veces te preguntas cuánto más podrás aguantar trabajando con pacientes?" },
  { id: "pt5", domain: "patient", text: "¿Sientes que no tienes nada más que dar a los pacientes?" },
  { id: "pt6", domain: "patient", text: "¿Tu trabajo con pacientes te resulta frustrante?" },
];

export const CBI_TOTAL_QUESTIONS = CBI_QUESTIONS.length;
