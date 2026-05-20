# Static Catalogs And Supabase Cached Egress

## Why This Exists

Supabase bills `Cached Egress` for outgoing traffic served from cache hits across API, Storage and Edge Functions. The app has several large datasets that are mostly static and change roughly once per year:

- hospitals
- specialities
- hospital-speciality relationships
- MIR grades and slots
- static review/roommate/external-rotation questions
- speciality quiz questions for each quiz version
- small static resident transition config

These datasets are now exported into local JSON files under `data/staticCatalog/` and read through `services/staticCatalogService.js`. This avoids repeatedly downloading them from Supabase in runtime.

## Source Of Truth

The JSON files in `data/staticCatalog/` are generated artifacts, not the source of truth.

The source of truth remains:

- database data in Supabase
- shared DB repo and migrations in `~/code/losresis-shared/losresis-db`

Never treat manual edits to `data/staticCatalog/*.json` as definitive.

## Updating A Hospital, Speciality Or MIR Grade

Use this flow:

1. Apply the data change in the DB source of truth.
   - `hospitals` for hospital rows
   - `specialities` for speciality rows
   - `hospital_specialities` for hospital-speciality relationships and `info_note`
   - `hospital_speciality_grades` for MIR grades and slots
2. If the change needs SQL, create/edit the migration in `~/code/losresis-shared/losresis-db`, not in `losresis-app/supabase/migrations`.
3. From `losresis-app`, regenerate the app catalog:

   ```bash
   npm run export:static-catalog
   ```

4. Review the diff in `data/staticCatalog/`.
5. Publish a new build or EAS Update.

Important: inserting or updating only the DB is not enough for already deployed app versions to see these static catalog changes. The app must receive a build/update containing regenerated JSON.

## What Still Comes From Supabase At Runtime

Dynamic data still comes from Supabase:

- auth and user profiles
- reviews and review answers
- speciality quiz sessions, answers and scoring RPCs
- chats, notifications and favorites
- housing ads and uploaded images
- open day registrations
- any user-generated or frequently changing content

## Operational Notes

- Run `npm run export:static-catalog` before release when catalog data has changed.
- The biggest local file is `hospital_speciality_grades.json`; this is intentional because it avoids repeated Supabase egress for MIR simulation and hospital detail screens.
- If app size becomes a concern, optimize the generated JSON encoding instead of moving these datasets back to Supabase runtime reads.
