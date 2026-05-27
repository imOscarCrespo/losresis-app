-- Rollback for 20260530120000_enable_housing_ad_quota_trigger.sql
-- Run manually if the trigger needs to be removed.

begin;

drop trigger if exists trigger_enforce_housing_ad_quota on public.housing_ad;
drop function if exists public.enforce_housing_ad_quota();

commit;
