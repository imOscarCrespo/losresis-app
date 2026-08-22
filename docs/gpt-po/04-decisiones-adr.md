# Decisiones de producto ya tomadas (ADRs)

> Si una tarea contradice una de estas decisiones, hay que decirlo explícitamente en la tarea.

## ADRs de losresis-app

### 0001-cbi-no-clinico-para-salud-mental.md

# Usar el CBI (no el MBI) y un framing no clínico para la sección de Salud mental

Para medir el bienestar del residente elegimos el **Copenhagen Burnout Inventory (CBI)**
en lugar del Maslach Burnout Inventory (MBI), aunque el MBI es el instrumento dominante en
la literatura española (≈76% de los estudios). El MBI requiere licencia comercial de pago
(Mind Garden: mínimo $2.75/uso, prohíbe la distribución en apps abiertas), lo que es
incompatible con un despliegue gratuito a escala. El CBI es de dominio público, está
validado en español y mide tres dimensiones equivalentes.

Además, presentamos los resultados deliberadamente **sin niveles ni umbrales**
(bajo/moderado/alto, "zona de alerta"): no existen cortes validados del CBI para residentes
MIR españoles, y etiquetar una puntuación como "alta" constituiría una afirmación clínica
que la app no está habilitada para hacer. Mostramos la puntuación y su **evolución temporal**
como autoconocimiento, y los recursos de ayuda están siempre accesibles, nunca disparados
por una cifra.

## Consecuencias

- El texto exacto de los 19 ítems debe ser la **versión española validada** del CBI, no una
  traducción propia; usar una traducción ad-hoc anularía la validez que justifica la elección.
- No habrá función `getScoreLevel` ni lógica condicionada a umbrales en el cliente.
- Si en el futuro se necesita cribado clínico real (depresión, ansiedad), se añadirían
  instrumentos validados específicos (PHQ-9, GAD-7) como escalado opcional, no reinterpretando
  el CBI.

## Estado

accepted — 2026-06-06

### 0002-chat-directo-requiere-conexion.md

# El chat directo del directorio requiere una Conexión previa

Hasta ahora cualquier **Residente** verificado (`getResidentState === ACTIVE`) podía
abrir un chat directo con cualquier otro residente desde la pantalla de **Residentes**,
sin paso previo. Introducimos la **Conexión**: una **Solicitud de conexión** que el
destinatario acepta antes de poder chatear. La solicitud solo tiene sentido si controla
el acceso, así que el botón del directorio pasa a ser **solo-vínculo**: "Conectar" →
"Pendiente" → "Chatear".

El punto delicado es que **la sala de chat 1:1 es infraestructura compartida**: todos los
chats directos entre residentes son `groups.kind = 'resident_rotation_direct'`,
deduplicados por `direct_pair_key`, y la misma sala se abre desde varios puntos de entrada
(directorio de Residentes, *roommates* —que ya exige match— y *rotaciones externas* —que
tiene su propio contexto—). Bloquear el chat "en la sala" rompería roommates y rotaciones,
que tienen su propia autorización legítima.

## Decisión

- La **Conexión** gobierna **el punto de entrada del directorio de Residentes**, no la sala
  de chat genérica. `ensure_direct_group` / `ensure_resident_rotation_direct_group` no se
  modifican: roommates y rotaciones siguen abriendo la misma sala sin Conexión.
- **No se migran** los chats existentes. Las parejas que ya tienen sala la conservan en
  "Mis chats" y vía roommates/rotaciones; el requisito de Conexión aplica solo al botón del
  directorio de aquí en adelante. No se hace backfill de Conexiones a partir de salas previas
  (incluiría parejas que solo chatearon por roommates/rotaciones, no por vínculo deseado).
- El gate para enviar y recibir solicitudes es el **mismo que el del chat actual**
  (`getResidentState === ACTIVE`), enforzado server-side en el RPC, no solo en cliente.
  **(Modificado por [ADR-0005](./0005-acceso-social-incluye-r1-en-gracia-mir.md): el gate pasa a
  incluir también a los R1 en gracia MIR `pending_corporate_email_seasonal`, no solo `ACTIVE`.)**

## Alternativas consideradas

