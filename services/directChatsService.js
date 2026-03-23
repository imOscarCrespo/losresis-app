import { supabase } from "../config/supabase";

const getDisplayName = (chat) =>
  [chat?.other_user_name, chat?.other_user_surname].filter(Boolean).join(" ").trim() ||
  "Residente";

export const getResidentRotationDirectChats = async () => {
  try {
    const { data, error } = await supabase.rpc("get_resident_rotation_direct_groups");

    if (error) {
      console.error("Error fetching resident direct chats:", error);
      return { success: false, chats: [], error: error.message };
    }

    const chats = (data || []).map((chat) => ({
      ...chat,
      id: chat.group_id,
      group_id: chat.group_id,
      display_name: getDisplayName(chat),
      unread_count: Number(chat.unread_count || 0),
    }));

    return { success: true, chats, error: null };
  } catch (error) {
    console.error("Exception in getResidentRotationDirectChats:", error);
    return { success: false, chats: [], error: error.message };
  }
};

export const ensureResidentRotationDirectChat = async (otherUserId) => {
  try {
    if (!otherUserId) {
      return { success: false, chat: null, error: "El usuario destino es obligatorio" };
    }

    const { data, error } = await supabase.rpc(
      "ensure_resident_rotation_direct_group",
      { p_other_user_id: otherUserId }
    );

    if (error) {
      console.error("Error ensuring resident direct chat:", error);
      return { success: false, chat: null, error: error.message };
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
        display_name: chat.group_name || "Residente",
        other_user_id: chat.other_user_id,
        kind: "resident_rotation_direct",
      },
      error: null,
    };
  } catch (error) {
    console.error("Exception in ensureResidentRotationDirectChat:", error);
    return { success: false, chat: null, error: error.message };
  }
};

export default {
  getResidentRotationDirectChats,
  ensureResidentRotationDirectChat,
};
