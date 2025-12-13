/**
 * Servicio para gestionar las reseñas de hospitales
 */

import { supabase } from "../config/supabase";

/**
 * Obtener resúmenes de reseñas con filtros
 * @param {object} filters - Filtros para las reseñas
 * @param {string} filters.hospitalId - ID del hospital (opcional)
 * @param {string} filters.specialtyId - ID de la especialidad (opcional)
 * @param {string} filters.hospitalSearchTerm - Término de búsqueda por nombre de hospital (opcional)
 * @returns {Promise<{success: boolean, summaries: array|null, error: string|null}>}
 */
export const getReviewSummaries = async (filters = {}) => {
  try {
    // Intentar con diferentes sintaxis según la configuración de Supabase
    // Opción 1: Si la tabla es 'review' (singular) y las foreign keys están bien configuradas
    // Opción 2: Si necesitamos especificar explícitamente las foreign keys
    let query = supabase
      .from("review")
      .select(
        `
        id,
        hospital_id,
        speciality_id,
        created_at,
        approved_at,
        hospital:hospital_id(id, name, city, region),
        speciality:speciality_id(id, name)
      `
      )
      .not("approved_at", "is", null); // Solo reseñas aprobadas

    // Aplicar filtros
    if (filters.hospitalId) {
      query = query.eq("hospital_id", filters.hospitalId);
    }

    if (filters.specialtyId) {
      query = query.eq("speciality_id", filters.specialtyId);
    }

    // Ordenar por fecha de creación (más recientes primero)
    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching review summaries:", error);
      return {
        success: false,
        summaries: null,
        error: error.message,
      };
    }

    // Validar datos
    if (!data || !Array.isArray(data)) {
      return {
        success: true,
        summaries: [],
        error: null,
      };
    }

    // Filtrar por término de búsqueda de hospital si existe
    let filteredData = data;
    if (filters.hospitalSearchTerm && filters.hospitalSearchTerm.trim()) {
      const searchLower = filters.hospitalSearchTerm.toLowerCase().trim();
      filteredData = filteredData.filter((review) => {
        const hospital = review.hospital || review.hospitals;
        return hospital?.name?.toLowerCase().includes(searchLower);
      });
    }

    // Agrupar por hospital_id y speciality_id, tomando la reseña más reciente
    const summariesMap = new Map();

    filteredData.forEach((review) => {
      // Validar que tenga los datos necesarios
      // Nota: Los nombres pueden variar según la sintaxis de la relación
      const hospital = review.hospital || review.hospitals;
      const speciality = review.speciality || review.specialities;

      if (
        !review?.hospital_id ||
        !review?.speciality_id ||
        !hospital ||
        !speciality
      ) {
        return; // Saltar reviews inválidas
      }

      const key = `${review.hospital_id}-${review.speciality_id}`;
      const existing = summariesMap.get(key);

      if (
        !existing ||
        new Date(review.created_at) > new Date(existing.created_at)
      ) {
        summariesMap.set(key, {
          review_id: review.id,
          hospital_id: review.hospital_id,
          speciality_id: review.speciality_id,
          hospital_name: hospital.name || "",
          hospital_city: hospital.city || "",
          hospital_region: hospital.region || "",
          speciality_name: speciality.name || "",
          latest_review_date: review.created_at,
        });
      }
    });

    const summaries = Array.from(summariesMap.values());

    return {
      success: true,
      summaries,
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching review summaries:", error);
    return {
      success: false,
      summaries: null,
      error: error.message,
    };
  }
};

/**
 * Obtener el detalle completo de una reseña
 * @param {string} reviewId - ID de la reseña
 * @returns {Promise<{success: boolean, review: object|null, error: string|null}>}
 */
export const getReviewDetail = async (reviewId) => {
  try {
    if (!reviewId) {
      return {
        success: false,
        review: null,
        error: "Review ID is required",
      };
    }

    const { data, error } = await supabase
      .from("review")
      .select(
        `
        *,
        hospital:hospital_id(id, name, city, region),
        speciality:speciality_id(id, name),
        user:user_id(id, name, surname, resident_year)
      `
      )
      .eq("id", reviewId)
      .single();

    if (error) {
      console.error("Error fetching review detail:", error);
      return {
        success: false,
        review: null,
        error: error.message,
      };
    }

    // Obtener las respuestas de la reseña
    // Nota: La tabla probablemente es 'review_answer' (singular) según el error
    const { data: answersData, error: answersError } = await supabase
      .from("review_answer")
      .select(
        `
        *,
        review_question:question_id(id, text, type)
      `
      )
      .eq("review_id", reviewId)
      .order("question_id", { ascending: true });

    if (answersError) {
      console.error("Error fetching review answers:", answersError);
      // No fallar completamente si solo fallan las respuestas
      // Continuamos con respuestas vacías
    }

    // Obtener las imágenes de la reseña
    // Nota: La tabla probablemente es 'review_image' (singular) según el error
    const { data: imagesData, error: imagesError } = await supabase
      .from("review_image")
      .select("*")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true });

    if (imagesError) {
      console.error("Error fetching review images:", imagesError);
      // No fallar completamente si solo fallan las imágenes
      // Continuamos con imágenes vacías
    }

    // Formatear la reseña
    // Nota: Los nombres pueden variar según la sintaxis de la relación
    const formattedReview = {
      id: data.id,
      user_id: data.user_id,
      hospital_id: data.hospital_id,
      speciality_id: data.speciality_id,
      is_anonymous: data.is_anonymous,
      free_comment: data.free_comment,
      created_at: data.created_at,
      approved_at: data.approved_at,
      hospital: data.hospital || data.hospitals,
      speciality: data.speciality || data.specialities,
      user: data.user || data.users,
      answers: (answersData || []).map((answer) => ({
        id: answer.id,
        review_id: answer.review_id,
        question_id: answer.question_id,
        rating_value: answer.rating_value,
        text_value: answer.text_value,
        // Manejar ambos nombres posibles según la sintaxis de la relación
        question: answer.review_question || answer.review_questions,
      })),
      images: imagesData || [],
    };

    return {
      success: true,
      review: formattedReview,
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching review detail:", error);
    return {
      success: false,
      review: null,
      error: error.message,
    };
  }
};
