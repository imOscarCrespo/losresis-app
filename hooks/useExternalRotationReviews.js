import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getAllExternalRotationReviews,
  checkExistingRotationReview,
  getRotationReviewQuestions,
  createRotationReview,
  updateRotationReview,
  deleteRotationReview,
} from '../services/externalRotationReviewService';

/**
 * Hook para gestionar reseñas de rotaciones externas del usuario
 * @param {string} userId - ID del usuario
 * @param {string} rotationId - ID de la rotación del usuario
 * @returns {Object} Estado y funciones para gestionar reseñas
 */
export const useExternalRotationReview = (userId, rotationId) => {
  const [existingReview, setExistingReview] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Verificar si ya existe una reseña
  const checkExisting = useCallback(async () => {
    if (!userId || !rotationId) return;

    setLoading(true);
    try {
      const review = await checkExistingRotationReview(userId, rotationId);
      setExistingReview(review);
    } catch (err) {
      console.error('Error checking existing review:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, rotationId]);

  // Cargar preguntas
  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const data = await getRotationReviewQuestions();
      setQuestions(data);
    } catch (err) {
      console.error('Error loading questions:', err);
      setError('Error al cargar las preguntas');
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  // Crear reseña
  const createReview = useCallback(
    async (reviewData) => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const review = await createRotationReview(reviewData);
        setExistingReview(review);
        setSuccess('Reseña creada correctamente. Estará visible tras aprobación.');
        return true;
      } catch (err) {
        console.error('Error creating review:', err);
        setError('Error al crear la reseña');
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Actualizar reseña
  const updateReview = useCallback(
    async (reviewId, reviewData) => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const review = await updateRotationReview(reviewId, reviewData);
        setExistingReview(review);
        setSuccess('Reseña actualizada correctamente');
        return true;
      } catch (err) {
        console.error('Error updating review:', err);
        setError('Error al actualizar la reseña');
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Eliminar reseña
  const deleteReview = useCallback(
    async (reviewId) => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        await deleteRotationReview(reviewId, userId);
        setExistingReview(null);
        setSuccess('Reseña eliminada correctamente');
        return true;
      } catch (err) {
        console.error('Error deleting review:', err);
        setError('Error al eliminar la reseña');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const clearError = useCallback(() => setError(null), []);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  return {
    existingReview,
    questions,
    loading,
    loadingQuestions,
    error,
    success,
    checkExisting,
    loadQuestions,
    createReview,
    updateReview,
    deleteReview,
    clearError,
    clearSuccess,
  };
};

/**
 * Hook para obtener todas las reseñas de rotaciones externas (listado público)
 * @returns {Object} Estado y funciones
 */
export const useExternalRotationReviewsList = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAllExternalRotationReviews();
      setReviews(data);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Error al cargar las reseñas');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reviews,
    loading,
    error,
    fetchReviews,
  };
};

export default useExternalRotationReview;

