/**
 * Apartados personalizados del Libro del Residente (arquetipo `custom`, ADR 0014).
 *
 * El hospital los diseña en losresis-panel (asistente «Crear apartado
 * personalizado»): nombre, icono, campos tipados, modo de registro, actividades,
 * grupos y objetivos. Viven en tablas propias (`libro_custom_section`, `_field`,
 * `_activity`) y el residente escribe en `libro_custom_entry`, con las respuestas en
 * `field_values` indexadas por el id del campo.
 *
 * Contrato con el panel (losresis-panel/src/lib/libroCustomSections.ts): la forma
 * de cada valor por tipo es la de abajo. Si cambia allí, cambia aquí.
 *
 *   short_text, long_text  string
 *   integer, decimal, scale number
 *   date                   "AAAA-MM-DD"
 *   time                   "HH:MM"
 *   datetime               "AAAA-MM-DDTHH:MM"
 *   single_choice          id de opción
 *   multi_choice           [id de opción]
 *   boolean                true | false
 *   attachment, image      { path, name, mime, size } (libroAttachmentService)
 *   duration               minutos (number)
 */

export const CUSTOM_SECTION_CODE = "custom";

export const CUSTOM_FIELD_TYPE_LABELS = {
  short_text: "Texto corto",
  long_text: "Texto largo",
  integer: "Número entero",
  decimal: "Número decimal",
  date: "Fecha",
  time: "Hora",
  datetime: "Fecha y hora",
  single_choice: "Selector único",
  multi_choice: "Selección múltiple",
  boolean: "Sí / No",
  scale: "Escala numérica",
  attachment: "Archivo adjunto",
  image: "Imagen",
  duration: "Duración",
};

// La estructura de la plantilla cubre R1–R5; un R6 usa la de R5, como el resto del
// Libro (seed_libro_year_from_template).
export const templateYearFor = (residencyYear) =>
  Math.min(Math.max(Number(residencyYear) || 1, 1), 5);

/** Las opciones que se ofrecen: las archivadas solo sirven para leer respuestas viejas. */
export const liveOptions = (field) =>
  (field?.options || []).filter((option) => !option.archived);

export const liveFields = (section) =>
  (section?.fields || [])
    .filter((field) => !field.archived_at)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

/**
 * Las actividades vivas del apartado, en orden. En `grouped` devuelve los grupos
 * con sus actividades en `children`; en el resto, una lista plana.
 */
export const activityTree = (section) => {
  const live = (section?.activities || [])
    .filter((activity) => !activity.archived_at)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  if (section?.record_mode === "grouped") {
    return live
      .filter((activity) => activity.kind === "group")
      .map((group) => ({
        ...group,
        children: live.filter(
          (activity) => activity.kind === "activity" && activity.parent_id === group.id
        ),
      }))
      .filter((group) => group.children.length > 0);
  }

  return live.filter((activity) => activity.kind === "activity");
};

export const flatActivities = (section) =>
  section?.record_mode === "grouped"
    ? activityTree(section).flatMap((group) => group.children)
    : activityTree(section);

/** Vacío de verdad. El 0 y el `false` son respuestas. */
export const isEmptyCustomValue = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && !value.trim()) ||
  (Array.isArray(value) && value.length === 0);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lo que impide guardar un registro: campo por campo, con una frase que el
 * residente entiende. Solo mira los campos vivos.
 *
 * @returns {Array<{fieldId: string, message: string}>}
 */
