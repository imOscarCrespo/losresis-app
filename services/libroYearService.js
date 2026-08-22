import { supabase } from "../config/supabase";
import {
  getLibroSectionArchetype,
  getLibroSectionLabel,
  isLibroProgressDone,
  isRetiredLibroSection,
  sortLibroSectionCodes,
} from "../data/libroSections";
import { getResidencyYearWindow } from "../utils/residencyYear";

/**
 * Lo que el índice del Libro del Residente necesita de un año: qué apartados tiene,
 * cuánto lleva en cada uno y el Progreso del año.
 *
 * Un apartado se pinta según su ARQUETIPO, y el contador significa cosas distintas
 * en cada uno, así que se calcula por separado:
 *
 *   itinerary  cuántas fichas ha completado de las que el tutor definió
 *   tree       cuántos registros ha acumulado
 *   form       cuántas filas ha creado
 *   automatic  cuántas guardias caen en el año, desde la Agenda
 *
 * El Progreso del año (docs/adr/0008) NO es la media de esos contadores: solo mide
 * lo que el tutor ha fijado como objetivo, o sea las fichas de itinerario y las
 * actividades de `tree` que tengan meta. Cursos, Congresos, Sesiones, Investigación
 * y Guardias no tienen objetivo contra el que medir y quedan fuera del denominador.
 */

/** Los apartados retirados de la plantilla no se pintan (ADR 0025 del panel). */
const isVisibleSection = (section) => !isRetiredLibroSection(section);

