# El Libro propio activo no caduca al cambiar de año

## Status

accepted

## Contexto y decisión

La regla de escritura del **Libro del Residente** era «solo se registra en el libro
del año en curso»: `selectedYear === users.resident_year`. Con **Libro oficial** eso
funciona, porque cuando el perfil pasa a R2 la app siembra el año nuevo desde la
**Plantilla del Libro** y archiva los anteriores.

Con **Libro propio** no funciona, y es el caso mayoritario (ADR 0007: 62 residentes,
1.453 registros). El libro propio se creó con el año que el residente tenía en el
onboarding y **nadie lo rota**: la siembra automática exige plantilla, y sin
plantilla publicada no hay quien cree el libro de R2. Así que el día en que su perfil
pasaba a R2, su único libro —el de R1, activo— pasaba a solo lectura y el residente
se quedaba **sin ningún sitio donde registrar**, con un aviso diciéndole que estaba
mirando «el plan de tu tutor» sobre una estructura que había montado él.

Se decide que un **Libro propio** con `status = 'active'` es el libro **en uso**, y se
puede escribir en él aunque su `residency_year` ya no sea el del perfil.
`libro_book_one_active_per_user_section_idx` solo admite un libro activo por apartado,
así que «libro propio activo» es exactamente «el libro en uso»: la excepción no
reabre ningún año archivado.

Y el año abierto **sigue al perfil**: si `resident_year` cambia con la pantalla
montada (el dashboard revalida el perfil al volver a primer plano, y el residente
puede corregirlo desde su perfil), el Libro vuelve a elegir año y recarga, para que la
siembra del año nuevo pueda ocurrir.

## Considered Options

- **Rotar el Libro propio al cambiar de año**, clonando su estructura al año nuevo y
  archivando el viejo. Es lo que hace la plantilla, pero clonar estructura en el
  cliente es justo lo que prohíbe el ADR 0006, y además decide por el residente que
  su R2 se parece a su R1.
- **Dejarlo en solo lectura y ofrecerle montarse el libro de R2** (volver al
  onboarding). Consistente con la regla, pero le pide rehacer a mano lo que ya tenía
  para poder seguir apuntando, y ADR 0007 dice que el camino propio **no crece**.

## Consequences

- Un residente de R2 puede estar registrando en un libro cuyo `residency_year` es 1, y
  sus `libro_entry` se guardan con el año **del libro**, no con el del perfil. Es
  coherente con lo que se exporta en PDF y con lo que ve su tutor, pero significa que
  el año de un registro no es una fecha: es el libro en el que cayó.
- El candado del rail de años ya no es `year !== resident_year`: es «en este año no se
  puede registrar». Un año con libro propio activo se ve sin candado.
- En cuanto el hospital publique plantilla, este residente entra por **Migrar a la
  plantilla** y vuelve al camino oficial, donde el año sí rota solo.
