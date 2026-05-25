-- Añade la academia MIR (opcional) al perfil del usuario estudiante.
-- Se usa para precargar el origen del simulacro en la pantalla de "Nota proyectada"
-- sin tener que preguntarlo cada vez. Valores: 'amir' | 'cto' | 'mir_asturias' | 'otro'.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mir_academy text;
