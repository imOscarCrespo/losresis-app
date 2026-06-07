-- Eventos compartidos: un Residente comparte un Evento de agenda (no-guardia) con
-- N de sus Conexiones aceptadas. Cada destinatario lo ve en solo-lectura dentro de
-- su propia Agenda. Ver docs/adr/0003-agenda-unificada-elimina-mercado-guardias.md
set check_function_bodies = off;

-- 1. Tipo de notificacion (debe existir ANTES de cualquier insert en notifications
--    por el FK notifications.type -> notification_types.code).
insert into public.notification_types (code, description)
values ('agenda_event_shared', 'Una conexion ha compartido un evento de agenda contigo')
on conflict (code) do nothing;

-- 2. Tabla de shares. Una fila por (evento, destinatario). Al borrar el evento o el
--    usuario, la fila desaparece en cascada.
create table if not exists public.agenda_event_shares (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.agenda_events(id) on delete cascade,
    shared_with_user_id uuid not null references public.users(id) on delete cascade,
    created_at timestamp with time zone not null default now(),
    constraint agenda_event_shares_unique unique (event_id, shared_with_user_id)
);

create index if not exists idx_agenda_event_shares_recipient
on public.agenda_event_shares (shared_with_user_id);

create index if not exists idx_agenda_event_shares_event
on public.agenda_event_shares (event_id);

alter table public.agenda_event_shares enable row level security;

-- El destinatario lee sus propias filas; el dueño lee las de sus eventos. Las
-- escrituras van por los RPC security definer, nunca directas desde el cliente.
drop policy if exists agenda_event_shares_select on public.agenda_event_shares;
create policy agenda_event_shares_select
on public.agenda_event_shares
for select
using (
  auth.uid() = shared_with_user_id
  or exists (
    select 1 from public.agenda_events e
    where e.id = agenda_event_shares.event_id and e.user_id = auth.uid()
  )
);

-- 3. Helper: ¿son dos residentes una Conexion aceptada?
create or replace function public.are_residents_connected(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.resident_connections rc
    where rc.status = 'accepted'
      and (
        (rc.requester_id = p_a and rc.addressee_id = p_b)
        or (rc.requester_id = p_b and rc.addressee_id = p_a)
      )
  );
$$;

-- 4. Helper de notificacion (insert en notifications dispara el push via trigger
--    send_push_notifications existente).
create or replace function public.notify_agenda_event_shared(
  p_event_id uuid,
  p_recipient_id uuid,
  p_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_name text;
  v_event_title text;
begin
  select nullif(trim(concat(coalesce(name, ''), ' ', coalesce(surname, ''))), '')
  into v_owner_name
  from public.users
  where id = p_owner_id;

  select title into v_event_title
  from public.agenda_events
  where id = p_event_id;

  insert into public.notifications (
    user_id, type, actor_user_id, title, body, entity_type, entity_id, data
  )
  values (
    p_recipient_id,
    'agenda_event_shared',
    p_owner_id,
    'Nuevo evento compartido',
    coalesce(v_owner_name, 'Un residente') || ' ha compartido un evento contigo'
      || coalesce(': ' || nullif(v_event_title, ''), '') || '.',
    'agenda_event',
    p_event_id,
    jsonb_build_object(
      'entity_type', 'agenda_event',
      'entity_id', p_event_id,
      'owner_id', p_owner_id,
      'destination_section', 'agenda'
    )
  );
end;
$$;

-- 5. Reconcilia el conjunto completo de destinatarios de un evento (sirve para el
--    alta Y la edicion). Valida propiedad + que no sea guardia + que cada
--    destinatario sea Conexion aceptada. Inserta los nuevos, borra los quitados y
--    notifica SOLO a los recien anadidos.
create or replace function public.set_agenda_event_shares(
  p_event_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_owner uuid;
  v_type text;
  v_target uuid;
  v_ids uuid[] := coalesce(p_user_ids, '{}');
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select user_id, event_type into v_owner, v_type
  from public.agenda_events
  where id = p_event_id;

  if v_owner is null then
    raise exception 'Event not found';
  end if;
  if v_owner <> v_me then
    raise exception 'Only the owner can share this event';
  end if;
  if v_type = 'shift' then
    raise exception 'Shifts cannot be shared';
  end if;

  -- Validar cada destinatario: ni uno mismo, y siempre Conexion aceptada.
  foreach v_target in array v_ids loop
    if v_target = v_me then
      raise exception 'Cannot share with yourself';
    end if;
    if not public.are_residents_connected(v_me, v_target) then
      raise exception 'Recipient is not an accepted connection';
    end if;
  end loop;

  -- Borrar los destinatarios quitados (si v_ids es vacio, borra todos).
  delete from public.agenda_event_shares
  where event_id = p_event_id
    and not (shared_with_user_id = any(v_ids));

  -- Insertar los nuevos + notificar a cada recien anadido.
  for v_target in
    select unnest(v_ids)
    except
    select shared_with_user_id
    from public.agenda_event_shares
    where event_id = p_event_id
  loop
    insert into public.agenda_event_shares (event_id, shared_with_user_id)
    values (p_event_id, v_target)
    on conflict (event_id, shared_with_user_id) do nothing;
    perform public.notify_agenda_event_shared(p_event_id, v_target, v_me);
  end loop;
end;
$$;

-- 6. Read model: eventos compartidos CONMIGO, con el nombre del dueno para
--    etiquetarlos en el calendario. Pinta lo ajeno en solo-lectura.
create or replace function public.get_events_shared_with_me()
returns table (
  id uuid,
  owner_id uuid,
  owner_name text,
  event_type text,
  title text,
  event_date date,
  end_date date,
  start_time time without time zone,
  end_time time without time zone,
  all_day boolean,
  notes text,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.user_id as owner_id,
    nullif(trim(concat(coalesce(u.name, ''), ' ', coalesce(u.surname, ''))), '') as owner_name,
    e.event_type,
    e.title,
    e.event_date,
    e.end_date,
    e.start_time,
    e.end_time,
    e.all_day,
    e.notes,
    e.metadata
  from public.agenda_event_shares s
  join public.agenda_events e on e.id = s.event_id
  join public.users u on u.id = e.user_id
  where s.shared_with_user_id = auth.uid();
$$;

-- Grants (mismo patron que el resto de RPC del proyecto).
grant select on table public.agenda_event_shares to anon, authenticated, service_role;
grant execute on function public.are_residents_connected(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.notify_agenda_event_shared(uuid, uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.set_agenda_event_shares(uuid, uuid[]) to anon, authenticated, service_role;
grant execute on function public.get_events_shared_with_me() to anon, authenticated, service_role;
