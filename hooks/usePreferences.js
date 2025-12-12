import { useState, useEffect, useCallback } from "react";
import {
  getUserPreferences,
  addUserPreference,
  removeUserPreference,
  updatePreferencesOrder,
  getInitialHospitals,
} from "../services/preferencesService";
import { getCurrentUser } from "../services/authService";

/**
 * Hook personalizado para manejar las preferencias del usuario
 */
export const usePreferences = () => {
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [initialHospitals, setInitialHospitals] = useState([]);

  // Cargar usuario actual
  useEffect(() => {
    const loadUser = async () => {
      const { success, user } = await getCurrentUser();
      if (success && user) {
        setUserId(user.id);
      }
    };
    loadUser();
  }, []);

  // Cargar preferencias
  const fetchPreferences = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const { success, preferences: prefs, error: err } =
        await getUserPreferences(userId);

      if (success) {
        setPreferences(prefs || []);
      } else {
        setError(err || "Error al cargar las preferencias");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Cargar hospitales iniciales
  const fetchInitialHospitals = useCallback(async () => {
    try {
      const { success, hospitals, error: err } = await getInitialHospitals();
      if (success) {
        setInitialHospitals(hospitals || []);
      }
    } catch (err) {
      console.error("Error loading initial hospitals:", err);
    }
  }, []);

  // Añadir preferencia
  const addPreference = useCallback(
    async (hospitalId, specialtyId) => {
      if (!userId || !hospitalId || !specialtyId) {
        return {
          success: false,
          error: "Faltan datos requeridos",
        };
      }

      // Verificar si ya existe
      const existingPreference = preferences.find(
        (pref) =>
          pref.hospital_id === hospitalId &&
          pref.speciality_id === specialtyId
      );

      if (existingPreference) {
        return {
          success: false,
          error:
            "Ya tienes esta combinación de hospital y especialidad en tus preferencias.",
        };
      }

      // Calcular la siguiente posición
      const maxPosition =
        preferences.length > 0
          ? Math.max(...preferences.map((pref) => pref.position ?? 0))
          : 0;
      const nextPosition = maxPosition + 1;

      try {
        const { success, error: err } = await addUserPreference(
          userId,
          hospitalId,
          specialtyId,
          nextPosition
        );

        if (success) {
          await fetchPreferences();
          return { success: true, error: null };
        } else {
          return {
            success: false,
            error: err || "Error al añadir la preferencia",
          };
        }
      } catch (err) {
        return {
          success: false,
          error: err.message || "Error al añadir la preferencia",
        };
      }
    },
    [userId, preferences, fetchPreferences]
  );

  // Eliminar preferencia
  const removePreference = useCallback(
    async (preferenceId) => {
      try {
        const { success, error: err } = await removeUserPreference(
          preferenceId
        );

        if (success) {
          setPreferences((prev) =>
            prev.filter((pref) => pref.id !== preferenceId)
          );
          return { success: true, error: null };
        } else {
          return {
            success: false,
            error: err || "Error al eliminar la preferencia",
          };
        }
      } catch (err) {
        return {
          success: false,
          error: err.message || "Error al eliminar la preferencia",
        };
      }
    },
    []
  );

  // Actualizar orden de preferencias
  const saveOrder = useCallback(async (orderedPreferences) => {
    try {
      const { success, error: err } = await updatePreferencesOrder(
        orderedPreferences
      );

      if (success) {
        await fetchPreferences();
        return { success: true, error: null };
      } else {
        return {
          success: false,
          error: err || "Error al guardar el orden",
        };
      }
    } catch (err) {
      return {
        success: false,
        error: err.message || "Error al guardar el orden",
      };
    }
  }, [fetchPreferences]);

  // Cargar preferencias cuando cambia el userId
  useEffect(() => {
    if (userId) {
      fetchPreferences();
    }
  }, [userId, fetchPreferences]);

  return {
    preferences,
    loading,
    error,
    userId,
    initialHospitals,
    fetchPreferences,
    fetchInitialHospitals,
    addPreference,
    removePreference,
    saveOrder,
  };
};


