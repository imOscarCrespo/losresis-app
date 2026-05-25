-- Nota media del expediente académico del alumno (5.00-10.00).
-- Pondera el 10% del baremo MIR del Ministerio, así que es necesaria para que el
-- puesto MIR estimado en "Nota proyectada" sea comparable al real.
-- Mínimo 5.00: por debajo no se puede haber terminado la carrera de Medicina.
alter table public.users
  add column if not exists mir_expediente numeric;

do $$
begin
  alter table public.users
    add constraint users_mir_expediente_range_ck
    check (mir_expediente is null or (mir_expediente >= 5 and mir_expediente <= 10))
    not valid;
exception
  when duplicate_object then null;
end $$;
