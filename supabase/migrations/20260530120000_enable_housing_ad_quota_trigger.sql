-- Enforce housing_ad quota at DB level.
--
-- IMPORTANT: this migration MUST be applied only after the client-side
-- feature flag `paywall_host_quota_enabled` has been rolled out to 100% of
-- hosts. While the flag is below 100%, the trigger could surface as an opaque
-- error to users on app versions that don't yet ship the paywall UI.
--
-- Grandfathered hosts (plan_slug = 'legacy_unlimited' with status = 'active')
-- have NULL max_listings via the catalog, so the function returns
-- can_create = true and the trigger lets them through.

begin;

create or replace function public.enforce_housing_ad_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_host boolean;
  v_max integer;
  v_count integer;
  v_can boolean;
begin
  -- Only restrict offer ads that are being created as active.
  if new.kind is distinct from 'offer' then
    return new;
  end if;
  if new.is_active is distinct from true then
    return new;
  end if;

  select is_host into v_is_host from public.users where id = new.user_id;
  if not coalesce(v_is_host, false) then
    return new;
  end if;

  select max_listings, current_active_count, can_create
    into v_max, v_count, v_can
  from public.get_user_listing_quota(new.user_id);

  if v_can then
    return new;
  end if;

  raise exception 'quota_exceeded'
    using
      errcode = 'P0001',
      hint = format('max=%s current=%s', v_max, v_count);
end;
$$;

drop trigger if exists trigger_enforce_housing_ad_quota on public.housing_ad;
create trigger trigger_enforce_housing_ad_quota
before insert on public.housing_ad
for each row execute function public.enforce_housing_ad_quota();

commit;
