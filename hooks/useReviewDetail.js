import { useState, useCallback } from "react";
import { getReviewDetail } from "../services/reviewsService";

/**
 * Hook personalizado para manejar el detalle de una reseña
 */
export const useReviewDetail = () => {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReviewDetail = useCallback(async (reviewId) => {
    if (!reviewId) {
      setError("Review ID is required");
      return;
    }

    setLoading(true);
    setError(null);
    setReview(null);

    try {
      const {
        success,
        review: reviewData,
        error: err,
      } = await getReviewDetail(reviewId);

      if (success) {
        setReview(reviewData);
      } else {
        setError(err || "Error al cargar el detalle de la reseña");
      }
    } catch (err) {
      setError(err.message || "Error al cargar el detalle de la reseña");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    review,
    loading,
    error,
    fetchReviewDetail,
  };
};
