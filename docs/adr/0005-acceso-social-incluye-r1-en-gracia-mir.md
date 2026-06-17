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
