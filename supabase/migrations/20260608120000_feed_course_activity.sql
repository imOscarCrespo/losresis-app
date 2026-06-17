-- Actividad de curso en el Feed. A diferencia de la Actividad de guardia (que
-- aflora a las 09:00 del día siguiente, en pasado: "hizo una guardia"), un curso
-- aflora EN EL MOMENTO en que el residente lo añade a la Agenda ("se ha apuntado
-- a un curso"): por eso su activity_at es created_at, sin gating temporal.
-- Reutiliza el modelo derivado de la 0004: sin tabla propia, consulta sobre
-- agenda_events (event_type='course'). El Chapó suma 'course' como target_type.
-- Ver docs/adr/0004-feed-actividad-de-guardia-por-conexion.md
set check_function_bodies = off;

-- 1. El Chapó ahora apunta también a cursos (target_id = agenda_events.id).
alter table public.feed_chapos
  drop constraint if exists feed_chapos_target_type_check;
alter table public.feed_chapos
  add constraint feed_chapos_target_type_check
  check (target_type in ('post', 'shift', 'course'));

-- 2. Limpieza en cascada: al borrar una guardia O un curso, retiramos sus Chapós.
--    Para estos tipos target_type coincide con event_type, así que es 1:1.
create or replace function public.cleanup_feed_chapos_for_shift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.event_type in ('shift', 'course') then
    delete from public.feed_chapos
    where target_type = old.event_type and target_id = old.id;
  end if;
  return old;
end;
$$;

-- 3. Notificación de Chapó: copy específico para cursos.
create or replace function public.notify_feed_chapo(
  p_recipient_id uuid,
  p_giver_id uuid,
  p_target_type text,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_giver_name text;
  v_body text;
begin
  select nullif(trim(concat(coalesce(name, ''), ' ', coalesce(surname, ''))), '')
  into v_giver_name
  from public.users
  where id = p_giver_id;

  v_body := coalesce(v_giver_name, 'Un residente')
    || case p_target_type
            when 'shift' then ' te ha dado un Chapó por tu guardia.'
            when 'course' then ' te ha dado un Chapó por tu curso.'
            else ' te ha dado un Chapó en tu publicación.'
       end;

  insert into public.notifications (
    user_id, type, actor_user_id, title, body, entity_type, entity_id, data
  )
  values (
    p_recipient_id,
    'feed_chapo',
    p_giver_id,
    'Nuevo Chapó',
    v_body,
    'feed_' || p_target_type,
    p_target_id,
    jsonb_build_object(
      'entity_type', 'feed_' || p_target_type,
      'entity_id', p_target_id,
      'giver_id', p_giver_id,
      'destination_section', 'inicio'
    )
  );
end;
$$;

-- 4. RPC toggle: añade 'course'. El curso es visible en cuanto existe (sin gating
--    temporal, al revés que la guardia).
create or replace function public.toggle_feed_chapo(
  p_target_type text,
  p_target_id uuid
)
returns table (chapo_count integer, viewer_has_chapo boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_author uuid;
  v_existing uuid;
  v_inserted boolean := false;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_resident_connection_eligible(v_me) then
    raise exception 'Only verified residents can react';
  end if;
  if p_target_type not in ('post', 'shift', 'course') then
    raise exception 'Invalid target type';
  end if;

  -- Resolver el autor del ítem y validar que es visible para mí.
  if p_target_type = 'post' then
    select author_id into v_author from public.feed_posts where id = p_target_id;
    if v_author is null then
      raise exception 'Post not found';
    end if;
  elsif p_target_type = 'shift' then
    select user_id into v_author
    from public.agenda_events
    where id = p_target_id and event_type = 'shift'
      and event_date is not null
      and public.feed_shift_surface_at(event_date) <= now();
    if v_author is null then
      raise exception 'Shift activity not available';
    end if;
  else
    select user_id into v_author
    from public.agenda_events
    where id = p_target_id and event_type = 'course';
    if v_author is null then
      raise exception 'Course activity not available';
    end if;
  end if;

  if v_author <> v_me
     and not public.are_residents_connected(v_me, v_author) then
    raise exception 'Item is not visible to you';
  end if;

  -- Toggle.
  select id into v_existing
  from public.feed_chapos
  where giver_id = v_me and target_type = p_target_type and target_id = p_target_id;

  if v_existing is not null then
    delete from public.feed_chapos where id = v_existing;
  else
    insert into public.feed_chapos (giver_id, target_type, target_id)
    values (v_me, p_target_type, p_target_id)
    on conflict (giver_id, target_type, target_id) do nothing;
    v_inserted := true;
    if v_author <> v_me then
      perform public.notify_feed_chapo(v_author, v_me, p_target_type, p_target_id);
    end if;
  end if;

  return query
    select
      (select count(*)::integer from public.feed_chapos
        where target_type = p_target_type and target_id = p_target_id),
      v_inserted;
end;
$$;

-- 5. Read model: el feed suma las Actividades de curso. Reutiliza las columnas
--    shift_title / shift_date para el nombre y la fecha del curso (genéricas de
--    agenda_event). activity_at = created_at (afloramiento inmediato). La fecha de
--    creación es timestamp sin tz; en Supabase now() la escribe en UTC, así que la
--    reinterpretamos como instante UTC para ordenar/paginar junto al resto.
create or replace function public.get_feed(
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
  shift_title text,
  shift_date date,
  chapo_count integer,
  viewer_has_chapo boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with authors as (
    select user_id from public.feed_author_ids()
  ),
  items as (
    -- Posts
    select
      'post'::text as item_type,
      p.id as item_id,
      p.author_id,
      p.created_at as activity_at,
      p.body,
      p.image_path,
      null::text as shift_title,
      null::date as shift_date
    from public.feed_posts p
    join authors a on a.user_id = p.author_id
    where p.created_at >= now() - interval '30 days'

    union all

    -- Actividades de guardia (afloradas)
    select
      'shift'::text as item_type,
      e.id as item_id,
      e.user_id as author_id,
      public.feed_shift_surface_at(e.event_date) as activity_at,
      null::text as body,
      null::text as image_path,
      e.title as shift_title,
      e.event_date as shift_date
    from public.agenda_events e
    join authors a on a.user_id = e.user_id
    where e.event_type = 'shift'
      and e.event_date is not null
      and public.feed_shift_surface_at(e.event_date) <= now()
      and public.feed_shift_surface_at(e.event_date) >= now() - interval '30 days'

    union all

    -- Actividades de curso (afloran al crearse en la Agenda)
    select
      'course'::text as item_type,
      e.id as item_id,
      e.user_id as author_id,
      (e.created_at at time zone 'UTC') as activity_at,
      null::text as body,
      null::text as image_path,
      e.title as shift_title,
      e.event_date as shift_date
    from public.agenda_events e
    join authors a on a.user_id = e.user_id
    where e.event_type = 'course'
      and (e.created_at at time zone 'UTC') >= now() - interval '30 days'
  )
  select
    i.item_type,
    i.item_id,
    i.author_id,
    u.name::text,
    u.surname::text,
    u.avatar_url::text,
    u.resident_year::integer,
    i.activity_at,
    i.body,
    i.image_path,
    i.shift_title,
    i.shift_date,
    (select count(*)::integer from public.feed_chapos c
      where c.target_type = i.item_type and c.target_id = i.item_id) as chapo_count,
    exists (select 1 from public.feed_chapos c
      where c.target_type = i.item_type and c.target_id = i.item_id
        and c.giver_id = auth.uid()) as viewer_has_chapo
  from items i
  join public.users u on u.id = i.author_id
  where i.activity_at < coalesce(p_before, 'infinity'::timestamptz)
  order by i.activity_at desc, i.item_id
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;
