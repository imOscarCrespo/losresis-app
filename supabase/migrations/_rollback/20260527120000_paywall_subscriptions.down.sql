-- Rollback for 20260527120000_paywall_subscriptions.sql
-- Run manually if the paywall data model needs to be removed.
--
-- WARNING: this restores `handle_new_user()` to its pre-paywall body
-- (see migration 20260510120000_add_is_host_role.sql). If `handle_new_user`
-- has been modified by a LATER migration, take that newer body as the
-- baseline instead of this one before running this rollback.

begin;

drop table if exists public.user_subscriptions cascade;
drop table if exists public.subscription_plans cascade;

drop function if exists public.get_user_listing_quota(uuid);
drop function if exists public.touch_user_subscriptions_updated_at();

do $$
begin
  if exists (select 1 from pg_type where typname = 'subscription_status') then
    drop type public.subscription_status;
  end if;
end$$;

-- Restore handle_new_user() to the pre-paywall body (from 20260510120000).
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

  return new;
end;
$$;

commit;