export const getLibroYearOverview = async (
  userId,
  residencyYear,
  currentResidencyYear = null
) => {
  if (!userId || !residencyYear) {
    return { sections: [], progress: null };
  }

  const { data: books, error: booksError } = await supabase
    .from("libro_book")
    .select("id, section, residency_year, status, template_id")
    .eq("user_id", userId)
    .eq("residency_year", residencyYear);

  if (booksError) {
    console.error("Error fetching libro books for year:", booksError);
    throw booksError;
  }

  // El activo primero: si hay dos libros del mismo apartado y año (uno archivado y
  // otro activo), el que manda es el activo, y el `find` de abajo coge el primero.
  const visibleBooks = (books || [])
    .filter((book) => isVisibleSection(book.section))
    .sort((a, b) => (a.status === "active" ? -1 : 0) - (b.status === "active" ? -1 : 0));
  const bookIds = visibleBooks.map((book) => book.id);

  const [nodesResult, formEntriesResult, shiftsResult] = await Promise.all([
    bookIds.length
      ? supabase
          .from("libro_node")
          .select("id, book_id, parent_node_id, goal, total_count, section")
          .in("book_id", bookIds)
      : Promise.resolve({ data: [], error: null }),
    bookIds.length
      ? supabase.from("libro_entry").select("id, book_id").in("book_id", bookIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("agenda_events")
      .select("id, event_date")
      .eq("user_id", userId)
      .eq("event_type", "shift"),
  ]);

  for (const result of [nodesResult, formEntriesResult, shiftsResult]) {
    if (result.error) {
      console.error("Error fetching libro year overview:", result.error);
      throw result.error;
    }
  }

  const nodes = nodesResult.data || [];
  const nodeIds = nodes.map((node) => node.id);

  const { data: progressRows, error: progressError } = nodeIds.length
    ? await supabase
        .from("libro_node_progress")
        .select("node_id, status")
        .in("node_id", nodeIds)
    : { data: [], error: null };

  if (progressError) {
    console.error("Error fetching libro node progress:", progressError);
    throw progressError;
  }

  const progressByNode = new Map(
    (progressRows || []).map((row) => [row.node_id, row.status])
  );

  // Las guardias del año, por la ventana de junio a mayo. Sin resident_year no se
  // puede anclar y se cuentan todas: es mejor un número de más que esconderle sus
  // guardias.
  const window = getResidencyYearWindow(residencyYear, currentResidencyYear);
  const shifts = (shiftsResult.data || []).filter((shift) => {
    if (!window) return true;
    const date = new Date(shift.event_date);
    return !Number.isNaN(date.getTime()) && date >= window.start && date < window.end;
  });

  const formEntryCount = new Map();
  (formEntriesResult.data || []).forEach((entry) => {
    formEntryCount.set(entry.book_id, (formEntryCount.get(entry.book_id) || 0) + 1);
  });

  // El denominador del Progreso del año.
  let goalsTotal = 0;
  let goalsDone = 0;

  const sections = sortLibroSectionCodes(
    visibleBooks.map((book) => book.section)
  ).map((section) => {
    const book = visibleBooks.find((item) => item.section === section);
    const archetype = getLibroSectionArchetype(section);
    const bookNodes = nodes.filter((node) => node.book_id === book.id);

    let count = 0;
    let total = null;

    if (archetype === "itinerary") {
      // Los elementos son nodos raíz planos: no hay nivel de agrupación.
      const items = bookNodes.filter((node) => !node.parent_node_id);
      total = items.length;
      count = items.filter((node) =>
        isLibroProgressDone(section, progressByNode.get(node.id) || "pending")
      ).length;

      goalsTotal += total;
      goalsDone += count;
    } else if (archetype === "tree") {
      const activities = bookNodes.filter((node) => node.parent_node_id);
      count = activities.reduce((sum, node) => sum + (node.total_count || 0), 0);

      // Solo las actividades con meta entran en el progreso: sin meta no hay nada
      // contra lo que medir.
      activities
        .filter((node) => node.goal > 0)
        .forEach((node) => {
          goalsTotal += 1;
          if ((node.total_count || 0) >= node.goal) goalsDone += 1;
        });
    } else if (archetype === "form") {
      count = formEntryCount.get(book.id) || 0;
    } else if (archetype === "automatic") {
      count = shifts.length;
    }

    return {
      section,
      label: getLibroSectionLabel(section),
      archetype,
      bookId: book.id,
      templateId: book.template_id || null,
      isOfficial: !!book.template_id,
      isArchived: book.status === "archived",
      count,
      total,
    };
  });

  return {
    sections,
    progress: goalsTotal
      ? {
          done: goalsDone,
          total: goalsTotal,
          percent: Math.round((goalsDone / goalsTotal) * 100),
        }
      : null,
  };
};

/**
 * Un apartado del arquetipo `itinerary`: la lista que definió el tutor, cada
 * elemento con su ficha.
 *
 * El residente NO crea ni borra elementos. Completa una ficha por elemento.
 */
export const getLibroItinerary = async (bookId) => {
  if (!bookId) return [];

  const { data: nodes, error } = await supabase
    .from("libro_node")
    .select(
      "id, name, description, center, duration_amount, duration_unit, position, section, comments_mode"
    )
    .eq("book_id", bookId)
    .is("parent_node_id", null)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching libro itinerary:", error);
    throw error;
  }

  const ids = (nodes || []).map((node) => node.id);

  const { data: progressRows, error: progressError } = ids.length
    ? await supabase
        .from("libro_node_progress")
        .select("*")
        .in("node_id", ids)
    : { data: [], error: null };

  if (progressError) {
    console.error("Error fetching itinerary progress:", progressError);
    throw progressError;
  }

  const byNode = new Map((progressRows || []).map((row) => [row.node_id, row]));

  return (nodes || []).map((node) => ({
    ...node,
    progress: byNode.get(node.id) || null,
  }));
};

/**
 * Guarda la ficha de un elemento de itinerario.
 *
 * En Rotaciones el estado lo mueve el residente (es su itinerario). En Competencias
 * el nivel lo pone el TUTOR al cerrar una evaluación (set_evaluation_competency),
 * así que desde aquí solo se escribe el payload: pasar status en competencias
 * pisaría lo que ha valorado el tutor.
 */
