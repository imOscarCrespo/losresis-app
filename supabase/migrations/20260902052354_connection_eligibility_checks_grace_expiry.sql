-- Elegibilidad social: deriva la caducidad de la gracia MIR en el momento de
-- leer, en vez de confiar solo en resident_state.
--
-- Problema: is_resident_connection_eligible aceptaba
-- resident_state = 'pending_corporate_email_seasonal' sin mirar
-- resident_transition_expires_at. Ese estado lo normaliza el cron diario
-- resident-lifecycle-refresh-daily ("15 3 * * *" UTC, via
-- refresh_resident_lifecycle_states). Como la gracia actual termina el
-- 2026-09-20 21:59:59+00 (23:59:59 Madrid) y el cron no corre hasta las
-- 03:15 UTC del 21 (05:15 Madrid), quedaba una ventana de 5h15m en la que la
-- app ya consideraba al residente 'locked' (getResidentState deriva el estado
-- del expiry al leer el perfil) pero la BD seguia permitiendole abrir chats y
-- enviar solicitudes de conexion. El servidor era mas permisivo que el cliente.
--
-- Solucion: comprobar el expiry aqui tambien, igual que hace la app. Elimina la
-- ventana sea cual sea la cadencia del cron. El cron NO cambia: sigue siendo
-- quien normaliza resident_state para el resto de la aplicacion; esto solo
-- anade defensa en profundidad en el punto de lectura.
--
-- La funcion se mantiene STABLE (now() es stable), asi que no altera el
-- contrato de sus consumidores: send_connection_request y ensure_direct_group.
--
-- Impacto el dia de aplicacion: cero filas cambian de resultado (los 599
-- residentes en gracia tienen expiry 2026-09-20 21:59:59, aun futuro).
set check_function_bodies = off;

create or replace function public.is_resident_connection_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.is_resident, false)
     and (
       u.resident_state = 'active'
       or (
         u.resident_state = 'pending_corporate_email_seasonal'
         and (
           u.resident_transition_expires_at is null
           or u.resident_transition_expires_at >= now()
         )
       )
       or (u.resident_state is null and nullif(trim(u.work_email), '') is not null)
     )
  from public.users u
  where u.id = p_user_id;
$$;

grant execute on function public.is_resident_connection_eligible(uuid) to anon, authenticated, service_role;
