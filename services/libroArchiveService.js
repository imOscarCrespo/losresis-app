import { supabase } from "../config/supabase";
import {
  getLibroSectionArchetype,
  getLibroSectionLabel,
  sortLibroSectionCodes,
} from "../data/libroSections";
import { isInResidencyYear } from "../utils/residencyYear";

/**
 * Todo el Libro del Residente de un usuario, de todos sus años y apartados.
 *
 * Existe porque Migrar a la plantilla es destructivo (borra el libro propio del año
 * con todo lo registrado dentro) y el residente tiene que poder llevarse su libro
 * antes. El alcance es TODO su libro, no solo el año en riesgo: así el PDF es un
 * archivo de verdad y el residente no tiene que razonar sobre qué año pierde.
 *
 * Ojo con dos cosas del esquema:
 *
 *  - libro_entry NO tiene user_id. Cuelga de un nodo (arquetipos itinerary y tree)
 *    o del libro (arquetipo form, book_id). Hay que ir por las dos vías: los 1.453
 *    registros que existen hoy son todos por node_id, con book_id a null.
 *  - libro_event está muerta (0 filas, ver ADR 0025 del panel). No se lee.
 *
 * Las Guardias no salen del libro sino de la Agenda (arquetipo automatic), así que
 * se devuelven aparte y agrupadas por año de residencia: son del residente aunque
 * su plantilla no incluya el apartado.
 */
