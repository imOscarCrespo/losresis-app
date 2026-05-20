import { supabase } from "../config/supabase";
import {
  getExternalRotationQuestionsCatalog,
  getHospitalByIdFromCatalog,
  getSpecialityByIdFromCatalog,
} from "./staticCatalogService";

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
  filters = {}
) => {
  try {
    const {
      country = null,
      city = null,
      specialtyId = null,
      search = null,
    } = filters;

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
      if (specialtyId) {
        query = query.eq("speciality_id", specialtyId);
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
          users!external_rotation_review_user_id_fkey (
            id,
            name,
            surname,
            work_email,
            phone,
            resident_year,
            speciality_id,
            hospital_id
          ),
          external_rotation_review_answer (
            question_id,
            rating_value,
            text_value
          ),
          external_rotation_review_thread (
            thread_id
          ),
          external_rotation (
            id,
            latitude,
            longitude,
            start_date,
            end_date,
            hospital_name,
            service_name
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
          users!external_rotation_review_user_id_fkey (
            id,
            name,
            surname,
            work_email,
            phone,
            resident_year,
            speciality_id,
            hospital_id
          ),
          external_rotation_review_answer (
            question_id,
            rating_value,
            text_value
          ),
          external_rotation_review_thread (
            thread_id
          ),
          external_rotation (
            id,
            latitude,
            longitude,
            start_date,
            end_date,
            hospital_name,
            service_name
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

      return normalizeReviews(uniqueReviews, search);
    } else {
      // Solo reseñas aprobadas
      let query = supabase
        .from("external_rotation_review")
        .select(
          `
          *,
          users!external_rotation_review_user_id_fkey (
            id,
            name,
            surname,
            work_email,
            phone,
            resident_year,
            speciality_id,
            hospital_id
          ),
          external_rotation_review_answer (
            question_id,
            rating_value,
            text_value
          ),
          external_rotation_review_thread (
            thread_id
          ),
          external_rotation (
            id,
            latitude,
            longitude,
            start_date,
            end_date,
            hospital_name,
            service_name
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

      return normalizeReviews(data || [], search);
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
    const data = getExternalRotationQuestionsCatalog();

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
      serviceName,
      specialityId,
      city,
      country,
      answers,
      difficulty,
      difficultyNotes,
      rotationKind,
      highlightSummary,
      beforeYouGo,
      tutorName,
      tutorEmail,
      preferredContactMethod,
    } = reviewData;

    if (!userId) {
      throw new Error("User ID is required");
    }

    let rotation = null;
    if (rotationId) {
      const { data: rotationData, error: rotationError } = await supabase
        .from("external_rotation")
        .select(
          "id, start_date, end_date, country, city, hospital_name, service_name, speciality_id"
        )
        .eq("id", rotationId)
        .eq("user_id", userId)
        .single();

      if (rotationError || !rotationData) {
        console.error("❌ Error fetching rotation:", rotationError);
        throw new Error("No se pudo obtener la información de la rotación");
      }

      rotation = rotationData;
    }

    const finalCountry = rotation?.country || country;
    const finalCity = rotation?.city || city;
    const finalHospitalName =
      externalHospitalName?.trim() || rotation?.hospital_name || null;
    const finalServiceName = serviceName?.trim() || rotation?.service_name || null;
    const finalSpecialityId = specialityId || rotation?.speciality_id || null;

    if (!finalCountry || !finalCity || !finalHospitalName) {
      throw new Error("Hospital, país y ciudad son obligatorios");
    }

    // Crear la reseña
    const { data: review, error: reviewError } = await supabase
      .from("external_rotation_review")
      .insert([
        {
          user_id: userId,
          rotation_id: rotationId || null,
          external_hospital_name: finalHospitalName,
          speciality_id: finalSpecialityId,
          service_name: finalServiceName,
          city: finalCity,
          country: finalCountry,
          start_date: reviewData.startDate,
          end_date: reviewData.endDate || null,
          difficulty: difficulty || null,
          difficulty_notes: difficultyNotes?.trim() || null,
          rotation_kind: rotationKind || null,
          highlight_summary: highlightSummary?.trim() || null,
          before_you_go: beforeYouGo?.trim() || null,
          tutor_name: tutorName?.trim() || null,
          tutor_email: tutorEmail?.trim() || null,
          preferred_contact_method:
            preferredContactMethod || "app_chat",
          allow_app_contact:
            preferredContactMethod === "app_chat" ||
            preferredContactMethod === "whatsapp" ||
            preferredContactMethod === "email",
          free_comment: null,
          is_anonymous: false,
          is_approved: true, // Publicadas automáticamente hasta implementar moderación
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
    const {
      externalHospitalName,
      serviceName,
      specialityId,
      city,
      country,
      answers,
      difficulty,
      difficultyNotes,
      rotationKind,
      highlightSummary,
      beforeYouGo,
      tutorName,
      tutorEmail,
      preferredContactMethod,
      rotationId,
      userId,
      startDate: inputStartDate,
      endDate: inputEndDate,
    } = reviewData;

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
    let resolvedStartDate = null;
    let resolvedEndDate = null;
    let rotationCountry = null;
    let rotationCity = null;
    let rotationHospitalName = null;
    let rotationServiceName = null;
    let rotationSpecialityId = null;

    if (finalRotationId && finalUserId) {
      const { data: rotation } = await supabase
        .from("external_rotation")
        .select(
          "start_date, end_date, country, city, hospital_name, service_name, speciality_id"
        )
        .eq("id", finalRotationId)
        .eq("user_id", finalUserId)
        .single();

      if (rotation) {
        resolvedStartDate = rotation.start_date;
        resolvedEndDate = rotation.end_date;
        rotationCountry = rotation.country;
        rotationCity = rotation.city;
        rotationHospitalName = rotation.hospital_name;
        rotationServiceName = rotation.service_name;
        rotationSpecialityId = rotation.speciality_id;
      }
    }

    // Usar country y city de la rotación si están disponibles, sino usar los del formulario
    const finalCountry = rotationCountry || country;
    const finalCity = rotationCity || city;
    const finalHospitalName =
      externalHospitalName?.trim() || rotationHospitalName || null;
    const finalServiceName = serviceName?.trim() || rotationServiceName || null;
    const finalSpecialityId = specialityId || rotationSpecialityId || null;

    // Actualizar la reseña
    const { data: review, error: reviewError } = await supabase
      .from("external_rotation_review")
      .update({
        rotation_id: finalRotationId || null,
        external_hospital_name: finalHospitalName,
        speciality_id: finalSpecialityId,
        service_name: finalServiceName,
        city: finalCity,
        country: finalCountry,
        start_date: resolvedStartDate || inputStartDate,
        end_date: resolvedEndDate || inputEndDate || null,
        difficulty: difficulty || null,
        difficulty_notes: difficultyNotes?.trim() || null,
        rotation_kind: rotationKind || null,
        highlight_summary: highlightSummary?.trim() || null,
        before_you_go: beforeYouGo?.trim() || null,
        tutor_name: tutorName?.trim() || null,
        tutor_email: tutorEmail?.trim() || null,
        preferred_contact_method:
          preferredContactMethod || "app_chat",
        allow_app_contact:
          preferredContactMethod === "app_chat" ||
          preferredContactMethod === "whatsapp" ||
          preferredContactMethod === "email",
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
      const answersToInsert = answers
        .filter((answer) => answer?.question_id)
        .map((answer) => ({
          review_id: reviewId,
          question_id: answer.question_id,
          rating_value:
            answer.rating_value !== undefined && answer.rating_value !== null
              ? Number(answer.rating_value)
              : null,
          text_value: answer.text_value?.trim() || null,
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
        users!external_rotation_review_user_id_fkey (
          id,
          name,
          surname,
          work_email,
          phone,
          resident_year,
          speciality_id,
          hospital_id
        ),
        external_rotation_review_thread (
          thread_id
        ),
        external_rotation (
          id,
          latitude,
          longitude,
          start_date,
          end_date,
          hospital_name,
          service_name
        ),
        external_rotation_review_answer (
          *
        )
      `
      )
      .eq("id", reviewId)
      .single();

    if (error) {
      console.error("❌ Error fetching rotation review with answers:", error);
      throw error;
    }

    return normalizeReviews([
      {
        ...data,
        external_rotation_review_answer: (
          data.external_rotation_review_answer || []
        ).map((answer) => ({
          ...answer,
          external_rotation_question:
            getExternalRotationQuestionsCatalog().find(
              (question) => question.id === answer.question_id
            ) || null,
        })),
      },
    ])[0];
  } catch (error) {
    console.error("❌ Exception in getRotationReviewWithAnswers:", error);
    throw error;
  }
};

const normalizeReviews = (reviews, search = null) => {
  const mapped = (reviews || []).map((review) => {
    const reviewSpeciality = getSpecialityByIdFromCatalog(review.speciality_id);
    const userSpeciality = getSpecialityByIdFromCatalog(
      review.users?.speciality_id
    );
    const userHospital = getHospitalByIdFromCatalog(review.users?.hospital_id);
    const ratingValues = (review.external_rotation_review_answer || [])
      .map((answer) => answer.rating_value)
      .filter((value) => typeof value === "number");

    const averageRating = ratingValues.length
      ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
      : null;

    return {
      ...review,
      average_rating: averageRating,
      ratings_count: ratingValues.length,
      thread_id: review.external_rotation_review_thread?.thread_id || null,
      reviewer_name: review.users?.name || "",
      reviewer_surname: review.users?.surname || "",
      reviewer_email: review.users?.work_email || "",
      reviewer_phone: review.users?.phone || "",
      reviewer_hospital_name: userHospital?.name || "",
      reviewer_specialty_name:
        reviewSpeciality?.name || userSpeciality?.name || "",
      specialty_name:
        reviewSpeciality?.name || userSpeciality?.name || "",
    };
  });

  if (!search?.trim()) {
    return mapped;
  }

  const normalizedSearch = search.trim().toLowerCase();
  return mapped.filter((review) =>
    [
      review.external_hospital_name,
      review.service_name,
      review.city,
      review.country,
      review.highlight_summary,
      review.before_you_go,
      review.specialty_name,
      review.reviewer_name,
      review.reviewer_surname,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch))
  );
};

const getOrCreateExternalRotationsForum = async () => {
  const { data: existingForum, error: forumError } = await supabase
    .from("forum")
    .select("id")
    .eq("scope", "external_rotations")
    .eq("role_scope", "resident")
    .maybeSingle();

  if (forumError) {
    throw forumError;
  }

  if (existingForum) {
    return existingForum.id;
  }

  const { data: createdForum, error: createForumError } = await supabase
    .from("forum")
    .insert({
      name: "Rotaciones Externas",
      scope: "external_rotations",
      role_scope: "resident",
      description: "Preguntas y conversaciones sobre rotaciones externas",
      speciality_id: null,
      city: null,
    })
    .select("id")
    .single();

  if (createForumError) {
    throw createForumError;
  }

  return createdForum.id;
};

export const ensureReviewContactThread = async (reviewId) => {
  if (!reviewId) {
    throw new Error("Review ID is required");
  }

  const { data: reviewThread } = await supabase
    .from("external_rotation_review_thread")
    .select("thread_id")
    .eq("review_id", reviewId)
    .maybeSingle();

  if (reviewThread?.thread_id) {
    return reviewThread.thread_id;
  }

  const { data: review, error: reviewError } = await supabase
    .from("external_rotation_review")
    .select("id, user_id, external_hospital_name, city, country")
    .eq("id", reviewId)
    .single();

  if (reviewError || !review) {
    throw reviewError || new Error("Review not found");
  }

  const forumId = await getOrCreateExternalRotationsForum();
  const title = `Dudas sobre ${review.external_hospital_name} (${review.city}, ${review.country})`;
  const body =
    "Espacio para resolver dudas sobre esta experiencia de rotación externa.";

  const { data: thread, error: threadError } = await supabase
    .from("thread")
    .insert({
      forum_id: forumId,
      user_id: review.user_id,
      title,
      body,
    })
    .select("id")
    .single();

  if (threadError) {
    throw threadError;
  }

  const { error: linkError } = await supabase
    .from("external_rotation_review_thread")
    .insert({
      review_id: reviewId,
      thread_id: thread.id,
    });

  if (linkError) {
    throw linkError;
  }

  return thread.id;
};

export const getFavoriteExternalRotationReviews = async (userId) => {
  try {
    if (!userId) {
      return [];
    }

    const { data: favorites, error: favoritesError } = await supabase
      .from("external_rotation_review_favorite")
      .select("review_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (favoritesError) {
      console.error(
        "❌ Error fetching favorite rotation reviews:",
        favoritesError
      );
      throw favoritesError;
    }

    const reviewIds = (favorites || []).map((favorite) => favorite.review_id);

    if (!reviewIds.length) {
      return [];
    }

    const { data: reviews, error: reviewsError } = await supabase
      .from("external_rotation_review")
      .select(
        `
        *,
        users!external_rotation_review_user_id_fkey (
          id,
          name,
          surname,
          work_email,
          phone,
          resident_year,
          speciality_id,
          hospital_id
        ),
        external_rotation_review_answer (
          question_id,
          rating_value,
          text_value
        ),
        external_rotation_review_thread (
          thread_id
        ),
        external_rotation (
          id,
          latitude,
          longitude,
          start_date,
          end_date,
          hospital_name,
          service_name
        )
      `
      )
      .in("id", reviewIds);

    if (reviewsError) {
      console.error(
        "❌ Error fetching favorite rotation reviews:",
        reviewsError
      );
      throw reviewsError;
    }

    const reviewById = new Map((reviews || []).map((review) => [review.id, review]));
    const favoriteReviews = reviewIds
      .map((reviewId) => reviewById.get(reviewId))
      .filter(Boolean);

    return normalizeReviews(favoriteReviews);
  } catch (error) {
    console.error("❌ Exception in getFavoriteExternalRotationReviews:", error);
    throw error;
  }
};

export const isExternalRotationReviewFavorite = async (userId, reviewId) => {
  try {
    if (!userId || !reviewId) {
      return false;
    }

    const { data, error } = await supabase
      .from("external_rotation_review_favorite")
      .select("review_id")
      .eq("user_id", userId)
      .eq("review_id", reviewId)
      .maybeSingle();

    if (error) {
      console.error("❌ Error checking favorite rotation review:", error);
      throw error;
    }

    return Boolean(data?.review_id);
  } catch (error) {
    console.error("❌ Exception in isExternalRotationReviewFavorite:", error);
    throw error;
  }
};

export const setExternalRotationReviewFavorite = async (
  userId,
  reviewId,
  shouldFavorite
) => {
  try {
    if (!userId || !reviewId) {
      throw new Error("User ID and review ID are required");
    }

    if (shouldFavorite) {
      const { error } = await supabase
        .from("external_rotation_review_favorite")
        .upsert(
          {
            user_id: userId,
            review_id: reviewId,
          },
          { onConflict: "user_id,review_id", ignoreDuplicates: true }
        );

      if (error) {
        console.error("❌ Error creating favorite rotation review:", error);
        throw error;
      }

      return true;
    }

    const { error } = await supabase
      .from("external_rotation_review_favorite")
      .delete()
      .eq("user_id", userId)
      .eq("review_id", reviewId);

    if (error) {
      console.error("❌ Error deleting favorite rotation review:", error);
      throw error;
    }

    return false;
  } catch (error) {
    console.error("❌ Exception in setExternalRotationReviewFavorite:", error);
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
  ensureReviewContactThread,
  getFavoriteExternalRotationReviews,
  isExternalRotationReviewFavorite,
  setExternalRotationReviewFavorite,
};
