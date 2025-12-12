/**
 * Servicio para gestionar las preguntas de estudiantes sobre hospitales/especialidades
 * Basado en la estructura del componente web
 */

import { supabase } from "../config/supabase";

/**
 * Obtener todas las preguntas de estudiantes para un hospital y especialidad
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialityId - ID de la especialidad
 * @returns {Promise<{success: boolean, questions: array|null, error: string|null}>}
 */
export const getStudentQuestions = async (hospitalId, specialityId) => {
  try {
    if (!hospitalId || !specialityId) {
      return {
        success: false,
        questions: null,
        error: "Hospital ID and Speciality ID are required",
      };
    }

    const { data, error } = await supabase
      .from("review_question")
      .select(
        `
        *,
        user:user_id(id, name, surname, is_student, is_resident, is_doctor),
        answers:review_question_answer(
          *,
          user:user_id(id, name, surname, is_student, is_resident, is_doctor, resident_year)
        )
      `
      )
      .eq("hospital_id", hospitalId)
      .eq("speciality_id", specialityId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching student questions:", error);
      return {
        success: false,
        questions: null,
        error: error.message,
      };
    }

    return {
      success: true,
      questions: data || [],
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching student questions:", error);
    return {
      success: false,
      questions: null,
      error: error.message,
    };
  }
};

/**
 * Crear una nueva pregunta de estudiante
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialityId - ID de la especialidad
 * @param {string} userId - ID del usuario (estudiante)
 * @param {string} questionText - Texto de la pregunta
 * @returns {Promise<{success: boolean, question: object|null, error: string|null}>}
 */
export const createStudentQuestion = async (
  hospitalId,
  specialityId,
  userId,
  questionText
) => {
  try {
    if (!hospitalId || !specialityId || !userId || !questionText?.trim()) {
      return {
        success: false,
        question: null,
        error: "Hospital ID, Speciality ID, User ID and question text are required",
      };
    }

    const { data, error } = await supabase
      .from("review_question")
      .insert([
        {
          hospital_id: hospitalId,
          speciality_id: specialityId,
          user_id: userId,
          question_text: questionText.trim(),
        },
      ])
      .select(
        `
        *,
        user:user_id(id, name, surname, is_student, is_resident, is_doctor),
        answers:review_question_answer(
          *,
          user:user_id(id, name, surname, is_student, is_resident, is_doctor, resident_year)
        )
      `
      )
      .single();

    if (error) {
      console.error("Error creating student question:", error);
      return {
        success: false,
        question: null,
        error: error.message,
      };
    }

    return {
      success: true,
      question: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception creating student question:", error);
    return {
      success: false,
      question: null,
      error: error.message,
    };
  }
};

/**
 * Responder a una pregunta de estudiante
 * Solo pueden responder residentes/doctores/super admins que tengan una reseña para ese hospital/especialidad
 * @param {string} questionId - ID de la pregunta
 * @param {string} userId - ID del usuario que responde
 * @param {string} answerText - Texto de la respuesta
 * @returns {Promise<{success: boolean, answer: object|null, error: string|null}>}
 */
export const answerStudentQuestion = async (questionId, userId, answerText) => {
  try {
    if (!questionId || !userId || !answerText?.trim()) {
      return {
        success: false,
        answer: null,
        error: "Question ID, User ID and answer text are required",
      };
    }

    const { data, error } = await supabase
      .from("review_question_answer")
      .insert([
        {
          question_id: questionId,
          user_id: userId,
          answer_text: answerText.trim(),
        },
      ])
      .select(
        `
        *,
        user:user_id(id, name, surname, is_student, is_resident, is_doctor, resident_year)
      `
      )
      .single();

    if (error) {
      console.error("Error answering student question:", error);
      return {
        success: false,
        answer: null,
        error: error.message,
      };
    }

    return {
      success: true,
      answer: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception answering student question:", error);
    return {
      success: false,
      answer: null,
      error: error.message,
    };
  }
};

/**
 * Verificar si un usuario puede responder preguntas para un hospital/especialidad
 * Solo pueden responder residentes/doctores/super admins que tengan una reseña para ese hospital/especialidad
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialityId - ID de la especialidad
 * @param {string} userId - ID del usuario
 * @returns {Promise<{success: boolean, canAnswer: boolean, error: string|null}>}
 */
export const canAnswerQuestions = async (hospitalId, specialityId, userId) => {
  try {
    if (!hospitalId || !specialityId || !userId) {
      return {
        success: false,
        canAnswer: false,
        error: "Hospital ID, Speciality ID and User ID are required",
      };
    }

    // Verificar si el usuario tiene una reseña para este hospital/especialidad
    const { data, error } = await supabase
      .from("review")
      .select("id")
      .eq("hospital_id", hospitalId)
      .eq("speciality_id", specialityId)
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      console.error("Error checking if user can answer:", error);
      return {
        success: false,
        canAnswer: false,
        error: error.message,
      };
    }

    return {
      success: true,
      canAnswer: data && data.length > 0,
      error: null,
    };
  } catch (error) {
    console.error("Exception checking if user can answer:", error);
    return {
      success: false,
      canAnswer: false,
      error: error.message,
    };
  }
};

/**
 * Editar una pregunta
 * @param {string} questionId - ID de la pregunta
 * @param {string} newText - Nuevo texto de la pregunta
 * @returns {Promise<{success: boolean, question: object|null, error: string|null}>}
 */
export const editStudentQuestion = async (questionId, newText) => {
  try {
    if (!questionId || !newText?.trim()) {
      return {
        success: false,
        question: null,
        error: "Question ID and new text are required",
      };
    }

    const { data, error } = await supabase
      .from("review_question")
      .update({ question_text: newText.trim() })
      .eq("id", questionId)
      .select(
        `
        *,
        user:user_id(id, name, surname, is_student, is_resident, is_doctor),
        answers:review_question_answer(
          *,
          user:user_id(id, name, surname, is_student, is_resident, is_doctor, resident_year)
        )
      `
      )
      .single();

    if (error) {
      console.error("Error editing student question:", error);
      return {
        success: false,
        question: null,
        error: error.message,
      };
    }

    return {
      success: true,
      question: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception editing student question:", error);
    return {
      success: false,
      question: null,
      error: error.message,
    };
  }
};

/**
 * Eliminar una pregunta
 * @param {string} questionId - ID de la pregunta
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteStudentQuestion = async (questionId) => {
  try {
    if (!questionId) {
      return {
        success: false,
        error: "Question ID is required",
      };
    }

    const { error } = await supabase
      .from("review_question")
      .delete()
      .eq("id", questionId);

    if (error) {
      console.error("Error deleting student question:", error);
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
    console.error("Exception deleting student question:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Editar una respuesta
 * @param {string} answerId - ID de la respuesta
 * @param {string} newText - Nuevo texto de la respuesta
 * @returns {Promise<{success: boolean, answer: object|null, error: string|null}>}
 */
export const editStudentAnswer = async (answerId, newText) => {
  try {
    if (!answerId || !newText?.trim()) {
      return {
        success: false,
        answer: null,
        error: "Answer ID and new text are required",
      };
    }

    const { data, error } = await supabase
      .from("review_question_answer")
      .update({ answer_text: newText.trim() })
      .eq("id", answerId)
      .select(
        `
        *,
        user:user_id(id, name, surname, is_student, is_resident, is_doctor, resident_year)
      `
      )
      .single();

    if (error) {
      console.error("Error editing student answer:", error);
      return {
        success: false,
        answer: null,
        error: error.message,
      };
    }

    return {
      success: true,
      answer: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception editing student answer:", error);
    return {
      success: false,
      answer: null,
      error: error.message,
    };
  }
};

/**
 * Eliminar una respuesta
 * @param {string} answerId - ID de la respuesta
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteStudentAnswer = async (answerId) => {
  try {
    if (!answerId) {
      return {
        success: false,
        error: "Answer ID is required",
      };
    }

    const { error } = await supabase
      .from("review_question_answer")
      .delete()
      .eq("id", answerId);

    if (error) {
      console.error("Error deleting student answer:", error);
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
    console.error("Exception deleting student answer:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
