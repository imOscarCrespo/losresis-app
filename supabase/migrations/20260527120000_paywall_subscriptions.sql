-- Paywall for hosts: subscription_plans + user_subscriptions + quota function.
-- This migration is ADDITIVE and DOES NOT enforce the quota at DB level (the
-- trigger lives in a separate migration applied later, once the client-side
-- feature flag has reached 100% rollout). Existing flows are unaffected.
--
-- Grandfathering: hosts that today already have more than one active offer
-- ad get the `legacy_unlimited` plan in the backfill so the future trigger
-- never blocks them. The plan is `is_active = false` so it is invisible to
-- the client offerings list and not purchasable.

begin;

-- 1. Enum for subscription status.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'none',
      'active',
      'trialing',
      'past_due',
      'canceled',
      'expired'
    );
  end if;
end$$;

-- 2. Catalog of plans.
create table if not exists public.subscription_plans (
  slug text primary key,
  name text not null,
  max_listings integer null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (slug, name, max_listings, is_active)
values
  ('free', 'Free', 1, true),
  ('unlimited', 'Unlimited Host', null, true),
  ('legacy_unlimited', 'Legacy Unlimited Host', null, false)
on conflict (slug) do nothing;

-- 3. Per-user subscription state. One row per user, with raw RC event for audit.
create table if not exists public.user_subscriptions (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan_slug text not null references public.subscription_plans(slug) default 'free',
  status public.subscription_status not null default 'none',
  rc_app_user_id text null,
  rc_entitlement_id text null,
  rc_product_id text null,
  current_period_end timestamptz null,
  will_renew boolean not null default false,
  last_event_id text null,
  raw_event jsonb null,
  updated_at timestamptz not null default now()
);

create unique index if not exists user_subscriptions_last_event_id_unique
  on public.user_subscriptions (last_event_id)
  where last_event_id is not null;

create index if not exists user_subscriptions_status_idx
  on public.user_subscriptions (status);

-- updated_at trigger
create or replace function public.touch_user_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_touch_user_subscriptions_updated_at on public.user_subscriptions;
create trigger trigger_touch_user_subscriptions_updated_at
before update on public.user_subscriptions
for each row execute function public.touch_user_subscriptions_updated_at();

-- 4. Quota function. Returns the user's plan, max_listings, current active
-- count and whether they can create one more. SECURITY DEFINER so the
-- function can read across tables under predictable RLS context.
create or replace function public.get_user_listing_quota(p_user uuid)
returns table(
  plan_slug text,
  status public.subscription_status,
  max_listings integer,
  current_active_count integer,
  can_create boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with sub as (
    select us.plan_slug, us.status, sp.max_listings
    from public.user_subscriptions us
    join public.subscription_plans sp on sp.slug = us.plan_slug
    where us.user_id = p_user
  ),
  cnt as (
    select count(*)::int as c
    from public.housing_ad
    where user_id = p_user
      and kind = 'offer'
      and is_active = true
      and deleted_at is null
  )
  -- Defensive: if no sub row exists (shouldn't happen post-backfill) treat as free.
  -- A NULL max_listings on an existing sub row means unlimited.
  select
    coalesce(sub.plan_slug, 'free') as plan_slug,
    coalesce(sub.status, 'none'::public.subscription_status) as status,
    case when sub.plan_slug is null then 1 else sub.max_listings end as max_listings,
    cnt.c as current_active_count,
    case
      when sub.plan_slug is null then cnt.c < 1
      when sub.max_listings is null then true
      else cnt.c < sub.max_listings
    end as can_create
  from cnt
  left join sub on true;
$$;

grant execute on function public.get_user_listing_quota(uuid) to authenticated;
grant execute on function public.get_user_listing_quota(uuid) to service_role;

-- 5. Backfill: create a user_subscriptions row for every user.
-- Hosts with more than one active offer ad get `legacy_unlimited` so they
-- are never blocked by the future trigger.
with host_active_counts as (
  select user_id, count(*) as c
  from public.housing_ad
  where kind = 'offer'
    and is_active = true
    and deleted_at is null
  group by user_id
),
legacy_hosts as (
  select u.id as user_id
  from public.users u
  join host_active_counts h on h.user_id = u.id
  where u.is_host = true
    and h.c > 1
)
insert into public.user_subscriptions (user_id, plan_slug, status)
select
  u.id,
  case when l.user_id is not null then 'legacy_unlimited' else 'free' end,
  case when l.user_id is not null then 'active'::public.subscription_status else 'none'::public.subscription_status end
from public.users u
left join legacy_hosts l on l.user_id = u.id
on conflict (user_id) do nothing;

-- 6. Extend handle_new_user to seed a free subscription row at signup.
-- Keep the rest of the body identical to the existing migration.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (
    id,
    name,
    surname,
    phone,
    is_doctor,
    is_student,
    hospital_id,
    city,
    work_email,
    speciality_id,
    resident_year,
    is_resident,
    is_host
  )
  values (
    new.id,
    '',
    '',
    '',
    false,
    false,
    null,
    '',
    '',
    null,
    null,
    false,
    false
  )
  on conflict (id) do nothing;

  insert into public.user_subscriptions (user_id, plan_slug, status)
  values (new.id, 'free', 'none')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 7. RLS — read-own for user_subscriptions, public read for active plans.
-- Writes only via service_role (edge function).
alter table public.user_subscriptions enable row level security;

drop policy if exists user_subscriptions_select_own on public.user_subscriptions;
create policy user_subscriptions_select_own
on public.user_subscriptions
for select
using (auth.uid() = user_id);

alter table public.subscription_plans enable row level security;

drop policy if exists subscription_plans_public_read on public.subscription_plans;
create policy subscription_plans_public_read
on public.subscription_plans
for select
using (is_active = true);

grant select on table public.user_subscriptions to authenticated;
grant select on table public.subscription_plans to authenticated;
grant select on table public.subscription_plans to anon;
grant all on table public.user_subscriptions to service_role;
grant all on table public.subscription_plans to service_role;

commit;