export const saveLibroNodeProgress = async ({
  nodeId,
  userId,
  section,
  status,
  payload,
}) => {
  if (!nodeId || !userId) {
    throw new Error("nodeId and userId are required");
  }

  const isTutorOwned = section === "competencies";

  const row = {
    node_id: nodeId,
    user_id: userId,
    payload: payload || {},
  };

  if (!isTutorOwned && status) {
    row.status = status;
    row.completed_at = status === "completed" ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("libro_node_progress")
    .upsert(row, { onConflict: "node_id" })
    .select("*")
    .single();

  if (error) {
    console.error("Error saving libro node progress:", error);
    throw error;
  }

  return data;
};

/**
 * La configuración del apartado `form`, leída EN VIVO de la plantilla.
 *
 * No se clona al libro a propósito: si el tutor activa un campo, el residente lo ve
 * sin que haya que resembrar nada.
 */
export const getLibroFormConfig = async (templateId, section, residencyYear) => {
  if (!templateId || !section || !residencyYear) return null;

  const { data, error } = await supabase
    .from("libro_template_block")
    .select("config")
    .eq("template_id", templateId)
    .eq("section", section)
    // La plantilla llega hasta R5; un R6 hereda la de R5.
    .eq("residency_year", Math.min(Math.max(residencyYear, 1), 5))
    .maybeSingle();

  if (error) {
    console.error("Error fetching libro form config:", error);
    return null;
  }

  return data?.config || null;
};

export const getLibroFormEntries = async (bookId) => {
  if (!bookId) return [];

  const { data, error } = await supabase
    .from("libro_entry")
    .select("*")
    .eq("book_id", bookId)
    .order("performed_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching libro form entries:", error);
    throw error;
  }

  return data || [];
};

/**
 * Una fila del arquetipo `form`. Cuelga del LIBRO, no de un nodo: el tutor no sabe
 * a qué congresos irá el residente, así que esas filas no corresponden a ningún
 * nodo de plantilla.
 */
export const saveLibroFormEntry = async ({
  entryId = null,
  bookId,
  section,
  payload,
  residencyYear,
}) => {
  if (!bookId || !section) {
    throw new Error("bookId and section are required");
  }

  const row = {
    book_id: bookId,
    node_id: null,
    section,
    count: 1,
    kind: "counter",
    payload: payload || {},
    // performed_at ordena el listado. El campo `date` es el que rellena el
    // residente; sin él, la fila se ordena por cuándo la creó.
    performed_at: payload?.date || new Date().toISOString().slice(0, 10),
    notes: payload?.notes || null,
    residency_year: residencyYear || null,
  };

  const query = entryId
    ? supabase.from("libro_entry").update(row).eq("id", entryId)
    : supabase.from("libro_entry").insert(row);

  const { data, error } = await query.select("*").single();

  if (error) {
    console.error("Error saving libro form entry:", error);
    throw error;
  }

  return data;
};

export const deleteLibroFormEntry = async (entryId) => {
  if (!entryId) return;

  const { error } = await supabase.from("libro_entry").delete().eq("id", entryId);

  if (error) {
    console.error("Error deleting libro form entry:", error);
    throw error;
  }
};

/**
 * Las guardias del año, leídas de la Agenda: el arquetipo `automatic` no lo escribe
 * nadie a mano. `notes` es la observación que el residente ya pone en su agenda, así
 * que no se duplica en el libro.
 */
export const getLibroShifts = async (
  userId,
  residencyYear,
  currentResidencyYear = null
) => {
  if (!userId) return [];

  const window = getResidencyYearWindow(residencyYear, currentResidencyYear);

  let query = supabase
    .from("agenda_events")
    .select("id, event_date, title, notes, metadata")
    .eq("user_id", userId)
    .eq("event_type", "shift")
    .order("event_date", { ascending: false });

  if (window) {
    query = query
      .gte("event_date", window.start.toISOString().slice(0, 10))
      .lt("event_date", window.end.toISOString().slice(0, 10));
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching libro shifts:", error);
    throw error;
  }

  return data || [];
};

export default {
  getLibroYearOverview,
  getLibroItinerary,
  saveLibroNodeProgress,
  getLibroFormConfig,
  getLibroFormEntries,
  saveLibroFormEntry,
  deleteLibroFormEntry,
  getLibroShifts,
};
