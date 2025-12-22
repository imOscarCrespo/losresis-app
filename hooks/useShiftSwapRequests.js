import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

/**
 * Hook para gestionar las solicitudes de intercambio de guardias
 * @param {string} userId - ID del usuario
 * @returns {Object} Estado y funciones para gestionar solicitudes de intercambio
 */
export const useShiftSwapRequests = (userId) => {
  const [swapRequests, setSwapRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Obtener las guardias del usuario
  const fetchSwapRequests = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      console.log('🔍 Fetching swap requests for user:', userId);

      // Obtener los IDs de las guardias del usuario
      const { data: userShifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('id')
        .eq('user_id', userId);

      if (shiftsError) {
        console.error('❌ Error fetching user shifts:', shiftsError);
        return;
      }

      const userShiftIds = userShifts?.map((shift) => shift.id) || [];

      if (userShiftIds.length === 0) {
        setSwapRequests([]);
        return;
      }

      // Obtener solicitudes de intercambio donde el usuario es el objetivo
      const { data, error } = await supabase
        .from('shift_swap_requests')
        .select(
          `
          *,
          requester_shift:shifts!requester_shift_id (
            *,
            user:users!user_id (
              name,
              surname
            )
          ),
          target_shift:shifts!target_shift_id (*)
        `
        )
        .in('target_shift_id', userShiftIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching swap requests:', error);
        return;
      }

      console.log('✅ Successfully fetched swap requests:', data?.length || 0);
      setSwapRequests(data || []);
    } catch (error) {
      console.error('❌ Exception fetching swap requests:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Aceptar una solicitud de intercambio
  const acceptSwapRequest = useCallback(
    async (requestId) => {
      try {
        console.log('✅ Accepting swap request:', requestId);

        const { data, error } = await supabase
          .from('shift_swap_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId)
          .select()
          .single();

        if (error) {
          console.error('❌ Error accepting swap request:', error);
          return false;
        }

        console.log('✅ Successfully accepted swap request:', data);
        await fetchSwapRequests(); // Refrescar la lista
        return true;
      } catch (error) {
        console.error('❌ Exception accepting swap request:', error);
        return false;
      }
    },
    [fetchSwapRequests]
  );

  // Rechazar una solicitud de intercambio
  const rejectSwapRequest = useCallback(
    async (requestId) => {
      try {
        console.log('❌ Rejecting swap request:', requestId);

        const { data, error } = await supabase
          .from('shift_swap_requests')
          .update({ status: 'rejected' })
          .eq('id', requestId)
          .select()
          .single();

        if (error) {
          console.error('❌ Error rejecting swap request:', error);
          return false;
        }

        console.log('✅ Successfully rejected swap request:', data);
        await fetchSwapRequests(); // Refrescar la lista
        return true;
      } catch (error) {
        console.error('❌ Exception rejecting swap request:', error);
        return false;
      }
    },
    [fetchSwapRequests]
  );

  useEffect(() => {
    fetchSwapRequests();
  }, [fetchSwapRequests]);

  return {
    swapRequests,
    loading,
    acceptSwapRequest,
    rejectSwapRequest,
    refetch: fetchSwapRequests,
  };
};

export default useShiftSwapRequests;


