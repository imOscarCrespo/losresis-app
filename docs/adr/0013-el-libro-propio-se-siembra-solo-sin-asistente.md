# El Libro propio se siembra solo, sin asistente

## Status

accepted — retira el onboarding de 4 pasos que conservaba el [ADR 0007](0007-sin-plantilla-publicada-el-libro-propio-sobrevive.md)

## Contexto y decisión

El **Libro propio** nacía de un asistente de cuatro pasos (intro → categorías →
actividades → previsualización) dentro de `ResidenceLibraryScreen`: unas 600 líneas de
formulario que el **Residente** tenía que completar **antes de poder ver nada de su
libro**.

El problema no es el asistente, es a quién se le pide. El residente con tutor abre el
Libro y se encuentra el índice montado: sus apartados, su progreso, sus contadores. El
residente sin plantilla publicada —la mayoría— se encontraba un formulario pidiéndole
que diseñara la estructura de su libro **el día que estrena la app**, cuando todavía no
sabe qué va a rotar ni qué procedimientos va a contar. Dos productos distintos en la
misma pantalla, y el peor le tocaba a quien menos apoyo tiene.

El [ADR 0012](0012-el-libro-propio-tiene-los-mismos-apartados.md) ya igualó **qué**
tiene cada libro. Este iguala **cómo llega**: se decide **sembrar el Libro propio
automáticamente la primera vez que el residente abre el Libro**, y retirar el asistente.

Lo que se siembra: los ocho **Apartados** del catálogo (ADR 0012) y, dentro de Actividad
asistencial, las **Áreas de actividad** sugeridas para su especialidad
(`getLibroCategorySuggestions`) — que es exactamente lo que el asistente le ofrecía
premarcado en su paso 2. O sea, no se pierde contenido: se deja de pedir permiso para
ponerlo.

La estructura sigue siendo suya. Renombrar un área, borrarla o añadir otra se hace desde
el propio Libro, que es donde el residente ya sabe lo que quiere y tiene delante lo que
lleva registrado — no en un formulario previo a ciegas.

## Considered Options

- **Dejar el asistente pero saltárselo con un "Empezar con lo sugerido".** Un botón
  menos malo que cuatro pasos, pero sigue siendo una pantalla de configuración delante de
  la primera visita, y mantiene vivas las 600 líneas y sus dos caminos de siembra.
- **Sembrar y llevarle igualmente al asistente para que lo revise.** Le enseña lo que
  tiene, pero convierte el asistente en un tutorial que no cambia nada: el residente
  aprende a pulsar "siguiente" sin leer.
- **Sembrar en el alta (un trigger, como `apply_libro_template_for_user`).** Es donde
  vive la siembra desde plantilla y sería simétrico, pero requiere la especialidad
  resuelta y dejaría en la base de datos un catálogo de Áreas de actividad que hoy vive
  en la app (`data/libroOnboardingTemplates.js`). Sembrar al abrir cubre además a los
  residentes que ya existen sin ningún backfill.

## Consequences

- **La primera visita al Libro es el Libro, no un formulario.** Y es la misma para todos:
  con tutor o sin él, lo que se abre es el índice.
- **`ResidenceLibraryScreen` pierde ~1.100 líneas** (el asistente, sus componentes, su
  estado, sus manejadores y 83 estilos muertos), y `useLibroSection` pierde
  `createStructure`, que era su único llamador.
- **La siembra se decide antes de pintar.** `libroSeedResolved` gatea el render: los
  efectos corren después del primer pintado, así que sin él el residente nuevo vería un
  fotograma de "sin apartados" antes de que aparecieran.
- **Si la siembra falla, el Libro se abre vacío en vez de bloquearse.** Se reintenta al
  tirar para refrescar o al volver a entrar. Un spinner eterno sería peor que un libro
  vacío del que se puede salir.
- **`libro_user_settings.onboarding_completed_at` deja de ser una decisión del residente**
  y pasa a ser el sello de "ya se le sembró". Se sigue escribiendo (lo hace
  `createLibroStructure`) y sigue siendo lo que el resto del código consulta.
