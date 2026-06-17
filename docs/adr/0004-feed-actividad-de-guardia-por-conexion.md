# El Feed deriva Actividad de guardia visible por Conexión

La **ADR 0003** estableció que lo ajeno en la **Agenda** se ve por **proximidad de
equipo** (mismo hospital + especialidad) como **Guardia de equipo**, y fijó en el glosario
que *"una guardia nunca se comparte por Conexión"*. Ese modelo sigue vigente **dentro de la
Agenda**.

Ahora introducimos el **Feed**: una superficie **social** en la pantalla principal
(`HomeDashboardScreen`, pestaña Inicio) donde un **Residente** ve, en orden cronológico, la
actividad de sus **Conexiones** — sus **Posts** y las guardias que hacen. Esto crea un
**tercer canal de visibilidad de la guardia**, distinto de los dos de la Agenda: por
**Conexión**, no por proximidad de equipo. Un residente Z puede ser tu Conexión en **otro
hospital y/o especialidad**: hoy no verías su guardia por ningún sitio; con el Feed, sí.

El punto delicado es la fricción aparente con la 0003. Se resuelve con una distinción de
lenguaje: la guardia **no se comparte** (no hay un mecanismo de share como el de **Evento
compartido**, que es explícito y por destinatario). El sistema **deriva** de la guardia una
**Actividad de guardia** y la publica en el Feed. La guardia sigue sin "compartirse"; lo que
viaja al Feed es una actividad derivada, automática.

## Decisión

- El **Feed** muestra las guardias de **todas** las **Conexiones** del residente como
  **Actividad de guardia**, con independencia de hospital o especialidad. Es un canal de
  visibilidad **por Conexión**, **distinto y adicional** a la **Guardia de equipo** de la
  Agenda. Una misma guardia de un compañero-conexión puede aparecer en ambos sitios (en la
  Agenda por proximidad, en el Feed por Conexión); ese solapamiento es aceptado.
- La actividad **no** se publica al **crear** la guardia (que puede programarse con semanas
  de antelación y en **Lote de guardias**), sino **a las 09:00 (hora Europe/Madrid) del día
  siguiente a la fecha de la guardia**. Así cuadra el tiempo verbal ("ha hecho una guardia",
  en pasado) y un lote del mes no genera spam: cada guardia aflora su propio día.
- En v1 **no hay opt-out**: todas las guardias de un residente se emiten automáticamente a
  todas sus Conexiones. Se prioriza un Feed vivo desde el día 1 frente al control de
  privacidad por parte del residente.
- La **Actividad de guardia** probablemente **no necesita tabla propia**: es una consulta
  sobre `agenda_events` de tipo `shift` de las Conexiones, con un predicado temporal
  (`event_date + 1 día 09:00 <= now()`). El **Chapó** apunta directamente al `id` de la
  guardia.
- Sobre Posts y Actividades de guardia se da un único **Chapó** (reacción binaria por
  usuario e ítem). **Recibir** un Chapó notifica (in-app + push) al autor; el **contenido
  nuevo** de una Conexión (Post o Actividad de guardia) **no** genera push, para no inundar.

## Alternativas consideradas

- **Disparar la actividad al crear la guardia** (estilo "nueva guardia programada"): más
  simple como evento puntual, pero rompe el tiempo verbal y convierte el Lote de guardias en
  spam (N items de golpe, todos futuros). Descartada.
- **Opt-in / interruptor global / control por-guardia**: dan privacidad al residente, pero
  el opt-in arranca el Feed vacío y el control por-guardia mete fricción en cada alta y en el
  Lote. Descartadas para v1 en favor de la emisión automática; el interruptor global queda
  como ampliación natural si surge demanda de privacidad.
- **Pestaña "Feed" dedicada en el footer**: separa el feed del resto, pero no aparece "al
  abrir la app" salvo forzándola como landing, y seis pestañas aprietan. Descartada: el Feed
  es el cuerpo de la pestaña **Inicio**, que ya es el aterrizaje al abrir la app.
- **Reabrir la 0003 y declarar que la guardia "se comparte por Conexión"**: chocaría con el
  modelo de la Agenda y con el lenguaje del glosario. Descartada en favor de la distinción
  "no se comparte, se deriva una actividad".

## Consecuencias

- Conviven **tres** reglas de visibilidad de una guardia: proximidad de equipo (Guardia de
  equipo, en la Agenda, sin Conexión), y Conexión (Actividad de guardia, en el Feed). El
  glosario las separa explícitamente; un futuro lector debe entender que la 0003 ("nunca se
  comparte por Conexión") se refiere al **mecanismo de share** de la Agenda, no a la
  derivación social del Feed. Esta ADR es la razón.
- Sin opt-out, un residente no puede evitar que sus Conexiones vean su patrón de guardias.
  Es una decisión consciente de v1; si genera quejas, la salida es el interruptor global.
- El `HomeDashboardScreen` (pestaña Inicio) pasa de panel de accesos a **home social**: el
  grid de 9 iconos se colapsa a una fila horizontal y el cuerpo lo ocupa el Feed (composer +
  tarjetas). En la v1 el feed se renderiza **dentro del `ScrollView` existente** con paginado
  por botón "Cargar más" y ventana de 30 días (volumen acotado para un arranque con pocas
  conexiones). Migrar el cuerpo de residente a un único `FlatList` (cabecera = hero + semana +
  fila de iconos + composer; `data` = ítems) queda como **mejora de rendimiento pendiente**
  para cuando crezca el volumen.
- El **Chapó** y el **Post** sí persisten en tablas nuevas; la Actividad de guardia es
  derivada (sin tabla). Borrar un Post borra sus Chapós en cascada; borrar una guardia retira
  su Actividad y sus Chapós.

## Estado

accepted — 2026-06-07
