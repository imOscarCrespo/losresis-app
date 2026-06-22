-- "Mis publicaciones": el Residente ve y gestiona sus propios Posts desde Mi perfil.
-- El Feed (get_feed) solo muestra lo de las Conexiones, así que sin esto un residente
-- no puede ver lo que él ha publicado. Ver CONTEXT.md → Mis publicaciones / Chapós recibidos
-- y docs/adr/0004-feed-actividad-de-guardia-por-conexion.md
set check_function_bodies = off;

-- 1. Lista paginada de los Posts del usuario autenticado. A diferencia de get_feed,
--    NO aplica ventana de 30 días (es el historial completo del autor) y solo trae
--    Posts (las Actividades de guardia se gestionan desde la Agenda). Misma forma de
--    fila que la parte de Posts de get_feed para reutilizar FeedItemCard en cliente.
create or replace function public.get_my_posts(
  p_limit integer default 20,
  p_before timestamp with time zone default null
)
returns table (
  item_type text,
  item_id uuid,
  author_id uuid,
  author_name text,
  author_surname text,
  author_avatar_url text,
  author_resident_year integer,
  activity_at timestamp with time zone,
  body text,
  image_path text,
  chapo_count integer,
  viewer_has_chapo boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'post'::text as item_type,
    p.id as item_id,
    p.author_id,
    u.name::text,
    u.surname::text,
    u.avatar_url::text,
    u.resident_year::integer,
    p.created_at as activity_at,
    p.body,
    p.image_path,
    (select count(*)::integer from public.feed_chapos c
      where c.target_type = 'post' and c.target_id = p.id) as chapo_count,
    exists (select 1 from public.feed_chapos c
      where c.target_type = 'post' and c.target_id = p.id
        and c.giver_id = auth.uid()) as viewer_has_chapo
  from public.feed_posts p
  join public.users u on u.id = p.author_id
  where p.author_id = auth.uid()
    and p.created_at < coalesce(p_before, 'infinity'::timestamptz)
  order by p.created_at desc, p.id
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

-- 2. Métricas de cabecera de Mi perfil: nº de Posts propios y total de Chapós
--    recibidos (sumando los de sus Posts y los de sus Actividades de guardia —
--    "kudos total" del residente). Barato: dos counts para la cabecera.
create or replace function public.get_my_feed_stats()
returns table (
  posts_count integer,
  chapos_received integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer
       from public.feed_posts p
      where p.author_id = auth.uid()) as posts_count,
    (select count(*)::integer
       from public.feed_chapos c
      where (c.target_type = 'post' and c.target_id in (
               select p.id from public.feed_posts p where p.author_id = auth.uid()))
         or (c.target_type = 'shift' and c.target_id in (
               select e.id from public.agenda_events e
                where e.user_id = auth.uid() and e.event_type = 'shift'))
    ) as chapos_received;
$$;

grant execute on function public.get_my_posts(integer, timestamp with time zone) to anon, authenticated, service_role;
grant execute on function public.get_my_feed_stats() to anon, authenticated, service_role;
