/**
 * Análisis de casos clínicos del Libro del Residente (ClickUp 124b4z9vc4y).
 *
 * El hospital define en la plantilla del panel, por año, los casos que tiene que
 * analizar el residente («Mi portafolio»; Sant Pau, Medicina Intensiva R1: EPOC,
 * ictus isquémico y fracaso renal agudo). Además, el residente registra los que
 * quiera («Mis casos clínicos»). Las fichas viven en `libro_clinical_case`
 * (losresis-db 20261028160000): `requirement_id` null es un caso libre, y
 * vincular uno libre a un requisito es ponerle su `requirement_id`.
 *
 * Estados: "Pendiente" es un requisito sin ficha; la ficha es `draft` («En
 * progreso») o `completed`. Completar exige la ficha entera salvo servicio y
 * rotación; la base lo comprueba igual (CHECK libro_clinical_case_completed_fields).
 *
 * Revisión del tutor (fase 2, losresis-db 20261029120000): si el caso pedido
 * tiene «Revisión tutor», al completarlo queda pendiente de revisión
 * (`review_status = pending`; lo pone la base, la app nunca lo escribe). El
 * tutor lo da por revisado (queda cerrado) o pide modificaciones (vuelve a
 * borrador con `review_status = changes_requested` y el residente lo reenvía).
 * El historial está en `libro_clinical_case_review`, el más reciente primero.
 *
 * Contrato con el panel (losresis-panel/src/lib/libroClinicalCases.ts): los
 * nombres de campo y sus rótulos. Si cambian aquí, cambian allí.
 */

export const CLINICAL_CASES_CODE = "clinical_cases";

export const CLINICAL_CASES_SECTION = {
  label: "Casos clínicos",
  description: "Análisis de casos y reflexión sobre lo aprendido",
  iconName: "clipboard-outline",
  colorToken: "emerald",
};

export const PRIVACY_NOTICE =
  "Recuerda que los casos clínicos deben registrarse sin información que permita identificar a los pacientes.";

export const REFLECTION_PROMPTS = [
  "¿Qué he aprendido?",
  "¿Qué haría diferente en una situación similar?",
  "¿Qué dificultades he encontrado?",
  "¿Cómo aplicaré lo aprendido en mi práctica clínica?",
];

/**
 * Los campos de la ficha, por bloques. `required` es lo que pide «Marcar como
 * completado»; el título se pide siempre, también para un borrador.
 */
export const CLINICAL_CASE_BLOCKS = [
  {
    key: "identification",
    title: "Identificación",
    fields: [
      { key: "title", label: "Título del caso clínico", required: true, multiline: false },
      { key: "case_date", label: "Fecha", required: true, type: "date" },
      { key: "service", label: "Servicio o unidad", required: false, multiline: false },
      { key: "rotation", label: "Rotación asociada", required: false, multiline: false },
    ],
  },
  {
    key: "clinical",
    title: "Descripción clínica",
    fields: [
      { key: "chief_complaint", label: "Motivo de consulta", required: true, multiline: true },
      { key: "relevant_history", label: "Antecedentes relevantes", required: true, multiline: true },
      { key: "physical_exam", label: "Exploración física", required: true, multiline: true },
      { key: "complementary_tests", label: "Pruebas complementarias", required: true, multiline: true },
      { key: "clinical_course", label: "Evolución clínica", required: true, multiline: true },
      { key: "final_diagnosis", label: "Diagnóstico final", required: true, multiline: true },
      { key: "treatment_and_outcome", label: "Tratamiento y evolución", required: true, multiline: true },
    ],
  },
  {
    key: "reflection",
    title: "Reflexión personal",
    fields: [
      { key: "reflection", label: "¿Qué he aprendido de este caso?", required: true, multiline: true },
    ],
  },
];

export const CLINICAL_CASE_FIELDS = CLINICAL_CASE_BLOCKS.flatMap((block) => block.fields);

const TEXT_KEYS = CLINICAL_CASE_FIELDS.filter((field) => field.type !== "date").map(
  (field) => field.key
);

// La estructura de la plantilla cubre R1–R5; un R6 usa la de R5.
export const templateYearFor = (residencyYear) =>
  Math.min(Math.max(Number(residencyYear) || 1, 1), 5);

const isBlank = (value) => value === null || value === undefined || !String(value).trim();

/** Los valores del formulario a partir de una ficha (o vacíos, con el título del requisito). */
export const formValuesFor = (clinicalCase, requirement = null) => {
  const values = {};
  CLINICAL_CASE_FIELDS.forEach((field) => {
    values[field.key] = clinicalCase?.[field.key] ?? "";
  });
  if (!clinicalCase && requirement?.title) {
    values.title = requirement.title;
  }
  return values;
};

/**
 * Lo que falta para guardar. Un borrador solo necesita título; completar, todo
 * lo obligatorio.
 *
 * @returns {string[]} los rótulos de los campos que faltan
 */
export const missingFieldsFor = (values, { complete }) =>
  CLINICAL_CASE_FIELDS.filter((field) =>
    complete ? field.required : field.key === "title"
  )
    .filter((field) => isBlank(values?.[field.key]))
    .map((field) => field.label);

/** La fila que se escribe en libro_clinical_case. */
export const buildClinicalCasePayload = (
  values,
  { userId, residencyYear, requirementId = null, complete }
) => {
  const payload = {
    user_id: userId,
    residency_year: residencyYear,
    requirement_id: requirementId,
    status: complete ? "completed" : "draft",
    case_date: isBlank(values?.case_date) ? null : String(values.case_date).slice(0, 10),
  };
  TEXT_KEYS.forEach((key) => {
    // Se conservan los saltos de línea; solo se quitan los espacios de los extremos.
    payload[key] = isBlank(values?.[key]) ? null : String(values[key]).trim();
  });
  return payload;
};