export const validateCustomEntry = (fields, values = {}) => {
  const errors = [];

  fields.forEach((field) => {
    const value = values[field.id];
    const label = field.label;

    if (isEmptyCustomValue(value)) {
      if (field.required) {
        errors.push({ fieldId: field.id, message: `Falta «${label}».` });
      }
      return;
    }

    switch (field.field_type) {
      case "integer":
      case "decimal":
      case "scale":
      case "duration": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          errors.push({ fieldId: field.id, message: `«${label}» tiene que ser un número.` });
          return;
        }
        if ((field.field_type === "integer" || field.field_type === "scale") && !Number.isInteger(value)) {
          errors.push({ fieldId: field.id, message: `«${label}» tiene que ser un número entero.` });
          return;
        }
        if (field.field_type === "duration" && value <= 0) {
          errors.push({ fieldId: field.id, message: `«${label}» tiene que durar algo.` });
          return;
        }
        const min = field.min_value === null || field.min_value === undefined ? null : Number(field.min_value);
        const max = field.max_value === null || field.max_value === undefined ? null : Number(field.max_value);
        if (min !== null && value < min) {
          errors.push({ fieldId: field.id, message: `«${label}» no puede ser menor que ${min}.` });
        } else if (max !== null && value > max) {
          errors.push({ fieldId: field.id, message: `«${label}» no puede ser mayor que ${max}.` });
        }
        return;
      }
      case "time":
        if (!TIME_RE.test(String(value))) {
          errors.push({ fieldId: field.id, message: `«${label}» tiene que ser una hora (HH:MM).` });
        }
        return;
      case "date":
        if (!DATE_RE.test(String(value))) {
          errors.push({ fieldId: field.id, message: `«${label}» tiene que ser una fecha.` });
        }
        return;
      case "datetime": {
        const [date, time] = String(value).split("T");
        if (!DATE_RE.test(date || "") || !TIME_RE.test(time || "")) {
          errors.push({ fieldId: field.id, message: `«${label}» necesita día y hora.` });
        }
        return;
      }
      case "single_choice":
        if (!liveOptions(field).some((option) => option.id === value) &&
            !(field.options || []).some((option) => option.id === value)) {
          errors.push({ fieldId: field.id, message: `Elige una opción en «${label}».` });
        }
        return;
      default:
        return;
    }
  });

  return errors;
};

/**
 * Los valores que se guardan: los de los campos vivos (sin vacíos) y, al editar un
 * registro viejo, las respuestas que ya tenía en campos que el hospital retiró. Esas
 * no se pueden tocar desde aquí, pero tampoco se pierden al guardar.
 */
export const buildCustomFieldValues = (fields, values = {}, previous = {}) => {
  const liveIds = new Set(fields.map((field) => field.id));
  const result = {};
  Object.entries(previous || {}).forEach(([key, value]) => {
    if (!liveIds.has(key)) result[key] = value;
  });
  fields.forEach((field) => {
    const value = values[field.id];
    if (!isEmptyCustomValue(value)) result[field.id] = value;
  });
  return result;
};

const pad = (value) => String(value).padStart(2, "0");

export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** El día del registro: el primer campo de fecha del formulario o, sin él, hoy. */
export const performedAtFor = (fields, values = {}, now = new Date()) => {
  for (const field of fields) {
    const value = values[field.id];
    if (field.field_type === "date" && DATE_RE.test(String(value || ""))) return value;
    if (field.field_type === "datetime" && DATE_RE.test(String(value || "").split("T")[0])) {
      return String(value).split("T")[0];
    }
  }
  return todayIso(now);
};

/** «90» → «1 h 30 min». */
export const formatDurationMinutes = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

