import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

/**
 * Hook para gestionar las solicitudes de compra de guardias
 * @param {string} userId - ID del usuario
 * @returns {Object} Estado y funciones para gestionar solicitudes de compra
 */
export const useShiftPurchaseRequests = (userId) => {
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Obtener solicitudes de compra
  const fetchPurchaseRequests = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_purchase_requests')
        .select(
          `
          *,
          shift:shifts!shift_purchase_requests_shift_id_fkey (
            *,
            user:users!user_id (
              name,
              surname
            )
          ),
          buyer:users!shift_purchase_requests_buyer_id_fkey (
            name,
            surname
          )
        `
        )
        .eq('owner_id', userId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching shift purchase requests:', error);
        return;
      }

      setPurchaseRequests(data || []);
    } catch (error) {
      console.error('❌ Exception fetching shift purchase requests:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPurchaseRequests();
  }, [fetchPurchaseRequests]);

  // Actualizar el estado de una solicitud de compra
  const updatePurchaseRequestStatus = useCallback(
    async (requestId, status) => {
      if (!userId) return false;

      setUpdating(true);
      try {
        const { error } = await supabase
          .from('shift_purchase_requests')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .eq('owner_id', userId);

        if (error) {
          console.error(
            `❌ Error updating purchase request ${requestId} to ${status}:`,
            error
          );
          return false;
        }

        await fetchPurchaseRequests();
        return true;
      } catch (error) {
        console.error(
          `❌ Exception updating purchase request ${requestId} to ${status}:`,
          error
        );
        return false;
      } finally {
        setUpdating(false);
      }
    },
    [fetchPurchaseRequests, userId]
  );

  // Aceptar una solicitud de compra
  const acceptPurchaseRequest = useCallback(
    (requestId) => updatePurchaseRequestStatus(requestId, 'ACCEPTED'),
    [updatePurchaseRequestStatus]
  );

  // Rechazar una solicitud de compra
  const rejectPurchaseRequest = useCallback(
    (requestId) => updatePurchaseRequestStatus(requestId, 'REJECTED'),
    [updatePurchaseRequestStatus]
  );

  return {
    purchaseRequests,
    loading,
    updating,
    refetch: fetchPurchaseRequests,
    acceptPurchaseRequest,
    rejectPurchaseRequest,
  };
};

export default useShiftPurchaseRequests;