export const CLINICAL_CASE_STATUS = {
  pending: { label: "Pendiente", color: "#E11D48", background: "#FFF1F2", icon: "ellipse-outline" },
  in_progress: { label: "En progreso", color: "#B45309", background: "#FEF3C7", icon: "time-outline" },
  changes_requested: {
    label: "Modificaciones solicitadas",
    color: "#B45309",
    background: "#FEF3C7",
    icon: "alert-circle-outline",
  },
  completed: { label: "Completado", color: "#047857", background: "#D1FAE5", icon: "checkmark-circle" },
  pending_review: {
    label: "Pendiente de revisión",
    color: "#6D28D9",
    background: "#EDE9FE",
    icon: "hourglass-outline",
  },
  reviewed: { label: "Revisado", color: "#047857", background: "#D1FAE5", icon: "ribbon-outline" },
};

/**
 * El estado que se enseña. La revisión manda sobre `status`: un caso devuelto
 * es un borrador, pero lo que importa es que el tutor pidió cambios.
 */
export const displayStatusOf = (clinicalCase) => {
  if (!clinicalCase) return "pending";
  if (clinicalCase.review_status === "reviewed") return "reviewed";
  if (clinicalCase.status === "completed") {
    return clinicalCase.review_status === "pending" ? "pending_review" : "completed";
  }
  return clinicalCase.review_status === "changes_requested" ? "changes_requested" : "in_progress";
};

/** Si el residente ya ha hecho su parte: cuenta en el progreso. */
export const isDoneStatus = (status) =>
  status === "completed" || status === "pending_review" || status === "reviewed";

/** Un caso revisado por el tutor queda cerrado: ni se edita ni se borra. */
export const isLockedByReview = (clinicalCase) => clinicalCase?.review_status === "reviewed";

/** Las revisiones del tutor, la más reciente primero. */
export const reviewsOf = (clinicalCase) =>
  [...(clinicalCase?.reviews || [])].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );

/** Los textos de una revisión del tutor, con el copy de la tarea. */
export const CLINICAL_CASE_REVIEW_FIELDS = [
  { key: "overall_assessment", label: "Valoración general" },
  { key: "strengths", label: "Aspectos positivos" },
  { key: "improvements", label: "Aspectos a mejorar" },
  { key: "comments_for_resident", label: "Comentarios" },
];

export const REVIEW_OUTCOME_LABELS = {
  reviewed: "Revisado",
  changes_requested: "Modificaciones solicitadas",
};

/**
 * Los requisitos que ve el residente en un año: los vivos de la plantilla para
 * ese año y los retirados en los que ya tiene ficha ese año. En el orden del
 * hospital.
 */
export const requirementsForYear = (requirements = [], cases = [], residencyYear) => {
  const templateYear = templateYearFor(residencyYear);
  const withCase = new Set(
    cases
      .filter((item) => item.residency_year === residencyYear && item.requirement_id)
      .map((item) => item.requirement_id)
  );
  return requirements
    .filter((requirement) => requirement.residency_year === templateYear)
    .filter((requirement) => !requirement.archived || withCase.has(requirement.id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
};

/**
 * «Mi portafolio» de un año: un renglón por requisito vivo, con su ficha si la
 * tiene (de cualquier año: un caso vinculado cuenta aunque se empezara antes).
 */
export const portfolioRows = (requirements = [], cases = [], residencyYear) =>
  requirementsForYear(requirements, cases, residencyYear)
    .filter((requirement) => !requirement.archived)
    .map((requirement) => {
      const clinicalCase =
        cases.find((item) => item.requirement_id === requirement.id) || null;
      return { requirement, clinicalCase, status: displayStatusOf(clinicalCase) };
    });

/**
 * «X de N completados». Cuentan los obligatorios; si el hospital no marcó
 * ninguno, todos. Sin requisitos, null.
 */
export const portfolioProgress = (rows = []) => {
  const required = rows.filter((row) => row.requirement.is_required);
  const counted = required.length ? required : rows;
  if (!counted.length) return null;
  const done = counted.filter((row) => isDoneStatus(row.status)).length;
  return { done, total: counted.length, percent: Math.round((done / counted.length) * 100) };
};

/**
 * Los objetivos que el portafolio suma al Progreso del año del Libro (ADR 0008:
 * solo cuenta lo que fija el tutor): uno por cada caso obligatorio.
 */
export const portfolioGoals = (rows = []) =>
  rows
    .filter((row) => row.requirement.is_required)
    .map((row) => ({ done: isDoneStatus(row.status) }));

/**
 * «Mis casos clínicos» de un año: los libres y los vinculados a un requisito que
 * ya no está en su portafolio (retirado por el hospital). Más recientes primero.
 */
export const freeCasesForYear = (cases = [], rows = [], residencyYear) => {
  const inPortfolio = new Set(
    rows.flatMap((row) => (row.clinicalCase ? [row.clinicalCase.id] : []))
  );
  return cases
    .filter((item) => item.residency_year === residencyYear && !inPortfolio.has(item.id))
    .sort((a, b) =>
      String(b.case_date || b.updated_at || "").localeCompare(String(a.case_date || a.updated_at || ""))
    );
};

/** Los casos libres que se pueden vincular a un requisito: los que no tienen uno. */
export const linkableCases = (cases = []) => cases.filter((item) => !item.requirement_id);

/** El contador de la tarjeta del índice: «1 de 3» con portafolio, o cuántos casos. */
export const indexCountFor = (rows = [], freeCases = []) => {
  const progress = portfolioProgress(rows);
  return progress
    ? { count: progress.done, total: progress.total }
    : { count: freeCases.length, total: null };
};

/** «15/09/2026». */
export const formatCaseDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
};
