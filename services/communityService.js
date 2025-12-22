import { supabase } from "../config/supabase";

/**
 * Servicio para gestionar usuarios de la comunidad
 */

/**
 * Obtiene usuarios residentes de la comunidad con sus especialidades
 * @param {string} cityFilter - Filtro opcional por ciudad
 * @param {string} specialtyFilter - Filtro opcional por especialidad
 * @returns {Promise<{success: boolean, users: Array, error: string|null}>}
 */
export const getCommunityUsers = async (cityFilter = "", specialtyFilter = "") => {
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
 * Obtiene coordenadas para una ciudad usando geocodificación
 * Nota: En React Native, esto requeriría una API de geocodificación
 * Por ahora devolvemos coordenadas predeterminadas de ciudades españolas principales
 * @param {string} city - Nombre de la ciudad
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export const getCityCoordinates = async (city) => {
  // Coordenadas predeterminadas para ciudades principales de España
  const cityCoordinates = {
    Madrid: { latitude: 40.4168, longitude: -3.7038 },
    Barcelona: { latitude: 41.3851, longitude: 2.1734 },
    Valencia: { latitude: 39.4699, longitude: -0.3763 },
    Sevilla: { latitude: 37.3891, longitude: -5.9845 },
    Zaragoza: { latitude: 41.6488, longitude: -0.8891 },
    Málaga: { latitude: 36.7213, longitude: -4.4214 },
    Murcia: { latitude: 37.9922, longitude: -1.1307 },
    "Palma de Mallorca": { latitude: 39.5696, longitude: 2.6502 },
    "Las Palmas de Gran Canaria": { latitude: 28.1248, longitude: -15.4300 },
    Bilbao: { latitude: 43.2630, longitude: -2.9350 },
    Alicante: { latitude: 38.3452, longitude: -0.4810 },
    Córdoba: { latitude: 37.8882, longitude: -4.7794 },
    Valladolid: { latitude: 41.6521, longitude: -4.7288 },
    Vigo: { latitude: 42.2406, longitude: -8.7207 },
    Gijón: { latitude: 43.5322, longitude: -5.6611 },
    "Hospitalet de Llobregat": { latitude: 41.3598, longitude: 2.1007 },
    "A Coruña": { latitude: 43.3623, longitude: -8.4115 },
    Granada: { latitude: 37.1773, longitude: -3.5986 },
    Vitoria: { latitude: 42.8467, longitude: -2.6716 },
    Elche: { latitude: 38.2699, longitude: -0.6983 },
    Oviedo: { latitude: 43.3614, longitude: -5.8593 },
    "Santa Cruz de Tenerife": { latitude: 28.4636, longitude: -16.2518 },
    Badalona: { latitude: 41.4507, longitude: 2.2469 },
    Cartagena: { latitude: 37.6256, longitude: -0.9963 },
    Terrassa: { latitude: 41.5633, longitude: 2.0095 },
    Jerez: { latitude: 36.6866, longitude: -6.1369 },
    Sabadell: { latitude: 41.5433, longitude: 2.1089 },
    Pamplona: { latitude: 42.8125, longitude: -1.6458 },
    Santander: { latitude: 43.4623, longitude: -3.8099 },
    Almería: { latitude: 36.8381, longitude: -2.4597 },
    Salamanca: { latitude: 40.9701, longitude: -5.6635 },
    Logroño: { latitude: 42.4627, longitude: -2.4450 },
    Badajoz: { latitude: 38.8794, longitude: -6.9707 },
    Huelva: { latitude: 37.2578, longitude: -6.9500 },
    Tarragona: { latitude: 41.1189, longitude: 1.2445 },
    Lleida: { latitude: 41.6175, longitude: 0.6200 },
    Cáceres: { latitude: 39.4753, longitude: -6.3724 },
    "Castellón de la Plana": { latitude: 39.9864, longitude: -0.0513 },
    Albacete: { latitude: 38.9943, longitude: -1.8585 },
    Burgos: { latitude: 42.3439, longitude: -3.6969 },
    "San Sebastián": { latitude: 43.3183, longitude: -1.9812 },
    León: { latitude: 42.5987, longitude: -5.5671 },
    Toledo: { latitude: 39.8628, longitude: -4.0273 },
    Cádiz: { latitude: 36.5271, longitude: -6.2886 },
    Segovia: { latitude: 40.9429, longitude: -4.1088 },
    Ávila: { latitude: 40.6565, longitude: -4.6818 },
    Guadalajara: { latitude: 40.6324, longitude: -3.1604 },
    Cuenca: { latitude: 40.0704, longitude: -2.1374 },
    Soria: { latitude: 41.7665, longitude: -2.4790 },
    Teruel: { latitude: 40.3456, longitude: -1.1065 },
  };

  // Buscar la ciudad (case-insensitive)
  const cityKey = Object.keys(cityCoordinates).find(
    (key) => key.toLowerCase() === city.toLowerCase()
  );

  if (cityKey) {
    return cityCoordinates[cityKey];
  }

  // Si no se encuentra, devolver coordenadas de Madrid por defecto
  return { latitude: 40.4168, longitude: -3.7038 };
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
      .from("reviews")
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

