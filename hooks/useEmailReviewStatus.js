import { useState, useEffect, useCallback } from "react";
import { hasActiveEmailReviewRequest } from "../services/emailReviewService";

/**
 * Hook para obtener y gestionar el estado de la solicitud de revisión de email
 */
export const useEmailReviewStatus = (userId) => {
  const [hasActiveRequest, setHasActiveRequest] = useState(false);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Carga el estado de la solicitud de revisión
   */
  const loadReviewStatus = useCallback(async () => {
    if (!userId) {
      setHasActiveRequest(false);
      setRequest(null);
      return;
    }

    setLoading(true);
    try {
      const { hasActiveRequest: active, request: reviewRequest } =
        await hasActiveEmailReviewRequest(userId);
      setHasActiveRequest(active);
      setRequest(reviewRequest);
    } catch (error) {
      console.error("Error loading email review status:", error);
      setHasActiveRequest(false);
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Cargar estado cuando cambia el userId
  useEffect(() => {
    loadReviewStatus();
  }, [loadReviewStatus]);

  return {
    hasActiveRequest,
    request,
    loading,
    refresh: loadReviewStatus,
  };
};
