# Glosario de dominio — LosResis

## Residente

Usuario de la app que está cursando la residencia médica. Tiene hospital, especialidad y año de residencia. Accede a la **Agenda** para registrar su actividad clínica y formativa.

## Agenda

Calendario unificado del **Residente**, implementado en `screens/AgendaScreen.js`. Reúne en una sola vista: (1) sus propios **Eventos de agenda**, (2) las **Guardias de equipo** de sus compañeros, y (3) los **Eventos compartidos** que sus **Conexiones** comparten con él. Lo propio es editable; lo ajeno (guardias de equipo y eventos compartidos) se muestra en solo-lectura, etiquetado con el nombre de la otra persona para distinguirlo.

## Evento de agenda

Unidad mínima de la **Agenda**. Tiene fecha, tipo y metadatos opcionales según el tipo. Los tipos existentes son: `shift` (Guardia), `course`, `research`, `study`, `conference`, `day_off`, `reminder`. Persiste en la tabla `agenda_events`.

## Guardia

Evento de agenda de tipo `shift`. Representa un turno de guardia médica del **Residente**. Siempre tiene una fecha exacta y una duración (`24h` o `12h`). Al crearse, genera simultáneamente un registro en la tabla legacy `shifts` enlazado por `source_shift_id`.

## Lote de guardias

Conjunto de **Guardias** creadas en una sola operación a partir de múltiples fechas seleccionadas en el calendario. Comparten los mismos valores de duración, notas y recordatorio. El lote se forma en el **Modo selección de guardias**.

## Modo selección de guardias

Estado temporal de la **Agenda** en el que el calendario acepta múltiples toques de fechas para construir un **Lote de guardias**. Se activa al elegir "Guardia" en el selector de tipo. Las fechas que ya tienen una **Guardia** aparecen bloqueadas y no son seleccionables. El modo termina cuando el usuario confirma la selección o cancela.

## Conexión

Vínculo mutuo y aceptado entre dos **Residentes con acceso social**. Habilita tres cosas entre ambos, de forma indivisible: el chat directo, compartir **Eventos de agenda** (ver **Evento compartido**), y la visibilidad mutua en el **Feed** (**Posts** y **Actividades de guardia**). No hay conexiones parciales: aceptar una **Conexión** habilita las tres a la vez. Sin **Conexión** aceptada no se puede ni chatear ni compartir ni verse en el feed. Nace de una **Solicitud de conexión** que el destinatario acepta.
_Evitar_: amistad, amigo, contacto, seguir, conexión solo-chat.

## Residente con acceso social

**Residente** habilitado para crear **Conexiones** (enviar y recibir **Solicitudes de conexión**, chatear, compartir y aparecer en el **Feed**). Son los que están `active` y también los **R1 dentro de la ventana de gracia MIR** (estado `pending_corporate_email_seasonal`), aunque éstos aún no hayan validado su email corporativo. Queda **fuera** el residente `locked_missing_corporate_email` (gracia MIR expirada sin email): no puede crear ni recibir conexiones, y la app lo redirige a su perfil. El acceso social **no** equivale a tener email corporativo validado: es deliberadamente más laxo que el gate de reseñas de hospital y rotaciones externas, que sí exige validación.
_Evitar_: residente verificado (la validación de email ya no gobierna lo social), residente activo (excluiría a los R1 en gracia).

## Guardia de equipo

**Guardia** de otro **Residente** del mismo hospital y especialidad que el usuario actual. Se muestra automáticamente en su **Agenda** (sin necesidad de **Conexión** ni de compartir nada), en solo-lectura y etiquetada con el nombre del compañero. La proximidad de equipo (hospital + especialidad) es la única condición de visibilidad.
_Evitar_: guardia compartida (una guardia nunca se comparte por **Conexión**).

## Evento compartido

**Evento de agenda** que **no** es una **Guardia** y cuyo dueño comparte con N de sus **Conexiones**. Cada destinatario lo ve en solo-lectura dentro de su propia **Agenda**, etiquetado con el nombre del dueño. Compartir significa compartir el evento completo; no hay selección de campos. Las **Guardias** no se comparten por este mecanismo: ya son visibles a los compañeros como **Guardia de equipo**.
_Evitar_: invitación a evento, evento de grupo.