- **Bloquear el chat en la sala compartida**: coherente conceptualmente ("no hay chat sin
  vínculo") pero rompe roommates y rotaciones, que son entradas autorizadas independientes.
  Descartada.
- **Backfill de Conexiones desde salas existentes**: daría continuidad al botón "Chatear"
  para parejas con historial, pero fabricaría Conexiones que el usuario nunca pidió (p.ej.
  parejas que solo hablaron por una rotación). Descartada.

## Consecuencias

- El directorio necesita conocer el estado de Conexión por residente visible (RPC batch
  tipo `get_connection_statuses(ids[])` para la página cargada) para pintar el botón correcto.
- Una pareja puede acabar chateando sin Conexión si llegan por roommates/rotaciones. Es
  aceptable y consistente: esos contextos ya autorizan la conversación.
- Si en el futuro se quiere un bloqueo real "sin vínculo no hay chat en ningún punto", habría
  que rediseñar la autorización de la sala compartida y reconciliar roommates/rotaciones.

## Estado

accepted — 2026-06-07

### 0003-agenda-unificada-elimina-mercado-guardias.md

# La Agenda absorbe el calendario de equipo y se elimina el mercado de guardias

Hasta ahora la **Agenda** (`screens/AgendaScreen.js`) era estrictamente personal, y
existía una pantalla aparte, el "calendario de equipo" (`screens/TeamCalendarView.js`,
titulada "Guardias del Equipo"), accesible desde el icono `people-outline` del hero. Esa
pantalla mostraba las **Guardias** de los compañeros del mismo hospital y especialidad, y
era el **único punto** de la app donde se podían **crear** solicitudes de intercambio
(`shift_swap_requests`) y de compra (`shift_purchase_requests`) de guardias: tocabas una
guardia ajena y se abría `SwapRequestModal` o `PurchaseRequestModal`.

Al introducir el compartir de **Eventos de agenda** entre **Conexiones**, el lugar natural
para ver "lo de los demás" pasa a ser el propio calendario principal. Mantener además una
segunda pantalla de calendario, con su propio modelo de visibilidad (proximidad de equipo)
y su mercado de guardias, deja de tener sentido: son dos calendarios que compiten por el
mismo espacio mental del residente.

## Decisión

- **Se elimina `TeamCalendarView.js`** y su punto de entrada en la Agenda. Todo se unifica
  en el calendario principal de `AgendaScreen`, que pasa a mostrar tres cosas: los
  **Eventos de agenda** propios (editables), las **Guardias de equipo** de los compañeros
  y los **Eventos compartidos** por las **Conexiones**. Lo ajeno se muestra en
  **solo-lectura**, etiquetado con el nombre de la otra persona; tocarlo solo selecciona el
  día, no abre acciones.
- **Desaparece el mercado de guardias** (intercambio y compra). Como `TeamCalendarView` era
  el único punto de creación de esas solicitudes, al borrarlo se elimina de hecho la
  funcionalidad. Se prioriza la simplicidad y la visibilidad ("ver de un vistazo quién tiene
  qué") por encima de la coordinación de swaps/compras.
- **El backend del mercado queda huérfano a propósito, no se borra**: las tablas
  `shift_swap_requests` / `shift_purchase_requests`, las funciones de `shiftService`
  (`createSwapRequest`, `createPurchaseRequest`) y los hooks `useShiftSwapRequests` /
  `useShiftPurchaseRequests` permanecen sin UI que los invoque. No se hace migración
  destructiva; revertir o reubicar el mercado en el futuro no requiere recrear el esquema.

## Alternativas consideradas

- **Mantener las dos pantallas** (Agenda personal + calendario de equipo) y solo añadir los
  eventos compartidos a una de ellas: conserva el mercado de guardias, pero deja dos
  calendarios solapados y obliga al residente a saber en cuál mirar. Descartada por
  complejidad de producto.
- **Conservar el mercado dentro de la Agenda unificada** (tocar una guardia de equipo abre
  swap/compra): técnicamente posible, pero choca con la decisión de que lo ajeno sea
  solo-lectura y reintroduce dos modelos de interacción en el mismo grid. Descartada.
- **Borrar también el backend del mercado** (tablas, servicios, hooks): más limpio a corto
  plazo, pero es una pérdida de datos y de trabajo difícil de revertir si el mercado vuelve.
  Descartada en favor de dejarlo huérfano e intacto.

## Consecuencias

- Un futuro lector encontrará `shift_swap_requests`, `shift_purchase_requests`,
  `shiftService.createSwapRequest/createPurchaseRequest` y los hooks asociados **sin ninguna
  UI que los use**. Es intencional: este ADR es la razón.
- El contador de "solicitudes pendientes" que `AgendaScreen` mostraba ya no recibirá altas
  nuevas. Se retira de la pantalla junto con el resto.
- Las **Guardias de equipo** siguen visibles por proximidad (hospital + especialidad) sin
  necesidad de **Conexión**; los **Eventos compartidos** requieren **Conexión** y compartir
  explícito. Conviven dos reglas de visibilidad distintas en un mismo calendario, asumido
  como aceptable.
- Si el mercado de guardias vuelve, habrá que decidir un nuevo punto de entrada (la antigua
  pantalla ya no existe) pero el esquema de datos seguirá disponible.

## Estado

accepted — 2026-06-07

### 0004-feed-actividad-de-guardia-por-conexion.md

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

### 0005-acceso-social-incluye-r1-en-gracia-mir.md

# El acceso social incluye a los R1 en gracia MIR (sin email corporativo)

ADR-0002 fijó que enviar y recibir **Solicitudes de conexión** exige `getResidentState === ACTIVE`,
usando el email corporativo validado como ancla anti-fraude. Esto dejaba fuera al **R1 recién
registrado en la ventana de gracia MIR** (`resident_state = 'pending_corporate_email_seasonal'`),
que todavía no ha validado su email pero es un residente legítimo en plena temporada MIR. Decidimos
**ampliar el gate de lo social** para incluirlo: un R1 en gracia puede crear **Conexiones**
(solicitar, aceptar, chatear, compartir y aparecer en el **Feed**) como cualquier residente activo.

## Decisión

- Nace el concepto **Residente con acceso social**: `is_resident AND resident_state IN
  ('active', 'pending_corporate_email_seasonal')`. Reemplaza al gate `=== ACTIVE` para **todo lo
  social** (conexiones, chat directo del directorio, **Evento compartido**, **Feed**).
- El gate se aplica **simétricamente** a emisor y destinatario de la **Solicitud de conexión**,
  incluido el auto-accept de solicitudes cruzadas.
- `locked_missing_corporate_email` (gracia expirada sin email) queda **fuera**: ni envía ni recibe.
  Ya está redirigido a su perfil, así que no hace falta revocar nada — sus conexiones previas
  **se conservan** y vuelven a funcionar si revalida y pasa a `active` (freeze, no revoke).
- La **Conexión** sigue siendo **atómica**: el R1 en gracia es participante social pleno, no se
  fabrica una conexión "solo-chat".
- El acceso social **no** se extiende a las reseñas de hospital ni a las rotaciones externas, que
  conservan su propio gate más estricto (siguen exigiendo validación / fin de gracia MIR).

## Consecuencias

- Dos puntos de enforcement cambian: el RPC `is_resident_connection_eligible` (server-side) y el
  `canInteract` del directorio (`screens/ResidentsDirectoryScreen.js`). El resto (sala de chat,
  feed, eventos compartidos) hereda el cambio sin tocarse, porque ya cuelga de la **Conexión**.
- "Residente verificado" deja de gobernar lo social. La validación de email sigue siendo el ancla
  anti-fraude **solo** para reseñas/rotaciones; para lo social se acepta como suficiente que el
  sistema reconozca a la persona como R1 dentro de la ventana MIR.
- Riesgo asumido: alguien que se auto-registre como R1 en gracia puede entrar al grafo social antes
  de cualquier prueba. Se considera aceptable por ser lo social de bajo riesgo y por favorecer el
  onboarding del R1 recién llegado.

## Estado

accepted — 2026-06-08 — modifica la cláusula de gate de [ADR-0002](./0002-chat-directo-requiere-conexion.md)

### 0006-la-app-no-clona-la-plantilla-del-libro.md

# La app no clona la plantilla del Libro

## Status

accepted

## Contexto y decisión

Sembrar el **Libro del Residente** desde la **Plantilla del Libro** estaba
implementado **tres veces**, y las tres divergían:

| | sella `libro_book.template_id` | sella `libro_node.template_node_id` | clona las columnas nuevas |
|---|---|---|---|
| `apply_libro_template_for_user` (trigger de alta) | no | no | sí |
| `switchLibroYearToTemplate` (esta app, en el cliente) | sí | **no** | **no** |
| `sync_libro_template_for_user` | solo mira libros con `template_id` | empareja **por** `template_node_id` | sí |

Eso producía dos fallos concretos. Uno: un residente que migraba desde la app
recibía sus rotaciones **sin duración ni centro** y sus competencias **sin
descripción**, porque el clon del cliente no conocía esas columnas. Dos: llamar a
`sync` sobre un libro migrado desde la app **duplicaba todos sus nodos**, porque
el `UPDATE ... WHERE template_node_id = ...` no encontraba nada y caía al
`INSERT`, y el `DELETE` de bajas exige `template_node_id IS NOT NULL`.

Se decide que **la app no clona**: toda la lógica plantilla→libro vive en
`losresis-db` y la app solo llama. `apply_libro_template_for_user` sella
`template_id` y `template_node_id`, una RPC hace el borrado+siembra de **Migrar a
la plantilla**, un backfill sella lo ya sembrado, y la app llama a
`sync_libro_template_for_user` al abrir el Libro y al tirar para refrescar.

## Considered Options

- **Arreglar el clon del cliente** (añadirle las columnas que faltaban y el
  sellado). Era lo más rápido y no tocaba otro repo, pero deja tres copias de la
  misma lógica en dos repos: el siguiente campo de plantilla se olvidaría en el
  cliente exactamente igual que se olvidaron estos cinco.
- **No sincronizar nunca**: aceptar que un cambio en una plantilla publicada solo
  afecte a residentes futuros. Cero riesgo de duplicar nodos y cero backfill, pero
  el tutor añade una competencia y sus residentes actuales no la ven jamás.

## Consequences

- **El sync se llama al abrir el Libro, no en tiempo real.** La función es
  idempotente, así que no hay nada que coordinar; y nadie mira su libro mientras
  su tutor lo edita. Una suscripción realtime resembraría la estructura bajo los
  dedos de quien está registrando algo.
- **El backfill es barato hoy y no lo será mañana.** Hay 614 nodos sin sellar,
  pero los libros con `template_id` son de **un solo usuario de prueba**. Sellar
  emparejando por nombre y posición es seguro ahora; con hospitales reales dentro
  deja de serlo.
- Cualquier columna nueva de plantilla entra en `apply` **y** en `sync`, y ya no
  hay un tercer sitio donde olvidarla.

### 0007-sin-plantilla-publicada-el-libro-propio-sobrevive.md

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

### 0008-el-progreso-solo-mide-objetivos-del-tutor.md

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

### 0009-el-libro-propio-activo-no-caduca-al-cambiar-de-ano.md

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

### 0010-el-deshacer-del-contador-hereda-la-fecha-del-registro-que-anula.md

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

## ADRs de losresis-panel

### 0001-speciality-scope-enforced-in-ui-only.md

# Alcance por especialidad: enforcement solo en la UI (sin RLS)

## Status

accepted

## Contexto y decisión

Los "responsables de especialidad" solo pueden ver y editar entidades de su
especialidad. Toda la base de datos compartida usa hoy políticas RLS `allow_all`
y la seguridad del panel se basa en la UI + rutas de servidor con service-role.
Para v1 imponemos el alcance por especialidad **solo en la UI/cliente** (filtros
en las consultas, ocultación en el menú y redirecciones en páginas solo-owner),
**no** con RLS real en Postgres.

## Considered Options

- **RLS real** atando `auth.uid() → employer_account → especialidad` en cada
  tabla implicada (libro_template, employer_org_profile_speciality, courses,
  libro_node/entry…). Descartado para v1: es un cambio grande, rompe el patrón
  `allow_all` de todo el sistema y arriesga regresiones en la app móvil que
  comparte la misma base de datos.

## Consequences

- Un responsable con conocimientos técnicos podría saltarse el filtro llamando a
  la API de Supabase directamente. Se asume el riesgo: los datos del panel no son
  datos clínicos de pacientes y el responsable es alguien de confianza del hospital.
- Las mutaciones privilegiadas (crear/desactivar responsables) sí pasan por rutas
  de servidor con service-role, no por el cliente.
- Migrar a RLS real más adelante es posible sin cambiar el modelo de datos.

### 0002-speciality-manager-as-scoped-employer-account.md

# Responsable de especialidad = employer_account con alcance en tabla de enlace

## Status

accepted

## Contexto y decisión

Un responsable de especialidad es una cuenta más de la organización, no una
entidad nueva: se modela como un `employer_account` en la **misma** org que el
owner, con `role = 'speciality_manager'`. Su alcance (qué especialidades gestiona)
se guarda en una tabla de enlace nueva `employer_account_speciality(account_id,
speciality_id)`. Una cuenta **sin** filas en esa tabla (el owner) tiene acceso a
todas las especialidades; una cuenta **con** filas queda restringida a ellas.

## Considered Options

- **Columna `speciality_id` en `employer_account`**: más simple, pero fija el
  alcance a exactamente una especialidad y obliga a migrar el esquema si en el
  futuro un responsable cubre varias.
- **Modelar el responsable fuera de `employer_account`** (tabla propia): duplicaría
  el mecanismo de identidad/login que ya resuelve `employer_account`.

## Consequences

- El resolvedor de cuenta del panel pasa a leer también `role` y las
  especialidades del scope; el "owner" se distingue por `role` y ausencia de scope.
- La tabla de enlace admite >1 especialidad por responsable sin cambios de
  esquema, aunque el formulario v1 asigna exactamente una.

### 0003-libro-template-ai-generation-via-panel-route.md

# Generación de la plantilla del libro con IA vía ruta del panel

## Status

superseded por el
[ADR 0023](0023-el-libro-se-monta-de-un-catalogo-cerrado-de-bloques.md) — el
tutor ya no describe el libro con una frase, lo monta escogiendo tipos de bloque
de un catálogo cerrado. La ruta `/api/libro-template/generate` y el hook
`useLibroTemplateAI` se han eliminado. `MOONSHOT_API_KEY` sigue siendo necesaria
para la búsqueda de seguimiento (ADR 0013).

## Contexto y decisión

Para que un tutor pueda crear la estructura del libro de residente escribiendo
una frase, el panel llama a Kimi (Moonshot, `kimi-k2.5`) desde una **ruta API
propia de Next.js** (`/api/libro-template/generate`) en vez de reutilizar la
edge function compartida `losresis-llm` de `losresis-app`. La ruta manda un
system prompt con nuestra estructura (solo `clinical_practice`, categoría →
actividad y los catálogos de iconos/colores/tracking) y pide **JSON estricto**,
que el servidor valida contra esos catálogos antes de devolver el preview.

## Considered Options

- **Reutilizar/crear una edge function en `losresis-app/supabase/functions`**:
  reaprovecha la `MOONSHOT_API_KEY` ya presente en los secrets de Supabase, pero
  mete un feature del panel en el repo de la app (cross-repo) y obliga a
  desplegar con el CLI de Supabase.

## Consequences

- Hay que configurar `MOONSHOT_API_KEY` (y opcionalmente `MOONSHOT_BASE_URL` /
  `MOONSHOT_MODEL`) en el entorno del panel (Vercel).
- El feature queda autocontenido en el repo del panel, con el mismo patrón de
  rutas server que `/api/team`.
- La salida del modelo nunca se confía: se parsea de forma tolerante y se valida
  campo a campo contra los catálogos, con fallback a defaults y objetivos vacíos.

### 0004-pacientes-pseudonimizados-por-nhc.md

# Los pacientes se identifican solo por NHC, nunca por nombre

## Status

accepted

## Contexto y decisión

La nueva vertical de seguimiento de pacientes guarda información clínica escrita
por el equipo de un servicio. Para no convertir el panel en responsable de datos
de salud **identificables** (categoría especial, art. 9 RGPD), el paciente se
identifica **exclusivamente por su número de historia clínica (NHC)**, que es
obligatorio y validado en el formulario. El nombre y apellidos del paciente
**no se piden, no se guardan y no se muestran** en ningún punto del sistema.

El NHC es re-identificable únicamente por el hospital contra su propio HIS: eso
es exactamente la definición de pseudonimización del art. 4.5 RGPD.

## Considered Options

- **Nombre y apellidos del paciente** (lo pedido inicialmente): obligaría a
  tratar el panel como encargado del tratamiento de datos de salud
  identificables, con RLS real, registro de accesos, retención y un DPA firmado
  con cada hospital antes de la primera nota. Descartado por riesgo de privacidad.
- **Etiqueta libre pseudónima** ("cama 12", "402", iniciales): sin fricción, pero
  sin identificador estable. Los pacientes cambian de cama y las iniciales no son
  únicas, así que dos notas del mismo paciente en dos guardias distintas no se
  pueden vincular — y el problema que resuelve la vertical ("el médico rota y el
  paciente que necesita control se pierde") requiere precisamente esa vinculación.
- **NHC opcional más etiqueta libre**: deja media base con identificador estable
  y media sin, y toda la lógica de agrupado se vuelve condicional e informal.

## Consequences

- Un médico que hace el pase sin el HIS delante no tiene el NHC a mano. Se
  resuelve con borradores que exigen NHC antes de publicarse, **no** relajando
  el campo.
- La búsqueda en lenguaje natural sigue siendo posible sin el nombre del
  paciente: se apoya en sexo, edad, fecha, médico que lo atendió (que sí es un
  usuario de LosResis) y diagnóstico.
- La pseudonimización solo es real si el **texto libre** también la respeta. Ver
  ADR sobre el diseño del campo libre.
- Esta vertical invalida la premisa de ADR 0001 ("los datos del panel no son
  datos clínicos de pacientes"), aunque sean pseudonimizados. El modelo de acceso
  de esta vertical se decide aparte y no hereda el `allow_all` del resto.

### 0005-nota-estructurada-y-detector-no-bloqueante.md

# La nota es estructurada y el detector de nombres avisa, no bloquea

## Status

accepted

## Contexto y decisión

La pseudonimización de ADR 0004 solo se sostiene si el texto libre también la
respeta. En vez de confiar en un aviso legal, la nota se **estructura** para que
escribir el nombre del paciente deje de ser útil:

- `nhc` (obligatorio) — único identificador del paciente
- `sexo`
- `edad` en años (no fecha de nacimiento: identifica menos y clínicamente basta)
- `ubicación` — cama / box / consulta, mutable
- `médico que atendió` — referencia a `public.users`, nunca texto libre
- `motivo o diagnóstico`
- `texto libre` — acotado a "qué hay que controlar"

**Corregido por ADR 0011:** todos esos campos salvo el autor y el texto pertenecen al
**caso**, no a la nota, y se rellenan **una vez por paciente**. Añadir una nota a las
03:00 es elegir el caso, quién lo vio y escribir. La estructura sigue siendo la razón
por la que el nombre del paciente deja de hacer falta; solo cambia dónde vive.

Encima de eso, un **detector no bloqueante**: al guardar se buscan nombres de
pila españoles, patrón `Nombre Apellido`, DNI, teléfonos y fechas de nacimiento.
Si salta, se avisa y se ofrece corregir, con botón de **guardar igualmente**. El
detector corre también en servidor, no solo en cliente — mismo patrón de defensa
en profundidad que `ensure_direct_group` con el `work_email`.

## Considered Options

- **Solo aviso legal / placeholder**: coste cero y eficacia cero a medio plazo.
- **Detector bloqueante**: un médico bloqueado a las 03:00 no corrige el texto,
  lo escribe en el WhatsApp del servicio. Se pierde el dato *y* la privacidad,
  que es el peor resultado posible. Preferimos el dato dentro del sistema:
  avisado, auditable y purgable.
- **Censura automática del fragmento detectado**: destruye significado clínico
  (tachar "de Paget" en "enfermedad de Paget") y da falsa sensación de limpieza.

## Consequences

- La nota tiene más campos de los que pedía el planteamiento inicial (dos: nombre
  y texto libre). Se acepta ese coste de fricción porque los campos son lo que
  hace innecesario el nombre: quien escribe un nombre lo hace para desambiguar, y
  con NHC + sexo + edad + ubicación ya no hay nada que desambiguar.
- Los campos estructurados **reducen lo que sale del edificio**: la búsqueda
  filtra por sexo, fecha y médico en Postgres, y solo la parte difusa necesita
  modelo. Sin campos, entender "mujer" obligaría a mandar el texto clínico
  completo a un proveedor externo.
- El detector tendrá falsos positivos: apellidos españoles que son palabras
  comunes (`Mora`, `León`, `Prieto`, `Iglesias`). Por eso avisa y nunca bloquea.

### 0006-autoria-declarada-por-selector.md

# La autoría de una nota se declara con un selector, no se deduce de la sesión

## Status

accepted

## Contexto y decisión

En un servicio hospitalario los médicos rotan y comparten puestos de trabajo. En
vez de exigir un login individual por médico, la nota registra **dos** autorías:

- **Autor declarado** — elegido en un selector al crear la nota. Es lo que se
  muestra y por lo que se busca. Sale de `public.users` filtrado por
  `hospital_id` + `speciality_id` del servicio.
- **Creado por** — la cuenta autenticada que ejecutó la petición. No se muestra;
  existe solo para auditoría, para poder responder "¿quién escribió realmente
  esta nota?" cuando el selector diga una persona y la sesión fuera otra.

El acceso al apartado queda restringido a las cuentas que el owner crea en el
apartado de equipo (`employer_account` con alcance de especialidad). **No hay
autoalta**: un usuario de la app móvil no entra al panel por su cuenta, ni siquiera
si su hospital y especialidad coinciden. Si el owner quiere que alguien entre, le
crea la cuenta. Esto no fue un olvido — no lo "arregles" pensando que lo fue.

Ver ADR 0009: la cuenta se crea contra el **email corporativo** del médico, y si
ese email ya tiene identidad en LosResis se reutiliza en lugar de duplicarla.

## Considered Options

- **Autoría = usuario autenticado.** Lo obvio, y verificable de verdad. Exigiría
  que el owner creara y distribuyera un login por médico (~14 en un servicio
  mediano), y aun así la autoría sería del login administrativo sintético
  (`nombre@losresis.<dominio>`), no de la persona.
- **Plantilla del servicio propia** (tabla de miembros con nombre, tipo y
  `user_id` nullable) como origen del selector. Descartada por no añadir tabla:
  el coste es que los adjuntos que nunca se descargaron la app no aparecerán en
  el selector hasta que el owner les cree cuenta.

## Consequences

- El autor declarado **no está verificado**: cualquiera con acceso al servicio
  puede atribuir una nota a un colega. Se acepta porque replica cómo funciona el
  parte de guardia en papel, y porque `creado por` deja rastro.
- `POST /api/team/managers` además **rellena `public.users`** (`name`, `surname`,
  `hospital_id`, `speciality_id`, `is_doctor = true`) para que la cuenta creada por
  el owner aparezca en el selector. El trigger `on_auth_user_created` deja la fila
  hueca con `hospital_id` y `speciality_id` en NULL. No hay endpoint para cambiar
  la especialidad de una cuenta —se borra y se vuelve a dar de alta—, así que no
  hace falta sincronizar nada después; si algún día se añade, tendrá que mantener
  `public.users.speciality_id` al día o el selector empezará a mentir.
- **Invariante entre repos:** escribir `hospital_id` + `speciality_id` en
  `public.users` mete estas cuentas en la población que consulta la app móvil.
  El directorio de residentes las excluye solo por `is_resident = false`
  (`losresis-app/services/communityService.js`), porque el trigger deja
  `work_email = ''` y el filtro `work_email IS NOT NULL` no lo descarta. Por
  tanto: nunca `is_resident = true` en cuentas creadas por el panel, y
  `work_email = NULL` explícito en lugar de cadena vacía.

### 0007-pase-es-una-vista-no-una-carpeta.md

# El Pase es una vista sobre las notas, no una carpeta

## Status

accepted

## Contexto y decisión

El apartado nace con un juego de carpetas por defecto, pero el "pase" no es una
carpeta: nadie mete notas en él, sino que **muestra las notas que se documentaron
en la jornada anterior**, que es una consulta por fecha. Por tanto:

- Las carpetas por defecto se **siembran como filas normales** la primera vez que
  se entra al servicio, y el servicio puede renombrarlas, borrarlas o crear otras.
- El **Pase** es una **vista**: aparece siempre, no se puede borrar ni renombrar,
  y no contiene nada — las notas que lista siguen viviendo en su carpeta.

## Considered Options

- **Cinco carpetas de sistema fijas** (sin crear/renombrar/borrar): consistente
  entre servicios, pero ningún servicio se organiza como otro — Traumatología no
  quiere "pase", quiere "quirófano de mañana".
- **Pase como carpeta normal**: obliga a elegir entre duplicar la nota (está en
  `urgencias` y en `pase`, se edita una y la otra miente) o sacarla de su carpeta
  real, donde su equipo la busca.
- **Cinco filas sembradas y libertad total, sin vistas**: alguien renombra "pase"
  a "Pases 2026" o la borra, y la lógica automática se rompe en silencio.

## Consequences

- El mismo mecanismo de vistas sirve para "mis notas", "críticos de esta semana" o
  "todo lo de la Dra. García" sin tocar el modelo de carpetas.
- Una nota vive en **una sola** carpeta, así que un paciente crítico que entró por
  urgencias no puede estar a la vez en `urgencias` y en `críticos`. Ese conflicto
  se resuelve en el ADR siguiente, no relajando la exclusividad de la carpeta.

### 0008-recordatorio-como-entidad-con-arrastre-y-archivado.md

# El Recordatorio es una entidad propia, se arrastra al vencer y se archiva solo

## Status

accepted

## Contexto y decisión

Los recordatorios tienen pantalla propia, compartida por todo el servicio: todo el
mundo los ve y cualquiera puede crearlos, con o sin paciente. Su propósito es que
a primera hora el equipo vea de un vistazo lo que hay pendiente.

Por eso el Recordatorio es una **tabla propia con `nota_id` nullable**, no un campo
de la nota: marcar seguimiento en una nota *crea* un recordatorio vinculado, y un
recordatorio suelto simplemente no tiene nota. Una sola tabla, un solo ciclo de
vida, y "marcar como hecho" significa lo mismo en los dos casos.

Ciclo de vida:

- Se **cierra a mano**, registrando quién y cuándo.
- Lo que no se cierra **se arrastra** al día siguiente marcado como vencido. La
  lista de primera hora es *vencidos + hoy*.
- Lo vencido hace más de ~7 días pasa a **archivados**: sigue existiendo y siendo
  buscable, pero sale de la lista principal.

El **destinatario es opcional**: sin asignar significa "de quien esté de turno" —
el caso mayoritario en un equipo que rota— y asignado significa "de esta persona
en concreto". Un destinatario obligatorio sería activamente erróneo aquí: asignar
algo a quien no trabaja el jueves reproduce el problema que la vertical resuelve.

## Considered Options

- **Campo `seguimiento_pendiente` en la nota más tabla de recordatorios sueltos**:
  dos verdades sobre si algo está pendiente, desincronizadas en una semana.
- **Sin cierre, solo fecha** (el recordatorio desaparece al pasar el día): cero
  fricción, pero lo que no se hizo ayer se evapora sin que nadie se entere — que
  es exactamente el fallo que la vertical viene a resolver.
- **Cierre con arrastre sin archivado**: a los tres meses la lista tiene 200
  vencidos y deja de mirarse, que es como muere todo tablón compartido.

## Consequences

- El archivado **no necesita cron ni proceso en background**: es una condición en
  la consulta más una pestaña de archivados.
- Archivado **no es borrado**: se puede seguir respondiendo "esto estuvo pendiente
  tres semanas y nadie lo hizo".
- El destinatario, igual que el autor declarado, es una **etiqueta sin verificar**:
  cualquiera del servicio puede cerrar cualquier recordatorio. "Asignado a la Dra.
  García" es una indicación social, no un permiso — y debe seguir siéndolo, porque
  si solo el destinatario pudiera cerrarlo, unas vacaciones bloquearían la lista.
- Exige un gesto activo (marcar hecho) a gente con prisa. Se compensa con cerrar
  en un clic desde la lista, sin abrir la nota, y con el vencido muy visible: la
  presión de ver "vencido hace 6 días" es lo que hace que alguien lo cierre.

### 0009-login-con-email-corporativo-verificado.md

# Las cuentas del panel se crean contra el email corporativo del hospital, verificado

## Status

accepted

Sustituye el login sintético descrito en `src/lib/managerLogin.ts`.

La **entrega de credenciales por invitación de email** que describe este ADR
fue sustituida por la contraseña provisional del ADR 0020. La verificación de
dominio, la reutilización de identidad y el resto siguen vigentes.

## Contexto y decisión

Hasta ahora el owner creaba miembros con un login **sintético** no entregable
(`laia@losresis.saludcastillayleon.es`, subdominio que LosResis no controla) más
una contraseña temporal que había que hacer llegar por fuera del sistema, con
`email_confirm: true` para saltarse la verificación.

A partir de ahora la cuenta se crea contra el **email corporativo real** del
médico, que debe pertenecer al dominio de su hospital, y se **verifica por
invitación**: el owner introduce la dirección, Supabase envía la invitación a ese
buzón y el médico establece su propia contraseña. No se crea ninguna credencial
que el owner conozca.

La comprobación de dominio reutiliza el parser que ya existe en
`src/lib/managerLogin.ts` (`domainCandidates` / `firstValidDomain`), que maneja los
tres formatos reales de `hospitals.email_domain`: array, JSON en texto y texto
plano con separadores. Deja de usarse para **fabricar** un subdominio y pasa a
usarse para **comprobar pertenencia**.

Si el email corporativo **ya tiene identidad** en LosResis, se **reutiliza** su
`user_id` y solo se crea el `employer_account` + su alcance. No se duplica la
persona. Esto no contradice la ausencia de autoalta de ADR 0006: sigue siendo el
owner quien decide, escribiendo deliberadamente una dirección cuyo buzón controla
esa persona.

## Hospitales sin dominio en el catálogo

`hospitals.email_domain` falta o viene sucio con frecuencia — de ahí que
`managerLogin.ts` tenga un parser de tres formatos y un fallback determinista.
Cuando no hay dominio utilizable, **se le pide al owner que declare el de su
hospital** la primera vez que va a crear una cuenta, y se guarda en una columna
**propia del panel** (`employer_org`). La verificación acepta el dominio del
catálogo **o** el declarado por el owner, y admite varios dominios legítimos
(los servicios públicos regionales suelen tener más de uno).

Ese dominio declarado **no se escribe en `hospitals.email_domain`**: es catálogo
compartido y es lo que usa la app móvil para verificar el correo corporativo de
los residentes. Un owner con prisa que escriba ahí una errata cambiaría las
reglas de verificación de todos los residentes de su hospital en la app, desde
otro repo y sin que nadie se enterara. Arreglar el catálogo es una tarea de datos
aparte y deliberada.

Se asume que el dominio declarado es confianza en una persona, no una
verificación técnica: un owner podría declarar un dominio que controle. No es un
poder nuevo — el owner ya puede crear cuentas a discreción.

## Considered Options

- **Login sintético + contraseña temporal** (lo que había): no requiere que el
  hospital tenga dominio en el catálogo, pero la credencial viaja por WhatsApp, la
  conoce el owner, y la cuenta **no puede recibir ningún aviso** — ni email (buzón
  inexistente) ni push (vive en la app móvil, donde estas cuentas no existen).
- **Cualquier email con verificación de buzón**, sin comprobar dominio: entra el
  Gmail personal y se pierde la garantía de "esta persona trabaja en el hospital".

## Consequences

- El email corporativo verificado se convierte en la señal de pertenencia al
  hospital, en línea con cómo ya lo trata el resto del sistema
  (`20260525150000_direct_chat_require_work_email.sql`,
  `20260409180000_resident_seasonal_corporate_email_grace.sql`).
- Se abre el canal de aviso: los recordatorios pueden notificarse por email a un
  buzón que la persona lee de verdad. El contador en el menú deja de ser el único
  medio.
- Un hospital **sin** `email_domain` utilizable en el catálogo no puede crear
  cuentas hasta que se resuelva ese dato — el fallback de subdominio ficticio que
  existía ya no aplica.
- El médico usa una única identidad LosResis para app y panel cuando su cuenta de
  la app está registrada con el corporativo.

### 0010-ventana-del-pase-de-ocho-a-ocho.md

# La ventana del pase va de las 08:00 de ayer a las 08:00 de hoy

## Status

accepted

## Contexto y decisión

El pase es una **reunión diaria a las 08:00**, todos los días del año, donde el
equipo expone los casos documentados desde el pase anterior. La vista del Pase
(ADR 0007) usa por tanto la ventana **ayer 08:00 → hoy 08:00**, y ofrece un
control para ampliar a los **3 últimos pases**, agrupados por jornada en la misma
pantalla ("Pase de hoy" / "Pase de ayer" / "Pase del sábado").

La hora de corte es una **constante 08:00**, no una pantalla de ajustes.

## Considered Options

- **Día natural anterior** (00:00–23:59 de ayer), que era el planteamiento inicial:
  un adjunto de guardia que documenta a las 03:00 escribe notas fechadas **hoy**,
  así que el pase de las 08:15 **se come justo las notas de la noche**. Es el peor
  fallo posible en una herramienta de traspaso.
- **Ventana móvil de 24 h desde ahora**: no pierde nada, pero quien abre el pase a
  las 08:00 y quien lo abre a las 11:00 ven listas distintas, y una nota se cae de
  la lista en mitad de la reunión.
- **Cursor de "pase cerrado"** (mostrar todo desde la última vez que alguien lo
  cerró): resolvía el hueco del fin de semana sin configuración, pero exige un
  gesto nuevo. Como hay pase **todos los días**, ese hueco no existe y el gesto
  sobra.
- **Calendario de festivos por comunidad autónoma** para los días sin pase:
  descartado a favor de "ver los 3 últimos pases". Los festivos cambian por
  comunidad y por año; la navegación resuelve el caso sin mantener ese dato.

## Consequences

- Las notas escritas de madrugada durante una guardia caen en la ventana correcta.
- La lista es estable durante toda la reunión: es una comparación de fechas, sin
  cron ni proceso en background.
- Hay **una sola ventana por servicio**. Si un servicio hace dos pases al día
  (planta y urgencias por separado, o pase de tarde), este modelo es incorrecto y
  habría que dividir la ventana por carpeta o subgrupo. No se cubre en v1.

### 0011-el-caso-es-la-entidad-no-la-nota.md

# El Caso es la entidad; la nota es un apunte dentro de él

## Status

accepted

## Contexto y decisión

El pase es una reunión donde se exponen **casos**, no notas: si ayer escribieron
sobre la misma paciente el de urgencias, el de guardia y el adjunto de planta, eso
es un caso con tres apuntes. Por tanto el **Caso** es una entidad propia
—`caso(hospital, especialidad, nhc, sexo, edad, ubicación, motivo, estado)`— y las
notas cuelgan de él, quedándose con lo único que es realmente del apunte: **autor
declarado y texto**.

Eso mueve la fricción a donde no molesta: los campos estructurados se rellenan **una
vez por paciente**, al abrir el caso. Añadir una nota a las 03:00 durante una guardia
es elegir el caso, quién lo vio y escribir.

La clave es `(hospital, especialidad, NHC)`, no el NHC solo: **la misma persona
seguida por Digestivo y por Oncología del mismo hospital son dos casos
independientes que no se ven entre sí**. Compartirlos sería una decisión nueva y
consciente, no un efecto secundario del esquema.

El **estado** (`crítico` entre otros) pertenece al caso, no a la nota. Esto corrige
la decisión previa de modelarlo como marca de la nota: un "crítico" anotado el
martes seguiría marcando al paciente el viernes, y la vista de críticos acumularía
gente ya estable. Como estado del caso es mutable y refleja la situación de ahora.

En consecuencia:

- La **carpeta** describe **dónde/cuándo** pasó algo → propiedad de la nota.
- El **estado** describe **cómo está** el paciente → propiedad del caso.
- `Críticos` y `Recordatorios` no son carpetas, son **vistas** (ADR 0007).

## Considered Options

- **Solo notas, sin caso**: cero modelo nuevo, pero en la reunión el mismo paciente
  sale tres veces y quien lo expone reconstruye la situación de memoria.
- **Agrupar por NHC solo en la consulta**, sin entidad: resuelve la reunión sin
  tablas nuevas, pero sexo y edad se reescriben en cada nota y se contradicen
  (mismo NHC, "mujer 58" el martes y "mujer 68" el jueves) sin un sitio donde
  corregirlo.

## Consequences

- Aparece un ciclo de vida que antes no existía: hay que decidir cuándo un caso
  deja de estar en seguimiento (alta manual, archivado por inactividad, o la lista
  crece indefinidamente).
- Una cronología completa por NHC es **más sensible** que las mismas notas
  dispersas. No cambia la pseudonimización de ADR 0004, pero refuerza que estas
  tablas necesiten un modelo de acceso propio en vez del `allow_all` que usa el
  resto de la base compartida (ADR 0001).
- Los recordatorios vinculados apuntan al **caso**, no a una nota concreta: los
  apuntes se acumulan y el pendiente es del paciente.

### 0012-notas-editables-con-historial-de-versiones.md

# Las notas se editan libremente, pero cada versión queda registrada

## Status

accepted

## Contexto y decisión

Una nota es una afirmación que alguien hizo en un momento dado, y el equipo toma
decisiones a partir de ella en el pase de las 08:00. Aun así, se permite **editarla
libremente** —cualquier miembro del servicio, sin ventana de tiempo— porque en un
equipo que rota el autor puede no estar disponible para corregir su propio apunte.

La contrapartida es que **cada edición guarda versión**: qué cambió, quién y cuándo.
Borrar es **retirar con motivo**, y la retirada se ve; no se destruye contenido.

Decisiones que se derivan y no se preguntan:

- Una nota editada **después** de haber aparecido en un pase se marca visiblemente
  como editada, con la fecha. Sin eso, el equipo puede haber actuado sobre un texto
  que ya no existe y nadie lo notaría.
- Corregir el NHC de una nota es **mover la nota a otro caso**: una acción propia y
  registrada, no un cambio de campo cualquiera, porque contamina la cronología de
  dos casos a la vez.

## Considered Options

- **Edición y borrado libres sin rastro**: alguien reescribe o borra lo que escribió
  otro y nadie lo sabe. El equipo actuó sobre información que ahora "nunca existió".
- **Editable hasta el pase, inmutable después** (corrección = nota nueva): se apoya
  en un evento que ya existe y se explica en una frase, pero congela erratas
  descubiertas tarde y obliga a que toda corrección sea un apunte más.
- **Append-only puro**: máxima integridad, y una errata acompaña al caso para
  siempre.

## Consequences

- Hace falta almacenamiento de versiones desde el día uno (tabla de versiones o
  historial por trigger). No es opcional: es lo que compensa la edición libre.
- El historial es el registro de acceso de escritura del sistema. Para lectura no
  hay equivalente todavía; si algún día se exige auditoría de lecturas, es trabajo
  aparte.

### 0013-la-busqueda-manda-la-pregunta-no-las-notas.md

# La búsqueda manda a Kimi la pregunta, nunca las notas

## Status

accepted

## Contexto y decisión

La búsqueda en lenguaje natural ("mujer que visitó ayer la médico Laia García que
tenía una neo de mama") se resuelve **sin que salga del sistema ningún dato de
paciente**. A Moonshot solo se le manda **la pregunta que escribe el médico**.

El modelo devuelve JSON estricto con dos cosas:

- **filtros** exactos (`sexo`, ventana de fechas, autor declarado, estado, carpeta)
- **términos de búsqueda expandidos con vocabulario médico**
  (`neo de mama` → `neoplasia mama, carcinoma mama, CA mama, CDI, cáncer de mama`)

Postgres hace la búsqueda con full-text en español más esos filtros. Mismo patrón
que ADR 0003: ruta propia del panel, `MOONSHOT_API_KEY` ya presente en el entorno,
y salida del modelo validada campo a campo antes de fiarse de ella.

## Considered Options

- **RAG completo** (embeddings de todas las notas, recuperar las k más parecidas y
  mandárselas a Kimi para que redacte): mejor experiencia conversacional, pero cada
  consulta envía texto clínico a Moonshot. **Pseudonimizado no es anonimizado**: para
  el RGPD sigue siendo dato de salud de categoría especial, y el envío es una
  transferencia internacional a China sin decisión de adecuación. Eso acaba en la
  mesa del DPD del hospital justo cuando se intenta cerrar la venta. Además obliga a
  re-embeddear cada nota en cada edición.
- **Híbrido con embeddings locales**: nada sale y recupera casi la calidad del RAG,
  a cambio de montar y mantener un modelo de embeddings propio. Es la siguiente
  parada si la v1 se queda corta, no la v1.
- **RAG con desidentificación previa**: reduce el riesgo sin eliminarlo y añade una
  capa de sanitización que hay que auditar, con los falsos negativos que ya tiene el
  detector de ADR 0005.

## Consequences

- A la pregunta "¿qué le mandáis a la IA?" se responde "la pregunta que escribe el
  médico". Es el argumento de venta ante un DPD, no solo una decisión técnica.
- El full-text encuentra lo que se escribió, no lo que se quiso decir. La expansión
  de sinónimos cubre "CDI de mama" cuando buscas "neo de mama", pero **no** cubre
  "lesión sospechosa en cuadrante superior externo". Hay que **medir el porcentaje
  de búsquedas sin resultado**: si es alto, se pasa a embeddings locales.
- La respuesta es una **lista de casos**, no un párrafo redactado. Es lo correcto
  para "encuéntrame el paciente"; no sirve para "resúmeme la semana", que quedaría
  fuera de alcance mientras no salga texto del sistema.
- Coste por consulta: una llamada pequeña al modelo. Sin coste de indexación.

### 0014-rls-real-en-las-tablas-clinicas.md

# RLS real en las tablas clínicas, y el acceso clínico depende del alcance, no del rol

## Status

accepted

Desvía deliberadamente de ADR 0001 **solo** para las tablas de esta vertical.

## Contexto y decisión

ADR 0001 aceptó `allow_all` + filtros en la UI con dos justificaciones. Ninguna
sobrevive aquí: *"los datos del panel no son datos clínicos de pacientes"* ya no es
cierto, y *"arriesga regresiones en la app móvil"* no aplica a tablas **nuevas** que
la app no toca.

Y el riesgo real es mayor de lo que ADR 0001 describe. Las políticas existentes son
`USING (true) WITH CHECK (true)` **sin cláusula `TO`**, es decir `TO PUBLIC`, que
incluye el rol `anon`. Como la anon key viaja en el bundle del panel y de la app
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`), en una tabla `allow_all` **no hace falta ni
autenticarse**. Aplicado a notas clínicas: cualquiera en internet podría leerlas,
modificarlas y borrarlas.

Por tanto las tablas de esta vertical (`caso`, `nota`, versiones, `recordatorio`,
carpetas) llevan **RLS real**, y el cliente sigue consultándolas directamente como
en el resto del panel.

La regla de acceso es una sola frase: **ves los casos de las especialidades que
tienes asignadas**. El acceso clínico **no deriva del rol**: un owner sin especialidad
asignada administra (crea cuentas, ve uso, factura, configura) pero **no ve contenido
clínico**. Si el owner es además jefe de servicio, se asigna su especialidad y entra
como cualquier otro — y queda constancia de que se la asignó.

```sql
create policy caso_scope on public.caso for all to authenticated using (
  exists (
    select 1
    from public.employer_account ea
    join public.employer_account_speciality eas on eas.account_id = ea.id
    join public.employer_org eo on eo.id = ea.org_id
    where ea.user_id = auth.uid()
      and ea.is_active
      and eo.hospital_id = caso.hospital_id
      and eas.speciality_id = caso.speciality_id
  )
);
```

Las tablas hijas se cuelgan de ésa con un `exists` sobre `caso`.

## Considered Options

- **`allow_all` + filtros en la UI**, como el resto: además del agujero descrito,
  obliga a repetir el filtro de especialidad en cada hook y a acertar siempre. La
  opción con RLS es probablemente **menos** código, porque el filtro se escribe una
  vez en SQL.
- **Tablas inalcanzables desde el cliente y todo por rutas con service-role**:
  enforcement en un solo sitio, pero más código (las lecturas dejan de ser hooks) y
  un patrón distinto al del resto del panel.
- **Rutas de servidor *más* RLS**: suena a defensa en profundidad y no lo es —
  **service-role se salta el RLS**, así que con rutas service-role las políticas no
  se evalúan nunca. Solo aporta si las rutas reenvían el token del usuario.
- **Owner con acceso total** (patrón actual del panel) o **acceso total con registro
  de lecturas**: descartados. El owner suele ser RRHH o comunicación, y "el
  administrador de facturación puede leer las historias clínicas" no encaja con
  haber aceptado las obligaciones de tratar datos de salud.

## Consequences

- Rompe la expectativa existente de que "el owner lo ve todo". La UI debe explicarlo
  cuando un owner sin especialidad abre el apartado.
- Si el único miembro con cuenta de un servicio deja el hospital, el owner no puede
  recuperar el contenido sin asignarse antes esa especialidad — lo cual es correcto,
  porque deja rastro.
- Estas tablas quedan con un modelo de acceso distinto al del resto de la base. Hay
  que documentarlo en `SHARED_CONTEXT.md` para que nadie las "normalice" a
  `allow_all` al crear la siguiente migración.

### 0015-ciclo-de-vida-del-caso.md

# El caso se cierra a mano y se archiva solo por inactividad

## Status

accepted

## Contexto y decisión

Un caso deja la vista activa de dos formas: alguien le da **el alta a mano** (el
paciente se va de alta de verdad), o se **archiva solo** tras ~30 días sin notas
nuevas. Mismo patrón que los recordatorios (ADR 0008): cierre explícito más una
válvula automática para que la lista no se convierta en un cementerio.

Dos reglas hacen que el archivado sea inofensivo:

- **Archivado no es borrado ni exclusión.** El caso archivado sigue apareciendo en
  la búsqueda y **una nota nueva lo reactiva** automáticamente. Por eso el plazo
  puede ser agresivo: archivar no pierde nada, solo limpia la vista.
- **Un caso `crítico` no se archiva solo.** 30 días crítico sin una nota no es
  inactividad: es un error o un paciente que se fue sin cerrar. Se muestra destacado
  como "crítico sin novedades desde hace 34 días" — eso es información, no ruido.
  Archivarlo en silencio sería justo el fallo que la vertical viene a evitar.

## Considered Options

- **Sin ciclo de vida**: la carpeta "críticos" acumula 400 casos en dos años y deja
  de abrirse.
- **Solo alta manual**: fiel a la clínica, pero si nadie cierra, crece igual.
- **Solo archivado por inactividad**: se autolimpia sin pedir nada, pero un paciente
  con revisión a los tres meses desaparece de la vista sin que nadie lo decida.

## Consequences

- El plazo de 30 días es una constante elegida sin datos. Para Urgencias sobra; para
  Oncología, con revisiones trimestrales, es corto — mitigado porque la nota de la
  revisión reactiva el caso.

### 0016-retencion-ligada-a-la-suscripcion-con-exportacion.md

# La retención va ligada a la suscripción y la exportación es autoservicio

## Status

accepted

## Contexto y decisión

Archivar un caso no lo borra (ADR 0015), así que el dato clínico necesita un final:

- Mientras la suscripción está **activa**, se conserva.
- Al **darse de baja**: ventana de **60 días** para exportar, con avisos, y después
  **borrado definitivo automático**.
- Purga de casos archivados con más de N años, aunque la suscripción siga activa.

Lo esencial no es el plazo, es que **la exportación sea autoservicio**: el servicio
se descarga sus casos sin pedir nada a nadie. Esto es comercial antes que ético —
ningún hospital adopta una herramienta clínica de la que no puede salir, y en la
primera reunión el jefe de servicio va a preguntar cómo recupera lo escrito. "Un
botón de exportar" cierra la objeción; "escríbenos un correo" convierte a LosResis
en quien retiene sus datos.

## Considered Options

- **Conservación indefinida**: contradice la limitación del plazo de conservación
  (art. 5.1.e RGPD) y deja a LosResis custodiando datos de salud de un cliente con
  el que ya no tiene relación.
- **Borrado automático a los N años desde la última nota**, sin más: cumple sin
  discusión y destruye información que el servicio podría necesitar sin preguntarle.
- **Anonimizar en lugar de borrar** (quitar el NHC y conservar el texto): suena
  elegante y no lo es. Una cronología clínica con fechas, médico que atendió y
  diagnóstico **se reidentifica sin esfuerzo** desde dentro del propio servicio.
  Sirve para estadística agregada, no como sustituto del borrado, y venderlo
  internamente como "ya no son datos personales" sería autoengaño.

## Consequences

- El borrado a los 60 días de la baja es **irreversible**, y alguien cancelará sin
  querer (una tarjeta caducada). Por tanto una baja con datos clínicos **no puede
  ocurrir en silencio**: avisos insistentes y confirmación explícita. Es más trabajo
  de lo que parece y no se puede dejar para después.
- La exportación tiene que existir en la v1, no en la v2.

### 0017-sin-interruptor-de-activacion-por-servicio.md

# El apartado no lleva interruptor: se activa al entrar

## Status

accepted

## Contexto y decisión

El apartado es visible para **cualquier cuenta con alcance de especialidad**, sin
feature flag ni activación previa. La fila de `servicio` —que hace falta de todos
modos para sembrar las carpetas por defecto y guardar el cursor del pase— se crea
**perezosamente la primera vez que alguien entra**.

## Considered Options

- **Flag por servicio** (existir en `servicio` = estar activado, creado por super
  admin durante el piloto y por el owner cuando haya plan): mismo concepto sirviendo
  de interruptor y de unidad de facturación, y permite hablar con cada hospital antes
  de que aparezca un sitio donde escribir datos de pacientes.
- **`user_feature_access` / `can_use_feature`**: ya existe y se usa para
  `clinical_assistant_chat`, pero es **por usuario**, y un flag por usuario en una
  herramienta de traspaso colectivo produce el peor fallo posible: el equipo cree que
  la información está compartida y no lo está.
- **Allowlist en variable de entorno**: obliga a desplegar para dar de alta a un
  cliente.

## Consequences

- Al desplegar, el apartado aparece para **todas** las cuentas con alcance de
  especialidad de todos los hospitales que ya usan el panel. No hay palanca por
  hospital: la única es no desplegar.
- Por lo mismo, **el estado vacío es la pantalla más importante del producto**: para
  la mayoría de cuentas será la única que vean. Ahí tienen que estar la explicación
  de qué es esto y la regla de pseudonimización (ADR 0004), porque no habrá
  onboarding ni conversación previa donde contarlo.
- Cuando se retome la facturación, el límite por plan tendrá que aplicarse sobre
  servicios que **ya existen** creados solos, no sobre altas deliberadas.

### 0018-acceso-clinico-por-perfil-no-por-cuenta.md

# El acceso clínico deriva del perfil, no de la Cuenta

## Status

accepted

Extiende el ADR 0014 (RLS real en las tablas clínicas) y el ADR 0009 (login
con email corporativo).

## Contexto y decisión

El panel resolvía todo acceso a través de `employer_account`: sin cuenta no se
pasaba del login. El objetivo nuevo es que un **residente de la app** entre al
panel a ver el Pase y los recordatorios de su servicio — y un residente no
tiene ni tendrá cuenta: la Cuenta significa "gestiona la organización" y eso no
cambia.

La decisión es que el **acceso clínico** (Seguimiento, Pase, Recordatorios) lo
da el **perfil** de `public.users`: `is_resident` o `is_doctor` con
`hospital_id` + `speciality_id` apuntando al Servicio. Las cuentas conservan su
vía actual (especialidades en `employer_account_speciality`). "Miembro del
servicio" es la unión de ambas poblaciones.

Piezas de la decisión:

- El miembro por perfil es **miembro clínico pleno**: lee y escribe lo mismo
  que cualquier otro (notas, cierre de recordatorios). Coherente con que el
  residente ya figura como autor declarado (ADR 0006) y con que el destinatario
  de un recordatorio no es un permiso (ADR 0008). En la práctica el residente
  es quien más documenta.
- El login del panel gana **Google/Apple OAuth**: el residente entra con la
  misma identidad de `auth.users` que ya usa en la app. Email+password sigue
  siendo la vía de las cuentas.
- Nace el **Médico del equipo**: el owner lo invita con su email corporativo
  (mismas comprobaciones de dominio del ADR 0009) y se le crea identidad +
  perfil (`is_doctor = true`, hospital, especialidad, nombre) **sin**
  `employer_account`. El Responsable de especialidad es ese mismo médico más
  una cuenta de gestión: **todo Responsable lleva `is_doctor = true`**.
- El miembro sin cuenta no ve ninguna superficie de gestión: su menú es solo
  clínico (Seguimiento, Pase, Recordatorios) con una home mínima de su
  Servicio. v1 sin libro propio en el panel.
- Las políticas RLS del ADR 0014 se amplían una sola vez: miembro = perfil en
  el servicio **o** especialidad en el alcance de la cuenta activa.

## Considered Options

- **`employer_account` con `role = 'resident'`**: reutiliza toda la maquinaria
  de scope sin tocar RLS, pero rompe el lenguaje (la Cuenta pasaría a
  significar también "empleado que consulta") y obliga a crear y sincronizar
  una cuenta por cada residente de la app, con un dueño poco claro para esa
  sincronización.
- **Vista `/residente` separada del dashboard**: más aislada, pero duplica
  layout, menú y lógica de servicio.
- **Residente de solo lectura**: exige políticas RLS por acción y crea una
  asimetría rara — un médico podría declarar al residente autor de una nota que
  el residente no podría escribir.

## Consequences

- `getAccountScope` deja de ser la única fuente de acceso: aparece un
  resolvedor de pertenencia clínica que también mira `public.users`.
- El menú y la home tienen tres variantes: owner, responsable y miembro
  clínico sin cuenta.
- Un residente sin `hospital_id` o `speciality_id` en su perfil simplemente no
  es miembro de ningún servicio: el panel le muestra el mismo "sin alcance"
  que hoy ve un owner de RRHH.
- La vía por perfil exige además el **email corporativo en regla**:
  `work_email` presente y `resident_state` en `active` (o sin estado — médicos
  del panel y residentes anteriores al flujo estacional). Un residente en
  gracia estacional (`pending_corporate_email_seasonal`) o bloqueado todavía
  no ha demostrado pertenecer al hospital y no entra, ni por UI ni por RLS
  (migración `20260726130000`).

### 0019-una-persona-una-identidad-reconciliacion-por-work-email.md

# Una persona, una identidad: reconciliación por work_email y ciclo de vida según origen

## Status

accepted

Extiende el ADR 0009 (login con email corporativo verificado).

## Contexto y decisión

La reconciliación del ADR 0009 solo miraba el email de `auth.users`
(`buscar_auth_user_por_email`). Pero los residentes entran a la app con
Google/Apple — su email de auth suele ser el **personal** — y su corporativo
vive en `public.users.work_email`. Invitar al corporativo de alguien que ya es
residente creaba una **segunda identidad**: la misma persona dos veces en los
selectores de autor y destinatario del servicio.

La decisión es **una persona, una identidad**:

- La invitación reconcilia también por `public.users.work_email`. Si hay
  match se reutiliza ese `user_id` (la persona seguirá entrando con su
  Google/Apple de siempre), no se envía invitación de contraseña y **no se pisa
  su perfil**.
- Un residente reconciliado **no puede ser Responsable**: la invitación se
  bloquea con un aviso ("es un residente; ya es miembro del servicio"). Los
  roles de la app son excluyentes y el invariante Responsable ⇒ `is_doctor`
  no admite excepciones. Cuando termine la residencia y su perfil pase a
  doctor, podrá serlo.
- El panel pasa a escribir **`work_email` = email corporativo** en los médicos
  que invita (antes escribía `NULL` deliberadamente). Ese email ya está
  verificado contra el dominio del hospital, hace simétrica la reconciliación
  futura y deja el perfil completo para el día en que la app tenga login por
  contraseña. La auditoría (2026-07-26) confirmó que los gates de la app (chat
  directo, directorio, conexiones, `resident_state`) exigen `is_resident = true`
  y no se abren; los dos riesgos reales — el formulario de perfil de la app
  valida `work_email` contra `hospitals.email_domain` sin válvula para doctores,
  y el wizard de onboarding machacaría el perfil del médico — pertenecen a la
  futura tarea del login de médicos en la app y están anotados en
  `docs/SHARED_CONTEXT.md`.
- El **ciclo de vida depende del origen de la identidad**. Creada por el
  panel: como hoy — desactivar = ban, borrar = eliminar cuenta e identidad,
  reset de contraseña disponible. Reconciliada (con vida en la app): quitar
  del equipo solo retira poderes de panel (`employer_account`, `is_doctor`);
  nunca ban ni delete de auth, y sin botón de reset — lo contrario rompería
  el acceso de esa persona a la app móvil sin que el owner lo sepa.

## Considered Options

- **Reconciliar solo por email de auth** (lo que había): más simple, pero
  duplica personas y la fusión posterior de identidades es una migración de
  datos dolorosa.
- **Bloquear la invitación cuando el corporativo coincide con un
  `work_email`**: evita duplicados pero impide dar poderes de panel a nadie
  con vida previa en la app.
- **Mantener `work_email = NULL` en los invitados**: conserva el invariante
  anterior, pero la reconciliación nunca encontraría a los médicos del panel y
  su perfil de app quedaría incompleto.

## Consequences

- `users.work_email` deja de significar "solo lo escribe la app cuando el
  residente lo verifica" y pasa a ser "email corporativo verificado por
  cualquiera de los dos repos". El invariante comentado en
  `src/app/api/team/managers/route.ts` y en `docs/SHARED_CONTEXT.md` se
  reescribe.
- Hace falta poder distinguir el origen de una identidad (provider de auth o
  marca propia) para decidir qué acciones de ciclo de vida se ofrecen.
- Desaparece el caso "persona duplicada en el selector"; a cambio, borrar a un
  médico del equipo ya no garantiza que su identidad desaparezca de LosResis.

### 0020-contrasena-provisional-entregada-por-el-owner.md

# Las identidades nuevas nacen con contraseña provisional entregada por el owner

## Status

accepted

Sustituye la **entrega de credenciales** del ADR 0009 (invitación por email).
La verificación de dominio, la reutilización de identidad y la prohibición del
login sintético de ese ADR siguen vigentes.

## Contexto y decisión

El ADR 0009 entregaba las credenciales por invitación: Supabase enviaba un
email al buzón corporativo y la persona establecía su contraseña. Eso ata el
alta al envío de emails (el SMTP por defecto de Supabase da para 2-4 por hora)
y a que el buzón corporativo funcione a la primera.

A partir de ahora, la identidad nueva (médico del equipo o responsable que no
existía en LosResis) **nace con una contraseña provisional** generada por el
servidor y mostrada **una sola vez** al owner, que la entrega en mano. La
persona la cambia desde el panel («Tu cuenta», `/dashboard/cuenta`) en cuanto
entra. `email_confirm: true`: el buzón no se verifica de momento — la
pertenencia al hospital la sigue garantizando la comprobación de dominio.

- El botón «Enviar enlace de acceso» pasa a ser «Regenerar contraseña»:
  genera otra provisional y la muestra al owner. Solo existe para identidades
  creadas por el panel; una identidad Google/Apple no tiene contraseña que
  regenerar (ADR 0019) y no muestra el botón.
- La contraseña provisional no se guarda en claro en ningún sitio: solo viaja
  en la respuesta del alta o de la regeneración.
- Las identidades reconciliadas no cambian: entran con su Google/Apple.

## Considered Options

- **Invitación por email** (ADR 0009): la credencial nunca pasa por el owner y
  el buzón queda verificado, pero exige SMTP de producción configurado y cada
  alta depende de que el email llegue. Es el estado al que volver cuando la
  verificación de buzón importe.
- **Contraseña elegida por el owner**: más simple aún, pero invita a
  contraseñas débiles o repetidas entre miembros.

## Consequences

- El owner conoce la credencial hasta que la persona la cambia. Es el mismo
  nivel de confianza que ya tiene (crea las cuentas a discreción); el cambio
  de contraseña autoservicio acota la ventana.
- Ningún email es imprescindible en el alta: se puede invitar a todo un
  servicio sin SMTP propio.
- `email_confirm: true` deja el buzón sin verificar: cuando se quiera
  verificar (chat, avisos por email), habrá que añadir un paso de
  verificación, no rehacer el alta.
- El flujo autoservicio de «he olvidado mi contraseña» (`/forgot-password`)
  sigue existiendo y sí depende de email; la regeneración por el owner es la
  alternativa que no.

### 0021-evento-del-servicio-proyectado-como-copias-en-agenda.md

# El Evento del servicio se proyecta como copias en agenda_events

## Status

accepted

## Contexto y decisión

Un Responsable convoca un acto (sesión clínica, curso, reunión) para residentes
de su Servicio y cada convocado debe verlo en la Agenda de la app, con push al
crearse, cambiarse o cancelarse. El Evento del servicio **no** es un
Recordatorio (ADR 0008): no se cierra, no se arrastra, no se archiva y no lleva
NHC — es otra entidad que solo comparte pantalla.

La verdad editable es **una fila** en `evento_servicio` (más la lista nominal en
`evento_servicio_convocado`), y se **proyecta como N copias** en
`agenda_events` con `event_type = 'service'` y el `user_id` de cada convocado,
enlazadas por `evento_servicio_convocado.agenda_event_id`.

Elegimos copias porque la agenda de la app ya lee `agenda_events` por
`user_id`: la copia aparece en el calendario, en "Próximos" y en el cron de
recordatorios de agenda sin tocar una línea de consulta. El coste — propagar
las ediciones a las N copias — se paga una sola vez y en un solo sitio: los
RPCs `SECURITY DEFINER` transaccionales (`crear_evento_servicio`,
`actualizar_evento_servicio`, `cancelar_evento_servicio`), que son la única
puerta de escritura; ni el panel ni la app insertan directamente.

Las copias son de **solo lectura** en la app: si el residente pudiera editarlas
o borrarlas, el responsable creería que los 16 R1 ven "08:30" cuando tres lo
borraron — lo que el responsable convocó debe ser lo que el residente ve. Y la
lista de convocados es **nominal, resuelta al crear**: marcar "R1" expande a
las personas que son R1 en ese momento; "quién estaba convocado" tiene
respuesta fija en el pasado.

## Considered Options

- **Lectura al vuelo desde la app** (una sola fila; RPC nuevo tipo
  `get_service_events_for_me` que se mezcla en el calendario, como los eventos
  compartidos): una sola verdad y editar es un UPDATE, pero obliga a enseñar a
  `AgendaScreen` una cuarta fuente y el evento no existe en `agenda_events`,
  así que todo lo que cuelga de esa tabla (recordatorios por cron, "Próximos")
  no le aplica.
- **Reusar `agenda_event_shares`**: el mecanismo exige
  `are_residents_connected()` — una Conexión aceptada residente↔residente. El
  Responsable no es ninguna de las dos cosas; perforar esa regla es perforar
  justo la que protege el grafo social.
- **Regla viva en vez de lista nominal** ("los que sean R1 el día del
  evento"): un residente nuevo heredaría los eventos futuros solos, pero hay
  que reproyectar copias con cada alta, baja o promoción de año, y "quién
  estaba convocado" deja de tener respuesta.

## Consequences

- La app pinta los eventos del servicio **sin cambios estructurales**: solo el
  tipo nuevo en el catálogo, la ruta al detalle de solo lectura y su etiqueta.
- Editar el evento es un UPDATE en N copias y cancelarlo un DELETE de N copias,
  siempre dentro del RPC: o entra todo o no entra nada, sin copias huérfanas.
- Cancelar **no borra el evento del panel**: marca `cancelado_en` y
  `evento_servicio_convocado.agenda_event_id` queda a NULL (SET NULL, no
  CASCADE) — se puede seguir respondiendo "esto se convocó y se canceló, y a
  quiénes".
- El push viaja gratis: los RPCs insertan en `notifications` y el trigger
  `send_push_notifications` existente hace el resto.
- Un residente que entra en el servicio después de la convocatoria **no ve**
  los eventos anteriores a su llegada; hay que añadirlo a mano editando el
  evento.

### 0022-convocar-nace-del-alcance-no-del-rango.md

# Convocar eventos del servicio nace del alcance, no del rango

## Status

accepted

## Contexto y decisión

El glosario define al Owner con "acceso sin restricción a todas las
especialidades", y hasta ahora el panel no tenía ninguna pantalla donde el
Owner pudiera menos que un Responsable. Los Eventos del servicio rompen esa
regla a propósito: **solo el Responsable de especialidad**
(`role = 'speciality_manager'` con la especialidad del servicio en su alcance)
puede crear, editar y cancelar eventos. El Owner y los médicos sin cuenta ven
la sección, pero no tienen el botón.

La razón: convocar no es administrar. Meter una fila en la agenda de 16
residentes y dispararles un push es un acto de **docencia de la especialidad**
— decidir que los R1 tienen sesión clínica el lunes es del responsable de
Ginecología, no de quien gestiona la organización. "Sin restricción" queda
matizado: significa ver y administrar, no convocar.

La regla se impone en las dos capas: en la UI (el botón solo aparece con
`esResponsable`) y en el servidor (`evento_servicio_cuenta_convocante` dentro
de los RPCs exige el rol y el alcance) — a diferencia del alcance de lectura
del ADR 0001, aquí la escritura toca las agendas personales de terceros y la
UI sola no basta.

## Considered Options

- **Owner también convoca** (la regla general del panel): coherente con el
  glosario, pero da el megáfono de push a un rol que no lleva la docencia de
  ninguna especialidad concreta, y el ruido de push es de las cosas que hacen
  desinstalar una app.
- **Cualquiera del servicio convoca** (el espíritu del tablón de
  recordatorios): quien detecta la necesidad, convoca — pero un Recordatorio
  no sale del panel y esto empuja notificaciones al bolsillo de todo un año de
  residentes.

## Consequences

- Primera pantalla donde el rol más alto puede menos que su subordinado: sin
  este ADR, alguien lo "arreglará" en seis meses devolviéndole el botón al
  Owner.
- Un hospital sin Responsables de una especialidad no puede convocar eventos
  para ella; el Owner tiene que crear la cuenta de Responsable primero.
- Si mañana se decide que el Owner también convoca, el cambio es pequeño y
  localizado: la condición de `evento_servicio_cuenta_convocante` y el
  `esResponsable` de la UI.

### 0023-el-libro-se-monta-de-un-catalogo-cerrado-de-bloques.md

# El libro se monta de un catálogo cerrado de bloques, un juego por año

## Status

accepted

Sustituye al [ADR 0003](0003-libro-template-ai-generation-via-panel-route.md).

## Contexto y decisión

El tutor ya no describe el libro con una frase para que un modelo lo genere: lo
monta **escogiendo tipos de bloque de un catálogo cerrado de once**. El catálogo
se corresponde uno a uno con los valores del enum `public.libro_section_code`, y
"Añadir bloque" abre un selector con los tipos que ese año todavía no tiene. El
tutor no puede inventarse un tipo: el nombre, el icono y el color los fija el
catálogo; lo que sí es suyo son las categorías de dentro y lo que se registra en
cada una.

Tres decisiones que acompañan a esa:

1. **Cada año de residencia tiene su propio juego de bloques.** Antes solo
   `clinical_practice` usaba el año y el resto de secciones iban con
   `residency_year NULL` para cualquier residente. Ahora `residency_year` es
   obligatorio en `libro_template_node` y el filtro por año se aplica a todas
   las secciones. Un libro es "el libro de R3", no "el libro con una parte de
   R3".

2. **El bloque es una fila** (`libro_template_block`), no solo el valor
   `section` de sus categorías. Sin esa tabla, un bloque recién añadido y
   todavía vacío desaparecía al recargar y el orden del rail no tenía dónde
   guardarse.

3. **`participation` es un modo de registro**, no un campo aparte. Un
   procedimiento que se cuenta desglosado por Observó / Ayudó / Realizó lo
   declara en su `tracking_mode`, junto a `counter`, `note` y `checklist`. El
   nivel de participación no es un atributo independiente del tipo: es una forma
   de contar.

## Considered Options

- **Seguir con la generación por IA** (ADR 0003): una frase y el libro salía
  hecho. Pero el tutor no sabía qué iba a obtener hasta verlo, la salida había
  que validarla campo a campo contra los catálogos, y el resultado era un punto
  de partida que igualmente había que repasar entero. Escoger de una lista es
  más lento la primera vez y predecible siempre.
- **Bloques libres, definidos por el tutor** (tabla `libro_block` con nombre,
  icono y color a medida): más flexible, pero obliga a migrar `section` a
  `block_id` en `libro_book` y `libro_node`, a reescribir
  `apply_libro_template_for_user` y a que la app deje de reconocer bloques por
  código. Y un catálogo compartido es lo que permite comparar el libro de un
  hospital con el de otro.
- **Nivel de participación como columna propia**, eligiendo por procedimiento
  qué niveles se piden: más combinaciones que explicar al tutor sin un caso
  claro que las pida.

## Consequences

- Añadir un tipo de bloque exige migración: un valor nuevo en
  `libro_section_code` y una entrada en `LIBRO_BLOCK_CATALOG`. Es el precio
  del catálogo cerrado y es deliberado.
- `MOONSHOT_API_KEY` sigue siendo necesaria en el entorno del panel, pero solo
  para la búsqueda de seguimiento (ADR 0013). La ruta
  `/api/libro-template/generate` y el hook `useLibroTemplateAI` ya no existen.
- La app (`losresis-app`) solo pinta `clinical_practice`
  (`ResidenceLibraryScreen.js`: `const SECTION = "clinical_practice"`). Los
  otros diez bloques se guardan y se siembran, pero el residente no los ve
  hasta que la app se adapte. Ya pasaba con las cuatro secciones anteriores;
  ahora hay más superficie esperando.
- El icono deja de configurarse por categoría: lo hereda del tipo de bloque.
  `icon_name` se sigue escribiendo en cada nodo (la app lo lee con Ionicons),
  pero como valor derivado, no elegido.

### 0024-la-jornada-es-una-seccion-con-inscritos-y-avisos.md

# La Jornada de puertas abiertas es una sección, no un campo del perfil

## Status

accepted

## Contexto y decisión

La Jornada de puertas abiertas vivía como un bloque más del formulario "Perfil
de hospital": el hospital rellenaba fecha, texto y una imagen, guardaba, y ahí
se acababa todo. Pero la jornada **no es un dato del perfil, es un acto con
consecuencias**: gente que se inscribe, cosas que contarles antes de que
empiece y una opinión que recoger cuando termina. Un campo dentro de otra
pantalla no tiene sitio para nada de eso.

La sacamos a **sección propia** en el menú lateral (`/dashboard/open-days`),
hermana de Perfil de hospital. Al entrar, el hospital ve de un vistazo la fecha,
cuántas personas hay inscritas y tres acciones: **Ver inscritos**, **Editar
jornada** y **Enviar aviso**. En el perfil del hospital solo queda un enlace a
la sección.

De ahí salen las dos consecuencias nuevas, ambas por RPC `SECURITY DEFINER`
(`send_hospital_open_day_notice`, `submit_hospital_open_day_feedback`):

- **Aviso**: un mensaje del hospital a todos los inscritos. Se registra en
  `hospital_open_day_notice` —qué se dijo, cuándo y a cuántos— y se reparte
  insertando una fila por inscrito en `notifications`, que es lo que dispara el
  push por el trigger existente. El registro y el reparto entran juntos o no
  entra nada.
- **Valoración**: una vez celebrada la jornada, el hospital pide opinión con un
  aviso de tipo `feedback_request`; el asistente responde estrellas y comentario
  en la app y el resultado vuelve al panel. Hay **una valoración por persona y
  jornada**: volver a enviarla corrige la anterior.

Avisa **cualquier cuenta activa de la organización del hospital**, no el
alcance: la jornada es del hospital entero, no de una especialidad (al revés
que el Evento del servicio, ADR 0022).

Además, la imagen de la jornada **se guarda al subirla**, no en un segundo
guardado. El diseño anterior dejaba el fichero en el bucket y la URL solo en el
estado del formulario: quien subía la imagen y no volvía a pulsar "Guardar"
acababa con la foto en Storage y la jornada sin imagen — que es exactamente lo
que estaba pasando en producción. Y "Texto CTA" pasa a llamarse **"Texto del
botón"**, con ejemplos dentro del campo: quien lo rellena es Docencia, no un
equipo de producto.

## Considered Options

- **Dejarla en el perfil y añadir ahí los inscritos y los avisos**: cero rutas
  nuevas, pero convierte una pantalla de formulario en un panel de gestión y
  entierra la lista de inscritos debajo de las fotos del hospital. La jornada
  seguiría sin tener dónde crecer.
- **Avisar insertando en `notifications` desde el panel**: menos SQL, pero
  reparte N filas sin transacción, sin registro de lo enviado y con la
  autorización viviendo en el cliente. Un aviso a medio repartir no tiene
  vuelta atrás.
- **Reutilizar las reseñas del hospital para la valoración**: no habría
  pantalla nueva en la app, pero una reseña valora el hospital, no la jornada,
  y contamina el ranking con la opinión de un acto de una tarde.

## Consecuencias

- El menú del owner de un hospital gana una entrada; el perfil del hospital
  pierde su bloque de jornada y gana un enlace.
- `notifications` estrena dos tipos: `hospital_open_day_notice` y
  `hospital_open_day_feedback_request`. El segundo abre en la app la pantalla de
  valoración (`destination_section = 'valoracionJornada'`); el primero lleva a
  la bandeja, donde se lee el mensaje entero.
- Solo valora quien se inscribió, y solo cuando la jornada ya ha pasado: las dos
  condiciones las impone el RPC, no la pantalla.
- Sigue habiendo **una jornada activa por hospital**. Si algún día hay varias,
  la sección ya tiene sitio para listarlas; el resumen actual escoge la primera
  que no ha pasado.

### 0025-el-apartado-del-libro-es-de-uno-de-cuatro-arquetipos.md

# El apartado del Libro es de uno de cuatro arquetipos

## Status

accepted

Complementa al [ADR 0023](0023-el-libro-se-monta-de-un-catalogo-cerrado-de-bloques.md),
que sigue vigente en lo esencial: el catálogo es cerrado y se corresponde con el
enum `public.libro_section_code`. Lo que cambia es que ese catálogo deja de tener
**un solo editor uniforme**.

## Contexto y decisión

El ADR 0023 dejó los once apartados del Libro con la misma estructura:
`bloque → categoría → registro`, y cada registro con un `tracking_mode`. Eso hacía
el editor uniforme y barato, pero pedía al tutor que **modelara** en vez de
configurar: crear una «categoría de Congresos» no significa nada para un jefe de
estudios, y obligaba a inventarse una jerarquía donde no hay ninguna.

El rediseño de agosto 2026 rompe esa uniformidad a propósito. Cada apartado
declara su **arquetipo**, y el editor del panel y la pantalla de la app despachan
por él:

- **`itinerary`** — el tutor define una LISTA de cosas que el residente debe
  cubrir ese año y el residente completa **una ficha por elemento**. Rotaciones y
  Competencias. Los elementos son nodos raíz planos: no hay categorías.
- **`tree`** — el tutor agrupa en áreas y añade actividades que se **cuentan**.
  Solo Actividad asistencial. Es el único apartado donde sobrevive el nivel
  intermedio, y ahí se llama «área de actividad», no «categoría».
- **`form`** — el tutor **no define contenido**, solo qué campos pide; el
  residente crea las filas. Cursos, Congresos, Sesiones clínicas e Investigación.
  No hay nodos: la configuración vive en `libro_template_block.config` y los
  registros cuelgan del libro (`libro_entry.book_id`).
- **`automatic`** — no lo toca nadie a mano. Solo Guardias, que se leen de
  `agenda_events`.

Tres decisiones que acompañan a esa:

1. **El catálogo baja de once apartados a ocho.** Tutorías, Evaluaciones y
   Reflexión anual dejan de ser parte de la plantilla y pasan a ser módulos
   propios del bloque Docencia: no son estructura que el tutor configura una vez,
   son trabajo que hace de forma continua.

2. **La ficha del arquetipo `itinerary` es una tabla nueva**
   (`libro_node_progress`), con una fila por nodo. `libro_entry` no servía: su
   semántica es «un registro más» y no garantiza unicidad. Un elemento de
   itinerario se completa una vez, no N.

3. **El `tracking_mode` sale de la superficie del tutor.** Sigue en la base de
   datos como valor derivado —`participation` si el tutor activa el desglose,
   `counter` si no— pero el tutor ya no elige entre cuatro modos técnicos. Los
   comentarios pasan a `comments_mode`, que tiene los tres estados que la gente
   entiende: apagados, opcionales u obligatorios.

## Considered Options

- **Seguir con el editor uniforme** (ADR 0023). Es más barato de mantener y ya
  estaba hecho, pero el tutor tenía que entender la estructura interna de la
  plantilla para configurar cualquier cosa. El coste no lo pagaba el código: lo
  pagaba cada jefe de estudios que entraba por primera vez.
- **Un editor a medida por apartado**, once en total. Es lo que el documento del
  equipo describe literalmente. Se descartó porque multiplica por once la
  superficie a mantener en dos repos, y porque los once se agrupan de forma
  natural en cuatro comportamientos: la variedad estaba en el copy, no en la
  mecánica.
- **Modelar los apartados `form` con un nodo contenedor invisible** del que
  colgasen las entradas, para no tocar `libro_entry`. Habría evitado la migración,
  pero introduce un nodo fantasma que hay que esconder en la app, en el PDF, en la
  vista del tutor y en todos los contadores. Un `book_id` nullable se explica en
  una línea.

## Consequences

- **Añadir un apartado exige decidir su arquetipo**, y si no encaja en ninguno,
  añadir uno. Es deliberado: la pregunta «¿esto es una lista, un árbol, un
  formulario o algo automático?» es la que hay que responder antes de escribir
  código.
- **El nivel «categoría» ya no es universal.** Cualquier código que asuma
  `categoría → registro` para todos los apartados está mal. El copy del grupo y
  del hijo sale del catálogo, con «categoría» como valor por defecto.
- **La app tiene que aprender cuatro patrones de pantalla.** Hoy pinta los ocho
  apartados con la UI de contador, así que el panel configura cosas que el
  residente todavía no ve. Es la deuda principal del rediseño.
- **`libro_event` queda definitivamente muerta.** Sus campos son el subconjunto
  «Cursos» del arquetipo `form`, pero fijos: no admiten los de Investigación. Todo
  lo estructurado va en `libro_entry.payload`.
- **`expected_level` queda sin uso.** Se creó para el nivel esperado de las
  competencias y el equipo lo retiró de la plantilla: la escala se aplica en el
  seguimiento del residente, no al configurar. La columna se queda porque borrarla
  y volver a crearla no aporta nada.

### 0026-el-alcance-de-preguntar-al-libro-se-aserta-en-la-rpc.md

# El alcance de Preguntar al Libro se aserta en la RPC, no en RLS

## Status

accepted

Desvía de ADR 0014 y de la migración `20260820120000_docencia_y_libro_rls.sql`, que
para el resto del Libro y de Docencia resolvieron el alcance con RLS.

## Contexto y decisión

**Preguntar al Libro** contesta cifras del Libro de residente. La respuesta obvia era
la de siempre en el panel: consultar desde el cliente con el JWT de la cuenta y dejar
que RLS decida, que es exactamente lo que la migración `20260820120000` acababa de
montar con `has_teaching_scope_for_user`.

No sirve, y el motivo es una sola tabla. Las **Guardias** del Libro son el arquetipo
`automatic`: no viven en `libro_entry`, salen de `agenda_events`
(`20260814120000_libro_activity_comments_and_automatic_shifts.sql`: *"las guardias del
libro se leen de las que ya hay"*). Y `agenda_events` tiene
`allow_all_agenda_events ... USING (true) WITH CHECK (true)`, sin cláusula `TO`, desde
`20260315220000`.

O sea: la pregunta que motivó la funcionalidad —*"¿cuántas guardias lleva Ana?"*— es
justo la que RLS no protege.

Y **esa tabla no se puede cerrar sin más**, que es lo que la hace distinta del caso de
ADR 0014. Ahí las tablas eran nuevas y la app no las tocaba. `agenda_events` es de las
más leídas de la app móvil, y una de sus lecturas es cruzada **a propósito**: la
**Guardia de equipo** enseña al residente las guardias de sus compañeros de hospital y
especialidad sin conexión ni permiso ninguno. Una política "solo tus filas" rompe una
funcionalidad viva.

Por tanto **Preguntar al Libro no consulta tablas: llama a un catálogo cerrado de RPC
`SECURITY DEFINER`**, y cada una empieza asertando el alcance:

```sql
create or replace function public.libro_chat_contar_guardias(
  p_resident uuid, p_desde date, p_hasta date
) returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_teaching_scope_for_user(p_resident) then
    raise exception 'fuera de alcance';
  end if;
  ...
end $$;
```

El catálogo es cerrado y corto: contar actividad, contar guardias, progreso de
itinerario, listar registros, resumen de apartado, comparativa de cohorte. El modelo
**nunca** produce SQL ni un `resident_id`: produce la forma de la pregunta y sus
parámetros, y el panel resuelve el residente por su cuenta.

Esto además tapa un agujero que no es de esta funcionalidad: la n-ómina de residentes
sobre la que se emparejan los nombres se calcula **en el cliente** (`useResidentsLibros`
filtra `users` por `hospital_id` y `speciality_id`, y `users` es `allow_all`; ADR 0001
ya avisa de que el alcance *"se impone solo en la UI"*). Con la aserción en la RPC, un
cliente hostil que se ensanche la nómina no consigue nada: la función le dice que no.

## Considered Options

- **Cerrar `agenda_events` con la regla real** (dueño ∪ equipo hospital+especialidad ∪
  alcance docente). Es el arreglo correcto de un agujero que existe hoy para toda la
  app, no solo para esta pantalla, y probablemente haya que hacerlo. Pero es una
  migración con el blast radius de la app móvil entera, y no puede ser el requisito
  previo de una funcionalidad del panel. Va por su lado.
- **Confiar en RLS y no ofrecer Guardias.** Deja fuera la pregunta que motivó todo.
- **Rutas de servidor con service-role.** El enforcement queda en un sitio, pero
  service-role **se salta RLS**, así que hay que reescribir el alcance a mano en
  TypeScript — el mismo trabajo que la RPC, en el lado donde no está el dato y sin la
  garantía de que nadie se olvide.
- **Que el modelo genere SQL** contra un rol de solo lectura. La superficie de fuga
  pasa a ser lo que ese rol vea, y el catálogo de nodos que se le manda al modelo
  incluye nombres escritos por el residente en su Libro propio: una inyección en el
  prompt se convertiría en consulta.

## Consequences

- Preguntar al Libro **solo sabe contestar lo que hay en el catálogo**. Ampliarlo es
  escribir una RPC, no ajustar un prompt. Es deliberado: es lo que hace que la lista de
  cosas que la funcionalidad puede leer sea auditable de un vistazo.
- Estas RPC son la **única** vía por la que el panel lee guardias de un residente. Si
  alguien añade una lectura directa de `agenda_events` desde un hook, se salta la
  aserción sin que nada falle.
- `SECURITY DEFINER` + `search_path = public` fijo, y `raise exception` en vez de
  devolver vacío: un alcance insuficiente tiene que ser un error visible, no un cero
  que parezca un dato.
- El agujero de `agenda_events` **sigue abierto** para el resto de la app. Esta ADR no
  lo arregla; lo documenta.

### 0027-sin-plantilla-publicada-no-hay-comparativa-y-no-hay-cero.md

# Sin plantilla publicada no hay comparativa, y no hay cero

## Status

accepted

## Contexto y decisión

La **Comparativa del servicio** de **Preguntar al Libro** contesta *"¿quién lleva menos
intubaciones?"*. Para eso hace falta una clave que diga que la intubación de Ana y la
de Luis son la misma cosa, y esa clave no es obvia: `libro_node` es **por residente**
(`user_id`), así que "Intubación orotraqueal" son N filas distintas en N libros.

La única clave real es `libro_node.template_node_id`, y su comentario en la base dice lo
que hay que saber: *"Nodo de plantilla del que se clonó. **NULL = lo añadió el residente
y es suyo**"* (`20260802120000`).

El dato que decide es el del ADR 0007 de `losresis-app`: **62 residentes tienen Libro
propio con 1.453 registros dentro, y solo 2 de 7 plantillas están publicadas — ninguna
en un hospital con residentes de esos.** Es decir: hoy, en producción,
`template_node_id` es `NULL` en prácticamente toda la actividad registrada.

Así que la comparativa por actividad concreta **solo se ofrece cuando los libros
comparados vienen de la misma Plantilla de libro publicada**, y cuando no puede, **lo
dice**. No devuelve cero.

Esa distinción es toda la ADR. Un cero en una comparativa no es un dato que falta: es
una frase sobre una persona con nombre y apellidos —*"Luis no ha intubado nunca"*— que
además viaja fuera de la pantalla en cuanto alguien hace una captura. Un número
equivocado que parece un número bueno es peor que no tener número.

**Las Guardias son la excepción y funcionan hoy para todos**: salen de `agenda_events`,
no necesitan nodo ni plantilla. La comparativa nace, entonces, útil para guardias y
apagada para actividad concreta, y se enciende sola en cuanto un responsable publica su
plantilla — sin desplegar nada.

## Considered Options

- **Unir por nombre normalizado** (`unaccent` + `lower` sobre `libro_node.name`).
  Funciona hoy con los 1.453 registros que hay, y es la opción tentadora. Pero
  "Intubación orotraqueal", "Intubaciones" e "IOT" son tres claves distintas, así que
  sub-cuenta en silencio y **señala a la persona equivocada como la que menos trabaja**.
  Es el modo de fallo exacto que esta ADR existe para evitar.
- **Ofrecer la comparativa solo por apartado** (Actividad asistencial entera, sin bajar
  a la actividad). El total por apartado tampoco es comparable: cada libro propio tiene
  los nodos que su dueño inventó, y con distinto grano.
- **Sembrar `template_node_id` a posteriori** casando por nombre. Igual de frágil que
  unir por nombre, pero además **escribe** el error en la base y lo hace permanente.
- **No ofrecer comparativas en v1.** Es lo honesto, y es lo que queda de facto para
  actividad concreta. Se rechaza como regla general porque guardias sí funciona y es
  media funcionalidad gratis.

## Consequences

- La respuesta "no puedo comparar" tiene que ser **útil**, no una disculpa: dice cuántos
  de los residentes de esa cohorte tienen libro propio y ofrece el atajo a publicar la
  plantilla. Es el mejor momento del producto para pedir esa publicación, porque el
  responsable acaba de querer algo que la plantilla le daría.
- La comparativa **agrupa por año de residencia** (los R1 entre R1). Comparar un R1 de
  mayo con un R4 produce un ranking cierto y sin sentido. Con menos de 3 personas en la
  cohorte se avisa de que la comparación no compara nada.
- Hay que **medir** cuántas comparativas se rechazan por falta de plantilla. Si tiende a
  cero por publicaciones, bien; si se queda alta, la conclusión es sobre la adopción de
  las plantillas, no sobre el chat.
- Los residentes que **migren a la plantilla** (destructivo e irreversible, ADR 0006 de
  la app) entran en la comparativa, pero sin lo que registraron antes: su histórico se
  borró al migrar. La comparativa de una cohorte recién migrada arranca casi en cero
  para todos, y eso hay que decirlo en pantalla.

### 0028-preguntar-al-libro-traduce-la-pregunta-y-el-nombre-no-sale.md

# Preguntar al Libro traduce la pregunta, y el nombre del residente no sale

## Status

accepted

Extiende el criterio de ADR 0013 a una categoría de dato distinta.

## Contexto y decisión

**Preguntar al Libro** parece pedir un chatbot: se le pregunta *"¿cuántas guardias lleva
Ana en 30 días?"* y contesta *"Ana lleva 14"*. La forma obvia de hacerlo es darle
herramientas al modelo, que consulte y que redacte. Se decide **no hacerlo**, con el
mismo reparto que ADR 0013: **el modelo traduce la pregunta a filtros validados, Postgres
cuenta, y la cifra la pinta el panel con una plantilla determinista.** El modelo no ve
ni una fila.

ADR 0013 razonaba sobre datos de salud de pacientes pseudonimizados, y esto no es eso.
Pero tampoco es inocuo, y en un aspecto es **peor**: el Libro es el registro de la
actividad formativa de **un trabajador identificado por su nombre y apellidos**, es la
base de su evaluación, y el paciente al menos era un NHC. Aquí el identificador es la
persona.

De ahí lo que esta ADR añade sobre 0013, que es una pieza nueva: **el nombre se resuelve
en local y se sustituye por un token antes de llamar al modelo.** El panel ya tiene la
nómina de residentes de su alcance; empareja contra ella, manda
`"guardias de [RESIDENTE_1] en 30 días"`, y traduce el token de vuelta a un `uuid`
cuando el modelo contesta. A Moonshot no le llega el nombre.

Lo único de la casa que sí sale es el **catálogo de nodos**: la lista de nombres de
actividad entre los que el modelo tiene que elegir (devuelve un índice, validado contra
la lista, como en ADR 0003). Y eso es aceptable porque en un Libro oficial esos nombres
**son la plantilla que escribió el propio responsable**: su configuración docente, no la
actividad de nadie.

Consecuencia directa: la funcionalidad **no valora**. No puede, porque el modelo no tiene
los datos con los que valorar. Cuando se le pide un juicio (*"¿es buena residente?"*) o
algo que no es del Libro (bienestar, nómina, clínica), devuelve un motivo de una lista
cerrada y **el mensaje lo escribe el panel**, no el modelo. La valoración de un residente
es un documento formal con autor humano; que una IA emita el juicio y luego alguien lo
firme es exactamente lo que no debe pasar.

## Considered Options

- **Tool-calling: el modelo con herramientas, iterando y redactando.** La mejor
  conversación con diferencia, y la que el usuario pide cuando pide "un chat". Manda a
  China el nombre completo del residente, los comentarios que escribe en su Libro y sus
  fichas. Es dato personal de un trabajador identificado en una transferencia
  internacional sin decisión de adecuación, y aterriza en la mesa del DPD del hospital
  el día que se intenta cerrar la venta.
- **Segunda pasada con agregados despersonalizados**: se le devuelven al modelo solo
  cifras y etiquetas de catálogo (`{seccion:"Guardias", total:14, media:11.2}`) para que
  redacte la frase, y el panel sustituye el token por el nombre. Sale poco y sin
  identificar. Se rechaza para v1 porque **compra prosa, que es lo que menos falta**: la
  respuesta a "cuántas" es un número, y la plantilla lo dice igual de bien, sin latencia
  extra y sin nada que explicar. Es la siguiente parada si hiciera falta narrativa.
- **Mandar el nombre tal cual** y que el modelo lo devuelva en un campo, como hace hoy el
  campo `autor` de `/api/seguimiento/search` con nombres de médicos. Más simple, y
  probablemente lo que habría salido si no se hubiera mirado. La tokenización cuesta un
  emparejamiento en cliente que ya hay que hacer de todas formas para resolver el `uuid`.

## Consequences

- A *"¿qué le mandáis a la IA?"* se responde **"la pregunta, con el nombre ya quitado, y
  la plantilla que escribió el tutor"**. Como en ADR 0013, es el argumento de venta, no
  solo una decisión técnica.
- El modelo se llama como el traductor de ADR 0013: `thinking: disabled`,
  `response_format: json_object`, pocos tokens de salida y **sin `temperature`** —
  `kimi-k2.5` solo admite la suya (0.6) y con cualquier otro valor la API devuelve 400.
  Nada que ver con el asistente clínico de la app, que va con `thinking: enabled`,
  `temperature 1.0` y 16k tokens porque redacta prosa.
- **No hay streaming** y no hace falta: la respuesta es una consulta, no un texto que
  crece.
- Si el emparejamiento local no encuentra el nombre, el mensaje es **el mismo** que si el
  residente no existiera: *"no tengo a nadie con ese nombre entre tus residentes"*.
  Distinguir "fuera de tu alcance" de "no existe" convertiría el chat en un oráculo de
  quién trabaja dónde, sondeable con una cuenta cualquiera del panel.
- Los nombres de nodo de un **Libro propio** sí los escribió el residente, y entran en el
  prompt como catálogo. El daño está acotado —la salida es un índice validado contra la
  lista— pero es la vía de inyección de esta funcionalidad, y por eso el modelo nunca
  produce SQL ni identificadores (ADR 0026).
- Queda pendiente la obligación que ADR 0013 ya dejó abierta: **medir el porcentaje de
  preguntas que se van sin respuesta**. Se guarda la pregunta ya tokenizada, la forma
  resuelta, si hubo resultado y la latencia — **sin** `resident_id`. Docencia ya lee el
  Libro sin registro en el resto del panel; un log de "quién preguntó por quién" solo en
  esta pantalla daría una sensación de rendición de cuentas que no existe dos pestañas
  más allá.

