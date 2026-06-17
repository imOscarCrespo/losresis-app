-- Feed social del residente: Posts de contenido libre + Chapós (reacción única)
-- sobre Posts y Actividades de guardia de las Conexiones. La Actividad de guardia NO
-- tiene tabla: es una consulta derivada sobre agenda_events (event_type='shift') que
-- aflora a las 09:00 (Europe/Madrid) del día siguiente a la guardia.
-- Ver docs/adr/0004-feed-actividad-de-guardia-por-conexion.md
set check_function_bodies = off;

-- 1. Tipo de notificación (debe existir ANTES de cualquier insert en notifications
--    por el FK notifications.type -> notification_types.code).
insert into public.notification_types (code, description)
values ('feed_chapo', 'Una conexion te ha dado un Chapo en el feed')
on conflict (code) do nothing;

-- 2. Bucket de imágenes de posts (público en lectura; escritura por usuario autenticado).
insert into storage.buckets (id, name, public)
values ('feed-images', 'feed-images', true)
on conflict (id) do nothing;

drop policy if exists "feed_images_public_read" on storage.objects;
create policy "feed_images_public_read"
on storage.objects for select
using (bucket_id = 'feed-images');

drop policy if exists "feed_images_authenticated_insert" on storage.objects;
create policy "feed_images_authenticated_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'feed-images');

drop policy if exists "feed_images_owner_delete" on storage.objects;
create policy "feed_images_owner_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'feed-images' and owner = auth.uid());

