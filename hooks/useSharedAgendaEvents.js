import { useCallback, useEffect, useState } from "react";
import { getSharedWithMeEvents } from "../services/agendaService";

// Eventos que mis Conexiones han compartido conmigo. Se muestran en solo-lectura
// dentro de la Agenda principal. Ver docs/adr/0003-agenda-unificada-elimina-mercado-guardias.md
export const useSharedAgendaEvents = (userId) => {
  const [sharedEvents, setSharedEvents] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);

  const fetchSharedEvents = useCallback(async () => {
    if (!userId) {
      setSharedEvents([]);
      return;
    }

    setLoadingShared(true);
    try {
      const data = await getSharedWithMeEvents();
      setSharedEvents(data);
    } catch (error) {
      console.error("Error fetching shared agenda events:", error);
    } finally {
      setLoadingShared(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSharedEvents();
  }, [fetchSharedEvents]);

  return {
    sharedEvents,
    loadingShared,
    refetchShared: fetchSharedEvents,
  };
};

export default useSharedAgendaEvents;
