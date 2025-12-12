/**
 * Servicio para gestionar las preferencias de hospital y especialidad del usuario
 */

import { supabase } from "../config/supabase";

/**
 * Obtener todas las preferencias del usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<{success: boolean, preferences: array|null, error: string|null}>}
 */
export const getUserPreferences = async (userId) => {
  try {
    if (!userId) {
      return {
        success: false,
        preferences: null,
        error: "User ID is required",
      };
    }

    const { data, error } = await supabase
      .from("user_hospital_preferences")
      .select(
        `
        id,
        user_id,
        hospital_id,
        speciality_id,
        position,
        created_at,
        hospitals!inner(id, name, city, region),
        specialities!inner(id, name)
      `
      )
      .eq("user_id", userId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching preferences:", error);
      return {
        success: false,
        preferences: null,
        error: error.message,
      };
    }

    // Formatear las preferencias
    const formattedPreferences = (data || []).map((pref) => ({
      id: pref.id,
      user_id: pref.user_id,
      hospital_id: pref.hospital_id,
      speciality_id: pref.speciality_id,
      position: pref.position,
      created_at: pref.created_at,
      hospital: pref.hospitals,
      specialty: pref.specialities,
    }));

    // Ordenar por posición
    const orderedPreferences = formattedPreferences.sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );

    return {
      success: true,
      preferences: orderedPreferences,
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching preferences:", error);
    return {
      success: false,
      preferences: null,
      error: error.message,
    };
  }
};

/**
 * Añadir una nueva preferencia
 * @param {string} userId - ID del usuario
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialtyId - ID de la especialidad
 * @param {number} position - Posición de la preferencia
 * @returns {Promise<{success: boolean, preference: object|null, error: string|null}>}
 */
export const addUserPreference = async (
  userId,
  hospitalId,
  specialtyId,
  position
) => {
  try {
    if (!userId || !hospitalId || !specialtyId) {
      return {
        success: false,
        preference: null,
        error: "User ID, hospital ID, and specialty ID are required",
      };
    }

    const { data, error } = await supabase
      .from("user_hospital_preferences")
      .insert([
        {
          user_id: userId,
          hospital_id: hospitalId,
          speciality_id: specialtyId,
          position: position,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error adding preference:", error);
      return {
        success: false,
        preference: null,
        error: error.message,
      };
    }

    return {
      success: true,
      preference: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception adding preference:", error);
    return {
      success: false,
      preference: null,
      error: error.message,
    };
  }
};

/**
 * Eliminar una preferencia
 * @param {string} preferenceId - ID de la preferencia
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const removeUserPreference = async (preferenceId) => {
  try {
    if (!preferenceId) {
      return {
        success: false,
        error: "Preference ID is required",
      };
    }

    const { error } = await supabase
      .from("user_hospital_preferences")
      .delete()
      .eq("id", preferenceId);

    if (error) {
      console.error("Error removing preference:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Exception removing preference:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Actualizar el orden de las preferencias
 * @param {Array} preferences - Array de preferencias con sus nuevas posiciones
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const updatePreferencesOrder = async (preferences) => {
  try {
    if (!preferences || preferences.length === 0) {
      return {
        success: false,
        error: "Preferences array is required",
      };
    }

    // Preparar las actualizaciones
    const updates = preferences.map((preference, index) => ({
      id: preference.id,
      user_id: preference.user_id,
      hospital_id: preference.hospital_id,
      speciality_id: preference.speciality_id,
      position: index + 1,
    }));

    const { error } = await supabase
      .from("user_hospital_preferences")
      .upsert(updates, { onConflict: "id" });

    if (error) {
      console.error("Error updating preference order:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Exception updating preference order:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtener hospitales iniciales desde el cache JSON
 * @returns {Promise<{success: boolean, hospitals: array|null, error: string|null}>}
 */
export const getInitialHospitals = async () => {
  try {
    const response = await fetch(
      "https://chgretwxywvaaruwovbb.supabase.co/storage/v1/object/public/cache//hospitals.json"
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data) {
      return {
        success: false,
        hospitals: null,
        error: "No hospitals data received from JSON cache",
      };
    }

    // Filtrar hospitales que no empiezan con "Ud" y obtener los primeros 10
    const filtered = data
      .filter((hospital) => !hospital.name.toLowerCase().startsWith("ud"))
      .slice(0, 10);

    return {
      success: true,
      hospitals: filtered,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching initial hospitals:", error);
    return {
      success: false,
      hospitals: null,
      error: error.message,
    };
  }
};


