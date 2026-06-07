-- Conexiones entre residentes: solicitud previa que habilita el chat directo
-- desde el directorio de Residentes. Ver docs/adr/0002-chat-directo-requiere-conexion.md
set check_function_bodies = off;

-- 1. Tipos de notificación (deben existir ANTES de cualquier insert en notifications
--    por el FK notifications.type -> notification_types.code).
insert into public.notification_types (code, description)
values
  ('connection_request', 'Un residente te ha enviado una solicitud de conexion'),
  ('connection_accepted', 'Un residente ha aceptado tu solicitud de conexion')
on conflict (code) do nothing;

-- 2. Tabla de conexiones. Una fila por pareja (pair_key unico). La transicion
--    pending -> accepted ES la creacion del vinculo.
create table if not exists public.resident_connections (
    id uuid primary key default gen_random_uuid(),
    requester_id uuid not null,
    addressee_id uuid not null,
    pair_key text not null,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    responded_at timestamp with time zone,
    constraint resident_connections_no_self_ck check (requester_id <> addressee_id),
    constraint resident_connections_requester_fkey foreign key (requester_id) references public.users(id) on delete cascade,
    constraint resident_connections_addressee_fkey foreign key (addressee_id) references public.users(id) on delete cascade
);

create unique index if not exists idx_resident_connections_pair
on public.resident_connections (pair_key);

create index if not exists idx_resident_connections_addressee
on public.resident_connections (addressee_id, status);

create index if not exists idx_resident_connections_requester
on public.resident_connections (requester_id, status);

alter table public.resident_connections enable row level security;

-- Solo lectura directa de las filas propias. Las escrituras van por los RPC
-- (security definer), nunca por el cliente directamente.
drop policy if exists resident_connections_select on public.resident_connections;
create policy resident_connections_select
on public.resident_connections
for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- 3. Helper: elegibilidad = residente verificado (mismo gate que el chat actual,
--    getResidentState === ACTIVE). 'active' explicito o legacy null + work_email.
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
       or (u.resident_state is null and nullif(trim(u.work_email), '') is not null)
     )
  from public.users u
  where u.id = p_user_id;
$$;

