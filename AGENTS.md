# AGENTS

## Database Source Of Truth

- La source of truth de la base de datos y de todas las migraciones compartidas es `~/code/losresis-shared/losresis-db`.
- Todas las migraciones SQL nuevas deben crearse siempre en `~/code/losresis-shared/losresis-db`, nunca en `losresis-app/supabase/migrations`.
- Nunca crear, editar ni considerar definitivas migraciones SQL dentro de `losresis-app` o sus submódulos locales si el cambio no existe también en `~/code/losresis-shared/losresis-db`.
- Cuando una tarea afecte al esquema, migraciones, funciones SQL, RLS, triggers, seeds o tipos derivados de la base de datos, trabajar primero en `~/code/losresis-shared/losresis-db`.
- Tratar `losresis-app` como consumidor de ese repo compartido, no como fuente de verdad para cambios de base de datos.
- Después de añadir o modificar una migración en `losresis-db`, el siguiente paso en `losresis-app` es actualizar el puntero del submódulo o reflejar el cambio consumido, no recrear la migración localmente.

## User Deletion Safety

- Si se añade una foreign key hacia `public.users(id)` o `auth.users(id)`, hay que definir explícitamente su comportamiento durante el borrado de usuario: `ON DELETE CASCADE`, `ON DELETE SET NULL` o una estrategia equivalente justificada.
- Si una relación nueva puede bloquear el borrado completo de una cuenta, la misma tarea debe incluir la migración necesaria para que la eliminación del usuario siga siendo posible sin limpieza manual posterior.
- No dar por válido un cambio de esquema que referencia usuarios si no se ha revisado también el flujo de eliminación de cuenta y sus dependencias históricas.

## Speciality Quiz Versioning

- El test de especialidad MIR tiene actualmente dos versiones que deben poder convivir en base de datos y en la app mientras existan usuarios sin actualizar.
- La versión antigua usa `meta.version = 'v2_profiles_abcd'` y la RPC `calculate_top_specialities`.
- La versión nueva usa `meta.version = 'v3_profiles_abcd_18'`, preguntas con `speciality_quiz_question.quiz_version = 'v3_profiles_abcd_18'` y la RPC `calculate_top_specialities_v3`.
- No reinterpretar, migrar en caliente ni sobrescribir sesiones históricas `v2` con la lógica `v3`.
- Cualquier cambio futuro en preguntas, scoring, perfiles o RPC del quiz debe ser versionado y compatible con ambas rutas hasta que se retire explícitamente la compatibilidad.
- Si una tarea toca el dashboard, histórico, persistencia de sesiones o lectura de `top_results` / `raw_scores`, revisar siempre compatibilidad con sesiones `v2` y `v3`.
