-- Conteo y listado de Conexiones aceptadas para la pantalla "Mi perfil" y
-- "Mis conexiones". Se apoya en la tabla public.resident_connections creada en
-- 20260607120000_resident_connections.sql. Ver docs/adr/0002-chat-directo-requiere-conexion.md
set check_function_bodies = off;

-- 1. Conteo de conexiones aceptadas del usuario autenticado. Cuenta las filas
--    'accepted' donde participa (como requester o addressee). Cheap: para la
--    línea "{x} conexiones" de la cabecera de perfil.
create or replace function public.get_resident_connection_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.resident_connections rc
  where rc.status = 'accepted'
    and (rc.requester_id = auth.uid() or rc.addressee_id = auth.uid());
$$;

-- 2. Lista de residentes conectados (status 'accepted') con los datos de perfil
--    necesarios para pintar cada fila y abrir el chat directo. Devuelve siempre
--    el "otro" usuario de la pareja, ordenado por conexión más reciente.
create or replace function public.get_my_connections()
returns table (
  connection_id uuid,
  user_id uuid,
  name text,
  surname text,
  avatar_url text,
  resident_year integer,
  speciality_id uuid,
  hospital_id uuid,
  connected_at timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rc.id as connection_id,
    u.id as user_id,
    u.name::text,
    u.surname::text,
    u.avatar_url::text,
    u.resident_year::integer,
    u.speciality_id,
    u.hospital_id,
    coalesce(rc.responded_at, rc.updated_at, rc.created_at) as connected_at
  from public.resident_connections rc
  join public.users u
    on u.id = case
      when rc.requester_id = auth.uid() then rc.addressee_id
      else rc.requester_id
    end
  where rc.status = 'accepted'
    and (rc.requester_id = auth.uid() or rc.addressee_id = auth.uid())
  order by coalesce(rc.responded_at, rc.updated_at, rc.created_at) desc;
$$;

grant execute on function public.get_resident_connection_count() to anon, authenticated, service_role;
grant execute on function public.get_my_connections() to anon, authenticated, service_role;
