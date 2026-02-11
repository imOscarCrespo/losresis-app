import { supabase } from "../config/supabase";

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MADRID_FALLBACK = { latitude: 40.4168, longitude: -3.7038 };

/**
 * Servicio para gestionar usuarios de la comunidad
 */

/**
 * Obtiene usuarios residentes de la comunidad con sus especialidades
 * @param {string} cityFilter - Filtro opcional por ciudad
 * @param {string} specialtyFilter - Filtro opcional por especialidad
 * @returns {Promise<{success: boolean, users: Array, error: string|null}>}
 */
export const getCommunityUsers = async (
  cityFilter = "",
  specialtyFilter = ""
) => {
  try {
    // Construir query base para residentes con email y especialidad
    let query = supabase
      .from("users")
      .select(
        `
        id,
        name,
        surname,
        work_email,
        city,
        speciality_id,
        specialities (
          id,
          name
        )
      `
      )
      .eq("is_resident", true)
      .not("work_email", "is", null)
      .not("speciality_id", "is", null);

    // Aplicar filtros si están presentes
    if (cityFilter) {
      query = query.eq("city", cityFilter);
    }

    if (specialtyFilter) {
      query = query.eq("speciality_id", specialtyFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching community users:", error);
      return {
        success: false,
        users: [],
        error: error.message,
      };
    }

    return {
      success: true,
      users: data || [],
      error: null,
    };
  } catch (error) {
    console.error("Exception in getCommunityUsers:", error);
    return {
      success: false,
      users: [],
      error: error.message,
    };
  }
};

/**
 * Obtiene todas las ciudades únicas de usuarios residentes
 * @returns {Promise<{success: boolean, cities: Array<string>, error: string|null}>}
 */
export const getCities = async () => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("city")
      .eq("is_resident", true)
      .not("city", "is", null)
      .not("work_email", "is", null);

    if (error) {
      console.error("Error fetching cities:", error);
      return {
        success: false,
        cities: [],
        error: error.message,
      };
    }

    // Extraer ciudades únicas y ordenar
    const uniqueCities = [...new Set(data.map((item) => item.city))].sort();

    return {
      success: true,
      cities: uniqueCities,
      error: null,
    };
  } catch (error) {
    console.error("Exception in getCities:", error);
    return {
      success: false,
      cities: [],
      error: error.message,
    };
  }
};

/**
 * Obtiene coordenadas para una ciudad usando la API de geocodificación de Mapbox
 * @param {string} city - Nombre de la ciudad
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export const getCityCoordinates = async (city) => {
  if (!city || typeof city !== "string" || !city.trim()) {
    return MADRID_FALLBACK;
  }

  if (!MAPBOX_ACCESS_TOKEN) {
    console.warn(
      "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN no está definido. Usando coordenadas por defecto (Madrid)."
    );
    return MADRID_FALLBACK;
  }

  try {
    const query = encodeURIComponent(`${city.trim()}, España`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=es&types=place`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { latitude: lat, longitude: lng };
    }

    console.log("No se encontraron coordenadas para la ciudad:", city);
    return MADRID_FALLBACK;
  } catch (error) {
    console.error("Error al geocodificar la ciudad:", error);
    return MADRID_FALLBACK;
  }
};

/**
 * Calcula coordenadas con offset para usuarios en la misma ciudad
 * @param {number} baseLatitude - Latitud base
 * @param {number} baseLongitude - Longitud base
 * @param {number} index - Índice del usuario en el grupo
 * @param {number} total - Total de usuarios en el grupo
 * @returns {{latitude: number, longitude: number}}
 */
export const calculateOffsetCoordinates = (
  baseLatitude,
  baseLongitude,
  index,
  total
) => {
  if (total === 1) {
    return { latitude: baseLatitude, longitude: baseLongitude };
  }

  // Radio del círculo aumentado para mejor visualización
  // Aproximadamente 2-3 km para que se vean bien separados en el mapa
  let radius = 0.02; // Base: ~2km

  // Si hay muchos usuarios, aumentar el radio
  if (total > 10) {
    radius = 0.03; // ~3km
  }
  if (total > 20) {
    radius = 0.04; // ~4km
  }

  const angle = (2 * Math.PI * index) / total;

  return {
    latitude: baseLatitude + radius * Math.cos(angle),
    longitude: baseLongitude + radius * Math.sin(angle),
  };
};

/**
 * Verifica si un residente tiene una reseña
 * @param {string} userId - ID del usuario
 * @returns {Promise<{success: boolean, hasReview: boolean, error: string|null}>}
 */
export const checkResidentReview = async (userId) => {
  try {
    if (!userId) {
      return {
        success: true,
        hasReview: false,
        error: null,
      };
    }

    const { data, error } = await supabase
      .from("review")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      console.error("Error checking resident review:", error);
      return {
        success: false,
        hasReview: false,
        error: error.message,
      };
    }

    return {
      success: true,
      hasReview: data && data.length > 0,
      error: null,
    };
  } catch (error) {
    console.error("Exception in checkResidentReview:", error);
    return {
      success: false,
      hasReview: false,
      error: error.message,
    };
  }
};