-- 4. Helpers de notificacion (insert en notifications dispara el push via trigger
--    send_push_notifications existente).
create or replace function public.notify_connection_request(
  p_connection_id uuid,
  p_addressee_id uuid,
  p_requester_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_name text;
begin
  select nullif(trim(concat(coalesce(name, ''), ' ', coalesce(surname, ''))), '')
  into v_requester_name
  from public.users
  where id = p_requester_id;

  insert into public.notifications (
    user_id, type, actor_user_id, title, body, entity_type, entity_id, data
  )
  values (
    p_addressee_id,
    'connection_request',
    p_requester_id,
    'Nueva solicitud de conexion',
    coalesce(v_requester_name, 'Un residente') || ' quiere conectar contigo.',
    'resident_connection',
    p_connection_id,
    jsonb_build_object(
      'entity_type', 'resident_connection',
      'entity_id', p_connection_id,
      'requester_id', p_requester_id,
      'destination_section', 'notifications'
    )
  );
end;
$$;

create or replace function public.notify_connection_accepted(
  p_connection_id uuid,
  p_requester_id uuid,
  p_accepter_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepter_name text;
begin
  select nullif(trim(concat(coalesce(name, ''), ' ', coalesce(surname, ''))), '')
  into v_accepter_name
  from public.users
  where id = p_accepter_id;

  insert into public.notifications (
    user_id, type, actor_user_id, title, body, entity_type, entity_id, data
  )
  values (
    p_requester_id,
    'connection_accepted',
    p_accepter_id,
    'Conexion aceptada',
    coalesce(v_accepter_name, 'Un residente') || ' ha aceptado tu solicitud. Ya podeis chatear.',
    'resident_connection',
    p_connection_id,
    jsonb_build_object(
      'entity_type', 'resident_connection',
      'entity_id', p_connection_id,
      'other_user_id', p_accepter_id,
      'destination_section', 'directChat'
    )
  );
end;
$$;

-- 5. Enviar solicitud. Idempotente, resuelve cruce (auto-accept) y reenvio tras rechazo.
create or replace function public.send_connection_request(p_addressee_id uuid)
returns table (connection_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_pair text;
  v_existing public.resident_connections%rowtype;
  v_conn_id uuid;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;
  if p_addressee_id is null then
    raise exception 'Addressee is required';
  end if;
  if p_addressee_id = v_me then
    raise exception 'Cannot connect with yourself';
  end if;
  if not public.is_resident_connection_eligible(v_me) then
    raise exception 'Sender is not a verified resident';
  end if;
  if not public.is_resident_connection_eligible(p_addressee_id) then
    raise exception 'Recipient is not a verified resident';
  end if;

  v_pair := case
    when v_me::text < p_addressee_id::text
      then v_me::text || ':' || p_addressee_id::text
    else p_addressee_id::text || ':' || v_me::text
  end;

  select * into v_existing
  from public.resident_connections
  where pair_key = v_pair;

  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      return query select v_existing.id, v_existing.status;
      return;
    elsif v_existing.status = 'pending' then
      -- Cruce: el otro ya me envio solicitud -> auto-aceptar.
      if v_existing.addressee_id = v_me then
        update public.resident_connections
          set status = 'accepted', responded_at = now(), updated_at = now()
          where id = v_existing.id;
        perform public.notify_connection_accepted(
          v_existing.id, v_existing.requester_id, v_me
        );
        return query select v_existing.id, 'accepted'::text;
        return;
      end if;
      -- Ya tengo una solicitud saliente pendiente -> idempotente.
      return query select v_existing.id, v_existing.status;
      return;
    else
      -- rejected -> reenvio: reinicia como pendiente con el emisor actual.
      update public.resident_connections
        set requester_id = v_me,
            addressee_id = p_addressee_id,
            status = 'pending',
            responded_at = null,
            created_at = now(),
            updated_at = now()
        where id = v_existing.id
        returning id into v_conn_id;
      perform public.notify_connection_request(v_conn_id, p_addressee_id, v_me);
      return query select v_conn_id, 'pending'::text;
      return;
    end if;
  end if;

  insert into public.resident_connections (requester_id, addressee_id, pair_key, status)
  values (v_me, p_addressee_id, v_pair, 'pending')
  returning id into v_conn_id;

  perform public.notify_connection_request(v_conn_id, p_addressee_id, v_me);
  return query select v_conn_id, 'pending'::text;
end;
$$;

-- 6. Aceptar (solo el destinatario, solo si sigue pendiente).
create or replace function public.accept_connection_request(p_connection_id uuid)
returns table (connection_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.resident_connections%rowtype;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_row
  from public.resident_connections
  where id = p_connection_id;

  if v_row.id is null then
    return query select p_connection_id, 'gone'::text;
    return;
  end if;
  if v_row.addressee_id <> v_me then
    raise exception 'Only the recipient can accept this request';
  end if;
  if v_row.status <> 'pending' then
    return query select v_row.id, v_row.status;
    return;
  end if;

  update public.resident_connections
    set status = 'accepted', responded_at = now(), updated_at = now()
    where id = v_row.id;

  perform public.notify_connection_accepted(v_row.id, v_row.requester_id, v_me);
  return query select v_row.id, 'accepted'::text;
end;
$$;

-- 7. Rechazar (solo el destinatario). Silencioso: no notifica al emisor.
create or replace function public.reject_connection_request(p_connection_id uuid)
returns table (connection_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.resident_connections%rowtype;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_row
  from public.resident_connections
  where id = p_connection_id;

  if v_row.id is null then
    return query select p_connection_id, 'gone'::text;
    return;
  end if;
  if v_row.addressee_id <> v_me then
    raise exception 'Only the recipient can reject this request';
  end if;
  if v_row.status <> 'pending' then
    return query select v_row.id, v_row.status;
    return;
  end if;

  update public.resident_connections
    set status = 'rejected', responded_at = now(), updated_at = now()
    where id = v_row.id;

  return query select v_row.id, 'rejected'::text;
end;
$$;

-- 8. Cancelar solicitud enviada (solo el emisor, solo si pendiente). Elimina la fila.
create or replace function public.cancel_connection_request(p_connection_id uuid)
returns table (connection_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_row public.resident_connections%rowtype;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_row
  from public.resident_connections
  where id = p_connection_id;

  if v_row.id is null then
    return query select p_connection_id, 'gone'::text;
    return;
  end if;
  if v_row.requester_id <> v_me then
    raise exception 'Only the sender can cancel this request';
  end if;
  if v_row.status <> 'pending' then
    return query select v_row.id, v_row.status;
    return;
  end if;

  delete from public.resident_connections where id = v_row.id;
  return query select v_row.id, 'cancelled'::text;
end;
$$;

-- 9. Estado de conexion del usuario actual respecto a una lista de residentes.
--    Solo devuelve filas existentes; el cliente asume 'none' para el resto.
create or replace function public.get_connection_statuses(p_user_ids uuid[])
returns table (
  other_user_id uuid,
  connection_id uuid,
  status text,
  direction text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when rc.requester_id = auth.uid() then rc.addressee_id else rc.requester_id end,
    rc.id,
    rc.status,
    case when rc.requester_id = auth.uid() then 'outgoing' else 'incoming' end
  from public.resident_connections rc
  where (rc.requester_id = auth.uid() and rc.addressee_id = any(p_user_ids))
     or (rc.addressee_id = auth.uid() and rc.requester_id = any(p_user_ids));
$$;

-- Grants (mismo patron que el resto de RPC del proyecto).
grant execute on function public.is_resident_connection_eligible(uuid) to anon, authenticated, service_role;
grant execute on function public.notify_connection_request(uuid, uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.notify_connection_accepted(uuid, uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.send_connection_request(uuid) to anon, authenticated, service_role;
grant execute on function public.accept_connection_request(uuid) to anon, authenticated, service_role;
grant execute on function public.reject_connection_request(uuid) to anon, authenticated, service_role;
grant execute on function public.cancel_connection_request(uuid) to anon, authenticated, service_role;
grant execute on function public.get_connection_statuses(uuid[]) to anon, authenticated, service_role;
