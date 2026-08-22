# El deshacer del contador hereda la fecha del registro que anula

## Status

accepted

## Contexto y decisión

En el **Apartado** de **Arquetipo** `tree`, el botón menos de una actividad no borra
nada: inserta un `libro_entry` con `count: -1`. Y lo insertaba con
`performed_at: today()` (`screens/ResidenceLibraryScreen.js`, `handleDecrement`), sin
saber qué registro estaba anulando — su única comprobación era `node.total_count > 0`.

El total del año salía bien, porque `SUM(count)` sobre todo el año es el mismo con
cualquier fecha. Lo que salía mal era **cualquier suma por ventana de fechas**: un
registro de junio deshecho en agosto dejaba el `+1` en junio y el `-1` en agosto, así
que "los últimos 30 días" contaba un `-1` suelto y "junio" contaba un `+1` que el
residente ya había retirado. Dos ventanas mal por cada deshacer.

No se había notado porque nadie preguntaba por ventanas. **Preguntar al Libro** del panel
(su ADR 0026) pregunta justo eso, y era su primera pregunta.

Se decide que el menos **identifique el registro que anula**: busca el `libro_entry` con
`count > 0` más reciente de ese nodo que no esté ya anulado, y escribe el `-1` con **su**
`performed_at`. Con eso `SUM(count)` es correcto en cualquier ventana por construcción,
sin que quien consulte tenga que compensar nada.

## Considered Options

- **Anulación por referencia explícita**: `libro_entry` gana `anula_entry_id`, y el
  residente deshace desde la lista de registros eligiendo cuál. Es más correcto y
  auditable —el tutor vería qué se anuló y cuándo—, y es lo que habría que hacer si el
  deshacer tuviera que rendir cuentas. Se descarta para esto: migración, UI nueva en la
  app y trabajo en el panel para pintarlo, cuando el problema a resolver es que las
  fechas cuadren.
- **Que el panel avise en vez de arreglarlo**: la cifra vendría con un "incluye 2 ajustes
  a la baja que quizá sean de otra ventana". Cero riesgo en la app, pero deja al tutor
  interpretando una nota al pie en cada consulta, para siempre.
- **Contar solo los positivos** en las consultas por ventana. Nunca sale un número
  absurdo, y el panel y la app pasan a dar cifras distintas para lo mismo — con el chat
  inflando, que es la dirección equivocada del error.

## Consequences

- El deshacer pasa a costar una consulta más por pulsación (buscar el último positivo).
  Es un botón que se pulsa por error, no en bucle.
- **Aparecen registros con fecha vieja recién creados.** Es exactamente la pregunta que
  se hará quien lea la tabla, y la razón de esta ADR: un `libro_entry` con
  `created_at` de hoy y `performed_at` de hace dos meses no es un bug.
- Con dos positivos de la misma fecha, cuál de los dos se anula es indiferente: la suma
  por ventana sale igual. No hace falta desempatar.
- **No se corrige el pasado.** Los `-1` ya escritos siguen con la fecha del día en que se
  pulsó, y no hay forma de reconstruir a qué positivo correspondían. Las ventanas
  anteriores al despliegue siguen mal.
- Sigue habiendo una segunda fuente de fechas raras que esto no toca: `performed_at` se
  añadió con `DEFAULT CURRENT_DATE` en `20260317123000`, así que **todo registro anterior
  a esa migración dice haber ocurrido ese día**. Preguntar por marzo de 2026 enseña un
  pico que no existió.
