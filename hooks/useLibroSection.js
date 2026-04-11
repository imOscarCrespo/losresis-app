import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getAllLibroData,
  createNode,
  createLibroStructure,
  getLibroBooks,
  getLibroUserSettings,
  upsertLibroUserSettings,
  updateNode,
  deleteNode,
  createEntry,
  createEvent,
  updateEvent,
  deleteEvent,
  archiveLibroBookAndStartNewYear,
  ensureActiveLibroBook,
} from "../services/libroService";
import { supabase } from "../config/supabase";
import { getCachedUserId } from "../services/authService";
import libroTemplate from "../data/libroTemplate.json";

/**
 * Hook para gestionar el Libro de Residente
 * @param {string} userId - ID del usuario
 * @param {string} section - Código de la sección (ej: "clinical_practice")
 * @returns {Object} Estado y funciones para gestionar el libro
 */
export const useLibroSection = (userId, section) => {
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [isAddingEntry, setIsAddingEntry] = useState(false);

  // Construir estructura de árbol desde nodos planos
  const buildNodeTree = useCallback(
    (flatNodes) => {
      const nodeMap = new Map();
      const rootNodes = [];

      // Primera pasada: Crear un mapa de todos los nodos con sus conteos directos
      flatNodes.forEach((node) => {
        // Obtener entradas directas para este nodo
        const directEntries = entries.filter(
          (entry) => entry.node_id === node.id
        );
        const directCount = directEntries.reduce(
          (sum, entry) => sum + entry.count,
          0
        );

        nodeMap.set(node.id, {
          ...node,
          children: [],
          total_count: directCount, // Empezar con el conteo directo
        });
      });

      // Segunda pasada: Construir la estructura de árbol
      flatNodes.forEach((node) => {
        const nodeWithChildren = nodeMap.get(node.id);
        if (node.parent_node_id) {
          const parent = nodeMap.get(node.parent_node_id);
          if (parent) {
            parent.children.push(nodeWithChildren);
          }
        } else {
          rootNodes.push(nodeWithChildren);
        }
      });

      // Tercera pasada: Calcular conteos de entradas de padres como suma de hijos
      const calculateParentEntryCounts = (node) => {
        if (!node.children || node.children.length === 0) {
          // Nodo hoja - retornar su conteo directo
          return node.total_count;
        } else {
          // Nodo padre - sumar solo los conteos de hijos
          const childrenSum = node.children.reduce(
            (sum, child) => sum + calculateParentEntryCounts(child),
            0
          );
          // Para nodos padre, total_count debe ser SOLO la suma de todas las entradas de descendientes
          // NO incluyendo las entradas directas del padre
          node.total_count = childrenSum;
          return childrenSum;
        }
      };

      // Calcular conteos de entradas para todos los nodos raíz
      rootNodes.forEach((rootNode) => calculateParentEntryCounts(rootNode));

      return rootNodes;
    },
    [entries]
  );

  // Función optimizada que obtiene todos los datos en una sola llamada
  const fetchAllData = useCallback(async (preferredBookId = null) => {
    // Obtener userId desde diferentes fuentes si no está disponible
    let currentUserId = userId;

    if (!currentUserId) {
      // Intentar obtener desde la sesión de Supabase
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          currentUserId = user.id;
        }
      } catch (error) {
        // Silently fail - will try AsyncStorage next
      }
    }

    if (!currentUserId) {
      // Intentar obtener desde AsyncStorage
      try {
        currentUserId = await getCachedUserId();
      } catch (error) {
        // Silently fail
      }
    }

    if (!currentUserId || !section) {
      return;
    }

    setLoading(true);
    try {
      const booksData = await getLibroBooks(currentUserId, section);
      setBooks(booksData);

      const resolvedBookId =
        preferredBookId && booksData.some((book) => book.id === preferredBookId)
          ? preferredBookId
          : selectedBookId && booksData.some((book) => book.id === selectedBookId)
            ? selectedBookId
            : booksData.find((book) => book.status === "active")?.id ||
              booksData[0]?.id ||
              null;

      setSelectedBookId(resolvedBookId);

      if (!resolvedBookId) {
        setNodes([]);
        setEntries([]);
        setEvents([]);
        return;
      }

      const {
        book,
        nodes: nodesData,
        entries: entriesData,
        events: eventsData,
      } = await getAllLibroData(currentUserId, section, resolvedBookId);

      if (book?.id && book.id !== resolvedBookId) {
        setSelectedBookId(book.id);
      }
      setNodes(nodesData);
      setEntries(entriesData);
      setEvents(eventsData);
    } catch (error) {
      console.error("Error fetching libro data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, section, selectedBookId]);

  // Obtener estructura de árbol
  const nodeTree = useMemo(() => {
    return buildNodeTree(nodes);
  }, [nodes, buildNodeTree]);

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) || null,
    [books, selectedBookId]
  );

  const activeBook = useMemo(
    () => books.find((book) => book.status === "active") || null,
    [books]
  );

  const isSelectedBookArchived = selectedBook?.status === "archived";

  // Calcular estadísticas
  const statistics = useMemo(() => {
    const totalNodes = nodes.length;
    const totalEntries = entries.length;
    const totalCount = nodes.reduce(
      (sum, node) => sum + (node.total_count || 0),
      0
    );
    const byYear = {};

    entries.forEach((entry) => {
      if (entry.residency_year) {
        byYear[entry.residency_year] =
          (byYear[entry.residency_year] || 0) + entry.count;
      }
    });

    return {
      totalNodes,
      totalEntries,
      totalCount,
      byYear,
    };
  }, [nodes, entries]);

  // Helper para obtener userId
  const getCurrentUserId = useCallback(async () => {
    if (userId) return userId;

    // Intentar obtener desde la sesión de Supabase
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) return user.id;
    } catch (error) {
      // Silently fail - will try AsyncStorage next
    }

    // Intentar obtener desde AsyncStorage
    try {
      const cachedUserId = await getCachedUserId();
      if (cachedUserId) return cachedUserId;
    } catch (error) {
      // Silently fail
    }

    return null;
  }, [userId]);

  const fetchSettings = useCallback(async () => {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return null;

    setSettingsLoading(true);
    try {
      const settingsData = await getLibroUserSettings(currentUserId);
      setSettings(settingsData || null);
      return settingsData || null;
    } catch (error) {
      console.error("Error fetching libro settings:", error);
      return null;
    } finally {
      setSettingsLoading(false);
    }
  }, [getCurrentUserId]);

  // Funciones CRUD para nodos
  const addNode = useCallback(
    async (formData) => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId || !section) return false;
      if (!selectedBookId) return false;

      try {
        const newNode = await createNode(
          {
            ...formData,
            book_id: selectedBookId,
            section,
          },
          currentUserId
        );

        // Refrescar todos los datos después de la adición exitosa
        await fetchAllData();
        return true;
      } catch (error) {
        console.error("Error adding node:", error);
        return false;
      }
    },
    [getCurrentUserId, section, fetchAllData, selectedBookId]
  );

  const updateNodeData = useCallback(
    async (node) => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return false;

      try {
        const updatedNode = await updateNode(
          node.id,
          {
            name: node.name,
            goal: node.goal !== undefined ? node.goal : undefined,
            icon_name: node.icon_name !== undefined ? node.icon_name : undefined,
            color_token: node.color_token !== undefined ? node.color_token : undefined,
            tracking_mode:
              node.tracking_mode !== undefined ? node.tracking_mode : undefined,
          },
          currentUserId
        );

        // Refrescar todos los datos para asegurar que el árbol se actualice correctamente
        await fetchAllData();
        return true;
      } catch (error) {
        console.error("Error updating node:", error);
        return false;
      }
    },
    [getCurrentUserId, fetchAllData]
  );

  const removeNode = useCallback(
    async (nodeId) => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return false;

      try {
        await deleteNode(nodeId, currentUserId);

        // Remover del estado local
        setNodes((prev) => prev.filter((n) => n.id !== nodeId));
        setEntries((prev) => prev.filter((e) => e.node_id !== nodeId));
        setEvents((prev) => prev.filter((e) => e.node_id !== nodeId));
        return true;
      } catch (error) {
        console.error("Error deleting node:", error);
        return false;
      }
    },
    [getCurrentUserId]
  );

  // Funciones CRUD para entradas
  const addEntry = useCallback(
    async (nodeId, formData) => {
      const currentUserId = await getCurrentUserId();
      if (!section || !currentUserId) return false;

      try {
        await createEntry(nodeId, formData, section, currentUserId);

        // Refrescar todos los datos después de la adición exitosa
        await fetchAllData();
        return true;
      } catch (error) {
        console.error("Error adding entry:", error);
        return false;
      }
    },
    [getCurrentUserId, section, fetchAllData]
  );

  // Funciones CRUD para eventos
  const addEvent = useCallback(
    async (formData, nodeId) => {
      if (!section) return false;

      try {
        await createEvent(formData, nodeId, section);

        // Refrescar todos los datos después de la adición exitosa
        await fetchAllData();
        return true;
      } catch (error) {
        console.error("Error adding event:", error);
        return false;
      }
    },
    [section, fetchAllData]
  );

  const updateEventData = useCallback(async (event) => {
    try {
      const updatedEvent = await updateEvent(event.id, {
        event_date: event.event_date,
        title: event.title,
        description: event.description,
        location: event.location,
      });

      // Actualizar estado local
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? updatedEvent : e))
      );
      return true;
    } catch (error) {
      console.error("Error updating event:", error);
      return false;
    }
  }, []);

  const removeEvent = useCallback(async (eventId) => {
    try {
      await deleteEvent(eventId);

      // Remover del estado local
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      return true;
    } catch (error) {
      console.error("Error deleting event:", error);
      return false;
    }
  }, []);

  // Obtener eventos para un nodo específico
  const getNodeEvents = useCallback(
    (nodeId) => {
      return events.filter((event) => event.node_id === nodeId);
    },
    [events]
  );

  // Obtener entradas para un nodo específico
  const getNodeEntries = useCallback(
    (nodeId) => {
      return entries.filter((entry) => entry.node_id === nodeId);
    },
    [entries]
  );

  // Función para crear la plantilla desde el JSON
  const createTemplate = useCallback(async () => {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId || !section) return false;

    setLoading(true);
    try {
      const activeLibroBook = await ensureActiveLibroBook({
        userId: currentUserId,
        section,
        residencyYear: 1,
      });

      // Crear todos los nodos padre primero
      for (const parentTemplate of libroTemplate) {
        // Crear el nodo padre
        const parentNode = await createNode(
          {
            book_id: activeLibroBook.id,
            name: parentTemplate.name,
            section,
            parent_node_id: null,
          },
          currentUserId
        );

        // Crear los hijos del padre
        if (parentTemplate.children && parentTemplate.children.length > 0) {
          for (const childTemplate of parentTemplate.children) {
            await createNode(
              {
                book_id: activeLibroBook.id,
                name: childTemplate.name,
                section,
                parent_node_id: parentNode.id,
                goal: childTemplate.goal || null,
              },
              currentUserId
            );
          }
        }
      }

      // Refrescar todos los datos después de crear la plantilla
      await fetchAllData();
      return true;
    } catch (error) {
      console.error("Error creating template:", error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId, section, fetchAllData]);

  const createStructure = useCallback(
    async ({ specialityId = null, categories = [], residencyYear = 1 }) => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId || !section) return false;

      setLoading(true);
      try {
        await createLibroStructure({
          userId: currentUserId,
          section,
          specialityId,
          categories,
          residencyYear,
        });
        await Promise.all([fetchAllData(), fetchSettings()]);
        return true;
      } catch (error) {
        console.error("Error creating libro structure:", error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchAllData, fetchSettings, getCurrentUserId, section]
  );

  const selectBook = useCallback(
    async (bookId) => {
      setSelectedBookId(bookId);
      await fetchAllData(bookId);
    },
    [fetchAllData]
  );

  const markOnboardingComplete = useCallback(
    async ({ specialityId = null, lastUsedNodeId = null, quickActivityIds = [] } = {}) => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return false;

      try {
        const updatedSettings = await upsertLibroUserSettings(currentUserId, {
          speciality_id: specialityId,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_version: 1,
          last_used_node_id: lastUsedNodeId,
          quick_activity_ids: quickActivityIds,
        });
        setSettings(updatedSettings);
        return true;
      } catch (error) {
        console.error("Error marking onboarding complete:", error);
        return false;
      }
    },
    [getCurrentUserId]
  );

  const updateLibroSettings = useCallback(
    async (partialSettings = {}) => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return false;

      try {
        const updatedSettings = await upsertLibroUserSettings(currentUserId, {
          speciality_id:
            partialSettings.speciality_id !== undefined
              ? partialSettings.speciality_id
              : settings?.speciality_id || null,
          onboarding_completed_at:
            partialSettings.onboarding_completed_at !== undefined
              ? partialSettings.onboarding_completed_at
              : settings?.onboarding_completed_at || null,
          onboarding_version:
            partialSettings.onboarding_version || settings?.onboarding_version || 1,
          last_used_node_id:
            partialSettings.last_used_node_id !== undefined
              ? partialSettings.last_used_node_id
              : settings?.last_used_node_id || null,
          quick_activity_ids:
            partialSettings.quick_activity_ids !== undefined
              ? partialSettings.quick_activity_ids
              : settings?.quick_activity_ids || [],
        });
        setSettings(updatedSettings);
        return true;
      } catch (error) {
        console.error("Error updating libro settings:", error);
        return false;
      }
    },
    [getCurrentUserId, settings]
  );

  const archiveAndStartNewYear = useCallback(
    async (nextResidencyYear) => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId || !section) return { success: false, book: null };

      try {
        const nextBook = await archiveLibroBookAndStartNewYear({
          userId: currentUserId,
          section,
          nextResidencyYear,
        });

        await Promise.all([
          updateLibroSettings({
            last_used_node_id: null,
            quick_activity_ids: [],
          }),
          fetchAllData(nextBook?.id || null),
        ]);

        return { success: true, book: nextBook || null };
      } catch (error) {
        console.error("Error archiving libro and starting new year:", error);
        return { success: false, book: null };
      }
    },
    [fetchAllData, getCurrentUserId, section, updateLibroSettings]
  );

  // Cargar datos al montar y cuando cambien usuario o sección
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    books,
    selectedBook,
    activeBook,
    selectedBookId,
    setSelectedBookId,
    isSelectedBookArchived,
    nodes,
    nodeTree,
    entries,
    events,
    settings,
    loading,
    settingsLoading,
    statistics,
    selectedNode,
    setSelectedNode,
    isAddingNode,
    setIsAddingNode,
    editingNode,
    setEditingNode,
    isAddingEntry,
    setIsAddingEntry,
    addNode,
    updateNode: updateNodeData,
    deleteNode: removeNode,
    addEntry,
    addEvent,
    updateEvent: updateEventData,
    deleteEvent: removeEvent,
    getNodeEntries,
    getNodeEvents,
    selectBook,
    fetchAllData,
    fetchSettings,
    createTemplate,
    createStructure,
    archiveAndStartNewYear,
    markOnboardingComplete,
    updateLibroSettings,
  };
};

export default useLibroSection;
