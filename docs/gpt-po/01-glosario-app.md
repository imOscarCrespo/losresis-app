# Glosario de dominio — LosResis APP (React Native / Expo)

> Fuente: losresis-app/CONTEXT.md. Usa SIEMPRE estos términos exactos al redactar tareas.


## Residente

Usuario de la app que está cursando la residencia médica. Tiene hospital, especialidad y año de residencia. Accede a la **Agenda** para registrar su actividad clínica y formativa.

## Agenda

Calendario unificado del **Residente**, implementado en `screens/AgendaScreen.js`. Reúne en una sola vista: (1) sus propios **Eventos de agenda**, (2) las **Guardias de equipo** de sus compañeros, (3) los **Eventos compartidos** que sus **Conexiones** comparten con él, y (4) los **Eventos del servicio** que su servicio le convoca desde el panel del hospital. Lo propio es editable; lo ajeno (guardias de equipo, eventos compartidos y eventos del servicio) se muestra en solo-lectura, etiquetado con su origen para distinguirlo.

## Evento de agenda

Unidad mínima de la **Agenda**. Tiene fecha, tipo y metadatos opcionales según el tipo. Los tipos existentes son: `shift` (Guardia), `course`, `research`, `study`, `conference`, `day_off`, `reminder`, `service` (**Evento del servicio**). Persiste en la tabla `agenda_events`.

## Evento del servicio

Evento de agenda de tipo `service`: la copia que el responsable de la especialidad proyecta en la agenda del **Residente** al convocarle a un acto (sesión clínica, curso, reunión) desde el panel del hospital. Vive en `agenda_events` con el `user_id` del residente, pero es de **solo lectura**: no se crea, edita ni borra desde la app — el selector de "Añadir a la agenda" no lo ofrece y al tocarlo se abre el detalle, etiquetado "‹Especialidad› · Servicio". Crearlo, cambiarlo o cancelarlo avisa por push. La entidad madre (`evento_servicio`) vive en el panel; ver el glosario de `losresis-panel`.
_Evitar_: convocatoria (aquí es la edición del examen MIR), evento compartido (eso es de Conexiones).

## Recordatorio del servicio

La vista del **Residente** sobre el tablón de pendientes que su servicio comparte en losresis-panel (tabla `recordatorio`, su ADR 0008). **No** es el Recordatorio de agenda (tipo `reminder` de `agenda_events`, nota personal): es la misma entidad que ve el panel, con el mismo ciclo — se cierra a mano ("Hecho", registrando quién y cuándo), lo no cerrado se arrastra vencido, y lo vencido más de ~7 días se archiva solo. La pantalla (`screens/ServiceRemindersScreen.js`, solo residentes) muestra dos listas: **Para mí** (señalados a él, con push `recordatorio_asignado` al asignarse) y **Del servicio, sin asignar** (de quien esté de turno — cualquiera puede cerrarlos). El residente también crea recordatorios: texto, fecha, NHC opcional y destinatario opcional entre los residentes de su hospital+especialidad; el autor declarado es él mismo, automático.
_Evitar_: recordatorio (a secas, ambiguo con el de agenda), tarea, pendiente.

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

## Mis publicaciones

Vista propia del **Residente** sobre los **Posts** que él mismo ha creado, accesible desde **Mi perfil** (pantalla dedicada, separada del **Feed**). Existe porque el **Feed** solo muestra lo de las **Conexiones**: sin esta vista, un residente no puede ver ni gestionar lo que él ha publicado. Reúne **únicamente Posts** (no **Actividades de guardia**, que son derivadas y se gestionan desde la **Agenda**). Desde aquí el residente puede **ver**, **publicar** y **eliminar** sus Posts; editar **no** está contemplado en esta versión. En cada Post propio el **Chapó** se muestra como contador de solo-lectura (un residente no se da Chapó a sí mismo). **Mi perfil** expone esta vista como una de tres métricas de cabecera: **Conexiones**, **Publicaciones** (abre **Mis publicaciones**) y **Chapós recibidos**.
_Evitar_: mi feed, mi muro (el **Feed** es la actividad de las **Conexiones**, no la propia).

## Chapós recibidos

Métrica de reconocimiento del **Residente** en su **Mi perfil**: el total de **Chapós** que ha recibido sumando los de sus **Posts** y los de sus **Actividades de guardia**. Es el "kudos total" del residente (análogo a Strava). Es solo un número informativo (no navega a detalle).

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

## Análisis de foto de estudio

Funcionalidad para estudiantes ("Explícamelo fácil"): el estudiante fotografía una pregunta de examen o apunte que no entiende, la sube desde su galería y el asistente (Kimi, modo `estudio` del edge function `losresis-llm`) se la explica con lenguaje sencillo siguiendo un formato fijo. Acceso controlado por usuario con la feature key `photo_study_analysis`.
_Evitar_: OCR, escáner, chat de estudio.

## Tarjeta de estudio

Explicación generada por un **Análisis de foto de estudio** que el estudiante guarda para repasarla después, junto con la foto original. Vive en `study_photo_cards` y se consulta en la pestaña "Mis tarjetas".
_Evitar_: flashcard, apunte, nota.

## Libro del Residente

El registro de toda la actividad formativa del **Residente** durante un año de residencia: qué ha rotado, qué ha hecho, qué ha adquirido. Se compone de **Apartados**, y qué apartados tiene no lo decide el residente sino la **Plantilla del Libro** que su hospital publica para su especialidad y su año.
_Evitar_: libro de residencia, libro de rotaciones, portfolio.

