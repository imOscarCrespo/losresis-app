-- Add `is_host` role: users whose only purpose is to publish housing ads
-- and chat with interested residents/students. Additive, default false,
-- so existing rows and behavior are unaffected.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_host boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_host
  ON public.users (is_host)
  WHERE is_host = true;

-- Update handle_new_user trigger to initialize is_host = false on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (
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
  VALUES (
    NEW.id,
    '',
    '',
    '',
    false,
    false,
    NULL,
    '',
    '',
    NULL,
    NULL,
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
