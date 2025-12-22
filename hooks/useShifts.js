import { useState, useEffect, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import {
  getUserShifts,
  createShift,
  updateShift,
  deleteShift,
} from "../services/shiftService";

/**
 * Hook para gestionar las guardias del usuario
 * @param {string} userId - ID del usuario
 * @returns {Object} Estado y funciones para gestionar guardias
 */
export const useShifts = (userId) => {
  const [allShifts, setAllShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedType, setSelectedType] = useState("");

  // Cargar guardias
  const fetchShifts = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const data = await getUserShifts(userId);
      setAllShifts(data);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      Alert.alert("Error", "No se pudieron cargar las guardias");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // Añadir guardia
  const addShift = useCallback(
    async (shiftData) => {
      try {
        await createShift(shiftData, userId);
        await fetchShifts();
        Alert.alert("Éxito", "Guardia creada correctamente");
        return true;
      } catch (error) {
        console.error("Error creating shift:", error);
        Alert.alert("Error", "No se pudo crear la guardia");
        return false;
      }
    },
    [userId, fetchShifts]
  );

  // Actualizar guardia
  const updateShiftData = useCallback(
    async (shift) => {
      try {
        await updateShift(shift.id, {
          date: shift.date,
          type: shift.type,
          notes: shift.notes,
          price_eur: shift.price_eur,
        });
        await fetchShifts();
        Alert.alert("Éxito", "Guardia actualizada correctamente");
        return true;
      } catch (error) {
        console.error("Error updating shift:", error);
        Alert.alert("Error", "No se pudo actualizar la guardia");
        return false;
      }
    },
    [fetchShifts]
  );

  // Eliminar guardia
  const deleteShiftData = useCallback(
    async (shiftId) => {
      try {
        await deleteShift(shiftId);
        await fetchShifts();
        Alert.alert("Éxito", "Guardia eliminada correctamente");
        return true;
      } catch (error) {
        console.error("Error deleting shift:", error);
        Alert.alert("Error", "No se pudo eliminar la guardia");
        return false;
      }
    },
    [fetchShifts]
  );

  // Calcular estadísticas
  const statistics = useMemo(() => {
    const stats = {
      total: allShifts.length,
      regular: 0,
      saturday: 0,
      sunday: 0,
      withPrice: 0,
      totalPrice: 0,
    };

    allShifts.forEach((shift) => {
      if (shift.type === "regular") stats.regular++;
      if (shift.type === "saturday") stats.saturday++;
      if (shift.type === "sunday") stats.sunday++;
      if (shift.price_eur && shift.price_eur > 0) {
        stats.withPrice++;
        stats.totalPrice += shift.price_eur;
      }
    });

    return stats;
  }, [allShifts]);

  // Filtrar guardias próximas (próximos 30 días)
  const upcomingShifts = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    return allShifts
      .filter((shift) => {
        const shiftDate = new Date(shift.date);
        return shiftDate >= now && shiftDate <= thirtyDaysFromNow;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [allShifts]);

  // Filtrar guardias por mes, año y tipo
  const filteredShifts = useMemo(() => {
    return allShifts.filter((shift) => {
      const shiftDate = new Date(shift.date);
      const matchesMonth = shiftDate.getMonth() === selectedMonth;
      const matchesYear = shiftDate.getFullYear() === selectedYear;
      const matchesType = selectedType === "" || shift.type === selectedType;
      return matchesMonth && matchesYear && matchesType;
    });
  }, [allShifts, selectedMonth, selectedYear, selectedType]);

  return {
    allShifts,
    loading,
    statistics,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    selectedType,
    setSelectedType,
    addShift,
    updateShift: updateShiftData,
    deleteShift: deleteShiftData,
    upcomingShifts,
    filteredShifts,
    refetch: fetchShifts,
  };
};

export default useShifts;
