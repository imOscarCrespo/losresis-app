INSERT INTO public.groups (
  user_type,
  speciality_id,
  cohort_year,
  city,
  hospital_id,
  name
)
SELECT
  'resident' AS user_type,
  NULL AS speciality_id,
  NULL AS cohort_year,
  NULL AS city,
  h.id AS hospital_id,
  h.name AS name
FROM public.hospitals h
WHERE NOT EXISTS (
  SELECT 1
  FROM public.groups g
  WHERE g.user_type = 'resident'
    AND g.hospital_id = h.id
    AND g.speciality_id IS NULL
);
