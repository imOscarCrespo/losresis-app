import { supabase } from "../config/supabase";

const SHIFT_EVENT_TYPE = "shift";
const AGENDA_REMINDER_NOTIFICATION_TYPE = "agenda_event_reminder";

const LEGACY_SHIFT_TYPE_BY_DAY = {
  0: "sunday",
  6: "saturday",
};

const sortAgendaEvents = (events) => {
  return [...events].sort((left, right) => {
    if (!left.event_date && !right.event_date) {
      return new Date(right.created_at || 0) - new Date(left.created_at || 0);
    }

    if (!left.event_date) return 1;
    if (!right.event_date) return -1;

    const leftDate = `${left.event_date}T${left.start_time || "00:00:00"}`;
    const rightDate = `${right.event_date}T${right.start_time || "00:00:00"}`;
    return new Date(leftDate) - new Date(rightDate);
  });
};

const getLegacyShiftType = (eventDate) => {
  const day = new Date(`${eventDate}T12:00:00`).getDay();
  return LEGACY_SHIFT_TYPE_BY_DAY[day] || "regular";
};

const normalizeText = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildEventTitle = (event) => {
  if (event.title) {
    return event.title.trim();
  }

  if (event.event_type === "day_off") {
    return "Día libre";
  }

  if (event.event_type === SHIFT_EVENT_TYPE) {
    return "Guardia";
  }

  if (event.event_type === "reminder") {
    return "Recordatorio";
  }

  return "Evento";
};

const buildAgendaPayload = (event) => {
  const payload = {
    event_type: event.event_type,
    title: buildEventTitle(event),
    event_date: event.event_date || null,
    end_date: event.end_date || null,
    start_time: event.start_time || null,
    end_time: event.end_time || null,
    all_day: event.all_day !== false,
    notes: normalizeText(event.notes),
    metadata: event.metadata || {},
    updated_at: new Date().toISOString(),
  };

  if (event.user_id) {
    payload.user_id = event.user_id;
  }

  return payload;
};

const syncAgendaEventReminder = async (event) => {
  if (!event?.id) {
    return;
  }

  const { error: deleteError } = await supabase.rpc(
    "delete_agenda_event_reminder_notifications",
    {
      p_event_id: event.id,
    }
  );

  if (deleteError) {
    throw deleteError;
  }
};

// Reconcilia los destinatarios del evento contra agenda_event_shares. Se omite
// para guardias y cuando el llamante no gestiona shares (shareUserIds undefined).
const syncAgendaEventShares = async (event, shareUserIds) => {
  if (!event?.id || event.event_type === SHIFT_EVENT_TYPE) {
    return;
  }
  if (!Array.isArray(shareUserIds)) {
    return;
  }

  const { error } = await supabase.rpc("set_agenda_event_shares", {
    p_event_id: event.id,
    p_user_ids: shareUserIds,
  });

  if (error) {
    throw error;
  }
};

