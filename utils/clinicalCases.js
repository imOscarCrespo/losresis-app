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
 * Modos (fase 4, losresis-db 20261031120000): cada año de la plantilla pide
 * casos concretos (`specific`, Sant Pau: una ficha por requisito), un número
 * mínimo de casos de cualquier tipo (`minimum`), varios casos por categoría con
 * su mínimo (`category`) o nada (`free`). El modo vive en el bloque del año;
 * yearPortfolio lo resuelve para las pantallas, el Progreso y el PDF.
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

/** Si el requisito es una categoría (modo category): caben varios casos y cada uno tiene su título. */
export const isCategoryRequirement = (requirement) => requirement?.requirement_mode === "category";

/**
 * Los valores del formulario a partir de una ficha (o vacíos, con el título del
 * requisito; de una categoría no: «Respiratorio» no es el título de un caso).
 */
export const formValuesFor = (clinicalCase, requirement = null) => {
  const values = {};
  CLINICAL_CASE_FIELDS.forEach((field) => {
    values[field.key] = clinicalCase?.[field.key] ?? "";
  });
  if (!clinicalCase && requirement?.title && !isCategoryRequirement(requirement)) {
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
 * `rows` pueden ser renglones de specific (`clinicalCase`) o categorías (`cases`).
 */
export const freeCasesForYear = (cases = [], rows = [], residencyYear) => {
  const inPortfolio = new Set(
    rows.flatMap((row) =>
      row.cases ? row.cases.map((item) => item.id) : row.clinicalCase ? [row.clinicalCase.id] : []
    )
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

// ---------------------------------------------------------------------------
// Modos (fase 4)
// ---------------------------------------------------------------------------

export const CLINICAL_CASE_MODES = ["specific", "minimum", "category", "free"];

/**
 * El modo de un año: el de su bloque de la plantilla (R6+ usa el de R5). Sin
 * bloque, specific, que sin requisitos se pinta igual que free.
 *
 * @param {Map<number, { mode: string, minimum: number|null }>} blockModes
 */
export const modeForYear = (blockModes, residencyYear) => {
  const block = blockModes?.get?.(templateYearFor(residencyYear));
  if (!block || !CLINICAL_CASE_MODES.includes(block.mode)) {
    return { mode: "specific", minimum: null };
  }
  return { mode: block.mode, minimum: block.mode === "minimum" ? block.minimum || null : null };
};

const byMostRecent = (a, b) =>
  String(b.case_date || b.updated_at || "").localeCompare(String(a.case_date || a.updated_at || ""));

const progressOf = (done, total, extra = 0) => ({
  done,
  total,
  percent: total ? Math.round((done / total) * 100) : 0,
  extra,
});

export const CATEGORY_STATUS = {
  pending: { label: "Pendiente", color: "#E11D48", background: "#FFF1F2", icon: "ellipse-outline" },
  in_progress: { label: "En progreso", color: "#B45309", background: "#FEF3C7", icon: "time-outline" },
  completed: { label: "Completada", color: "#047857", background: "#D1FAE5", icon: "checkmark-circle" },
};

/**
 * Las categorías de un año (modo category), en el orden del hospital, con sus
 * casos (de cualquier año, como en specific), cuántos completados y su estado:
 * «Completada» al llegar al mínimo, «En progreso» con alguno, «Pendiente» sin
 * ninguno.
 */
export const categoryRows = (requirements = [], cases = [], residencyYear) =>
  requirementsForYear(requirements, cases, residencyYear)
    .filter((requirement) => !requirement.archived)
    .map((requirement) => {
      const linked = cases.filter((item) => item.requirement_id === requirement.id).sort(byMostRecent);
      const done = linked.filter((item) => isDoneStatus(displayStatusOf(item))).length;
      const minimum = Math.max(Number(requirement.minimum_cases) || 1, 1);
      const status = done >= minimum ? "completed" : linked.length ? "in_progress" : "pending";
      return { requirement, cases: linked, done, minimum, status };
    });

/**
 * Suma de min(completados, mínimo) entre la suma de mínimos. Cuentan las
 * obligatorias; sin ninguna, todas. El exceso va aparte (`extra`).
 */
export const categoryProgress = (categories = []) => {
  const required = categories.filter((row) => row.requirement.is_required);
  const counted = required.length ? required : categories;
  if (!counted.length) return null;
  const total = counted.reduce((sum, row) => sum + row.minimum, 0);
  const done = counted.reduce((sum, row) => sum + Math.min(row.done, row.minimum), 0);
  const extra = counted.reduce((sum, row) => sum + Math.max(row.done - row.minimum, 0), 0);
  return progressOf(done, total, extra);
};

/**
 * Lo que pide la plantilla en un año y cómo va el residente, en los cuatro
 * modos. Es lo que pintan «Casos clínicos», el índice, el Progreso y el PDF.
 *
 *   rows        specific: un renglón por caso pedido
 *   categories  category: las categorías con sus casos
 *   progress    { done, total, percent, extra } o null si no pide nada
 *   freeCases   «Mis casos clínicos» del año; en minimum, los que cuentan
 */
export const yearPortfolio = (requirements = [], cases = [], blockModes, residencyYear) => {
  const { mode, minimum } = modeForYear(blockModes, residencyYear);
  if (mode === "category") {
    const categories = categoryRows(requirements, cases, residencyYear);
    return {
      mode,
      minimum: null,
      rows: [],
      categories,
      progress: categoryProgress(categories),
      freeCases: freeCasesForYear(cases, categories, residencyYear),
    };
  }
  if (mode === "minimum" && minimum) {
    const freeCases = freeCasesForYear(cases, [], residencyYear);
    const done = freeCases.filter((item) => isDoneStatus(displayStatusOf(item))).length;
    return {
      mode,
      minimum,
      rows: [],
      categories: [],
      progress: progressOf(Math.min(done, minimum), minimum, Math.max(done - minimum, 0)),
      freeCases,
    };
  }
  const rows = mode === "free" ? [] : portfolioRows(requirements, cases, residencyYear);
  const progress = portfolioProgress(rows);
  return {
    mode: mode === "free" ? "free" : "specific",
    minimum: null,
    rows,
    categories: [],
    progress: progress ? { ...progress, extra: 0 } : null,
    freeCases: freeCasesForYear(cases, rows, residencyYear),
  };
};

/** Si el año tiene pestaña «Mi portafolio»: casos pedidos o categorías. */
export const hasPortfolioTab = (portfolio) =>
  !!(portfolio?.rows?.length || portfolio?.categories?.length);

/** «2 de 3 completados» o, en minimum y category, «3 de 4 casos completados» (+K aparte). */
export const progressLabel = (portfolio) => {
  const progress = portfolio?.progress;
  if (!progress) return null;
  const completed = progress.total === 1 ? "completado" : "completados";
  const base =
    portfolio.mode === "specific"
      ? `${progress.done} de ${progress.total} ${completed}`
      : `${progress.done} de ${progress.total} ${progress.total === 1 ? "caso" : "casos"} ${completed}`;
  return progress.extra > 0 ? `${base} (+${progress.extra})` : base;
};

/**
 * Los objetivos que suma el año al Progreso del Libro (ADR 0008): specific, uno
 * por caso obligatorio; category, el mínimo de cada categoría obligatoria;
 * minimum, N.
 */
export const yearPortfolioGoals = (portfolio) => {
  if (!portfolio) return [];
  if (portfolio.mode === "specific") return portfolioGoals(portfolio.rows);
  if (portfolio.mode === "category") {
    // Como en specific: solo lo obligatorio suma al Progreso del Libro.
    return portfolio.categories
      .filter((row) => row.requirement.is_required)
      .flatMap((row) =>
        Array.from({ length: row.minimum }, (_, index) => ({ done: index < row.done }))
      );
  }
  const progress = portfolio.progress;
  if (!progress) return [];
  return Array.from({ length: progress.total }, (_, index) => ({ done: index < progress.done }));
};

/** El contador de la tarjeta del índice: «3 de 4» si el año pide algo, o cuántos casos. */
export const yearIndexCount = (portfolio) =>
  portfolio?.progress
    ? { count: portfolio.progress.done, total: portfolio.progress.total }
    : { count: portfolio?.freeCases?.length || 0, total: null };

/** «15/09/2026». */
export const formatCaseDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
};
