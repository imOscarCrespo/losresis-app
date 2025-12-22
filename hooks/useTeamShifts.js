import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { getTeamShifts } from '../services/shiftService';
import { supabase } from '../config/supabase';

/**
 * Hook para gestionar las guardias del equipo
 * @param {string} userId - ID del usuario actual
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialityId - ID de la especialidad
 * @param {Array<string>} specialityFilters - Filtros de especialidades
 * @returns {Object} Estado y funciones para gestionar guardias del equipo
 */
export const useTeamShifts = (userId, hospitalId, specialityId, specialityFilters = []) => {
  const [teamShifts, setTeamShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [requestedPurchaseShiftIds, setRequestedPurchaseShiftIds] = useState([]);
  const [availableSpecialityIds, setAvailableSpecialityIds] = useState([]);

  // Cargar IDs de guardias con solicitudes de compra pendientes
  const fetchRequestedPurchaseShiftIds = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('shift_purchase_requests')
        .select('shift_id')
        .eq('buyer_id', userId)
        .eq('status', 'PENDING');

      if (error) {
        console.error('Error fetching requested purchase shift IDs:', error);
        return;
      }

      const ids = (data || []).map(item => item.shift_id);
      setRequestedPurchaseShiftIds(ids);
    } catch (error) {
      console.error('Exception fetching requested purchase shift IDs:', error);
    }
  }, [userId]);

  // Cargar especialidades disponibles en el equipo
  const fetchAvailableSpecialities = useCallback(async () => {
    if (!hospitalId) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('speciality_id')
        .eq('hospital_id', hospitalId)
        .not('speciality_id', 'is', null);

      if (error) {
        console.error('Error fetching available specialities:', error);
        return;
      }

      // Obtener IDs únicos de especialidades
      const uniqueIds = [...new Set((data || []).map(user => user.speciality_id))];
      setAvailableSpecialityIds(uniqueIds);
    } catch (error) {
      console.error('Exception fetching available specialities:', error);
    }
  }, [hospitalId]);

  // Cargar guardias del equipo
  const fetchTeamShifts = useCallback(async () => {
    if (!userId || !hospitalId || !specialityId) return;

    setLoading(true);
    try {
      const data = await getTeamShifts(
        userId,
        hospitalId,
        specialityId,
        currentMonth,
        currentYear,
        specialityFilters
      );
      setTeamShifts(data);
    } catch (error) {
      console.error('Error fetching team shifts:', error);
      Alert.alert('Error', 'No se pudieron cargar las guardias del equipo');
    } finally {
      setLoading(false);
    }
  }, [userId, hospitalId, specialityId, currentMonth, currentYear, specialityFilters]);

  useEffect(() => {
    if (userId && hospitalId && specialityId) {
      fetchTeamShifts();
      fetchRequestedPurchaseShiftIds();
      fetchAvailableSpecialities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hospitalId, specialityId, currentMonth, currentYear]);

  return {
    teamShifts,
    loading,
    currentMonth,
    setCurrentMonth,
    currentYear,
    setCurrentYear,
    requestedPurchaseShiftIds,
    availableSpecialityIds,
    refetch: fetchTeamShifts,
  };
};

export default useTeamShifts;


