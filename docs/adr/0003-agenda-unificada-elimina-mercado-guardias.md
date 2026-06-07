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
