-- Sección "Salud mental" del residente.
--
-- Dos tablas:
--   - mental_health_assessments: cada Evaluación de bienestar (medición del CBI),
--     con las tres puntuaciones por dimensión (0-100) y las respuestas en JSONB.
--   - mental_health_consent: consentimiento explícito requerido por el RGPD (Art. 9,
--     datos de categoría especial relativos a la salud). Una fila por usuario.
--
-- Los datos viven aislados del resto del perfil social y solo son accesibles por su
-- propio dueño vía RLS. Ver docs/adr/0001-cbi-no-clinico-para-salud-mental.md.

CREATE TABLE IF NOT EXISTS public.mental_health_assessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Puntuaciones por dimensión del CBI (media de los ítems, 0-100).
  personal_score  numeric(5,2),
  work_score      numeric(5,2),
  patient_score   numeric(5,2),
  -- Respuestas crudas: { "p1": 50, "w1": 75, ... }
  answers         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS mental_health_assessments_user_created_idx
  ON public.mental_health_assessments (user_id, created_at DESC);

ALTER TABLE public.mental_health_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY mental_health_assessments_select_own
  ON public.mental_health_assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY mental_health_assessments_insert_own
  ON public.mental_health_assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY mental_health_assessments_delete_own
  ON public.mental_health_assessments FOR DELETE
  USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.mental_health_consent (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  consented_at  timestamptz NOT NULL DEFAULT now(),
  -- Versión del texto de consentimiento aceptado, para poder pedir re-consentimiento
  -- si el texto legal cambia en el futuro.
  version       text NOT NULL DEFAULT '1.0'
);

ALTER TABLE public.mental_health_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY mental_health_consent_select_own
  ON public.mental_health_consent FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY mental_health_consent_insert_own
  ON public.mental_health_consent FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY mental_health_consent_update_own
  ON public.mental_health_consent FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY mental_health_consent_delete_own
  ON public.mental_health_consent FOR DELETE
  USING (auth.uid() = user_id);
