import { supabase } from "../config/supabase";
import { findUndoTarget } from "../utils/libroUndo";
import { getLibroCategorySuggestions } from "../data/libroOnboardingTemplates";
import {
  DEFAULT_LIBRO_SECTION,
  LIBRO_OWN_BOOK_SECTIONS,
} from "../data/libroSections";

const DEFAULT_TRACKING_MODE = "counter";
const DEFAULT_NODE_COLOR = "violet";

const mapNodePayload = (nodeData = {}) => ({
  name: nodeData.name,
  parent_node_id: nodeData.parent_node_id || null,
  goal: nodeData.goal || null,
  icon_name: nodeData.icon_name || null,
  color_token: nodeData.color_token || DEFAULT_NODE_COLOR,
  tracking_mode: nodeData.tracking_mode || DEFAULT_TRACKING_MODE,
});

const LIBRO_NODE_BOOK_RELATION = `
  id,
  user_id,
  section,
  book_id,
  parent_node_id,
  book:libro_book!libro_node_book_id_fkey(
    id,
    user_id,
    section,
    residency_year,
    status,
    archived_at,
    created_at,
    updated_at
  )
`;

const ensureEditableBook = (book) => {
  if (!book) {
    throw new Error("Libro no encontrado");
  }

  if (book.status !== "active") {
    throw new Error("El libro archivado es de solo lectura");
  }
};

const getLibroBookById = async (bookId, userId, section) => {
  const query = supabase
    .from("libro_book")
    .select("*")
    .eq("id", bookId)
    .eq("user_id", userId);

  if (section) {
    query.eq("section", section);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error("Error fetching libro book by id:", error);
    throw error;
  }

  return data;
};

const getLibroNodeContext = async (nodeId, userId) => {
  const { data, error } = await supabase
    .from("libro_node")
    .select(LIBRO_NODE_BOOK_RELATION)
    .eq("id", nodeId)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error fetching libro node context:", error);
    throw error;
  }

  return data;
};

const getLibroEventContext = async (eventId) => {
  const { data, error } = await supabase
    .from("libro_event")
    .select("id, entry_id, node_id, user_id")
    .eq("id", eventId)
    .single();

  if (error) {
    console.error("Error fetching libro event context:", error);
    throw error;
  }

  return data;
};

/**
 * Todos los libros del residente, de cualquier sección.
 *
 * Es la única forma de saber qué bloques le ha dado su tutor: getLibroBooks exige
 * una sección, así que solo sirve cuando ya sabes cuál mirar.
 *
 * @param {string} userId - ID del residente
 * @returns {Promise<Array>} Libros del residente, activos antes que archivados
 */
export const getLibroBooksForUser = async (userId) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const { data, error } = await supabase
      .from("libro_book")
      .select("*")
      .eq("user_id", userId)
      .order("status", { ascending: true })
      .order("residency_year", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching libro books for user:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Exception in getLibroBooksForUser:", error);
    throw error;
  }
};

