// Reseña rápida de rotaciones externas (Trello #110): pasos, catálogos cerrados de
// respuestas, validación por paso e invitación a compartir al terminar un plan.
// Las fechas llegan como "YYYY-MM-DD", así que se comparan como texto.

import { normalizeSearchText } from "./filterUtils";

export const RECOMMENDATION_OPTIONS = [
  { id: "yes", label: "Sí" },
  { id: "depends", label: "Depende" },
  { id: "no", label: "No" },
];

export const DIFFICULTY_OPTIONS = [
  { id: "easy", label: "Fácil" },
  { id: "medium", label: "Normal" },
  { id: "hard", label: "Difícil" },
];

export const ROTATION_KIND_OPTIONS = [
  { id: "observational", label: "Observacional" },
  { id: "hands_on", label: "Participativa" },
];

// Espeja el CHECK external_rotation_review_highlight_tags_check de losresis-db: una etiqueta
// nueva necesita migración antes de poder guardarse.
export const HIGHLIGHT_TAGS = [
  { id: "learned_a_lot", label: "Aprendí muchísimo" },
  { id: "good_atmosphere", label: "Buen ambiente" },
  { id: "lots_of_practice", label: "Mucha práctica" },
  { id: "good_supervision", label: "Buena supervisión" },
  { id: "hard_to_get", label: "Difícil de conseguir" },
  { id: "heavy_bureaucracy", label: "Mucha burocracia" },
  { id: "recommended_international", label: "Experiencia internacional recomendable" },
  { id: "high_cost_of_living", label: "Coste de vida elevado" },
];

const labelsById = (options) =>
  options.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {});

export const RECOMMENDATION_LABELS = labelsById(RECOMMENDATION_OPTIONS);
export const DIFFICULTY_LABELS = labelsById(DIFFICULTY_OPTIONS);
export const ROTATION_KIND_LABELS = labelsById(ROTATION_KIND_OPTIONS);
export const HIGHLIGHT_TAG_LABELS = labelsById(HIGHLIGHT_TAGS);

export const QUICK_REVIEW_STEPS = [
  { key: "where", title: "¿Dónde hiciste la rotación?" },
  { key: "how", title: "¿Cómo fue?" },
  { key: "highlights", title: "¿Qué destacarías?" },
  { key: "advice", title: "Un consejo para el siguiente residente" },
];

// Campos de la reseña completa: si alguno tiene contenido, la reseña está «ampliada».
// El contacto no cuenta: tiene su propia tarjeta al principio del paso 4.
const EXTENDED_FIELDS = [
  "highlightSummary",
  "difficultyNotes",
  "accommodationNotes",
  "costNotes",
];

const trimText = (value) => String(value || "").trim();

