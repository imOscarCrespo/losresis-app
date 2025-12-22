import { supabase } from "../config/supabase";

/**
 * Servicio para gestionar reseñas de residentes
 */

/**
 * Obtiene las preguntas de reseña disponibles
 * @returns {Promise<{success: boolean, questions: Array, error: string|null}>}
 */
export const getReviewQuestions = async () => {
  try {
    const { data, error } = await supabase
      .from("question")
      .select("*")
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching review questions:", error);
      return {
        success: false,
        questions: [],
        error: error.message,
      };
    }

    return {
      success: true,
      questions: data || [],
      error: null,
    };
  } catch (error) {
    console.error("Exception in getReviewQuestions:", error);
    return {
      success: false,
      questions: [],
      error: error.message,
    };
  }
};

/**
 * Verifica si existe una reseña para un hospital y especialidad específicos
 * @param {string} userId - ID del usuario
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialtyId - ID de la especialidad
 * @returns {Promise<{success: boolean, review: Object|null, error: string|null}>}
 */
export const checkExistingReview = async (userId, hospitalId, specialtyId) => {
  try {
    const { data, error } = await supabase
      .from("review")
      .select(
        `
        *,
        review_answer (
          *,
          question (
            id,
            text,
            type,
            is_optional
          )
        )
      `
      )
      .eq("user_id", userId)
      .eq("hospital_id", hospitalId)
      .eq("speciality_id", specialtyId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = No rows returned
      console.error("Error checking existing review:", error);
      return {
        success: false,
        review: null,
        error: error.message,
      };
    }

    return {
      success: true,
      review: data || null,
      error: null,
    };
  } catch (error) {
    console.error("Exception in checkExistingReview:", error);
    return {
      success: false,
      review: null,
      error: error.message,
    };
  }
};

/**
 * Crea una nueva reseña
 * @param {string} userId - ID del usuario
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialtyId - ID de la especialidad
 * @param {Array} answers - Array de respuestas {questionId, rating?, textValue?}
 * @param {string} freeComment - Comentario libre opcional
 * @param {boolean} isAnonymous - Si la reseña es anónima
 * @returns {Promise<{success: boolean, review: Object|null, error: string|null}>}
 */
export const createReview = async (
  userId,
  hospitalId,
  specialtyId,
  answers,
  freeComment = "",
  isAnonymous = false
) => {
  try {
    // Crear la reseña
    const { data: review, error: reviewError } = await supabase
      .from("review")
      .insert({
        user_id: userId,
        hospital_id: hospitalId,
        speciality_id: specialtyId,
        free_comment: freeComment || null,
        is_anonymous: isAnonymous,
        is_approved: false, // Pendiente de moderación
      })
      .select()
      .single();

    if (reviewError) {
      console.error("Error creating review:", reviewError);
      return {
        success: false,
        review: null,
        error: reviewError.message,
      };
    }

    // Insertar las respuestas
    const answersToInsert = answers
      .filter(
        (answer) => answer.rating || answer.textValue // Solo insertar respuestas con contenido
      )
      .map((answer) => ({
        review_id: review.id,
        question_id: answer.questionId,
        rating_value: answer.rating || null,
        text_value: answer.textValue || null,
      }));

    if (answersToInsert.length > 0) {
      const { error: answersError } = await supabase
        .from("review_answer")
        .insert(answersToInsert);

      if (answersError) {
        console.error("Error creating answers:", answersError);
        // Eliminar la reseña si falla la inserción de respuestas
        await supabase.from("review").delete().eq("id", review.id);
        return {
          success: false,
          review: null,
          error: "Error al guardar las respuestas",
        };
      }
    }

    return {
      success: true,
      review,
      error: null,
    };
  } catch (error) {
    console.error("Exception in createReview:", error);
    return {
      success: false,
      review: null,
      error: error.message,
    };
  }
};

