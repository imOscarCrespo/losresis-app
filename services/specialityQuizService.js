/**
 * Servicio para el test de especialidad de estudiantes.
 *
 * Gestiona:
 * - Preguntas del test (speciality_quiz_question)
 * - Opciones del test (speciality_quiz_option)
 * - Sesiones de test (speciality_quiz_session)
 * - Respuestas del usuario (speciality_quiz_answer)
 */

import { supabase, supabaseQuery } from "../config/supabase";
import { getSpecialityQuizQuestionsCatalog } from "./staticCatalogService";

const TABLE_SESSION = "speciality_quiz_session";
const TABLE_QUESTION = "speciality_quiz_question";
const TABLE_ANSWER = "speciality_quiz_answer";
export const QUIZ_VERSION_V2 = "v2_profiles_abcd";
export const QUIZ_VERSION_V3 = "v3_profiles_abcd_18";

/**
 * Obtener las preguntas del test con sus opciones.
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getQuizQuestions = async (quizVersion = null) => {
  return {
    success: true,
    data: getSpecialityQuizQuestionsCatalog(quizVersion),
    error: null,
  };
};

/**
 * Crear una nueva sesión de test para un usuario.
 * @param {string} userId
 * @param {object} meta - Información adicional opcional (por ejemplo, versión del test)
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const startQuizSession = async (userId, meta = null) => {
  if (!userId) {
    return {
      success: false,
      data: null,
      error: "userId es obligatorio para iniciar una sesión de test",
    };
  }

  return supabaseQuery(() =>
    supabase
      .from(TABLE_SESSION)
      .insert([
        {
          user_id: userId,
          meta,
        },
      ])
      .select("*")
      .single()
  );
};

/**
 * Guardar o actualizar la respuesta de una pregunta dentro de una sesión.
 * Usa el constraint único (session_id, question_id) para upsert.
 * @param {string} sessionId
 * @param {string} questionId
 * @param {number} value
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const saveQuizAnswer = async (sessionId, questionId, value) => {
  if (!sessionId || !questionId || typeof value !== "number") {
    return {
      success: false,
      data: null,
      error: "sessionId, questionId y value numérico son obligatorios",
    };
  }

  // Usamos upsert para permitir que el usuario cambie de respuesta
  return supabaseQuery(() =>
    supabase
      .from(TABLE_ANSWER)
      .upsert(
        [
          {
            session_id: sessionId,
            question_id: questionId,
            value,
          },
        ],
        {
          onConflict: "session_id,question_id",
        }
      )
      .select("*")
      .single()
  );
};

/**
 * Obtener el top 3 de especialidades calculado por la RPC de Supabase.
 * @param {string} sessionId
 * @returns {Promise<{success: boolean, data: any[], error: string|null}>}
 */
export const getTopSpecialitiesForSession = async (sessionId) => {
  if (!sessionId) {
    return {
      success: false,
      data: [],
      error: "sessionId es obligatorio para calcular el top de especialidades",
    };
  }

  return supabaseQuery(() =>
    supabase.rpc("calculate_top_specialities", {
      session_uuid: sessionId,
    })
  );
};

/**
 * Obtener el top 3 de especialidades para la versión v3 del quiz.
 * @param {string} sessionId
 * @returns {Promise<{success: boolean, data: any[], error: string|null}>}
 */
export const getTopSpecialitiesForSessionV3 = async (sessionId) => {
  if (!sessionId) {
    return {
      success: false,
      data: [],
      error: "sessionId es obligatorio para calcular el top de especialidades",
    };
  }

  return supabaseQuery(() =>
    supabase.rpc("calculate_top_specialities_v3", {
      session_uuid: sessionId,
    })
  );
};

/**
 * Finalizar una sesión guardando los resultados calculados (top 3, scores).
 * @param {string} sessionId
 * @param {Array<{speciality_key?: string, speciality_name?: string, score?: number, rank?: number, percentage?: number}>} topResults
 * @param {Record<string, number>} rawScores
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const finishQuizSession = async (
  sessionId,
  topResults,
  rawScores = null
) => {
  if (!sessionId) {
    return {
      success: false,
      data: null,
      error: "sessionId es obligatorio para finalizar la sesión",
    };
  }

  return supabaseQuery(() =>
    supabase
      .from(TABLE_SESSION)
      .update({
        finished_at: new Date().toISOString(),
        top_results: topResults || null,
        raw_scores: rawScores || null,
      })
      .eq("id", sessionId)
      .select("*")
      .single()
  );
};

/**
 * Obtener la última sesión de test de un usuario (si existe).
 * @param {string} userId
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getLastQuizSessionForUser = async (userId) => {
  if (!userId) {
    return {
      success: false,
      data: null,
      error: "userId es obligatorio para obtener la última sesión",
    };
  }

  return supabaseQuery(() =>
    supabase
      .from(TABLE_SESSION)
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
};

/**
 * Obtener el histórico de sesiones de test de un usuario.
 * @param {string} userId
 * @param {number} limit - número máximo de sesiones a devolver
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getQuizHistoryForUser = async (userId, limit = 10) => {
  if (!userId) {
    return {
      success: false,
      data: null,
      error: "userId es obligatorio para obtener el histórico de tests",
    };
  }

  return supabaseQuery(() =>
    supabase
      .from(TABLE_SESSION)
      .select("id, started_at, finished_at, top_results, raw_scores, meta")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(limit)
  );
};
