-- Recordatorio push para residentes en alta temporal MIR cuando faltan 3 días
-- para que expire la ventana (pierden acceso si no añaden el correo corporativo).
--
-- Patrón replicado de 20260316153000_agenda_event_reminders.sql:
--   - tipo de notificación dedicado para que el usuario pueda silenciarlo
--     desde user_notification_preferences si lo desea,
--   - función idempotente que inserta una sola notificación por residente y
--     por día de vencimiento (deduplica con NOT EXISTS),
--   - cron diario que la ejecuta a una hora razonable en horario España.

CREATE EXTENSION IF NOT EXISTS pg_cron;

INSERT INTO public.notification_types (code, description)
VALUES (
  'resident_seasonal_grace_expiry_reminder',
  'Aviso de que la ventana temporal MIR sin correo corporativo va a expirar'
)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enqueue_due_resident_seasonal_grace_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_total integer := 0;
  v_spain_now timestamp without time zone := timezone('Europe/Madrid', now());
  v_today date := DATE(v_spain_now);
  v_target_date date := v_today + 3;
  v_days_remaining integer;
  v_inserted integer;
BEGIN
  -- Solo dispara una vez al día, a las 10:00 hora España, para no spamear.
  IF EXTRACT(HOUR FROM v_spain_now) <> 10 THEN
    RETURN 0;
  END IF;

  FOR v_user IN
    SELECT
      u.id,
      u.resident_transition_expires_at
    FROM public.users u
    WHERE u.is_resident = true
      AND u.resident_state = 'pending_corporate_email_seasonal'
      AND u.resident_transition_expires_at IS NOT NULL
      AND (u.work_email IS NULL OR length(trim(u.work_email)) = 0)
      AND DATE(timezone('Europe/Madrid', u.resident_transition_expires_at)) = v_target_date
  LOOP
    v_days_remaining := 3;

    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      entity_type,
      entity_id,
      data
    )
    SELECT
      v_user.id,
      'resident_seasonal_grace_expiry_reminder',
      'Quedan 3 días para añadir tu correo corporativo',
      'Tu alta temporal MIR caduca el ' ||
        to_char(timezone('Europe/Madrid', v_user.resident_transition_expires_at), 'DD/MM/YYYY') ||
        '. Añade tu correo corporativo desde tu perfil para no perder el acceso.',
      'user',
      v_user.id,
      jsonb_build_object(
        'entity_type', 'user',
        'entity_id', v_user.id,
        'days_remaining', v_days_remaining,
        'expires_at', v_user.resident_transition_expires_at,
        'reminder_date', v_today,
        'destination_section', 'usuario'
      )
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_user.id
        AND n.type = 'resident_seasonal_grace_expiry_reminder'
        AND COALESCE(NULLIF(n.data->>'reminder_date', '')::date, NULL) = v_today
    );

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_total := v_total + v_inserted;
  END LOOP;

  RETURN v_total;
END;
$$;

GRANT ALL ON FUNCTION public.enqueue_due_resident_seasonal_grace_reminders() TO anon;
GRANT ALL ON FUNCTION public.enqueue_due_resident_seasonal_grace_reminders() TO authenticated;
GRANT ALL ON FUNCTION public.enqueue_due_resident_seasonal_grace_reminders() TO service_role;

-- Programado cada hora; la función internamente solo actúa a las 10:00 España.
-- Esta granularidad permite que el cambio de horario verano/invierno no
-- desplace la hora real del envío.
SELECT cron.schedule(
  'resident-seasonal-grace-expiry-reminder-hourly',
  '0 * * * *',
  $$SELECT public.enqueue_due_resident_seasonal_grace_reminders();$$
);
