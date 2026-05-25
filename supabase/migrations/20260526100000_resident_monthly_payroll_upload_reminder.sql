-- Recordatorio push el día 1 de cada mes a las 10:00 (Europa/Madrid) para
-- que los residentes suban su nómina del mes recién cerrado al panel de
-- control y aparezca en su resident_monthly_payouts.
--
-- Patrón replicado de 20260525120000_resident_seasonal_grace_expiry_reminder.sql:
--   - tipo de notificación dedicado para que el usuario pueda silenciarlo
--     desde user_notification_preferences si lo desea,
--   - función idempotente que inserta una sola notificación por residente y
--     por periodo (deduplica con NOT EXISTS sobre period_year/period_month),
--   - solo se notifica al residente que aún NO tiene fila en
--     resident_monthly_payouts para el periodo recién cerrado,
--   - cron horario que la ejecuta y la propia función filtra por día 1 y
--     hora 10 España.

CREATE EXTENSION IF NOT EXISTS pg_cron;

INSERT INTO public.notification_types (code, description)
VALUES (
  'resident_monthly_payroll_upload_reminder',
  'Recordatorio mensual para que el residente suba su nómina al panel de control'
)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enqueue_due_resident_monthly_payroll_reminders()
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
  v_period_date date;
  v_period_year integer;
  v_period_month integer;
  v_period_label text;
BEGIN
  -- Solo dispara el día 1 a las 10:00 hora España.
  IF EXTRACT(DAY FROM v_spain_now) <> 1 OR EXTRACT(HOUR FROM v_spain_now) <> 10 THEN
    RETURN 0;
  END IF;

  -- Mes recién cerrado: último día del mes anterior.
  v_period_date := (DATE_TRUNC('month', v_spain_now) - INTERVAL '1 day')::date;
  v_period_year := EXTRACT(YEAR FROM v_period_date)::integer;
  v_period_month := EXTRACT(MONTH FROM v_period_date)::integer;

  v_period_label := CASE v_period_month
    WHEN 1  THEN 'enero'
    WHEN 2  THEN 'febrero'
    WHEN 3  THEN 'marzo'
    WHEN 4  THEN 'abril'
    WHEN 5  THEN 'mayo'
    WHEN 6  THEN 'junio'
    WHEN 7  THEN 'julio'
    WHEN 8  THEN 'agosto'
    WHEN 9  THEN 'septiembre'
    WHEN 10 THEN 'octubre'
    WHEN 11 THEN 'noviembre'
    WHEN 12 THEN 'diciembre'
  END || ' ' || v_period_year::text;

  FOR v_user IN
    SELECT u.id
    FROM public.users u
    WHERE u.is_resident = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.resident_monthly_payouts p
        WHERE p.user_id = u.id
          AND p.period_year = v_period_year
          AND p.period_month = v_period_month
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
      'resident_monthly_payroll_upload_reminder',
      'Sube tu nómina del mes',
      'Ya puedes subir tu nómina de ' || v_period_label ||
        ' al panel de control. Añádela para que aparezca en tu tabla de payouts.',
      'user',
      v_user.id,
      jsonb_build_object(
        'entity_type', 'resident_monthly_payout',
        'period_year', v_period_year,
        'period_month', v_period_month,
        'reminder_date', v_today,
        'destination_section', 'residentPayoutEntry'
      )
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_user.id
        AND n.type = 'resident_monthly_payroll_upload_reminder'
        AND COALESCE(NULLIF(n.data->>'period_year', '')::integer, -1) = v_period_year
        AND COALESCE(NULLIF(n.data->>'period_month', '')::integer, -1) = v_period_month
    );

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_total := v_total + v_inserted;
  END LOOP;

  RETURN v_total;
END;
$$;

GRANT ALL ON FUNCTION public.enqueue_due_resident_monthly_payroll_reminders() TO anon;
GRANT ALL ON FUNCTION public.enqueue_due_resident_monthly_payroll_reminders() TO authenticated;
GRANT ALL ON FUNCTION public.enqueue_due_resident_monthly_payroll_reminders() TO service_role;

-- Programado cada hora; la función internamente solo actúa el día 1 a las
-- 10:00 España. Esta granularidad permite que el cambio de horario
-- verano/invierno no desplace la hora real del envío.
SELECT cron.schedule(
  'resident-monthly-payroll-upload-reminder-hourly',
  '0 * * * *',
  $$SELECT public.enqueue_due_resident_monthly_payroll_reminders();$$
);
