import { supabase } from "../config/supabase";

const getDisplayName = (chat) =>
  [chat?.other_user_name, chat?.other_user_surname]
    .filter(Boolean)
    .join(" ")
    .trim() || "Usuario";

// ensure_direct_group bloquea a los residentes sin acceso social (gracia MIR
// expirada sin email corporativo) lanzando un código crudo de Postgres.
// 'caller_missing_work_email' es el código antiguo, que sigue vivo hasta que se
// aplique la migración del gate; lo traducimos igual para no enseñar el código.
const DIRECT_CHAT_ERROR_MESSAGES = {
  caller_not_social_eligible:
    "Verifica tu email corporativo del hospital en tu perfil para poder escribir a otros residentes.",
  caller_missing_work_email:
    "Verifica tu email corporativo del hospital en tu perfil para poder escribir a otros residentes.",
};

const describeDirectChatError = (error) => {
  const rawMessage = error?.message?.trim();
  return DIRECT_CHAT_ERROR_MESSAGES[rawMessage] || rawMessage;
};

const normalizeChat = (chat) => ({
  ...chat,
  id: chat.group_id,
  group_id: chat.group_id,
  display_name: getDisplayName(chat),
  unread_count: Number(chat.unread_count || 0),
  kind: "direct",
  name: getDisplayName(chat),
});

export const getDirectChats = async () => {
  try {
    const { data, error } = await supabase.rpc("get_direct_groups");

    if (error) {
      console.error("Error fetching direct chats:", error);
      return { success: false, chats: [], error: error.message };
    }

    return {
      success: true,
      chats: (data || []).map(normalizeChat),
      error: null,
    };
  } catch (error) {
    console.error("Exception in getDirectChats:", error);
    return { success: false, chats: [], error: error.message };
  }
};

export const ensureDirectChat = async (otherUserId) => {
  try {
    if (!otherUserId) {
      return {
        success: false,
        chat: null,
        error: "El usuario destino es obligatorio",
      };
    }

    const { data, error } = await supabase.rpc("ensure_direct_group", {
      p_other_user_id: otherUserId,
    });

    if (error) {
      console.error("Error ensuring direct chat:", error);
      return {
        success: false,
        chat: null,
        error: describeDirectChatError(error),
      };
    }

    const chat = Array.isArray(data) ? data[0] : data;

    if (!chat?.group_id) {
      return {
        success: false,
        chat: null,
        error: "No se pudo crear la conversación privada",
      };
    }

    return {
      success: true,
      chat: {
        id: chat.group_id,
        group_id: chat.group_id,
        display_name: chat.group_name || "Usuario",
        other_user_id: chat.other_user_id,
        kind: "direct",
      },
      error: null,
    };
  } catch (error) {
    console.error("Exception in ensureDirectChat:", error);
    return { success: false, chat: null, error: error.message };
  }
};

export const openDirectChat = async ({
  otherUserId,
  otherUserName,
  onSectionChange,
}) => {
  try {
    if (!otherUserId) {
      return {
        success: false,
        chat: null,
        error: "El usuario destino es obligatorio",
      };
    }

    if (typeof onSectionChange !== "function") {
      return {
        success: false,
        chat: null,
        error: "No se pudo redirigir al chat",
      };
    }

    const response = await ensureDirectChat(otherUserId);

    if (!response.success || !response.chat?.group_id) {
      return response;
    }

    onSectionChange("grupos", {
      groupId: response.chat.group_id,
      groupName: response.chat.display_name || otherUserName || "Chat directo",
    });

    return response;
  } catch (error) {
    console.error("Exception in openDirectChat:", error);
    return {
      success: false,
      chat: null,
      error: error.message,
    };
  }
};

export const getResidentRotationDirectChats = getDirectChats;
export const ensureResidentRotationDirectChat = ensureDirectChat;
export const openResidentDirectChat = openDirectChat;
export const getRoommateDirectChats = getDirectChats;
export const ensureRoommateDirectChat = ensureDirectChat;
export const openRoommateDirectChat = openDirectChat;

export default {
  getDirectChats,
  ensureDirectChat,
  openDirectChat,
  getResidentRotationDirectChats,
  ensureResidentRotationDirectChat,
  openResidentDirectChat,
  getRoommateDirectChats,
  ensureRoommateDirectChat,
  openRoommateDirectChat,
};
