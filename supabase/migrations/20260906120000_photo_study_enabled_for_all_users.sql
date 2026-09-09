-- "Explícamelo fácil" (photo_study_analysis) pasa a estar activo para todos los
-- usuarios. Hasta ahora can_use_feature solo devolvía true para super admins o
-- para quien tuviera una fila propia en user_feature_access (tabla vacía), así
-- que la sección era invisible para todo el mundo menos para los admins.
--
-- En vez de rellenar una fila por usuario (que habría que mantener con cada
-- registro nuevo), se añade una capa global: una feature listada aquí como
-- activa lo está para todos, y una fila explícita en user_feature_access sigue
-- ganando, de modo que se puede revocar a un usuario concreto sin apagarla
-- para el resto.

create table if not exists public.feature_global_access (
  feature_key text primary key,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feature_global_access enable row level security;

-- Los flags no son secretos: el cliente ya sabe qué secciones existen.
drop policy if exists "feature_global_access_read" on public.feature_global_access;
create policy "feature_global_access_read"
  on public.feature_global_access
  for select
  to authenticated
  using (true);

insert into public.feature_global_access (feature_key, enabled)
values ('photo_study_analysis', true)
on conflict (feature_key) do update set enabled = true, updated_at = now();

-- Orden de resolución: super admin > fila propia del usuario > flag global.
create or replace function public.can_use_feature(
  p_feature_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- Sin usuario no hay acceso: ahora que hay flags globales, un p_user_id nulo
  -- no debe colarse por la rama global.
  select case
    when p_user_id is null then false
    when coalesce((
      select u.is_super_admin
      from public.users u
      where u.id = p_user_id
      limit 1
    ), false) then true
    else coalesce(
      (
        select ufa.enabled
        from public.user_feature_access ufa
        where ufa.user_id = p_user_id
          and ufa.feature_key = p_feature_key
        limit 1
      ),
      (
        select fga.enabled
        from public.feature_global_access fga
        where fga.feature_key = p_feature_key
        limit 1
      ),
      false
    )
  end;
$function$;
