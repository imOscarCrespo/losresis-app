-- Propagar cambios en resident_transition_config a los usuarios que ya están
-- en la ventana de gracia.
--
-- El trigger apply_resident_lifecycle_state guarda
-- resident_transition_expires_at en cada row de users en el momento del
-- INSERT/UPDATE. Si después cambiamos ends_at en resident_transition_config
-- (porque queremos ampliar el periodo), los rows existentes mantienen la
-- fecha vieja: el banner del dashboard y el push recordatorio de 3 días
-- vista usan ese expires_at por usuario, así que se desincronizan.
--
-- Este trigger AFTER UPDATE sobre resident_transition_config actualiza
-- todos los usuarios con resident_state = 'pending_corporate_email_seasonal'
-- para que reflejen la nueva ends_at. El UPDATE sobre users dispara a su vez
-- apply_resident_lifecycle_state, que recomputa el estado: si la nueva
-- ends_at sigue siendo futura el residente continúa en pending; si ya
-- pasó, queda en locked_missing_corporate_email automáticamente.

CREATE OR REPLACE FUNCTION public.propagate_resident_transition_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo nos interesa la config activa de R1.
  IF NEW.key <> 'mir_r1_corporate_email_grace' THEN
    RETURN NEW;
  END IF;

  -- Si nada relevante cambió, no tocamos a nadie.
  IF NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at
     AND NEW.enabled IS NOT DISTINCT FROM OLD.enabled
     AND NEW.target_resident_year IS NOT DISTINCT FROM OLD.target_resident_year THEN
    RETURN NEW;
  END IF;

  UPDATE public.users u
  SET resident_transition_expires_at = NEW.ends_at
  WHERE u.is_resident = true
    AND u.resident_state = 'pending_corporate_email_seasonal'
    AND (u.work_email IS NULL OR length(trim(u.work_email)) = 0)
    AND COALESCE(u.resident_year, 0) = COALESCE(NEW.target_resident_year, 1);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_propagate_resident_transition_config_change
  ON public.resident_transition_config;

CREATE TRIGGER trigger_propagate_resident_transition_config_change
AFTER UPDATE ON public.resident_transition_config
FOR EACH ROW
EXECUTE FUNCTION public.propagate_resident_transition_config_change();

GRANT EXECUTE ON FUNCTION public.propagate_resident_transition_config_change()
  TO service_role;
