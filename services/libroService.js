import { supabase } from "../config/supabase";

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
export const getAllLibroData = async (userId, section) => {
  try {
    if (!userId || !section) {
      throw new Error("User ID and section are required");
    }

    const query = supabase
      .from("libro_node")
      .select("*,entries:libro_entry(*),events:libro_event(*)")
      .eq("user_id", userId)
      .eq("section", section)
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

    return {
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

    const newNode = {
      user_id: userId,
      section: nodeData.section,
      name: nodeData.name,
      parent_node_id: nodeData.parent_node_id || null,
      goal: nodeData.goal || null,
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

    const updatedData = {
      name: updates.name,
    };

    // Incluir goal si está presente (puede ser null para eliminarlo)
    if (updates.goal !== undefined) {
      updatedData.goal = updates.goal;
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
 * Crea una nueva entrada para un nodo
 * @param {string} nodeId - ID del nodo
 * @param {Object} entryData - Datos de la entrada
 * @param {string} section - Código de la sección (ej: "clinical_practice")
 * @returns {Promise<Object>} Entrada creada
 */
export const createEntry = async (nodeId, entryData, section) => {
  try {
    if (!nodeId) {
      throw new Error("Node ID is required");
    }

    if (!section) {
      throw new Error("Section is required");
    }

    const newEntry = {
      node_id: nodeId,
      count: entryData.count !== undefined ? entryData.count : 1,
      residency_year: entryData.residency_year || null,
      notes: entryData.notes || null,
      section: section,
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
    if (!nodeId || !section) {
      throw new Error("Node ID and section are required");
    }

    // Primero crear una entrada para el evento
    const entryData = {
      node_id: nodeId,
      count: 1,
      residency_year: eventData.residency_year || null,
      notes: eventData.notes || null,
    };

    const entry = await createEntry(nodeId, entryData);

    // Luego crear el evento vinculado a la entrada
    const newEvent = {
      entry_id: entry.id,
      node_id: nodeId,
      event_date: eventData.event_date,
      title: eventData.title || null,
      description: eventData.description || null,
      location: eventData.location || null,
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

    const updatedData = {
      event_date: updates.event_date,
      title: updates.title || null,
      description: updates.description || null,
      location: updates.location || null,
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

    // Obtener el evento para eliminar también la entrada asociada
    const { data: event, error: fetchError } = await supabase
      .from("libro_event")
      .select("entry_id")
      .eq("id", eventId)
      .single();

    if (fetchError) {
      console.error("Error fetching event:", fetchError);
      throw fetchError;
    }

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

export default {
  getAllLibroData,
  createNode,
  updateNode,
  deleteNode,
  createEntry,
  createEvent,
  updateEvent,
  deleteEvent,
};
