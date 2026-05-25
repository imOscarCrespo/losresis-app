-- Añade el flag `onboarding_completed` al perfil del usuario.
-- Sirve para decidir en App.js si mostrar el wizard de onboarding tras el registro
-- o entrar directo al dashboard.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Backfill conservador: los usuarios existentes que ya tienen nombre, ciudad y
-- un rol asignado se consideran onboarded para no molestarles en la siguiente
-- sesión con un wizard que ya superaron de facto.
UPDATE public.users
SET onboarding_completed = true
WHERE onboarding_completed = false
  AND name IS NOT NULL
  AND city IS NOT NULL
  AND (is_student OR is_resident OR is_doctor OR is_host);
