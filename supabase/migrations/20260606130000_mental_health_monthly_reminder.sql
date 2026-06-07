-- Recordatorio push el día 1 de cada mes a las 10:00 (Europa/Madrid) invitando al
-- residente a hacer su Evaluación de bienestar mensual.
--
-- Patrón replicado de 20260526100000_resident_monthly_payroll_upload_reminder.sql:
--   - notification_type dedicado para que el usuario lo pueda silenciar desde
--     user_notification_preferences,
--   - función idempotente que inserta una sola notificación por residente y periodo
--     (deduplica con NOT EXISTS sobre period_year/period_month en data),
--   - solo se notifica al residente que aún NO ha registrado ninguna evaluación en el
--     mes en curso,
--   - cron horario que la ejecuta; la propia función filtra por día 1 y hora 10 España.
--
-- Cadencia "mensual sugerida, sin bloqueo": el recordatorio invita pero el residente
-- puede evaluarse cuando quiera. El copy es de cuidado, nunca de urgencia clínica.

CREATE EXTENSION IF NOT EXISTS pg_cron;

INSERT INTO public.notification_types (code, description)
VALUES (
  'mental_health_monthly_reminder',
  'Recordatorio mensual para que el residente haga su evaluación de bienestar'
)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enqueue_due_mental_health_monthly_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_total integer := 0;
  v_inserted integer;
  v_spain_now timestamp without time zone := timezone('Europe/Madrid', now());
  v_today date := DATE(v_spain_now);
  v_period_year integer := EXTRACT(YEAR FROM v_spain_now)::integer;
  v_period_month integer := EXTRACT(MONTH FROM v_spain_now)::integer;
  v_month_start timestamptz := DATE_TRUNC('month', timezone('Europe/Madrid', now()));
  v_next_month_start timestamptz := v_month_start + INTERVAL '1 month';
BEGIN
  -- Solo dispara el día 1 a las 10:00 hora España.
  IF EXTRACT(DAY FROM v_spain_now) <> 1 OR EXTRACT(HOUR FROM v_spain_now) <> 10 THEN
    RETURN 0;
  END IF;

  FOR v_user IN
    SELECT u.id
    FROM public.users u
    WHERE u.is_resident = true
      -- Solo a quien aún no se ha evaluado este mes.
      AND NOT EXISTS (
        SELECT 1
        FROM public.mental_health_assessments a
        WHERE a.user_id = u.id
          AND a.created_at >= v_month_start
          AND a.created_at < v_next_month_start
      )
  LOOP
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
      'mental_health_monthly_reminder',
      '¿Cómo llevas el mes?',
      'Tómate 5 minutos para tu evaluación de bienestar. Solo tú ves tus resultados.',
      'user',
      v_user.id,
      jsonb_build_object(
        'entity_type', 'mental_health_assessment',
        'period_year', v_period_year,
        'period_month', v_period_month,
        'reminder_date', v_today,
        'destination_section', 'mentalHealth'
      )
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_user.id
        AND n.type = 'mental_health_monthly_reminder'
        AND COALESCE(NULLIF(n.data->>'period_year', '')::integer, -1) = v_period_year
        AND COALESCE(NULLIF(n.data->>'period_month', '')::integer, -1) = v_period_month
    );

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_total := v_total + v_inserted;
  END LOOP;

  RETURN v_total;
END;
$$;

GRANT ALL ON FUNCTION public.enqueue_due_mental_health_monthly_reminders() TO anon;
GRANT ALL ON FUNCTION public.enqueue_due_mental_health_monthly_reminders() TO authenticated;
GRANT ALL ON FUNCTION public.enqueue_due_mental_health_monthly_reminders() TO service_role;

-- Programado cada hora; la función internamente solo actúa el día 1 a las 10:00
-- España. Esta granularidad evita que el cambio verano/invierno desplace el envío.
SELECT cron.schedule(
  'mental-health-monthly-reminder-hourly',
  '0 * * * *',
  $$SELECT public.enqueue_due_mental_health_monthly_reminders();$$
);
