# El progreso del año solo mide objetivos del tutor

## Status

accepted

## Contexto y decisión

La pantalla del **Libro del Residente** enseña un porcentaje de **Progreso del
año**, y el documento de rediseño pedía que «cada apartado aporte un porcentaje al
progreso global». El problema es que solo dos **Arquetipos** tienen denominador:
`itinerary` (N fichas definidas por el tutor) y `tree` **donde el tutor puso
meta**. En `form` el residente crea las filas que quiera y en `automatic` las
guardias son las que le toquen: no hay objetivo contra el que medir.

Se decide que el porcentaje mide **solo lo que el tutor ha fijado como objetivo**:
fichas de itinerario completadas más actividades con meta. Cursos, Congresos,
Sesiones clínicas, Investigación y Guardias **no entran en el denominador**,
aunque sus contadores se sigan viendo en su tarjeta. La tarjeta lo dice en
pantalla: «sobre los objetivos que ha fijado tu tutor».

## Considered Options

- **Todos los apartados pesan igual**, contando como completo el que tenga al
  menos un registro. Siempre da un número, pero un curso apuntado vale lo mismo
  que seis rotaciones completadas, y el residente aprende a inflarlo.
- **Sin porcentaje**, solo cifras absolutas. Lo más honesto y lo más barato, pero
  el diseño acordado enseña un anillo con un porcentaje dentro.

## Consequences

- **Un apartado con 40 registros puede no mover el porcentaje.** Es la primera
  pregunta que hará cualquiera, y es correcta: 40 cursos no son progreso sobre un
  objetivo que nadie fijó.
- **Un año sin objetivos no tiene porcentaje**, no tiene 0%. Con plantilla sin
  metas ni itinerario, la tarjeta enseña cifras y no un anillo vacío.
- El número **se deriva al leer**, no se guarda: no puede desincronizarse y no
  necesita job.