export const getLibroBooks = async (userId, section) => {
  try {
    if (!userId || !section) {
      throw new Error("User ID and section are required");
    }

    const { data, error } = await supabase
      .from("libro_book")
      .select("*")
      .eq("user_id", userId)
      .eq("section", section)
      .order("status", { ascending: true })
      .order("residency_year", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching libro books:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Exception in getLibroBooks:", error);
    throw error;
  }
};

export const ensureActiveLibroBook = async ({
  userId,
  section,
  residencyYear = 1,
}) => {
  try {
    if (!userId || !section) {
      throw new Error("User ID and section are required");
    }

    const { data: existingBook, error: fetchError } = await supabase
      .from("libro_book")
      .select("*")
      .eq("user_id", userId)
      .eq("section", section)
      .eq("status", "active")
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching active libro book:", fetchError);
      throw fetchError;
    }

    if (existingBook) {
      return existingBook;
    }

    const { data, error } = await supabase
      .from("libro_book")
      .insert([
        {
          user_id: userId,
          section,
          residency_year: residencyYear || 1,
          status: "active",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating active libro book:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in ensureActiveLibroBook:", error);
    throw error;
  }
};

/**
 * Servicio para gestionar el Libro de Residente
 * Maneja nodos (padres e hijos), entradas y eventos
 */

/**
 * Obtiene todos los nodos, entradas y eventos de una sección
 * @param {string} userId - ID del usuario
 * @param {string} section - Código de la sección (ej: "clinical_practice")
 * @returns {Promise<Object>} Objeto con nodes, entries y events
 */
export const getAllLibroData = async (userId, section, bookId = null) => {
  try {
    if (!userId || !section) {
      throw new Error("User ID and section are required");
    }

    let selectedBook = null;

    if (bookId) {
      selectedBook = await getLibroBookById(bookId, userId, section);
    } else {
      const books = await getLibroBooks(userId, section);
      selectedBook =
        books.find((book) => book.status === "active") || books[0] || null;
    }

    if (!selectedBook) {
      return {
        book: null,
        nodes: [],
        entries: [],
        events: [],
      };
    }

    const query = supabase
      .from("libro_node")
      .select("*,entries:libro_entry(*),events:libro_event(*)")
      .eq("book_id", selectedBook.id)
      .order("position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching libro data:", error);
      throw error;
    }

    // Procesar los datos
    const nodesData = data || [];
    const entriesData = [];
    const eventsData = [];

    // Extraer entries y events de los datos anidados y limpiar los nodos
    const cleanedNodes = nodesData.map((node) => {
      // Extraer entries y events
      if (node.entries && Array.isArray(node.entries)) {
        entriesData.push(...node.entries);
      }
      if (node.events && Array.isArray(node.events)) {
        eventsData.push(...node.events);
      }

      // Retornar el nodo sin los campos anidados
      const { entries, events, ...cleanedNode } = node;
      return cleanedNode;
    });

    // Asignar posiciones automáticamente a nodos padre que no tienen position (null)
    // Esto maneja el caso de nodos existentes creados antes de agregar la columna position
    const parentNodesWithoutPosition = cleanedNodes.filter(
      (node) =>
        !node.parent_node_id &&
        (node.position === null || node.position === undefined)
    );

    if (parentNodesWithoutPosition.length > 0) {
      // Obtener la posición máxima actual (ignorando nulls)
      const nodesWithPosition = cleanedNodes.filter(
        (node) =>
          !node.parent_node_id &&
          node.position !== null &&
          node.position !== undefined
      );
      const maxPosition =
        nodesWithPosition.length > 0
          ? Math.max(...nodesWithPosition.map((n) => n.position))
          : -1;

      // Asignar posiciones secuenciales a los nodos sin position
      parentNodesWithoutPosition.forEach((node, index) => {
        node.position = maxPosition + 1 + index;
      });

      // Actualizar en la base de datos (en segundo plano, no bloquea la respuesta)
      parentNodesWithoutPosition.forEach(async (node) => {
        try {
          await supabase
            .from("libro_node")
            .update({ position: node.position })
            .eq("id", node.id)
            .eq("book_id", selectedBook.id);
        } catch (error) {
          // Silently fail - no es crítico si falla
          console.error("Error auto-assigning position:", error);
        }
      });
    }

    return {
      book: selectedBook,
      nodes: cleanedNodes,
      entries: entriesData,
      events: eventsData,
    };
  } catch (error) {
    console.error("Exception in getAllLibroData:", error);
    throw error;
  }
};

/**
 * Crea un nuevo nodo
 * @param {Object} nodeData - Datos del nodo
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Nodo creado
 */
export const createNode = async (nodeData, userId) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!nodeData.book_id) {
      throw new Error("Book ID is required");
    }

    const book = await getLibroBookById(nodeData.book_id, userId, nodeData.section);
    ensureEditableBook(book);

    // Si es un nodo padre (sin parent_node_id), calcular la posición
    let position = null;
    if (!nodeData.parent_node_id) {
      if (nodeData.position !== undefined && nodeData.position !== null) {
        position = nodeData.position;
      } else {
      // Obtener la posición máxima de los nodos padre en esta sección (ignorando nulls)
        const { data: maxPositionData, error: maxError } = await supabase
          .from("libro_node")
          .select("position")
          .eq("book_id", nodeData.book_id)
          .is("parent_node_id", null)
          .not("position", "is", null)
          .order("position", { ascending: false })
          .limit(1)
          .single();

        if (maxError && maxError.code !== "PGRST116") {
          console.error("Error getting max position:", maxError);
        }

        position =
          maxPositionData?.position !== null &&
          maxPositionData?.position !== undefined
            ? maxPositionData.position + 1
            : 0;
      }
    }

    const newNode = {
      user_id: userId,
      section: nodeData.section,
      book_id: nodeData.book_id,
      position: position,
      ...mapNodePayload(nodeData),
    };

    const { data, error } = await supabase
      .from("libro_node")
      .insert([newNode])
      .select()
      .single();

    if (error) {
      console.error("Error creating node:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in createNode:", error);
    throw error;
  }
};