/** El enlace de solicitud se guarda siempre con protocolo: "hospital.es/x" → "https://hospital.es/x". */
export const normalizeContactUrl = (value) => {
  const url = trimText(value);
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

// Contacto en texto libre (ClickUp 86cbm0vbf), guardado en tutor_name: las apps publicadas ya
// lo leen y lo editan. Correo, teléfono y enlace sueltos son de la 1.0.92 (86cbm0fbc) y solo
// quedan en reseñas antiguas.
const LEGACY_CONTACT_FIELDS = [
  ["tutorName", "tutor_name"],
  ["tutorEmail", "tutor_email"],
  ["contactPhone", "contact_phone"],
  ["contactUrl", "contact_url"],
];

/** Texto de contacto de una reseña: el de siempre más el correo, teléfono o enlace antiguos. */
export const contactTextFromReview = (review) =>
  LEGACY_CONTACT_FIELDS.map(([, column]) => trimText(review?.[column]))
    .filter(Boolean)
    .join(" · ");

/** ¿Tiene la reseña algún dato de contacto? Sirve para el formulario y para filas de BD. */
export const hasReviewContact = (source) =>
  LEGACY_CONTACT_FIELDS.some(([field, column]) =>
    trimText(source?.[field] ?? source?.[column])
  );

const STEP_REQUIRED_FIELDS = {
  where: [
    ["hospitalName", "hospital"],
    ["country", "país"],
    ["city", "ciudad"],
    ["startDate", "fecha de inicio"],
  ],
  how: [
    ["recommendation", "si la recomiendas"],
    ["difficulty", "si fue fácil conseguirla"],
    ["rotationKind", "tipo de rotación"],
  ],
};

export const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const joinLabels = (labels) =>
  labels.length > 1
    ? `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`
    : labels[0];

/** Devuelve el problema del paso como { title, message }, o null si se puede avanzar. */
export const validateQuickReviewStep = (stepKey, form, today = new Date()) => {
  const missing = (STEP_REQUIRED_FIELDS[stepKey] || [])
    .filter(([field]) => !String(form?.[field] || "").trim())
    .map(([, label]) => label);

  if (missing.length) {
    const text = joinLabels(missing);
    return {
      title: "Faltan campos obligatorios",
      message: `Completa: ${text.charAt(0).toUpperCase()}${text.slice(1)}.`,
    };
  }

  if (stepKey === "where") {
    if (form.startDate > toDateKey(today)) {
      return {
        title: "Revisa las fechas",
        message:
          "La fecha de inicio no puede ser posterior a hoy: cuenta una rotación que ya hayas empezado.",
      };
    }
    if (form.endDate && form.endDate < form.startDate) {
      return {
        title: "Revisa las fechas",
        message: "La fecha de fin no puede ser anterior a la de inicio.",
      };
    }
  }

  return null;
};

/**
 * Valida todos los pasos. Devuelve { stepIndex, title, message } del primer paso con
 * problema, o null si se puede publicar.
 */
export const validateQuickReview = (form, today = new Date()) => {
  for (let stepIndex = 0; stepIndex < QUICK_REVIEW_STEPS.length; stepIndex += 1) {
    const problem = validateQuickReviewStep(QUICK_REVIEW_STEPS[stepIndex].key, form, today);
    if (problem) return { stepIndex, ...problem };
  }
  return null;
};

/** Solo etiquetas del catálogo y sin repetir, en el orden del catálogo. */
export const sanitizeHighlightTags = (tags) => {
  const selected = new Set(Array.isArray(tags) ? tags : []);
  return HIGHLIGHT_TAGS.map((tag) => tag.id).filter((id) => selected.has(id));
};

export const toggleHighlightTag = (tags, tagId) => {
  const current = sanitizeHighlightTags(tags);
  return current.includes(tagId)
    ? current.filter((id) => id !== tagId)
    : sanitizeHighlightTags([...current, tagId]);
};

export const hasExtendedDetails = (form) =>
  EXTENDED_FIELDS.some((field) => String(form?.[field] || "").trim());

const normalizeCenterName = (value) =>
  normalizeSearchText(value)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// El hospital es texto libre: "Hospital Clínic" y "Hospital Clinic de Barcelona" son el mismo
// centro. Solo aceptamos inclusión cuando el nombre corto tiene al menos dos palabras, para que
// "Hospital" a secas no coincida con cualquier centro.
export const isSameCenterName = (left, right) => {
  const a = normalizeCenterName(left);
  const b = normalizeCenterName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.split(" ").length >= 2 && ` ${longer} `.includes(` ${shorter} `);
};

const datesOverlap = (startA, endA, startB, endB) =>
  Boolean(startA && startB) && startA <= (endB || startB) && startB <= (endA || startA);

// Una reseña ya cubre el plan si está enlazada a él, o si es del mismo centro y ciudad con
// fechas solapadas (reseñas publicadas sin pasar por la invitación).
const reviewCoversPlan = (review, plan) =>
  review.rotation_id === plan.id ||
  (normalizeSearchText(review.city) === normalizeSearchText(plan.city) &&
    isSameCenterName(review.external_hospital_name, plan.hospital_name) &&
    datesOverlap(review.start_date, review.end_date, plan.start_date, plan.end_date));

/**
 * Planes propios ya terminados para los que invitar a compartir la experiencia: con fecha de
 * fin anterior a hoy, sin respuesta a la invitación y sin reseña propia que los cubra.
 * Un plan sin fecha de fin nunca se da por terminado.
 */
export const getPendingReviewInvites = (plans, ownReviews, today = new Date()) => {
  const todayKey = toDateKey(today);
  const reviews = ownReviews || [];

  return (plans || [])
    .filter(
      (plan) =>
        plan?.end_date &&
        plan.end_date < todayKey &&
        !plan.review_invite_response &&
        !reviews.some((review) => reviewCoversPlan(review, plan))
    )
    .sort((a, b) => (a.end_date < b.end_date ? 1 : -1));
};

/** Datos del plan con los que se rellena el paso 1 de la reseña. */
export const quickReviewFieldsFromPlan = (plan) => ({
  rotationId: plan.id,
  hospitalName: plan.hospital_name || "",
  serviceName: plan.service_name || "",
  specialityId: plan.speciality_id || "",
  country: plan.country || "",
  city: plan.city || "",
  startDate: plan.start_date || "",
  endDate: plan.end_date || "",
});
