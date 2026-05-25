-- Foto de perfil del usuario. Guarda la ruta dentro del bucket `roommate-avatar`
-- (mismo bucket y políticas RLS que usan los perfiles roomie). La URL pública
-- se reconstruye en cliente con `getRoommateAvatarUrl(path)`.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;
