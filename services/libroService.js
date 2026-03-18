import { supabase } from "../config/supabase";

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
            .eq("user_id", userId);
        } catch (error) {
          // Silently fail - no es crítico si falla
          console.error("Error auto-assigning position:", error);
        }
      });
    }

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
          .eq("user_id", userId)
          .eq("section", nodeData.section)
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

    const entry = await createEntry(nodeId, entryData, section);

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

export const createLibroStructure = async ({
  userId,
  section,
  specialityId = null,
  categories = [],
}) => {
  try {
    if (!userId || !section) {
      throw new Error("User ID and section are required");
    }

    const createdParents = [];

    for (const [index, category] of categories.entries()) {
      const parent = await createNode(
        {
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

export default {
  getAllLibroData,
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
};