/** Texto legible de una respuesta; null si está vacía. */
export const formatCustomValue = (field, value) => {
  if (isEmptyCustomValue(value)) return null;
  const optionLabel = (id) =>
    (field.options || []).find((option) => option.id === id)?.label ?? String(id);

  switch (field.field_type) {
    case "boolean":
      return value === true ? "Sí" : value === false ? "No" : null;
    case "single_choice":
      return optionLabel(value);
    case "multi_choice":
      return Array.isArray(value) ? value.map(optionLabel).join(", ") : null;
    case "integer":
    case "decimal":
      return typeof value === "number"
        ? `${String(value).replace(".", ",")}${field.unit ? ` ${field.unit}` : ""}`
        : null;
    case "scale":
      return typeof value === "number"
        ? `${value}${field.max_value !== null && field.max_value !== undefined ? ` de ${Number(field.max_value)}` : ""}`
        : null;
    case "duration":
      return typeof value === "number" ? formatDurationMinutes(value) : null;
    case "date": {
      const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
    }
    case "datetime": {
      const [date, time] = String(value).split("T");
      const match = (date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[3]}/${match[2]}/${match[1]}${time ? ` ${time}` : ""}` : null;
    }
    case "attachment":
    case "image":
      return typeof value === "object" && value ? value.name || "Archivo" : null;
    default:
      return String(value).trim() || null;
  }
};

/** Cuánto lleva el residente en el apartado y en cada actividad (sumando `count`). */
export const customSectionCounts = (entries = []) => {
  const byActivity = new Map();
  let total = 0;
  entries.forEach((entry) => {
    const count = Number(entry.count) || 0;
    total += count;
    if (entry.activity_id) {
      byActivity.set(entry.activity_id, (byActivity.get(entry.activity_id) || 0) + count);
    }
  });
  return { total, byActivity };
};

/**
 * Los objetivos que el apartado aporta al Progreso del año (ADR 0008: solo cuenta
 * lo que fija el tutor). Uno por la meta del apartado y uno por cada actividad viva
 * con meta; está hecho cuando la cuenta llega a la meta.
 */
export const customSectionGoals = (section, entries = []) => {
  const { total, byActivity } = customSectionCounts(entries);
  const goals = [];
  if (section?.goal > 0 && !section.archived_at) {
    goals.push({ done: total >= section.goal });
  }
  if (!section?.archived_at) {
    flatActivities(section)
      .filter((activity) => activity.goal > 0)
      .forEach((activity) => {
        goals.push({ done: (byActivity.get(activity.id) || 0) >= activity.goal });
      });
  }
  return goals;
};

/**
 * Si el residente puede añadir un registro más. En los apartados de un solo registro
 * (formulario único, o actividad que se completa una vez) el segundo se edita, no se
 * crea: la base lo impide igual (libro_custom_entry_guard).
 */
export const canAddCustomEntry = (section, entries = [], activityId = null) =>
  !!section?.allow_multiple ||
  !entries.some((entry) => (entry.activity_id || null) === (activityId || null));

/**
 * Los apartados personalizados que ve el residente en un año: los vivos de la
 * plantilla para ese año y los retirados en los que ya registró algo (que se leen,
 * no se escriben). En el orden que les dio el hospital.
 */
export const visibleCustomSections = (sections = [], entries = [], residencyYear) => {
  const templateYear = templateYearFor(residencyYear);
  const withEntries = new Set(
    entries
      .filter((entry) => entry.residency_year === residencyYear)
      .map((entry) => entry.section_id)
  );
  return sections
    .filter((section) => section.residency_year === templateYear)
    .filter((section) => !section.archived_at || withEntries.has(section.id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
};

/**
 * Intercala las tarjetas personalizadas entre las del catálogo del índice.
 *
 * Las del catálogo conservan su orden de siempre; cada personalizada va justo detrás
 * de la última del catálogo que el hospital puso antes que ella en la plantilla
 * (`position`, que los dos tipos comparten en el panel).
 *
 * @param {Array<{section: string}>} catalogItems
 * @param {Array<{position: number}>} customItems
 * @param {Map<string, number>} blockPositions posición de cada sección del catálogo
 */
export const mergeCustomIntoIndex = (catalogItems, customItems, blockPositions) => {
  const result = [...catalogItems];
  [...customItems]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .forEach((custom) => {
      let insertAt = 0;
      result.forEach((item, index) => {
        const position = item.customSectionId
          ? item.position
          : blockPositions.get(item.section);
        if (position !== undefined && position !== null && position < custom.position) {
          insertAt = index + 1;
        }
      });
      result.splice(insertAt, 0, custom);
    });
  return result;
};

/**
 * Suma objetivos de apartados personalizados a un Progreso del año ya calculado
 * ({done, total, percent} o null). Sin objetivos en ningún lado sigue siendo null:
 * un año sin metas no tiene porcentaje, no tiene 0% (ADR 0008).
 */
export const combineLibroProgress = (progress, goals = []) => {
  const total = (progress?.total || 0) + goals.length;
  const done = (progress?.done || 0) + goals.filter((goal) => goal.done).length;
  return total ? { done, total, percent: Math.round((done / total) * 100) } : null;
};
