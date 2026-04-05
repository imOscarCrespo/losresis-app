# AGENTS

## Database Source Of Truth

- La source of truth de la base de datos y de todas las migraciones compartidas es `~/code/losresis-shared/losresis-db`.
- Nunca crear, editar ni considerar definitivas migraciones SQL dentro de `losresis-app` o sus submódulos locales si el cambio no existe también en `~/code/losresis-shared/losresis-db`.
- Cuando una tarea afecte al esquema, migraciones, funciones SQL, RLS, triggers, seeds o tipos derivados de la base de datos, trabajar primero en `~/code/losresis-shared/losresis-db`.
- Tratar `losresis-app` como consumidor de ese repo compartido, no como fuente de verdad para cambios de base de datos.
