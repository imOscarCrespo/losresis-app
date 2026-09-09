-- Límite de uso de "Explícamelo fácil": 5 análisis por usuario y día.
--
-- Hasta ahora la edge function losresis-llm no tenía ningún tope, así que abrir
-- la sección a todos los estudiantes eran llamadas de visión ilimitadas. El
-- contador vive en la BD (no en la función) para que el incremento sea atómico
-- aunque el usuario dispare dos análisis a la vez desde dos dispositivos.
--
-- El día se calcula en hora de Madrid: los usuarios son españoles y el reset a
-- medianoche UTC les caería a la 01:00/02:00 de la madrugada.

-- Fuente única del tope, para no tener el 5 repetido en la BD y en la función.
create or replace function public.photo_study_daily_limit()
returns integer
language sql
immutable
as $function$
  select 5;
$function$;

create table if not exists public.study_photo_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  used_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.study_photo_daily_usage enable row level security;

-- Solo lectura de lo propio: el consumo lo hacen las RPC security definer.
drop policy if exists "study_photo_daily_usage_read_own" on public.study_photo_daily_usage;
create policy "study_photo_daily_usage_read_own"
  on public.study_photo_daily_usage
  for select
  to authenticated
  using (user_id = auth.uid());

-- Consume un análisis y devuelve si estaba permitido. El WHERE del upsert es lo
-- que hace el tope atómico: si la fila ya está en el límite, el UPDATE no
-- ocurre, no se devuelve fila y sabemos que la cuota está agotada.
create or replace function public.consume_photo_study_quota(
  p_user_id uuid default auth.uid(),
  p_limit integer default null
)
returns table (
  allowed boolean,
  used integer,
  remaining integer,
  daily_limit integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_limit integer := greatest(coalesce(p_limit, public.photo_study_daily_limit()), 0);
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_used integer;
begin
  if p_user_id is null or v_limit = 0 then
    return query select false, 0, 0, v_limit;
    return;
  end if;

  insert into public.study_photo_daily_usage as u (user_id, usage_date, used_count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update
     set used_count = u.used_count + 1,
         updated_at = now()
   where u.used_count < v_limit
  returning u.used_count into v_used;

  if v_used is null then
    select s.used_count
      into v_used
      from public.study_photo_daily_usage s
     where s.user_id = p_user_id
       and s.usage_date = v_today;

    return query select false, coalesce(v_used, v_limit), 0, v_limit;
    return;
  end if;

  return query select true, v_used, greatest(v_limit - v_used, 0), v_limit;
end;
$function$;

-- Devuelve el análisis si la llamada al modelo falló: el usuario no llegó a
-- recibir nada, así que no debe gastarle cuota.
create or replace function public.refund_photo_study_quota(
  p_user_id uuid default auth.uid()
)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.study_photo_daily_usage
     set used_count = greatest(used_count - 1, 0),
         updated_at = now()
   where user_id = p_user_id
     and usage_date = (now() at time zone 'Europe/Madrid')::date;
$function$;

-- Solo lectura, para que la pantalla pueda avisar de lo que queda antes de que
-- el usuario suba la foto.
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
  select
    coalesce(s.used_count, 0) as used,
    greatest(public.photo_study_daily_limit() - coalesce(s.used_count, 0), 0) as remaining,
    public.photo_study_daily_limit() as daily_limit
  from (select 1) dummy
  left join public.study_photo_daily_usage s
    on s.user_id = p_user_id
   and s.usage_date = (now() at time zone 'Europe/Madrid')::date
  where p_user_id is not null;
$function$;

revoke all on function public.consume_photo_study_quota(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_photo_study_quota(uuid) from public, anon, authenticated;
grant execute on function public.get_photo_study_quota(uuid) to authenticated;
