/**
 * Servicio para gestionar grupos por especialidad, ciudad y hospital
 */

import { supabase } from "../config/supabase";

const GROUPS_CACHE_URL =
  "https://chgretwxywvaaruwovbb.supabase.co/storage/v1/object/public/cache/groups.json";

const fetchGroupsCache = async () => {
  const response = await fetch(GROUPS_CACHE_URL);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const groupsData = await response.json();

  if (Array.isArray(groupsData)) {
    if (
      groupsData.length === 1 &&
      groupsData[0] &&
      Array.isArray(groupsData[0].groups_json)
    ) {
      return groupsData[0].groups_json;
    }

    return groupsData;
  }

  if (groupsData && Array.isArray(groupsData.groups_json)) {
    return groupsData.groups_json;
  }

  return [];
};

/**
 * Obtener todos los grupos activos filtrados por tipo de usuario
 * @param {string} userType - 'student' | 'resident'
 * @param {object} filters - { city, specialityId, hospitalId }
 */
export const getGroups = async (userType, filters = {}) => {
  try {
    if (!userType) {
      return { success: false, groups: null, error: "User type is required" };
    }

    const allGroups = await fetchGroupsCache();
    const groups = allGroups
      .filter((group) => group?.is_active)
      .filter((group) => group.user_type === userType)
      .filter((group) => !filters.city || group.city === filters.city)
      .filter(
        (group) =>
          !filters.specialityId || group.speciality_id === filters.specialityId
      )
      .filter(
        (group) => !filters.hospitalId || group.hospital_id === filters.hospitalId
      )
      .sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
      )
      .map((group) => ({
        ...group,
        member_count: Number.isFinite(group.member_count)
          ? group.member_count
          : 0,
      }));

    return { success: true, groups, error: null };
  } catch (error) {
    console.error("Exception in getGroups:", error);
    return { success: false, groups: null, error: error.message };
  }
};

/**
 * Obtener un grupo concreto por id desde la cache
 * @param {string} groupId
 */
export const getGroupById = async (groupId) => {
  try {
    if (!groupId) {
      return { success: false, group: null, error: "Group ID is required" };
    }

    const allGroups = await fetchGroupsCache();
    const group = allGroups.find((item) => item?.id === groupId) || null;

    if (!group) {
      return { success: false, group: null, error: "Grupo no encontrado" };
    }

    return {
      success: true,
      group: {
        ...group,
        member_count: Number.isFinite(group.member_count)
          ? group.member_count
          : 0,
      },
      error: null,
    };
  } catch (error) {
    console.error("Exception in getGroupById:", error);
    return { success: false, group: null, error: error.message };
  }
};

/**
 * Obtener las membresías del usuario actual
 * @param {string} userId
 */
export const getUserMemberships = async (userId) => {
  try {
    if (!userId) {
      return {
        success: false,
        memberships: null,
        error: "User ID is required",
      };
    }

    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, joined_at, last_read_at, notifications_muted")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching memberships:", error);
      return { success: false, memberships: null, error: error.message };
    }

    return { success: true, memberships: data || [], error: null };
  } catch (error) {
    console.error("Exception in getUserMemberships:", error);
    return { success: false, memberships: null, error: error.message };
  }
};

/**
 * Obtener la membresía de un grupo concreto para el usuario actual
 * @param {string} groupId
 * @param {string} userId
 */
export const getGroupMembership = async (groupId, userId) => {
  try {
    if (!groupId || !userId) {
      return {
        success: false,
        membership: null,
        error: "Group ID and User ID are required",
      };
    }

    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, joined_at, last_read_at, notifications_muted")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching group membership:", error);
      return { success: false, membership: null, error: error.message };
    }

    return { success: true, membership: data, error: null };
  } catch (error) {
    console.error("Exception in getGroupMembership:", error);
    return { success: false, membership: null, error: error.message };
  }
};

/**
 * Obtener no leídos por grupo para el usuario autenticado
 * @param {string[]} groupIds
 */
export const getGroupUnreadCounts = async (groupIds = []) => {
  try {
    const normalizedGroupIds = [...new Set((groupIds || []).filter(Boolean))];
    const { data, error } = await supabase.rpc("get_group_unread_counts", {
      p_group_ids: normalizedGroupIds.length > 0 ? normalizedGroupIds : null,
    });

    if (error) {
      console.error("Error fetching group unread counts:", error);
      return { success: false, unreadByGroupId: {}, error: error.message };
    }

    const unreadByGroupId = {};

    (data || []).forEach((row) => {
      if (!row?.group_id) return;
      unreadByGroupId[row.group_id] = {
        unreadCount: Number(row.unread_count || 0),
        lastMessageAt: row.last_message_at || null,
      };
    });

    return { success: true, unreadByGroupId, error: null };
  } catch (error) {
    console.error("Exception in getGroupUnreadCounts:", error);
    return { success: false, unreadByGroupId: {}, error: error.message };
  }
};

/**
 * Obtener member_count fresco para un conjunto concreto de grupos
 * @param {string[]} groupIds
 */
