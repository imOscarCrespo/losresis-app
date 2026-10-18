import { supabase } from "../config/supabase";
import { getPublishedLibroTemplateForUser } from "./libroTemplateService";
import { customSectionGoals, visibleCustomSections } from "../utils/libroCustom";

/**
 * Lectura y escritura de los apartados personalizados del Libro (utils/libroCustom.js
 * explica el modelo).
 *
 * La estructura se lee EN VIVO de la plantilla publicada, como la config de los
 * apartados `form`: no se clona al libro del residente, así que lo que el hospital
 * cambie aparece al refrescar. La RLS solo deja leer la de la plantilla publicada de
 * su hospital y especialidad.
 */

const SECTION_SELECT =
  "id, template_id, residency_year, position, name, description, icon_name, color_token, record_mode, allow_multiple, goal, archived_at, " +
  "fields:libro_custom_field(id, label, description, field_type, required, options, unit, min_value, max_value, position, archived_at), " +
  "activities:libro_custom_activity(id, parent_id, kind, name, goal, position, archived_at)";

const ENTRY_SELECT =
  "id, section_id, activity_id, residency_year, count, field_values, performed_at, created_at, updated_at";

// numeric llega de PostgREST como texto según el valor; los límites se comparan
// como números.
const normalizeSection = (row) => ({
  ...row,
  fields: (row.fields || []).map((field) => ({
    ...field,
    options: Array.isArray(field.options) ? field.options : [],
    min_value: field.min_value === null ? null : Number(field.min_value),
    max_value: field.max_value === null ? null : Number(field.max_value),
  })),
  activities: row.activities || [],
});

/**
 * Todos los apartados personalizados de la plantilla, de todos los años, también
 * los retirados (hacen falta para leer lo que el residente registró en ellos).
 */
export const getLibroCustomSections = async (templateId) => {
  if (!templateId) return [];

  const { data, error } = await supabase
    .from("libro_custom_section")
    .select(SECTION_SELECT)
    .eq("template_id", templateId)
    .order("residency_year", { ascending: true })
    .order("position", { ascending: true });

  if (error) {
    // Una app nueva contra una base sin la tabla, o un fallo de red: el Libro se
    // abre igual con sus apartados de siempre.
    console.error("Error fetching libro custom sections:", error);
    return [];
  }

  return (data || []).map(normalizeSection);
};

/** Los registros del residente en apartados personalizados, más recientes primero. */
export const getLibroCustomEntries = async (userId) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("libro_custom_entry")
    .select(ENTRY_SELECT)
    .eq("user_id", userId)
    .order("performed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching libro custom entries:", error);
    return [];
  }

  return data || [];
};

/**
 * Crea o actualiza un registro. Lanza con el mensaje de la base, que ya viene en
 * castellano cuando es una regla del apartado («Ya tienes un registro en …»).
 */
export const saveLibroCustomEntry = async ({
  entryId = null,
  userId,
  sectionId,
  activityId = null,
  residencyYear,
  count = 1,
  fieldValues = {},
  performedAt = null,
}) => {
  if (!userId || !sectionId || !residencyYear) {
    throw new Error("Faltan datos para guardar el registro");
  }

  const row = {
    field_values: fieldValues,
    performed_at: performedAt,
    count,
  };

  const query = entryId
    ? supabase
        .from("libro_custom_entry")
        .update(row)
        .eq("id", entryId)
        .eq("user_id", userId)
    : supabase.from("libro_custom_entry").insert({
        ...row,
        user_id: userId,
        section_id: sectionId,
        activity_id: activityId,
        residency_year: residencyYear,
      });

  const { data, error } = await query.select(ENTRY_SELECT).single();

  if (error) {
    throw new Error(error.message || "No se pudo guardar el registro");
  }

  return data;
};

export const deleteLibroCustomEntry = async ({ entryId, userId }) => {
  const { error } = await supabase
    .from("libro_custom_entry")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el registro");
  }
};

/**
 * Los objetivos que los apartados personalizados aportan al Progreso del año, para
 * quien no tiene el Libro abierto (el inicio). Mismas reglas que la pantalla del
 * Libro: solo con plantilla publicada y sin Libro propio ese año.
 */
export const getLibroCustomYearGoals = async (userId, residencyYear) => {
  if (!userId || !residencyYear) return [];

  const template = await getPublishedLibroTemplateForUser(userId);
  if (!template?.id) return [];

  const { data: ownBooks, error } = await supabase
    .from("libro_book")
    .select("id")
    .eq("user_id", userId)
    .eq("residency_year", residencyYear)
    .is("template_id", null)
    .limit(1);
  if (error || ownBooks?.length) return [];

  const [sections, entries] = await Promise.all([
    getLibroCustomSections(template.id),
    getLibroCustomEntries(userId),
  ]);

  return visibleCustomSections(sections, entries, residencyYear).flatMap((section) =>
    customSectionGoals(
      section,
      entries.filter(
        (entry) => entry.section_id === section.id && entry.residency_year === residencyYear
      )
    )
  );
};

export default {
  getLibroCustomYearGoals,
  getLibroCustomSections,
  getLibroCustomEntries,
  saveLibroCustomEntry,
  deleteLibroCustomEntry,
};
