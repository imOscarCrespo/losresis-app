import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import {
  createAgendaEvent,
  deleteAgendaEvent,
  getAgendaEvents,
  updateAgendaEvent,
} from "../services/agendaService";

const UPCOMING_DAYS_WINDOW = 5;

const rangesOverlap = (rangeStart, rangeEnd, windowStart, windowEnd) => {
  if (!rangeStart) return false;
  const effectiveRangeEnd = rangeEnd || rangeStart;
  return rangeStart < windowEnd && effectiveRangeEnd >= windowStart;
};

export const useAgendaEvents = (userId) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const data = await getAgendaEvents(userId);
      setEvents(data);
    } catch (error) {
      console.error("Error fetching agenda events:", error);
      Alert.alert("Error", "No se pudo cargar tu agenda");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const createEvent = useCallback(
    async (eventData) => {
      setSaving(true);
      try {
        await createAgendaEvent(userId, eventData);
        await fetchEvents();
        return { success: true };
      } catch (error) {
        console.error("Error creating agenda event:", error);
        return {
          success: false,
          message:
            error?.message || "No se pudo guardar el evento en tu agenda",
        };
      } finally {
        setSaving(false);
      }
    },
    [fetchEvents, userId]
  );

  const updateEvent = useCallback(
    async (eventId, eventData) => {
      setSaving(true);
      try {
        await updateAgendaEvent(eventId, eventData);
        await fetchEvents();
        return { success: true };
      } catch (error) {
        console.error("Error updating agenda event:", error);
        return {
          success: false,
          message:
            error?.message || "No se pudo actualizar el evento de la agenda",
        };
      } finally {
        setSaving(false);
      }
    },
    [fetchEvents]
  );

  const removeEvent = useCallback(
    async (event) => {
      setSaving(true);
      try {
        await deleteAgendaEvent(event);
        await fetchEvents();
        return { success: true };
      } catch (error) {
        console.error("Error deleting agenda event:", error);
        return {
          success: false,
          message:
            error?.message || "No se pudo eliminar el evento de la agenda",
        };
      } finally {
        setSaving(false);
      }
    },
    [fetchEvents]
  );

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + UPCOMING_DAYS_WINDOW);

    return events
      .filter((event) => {
        if (!event.event_date) {
          return false;
        }

        const eventStartDate = new Date(`${event.event_date}T00:00:00`);
        const eventEndDate = new Date(
          `${(event.end_date || event.event_date)}T00:00:00`
        );

        return rangesOverlap(eventStartDate, eventEndDate, today, windowEnd);
      });
  }, [events]);

  const unscheduledEvents = useMemo(() => {
    return events.filter((event) => !event.event_date);
  }, [events]);

  return {
    events,
    loading,
    saving,
    upcomingEvents,
    unscheduledEvents,
    createEvent,
    updateEvent,
    removeEvent,
    refetch: fetchEvents,
  };
};

export default useAgendaEvents;
