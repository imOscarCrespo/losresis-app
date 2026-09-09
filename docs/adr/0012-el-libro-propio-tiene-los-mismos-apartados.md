# El Libro propio tiene los mismos Apartados que el oficial

## Status

accepted — revisa la última consecuencia del [ADR 0007](0007-sin-plantilla-publicada-el-libro-propio-sobrevive.md)

## Contexto y decisión

El ADR 0007 conservó el **Libro propio** como camino de respaldo y cerró con «el
camino propio no crece: cubre lo que ya cubría (Actividad asistencial con
sugerencias por especialidad); los apartados nuevos llegan por plantilla».

Nueve meses después eso significa que **el mismo producto se ve muy distinto según
el hospital**. Quien tiene tutor con plantilla publicada abre el Libro y encuentra
el índice completo —Rotaciones, Actividad asistencial, Guardias, Cursos, Sesiones
clínicas, Competencias—, con su progreso y su ficha por elemento. Quien se lo montó
él encuentra **una sola tarjeta**, y no porque haya elegido eso: porque el
onboarding solo sabe montar Actividad asistencial. Sus guardias están en la Agenda y
no las ve en el libro; sus cursos no tienen dónde ir; sus rotaciones tampoco.

Y no es un caso raro: es la mayoría. Cuando se escribió el ADR 0007, 62 residentes
tenían Libro propio y solo 2 de 7 plantillas estaban publicadas, ninguna en un
hospital con residentes de esos.

Se decide que **el Libro propio tenga los ocho Apartados del catálogo**, los mismos
que el tutor puede escoger, y que se pinte con las mismas pantallas. Lo único que
distingue a los dos caminos sigue siendo **quién pone la estructura de dentro**, que
es exactamente lo que ya discrimina `libro_book.template_id`.

De eso se derivan tres cosas:

1. **La siembra del Libro propio crea un libro por apartado**, no solo el de
   Actividad asistencial. Los apartados nacen vacíos: Guardias se llena solo desde
   la **Agenda**, los de arquetipo `form` ya piden sus campos por defecto sin
   plantilla (`getLibroFormFields` cae al `defaultOn` de cada campo), y el resto lo
   escribe el residente.
2. **En sus apartados `itinerary` la lista es suya.** El residente añade, edita y
   borra rotaciones y competencias (`saveLibroItineraryItem`). En el Libro oficial
   eso lo sigue impidiendo el candado de estructura de la base de datos
   (`libro_node_block_structure_changes`), que es donde tiene que estar.
3. **El nivel de una competencia propia lo pone el residente.** En el Libro oficial
   lo escribe el tutor al cerrar una **Evaluación** y el residente solo lo lee; en el
   propio no hay evaluación que pisar, y sin esto la competencia se quedaría en
   "Pendiente" para siempre y su **Progreso del año** no se movería nunca.

Los libros propios que ya existen se completan **al abrir el Libro**
(`ensureOwnLibroSections`), igual que se reconcilia la plantilla: es idempotente, no
lanza, y quien ya lo tenga completo no paga ninguna escritura.

## Considered Options

- **Dejarlo como estaba y empujar a Migrar a la plantilla.** Es lo que dice el ADR
  0007 y no cuesta nada implementar, pero la migración solo existe si el hospital ha
  publicado, y el residente cuyo hospital no publica —la mayoría— se queda con una
  tarjeta para siempre. No es una decisión suya: es un hospital que no ha hecho algo.
- **Sembrar contenido de arranque por especialidad** ("plantilla base"): rotaciones y
  competencias reales por especialidad, no apartados vacíos. Es lo que de verdad
  igualaría la experiencia, pero es trabajo de CONTENIDO para ~48 especialidades y no
  hay nada de eso en el repositorio. Los apartados vacíos no lo impiden: si algún día
  existe la plantilla base, se siembra encima.
- **Que el residente escoja sus apartados en el onboarding.** Un paso más en el alta
  para una decisión que no sabe tomar todavía —nadie sabe en su primera semana si va
  a ir a congresos—, y un apartado vacío no molesta: la tarjeta marca 0 y ya está.

## Consequences

- **El índice del Libro es el mismo en los dos caminos.** Lo que cambia se nota en un
  sitio y solo en uno: el subtítulo del progreso dice "de tu tutor" cuando los
  objetivos son suyos.
- **Un apartado vacío es normal ahora.** Un R1 recién llegado tiene siete tarjetas a
  0 y eso no es un fallo. Las copias de estado vacío lo dicen en su idioma según de
  quién sea el apartado.
- **Se completa el libro EN USO, no el del año del perfil.** El Libro propio no rota
  de año solo (ADR 0009), así que un R2 que sigue registrando en el libro que montó
  siendo R1 recibe los apartados nuevos en R1, que es donde está escribiendo.
- **La siembra del Libro propio vive en la app, no en `losresis-db`.** No contradice
  al ADR 0006: aquel prohíbe clonar la **Plantilla del Libro** desde el cliente, y
  aquí no hay plantilla que clonar —el catálogo de apartados es `data/libroSections.js`,
  que ya vive en la app porque es lo que la app pinta.
