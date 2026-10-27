// Postguardia: el registro rápido que el residente hace después de cada guardia
// (ClickUp 124b4z9vc56). Aquí solo hay lógica pura; las lecturas y escrituras
// están en services/shiftDebriefService.js.
//
// Los procedimientos no se guardan en la postguardia: se escriben en el Libro
// (Actividad asistencial) como libro_entry. Para no duplicar lo que el residente
// ya hubiera apuntado ese día en el Libro, el contador de cada procedimiento
// arranca con lo que el Libro ya tiene en las fechas de la guardia y al guardar
// solo se escribe la diferencia. Un menos es un negativo, nunca un borrado
// (docs/adr/0010).

export const SHIFT_DEBRIEF_SECTION = "clinical_practice";

// Lo que se cuenta en Actividad asistencial. «note» y «checklist» no son
// procedimientos que se repitan.
const COUNTABLE_TRACKING_MODES = new Set(["counter", "participation"]);

export const AUTONOMY_OPTIONS = [
  {
    value: "frequent_supervision",
    emoji: "👀",
    label: "He necesitado supervisión frecuente",
    short: "Supervisión frecuente",
  },
  {
    value: "occasional_support",
    emoji: "🤝",
    label: "He trabajado con apoyo puntual",
    short: "Con apoyo puntual",
  },
  {
    value: "mostly_autonomous",
    emoji: "🚀",
    label: "He actuado con autonomía en la mayoría de situaciones",
    short: "Con autonomía",
  },
];

export const LEARNING_OPTIONS = [
  {
    value: "new_technique",
    emoji: "🩺",
    label: "He aprendido una técnica nueva",
    short: "Técnica nueva",
  },
  {
    value: "clinical_reasoning",
    emoji: "💡",
    label: "He mejorado mi razonamiento clínico",
    short: "Razonamiento clínico",
  },
  {
    value: "autonomy",
    emoji: "💪",
    label: "He ganado autonomía",
    short: "Autonomía",
  },
  {
    value: "teamwork",
    emoji: "🤝",
    label: "He mejorado trabajando en equipo",
    short: "Trabajo en equipo",
  },
  {
    value: "difficult_situation",
    emoji: "🚨",
    label: "He gestionado una situación difícil",
    short: "Situación difícil",
  },
  {
    value: "study_need",
    emoji: "📚",
    label: "He identificado algo que necesito estudiar",
    short: "Algo que estudiar",
  },
];

export const RATING_OPTIONS = [
  { value: 1, emoji: "😣", label: "Muy difícil" },
  { value: 2, emoji: "😕", label: "Difícil" },
  { value: 3, emoji: "😐", label: "Normal" },
  { value: 4, emoji: "🙂", label: "Buena" },
  { value: 5, emoji: "🤩", label: "Muy buena" },
];

export const REFLECTION_FIELDS = [
  {
    key: "learnings",
    title: "Principales aprendizajes",
    placeholder:
      "¿Qué conocimientos o habilidades has adquirido durante esta guardia?",
  },
  {
    key: "supervision",
    title: "Autonomía y supervisión",
    placeholder: "¿En qué situaciones has necesitado supervisión?",
  },
  {
    key: "difficulties",
    title: "Dificultades",
    placeholder:
      "¿Qué situaciones clínicas o profesionales te han resultado más difíciles?",
  },
  {
    key: "improvements",
    title: "Aspectos de mejora",
    placeholder: "¿Qué te gustaría mejorar en las próximas guardias?",
  },
  {
    key: "personal",
    title: "Reflexión personal",
    placeholder:
      "¿Hay alguna experiencia de esta guardia que consideres especialmente relevante para tu formación?",
  },
];

