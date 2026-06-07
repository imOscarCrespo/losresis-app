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

Vínculo mutuo y aceptado entre dos **Residentes** verificados. Habilita dos cosas entre ambos: el chat directo, y compartir **Eventos de agenda** (ver **Evento compartido**). Sin **Conexión** aceptada no se puede ni chatear ni compartir. Nace de una **Solicitud de conexión** que el destinatario acepta.
_Evitar_: amistad, amigo, contacto, seguir.

## Guardia de equipo

**Guardia** de otro **Residente** del mismo hospital y especialidad que el usuario actual. Se muestra automáticamente en su **Agenda** (sin necesidad de **Conexión** ni de compartir nada), en solo-lectura y etiquetada con el nombre del compañero. La proximidad de equipo (hospital + especialidad) es la única condición de visibilidad.
_Evitar_: guardia compartida (una guardia nunca se comparte por **Conexión**).

## Evento compartido

**Evento de agenda** que **no** es una **Guardia** y cuyo dueño comparte con N de sus **Conexiones**. Cada destinatario lo ve en solo-lectura dentro de su propia **Agenda**, etiquetado con el nombre del dueño. Compartir significa compartir el evento completo; no hay selección de campos. Las **Guardias** no se comparten por este mecanismo: ya son visibles a los compañeros como **Guardia de equipo**.
_Evitar_: invitación a evento, evento de grupo.

## Solicitud de conexión

Petición que un **Residente** verificado envía a otro para establecer una **Conexión**. Mientras no se resuelve está pendiente; el destinatario puede aceptarla (crea la **Conexión**) o rechazarla. Solo residentes verificados pueden enviarla o recibirla.
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
