import { supabase } from "../config/supabase";
import {
  createEntry,
  createNode,
  ensureLibroForResident,
  getAllLibroData,
} from "./libroService";
import { getSpecialtyById } from "./hospitalService";
import {
  SHIFT_DEBRIEF_SECTION,
  cleanReflection,
  computeLibroDeltas,
  getShiftLibroDates,
  sumLibroCountsForShift,
} from "../utils/shiftDebrief";

// Postguardia (ClickUp 124b4z9vc56). La autoevaluación vive en shift_debrief,
// una fila por guardia; los procedimientos, en el Libro (libro_entry), y los
// frecuentes, en libro_user_settings.shift_frequent_procedures. La lógica pura
// está en utils/shiftDebrief.js.

const DEBRIEF_FIELDS = [
  "procedures",
  "autonomy",
  "autonomy_comment",
  "learnings",
  "learning_note",
  "rating",
  "improvement_note",
  "reflection",
  "share_reflection_with_tutor",
];

const normalizeText = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length ? trimmed : null;
};

/** La guardia (agenda_events) que se va a registrar, si es del residente. */
export const getShiftForDebrief = async (agendaEventId, userId) => {
  if (!agendaEventId || !userId) return null;

  const { data, error } = await supabase
    .from("agenda_events")
    .select("id, user_id, event_type, title, event_date, end_date, metadata")
    .eq("id", agendaEventId)
    .eq("user_id", userId)
    .eq("event_type", "shift")
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const getShiftDebrief = async (agendaEventId) => {
  if (!agendaEventId) return null;

  const { data, error } = await supabase
    .from("shift_debrief")
    .select("*")
    .eq("agenda_event_id", agendaEventId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

/** El estado de la postguardia de varias guardias: agendaEventId → fila. */
export const getShiftDebriefsByEvent = async (userId) => {
  if (!userId) return {};

  const { data, error } = await supabase
    .from("shift_debrief")
    .select("id, agenda_event_id, status, rating, procedures, completed_at")
    .eq("user_id", userId);

  if (error) throw error;
  return Object.fromEntries(
    (data || []).map((row) => [row.agenda_event_id, row]),
  );
};

/**
 * Guarda lo que haya de la postguardia. Sin `complete`, es el guardado
 * automático: no cambia el estado (una completada que se edita sigue
 * completada). Con `complete`, la marca como completada.
 */
export const saveShiftDebrief = async ({
  userId,
  shift,
  fields = {},
  complete = false,
}) => {
  if (!userId || !shift?.id) {
    throw new Error("User and shift are required");
  }

  const payload = {
    user_id: userId,
    agenda_event_id: shift.id,
    shift_date: shift.event_date,
  };

  DEBRIEF_FIELDS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) return;
    const value = fields[key];
    if (
      key === "autonomy_comment" ||
      key === "learning_note" ||
      key === "improvement_note"
    ) {
      payload[key] = normalizeText(value);
    } else if (key === "reflection") {
      payload[key] = cleanReflection(value);
    } else if (key === "learnings") {
      payload[key] = Array.isArray(value) ? value : [];
    } else if (key === "procedures") {
      payload[key] = Array.isArray(value) ? value : [];
    } else if (key === "share_reflection_with_tutor") {
      payload[key] = Boolean(value);
    } else {
      payload[key] = value ?? null;
    }
  });

  if (complete) {
    payload.status = "completed";
    payload.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("shift_debrief")
    .upsert([payload], { onConflict: "agenda_event_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/** Los frecuentes guardados, o null si nunca los ha configurado. */
export const getFrequentProcedures = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("libro_user_settings")
    .select("shift_frequent_procedures")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Array.isArray(data?.shift_frequent_procedures)
    ? data.shift_frequent_procedures
    : null;
};

/**
 * Solo la columna de frecuentes: el upsert no toca las demás de la fila
 * (quick_activity_ids y compañía las escribe el Libro).
 */
export const saveFrequentProcedures = async (userId, procedures = []) => {
  if (!userId) throw new Error("User ID is required");

  const value = procedures
    .map((item) => ({
      node_id: item.node_id || null,
      name: String(item.name || "").trim(),
    }))
    .filter((item) => item.name);

  const { data, error } = await supabase
    .from("libro_user_settings")
    .upsert([{ user_id: userId, shift_frequent_procedures: value }], {
      onConflict: "user_id",
    })
    .select("shift_frequent_procedures")
    .single();

  if (error) throw error;
  return data?.shift_frequent_procedures || value;
};

/**
 * El Libro de Actividad asistencial en uso: su libro, sus actividades y sus
 * registros. Si el residente nunca ha abierto el Libro, se le siembra igual que
 * al abrirlo (ADR 0013), para que tenga dónde apuntar.
 */
export const getDebriefLibro = async (userProfile) => {
  const userId = userProfile?.id;
  if (!userId) return { book: null, nodes: [], entries: [] };

  let data = await getAllLibroData(userId, SHIFT_DEBRIEF_SECTION);
  if (!data.book) {
    const specialityId = userProfile.speciality_id || null;
    let specialtyName = "";
    if (specialityId) {
      const { success, specialty } = await getSpecialtyById(specialityId);
      if (success) specialtyName = specialty?.name || "";
    }
    const seeded = await ensureLibroForResident({
      userId,
      specialityId,
      specialtyName,
      residencyYear: userProfile.resident_year || 1,
    });
    if (seeded) data = await getAllLibroData(userId, SHIFT_DEBRIEF_SECTION);
  }

  return {
    book: data.book,
    nodes: data.nodes || [],
    entries: data.entries || [],
  };
};

/** Si el residente puede añadir actividades a ese libro (Libro propio activo). */
export const canAddLibroProcedures = (book) =>
  Boolean(book && book.status === "active" && !book.template_id);

/** Un procedimiento personalizado, como actividad de un área de su Libro propio. */
export const createLibroProcedure = async ({ userId, book, areaId, name }) => {
  const node = await createNode(
    {
      book_id: book.id,
      section: SHIFT_DEBRIEF_SECTION,
      parent_node_id: areaId,
      name: String(name || "").trim(),
      tracking_mode: "counter",
    },
    userId,
  );
  return { node_id: node.id, name: node.name };
};

/** Lo que el Libro tiene ahora de esas actividades en las fechas de la guardia. */
export const getLibroCountsForShift = async (shift, nodeIds = []) => {
  if (!nodeIds.length) return {};

  const { data, error } = await supabase
    .from("libro_entry")
    .select("node_id, count, performed_at")
    .in("node_id", nodeIds)
    .in("performed_at", getShiftLibroDates(shift));

  if (error) throw error;
  return sumLibroCountsForShift(data || [], shift);
};

/**
 * Deja en el Libro lo que dicen los contadores, escribiendo solo la diferencia
 * con lo que ya tenía en las fechas de la guardia. Todo con la fecha de la
 * guardia y su id en payload, para que si la guardia cambia de fecha los
 * registros se muevan con ella (trigger en la BD).
 *
 * La diferencia se calcula contra lo que el Libro tiene AHORA, releído justo
 * antes de escribir: si un guardado falla a medias (o se registra a la vez desde
 * el Libro), reintentar no vuelve a escribir lo que ya entró.
 *
 * @returns {Promise<Record<string, number>>} lo que el Libro tiene al acabar
 */
export const syncDebriefWithLibro = async ({
  userId,
  shift,
  book,
  desiredCounts = {},
}) => {
  if (!book || book.status !== "active") return null;

  const current = await getLibroCountsForShift(
    shift,
    Object.keys(desiredCounts),
  );
  const deltas = computeLibroDeltas(current, desiredCounts);
  for (const { nodeId, delta } of deltas) {
    await createEntry(
      nodeId,
      {
        count: delta,
        residency_year: book.residency_year || null,
        performed_at: shift.event_date,
        payload: { agenda_event_id: shift.id, source: "shift_debrief" },
      },
      SHIFT_DEBRIEF_SECTION,
      userId,
    );
  }
  return { ...current, ...desiredCounts };
};
