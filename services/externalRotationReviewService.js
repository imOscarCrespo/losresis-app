import { supabase } from "../config/supabase";

/**
 * Servicio para gestionar reseñas de rotaciones externas
 */

/**
 * Obtiene todas las reseñas aprobadas de rotaciones externas
 * También incluye la propia reseña del usuario si se proporciona userId, incluso si no está aprobada
 * @param {string} userId - ID del usuario (opcional) para incluir su propia reseña
 * @param {string} country - País para filtrar (opcional)
 * @param {string} city - Ciudad para filtrar (opcional)
 * @returns {Promise<Array>} Lista de reseñas
 */
export const getAllExternalRotationReviews = async (
  userId = null,
  country = null,
  city = null
) => {
  try {
    // Construir query base
    const buildQuery = (baseQuery) => {
      let query = baseQuery;

      // Aplicar filtros de país y ciudad
      if (country) {
        query = query.eq("country", country);
      }
      if (city) {
        query = query.eq("city", city);
      }

      return query;
    };

    // Si se proporciona userId, obtener todas las reseñas aprobadas Y las del usuario
    // Si no se proporciona userId, solo mostrar reseñas aprobadas
    if (userId) {
      // Obtener reseñas aprobadas
      let approvedQuery = supabase
        .from("external_rotation_review")
        .select(
          `
          *,
          external_rotation (
            id,
            latitude,
            longitude,
            start_date,
            end_date
          )
        `
        )
        .eq("is_approved", true);

      approvedQuery = buildQuery(approvedQuery);
      approvedQuery = approvedQuery.order("created_at", { ascending: false });

      const { data: approvedReviews, error: approvedError } =
        await approvedQuery;

      if (approvedError) {
        console.error("❌ Error fetching approved reviews:", approvedError);
        throw approvedError;
      }

      // Obtener reseñas del usuario (incluso si no están aprobadas)
      let userQuery = supabase
        .from("external_rotation_review")
        .select(
          `
          *,
          external_rotation (
            id,
            latitude,
            longitude,
            start_date,
            end_date
          )
        `
        )
        .eq("user_id", userId);

      userQuery = buildQuery(userQuery);
      userQuery = userQuery.order("created_at", { ascending: false });

      const { data: userReviews, error: userError } = await userQuery;

      if (userError) {
        console.error("❌ Error fetching user reviews:", userError);
        throw userError;
      }

      // Combinar y eliminar duplicados (si el usuario tiene una reseña aprobada)
      const allReviews = [...(approvedReviews || []), ...(userReviews || [])];
      const uniqueReviews = Array.from(
        new Map(allReviews.map((review) => [review.id, review])).values()
      );

      // Ordenar por fecha de creación (más recientes primero)
      uniqueReviews.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      return uniqueReviews;
    } else {
      // Solo reseñas aprobadas
      let query = supabase
        .from("external_rotation_review")
        .select(
          `
          *,
          external_rotation (
            id,
            latitude,
            longitude,
            start_date,
            end_date
          )
        `
        )
        .eq("is_approved", true);

      query = buildQuery(query);
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("❌ Error fetching external rotation reviews:", error);
        throw error;
      }

      return data || [];
    }
  } catch (error) {
    console.error("❌ Exception in getAllExternalRotationReviews:", error);
    throw error;
  }
};

/**
 * Verifica si el usuario ya tiene una reseña para su rotación
 * @param {string} userId - ID del usuario
 * @param {string} rotationId - ID de la rotación
 * @returns {Promise<Object|null>} Reseña existente o null
 */
