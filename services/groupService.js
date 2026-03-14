/**
 * Servicio para gestionar grupos por especialidad y ciudad
 */

import { supabase } from "../config/supabase";

/**
 * Obtener todos los grupos activos filtrados por tipo de usuario
 * @param {string} userType - 'student' | 'resident'
 * @param {object} filters - { city, specialityId }
 */
export const getGroups = async (userType, filters = {}) => {
  try {
    if (!userType) {
      return { success: false, groups: null, error: "User type is required" };
    }

    let query = supabase
      .from("groups")
      .select(`
        *,
        speciality:speciality_id(id, name),
        group_members(count)
      `)
      .eq("is_active", true)
      .eq("user_type", userType)
      .order("created_at", { ascending: true });

    if (filters.city) {
      query = query.eq("city", filters.city);
    }
    if (filters.specialityId) {
      query = query.eq("speciality_id", filters.specialityId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching groups:", error);
      return { success: false, groups: null, error: error.message };
    }

    // Normalizar el conteo real de miembros desde la relación
    const groups = (data || []).map((g) => ({
      ...g,
      member_count: g.group_members?.[0]?.count ?? 0,
    }));

    return { success: true, groups, error: null };
  } catch (error) {
    console.error("Exception in getGroups:", error);
    return { success: false, groups: null, error: error.message };
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
      .select("group_id, joined_at")
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
    const { data, error } = await supabase
      .from("groups")
      .select("city")
      .eq("user_type", userType)
      .eq("is_active", true);

    if (error) {
      return { success: false, cities: [], error: error.message };
    }

    const cities = [...new Set((data || []).map((g) => g.city))].sort();
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
    const { data, error } = await supabase
      .from("groups")
      .select("speciality:speciality_id(id, name)")
      .eq("user_type", userType)
      .eq("is_active", true);

    if (error) {
      return { success: false, specialities: [], error: error.message };
    }

    const seen = new Set();
    const specialities = (data || [])
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
