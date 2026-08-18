-- Publicar OFERTAS de vivienda (kind = 'offer') queda reservado a residentes
-- con el email corporativo validado.
--
-- Motivo: los caseros y usuarios externos publican ahora pagando desde el
-- portal de propietarios (vivienda.losresis.com, repo losresis-housing), que
-- escribe con el service role. La app deja de ser la vía gratuita para ellos.
--
-- Los anuncios "busco piso" (kind = 'seek') siguen abiertos a cualquier
-- usuario autenticado: no son monetizables por el portal y son la mitad del
-- tablón hoy.
--
-- Los anuncios ya publicados no se tocan: siguen activos y sus dueños pueden
-- editarlos y borrarlos aunque hoy no podrían crearlos.
--
-- Keep this migration in sync with losresis-app/supabase/migrations because
-- several apps share the same database.

begin;

-- ---------------------------------------------------------------------------
-- 1. Elegibilidad: residente con email corporativo validado
-- ---------------------------------------------------------------------------
-- Espejo en SQL de canPublishHousingOffer() en utils/residentAccess.js.
-- Dos condiciones independientes:
--   a) ciclo MIR: resident_state = 'active' (ni seasonal pendiente ni locked),
--   b) revisión manual del email: ni PENDING ni REJECTED vigente.
create or replace function public.can_publish_housing_offer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.users u
    left join lateral (
      select r.status, r.work_email
      from public.user_email_review_requests r
      where r.user_id = u.id
      order by r.created_at desc
      limit 1
    ) req on true
    where u.id = p_user_id
      and (
        u.is_super_admin
        or (
          u.is_resident
          -- (a) Solo el residente "active" tiene email corporativo confirmado.
          --     resident_state nulo = fila antigua: vale con tener work_email.
          and (
            u.resident_state = 'active'
            or (
              u.resident_state is null
              and coalesce(btrim(u.work_email), '') <> ''
            )
          )
          -- (b) Última solicitud de revisión manual. Un rechazo deja de aplicar
          --     si el usuario ya cambió el email desde entonces.
          and (
            req.status is null
            or req.status = 'APPROVED'
            or (
              req.status = 'REJECTED'
              and coalesce(btrim(req.work_email), '') <> ''
              and coalesce(btrim(u.work_email), '') <> ''
              and lower(btrim(req.work_email)) <> lower(btrim(u.work_email))
            )
          )
        )
      )
  );
$$;

comment on function public.can_publish_housing_offer(uuid) is
  'True si el usuario es residente con el email corporativo validado (o super admin), único perfil que puede crear anuncios de vivienda kind = offer desde la app.';

-- Solo la usa el trigger (que corre como owner). Sin esto, cualquier cliente
-- con la anon key podría sondear el estado de validación de otros usuarios.
revoke execute on function public.can_publish_housing_offer(uuid) from public;
revoke execute on function public.can_publish_housing_offer(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigger que aplica la regla
-- ---------------------------------------------------------------------------
-- Va en un trigger y no en el WITH CHECK de la policy porque la regla depende
-- del valor ANTERIOR de kind: un anuncio de oferta que ya existe se sigue
-- pudiendo editar, pero un "busco piso" no se puede convertir en oferta.
create or replace function public.enforce_housing_ad_offer_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Sin sesión de usuario (service role del portal de propietarios, cron,
  -- migraciones) no aplicamos la regla: allí el casero ya ha pagado y el
  -- portal valida la propiedad del anuncio por su cuenta. Las escrituras con
  -- sesión anónima las corta antes la RLS (user_id = auth.uid()).
  if auth.uid() is null then
    return new;
  end if;

  if new.kind <> 'offer' then
    return new;
  end if;

  -- Editar una oferta que ya era oferta: permitido para su dueño. El IF va
  -- anidado a propósito: en un trigger de INSERT, OLD no está asignado y
  -- plpgsql evalúa la expresión entera antes de cortocircuitar el AND.
  if tg_op = 'UPDATE' then
    if old.kind = 'offer' then
      return new;
    end if;
  end if;

  if not public.can_publish_housing_offer(new.user_id) then
    raise exception 'Solo los residentes con el email corporativo validado pueden publicar ofertas de vivienda'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists housing_ad_offer_eligibility on public.housing_ad;
create trigger housing_ad_offer_eligibility
  before insert or update on public.housing_ad
  for each row
  execute function public.enforce_housing_ad_offer_eligibility();

-- ---------------------------------------------------------------------------
-- 3. RLS: sustituir la policy abierta por uno-por-operación
-- ---------------------------------------------------------------------------
-- `allow_all_housing_ad` era ALL / USING true / WITH CHECK true: cualquiera con
-- la anon key podía insertar, editar o borrar anuncios ajenos, así que el
-- trigger sin esto sería sorteable escribiendo directo contra la API.
-- La lectura sigue abierta (app, web y portal listan el tablón).
alter table public.housing_ad enable row level security;

drop policy if exists "allow_all_housing_ad" on public.housing_ad;

drop policy if exists "housing_ad_select_public" on public.housing_ad;
create policy "housing_ad_select_public"
  on public.housing_ad
  for select
  using (true);

drop policy if exists "housing_ad_insert_own" on public.housing_ad;
create policy "housing_ad_insert_own"
  on public.housing_ad
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "housing_ad_update_own" on public.housing_ad;
create policy "housing_ad_update_own"
  on public.housing_ad
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "housing_ad_delete_own" on public.housing_ad;
create policy "housing_ad_delete_own"
  on public.housing_ad
  for delete
  using (auth.uid() = user_id);

commit;