const createLegacyShift = async ({ userId, eventDate, notes, priceEur }) => {
  const { data, error } = await supabase
    .from("shifts")
    .insert([
      {
        user_id: userId,
        date: eventDate,
        type: getLegacyShiftType(eventDate),
        notes: normalizeText(notes),
        price_eur: priceEur ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const updateLegacyShift = async ({ shiftId, eventDate, notes, priceEur }) => {
  const { error } = await supabase
    .from("shifts")
    .update({
      date: eventDate,
      type: getLegacyShiftType(eventDate),
      notes: normalizeText(notes),
      price_eur: priceEur ?? null,
    })
    .eq("id", shiftId);

  if (error) {
    throw error;
  }
};

export const getAgendaEvents = async (userId) => {
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("agenda_events")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return sortAgendaEvents(data || []);
};

export const createAgendaEvent = async (userId, eventData, shareUserIds) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (eventData.event_type === SHIFT_EVENT_TYPE && !eventData.event_date) {
    throw new Error("Las guardias requieren fecha");
  }

  const payload = buildAgendaPayload({
    ...eventData,
    user_id: userId,
  });

  const { data: event, error } = await supabase
    .from("agenda_events")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (event.event_type !== SHIFT_EVENT_TYPE) {
    try {
      await syncAgendaEventReminder(event);
    } catch (reminderError) {
      await supabase.from("agenda_events").delete().eq("id", event.id);
      throw reminderError;
    }
    // El evento ya existe: un fallo al compartir no debe borrarlo.
    await syncAgendaEventShares(event, shareUserIds);
    return event;
  }

  let legacyShift = null;

  try {
    legacyShift = await createLegacyShift({
      userId,
      eventDate: event.event_date,
      notes: event.notes,
      priceEur: event.metadata?.price_eur ?? null,
    });

    const { data: updatedEvent, error: linkError } = await supabase
      .from("agenda_events")
      .update({
        source_shift_id: legacyShift.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id)
      .select()
      .single();

    if (linkError) {
      throw linkError;
    }

    await syncAgendaEventReminder(updatedEvent);
    return updatedEvent;
  } catch (legacyError) {
    if (legacyShift?.id) {
      await supabase.from("shifts").delete().eq("id", legacyShift.id);
    }
    await supabase.from("agenda_events").delete().eq("id", event.id);
    throw legacyError;
  }
};

export const updateAgendaEvent = async (eventId, eventData, shareUserIds) => {
  if (!eventId) {
    throw new Error("Event ID is required");
  }

  const payload = buildAgendaPayload(eventData);

  const { data: updatedEvent, error } = await supabase
    .from("agenda_events")
    .update(payload)
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (
    updatedEvent.event_type === SHIFT_EVENT_TYPE &&
    updatedEvent.source_shift_id &&
    updatedEvent.event_date
  ) {
    await updateLegacyShift({
      shiftId: updatedEvent.source_shift_id,
      eventDate: updatedEvent.event_date,
      notes: updatedEvent.notes,
      priceEur: updatedEvent.metadata?.price_eur ?? null,
    });
  }

  await syncAgendaEventReminder(updatedEvent);
  await syncAgendaEventShares(updatedEvent, shareUserIds);
  return updatedEvent;
};

export const deleteAgendaEvent = async (event) => {
  if (!event?.id) {
    throw new Error("Event is required");
  }

  const { error: reminderDeleteError } = await supabase.rpc(
    "delete_agenda_event_reminder_notifications",
    {
      p_event_id: event.id,
    }
  );

  if (reminderDeleteError) {
    throw reminderDeleteError;
  }

  if (event.source_shift_id) {
    const { error: shiftError } = await supabase
      .from("shifts")
      .delete()
      .eq("id", event.source_shift_id);

    if (shiftError) {
      throw shiftError;
    }
  }

  const { error } = await supabase.from("agenda_events").delete().eq("id", event.id);

  if (error) {
    throw error;
  }

  return true;
};

export const mapAgendaEventToLegacyShift = (event) => {
  if (event.event_type !== SHIFT_EVENT_TYPE || !event.source_shift_id || !event.event_date) {
    return null;
  }

  return {
    id: event.source_shift_id,
    date: event.event_date,
    notes: event.notes,
    type: event.metadata?.legacy_shift_type || getLegacyShiftType(event.event_date),
    price_eur: event.metadata?.price_eur ?? null,
  };
};

export const createAgendaEventsBatch = async (userId, dates, sharedEventData) => {
  const created = [];
  const failed = [];

  for (const date of dates) {
    try {
      const event = await createAgendaEvent(userId, {
        ...sharedEventData,
        event_type: SHIFT_EVENT_TYPE,
        event_date: date,
      });
      created.push(event);
    } catch (error) {
      failed.push({ date, error });
    }
  }

  return { created, failed };
};

// Eventos que mis Conexiones han compartido conmigo (solo-lectura), con el nombre
// del dueno para etiquetarlos en el calendario.
export const getSharedWithMeEvents = async () => {
  const { data, error } = await supabase.rpc("get_events_shared_with_me");

  if (error) {
    throw error;
  }

  return data || [];
};

// IDs de las conexiones con las que un evento propio esta compartido. Sirve para
// preseleccionar el selector al editar.
export const getAgendaEventShareUserIds = async (eventId) => {
  if (!eventId) {
    return [];
  }

  const { data, error } = await supabase
    .from("agenda_event_shares")
    .select("shared_with_user_id")
    .eq("event_id", eventId);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => row.shared_with_user_id);
};

export const agendaEventTypeLabels = {
  [AGENDA_REMINDER_NOTIFICATION_TYPE]: "Recordatorio",
  shift: "Guardia",
  course: "Curso",
  research: "Investigación",
  study: "Estudio",
  conference: "Congreso",
  day_off: "Día libre",
  reminder: "Recordatorio",
  // Convocado por el responsable desde el panel del hospital; el residente lo
  // ve en solo lectura.
  service: "Evento del servicio",
};