## Feed

Superficie social del **Residente**, distinta de la **Agenda**. Reúne en orden cronológico la actividad de sus **Conexiones**: las **Actividades de guardia** que generan y los **Posts** que publican. La visibilidad del feed se rige **siempre por Conexión** (no por proximidad de equipo). Se muestra en la pantalla principal (`HomeDashboardScreen`).
_Evitar_: muro, timeline, agenda social.

## Actividad de guardia

Evento de actividad que aparece en el **Feed** cuando una **Conexión** registra una **Guardia**, independientemente de su hospital o especialidad. Es **automático** y **derivado** de la guardia: el residente no "comparte" la guardia, el sistema publica una actividad a partir de ella. **No** aparece al crear la guardia (que puede programarse con semanas de antelación, en **Lote de guardias**), sino **a las 09:00 (hora Europe/Madrid) del día siguiente a la fecha de la guardia** — ya en pasado ("ha hecho una guardia"). Así un lote de guardias del mes no genera spam: cada una aflora su propio día. En v1 **no hay opt-out**: todas las guardias de un residente se emiten a todas sus **Conexiones**. Es un canal de visibilidad por **Conexión**, **distinto** de la **Guardia de equipo** (que se ve por proximidad de equipo, en la **Agenda**). Una misma guardia de un compañero-conexión puede aparecer en ambos sitios. Sobre una **Actividad de guardia** se pueden dar **Chapós**.
_Evitar_: guardia compartida, guardia del feed (la guardia no se comparte; se deriva una actividad).

## Post

Publicación de contenido libre que un **Residente** crea en su **Feed**: **texto** (obligatorio) y **opcionalmente una imagen**. No tiene fecha de calendario ni estructura (a diferencia del **Evento de agenda**). Lo ven sus **Conexiones** en el **Feed**. Se le pueden dar **Chapós**. En v1 no admite comentarios.
_Evitar_: publicación de agenda, evento social, estado.

## Chapó

Única reacción del **Feed**: un reconocimiento positivo que un **Residente** da a un **Post** o a una **Actividad de guardia** de una **Conexión** (equivalente al "kudos" de Strava). Es **binario** por usuario e ítem (lo das o lo quitas), no hay tipos ni grados. Su sentido es felicitar/animar de forma genérica, sirve para cualquier ítem del feed.
_Evitar_: like, me gusta, kudos, reacción (en plural de tipos).

## Solicitud de conexión

Petición que un **Residente con acceso social** envía a otro para establecer una **Conexión**. Mientras no se resuelve está pendiente; el destinatario puede aceptarla (crea la **Conexión**) o rechazarla. El gate de **acceso social** se aplica simétricamente: tanto el emisor como el destinatario deben tenerlo (un R1 en gracia MIR puede enviar y recibir; un residente `locked` ni una cosa ni la otra).
_Evitar_: invitación, friend request.

## Salud mental

Sección de la app dedicada al bienestar del **Residente**. Agrupa las **Evaluaciones de bienestar** y los **Recursos de ayuda**. Su lenguaje es deliberadamente no clínico: no diagnostica.
_Evitar_: sección de burnout, sección de diagnóstico.

## Evaluación de bienestar

Una medición individual que hace el **Residente** sobre su propio estado, basada en el cuestionario CBI. Devuelve tres puntuaciones (personal, laboral, por pacientes) que se siguen en el tiempo. Es autoconocimiento, no un diagnóstico ni una clasificación en niveles.
_Evitar_: test de burnout, diagnóstico, cuestionario clínico.

## Recurso de ayuda

Contacto externo de apoyo profesional que la **Sección de salud mental** ofrece al **Residente** (PAIME por comunidad autónoma, líneas de crisis como el 024). Siempre accesible, nunca condicionado a una puntuación.
_Evitar_: alerta, derivación.