export const getLibroArchive = async (userId, currentResidencyYear = null) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const [booksResult, nodesResult, progressResult, shiftsResult] =
    await Promise.all([
      supabase
        .from("libro_book")
        .select("*")
        .eq("user_id", userId)
        .order("residency_year", { ascending: true }),
      supabase
        .from("libro_node")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase.from("libro_node_progress").select("*").eq("user_id", userId),
      supabase
        .from("agenda_events")
        .select("id,event_date,title,notes,metadata")
        .eq("user_id", userId)
        .eq("event_type", "shift")
        .order("event_date", { ascending: true }),
    ]);

  for (const result of [booksResult, nodesResult, progressResult, shiftsResult]) {
    if (result.error) {
      console.error("Error building libro archive:", result.error);
      throw result.error;
    }
  }

  const books = booksResult.data || [];
  const nodes = nodesResult.data || [];

  // Los registros, por las dos vías. Se piden por lotes de ids en vez de por
  // usuario porque libro_entry no sabe de quién es.
  const nodeIds = nodes.map((node) => node.id);
  const bookIds = books.map((book) => book.id);

  const [byNode, byBook] = await Promise.all([
    nodeIds.length
      ? supabase.from("libro_entry").select("*").in("node_id", nodeIds)
      : Promise.resolve({ data: [], error: null }),
    bookIds.length
      ? supabase.from("libro_entry").select("*").in("book_id", bookIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [byNode, byBook]) {
    if (result.error) {
      console.error("Error fetching libro entries for archive:", result.error);
      throw result.error;
    }
  }

  // Un registro con node_id Y book_id saldría en las dos consultas.
  const entriesById = new Map();
  [...(byNode.data || []), ...(byBook.data || [])].forEach((entry) => {
    entriesById.set(entry.id, entry);
  });
  const entries = [...entriesById.values()];

  const progressByNode = new Map(
    (progressResult.data || []).map((row) => [row.node_id, row])
  );

  const nodesByBook = new Map();
  nodes.forEach((node) => {
    if (!node.book_id) return;
    if (!nodesByBook.has(node.book_id)) nodesByBook.set(node.book_id, []);
    nodesByBook.get(node.book_id).push(node);
  });

  const entriesByNode = new Map();
  const entriesByBook = new Map();
  entries.forEach((entry) => {
    if (entry.node_id) {
      if (!entriesByNode.has(entry.node_id)) entriesByNode.set(entry.node_id, []);
      entriesByNode.get(entry.node_id).push(entry);
    } else if (entry.book_id) {
      if (!entriesByBook.has(entry.book_id)) entriesByBook.set(entry.book_id, []);
      entriesByBook.get(entry.book_id).push(entry);
    }
  });

  // Un libro por apartado y año, con su estructura ya montada en árbol. El nivel
  // de agrupación solo se usa de verdad en el arquetipo tree; en itinerary los
  // nodos son raíces planas y children queda vacío.
  const hydrated = books.map((book) => {
    const bookNodes = nodesByBook.get(book.id) || [];
    const roots = bookNodes.filter((node) => !node.parent_node_id);

    const buildNode = (node) => ({
      ...node,
      progress: progressByNode.get(node.id) || null,
      entries: entriesByNode.get(node.id) || [],
      children: bookNodes
        .filter((child) => child.parent_node_id === node.id)
        .map(buildNode),
    });

    return {
      ...book,
      archetype: getLibroSectionArchetype(book.section),
      label: getLibroSectionLabel(book.section),
      nodes: roots.map(buildNode),
      // Solo los del arquetipo form: los de los demás cuelgan de su nodo.
      entries: entriesByBook.get(book.id) || [],
    };
  });

  // Años de mayor a menor, y dentro de cada año los apartados en el orden del
  // catálogo, que es el mismo en el que se los ofrecieron al tutor.
  const years = [...new Set(hydrated.map((book) => book.residency_year))]
    .filter(Boolean)
    .sort((a, b) => b - a);

  const allShifts = shiftsResult.data || [];

  // Sin resident_year en el perfil no hay forma de anclar la ventana de junio a
  // mayo, y repartir a ciegas duplicaría cada guardia en cada año. En ese caso van
  // todas a un bloque aparte, sin año.
  const canAnchorShifts = !!Number(currentResidencyYear);
  const assignedShiftIds = new Set();

  const booksByYear = years.map((year) => {
    // El activo primero, por si hay dos del mismo apartado en el año: el archivado no
    // debe tapar al activo en el PDF.
    const yearBooks = hydrated
      .filter((book) => book.residency_year === year)
      .sort((a, b) => (a.status === "active" ? -1 : 0) - (b.status === "active" ? -1 : 0));
    const order = sortLibroSectionCodes(yearBooks.map((book) => book.section));

    const shifts = canAnchorShifts
      ? allShifts.filter((shift) =>
          isInResidencyYear(shift.event_date, year, currentResidencyYear)
        )
      : [];

    shifts.forEach((shift) => assignedShiftIds.add(shift.id));

    return {
      residencyYear: year,
      books: order
        .map((section) => yearBooks.find((book) => book.section === section))
        .filter(Boolean),
      shifts,
    };
  });

  return {
    booksByYear,
    // Las que no caen en ningún año del libro: guardias anteriores al primer libro,
    // o todas si no se pudo anclar la ventana. No se tiran: son suyas.
    unassignedShifts: allShifts.filter((shift) => !assignedShiftIds.has(shift.id)),
    totalBooks: hydrated.length,
    totalEntries: entries.length,
    totalShifts: allShifts.length,
  };
};



/**
 * Cuántos registros tiene el residente en un año concreto.
 *
 * Se usa para decirle exactamente qué pierde al Migrar a la plantilla, antes de
 * generar el PDF. Va por las dos vías porque libro_entry no tiene user_id: los
 * registros del arquetipo form cuelgan del libro y los demás de su nodo.
 */
export const countLibroEntriesForYear = async (userId, residencyYear) => {
  if (!userId || !residencyYear) return 0;

  const { data: books, error: booksError } = await supabase
    .from("libro_book")
    .select("id")
    .eq("user_id", userId)
    .eq("residency_year", residencyYear);

  if (booksError) {
    console.error("Error counting libro entries (books):", booksError);
    throw booksError;
  }

  const bookIds = (books || []).map((book) => book.id);
  if (!bookIds.length) return 0;

  const { data: nodes, error: nodesError } = await supabase
    .from("libro_node")
    .select("id")
    .in("book_id", bookIds);

  if (nodesError) {
    console.error("Error counting libro entries (nodes):", nodesError);
    throw nodesError;
  }

  const nodeIds = (nodes || []).map((node) => node.id);

  const [byBook, byNode] = await Promise.all([
    supabase
      .from("libro_entry")
      .select("id", { count: "exact", head: true })
      .in("book_id", bookIds),
    nodeIds.length
      ? supabase
          .from("libro_entry")
          .select("id", { count: "exact", head: true })
          .in("node_id", nodeIds)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  for (const result of [byBook, byNode]) {
    if (result.error) {
      console.error("Error counting libro entries:", result.error);
      throw result.error;
    }
  }

  return (byBook.count || 0) + (byNode.count || 0);
};

export default {
  getLibroArchive,
  countLibroEntriesForYear,
};
