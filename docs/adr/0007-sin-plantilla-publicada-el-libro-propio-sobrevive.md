# Sin plantilla publicada, el Libro propio sobrevive

## Status

accepted

## Contexto y decisión

El rediseño de agosto 2026 establece que el Panel de Hospitales es el origen de
toda la configuración docente y que la app «únicamente representará esa
configuración». Leído en crudo, eso mata el onboarding en el que el **Residente**
se monta su propio libro.

Se decide **conservarlo** como camino de respaldo: sin **Plantilla del Libro**
publicada para su hospital, especialidad y año, el residente sigue montando su
**Libro propio** y registrando en él. En cuanto su hospital publique, se le ofrece
**Migrar a la plantilla**, nunca se le impone, y antes de consumarlo puede
descargarse su libro completo en PDF.

El dato que decide: **62 residentes** tienen Libro propio con **1.453 registros**
dentro, y solo **2 de 7** plantillas están publicadas — ninguna en un hospital con
residentes de esos. Aplicar el §19 al pie de la letra le quitaría el libro a 62
personas para satisfacer a 0.

## Consequences

- **Dos caminos vivos** en la app: estructura editable por el residente y
  estructura del tutor en solo lectura. El discriminador es
  `libro_book.template_id`, y es la misma distinción que separa **Libro propio** de
  **Libro oficial**.
- El arquetipo `tree` sirve a los dos: la pantalla es la misma y lo único que
  cambia es si la estructura se puede tocar.
- **El camino propio no crece.** Cubre lo que ya cubría (Actividad asistencial con
  sugerencias por especialidad); los apartados nuevos llegan por plantilla.
