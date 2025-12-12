/**
 * Servicio para gestionar solicitudes de revisión de email
 */

import { supabase } from "../config/supabase";

/**
 * Obtener la solicitud de revisión de email del usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<{success: boolean, request: object|null, error: string|null}>}
 */
export const getEmailReviewRequest = async (userId) => {
  try {
    if (!userId) {
      return {
        success: false,
        request: null,
        error: "User ID is required",
      };
    }

    const { data, error } = await supabase
      .from("user_email_review_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // Si no hay registros, no es un error
      if (error.code === "PGRST116") {
        return {
          success: true,
          request: null,
          error: null,
        };
      }

      console.error("❌ Error fetching email review request:", error);
      return {
        success: false,
        request: null,
        error: error.message,
      };
    }

    return {
      success: true,
      request: data,
      error: null,
    };
  } catch (error) {
    console.error("❌ Exception fetching email review request:", error);
    return {
      success: false,
      request: null,
      error: error.message,
    };
  }
};

/**
 * Verificar si el usuario tiene una solicitud de revisión activa (pendiente o aprobada)
 * @param {string} userId - ID del usuario
 * @returns {Promise<{hasActiveRequest: boolean, request: object|null}>}
 */
export const hasActiveEmailReviewRequest = async (userId) => {
  try {
    const { success, request } = await getEmailReviewRequest(userId);

    if (!success || !request) {
      return {
        hasActiveRequest: false,
        request: null,
      };
    }

    // Considerar activas las solicitudes pendientes o aprobadas
    const hasActiveRequest =
      request.status === "PENDING" || request.status === "APPROVED";

    return {
      hasActiveRequest,
      request,
    };
  } catch (error) {
    console.error("❌ Exception checking active email review:", error);
    return {
      hasActiveRequest: false,
      request: null,
    };
  }
};
