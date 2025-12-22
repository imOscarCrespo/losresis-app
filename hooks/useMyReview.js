import { useState, useCallback, useEffect } from "react";
import {
  getReviewQuestions,
  checkExistingReview,
  createReview,
  updateReview,
  deleteReview,
  getReviewImages,
  uploadReviewImage,
  deleteReviewImage,
} from "../services/reviewService";

/**
 * Hook para gestionar la reseña del usuario
 * @param {string} userId - ID del usuario
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialtyId - ID de la especialidad
 * @returns {Object} Estado y funciones para gestionar la reseña
 */
export const useMyReview = (userId, hospitalId, specialtyId) => {
  // Estados principales
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [existingReview, setExistingReview] = useState(null);
  const [images, setImages] = useState([]);

  // Estados de carga y error
  const [loading, setLoading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  /**
   * Obtiene las preguntas de reseña
   */
  const fetchReviewQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    setError(null);
    try {
      const {
        success,
        questions,
        error: fetchError,
      } = await getReviewQuestions();

      if (success) {
        setReviewQuestions(questions);
      } else {
        setError(fetchError || "Error al cargar las preguntas");
      }
    } catch (err) {
      console.error("Exception fetching review questions:", err);
      setError("Error inesperado al cargar las preguntas");
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  /**
   * Verifica si existe una reseña
   */
  const fetchExistingReview = useCallback(async () => {
    if (!userId || !hospitalId || !specialtyId) return;

    setLoading(true);
    setError(null);
    try {
      const {
        success,
        review,
        error: checkError,
      } = await checkExistingReview(userId, hospitalId, specialtyId);

      if (success) {
        setExistingReview(review);
        // Si existe reseña, cargar también sus imágenes
        if (review?.id) {
          await fetchImages(review.id);
        }
      } else {
        setError(checkError || "Error al verificar reseña existente");
      }
    } catch (err) {
      console.error("Exception checking existing review:", err);
      setError("Error inesperado al verificar la reseña");
    } finally {
      setLoading(false);
    }
  }, [userId, hospitalId, specialtyId]);

  /**
   * Obtiene las imágenes de una reseña
   */
  const fetchImages = useCallback(async (reviewId) => {
    if (!reviewId) return;

    setLoadingImages(true);
    try {
      const { success, images: fetchedImages } = await getReviewImages(
        reviewId
      );

      if (success) {
        setImages(fetchedImages);
      }
    } catch (err) {
      console.error("Exception fetching review images:", err);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  /**
   * Crea una nueva reseña
   */
  const handleCreateReview = useCallback(
    async (answers, freeComment, isAnonymous) => {
      if (!userId || !hospitalId || !specialtyId) return null;

      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        const {
          success,
          review,
          error: createError,
        } = await createReview(
          userId,
          hospitalId,
          specialtyId,
          answers,
          freeComment,
          isAnonymous
        );

        if (success && review) {
          setExistingReview(review);
          setSuccess(true);
          return review;
        } else {
          setError(createError || "Error al crear la reseña");
          return null;
        }
      } catch (err) {
        console.error("Exception creating review:", err);
        setError("Error inesperado al crear la reseña");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId, hospitalId, specialtyId]
  );

  /**
   * Actualiza una reseña existente
   */
  const handleUpdateReview = useCallback(
    async (reviewId, answers, freeComment, isAnonymous) => {
      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        const { success, error: updateError } = await updateReview(
          reviewId,
          answers,
          freeComment,
          isAnonymous
        );

        if (success) {
          // Recargar la reseña actualizada
          await fetchExistingReview();
          setSuccess(true);
          return true;
        } else {
          setError(updateError || "Error al actualizar la reseña");
          return false;
        }
      } catch (err) {
        console.error("Exception updating review:", err);
        setError("Error inesperado al actualizar la reseña");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchExistingReview]
  );

  /**
   * Elimina una reseña
   */
  const handleDeleteReview = useCallback(async (reviewId) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { success, error: deleteError } = await deleteReview(reviewId);

      if (success) {
        setExistingReview(null);
        setImages([]);
        setSuccess(true);
        return true;
      } else {
        setError(deleteError || "Error al eliminar la reseña");
        return false;
      }
    } catch (err) {
      console.error("Exception deleting review:", err);
      setError("Error inesperado al eliminar la reseña");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sube una imagen
   */
  const handleUploadImage = useCallback(async (reviewId, imageUri) => {
    setUploadingImage(true);
    try {
      const {
        success,
        image,
        error: uploadError,
      } = await uploadReviewImage(reviewId, imageUri);

      if (success && image) {
        setImages((prev) => [...prev, image]);
        return image;
      } else {
        setError(uploadError || "Error al subir la imagen");
        return null;
      }
    } catch (err) {
      console.error("Exception uploading image:", err);
      setError("Error inesperado al subir la imagen");
      return null;
    } finally {
      setUploadingImage(false);
    }
  }, []);

  /**
   * Elimina una imagen
   */
  const handleDeleteImage = useCallback(async (imageId, imagePath) => {
    setUploadingImage(true);
    try {
      const { success, error: deleteError } = await deleteReviewImage(
        imageId,
        imagePath
      );

      if (success) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        return true;
      } else {
        setError(deleteError || "Error al eliminar la imagen");
        return false;
      }
    } catch (err) {
      console.error("Exception deleting image:", err);
      setError("Error inesperado al eliminar la imagen");
      return false;
    } finally {
      setUploadingImage(false);
    }
  }, []);

  /**
   * Limpia el estado de error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Limpia el estado de éxito
   */
  const clearSuccess = useCallback(() => {
    setSuccess(false);
  }, []);

  // Cargar reseña existente al montar si hay datos
  useEffect(() => {
    if (userId && hospitalId && specialtyId) {
      fetchExistingReview();
    }
  }, [userId, hospitalId, specialtyId, fetchExistingReview]);

  return {
    // Estados
    reviewQuestions,
    existingReview,
    images,
    loading,
    loadingQuestions,
    loadingImages,
    uploadingImage,
    error,
    success,

    // Funciones
    fetchReviewQuestions,
    fetchExistingReview,
    fetchImages,
    handleCreateReview,
    handleUpdateReview,
    handleDeleteReview,
    handleUploadImage,
    handleDeleteImage,
    clearError,
    clearSuccess,
  };
};