export const getGroupMemberCounts = async (groupIds = []) => {
  try {
    const uniqueGroupIds = [...new Set((groupIds || []).filter(Boolean))];

    if (uniqueGroupIds.length === 0) {
      return { success: true, countsByGroupId: {}, error: null };
    }

    const { data, error } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", uniqueGroupIds);

    if (error) {
      console.error("Error fetching group member counts:", error);
      return { success: false, countsByGroupId: {}, error: error.message };
    }

    const countsByGroupId = uniqueGroupIds.reduce((acc, groupId) => {
      acc[groupId] = 0;
      return acc;
    }, {});

    (data || []).forEach((membership) => {
      if (!membership?.group_id) return;
      countsByGroupId[membership.group_id] =
        (countsByGroupId[membership.group_id] || 0) + 1;
    });

    return { success: true, countsByGroupId, error: null };
  } catch (error) {
    console.error("Exception in getGroupMemberCounts:", error);
    return { success: false, countsByGroupId: {}, error: error.message };
  }
};

/**
 * Obtener miembros de un grupo con datos básicos de usuario
 * @param {string} groupId
 */
export const getGroupMembers = async (groupId) => {
  try {
    if (!groupId) {
      return { success: false, members: [], error: "Group ID is required" };
    }

    const { data, error } = await supabase
      .from("group_members")
      .select("id, joined_at, user_id, user:user_id(id, name, surname)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("Error fetching group members:", error);
      return { success: false, members: [], error: error.message };
    }

    return { success: true, members: data || [], error: null };
  } catch (error) {
    console.error("Exception in getGroupMembers:", error);
    return { success: false, members: [], error: error.message };
  }
};

/**
 * Unirse a un grupo
 * @param {string} groupId
 * @param {string} userId
 */
export const joinGroup = async (groupId, userId) => {
  try {
    if (!groupId || !userId) {
      return {
        success: false,
        error: "Group ID and User ID are required",
      };
    }

    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: userId });

    if (error) {
      if (error.code === "23505") {
        // Ya es miembro (unique constraint violation)
        return { success: true, alreadyMember: true, error: null };
      }
      console.error("Error joining group:", error);
      return { success: false, error: error.message };
    }

    return { success: true, alreadyMember: false, error: null };
  } catch (error) {
    console.error("Exception in joinGroup:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Marcar un grupo como leído
 * @param {string} groupId
 * @param {string} userId
 */
export const markGroupAsRead = async (groupId, userId) => {
  try {
    if (!groupId || !userId) {
      return { success: false, error: "Group ID and User ID are required" };
    }

    const { error } = await supabase
      .from("group_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error marking group as read:", error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Exception in markGroupAsRead:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Silenciar o reactivar notificaciones de un grupo
 * @param {string} groupId
 * @param {string} userId
 * @param {boolean} muted
 */
export const setGroupNotificationsMuted = async (groupId, userId, muted) => {
  try {
    if (!groupId || !userId) {
      return { success: false, error: "Group ID and User ID are required" };
    }

    const { error } = await supabase
      .from("group_members")
      .update({ notifications_muted: muted })
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating group mute status:", error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Exception in setGroupNotificationsMuted:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Salir de un grupo
 * @param {string} groupId
 * @param {string} userId
 */
export const leaveGroup = async (groupId, userId) => {
  try {
    if (!groupId || !userId) {
      return { success: false, error: "Group ID and User ID are required" };
    }

    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error leaving group:", error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Exception in leaveGroup:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtener ciudades disponibles de grupos según tipo de usuario
 * @param {string} userType
 */
export const getGroupCities = async (userType) => {
  try {
    const groups = await fetchGroupsCache();
    const cities = [
      ...new Set(
        groups
          .filter((group) => group?.is_active)
          .filter((group) => group.user_type === userType)
          .map((group) => group.city)
          .filter(Boolean)
      ),
    ].sort();

    return { success: true, cities, error: null };
  } catch (error) {
    return { success: false, cities: [], error: error.message };
  }
};

/**
 * Obtener especialidades disponibles en grupos según tipo de usuario
 * @param {string} userType
 */
export const getGroupSpecialities = async (userType) => {
  try {
    const groups = await fetchGroupsCache();

    const seen = new Set();
    const specialities = groups
      .filter((group) => group?.is_active)
      .filter((group) => group.user_type === userType)
      .map((g) => g.speciality)
      .filter((s) => {
        if (!s || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, specialities, error: null };
  } catch (error) {
    return { success: false, specialities: [], error: error.message };
  }
};

/**
 * Obtener hospitales disponibles en grupos según tipo de usuario
 * @param {string} userType
 */
export const getGroupHospitals = async (userType) => {
  try {
    const groups = await fetchGroupsCache();
    const seen = new Set();
    const hospitals = groups
      .filter((group) => group?.is_active)
      .filter((group) => group.user_type === userType)
      .map((group) => group.hospital)
      .filter((hospital) => {
        if (!hospital?.id || seen.has(hospital.id)) return false;
        seen.add(hospital.id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, hospitals, error: null };
  } catch (error) {
    return { success: false, hospitals: [], error: error.message };
  }
};
