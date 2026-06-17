-- Acceso social para R1 en gracia MIR. Ver docs/adr/0005-acceso-social-incluye-r1-en-gracia-mir.md
--
-- Amplía el gate de elegibilidad de Conexiones: además de los residentes 'active'
-- (y el caso legacy null + work_email), ahora son elegibles los R1 dentro de la
-- ventana de gracia MIR (resident_state = 'pending_corporate_email_seasonal'),
-- aunque todavía no hayan validado su email corporativo.
--
-- 'locked_missing_corporate_email' (gracia expirada sin email) sigue EXCLUIDO: ni
-- envía ni recibe solicitudes. El gate se aplica simétricamente a emisor y
-- destinatario en send_connection_request, que no se modifica (lee este helper).
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
       u.resident_state in ('active', 'pending_corporate_email_seasonal')
       or (u.resident_state is null and nullif(trim(u.work_email), '') is not null)
     )
  from public.users u
  where u.id = p_user_id;
$$;

grant execute on function public.is_resident_connection_eligible(uuid) to anon, authenticated, service_role;
