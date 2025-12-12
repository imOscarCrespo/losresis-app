import { useState, useCallback } from "react";
import { submitEmailReviewRequest } from "../services/userService";

/**
 * Hook para manejar la solicitud de revisión manual de email
 */
export const useEmailReview = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /**
   * Envía la solicitud de revisión de email
   */
  const submitReview = useCallback(async (userId, workEmail) => {
    if (!workEmail || !userId) {
      return {
        success: false,
        error: "Email y usuario son requeridos",
      };
    }

    setSubmitting(true);
    setSubmitted(false);

    try {
      const { success, error } = await submitEmailReviewRequest(
        userId,
        workEmail
      );

      if (success) {
        setSubmitted(true);
      }

      return { success, error };
    } catch (error) {
      console.error("Exception submitting email review:", error);
      return {
        success: false,
        error: error.message || "Error al enviar la solicitud",
      };
    } finally {
      setSubmitting(false);
    }
  }, []);

  /**
   * Resetea el estado de la revisión
   */
  const reset = useCallback(() => {
    setSubmitting(false);
    setSubmitted(false);
  }, []);

  return {
    submitting,
    submitted,
    submitReview,
    reset,
  };
};



