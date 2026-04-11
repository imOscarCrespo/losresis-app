WITH target_years (cohort_year) AS (
  VALUES
    (2021),
    (2022),
    (2023),
    (2024),
    (2025),
    (2026)
),
target_specialities (speciality_id) AS (
  VALUES
    ('02480cef-0e5e-4461-a563-4f55ae8c63a2'::uuid),
    ('0308ddf1-8466-4c7d-a200-01f2fd9cf783'::uuid),
    ('0f60f17b-2e5d-4355-9eb6-df00502fa541'::uuid),
    ('0f74d8e5-bbf4-4603-b9fb-f1aea30ae4ac'::uuid),
    ('10f34666-e58b-41cf-8315-b6d02ff08ef7'::uuid),
    ('1187d584-d5cf-49cf-9a29-cf20a59ef95f'::uuid),
    ('1426f526-3874-41f1-8a81-42324a51e4d7'::uuid),
    ('162a9401-6430-4a5e-88f0-90f25c919563'::uuid),
    ('26d8f727-98c3-4764-b0fd-068dc4fce581'::uuid),
    ('2c9c4518-06b0-4668-9277-6710d72bedd5'::uuid),
    ('39319b6b-755c-4850-aeb2-ce8d275d6fc0'::uuid),
    ('3aa97524-1073-43ca-afa2-ad571aea2e0e'::uuid),
    ('3dcf07c8-c4af-43fb-a792-23d37ecd7515'::uuid),
    ('4344b0e5-60ad-42a2-9f22-e6d9340056b3'::uuid),
    ('4349428f-ddaf-480b-8fb2-1c3c1aa7724c'::uuid),
    ('4599abef-dfdf-47d8-9e3d-6955f9f37bd2'::uuid),
    ('46e898a3-a111-4d0d-8b49-516f4eb2227f'::uuid),
    ('4e529b3e-5f0c-475d-941a-8aaa3da9692a'::uuid),
    ('4ec1c69f-3b45-447d-9ceb-9cf67898d606'::uuid),
    ('53ad2a88-7552-432e-9972-69e45f7ee350'::uuid),
    ('58028235-cc6a-4272-97db-10c96eaaeb4e'::uuid),
    ('594bfb5b-f05b-46f8-ac7b-9ff070b1d671'::uuid),
    ('675565d0-d0b9-4320-b896-715442911c9a'::uuid),
    ('6c643a7a-9c48-4bd1-9150-58e69b848cd7'::uuid),
    ('6f514161-3bc3-49c4-9410-9a1e40730163'::uuid),
    ('751100dc-ffae-4bf4-a94c-03260655c3b5'::uuid),
    ('7e3c7ce4-28f4-4dff-aa40-43cdf5599851'::uuid),
    ('8438d08a-c607-4e46-b16d-ced1fa8bf2c0'::uuid),
    ('8d541b5b-bc5c-4bee-bf64-2d61fc40d30e'::uuid),
    ('9d73ab7f-45b6-4337-a416-f89a0a634dca'::uuid),
    ('a34a6d80-a608-48bc-93a2-415fcbb7148e'::uuid),
    ('a9e267f8-5ac3-4a52-a231-ad81c38a8aaf'::uuid),
    ('b14aa3bb-2c93-49d9-9e23-6a84afbdaff3'::uuid),
    ('b1664aaf-d1d2-4e98-b0cc-a15ae9f54dd0'::uuid),
    ('b4211fbd-9042-49c8-acd3-cdd342497204'::uuid),
    ('b4cb7806-9a29-4c4a-9f22-f4badad1331d'::uuid),
    ('b61f4464-7963-429e-9066-326e74564dea'::uuid),
    ('c4cc78cd-ae22-4515-afa5-23056c3ee6c8'::uuid),
    ('cc43131e-833c-4e34-8d58-f3c55e01fe9a'::uuid),
    ('cc70b49f-b44a-43ec-b001-705c874c7178'::uuid),
    ('d8caaabb-ae62-4a59-b6d0-5a19347b2e6b'::uuid),
    ('dd4ebf3e-b33d-4799-9185-e833784eed12'::uuid),
    ('e4089e24-0ce2-4e5b-8c0c-a1e4806091de'::uuid),
    ('e593ca79-f232-4578-9604-a6da95bc24d2'::uuid),
    ('f29cd1ca-d811-43c8-98e8-bf650982e82f'::uuid),
    ('fabeee4d-a900-44a2-883a-6a2b8e76fe1d'::uuid),
    ('fe97b980-e785-4dfb-81b9-51b54e16f6cd'::uuid)
),
source_groups AS (
  SELECT
    'resident'::varchar(10) AS user_type,
    s.id AS speciality_id,
    y.cohort_year,
    NULL::text AS city,
    NULL::uuid AS hospital_id,
    s.name || ' - ' || y.cohort_year::text AS name
  FROM public.specialities s
  INNER JOIN target_specialities ts
    ON ts.speciality_id = s.id
  CROSS JOIN target_years y
)
INSERT INTO public.groups (
  user_type,
  speciality_id,
  cohort_year,
  city,
  hospital_id,
  name
)
SELECT
  sg.user_type,
  sg.speciality_id,
  sg.cohort_year,
  sg.city,
  sg.hospital_id,
  sg.name
FROM source_groups sg
WHERE NOT EXISTS (
  SELECT 1
  FROM public.groups g
  WHERE g.user_type = sg.user_type
    AND g.speciality_id = sg.speciality_id
    AND g.cohort_year = sg.cohort_year
    AND g.city IS NULL
    AND g.hospital_id IS NULL
);