export const checkExistingRotationReview = async (userId, rotationId) => {
  try {
    if (!userId || !rotationId) {
      console.warn(
        "⚠️ checkExistingRotationReview: Missing userId or rotationId"
      );
      return null;
    }

    const { data, error } = await supabase
      .from("external_rotation_review")
      .select("*")
      .eq("user_id", userId)
      .eq("rotation_id", rotationId)
      .maybeSingle();

    if (error) {
      console.error("❌ Error checking existing review:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Exception in checkExistingRotationReview:", error);
    throw error;
  }
};

/**
 * Obtiene las preguntas para reseñas de rotaciones externas
 * @returns {Promise<Array>} Lista de preguntas
 */
export const getRotationReviewQuestions = async () => {
  try {
    const { data, error } = await supabase
      .from("external_rotation_question")
      .select("*")
      .order("position", { ascending: true });

    if (error) {
      console.error("❌ Error fetching rotation review questions:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("❌ Exception in getRotationReviewQuestions:", error);
    throw error;
  }
};

/**
 * Crea una nueva reseña de rotación externa
 * @param {Object} reviewData - Datos de la reseña
 * @returns {Promise<Object>} Reseña creada
 */
export const createRotationReview = async (reviewData) => {
  try {
    const {
      userId,
      rotationId,
      externalHospitalName,
      city,
      country,
      answers,
      freeComment,
      isAnonymous,
    } = reviewData;

    if (!userId || !rotationId) {
      throw new Error("User ID and Rotation ID are required");
    }

    // Obtener start_date, end_date, country y city de la rotación
    const { data: rotation, error: rotationError } = await supabase
      .from("external_rotation")
      .select("start_date, end_date, country, city")
      .eq("id", rotationId)
      .eq("user_id", userId)
      .single();

    if (rotationError || !rotation) {
      console.error("❌ Error fetching rotation:", rotationError);
      throw new Error("No se pudo obtener la información de la rotación");
    }

    // Usar country y city de la rotación si están disponibles, sino usar los del formulario
    const finalCountry = rotation.country || country;
    const finalCity = rotation.city || city;

    // Crear la reseña
    const { data: review, error: reviewError } = await supabase
      .from("external_rotation_review")
      .insert([
        {
          user_id: userId,
          rotation_id: rotationId,
          external_hospital_name: externalHospitalName,
          city: finalCity,
          country: finalCountry,
          start_date: rotation.start_date,
          end_date: rotation.end_date,
          free_comment: freeComment || null,
          is_anonymous: isAnonymous || false,
          is_approved: false, // Requiere aprobación
        },
      ])
      .select()
      .single();

    if (reviewError) {
      console.error("❌ Error creating rotation review:", reviewError);
      throw reviewError;
    }

    // Crear las respuestas
    if (answers && answers.length > 0) {
      const answersToInsert = answers
        .filter((answer) => {
          // Filtrar respuestas sin question_id o sin valores
          if (!answer || !answer.question_id) {
            return false;
          }
          // Verificar que tenga al menos un valor
          const hasRating =
            answer.rating_value !== undefined && answer.rating_value !== null;
          const hasText = answer.text_value && answer.text_value.trim() !== "";
          return hasRating || hasText;
        })
        .map((answer) => {
          // Validar que question_id sea un UUID válido
          const questionId = answer.question_id;
          if (!questionId) {
            return null;
          }

          // Verificar formato UUID básico (8-4-4-4-12 caracteres hexadecimales)
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const questionIdStr = String(questionId).trim();
          if (!uuidRegex.test(questionIdStr)) {
            return null;
          }

          return {
            review_id: review.id,
            question_id: questionIdStr, // UUID como string
            rating_value:
              answer.rating_value !== undefined && answer.rating_value !== null
                ? Number(answer.rating_value)
                : null,
            text_value:
              answer.text_value && answer.text_value.trim() !== ""
                ? answer.text_value.trim()
                : null,
          };
        })
        .filter((answer) => answer !== null); // Filtrar nulos

      if (answersToInsert.length > 0) {
        // Insertar todas las respuestas de una vez
        const { error: answersError } = await supabase
          .from("external_rotation_review_answer")
          .insert(answersToInsert);

        if (answersError) {
          console.error(
            "❌ Error creating rotation review answers:",
            answersError
          );

          // Intentar eliminar la reseña si fallan las respuestas
          await supabase
            .from("external_rotation_review")
            .delete()
            .eq("id", review.id);

          throw answersError;
        }
      }
    }

    return review;
  } catch (error) {
    console.error("❌ Exception in createRotationReview:", error);
    throw error;
  }
};

/**
 * Actualiza una reseña de rotación externa
 * @param {string} reviewId - ID de la reseña
 * @param {Object} reviewData - Datos a actualizar
 * @returns {Promise<Object>} Reseña actualizada
 */
export const updateRotationReview = async (reviewId, reviewData) => {
  try {
    const { externalHospitalName, city, country, answers, rotationId, userId } =
      reviewData;

    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    // Obtener rotation_id y user_id de la reseña si no se proporcionan
    let finalRotationId = rotationId;
    let finalUserId = userId;

    if (!finalRotationId || !finalUserId) {
      const { data: existingReview } = await supabase
        .from("external_rotation_review")
        .select("rotation_id, user_id")
        .eq("id", reviewId)
        .single();

      if (existingReview) {
        finalRotationId = finalRotationId || existingReview.rotation_id;
        finalUserId = finalUserId || existingReview.user_id;
      }
    }

    // Obtener start_date, end_date, country y city de la rotación
    let startDate = null;
    let endDate = null;
    let rotationCountry = null;
    let rotationCity = null;

    if (finalRotationId && finalUserId) {
      const { data: rotation } = await supabase
        .from("external_rotation")
        .select("start_date, end_date, country, city")
        .eq("id", finalRotationId)
        .eq("user_id", finalUserId)
        .single();

      if (rotation) {
        startDate = rotation.start_date;
        endDate = rotation.end_date;
        rotationCountry = rotation.country;
        rotationCity = rotation.city;
      }
    }

    // Usar country y city de la rotación si están disponibles, sino usar los del formulario
    const finalCountry = rotationCountry || country;
    const finalCity = rotationCity || city;

    // Actualizar la reseña
    const { data: review, error: reviewError } = await supabase
      .from("external_rotation_review")
      .update({
        external_hospital_name: externalHospitalName,
        city: finalCity,
        country: finalCountry,
        start_date: startDate,
        end_date: endDate,
      })
      .eq("id", reviewId)
      .select()
      .single();

    if (reviewError) {
      console.error("❌ Error updating rotation review:", reviewError);
      throw reviewError;
    }

    // Eliminar respuestas existentes
    const { error: deleteError } = await supabase
      .from("external_rotation_review_answer")
      .delete()
      .eq("review_id", reviewId);

    if (deleteError) {
      console.error("❌ Error deleting old answers:", deleteError);
      throw deleteError;
    }

    // Crear nuevas respuestas
    if (answers && answers.length > 0) {
      const answersToInsert = answers.map((answer) => ({
        review_id: reviewId,
        question_id: answer.question_id,
        rating_value: answer.rating_value || null,
        text_value: answer.text_value || null,
      }));

      const { error: answersError } = await supabase
        .from("external_rotation_review_answer")
        .insert(answersToInsert);

      if (answersError) {
        console.error("❌ Error creating new answers:", answersError);
        throw answersError;
      }
    }

    return review;
  } catch (error) {
    console.error("❌ Exception in updateRotationReview:", error);
    throw error;
  }
};

/**
 * Elimina una reseña de rotación externa
 * @param {string} reviewId - ID de la reseña
 * @param {string} userId - ID del usuario (para verificar permisos)
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
export const deleteRotationReview = async (reviewId, userId) => {
  try {
    if (!reviewId || !userId) {
      throw new Error("Review ID and User ID are required");
    }

    // Primero eliminar las respuestas
    const { error: answersError } = await supabase
      .from("external_rotation_review_answer")
      .delete()
      .eq("review_id", reviewId);

    if (answersError) {
      console.error("❌ Error deleting answers:", answersError);
      throw answersError;
    }

    // Luego eliminar la reseña
    const { error: reviewError } = await supabase
      .from("external_rotation_review")
      .delete()
      .eq("id", reviewId)
      .eq("user_id", userId);

    if (reviewError) {
      console.error("❌ Error deleting rotation review:", reviewError);
      throw reviewError;
    }

    return true;
  } catch (error) {
    console.error("❌ Exception in deleteRotationReview:", error);
    throw error;
  }
};

/**
 * Obtiene una reseña con sus respuestas
 * @param {string} reviewId - ID de la reseña
 * @returns {Promise<Object>} Reseña con respuestas
 */
export const getRotationReviewWithAnswers = async (reviewId) => {
  try {
    if (!reviewId) {
      throw new Error("Review ID is required");
    }

    const { data, error } = await supabase
      .from("external_rotation_review")
      .select(
        `
        *,
        external_rotation_review_answer (
          *,
          external_rotation_question (*)
        )
      `
      )
      .eq("id", reviewId)
      .single();

    if (error) {
      console.error("❌ Error fetching rotation review with answers:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Exception in getRotationReviewWithAnswers:", error);
    throw error;
  }
};

export default {
  getAllExternalRotationReviews,
  checkExistingRotationReview,
  getRotationReviewQuestions,
  createRotationReview,
  updateRotationReview,
  deleteRotationReview,
  getRotationReviewWithAnswers,
};
