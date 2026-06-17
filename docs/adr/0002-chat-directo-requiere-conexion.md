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