/**
 * Actualiza una reseña existente
 * @param {string} reviewId - ID de la reseña
 * @param {Array} answers - Array de respuestas actualizadas
 * @param {string} freeComment - Comentario libre opcional
 * @param {boolean} isAnonymous - Si la reseña es anónima
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const updateReview = async (
  reviewId,
  answers,
  freeComment = "",
  isAnonymous = false
) => {
  try {
    // Actualizar la reseña
    const { error: reviewError } = await supabase
      .from("review")
      .update({
        free_comment: freeComment || null,
        is_anonymous: isAnonymous,
        is_approved: false, // Volver a moderación tras editar
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    if (reviewError) {
      console.error("Error updating review:", reviewError);
      return {
        success: false,
        error: reviewError.message,
      };
    }

    // Eliminar respuestas antiguas
    await supabase.from("review_answer").delete().eq("review_id", reviewId);

    // Insertar las nuevas respuestas
    const answersToInsert = answers
      .filter((answer) => answer.rating || answer.textValue)
      .map((answer) => ({
        review_id: reviewId,
        question_id: answer.questionId,
        rating_value: answer.rating || null,
        text_value: answer.textValue || null,
      }));

    if (answersToInsert.length > 0) {
      const { error: answersError } = await supabase
        .from("review_answer")
        .insert(answersToInsert);

      if (answersError) {
        console.error("Error updating answers:", answersError);
        return {
          success: false,
          error: "Error al actualizar las respuestas",
        };
      }
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Exception in updateReview:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Elimina una reseña
 * @param {string} reviewId - ID de la reseña
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteReview = async (reviewId) => {
  try {
    // Las respuestas se eliminan automáticamente por CASCADE en la BD
    // Las imágenes también deberían tener CASCADE configurado
    const { error } = await supabase.from("review").delete().eq("id", reviewId);

    if (error) {
      console.error("Error deleting review:", error);
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
    console.error("Exception in deleteReview:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene las imágenes de una reseña
 * @param {string} reviewId - ID de la reseña
 * @returns {Promise<{success: boolean, images: Array, error: string|null}>}
 */
export const getReviewImages = async (reviewId) => {
  try {
    const { data, error } = await supabase
      .from("review_image")
      .select("*")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching review images:", error);
      return {
        success: false,
        images: [],
        error: error.message,
      };
    }

    // Obtener URLs públicas para las imágenes
    const imagesWithUrls = (data || []).map((image) => ({
      ...image,
      url: supabase.storage.from("review-images").getPublicUrl(image.path).data
        .publicUrl,
    }));

    return {
      success: true,
      images: imagesWithUrls,
      error: null,
    };
  } catch (error) {
    console.error("Exception in getReviewImages:", error);
    return {
      success: false,
      images: [],
      error: error.message,
    };
  }
};

/**
 * Sube una imagen a una reseña
 * @param {string} reviewId - ID de la reseña
 * @param {Object} imageUri - URI local de la imagen (React Native)
 * @returns {Promise<{success: boolean, image: Object|null, error: string|null}>}
 */
export const uploadReviewImage = async (reviewId, imageUri) => {
  try {
    // Generar nombre único para la imagen
    const fileExt = imageUri.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const filePath = `review/${reviewId}/${fileName}`;

    // En React Native, necesitamos crear un FormData para subir la imagen
    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      name: fileName,
      type: `image/${fileExt}`,
    });

    // Subir imagen al storage
    const { error: uploadError } = await supabase.storage
      .from("review-images")
      .upload(filePath, formData, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading image:", uploadError);
      return {
        success: false,
        image: null,
        error: uploadError.message,
      };
    }

    // Guardar referencia en la base de datos
    const { data: image, error: dbError } = await supabase
      .from("review_image")
      .insert({
        review_id: reviewId,
        path: filePath,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving image reference:", dbError);
      // Limpiar imagen subida si falla la inserción en BD
      await supabase.storage.from("review-images").remove([filePath]);
      return {
        success: false,
        image: null,
        error: dbError.message,
      };
    }

    // Obtener URL pública
    const imageWithUrl = {
      ...image,
      url: supabase.storage.from("review-images").getPublicUrl(filePath).data
        .publicUrl,
    };

    return {
      success: true,
      image: imageWithUrl,
      error: null,
    };
  } catch (error) {
    console.error("Exception in uploadReviewImage:", error);
    return {
      success: false,
      image: null,
      error: error.message,
    };
  }
};

/**
 * Elimina una imagen de una reseña
 * @param {string} imageId - ID de la imagen
 * @param {string} imagePath - Path de la imagen en el storage
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteReviewImage = async (imageId, imagePath) => {
  try {
    // Eliminar de la base de datos
    const { error: dbError } = await supabase
      .from("review_image")
      .delete()
      .eq("id", imageId);

    if (dbError) {
      console.error("Error deleting image from database:", dbError);
      return {
        success: false,
        error: dbError.message,
      };
    }

    // Eliminar del storage
    const { error: storageError } = await supabase.storage
      .from("review-images")
      .remove([imagePath]);

    if (storageError) {
      console.error("Error deleting image from storage:", storageError);
      // La imagen ya se eliminó de la BD, pero no del storage
      // Esto es aceptable, se puede limpiar manualmente después
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Exception in deleteReviewImage:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
