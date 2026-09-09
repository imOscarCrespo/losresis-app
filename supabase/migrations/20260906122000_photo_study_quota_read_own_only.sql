-- get_photo_study_quota es SECURITY DEFINER y recibe el user_id por parámetro,
-- así que tal cual quedaba cualquier usuario autenticado podía leer el contador
-- de otro. No es dato sensible, pero no hay razón para exponerlo: la función
-- pasa a resolver siempre sobre auth.uid() cuando hay sesión, y el parámetro
-- solo se usa desde service_role (donde auth.uid() es null).

create or replace function public.get_photo_study_quota(
  p_user_id uuid default auth.uid()
)
returns table (
  used integer,
  remaining integer,
  daily_limit integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with target as (
    select coalesce(auth.uid(), p_user_id) as user_id
  )
  select
    coalesce(s.used_count, 0) as used,
    greatest(public.photo_study_daily_limit() - coalesce(s.used_count, 0), 0) as remaining,
    public.photo_study_daily_limit() as daily_limit
  from target t
  left join public.study_photo_daily_usage s
    on s.user_id = t.user_id
   and s.usage_date = (now() at time zone 'Europe/Madrid')::date
  where t.user_id is not null;
$function$;

revoke all on function public.get_photo_study_quota(uuid) from public, anon;
grant execute on function public.get_photo_study_quota(uuid) to authenticated, service_role;