-- 3. Tabla de Posts. Texto obligatorio, imagen opcional (path en el bucket feed-images).
create table if not exists public.feed_posts (
    id uuid primary key default gen_random_uuid(),
    author_id uuid not null references public.users(id) on delete cascade,
    body text not null check (length(trim(body)) > 0),
    image_path text,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

create index if not exists idx_feed_posts_author_created
on public.feed_posts (author_id, created_at desc);

create index if not exists idx_feed_posts_created
on public.feed_posts (created_at desc);

alter table public.feed_posts enable row level security;

-- El cliente solo LEE; escribe vía RPC security definer. Lectura: posts propios o de
-- mis conexiones aceptadas.
drop policy if exists feed_posts_select on public.feed_posts;
create policy feed_posts_select
on public.feed_posts
for select
using (
  auth.uid() = author_id
  or public.are_residents_connected(auth.uid(), author_id)
);

-- 4. Tabla de Chapós. Reacción binaria por (usuario, ítem). El ítem es polimórfico:
--    un Post (target_type='post') o una guardia / Actividad de guardia
--    (target_type='shift', target_id = agenda_events.id). Sin FK por el polimorfismo;
--    la limpieza en cascada la hacen los triggers de abajo.
create table if not exists public.feed_chapos (
    id uuid primary key default gen_random_uuid(),
    giver_id uuid not null references public.users(id) on delete cascade,
    target_type text not null check (target_type in ('post', 'shift')),
    target_id uuid not null,
    created_at timestamp with time zone not null default now(),
    constraint feed_chapos_unique unique (giver_id, target_type, target_id)
);

create index if not exists idx_feed_chapos_target
on public.feed_chapos (target_type, target_id);

alter table public.feed_chapos enable row level security;

-- Lectura directa: cualquier residente verificado puede leer el recuento (se expone
-- igualmente agregado por get_feed). Escritura solo vía RPC.
drop policy if exists feed_chapos_select on public.feed_chapos;
create policy feed_chapos_select
on public.feed_chapos
for select
using (auth.uid() is not null);

-- 5. Limpieza en cascada de los Chapós polimórficos.
create or replace function public.cleanup_feed_chapos_for_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.feed_chapos
  where target_type = 'post' and target_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_feed_chapos_post on public.feed_posts;
create trigger trg_cleanup_feed_chapos_post
before delete on public.feed_posts
for each row execute function public.cleanup_feed_chapos_for_post();

create or replace function public.cleanup_feed_chapos_for_shift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.event_type = 'shift' then
    delete from public.feed_chapos
    where target_type = 'shift' and target_id = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_feed_chapos_shift on public.agenda_events;
create trigger trg_cleanup_feed_chapos_shift
before delete on public.agenda_events
for each row execute function public.cleanup_feed_chapos_for_shift();

-- 6. Helpers --------------------------------------------------------------------

-- Instante de afloramiento de una guardia al feed: 09:00 (Europe/Madrid) del día
-- siguiente a la fecha de la guardia, como timestamptz.
create or replace function public.feed_shift_surface_at(p_event_date date)
returns timestamp with time zone
language sql
stable
as $$
  select ((p_event_date + 1)::timestamp + time '09:00') at time zone 'Europe/Madrid';
$$;

-- Conjunto de autores cuyo contenido veo en mi feed: yo + mis conexiones aceptadas.
create or replace function public.feed_author_ids()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()
  union
  select case when rc.requester_id = auth.uid() then rc.addressee_id else rc.requester_id end
  from public.resident_connections rc
  where rc.status = 'accepted'
    and (rc.requester_id = auth.uid() or rc.addressee_id = auth.uid());
$$;

-- Notificación de Chapó recibido (insert en notifications dispara el push).
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
    || case when p_target_type = 'shift'
            then ' te ha dado un Chapó por tu guardia.'
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

-- 7. RPC: crear Post. Solo residente verificado; texto obligatorio.
create or replace function public.create_feed_post(
  p_body text,
  p_image_path text default null
)
returns table (id uuid, created_at timestamp with time zone)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_id uuid;
  v_created timestamp with time zone;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_resident_connection_eligible(v_me) then
    raise exception 'Only verified residents can post';
  end if;
  if v_body is null then
    raise exception 'Post body is required';
  end if;

  insert into public.feed_posts (author_id, body, image_path)
  values (v_me, v_body, nullif(trim(coalesce(p_image_path, '')), ''))
  returning feed_posts.id, feed_posts.created_at into v_id, v_created;

  return query select v_id, v_created;
end;
$$;

-- 8. RPC: borrar Post propio (los Chapós caen por trigger).
create or replace function public.delete_feed_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_author uuid;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select author_id into v_author from public.feed_posts where id = p_post_id;
  if v_author is null then
    return; -- ya no existe: idempotente
  end if;
  if v_author <> v_me then
    raise exception 'Only the author can delete this post';
  end if;

  delete from public.feed_posts where id = p_post_id;
end;
$$;

-- 9. RPC: dar / quitar Chapó (toggle). Valida visibilidad del ítem y, en guardias,
--    que ya haya aflorado. Notifica solo al INSERTAR y si el autor no soy yo.
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
  if p_target_type not in ('post', 'shift') then
    raise exception 'Invalid target type';
  end if;

  -- Resolver el autor del ítem y validar que es visible para mí.
  if p_target_type = 'post' then
    select author_id into v_author from public.feed_posts where id = p_target_id;
    if v_author is null then
      raise exception 'Post not found';
    end if;
  else
    select user_id into v_author
    from public.agenda_events
    where id = p_target_id and event_type = 'shift'
      and event_date is not null
      and public.feed_shift_surface_at(event_date) <= now();
    if v_author is null then
      raise exception 'Shift activity not available';
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

-- 10. Read model: feed unificado (Posts + Actividades de guardia) de yo + mis
--     conexiones, ventana de 30 días, orden cronológico inverso, paginado por cursor
--     (activity_at < p_before).
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

-- Grants (mismo patrón que el resto de RPC del proyecto).
grant select on table public.feed_posts to anon, authenticated, service_role;
grant select on table public.feed_chapos to anon, authenticated, service_role;
grant execute on function public.feed_shift_surface_at(date) to anon, authenticated, service_role;
grant execute on function public.feed_author_ids() to anon, authenticated, service_role;
grant execute on function public.notify_feed_chapo(uuid, uuid, text, uuid) to anon, authenticated, service_role;
grant execute on function public.create_feed_post(text, text) to anon, authenticated, service_role;
grant execute on function public.delete_feed_post(uuid) to anon, authenticated, service_role;
grant execute on function public.toggle_feed_chapo(text, uuid) to anon, authenticated, service_role;
grant execute on function public.get_feed(integer, timestamp with time zone) to anon, authenticated, service_role;
