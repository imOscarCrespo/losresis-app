# El apartado personalizado se lee en vivo de la plantilla

## Status

accepted

Contraparte en la app del ADR 0038 de losresis-panel
(`docs/adr/0038-el-apartado-personalizado-es-un-quinto-arquetipo.md`).

## Contexto y decisión

Desde ClickUp 86cbm0fc6 el hospital puede diseñar **Apartados personalizados** en la
Plantilla del Libro. No son valores de `libro_section_code` ni tienen `libro_book`:
viven en `libro_custom_section` / `_field` / `_activity`, y el residente escribe en
`libro_custom_entry`.

La app los trata como un quinto **Arquetipo**, `custom`:

- La estructura se lee **en vivo** de la plantilla publicada
  (`getLibroCustomSections`), nunca se clona (ADR 0006). Lo que el hospital cambie
  aparece al refrescar.
- Se ven en el **Libro oficial** y en el plan del tutor; no en un año con Libro
  propio (ADR 0007), que los recibe al Migrar a la plantilla.
- Se registra en ellos solo en el año en curso. No dependen de `libro_book`, así que
  un año de la plantilla con solo apartados personalizados también se registra.
- Un apartado **retirado** por el hospital en el que el residente ya registró se
  sigue viendo, en solo lectura. Las respuestas en campos retirados también.
- Sus metas suman al **Progreso del año** (ADR 0008): las pone el tutor.

## Consequences

- `section` (y `useLibroSection`) no se mueven al abrir un personalizado: no es un
  valor del enum y consultarlo daría error.
- El índice conserva el orden de siempre para los ocho del catálogo y coloca cada
  personalizado detrás del apartado que el hospital le puso delante.
- El inicio suma las mismas metas (`getLibroCustomYearGoals`), para que el
  porcentaje no difiera del Libro.
- Las apps sin actualizar no ven los apartados personalizados; lo registrado desde
  una app nueva no se pierde por ello.