## Plantilla del Libro

Lo que la Unidad Docente publica desde losresis-panel para una especialidad y un año de residencia: qué **Apartados** tiene el **Libro del Residente**, y dentro de cada uno, qué contenido o qué campos. Es la única fuente de la configuración docente: la app la representa, no la inventa ni la almacena como estructura fija. Vive en `libro_template` y solo cuenta si está publicada.
_Evitar_: plantilla base (eso es el contenido de arranque por especialidad, que todavía no existe), configuración del tutor.

## Apartado

Unidad de la que se compone el **Libro del Residente** y la **Plantilla del Libro**: Rotaciones, Actividad asistencial, Guardias, Cursos, Congresos, Sesiones clínicas, Investigación y Competencias. El catálogo es **cerrado** —espeja el enum `libro_section_code`— y son **ocho**: Tutorías, Evaluaciones y Reflexión anual salieron de la plantilla y son módulos propios. En código el identificador es `section`, por la base de datos.
_Evitar_: bloque, sección (en texto visible), módulo (eso son Tutorías, Evaluaciones y Autoevaluación).

## Arquetipo

El comportamiento que declara un **Apartado** y que decide cómo lo edita el tutor y cómo lo pinta la app. Son cuatro y no hay más: `itinerary` (el tutor define una lista, el residente completa una ficha por elemento), `tree` (el tutor agrupa en **Áreas de actividad** y el residente cuenta registros), `form` (el tutor solo activa campos, el residente crea las filas) y `automatic` (nadie lo escribe: sale de la **Agenda**). El nivel intermedio de agrupación **solo** existe en `tree`.
_Evitar_: tipo de bloque, modo, plantilla de apartado.

## Área de actividad

El nivel de agrupación intermedio del **Arquetipo** `tree`, y por tanto exclusivo de Actividad asistencial: Urgencias, Sala de partos, Quirófano. Dentro de cada una cuelgan las actividades que el residente cuenta.
_Evitar_: categoría (era el nombre viejo, cuando todos los apartados tenían este nivel).

## Libro propio

**Libro del Residente** cuya estructura montó el propio residente (en el onboarding, antes de que su hospital publicara nada): sin `template_id`. Puede añadir, editar y borrar su estructura, y su tutor no la ve como plan suyo.
_Evitar_: libro manual, libro sin plantilla.

## Libro oficial

**Libro del Residente** sembrado desde la **Plantilla del Libro** y sellado con su `template_id`. Su estructura es del tutor: el residente registra dentro, pero no la añade, edita ni borra.
_Evitar_: libro del tutor (la actividad de dentro es del residente), libro de plantilla.

## Migrar a la plantilla

Sustituir el **Libro propio** de un año por el **Libro oficial** de ese año. Es **destructivo e irreversible**: se borra el libro propio de ese año con todo lo registrado dentro. Se le ofrece al residente en cuanto existe una **Plantilla del Libro** publicada que cubre su año, nunca se le impone, y antes de consumarlo puede descargarse su libro completo en PDF.
_Evitar_: cambiar de libro, adoptar la plantilla, sincronizar.

## Progreso del año

Cuánto ha cubierto el **Residente** de lo que su tutor le ha fijado como objetivo para ese año: fichas de itinerario completadas (rotaciones y competencias) más actividades de **Área de actividad** que tengan meta. Lo que no tiene objetivo —Cursos, Congresos, Sesiones clínicas, Investigación y Guardias— no entra en el cálculo, aunque sus contadores se muestren. Se deriva al leer: no se guarda.
_Evitar_: completitud del libro, nota, cumplimiento.

## Tutoría

Reunión entre el **Residente** y su tutor, programada desde losresis-panel. Es **un único registro compartido** por los dos, no una copia para cada uno: `shared_at` marca desde cuándo el residente ve su contenido. Se proyecta en la **Agenda** como **Evento de agenda** de tipo `tutoring`, igual que el **Evento del servicio**. No es un **Apartado** del **Libro del Residente**.
_Evitar_: tutoría del libro, sesión de tutoría, reunión.

## Evaluación

El documento con el que el tutor evalúa al **Residente** (competencias revisadas, objetivos, mejoras, comentarios y valoración). Es **suyo, y el residente solo lo lee**, a partir de `shared_at`. Al cerrarse escribe el nivel de las competencias directamente en la ficha del **Libro del Residente**, que es por qué ese nivel no lo mueve el residente.
_Evitar_: evaluación del residente (la escribe el tutor), autoevaluación (es otra cosa), examen.

## Autoevaluación anual

El cuestionario que el tutor le solicita al **Residente** y que **rellena y envía él**: preguntas congeladas en el momento de la solicitud, respuestas suyas, y un envío que la deja disponible para el tutor. Es lo único de Docencia que el residente completa. Sus preguntas nacieron de la Reflexión anual del Libro, pero una vez solicitada no cambia aunque el tutor edite la plantilla.
_Evitar_: reflexión anual (era el apartado del Libro, retirado), evaluación.

## Comunicado

Aviso que la Unidad Docente dirige a un conjunto de **Residentes** por especialidad y año. Sus destinatarios **se resuelven al enviarlo**, no al redactarlo: uno programado para dentro de una semana llega a quien sea residente ese día.
_Evitar_: notificación, aviso del servicio (eso es el **Recordatorio del servicio**).
