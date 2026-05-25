-- Activar Supabase Realtime para user_email_review_requests.
-- Lo necesitamos en cliente para reaccionar inmediatamente a un cambio de
-- status (PENDING → REJECTED por parte del admin) sin esperar al cierre y
-- reapertura de la app.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_email_review_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.user_email_review_requests;
  END IF;
END
$$;

-- Asegurar REPLICA IDENTITY FULL para que el payload de UPDATE incluya el
-- row completo y el cliente pueda decidir basado en status sin tener que
-- re-hacer un select.
ALTER TABLE public.user_email_review_requests REPLICA IDENTITY FULL;
