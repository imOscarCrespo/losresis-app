import { supabase } from '../config/supabase';

/**
 * Servicio para gestionar reseñas de rotaciones externas
 */

/**
 * Obtiene todas las reseñas aprobadas de rotaciones externas
 * @returns {Promise<Array>} Lista de reseñas
 */
export const getAllExternalRotationReviews = async () => {
  try {
    const { data, error } = await supabase
      .from('external_rotation_review')
      .select(`
        *,
        external_rotation (
          id,
          latitude,
          longitude,
          start_date,
          end_date
        )
      `)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching external rotation reviews:', error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} external rotation reviews`);
    return data || [];
  } catch (error) {
    console.error('❌ Exception in getAllExternalRotationReviews:', error);
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
      console.warn('⚠️ checkExistingRotationReview: Missing userId or rotationId');
      return null;
    }

    const { data, error } = await supabase
      .from('external_rotation_review')
      .select('*')
      .eq('user_id', userId)
      .eq('rotation_id', rotationId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error checking existing review:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Exception in checkExistingRotationReview:', error);
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
      .from('external_rotation_question')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      console.error('❌ Error fetching rotation review questions:', error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} rotation review questions`);
    return data || [];
  } catch (error) {
    console.error('❌ Exception in getRotationReviewQuestions:', error);
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
    const { userId, rotationId, externalHospitalName, city, country, answers } = reviewData;

    if (!userId || !rotationId) {
      throw new Error('User ID and Rotation ID are required');
    }

    // Crear la reseña
    const { data: review, error: reviewError } = await supabase
      .from('external_rotation_review')
      .insert([
        {
          user_id: userId,
          rotation_id: rotationId,
          external_hospital_name: externalHospitalName,
          city: city,
          country: country,
          is_approved: false, // Requiere aprobación
        },
      ])
      .select()
      .single();

    if (reviewError) {
      console.error('❌ Error creating rotation review:', reviewError);
      throw reviewError;
    }

    // Crear las respuestas
    if (answers && answers.length > 0) {
      const answersToInsert = answers.map((answer) => ({
        review_id: review.id,
        question_id: answer.question_id,
        rating_value: answer.rating_value || null,
        text_value: answer.text_value || null,
      }));

      const { error: answersError } = await supabase
        .from('external_rotation_answer')
        .insert(answersToInsert);

      if (answersError) {
        console.error('❌ Error creating rotation review answers:', answersError);
        // Intentar eliminar la reseña si fallan las respuestas
        await supabase.from('external_rotation_review').delete().eq('id', review.id);
        throw answersError;
      }
    }

    console.log('✅ Rotation review created successfully:', review);
    return review;
  } catch (error) {
    console.error('❌ Exception in createRotationReview:', error);
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
    const { externalHospitalName, city, country, answers } = reviewData;

    if (!reviewId) {
      throw new Error('Review ID is required');
    }

    // Actualizar la reseña
    const { data: review, error: reviewError } = await supabase
      .from('external_rotation_review')
      .update({
        external_hospital_name: externalHospitalName,
        city: city,
        country: country,
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (reviewError) {
      console.error('❌ Error updating rotation review:', reviewError);
      throw reviewError;
    }

    // Eliminar respuestas existentes
    const { error: deleteError } = await supabase
      .from('external_rotation_answer')
      .delete()
      .eq('review_id', reviewId);

    if (deleteError) {
      console.error('❌ Error deleting old answers:', deleteError);
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
        .from('external_rotation_answer')
        .insert(answersToInsert);

      if (answersError) {
        console.error('❌ Error creating new answers:', answersError);
        throw answersError;
      }
    }

    console.log('✅ Rotation review updated successfully:', review);
    return review;
  } catch (error) {
    console.error('❌ Exception in updateRotationReview:', error);
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
      throw new Error('Review ID and User ID are required');
    }

    // Primero eliminar las respuestas
    const { error: answersError } = await supabase
      .from('external_rotation_answer')
      .delete()
      .eq('review_id', reviewId);

    if (answersError) {
      console.error('❌ Error deleting answers:', answersError);
      throw answersError;
    }

    // Luego eliminar la reseña
    const { error: reviewError } = await supabase
      .from('external_rotation_review')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId);

    if (reviewError) {
      console.error('❌ Error deleting rotation review:', reviewError);
      throw reviewError;
    }

    console.log('✅ Rotation review deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Exception in deleteRotationReview:', error);
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
      throw new Error('Review ID is required');
    }

    const { data, error } = await supabase
      .from('external_rotation_review')
      .select(`
        *,
        external_rotation_answer (
          *,
          external_rotation_question (*)
        )
      `)
      .eq('id', reviewId)
      .single();

    if (error) {
      console.error('❌ Error fetching rotation review with answers:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Exception in getRotationReviewWithAnswers:', error);
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

