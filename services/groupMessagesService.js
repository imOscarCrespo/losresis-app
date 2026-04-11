/**
 * Servicio para gestionar mensajes de grupos (chat en tiempo real)
 */

import { supabase } from "../config/supabase";

const MESSAGES_PER_PAGE = 30;

/**
 * Obtener mensajes de un grupo con paginación
 * Los mensajes se devuelven en orden ascendente (más antiguo primero) para chat
 * @param {string} groupId
 * @param {number} page - 0-indexed (0 = mensajes más recientes)
 */
export const getGroupMessages = async (groupId, page = 0) => {
  try {
    if (!groupId) {
      return {
        success: false,
        messages: null,
        hasMore: false,
        error: "Group ID is required",
      };
    }

    const from = page * MESSAGES_PER_PAGE;
    const to = from + MESSAGES_PER_PAGE - 1;

    const { data, error, count } = await supabase
      .from("group_messages")
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `,
        { count: "exact" }
      )
      .eq("group_id", groupId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching group messages:", error);
      return {
        success: false,
        messages: null,
        hasMore: false,
        error: error.message,
      };
    }

    // Revertir para mostrar del más antiguo al más reciente (orden chat)
    const messages = (data || []).reverse();
    const hasMore = (count || 0) > to + 1;

    return {
      success: true,
      messages,
      hasMore,
      total: count || 0,
      error: null,
    };
  } catch (error) {
    console.error("Exception in getGroupMessages:", error);
    return {
      success: false,
      messages: null,
      hasMore: false,
      error: error.message,
    };
  }
};

/**
 * Enviar un mensaje a un grupo
 * @param {string} groupId
 * @param {string} userId
 * @param {string} content
 */
export const sendMessage = async (groupId, userId, content) => {
  try {
    if (!groupId || !userId) {
      return {
        success: false,
        message: null,
        error: "Group ID and User ID are required",
      };
    }

    const trimmed = (content || "").trim();

    if (!trimmed) {
      return {
        success: false,
        message: null,
        error: "El mensaje no puede estar vacío",
      };
    }

    if (trimmed.length > 2000) {
      return {
        success: false,
        message: null,
        error: "El mensaje no puede exceder 2000 caracteres",
      };
    }

    const { data, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: groupId,
        user_id: userId,
        content: trimmed,
      })
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .single();

    if (error) {
      console.error("Error sending message:", error);
      return { success: false, message: null, error: error.message };
    }

    return { success: true, message: data, error: null };
  } catch (error) {
    console.error("Exception in sendMessage:", error);
    return { success: false, message: null, error: error.message };
  }
};

/**
 * Suscribirse a nuevos mensajes en tiempo real
 * @param {string} groupId
 * @param {function} onNewMessage - callback(message)
 * @returns supabase channel
 */
export const subscribeToGroupMessages = (groupId, onNewMessage) => {
  const channel = supabase
    .channel(`group_messages:${groupId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${groupId}`,
      },
      async (payload) => {
        if (!payload.new?.id) return;

        // Fetch con user info ya que el payload de realtime no incluye joins
        const { data } = await supabase
          .from("group_messages")
          .select("*, user:user_id(id, name, surname)")
          .eq("id", payload.new.id)
          .single();

        if (data && !data.is_deleted) {
          onNewMessage(data);
        }
      }
    )
    .subscribe();

  return channel;
};

/**
 * Cancelar suscripción a mensajes
 * @param {object} channel - supabase channel
 */
export const unsubscribeFromGroupMessages = async (channel) => {
  if (channel) {
    await supabase.removeChannel(channel);
  }
};
