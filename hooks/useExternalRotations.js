import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getAllRotations,
  getUserRotations,
  createRotation as createRotationService,
  updateRotation as updateRotationService,
  deleteRotation as deleteRotationService,
  updateUserPhone,
} from '../services/externalRotationService';

/**
 * Hook para gestionar rotaciones externas
 * @param {string} userId - ID del usuario
 * @param {string} specialtyId - ID de especialidad para filtrar (opcional)
 * @param {string} monthYear - Mes/año en formato YYYY-MM (opcional)
 * @returns {Object} Estado y funciones para gestionar rotaciones
 */
export const useExternalRotations = (userId, specialtyId = null, monthYear = null) => {
  const [rotations, setRotations] = useState([]);
  const [userRotations, setUserRotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch all rotations
  const fetchAllRotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllRotations(specialtyId, monthYear);
      setRotations(data);
    } catch (err) {
      console.error('Error fetching rotations:', err);
      setError('Error al cargar las rotaciones');
    } finally {
      setLoading(false);
    }
  }, [specialtyId, monthYear]);

  // Fetch user's rotations
  const fetchUserRotations = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await getUserRotations(userId);
      setUserRotations(data);
    } catch (err) {
      console.error('Error fetching user rotations:', err);
      setError('Error al cargar tus rotaciones');
    }
  }, [userId]);

  // Create rotation
  const createRotation = useCallback(
    async (rotationData, phone = null) => {
      if (!userId) {
        setError('Usuario no autenticado');
        return false;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        // Update phone if provided
        if (phone) {
          await updateUserPhone(userId, phone);
        }

        await createRotationService(rotationData, userId);
        setSuccess('Rotación externa creada correctamente');

        // Refresh data
        await Promise.all([fetchAllRotations(), fetchUserRotations()]);
        return true;
      } catch (err) {
        console.error('Error creating rotation:', err);
        setError('Error al crear la rotación');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId, fetchAllRotations, fetchUserRotations]
  );

  // Update rotation
  const updateRotation = useCallback(
    async (rotationId, rotationData, phone = null) => {
      if (!userId) {
        setError('Usuario no autenticado');
        return false;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        // Update phone if provided
        if (phone) {
          await updateUserPhone(userId, phone);
        }

        await updateRotationService(rotationId, rotationData, userId);
        setSuccess('Rotación externa actualizada correctamente');

        // Refresh data
        await Promise.all([fetchAllRotations(), fetchUserRotations()]);
        return true;
      } catch (err) {
        console.error('Error updating rotation:', err);
        setError('Error al actualizar la rotación');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId, fetchAllRotations, fetchUserRotations]
  );

  // Delete rotation
  const deleteRotation = useCallback(
    async (rotationId) => {
      if (!userId) {
        setError('Usuario no autenticado');
        return false;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        await deleteRotationService(rotationId, userId);
        setSuccess('Rotación externa eliminada correctamente');

        // Refresh data
        await Promise.all([fetchAllRotations(), fetchUserRotations()]);
        return true;
      } catch (err) {
        console.error('Error deleting rotation:', err);
        setError('Error al eliminar la rotación');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId, fetchAllRotations, fetchUserRotations]
  );

  // Clear messages
  const clearError = useCallback(() => setError(null), []);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  // Initial load
  useEffect(() => {
    if (userId) {
      fetchAllRotations();
      fetchUserRotations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, specialtyId, monthYear]);

  return {
    rotations,
    userRotations,
    loading,
    error,
    success,
    createRotation,
    updateRotation,
    deleteRotation,
    fetchAllRotations,
    fetchUserRotations,
    clearError,
    clearSuccess,
  };
};

export default useExternalRotations;