const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Suma días a una fecha ISO de día, sin pasar por la zona horaria. */
export const addDaysIso = (isoDate, days) => {
  if (!isIsoDate(isoDate)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

/** Hoy en el calendario local del móvil, como fecha ISO de día. */
export const todayIso = (now = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * La fecha en que termina la guardia. Las guardias no guardan hora de fin: es la
 * fecha de fin del calendario, y sin ella, la de la guardia. Es la misma regla
 * que usa el push (losresis-db 20261028120000_shift_debrief.sql).
 */
export const getShiftEndDate = (shift) =>
  shift?.end_date || shift?.event_date || null;

/** Se puede registrar a partir del día en que acaba. */
export const isShiftFinished = (shift, today = todayIso()) => {
  const endDate = getShiftEndDate(shift);
  return isIsoDate(endDate) && endDate <= today;
};

/**
 * Las fechas del Libro que cuentan como «durante la guardia»: la de la guardia
 * y, si dura más de 12 h, la del día siguiente (una de 24 h acaba por la mañana
 * del día siguiente, y lo que apuntó al salir lleva esa fecha).
 */
export const getShiftLibroDates = (shift) => {
  const start = shift?.event_date;
  if (!isIsoDate(start)) return [];
  const end = getShiftEndDate(shift);
  const lastDay =
    shift?.metadata?.shift_duration === "12h" ? end : addDaysIso(end, 1);
  const dates = [];
  for (let day = start; day && day <= lastDay; day = addDaysIso(day, 1)) {
    dates.push(day);
  }
  return dates;
};

/** Las actividades del Libro que se pueden contar en una postguardia. */
export const getCountableProcedures = (nodes = []) => {
  const areaById = new Map(
    nodes.filter((node) => !node.parent_node_id).map((node) => [node.id, node]),
  );
  return nodes
    .filter(
      (node) =>
        node.parent_node_id &&
        COUNTABLE_TRACKING_MODES.has(node.tracking_mode || "counter"),
    )
    .map((node) => ({
      node_id: node.id,
      name: node.name,
      area_name: areaById.get(node.parent_node_id)?.name || null,
    }));
};

/**
 * Lo que el Libro ya tiene de cada actividad en las fechas de la guardia: es
 * con lo que arranca el contador, para no apuntar dos veces lo mismo.
 *
 * @returns {Record<string, number>} nodeId → saldo (nunca negativo)
 */
export const sumLibroCountsForShift = (entries = [], shift) => {
  const dates = new Set(getShiftLibroDates(shift));
  const totals = {};
  entries.forEach((entry) => {
    if (!entry?.node_id || !dates.has(entry.performed_at)) return;
    const count = Number(entry.count);
    if (!Number.isFinite(count)) return;
    totals[entry.node_id] = (totals[entry.node_id] || 0) + count;
  });
  Object.keys(totals).forEach((nodeId) => {
    totals[nodeId] = Math.max(0, totals[nodeId]);
  });
  return totals;
};

/**
 * Lo que hay que escribir en el Libro para que tenga lo que dicen los contadores:
 * solo la diferencia, positiva o negativa.
 *
 * @param {Record<string, number>} initial lo que el Libro ya tenía
 * @param {Record<string, number>} desired lo que dicen los contadores
 * @returns {Array<{nodeId: string, delta: number}>}
 */
export const computeLibroDeltas = (initial = {}, desired = {}) => {
  // Solo los que están en pantalla: lo que el Libro tenga de otras actividades
  // esos días no es cosa de la postguardia.
  const deltas = [];
  Object.keys(desired).forEach((nodeId) => {
    const target = Math.max(0, Math.trunc(Number(desired[nodeId]) || 0));
    const delta = target - (initial[nodeId] || 0);
    if (delta !== 0) deltas.push({ nodeId, delta });
  });
  return deltas;
};

const normalizeName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * Los frecuentes guardados, contra las actividades del Libro de ahora.
 *
 * Se guardan con su nombre porque el Libro cambia: al empezar otro año las
 * actividades son otras filas. Se buscan por id y, si ya no está, por nombre.
 * Los que no están en el Libro (personalizados con Libro oficial) se quedan sin
 * node_id: se cuentan en la postguardia, pero no llegan al Libro.
 */
export const resolveFrequentProcedures = (saved = [], catalog = []) => {
  const byId = new Map(catalog.map((item) => [item.node_id, item]));
  const byName = new Map(
    catalog.map((item) => [normalizeName(item.name), item]),
  );
  const seen = new Set();
  const resolved = [];

  (Array.isArray(saved) ? saved : []).forEach((item) => {
    const name = String(item?.name || "").trim();
    const match =
      (item?.node_id && byId.get(item.node_id)) ||
      byName.get(normalizeName(name));
    const resolvedItem = match
      ? { node_id: match.node_id, name: match.name }
      : name
        ? { node_id: null, name }
        : null;
    if (!resolvedItem) return;
    const key = procedureKey(resolvedItem);
    if (seen.has(key)) return;
    seen.add(key);
    resolved.push(resolvedItem);
  });

  return resolved;
};

/** La clave de un procedimiento en la postguardia: su actividad, o su nombre. */
export const procedureKey = (item) =>
  item?.node_id ? `node:${item.node_id}` : `name:${normalizeName(item?.name)}`;

/** Buscar en el catálogo sin tildes ni mayúsculas, y sin los ya elegidos. */
export const searchProcedures = (
  catalog = [],
  query = "",
  excludeKeys = [],
) => {
  const excluded = new Set(excludeKeys);
  const needle = normalizeName(query);
  return catalog.filter(
    (item) =>
      !excluded.has(procedureKey(item)) &&
      (!needle || normalizeName(item.name).includes(needle)),
  );
};

/** Un procedimiento con ese nombre que ya existe en el catálogo, si lo hay. */
export const findProcedureByName = (catalog = [], name = "") => {
  const needle = normalizeName(name);
  if (!needle) return null;
  return catalog.find((item) => normalizeName(item.name) === needle) || null;
};

/** Mueve un elemento de la lista una posición arriba (-1) o abajo (+1). */
export const moveItem = (list = [], index, direction) => {
  const target = index + direction;
  if (
    index < 0 ||
    index >= list.length ||
    target < 0 ||
    target >= list.length
  ) {
    return list;
  }
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/**
 * La foto de procedimientos que guarda la postguardia (para el resumen y el
 * historial): solo los que tienen al menos uno.
 */
export const buildProceduresSnapshot = (items = [], counts = {}) =>
  items
    .map((item) => ({
      node_id: item.node_id || null,
      name: item.name,
      count: Math.max(0, Math.trunc(Number(counts[procedureKey(item)]) || 0)),
    }))
    .filter((item) => item.count > 0);

/** Tu guardia en números. */
export const summarizeDebrief = (debrief) => {
  const procedures = Array.isArray(debrief?.procedures)
    ? debrief.procedures
    : [];
  const total = procedures.reduce(
    (sum, item) => sum + (Number(item.count) || 0),
    0,
  );
  const learnings = LEARNING_OPTIONS.filter((option) =>
    (debrief?.learnings || []).includes(option.value),
  );
  return {
    total,
    procedures,
    learnings,
    autonomy:
      AUTONOMY_OPTIONS.find((option) => option.value === debrief?.autonomy) ||
      null,
    rating:
      RATING_OPTIONS.find((option) => option.value === debrief?.rating) || null,
  };
};

/** «1 procedimiento registrado» / «8 procedimientos registrados». */
export const formatProcedureTotal = (total) =>
  `${total} ${total === 1 ? "procedimiento registrado" : "procedimientos registrados"}`;

/** Si la autoevaluación ampliada tiene algo escrito. */
export const hasReflection = (reflection) =>
  Boolean(
    reflection &&
    REFLECTION_FIELDS.some((field) =>
      String(reflection[field.key] || "").trim(),
    ),
  );

/** Los textos de la ampliada, recortados y sin los vacíos. */
export const cleanReflection = (reflection = {}) => {
  const clean = {};
  REFLECTION_FIELDS.forEach((field) => {
    const value = String(reflection?.[field.key] || "").trim();
    if (value) clean[field.key] = value;
  });
  return clean;
};

/**
 * El estado de la postguardia de una guardia, para el historial y la Agenda.
 * Una guardia que aún no ha acabado no tiene estado.
 */
export const getDebriefStatus = (shift, debrief, today = todayIso()) => {
  if (debrief?.status === "completed") return "completed";
  if (!isShiftFinished(shift, today)) return null;
  return "pending";
};
