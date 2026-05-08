-- Soft delete support for housing_ad.
-- Keep this migration in sync with losresis-app/supabase/migrations because both apps share the same database.

begin;

alter table public.housing_ad
  add column if not exists deleted_at timestamptz;

create index if not exists housing_ad_deleted_at_idx
  on public.housing_ad (deleted_at);

commit;
