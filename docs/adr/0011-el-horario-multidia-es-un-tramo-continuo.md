# El horario de un evento multi-día es un tramo continuo

## Status

accepted

## Contexto y decisión

`agenda_events` tiene `start_time`, `end_time` y `all_day` desde su primera migración
(`20260315220000_agenda_events.sql`), y la app ya sabía **pintarlos**
(`screens/AgendaScreen.js`, fila "Hora"; `screens/HomeDashboardScreen.js`). Lo que no
hacía era **escribirlos**: `buildPayloadFromForm` solo conservaba los que ya venían
puestos. Así que hasta ahora las dos columnas las llenaba **únicamente el panel**, al
proyectar un **Evento del servicio** o una **Tutoría** — ambos de solo-lectura.

Al abrir el **Horario del evento** al **Residente**, dos escritores distintos empiezan a
compartir las mismas dos columnas. Y Curso y Congreso pueden ocupar varios días
(`duration_days` calcula `end_date`), donde "Empieza 09:00 / Termina 18:00" admite dos
lecturas incompatibles:

- **tramo continuo**: del día 10 a las 09:00 al día 12 a las 18:00;
- **horario diario**: cada uno de los tres días, de 09:00 a 18:00.

Se decide **tramo continuo**, que es lo que ya significan esas columnas para el panel.
Guardar el horario diario en ellas metería un segundo significado en el mismo sitio y
**nada en la fila permitiría saber cuál de los dos es**: no hay columna que diga quién la
escribió ni con qué intención, así que cualquier lector futuro —una consulta del panel,
un export, una vista de la app— tendría que adivinar.

Como consecuencia directa, el detalle ancla cada hora a su día (`10 mar, 09:00 –
12 mar, 18:00`) **solo** cuando `end_date` existe y difiere de `event_date`. El caso de
un día se sigue pintando `09:00 – 18:00`, igual que hoy, para no tocar lo del panel.

## Considered Options

- **Horario diario** (las mismas horas cada día). Es la lectura más natural para un
  congreso de tres días, y probablemente lo que un residente teclea sin pensarlo. Se
  descarta porque colisiona con el significado que el panel ya escribe en esas columnas,
  y la colisión es **silenciosa**: dos filas idénticas querrían decir cosas distintas.
- **Horario solo en eventos de un día**: se ocultan Empieza/Termina si el Curso o el
  Congreso duran más de uno. Cero ambigüedad y cero código de pintado nuevo, pero quita
  la hora justo en los dos tipos donde el residente más la va a querer.
- **Columnas nuevas para el horario del residente**, dejando `start_time`/`end_time` como
  territorio del panel. Elimina la colisión de raíz, a cambio de una migración y de que
  todo lector tenga que mirar en dos sitios y decidir cuál gana. Desproporcionado para un
  campo que es solo informativo.
- **Un flag `daily_schedule`** que distinga las dos lecturas. Permitiría las dos, pero
  añade un booleano que hay que explicar en cada superficie y que el panel no escribiría
  nunca — un tercer estado (`null`) que volvería a ser ambiguo.

## Consequences

- **Difícil de revertir en los datos.** En cuanto haya congresos guardados como tramo
  continuo, reinterpretarlos como horario diario cambia su significado sin que nada en la
  fila lo delate, y no hay forma de saber qué quiso decir cada residente.
- El residente que quiera decir "de 9 a 18 los tres días" **no tiene cómo**. Le queda el
  campo de Notas. Es una pérdida real y aceptada: el horario es informativo, no un
  cuadrante.
- `all_day` pasa a derivarse (`all_day = !start_time`) en vez de conservarse. Los eventos
  del panel con `all_day = false` y sin horas siguen mostrando "Hora por concretar"
  porque no se editan desde la app.
- El horario **no** altera cuándo llega el push: `enqueue_due_agenda_event_reminders`
  compara solo fechas (`20260316153000_agenda_event_reminders.sql`). Un evento a las
  21:52 avisa el mismo día y a la misma hora que uno de todo el día.
- El orden dentro del día sale gratis: `agendaService.js` y `AgendaScreen.js` ya ordenan
  por `start_time || "00:00:00"`.
- **Estudio queda con dos formas de decir la duración**: `metadata.study_minutes` y el
  horario, sin que nadie compruebe que cuadren. Se acepta a sabiendas —los dos son
  informativos y `study_minutes` no alimenta ningún cálculo—, pero el detalle puede
  enseñar `17:00 – 19:00` y `45 min` a la vez.