/**
 * Actualiza un nodo
 * @param {string} nodeId - ID del nodo
 * @param {Object} updates - Datos a actualizar
 * @param {string} userId - ID del usuario (para verificar permisos)
 * @returns {Promise<Object>} Nodo actualizado
 */
export const updateNode = async (nodeId, updates, userId) => {
  try {
    if (!nodeId || !userId) {
      throw new Error("Node ID and User ID are required");
    }

    const nodeContext = await getLibroNodeContext(nodeId, userId);
    ensureEditableBook(nodeContext.book);

    const updatedData = {
      name: updates.name,
    };

    // Incluir goal si está presente (puede ser null para eliminarlo)
    if (updates.goal !== undefined) {
      updatedData.goal = updates.goal;
    }
    if (updates.icon_name !== undefined) {
      updatedData.icon_name = updates.icon_name;
    }
    if (updates.color_token !== undefined) {
      updatedData.color_token = updates.color_token;
    }
    if (updates.tracking_mode !== undefined) {
      updatedData.tracking_mode = updates.tracking_mode;
    }

    const { data, error } = await supabase
      .from("libro_node")
      .update(updatedData)
      .eq("id", nodeId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating node:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in updateNode:", error);
    throw error;
  }
};

/**
 * Elimina un nodo
 * @param {string} nodeId - ID del nodo
 * @param {string} userId - ID del usuario (para verificar permisos)
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
export const deleteNode = async (nodeId, userId) => {
  try {
    if (!nodeId || !userId) {
      throw new Error("Node ID and User ID are required");
    }

    const nodeContext = await getLibroNodeContext(nodeId, userId);
    ensureEditableBook(nodeContext.book);

    // Primero eliminar entradas y eventos relacionados
    const { error: entriesError } = await supabase
      .from("libro_entry")
      .delete()
      .eq("node_id", nodeId);

    if (entriesError) {
      console.error("Error deleting entries:", entriesError);
      throw entriesError;
    }

    const { error: eventsError } = await supabase
      .from("libro_event")
      .delete()
      .eq("node_id", nodeId);

    if (eventsError) {
      console.error("Error deleting events:", eventsError);
      throw eventsError;
    }

    // Función recursiva para eliminar todos los hijos
    const deleteChildrenRecursively = async (parentId) => {
      // Obtener todos los hijos directos
      const { data: children, error: fetchError } = await supabase
        .from("libro_node")
        .select("id")
        .eq("parent_node_id", parentId)
        .eq("user_id", userId);

      if (fetchError) {
        console.error("Error fetching children nodes:", fetchError);
        throw fetchError;
      }

      // Eliminar recursivamente cada hijo
      if (children && children.length > 0) {
        for (const child of children) {
          await deleteChildrenRecursively(child.id);
        }
      }

      // Eliminar entradas y eventos de los hijos
      const { error: entriesError } = await supabase
        .from("libro_entry")
        .delete()
        .eq("node_id", parentId);

      if (entriesError) {
        console.error("Error deleting child entries:", entriesError);
        throw entriesError;
      }

      const { error: eventsError } = await supabase
        .from("libro_event")
        .delete()
        .eq("node_id", parentId);

      if (eventsError) {
        console.error("Error deleting child events:", eventsError);
        throw eventsError;
      }

      // Eliminar el nodo hijo
      const { error: deleteError } = await supabase
        .from("libro_node")
        .delete()
        .eq("id", parentId)
        .eq("user_id", userId);

      if (deleteError) {
        console.error("Error deleting child node:", deleteError);
        throw deleteError;
      }
    };

    // Eliminar todos los hijos recursivamente
    await deleteChildrenRecursively(nodeId);

    // Finalmente eliminar el nodo
    const { error } = await supabase
      .from("libro_node")
      .delete()
      .eq("id", nodeId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting node:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Exception in deleteNode:", error);
    throw error;
  }
};

/**
 * El registro que anularía el siguiente menos de este nodo.
 *
 * El menos inserta un negativo y ese negativo tiene que llevar la fecha del
 * registro que anula, no la del día en que se pulsa: si no, cualquier suma por
 * ventana de fechas sale mal (ver docs/adr/0010). Aquí solo se leen los registros;
 * la decisión de cuál es está en utils/libroUndo.
 *
 * Se leen todos los del nodo a propósito: el saldo no se puede calcular sobre una
 * página. Un nodo acumula los registros de un año, así que son decenas.
 *
 * @param {string} nodeId - ID del nodo
 * @returns {Promise<{entryId: string|null, performedAt: string}|null>} null si no
 *   hay nada que deshacer
 */
export const findEntryToUndo = async (nodeId) => {
  if (!nodeId) return null;

  const { data, error } = await supabase
    .from("libro_entry")
    .select("id, count, performed_at, created_at")
    .eq("node_id", nodeId);

  if (error) {
    console.error("Error reading entries to undo:", error);
    throw error;
  }

  return findUndoTarget(data || []);
};

/**
 * Crea una nueva entrada para un nodo
 * @param {string} nodeId - ID del nodo
 * @param {Object} entryData - Datos de la entrada
 * @param {string} section - Código de la sección (ej: "clinical_practice")
 * @returns {Promise<Object>} Entrada creada
 */
export const createEntry = async (nodeId, entryData, section, userId) => {
  try {
    if (!nodeId || !userId) {
      throw new Error("Node ID and user ID are required");
    }

    if (!section) {
      throw new Error("Section is required");
    }

    const nodeContext = await getLibroNodeContext(nodeId, userId);
    ensureEditableBook(nodeContext.book);

    const newEntry = {
      node_id: nodeId,
      count: entryData.count !== undefined ? entryData.count : 1,
      residency_year: entryData.residency_year || null,
      notes: entryData.notes || null,
      section: section,
      kind: entryData.kind || "counter",
      performed_at: entryData.performed_at || new Date().toISOString().slice(0, 10),
      payload: entryData.payload || {},
    };

    const { data, error } = await supabase
      .from("libro_entry")
      .insert([newEntry])
      .select()
      .single();

    if (error) {
      console.error("Error creating entry:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in createEntry:", error);
    throw error;
  }
};

/**
 * Crea un nuevo evento
 * @param {Object} eventData - Datos del evento
 * @param {string} nodeId - ID del nodo
 * @param {string} section - Código de la sección
 * @returns {Promise<Object>} Evento creado
 */
export const createEvent = async (eventData, nodeId, section) => {
  try {
    if (!nodeId || !section || !eventData?.user_id) {
      throw new Error("Node ID, section and user ID are required");
    }

    const nodeContext = await getLibroNodeContext(nodeId, eventData.user_id);
    ensureEditableBook(nodeContext.book);

    // Primero crear una entrada para el evento
    const entryData = {
      count: 1,
      residency_year: eventData.residency_year || null,
      notes: eventData.notes || eventData.description || null,
      kind: "event",
      performed_at: eventData.event_date,
      payload: {
        title: eventData.title || "",
        hours: eventData.hours || null,
        location: eventData.location || null,
      },
    };

    const entry = await createEntry(nodeId, entryData, section, eventData.user_id);

    // Luego crear el evento vinculado a la entrada
    const newEvent = {
      entry_id: entry.id,
      node_id: nodeId,
      user_id: eventData.user_id,
      event_date: eventData.event_date,
      title: eventData.title || "Evento",
      residency_year: eventData.residency_year || 1,
      hours: eventData.hours || null,
      location: eventData.location || null,
      notes: eventData.notes || eventData.description || null,
    };

    const { data, error } = await supabase
      .from("libro_event")
      .insert([newEvent])
      .select()
      .single();

    if (error) {
      console.error("Error creating event:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in createEvent:", error);
    throw error;
  }
};

/**
 * Actualiza un evento
 * @param {string} eventId - ID del evento
 * @param {Object} updates - Datos a actualizar
 * @returns {Promise<Object>} Evento actualizado
 */
export const updateEvent = async (eventId, updates) => {
  try {
    if (!eventId) {
      throw new Error("Event ID is required");
    }

    const eventContext = await getLibroEventContext(eventId);
    const nodeContext = await getLibroNodeContext(
      eventContext.node_id,
      eventContext.user_id
    );
    ensureEditableBook(nodeContext.book);

    const updatedData = {
      event_date: updates.event_date,
      title: updates.title || "Evento",
      residency_year: updates.residency_year || 1,
      hours: updates.hours || null,
      location: updates.location || null,
      notes: updates.notes || updates.description || null,
    };

    const { data, error } = await supabase
      .from("libro_event")
      .update(updatedData)
      .eq("id", eventId)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in updateEvent:", error);
    throw error;
  }
};

/**
 * Elimina un evento
 * @param {string} eventId - ID del evento
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
export const deleteEvent = async (eventId) => {
  try {
    if (!eventId) {
      throw new Error("Event ID is required");
    }

    const event = await getLibroEventContext(eventId);
    const nodeContext = await getLibroNodeContext(event.node_id, event.user_id);
    ensureEditableBook(nodeContext.book);

    // Eliminar el evento
    const { error: deleteEventError } = await supabase
      .from("libro_event")
      .delete()
      .eq("id", eventId);

    if (deleteEventError) {
      console.error("Error deleting event:", deleteEventError);
      throw deleteEventError;
    }

    // Eliminar la entrada asociada si existe
    if (event?.entry_id) {
      const { error: deleteEntryError } = await supabase
        .from("libro_entry")
        .delete()
        .eq("id", event.entry_id);

      if (deleteEntryError) {
        console.error("Error deleting entry:", deleteEntryError);
        throw deleteEntryError;
      }
    }

    return true;
  } catch (error) {
    console.error("Exception in deleteEvent:", error);
    throw error;
  }
};

/**
 * Actualiza las posiciones de múltiples nodos padre
 * @param {Array} nodesWithPositions - Array de objetos {id: string, position: number}
 * @param {string} userId - ID del usuario (para verificar permisos)
 * @returns {Promise<boolean>} True si se actualizaron correctamente
 */
export const updateNodesPositions = async (nodesWithPositions, userId) => {
  try {
    if (!userId || !Array.isArray(nodesWithPositions)) {
      throw new Error("User ID and nodes array are required");
    }

    // Filtrar nodos válidos (con id y position definidos)
    const validNodes = nodesWithPositions.filter(
      ({ id, position }) => id && position !== null && position !== undefined
    );

    if (validNodes.length === 0) {
      return true; // No hay nada que actualizar
    }

    const { data: nodeContexts, error: nodeContextsError } = await supabase
      .from("libro_node")
      .select("id,book:libro_book!libro_node_book_id_fkey(status)")
      .in(
        "id",
        validNodes.map(({ id }) => id)
      )
      .eq("user_id", userId);

    if (nodeContextsError) {
      console.error("Error fetching nodes for reorder:", nodeContextsError);
      throw nodeContextsError;
    }

    if ((nodeContexts || []).some((node) => node.book?.status !== "active")) {
      throw new Error("No se puede reordenar un libro archivado");
    }

    // Actualizar cada nodo con su nueva posición
    const updatePromises = validNodes.map(({ id, position }) =>
      supabase
        .from("libro_node")
        .update({ position })
        .eq("id", id)
        .eq("user_id", userId)
    );

    const results = await Promise.all(updatePromises);

    // Verificar si hubo errores
    const hasErrors = results.some(({ error }) => error);
    if (hasErrors) {
      const errors = results
        .filter(({ error }) => error)
        .map(({ error }) => error);
      console.error("Error updating nodes positions:", errors);
      throw new Error("Error updating some nodes positions");
    }

    return true;
  } catch (error) {
    console.error("Exception in updateNodesPositions:", error);
    throw error;
  }
};

export const getLibroUserSettings = async (userId) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const { data, error } = await supabase
      .from("libro_user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching libro settings:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in getLibroUserSettings:", error);
    throw error;
  }
};

export const upsertLibroUserSettings = async (userId, settings = {}) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const payload = {
      user_id: userId,
      speciality_id: settings.speciality_id || null,
      onboarding_completed_at: settings.onboarding_completed_at || null,
      onboarding_version: settings.onboarding_version || 1,
      last_used_node_id: settings.last_used_node_id || null,
      quick_activity_ids: settings.quick_activity_ids || [],
    };

    const { data, error } = await supabase
      .from("libro_user_settings")
      .upsert([payload], { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error("Error upserting libro settings:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in upsertLibroUserSettings:", error);
    throw error;
  }
};

/**
 * Completa el Libro propio del residente con los apartados que le falten.
 *
 * El Libro propio nacía con UN apartado (Actividad asistencial, el único que sembraba
 * el alta del residente) mientras que el Libro oficial nace con todos los que el tutor
 * escoge. Eso hacía que el mismo producto se viera muy distinto según el hospital, y
 * es lo que corrige el ADR 0012: los dos caminos tienen los mismos ocho apartados y
 * lo único que cambia es quién pone la estructura de dentro.
 *
 * Aquí solo se crean LIBROS (libro_book), no contenido: Guardias sale de la Agenda,
 * los apartados `form` piden campos por defecto sin plantilla, y Rotaciones,
 * Competencias y Actividad asistencial los rellena el residente.
 *
 * Es IDEMPOTENTE y se llama al abrir el Libro: quien ya lo tenga completo no paga
 * ninguna escritura, y quien montó el suyo hace meses lo ve completo sin hacer nada.
 * No lanza: que falle no debe impedir abrir el libro.
 *
 * Qué NO toca:
 *
 *  - Los años cuyo libro es del tutor (algún libro con template_id): los apartados
 *    los escoge él, y añadirle uno que no ha puesto sería inventarle plan.
 *  - Los residentes sin ningún libro: de esos se encarga ensureLibroForResident, que
 *    siembra el Libro propio entero la primera vez que abren el Libro (ADR 0013).
 *  - Un apartado que ya tenga libro ACTIVO de otro año. El índice
 *    libro_book_one_active_per_user_section_idx solo admite uno activo por apartado,
 *    así que crear el de este año chocaría con el que está en uso.
 *
 * @param {string} userId
 * @returns {Promise<number>} cuántos apartados se han creado
 */
export const ensureOwnLibroSections = async (userId) => {
  try {
    if (!userId) return 0;

    const { data, error } = await supabase
      .from("libro_book")
      .select("section, residency_year, status, template_id")
      .eq("user_id", userId);

    if (error) throw error;

    const books = data || [];
    if (!books.length) return 0;

    // El libro EN USO, que no tiene por qué ser el del año del perfil: el Libro
    // propio no rota de año solo (ADR 0009), así que un R2 puede seguir registrando
    // en el libro que montó siendo R1. Completar otro año le crearía apartados
    // vacíos donde no está escribiendo.
    const ownActive = books.filter(
      (book) => !book.template_id && book.status === "active"
    );
    if (!ownActive.length) return 0;

    const targetYear = Math.max(...ownActive.map((book) => book.residency_year));

    // Ese año es del tutor: los apartados los escoge él.
    if (
      books.some(
        (book) => book.residency_year === targetYear && book.template_id
      )
    ) {
      return 0;
    }

    const takenByActive = new Set(
      books.filter((book) => book.status === "active").map((book) => book.section)
    );
    const takenInYear = new Set(
      books
        .filter((book) => book.residency_year === targetYear)
        .map((book) => book.section)
    );

    const missing = LIBRO_OWN_BOOK_SECTIONS.filter(
      (section) => !takenByActive.has(section) && !takenInYear.has(section)
    );

    if (!missing.length) return 0;

    const { error: insertError } = await supabase.from("libro_book").insert(
      missing.map((section) => ({
        user_id: userId,
        section,
        residency_year: targetYear,
        status: "active",
      }))
    );

    if (insertError) throw insertError;

    return missing.length;
  } catch (error) {
    console.error("Exception in ensureOwnLibroSections:", error);
    return 0;
  }
};

export const createLibroStructure = async ({
  userId,
  section,
  specialityId = null,
  categories = [],
  residencyYear = 1,
}) => {
  try {
    if (!userId || !section) {
      throw new Error("User ID and section are required");
    }

    const activeBook = await ensureActiveLibroBook({
      userId,
      section,
      residencyYear,
    });

    const createdParents = [];

    for (const [index, category] of categories.entries()) {
      const parent = await createNode(
        {
          book_id: activeBook.id,
          section,
          name: category.name,
          icon_name: category.icon_name,
          color_token: category.color_token,
          tracking_mode: DEFAULT_TRACKING_MODE,
          position: index,
        },
        userId
      );

      createdParents.push(parent);

      for (const activity of category.activities || []) {
        await createNode(
          {
            book_id: activeBook.id,
            section,
            name: activity.name,
            parent_node_id: parent.id,
            goal: activity.goal || null,
            tracking_mode: activity.tracking_mode || DEFAULT_TRACKING_MODE,
            icon_name: activity.icon_name || category.icon_name || null,
            color_token: activity.color_token || category.color_token || DEFAULT_NODE_COLOR,
          },
          userId
        );
      }
    }

    // Aquí solo se monta Actividad asistencial, pero el libro que sale de aquí tiene
    // los mismos ocho apartados que el del tutor (ADR 0012). Los otros siete nacen
    // vacíos: Guardias se llena desde la Agenda, los `form` piden ya sus campos por
    // defecto, y Rotaciones y Competencias las escribe el residente.
    await ensureOwnLibroSections(userId);

    await upsertLibroUserSettings(userId, {
      speciality_id: specialityId,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_version: 1,
      quick_activity_ids: [],
    });

    return createdParents;
  } catch (error) {
    console.error("Exception in createLibroStructure:", error);
    throw error;
  }
};

/**
 * El libro que se encuentra un residente la primera vez que abre el Libro.
 *
 * Antes esto era un asistente de cuatro pasos: el residente tenía que inventarse
 * sus Áreas de actividad antes de poder ver nada. Pedirle que diseñe la estructura
 * de su libro el día que estrena la app es pedirle una decisión que todavía no sabe
 * tomar, y el que abre el Libro con un tutor detrás no pasa por ahí: se encuentra
 * el libro montado. Ahora se encuentra lo mismo el que no lo tiene.
 *
 * Se le siembra el Libro propio completo —los ocho apartados (ADR 0012)— con las
 * Áreas de actividad sugeridas para su especialidad ya puestas. Todo es suyo: puede
 * renombrarlas, borrarlas y añadir las que quiera desde el propio Libro, que es
 * donde tiene sentido hacerlo y no en un formulario previo.
 *
 * NO hace nada si ya tiene algún libro. Eso cubre a la vez al residente que ya
 * montó el suyo, al que se lo sembró su hospital al darse de alta
 * (`apply_libro_template_for_user`) y a la segunda llamada de una carrera entre dos
 * dispositivos.
 *
 * @param {{userId: string, specialityId?: string|null, specialtyName?: string, residencyYear?: number}} params
 * @returns {Promise<boolean>} si ha sembrado algo
 */
export const ensureLibroForResident = async ({
  userId,
  specialityId = null,
  specialtyName = "",
  residencyYear = 1,
}) => {
  if (!userId) return false;

  const { data, error } = await supabase
    .from("libro_book")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    console.error("Error checking libro books before seeding:", error);
    throw error;
  }

  if (data?.length) return false;

  await createLibroStructure({
    userId,
    section: DEFAULT_LIBRO_SECTION,
    specialityId,
    categories: getLibroCategorySuggestions(specialtyName),
    residencyYear: residencyYear || 1,
  });

  return true;
};

export const archiveLibroBookAndStartNewYear = async ({
  userId,
  section,
  nextResidencyYear,
}) => {
  try {
    if (!userId || !section || !nextResidencyYear) {
      throw new Error("User ID, section and next residency year are required");
    }

    const { data, error } = await supabase.rpc(
      "archive_libro_book_and_start_new_year",
      {
        p_user_id: userId,
        p_section: section,
        p_next_residency_year: nextResidencyYear,
      }
    );

    if (error) {
      console.error("Error archiving libro and starting new year:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Exception in archiveLibroBookAndStartNewYear:", error);
    throw error;
  }
};

export default {
  getAllLibroData,
  getLibroBooks,
  getLibroBooksForUser,
  ensureActiveLibroBook,
  createNode,
  updateNode,
  deleteNode,
  createEntry,
  createEvent,
  updateEvent,
  deleteEvent,
  updateNodesPositions,
  getLibroUserSettings,
  upsertLibroUserSettings,
  createLibroStructure,
  ensureLibroForResident,
  ensureOwnLibroSections,
  archiveLibroBookAndStartNewYear,
};
