# Glosario de dominio — LosResis

## Residente

Usuario de la app que está cursando la residencia médica. Tiene hospital, especialidad y año de residencia. Accede a la **Agenda** para registrar su actividad clínica y formativa.

## Agenda

Vista unificada de calendario personal del **Residente**. Agrupa todos sus eventos en un solo lugar. Implementada en `screens/AgendaScreen.js`.

## Evento de agenda

Unidad mínima de la **Agenda**. Tiene fecha, tipo y metadatos opcionales según el tipo. Los tipos existentes son: `shift` (Guardia), `course`, `research`, `study`, `conference`, `day_off`, `reminder`. Persiste en la tabla `agenda_events`.

## Guardia

Evento de agenda de tipo `shift`. Representa un turno de guardia médica del **Residente**. Siempre tiene una fecha exacta y una duración (`24h` o `12h`). Al crearse, genera simultáneamente un registro en la tabla legacy `shifts` enlazado por `source_shift_id`.

## Lote de guardias

Conjunto de **Guardias** creadas en una sola operación a partir de múltiples fechas seleccionadas en el calendario. Comparten los mismos valores de duración, notas y recordatorio. El lote se forma en el **Modo selección de guardias**.

## Modo selección de guardias

Estado temporal de la **Agenda** en el que el calendario acepta múltiples toques de fechas para construir un **Lote de guardias**. Se activa al elegir "Guardia" en el selector de tipo. Las fechas que ya tienen una **Guardia** aparecen bloqueadas y no son seleccionables. El modo termina cuando el usuario confirma la selección o cancela.

## Salud mental

Sección de la app dedicada al bienestar del **Residente**. Agrupa las **Evaluaciones de bienestar** y los **Recursos de ayuda**. Su lenguaje es deliberadamente no clínico: no diagnostica.
_Evitar_: sección de burnout, sección de diagnóstico.

## Evaluación de bienestar

Una medición individual que hace el **Residente** sobre su propio estado, basada en el cuestionario CBI. Devuelve tres puntuaciones (personal, laboral, por pacientes) que se siguen en el tiempo. Es autoconocimiento, no un diagnóstico ni una clasificación en niveles.
_Evitar_: test de burnout, diagnóstico, cuestionario clínico.

## Recurso de ayuda

Contacto externo de apoyo profesional que la **Sección de salud mental** ofrece al **Residente** (PAIME por comunidad autónoma, líneas de crisis como el 024). Siempre accesible, nunca condicionado a una puntuación.
_Evitar_: alerta, derivación.
