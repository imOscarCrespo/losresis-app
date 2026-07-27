# Handoff: sembrar el libro por año desde la plantilla (multi-año)

> Documento de arranque para desarrollar más adelante (otro tab). **No** implementa
> nada; describe el estado actual y el trabajo pendiente en `losresis-app` (+ la RPC
> compartida en `losresis-db`).

## Contexto

En `losresis-panel` el tutor define la **plantilla del libro de residente por año**
(`libro_template_node` gana una columna `residency_year`, con pestañas R1–R5). Al
onboarding, `apply_libro_template_for_user` siembra el libro del **año actual** del
residente desde la plantilla de ese año.

Falta la parte de **runtime en la app** cuando el residente **avanza de año**.

## Qué YA está listo en la app (no hay que construirlo)

`screens/ResidenceLibraryScreen.js` + `hooks/useLibroSection.js` ya soportan varios
libros por año:

- Selector de libros cuando `books.length > 1` (`ResidenceLibraryScreen.js` ~L1458).
- Título por año `R{residency_year}` y estado activo/archivado; los archivados son de
  solo lectura (`ensureEditableBook`).
- Botón "Archivar libro actual y empezar nuevo año" → `handleStartNextYearBook`
  (~L783) → `archiveAndStartNewYear(userResidencyYear)` (~L803), gated por
  `canStartNextYearBook` (el residente debe subir antes su `resident_year` en Perfil).

## La laguna (lo que hay que construir)

Al avanzar de año, el libro nuevo se crea **VACÍO**:

- `services/libroService.js` → `archiveLibroBookAndStartNewYear` llama a la RPC.
- `losresis-db` → `archive_libro_book_and_start_new_year(p_user_id, p_section,
  p_next_residency_year)` archiva el activo e inserta un `libro_book` nuevo **sin
  nodos**.

No aplica la plantilla del año nuevo. Por tanto R2–R5 definidos por el tutor no se
materializan al pasar de año.

## Trabajo pendiente

1. **RPC (losresis-db)** — opción recomendada: crear una función
   `seed_libro_book_from_template(p_user_id, p_book_id, p_section, p_residency_year)`
   que copie los `libro_template_node` de la plantilla publicada (hospital+especialidad
   del usuario) de ese `residency_year` al `libro_node` del `p_book_id`, respetando la
   jerarquía categoría→actividad, igual que hace `apply_libro_template_for_user`.
   - Reutilizar la lógica de clonado de `apply_libro_template_for_user`
     (`losresis-db/20260720120000_libro_residente_templates.sql`) para no duplicar.
2. **Enganche del avance de año**: tras crear el libro nuevo en
   `archive_libro_book_and_start_new_year`, invocar el sembrado del nuevo año (o
   llamar a `seed_libro_book_from_template` desde el cliente justo después de
   `archiveAndStartNewYear`).
3. **Copy en la app**: el aviso actual dice "crear un libro nuevo **vacío**"
   (`ResidenceLibraryScreen.js` ~L796). Ajustar el texto si ahora vendrá
   pre-sembrado desde la plantilla del año.
4. **Casos borde a decidir**:
   - Si no hay plantilla publicada para ese año → libro vacío (comportamiento actual).
   - Residente que ya tenía nodos propios en ese año (poco probable con el flujo de
     archivar) → no sobrescribir.
   - Cambios de `resident_year` hacia abajo en Perfil (evitar resembrados raros).

## Dependencia con el panel

La columna `residency_year` en `libro_template_node` y el ajuste de
`apply_libro_template_for_user` para filtrar por año se hacen en el trabajo del panel
(`losresis-panel` + migración en `losresis-db`). Este handoff asume que esa columna ya
existe.
