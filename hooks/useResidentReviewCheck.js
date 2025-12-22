import { useState, useEffect } from "react";
import { checkResidentReview } from "../services/communityService";

/**
 * Hook para verificar si un residente tiene una reseña
 * @param {string} userId - ID del usuario
 * @param {Object} userProfile - Perfil del usuario
 * @returns {Object} Estado de verificación de reseña
 */
export const useResidentReviewCheck = (userId, userProfile) => {
  const [hasReview, setHasReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkReview = async () => {
      // Solo verificar si es residente y no es super admin
      if (!userProfile?.is_resident || userProfile?.is_super_admin) {
        setHasReview(true); // No aplicar restricción
        setLoading(false);
        return;
      }

      if (!userId) {
        setHasReview(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const {
          success,
          hasReview: reviewExists,
          error: checkError,
        } = await checkResidentReview(userId);

        if (success) {
          setHasReview(reviewExists);
        } else {
          setError(checkError);
          setHasReview(false);
        }
      } catch (err) {
        console.error("Exception checking resident review:", err);
        setError("Error al verificar reseña");
        setHasReview(false);
      } finally {
        setLoading(false);
      }
    };

    checkReview();
  }, [userId, userProfile?.is_resident, userProfile?.is_super_admin]);

  return {
    hasReview,
    loading,
    error,
  };
};
