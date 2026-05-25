-- "Nota MIR proyectada": persistencia de los simulacros del alumno.
-- Asegura la tabla mir_mock_results y la amplía con los campos que las academias
-- (CTO en particular) entregan en cada simulacro: NETO, rango mejor/peor del puesto
-- MIR estimado, puesto sólo entre alumnos de la academia y etiqueta del simulacro.

begin;

create table if not exists public.mir_mock_results (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  taken_at date not null,
  source text,
  reported_order int,
  label text,
  created_at timestamptz not null default now()
);

alter table public.mir_mock_results
  add column if not exists neto numeric,
  add column if not exists reported_order_best int,
  add column if not exists reported_order_worst int,
  add column if not exists academy_only_order int,
  add column if not exists simulacro_label text;

-- best <= worst cuando ambos vienen. Hacemos check NOT VALID para no fallar con datos previos.
do $$
begin
  alter table public.mir_mock_results
    add constraint mir_mock_results_order_range_ck
    check (
      reported_order_best is null
      or reported_order_worst is null
      or reported_order_best <= reported_order_worst
    ) not valid;
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_mir_mock_results_user_date
  on public.mir_mock_results (user_id, taken_at desc);

alter table public.mir_mock_results enable row level security;

do $$
begin
  create policy mir_mock_results_owner_all
    on public.mir_mock_results
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception
  when duplicate_object then null;
end $$;

grant all on table public.mir_mock_results to authenticated, service_role;

commit;
