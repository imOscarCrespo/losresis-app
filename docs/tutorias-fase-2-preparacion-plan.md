# Tutorías · Fase 2 — Preparación de la tutoría por el residente

Plan para ejecutar con `/clickup-task https://app.clickup.com/t/90151808476/124b4z9vc4q`
(misma tarea de ClickUp; esta pasada es **solo la fase 2**). Escrito el 2026-10-27 al
cerrar las fases 1 y 3.

## Contexto (lo que ya está hecho y no se vuelve a discutir)

- Fases 1 + 3 en producción desde 2026-10-27, solo BD + panel:
  - migración `losresis-db/20261027120000_tutoring_structured_record.sql`
    (período, valoración global, puntos fuertes, `reviewed_areas`, objetivos
    `hospital_tutoring_goal` + `hospital_tutoring_goal_review`, plan
    `hospital_tutoring_work_item`, RPC `save_hospital_tutoring_record`);
  - ficha del panel en `losresis-panel/src/app/dashboard/tutorias/[id]/page.tsx`
    (commit `8562e1a`). La pestaña «Preparación del residente» y la tarjeta de la
    derecha enseñan hoy los 4 campos antiguos de `resident_answers`.
- Decisiones del usuario: la fase 2 va a la **versión 1.0.95** de la app
  (`app.json` está en 1.0.94 / build 113, así que se abre la versión). El formulario
  nuevo es para **todos los hospitales**, no solo Sant Pau.
- Hasta la fase 4 la app publicada ve la valoración del tutor por la copia en
  `notes`/`next_goals` (`legacy_fields_mirrored`). Esta fase no toca eso.
- No hay sistema de avisos al panel: «el tutor recibe una indicación» = estado
  visible en el listado y en la ficha (columna «Preparación»), no un push.

## Qué pide producto (§4 y §5 bloque 1 de la tarea)

Sustituir los 4 campos libres del residente por **«Preparación de mi tutoría»**:

| Apartado | Clave | Pregunta |
|---|---|---|
| A. Evolución formativa | `learnings` | ¿Cuáles han sido tus principales aprendizajes durante este período? |
| | `goals_achieved` | ¿Qué objetivos formativos consideras que has alcanzado? |
| | `improved` | ¿En qué aspectos consideras que has mejorado? |
| B. Rotaciones realizadas | `rotations` | ¿Cómo valorarías las rotaciones realizadas durante este período? |
| | `difficulties` | ¿Qué dificultades has encontrado? |
| | `competencies_to_reinforce` | ¿Qué competencias te gustaría reforzar? |
| C. Guardias y actividad asistencial | `on_call` | ¿Cómo valorarías tu evolución durante las guardias? |
| | `autonomy_supervision` | ¿Consideras adecuado tu nivel de autonomía y supervisión? |
| D. Reflexión personal | `needs_improvement` | ¿Qué aspectos consideras que necesitas mejorar? |
| | `support_needs` | ¿Hay alguna dificultad o necesidad de apoyo que quieras comentar con tu tutor? |
| E. Objetivos para el siguiente período | `proposed_goals` (lista) | ¿Qué objetivos te gustaría plantearte hasta la próxima tutoría? |

- Dos acciones: **Guardar borrador** (el tutor NO lo ve) y **Enviar preparación al
  tutor**. Estados: Sin iniciar / Borrador / Enviada (con fecha).
- Editable hasta la celebración. Los objetivos del apartado E son **propuestas**:
  no se convierten en `hospital_tutoring_goal` (eso lo decide el tutor en la ficha).
- Panel: tarjeta «Reflexión previa del residente», solo lectura, que se actualiza
  sola; si no hay envío: «El residente todavía no ha completado la preparación de
  esta tutoría».

## Solución

### 1. `losresis-db` — `2026102xxxxxxx_tutoring_resident_preparation.sql`

Tabla nueva, **no** `resident_answers`: la app publicada reescribe ese jsonb entero
con `save_hospital_tutoring_resident_answers`, así que lo pisaría. Y una tabla
aparte es lo que permite esconder el borrador al tutor por RLS (la fila de
`hospital_tutoring` el panel la lee entera).

```
hospital_tutoring_preparation (
  tutoring_id uuid PK → hospital_tutoring(id) ON DELETE CASCADE,
  resident_user_id uuid NOT NULL → users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}',          -- claves de la tabla de arriba
  proposed_goals jsonb NOT NULL DEFAULT '[]',   -- array de strings
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  sent_at timestamptz,                          -- primer envío
  created_at, updated_at (+ trigger updated_at)
)
```

- RLS:
  - residente: `SELECT` de lo suyo (`resident_user_id = auth.uid()`);
  - panel: `SELECT` con `has_teaching_scope(t.hospital_id, t.speciality_id)` **y
    `status = 'sent'`** (el borrador no sale);
  - sin `INSERT/UPDATE/DELETE` directos; `REVOKE ALL FROM anon`.
- RPC `save_hospital_tutoring_preparation(p_tutoring_id uuid, p_answers jsonb,
  p_proposed_goals jsonb, p_send boolean)` SECURITY DEFINER, `SET search_path =
  public`:
  - `auth.uid()` tiene que ser el residente de la tutoría (si no, excepción);
  - tutoría `cancelled` o `finished` → excepción («ya no se puede modificar»);
  - normaliza: solo claves conocidas, textos recortados, objetivos no vacíos;
  - `p_send = true` exige al menos una respuesta u objetivo; pone `status='sent'` y
    `sent_at = COALESCE(sent_at, now())`;
  - una preparación enviada **no vuelve a borrador**: guardar después de enviar
    mantiene `sent` y actualiza el contenido (el tutor ve lo último);
  - upsert por `tutoring_id`.
- Idempotente, solo añade. La app publicada no la lee: no cambia nada para ella.
- Ensayo con rollback (paso 4b del skill): como residente guarda borrador y el
  tutor (owner E2E `c7cec1f1-…`) **no** lo ve; envía y sí lo ve; otro residente no
  puede escribir; `anon` fuera; finalizada/cancelada rechaza; la RPC antigua
  `save_hospital_tutoring_resident_answers` sigue funcionando.

### 2. `losresis-app` (versión 1.0.95)

- Abrir la versión (paso 5 del skill): `app.json` 1.0.95, buildNumber/versionCode
  114, `docs/releases/1.0.95.md` copiando la estructura de 1.0.94.
- `utils/tutoringPreparation.js` (lógica pura, con tests en
  `__tests__/utils/tutoringPreparation.test.js`):
  - `PREPARATION_SECTIONS` (la tabla de arriba, textos tal cual);
  - `preparationStatusOf(prep)` → `none | draft | sent`;
  - `buildPreparationPayload(answers, goals)` (recorta, quita vacíos);
  - `canEditPreparation(tutoring)` (no cancelada ni finalizada);
  - `hasContent(...)` para habilitar «Enviar».
- `services/docenciaService.js`: `getTutoringPreparations(tutoringIds)` (select de
  la tabla, RLS ya filtra) y `saveTutoringPreparation(id, answers, goals, send)`.
  Tests de servicio con Supabase mockeado (ver
  `__tests__/services/residentPayoutService.test.js`), incluido el camino de error.
- `screens/TutoringScreen.js`:
  - El detalle de una tutoría no cerrada abre «Preparación de mi tutoría»:
    apartados A–E con sus preguntas, lista de objetivos (añadir/quitar, uno por
    campo), botones «Guardar borrador» y «Enviar preparación al tutor» (confirmación
    con `Alert`). Tras enviar, el botón pasa a «Guardar cambios».
  - Chip de estado en la tarjeta y en el detalle: Sin iniciar / Borrador /
    Enviada el dd/mm.
  - Finalizada o cancelada: la preparación se ve en solo lectura.
  - Si la tutoría tiene `resident_answers` antiguos con contenido, enseñarlos en
    solo lectura como «Lo que escribiste antes» (no se migran).
  - Se retira la edición de los 4 campos antiguos (`TUTORING_RESIDENT_FIELDS`),
    pero `saveTutoringResidentAnswers` puede quedarse sin uso o borrarse.
  - Lo que el tutor comparte se sigue enseñando igual que hoy (`CONTENT_FIELDS`).
  - Convenciones: `HeroScreenLayout`, iconos por `components/Icon.js`, textos en
    español.
- PostHog: `resident_tutoring_preparation_saved` con `{ sent, answered, goals }`.

### 3. `losresis-panel` (sale solo, tras la migración)

- `useTutoringRecord.ts`: leer `hospital_tutoring_preparation` de la tutoría (la
  RLS solo devuelve la enviada).
- `tutorias/[id]/page.tsx`:
  - tarjeta derecha: chip «Enviada el dd/mm/aaaa» + resumen (primeras respuestas y
    objetivos propuestos) y «Ver completa →»;
  - pestaña «Preparación del residente»: «Reflexión previa del residente» con los
    apartados A–E y los objetivos propuestos (rotulados como propuestas);
  - si no hay preparación nueva, se enseña la antigua (`resident_answers`) como hoy;
    si no hay nada, el texto de la tarea;
  - «se actualiza automáticamente»: recargar al volver el foco a la pestaña
    (`visibilitychange`), sin realtime.
- Listado `tutorias/page.tsx`: columna **Preparación** (Pendiente / Enviada) con un
  select de `tutoring_id, sent_at` de la tabla nueva.
- Las etiquetas de A–E en el panel y en la app tienen que coincidir: duplicarlas en
  `lib/tutoringPreparation.ts` con un comentario que apunte a la app (no hay paquete
  compartido).
- vitest para lo que sea lógica (resumen, estado).

## Verificación

- Jest + vitest + tsc + lint del panel en verde.
- Ensayo de la migración con rollback y comprobación de que no quedó nada.
- Maestro: `e2e/flows/clickup-124b4z9vc4q-preparacion-tutoria.yaml` con el residente
  **R1 del Hospital E2E** (`E2E_CREDENTIALS=~/.config/losresis/e2e-r1.env
  scripts/e2e.sh …`), que ya tiene la tutoría programada del **10/11/2026**
  (`1b9691d0-8234-4ee5-910f-a3c4fd9963b2`). Repetible: rellenar → «Guardar
  borrador» → reabrir y ver el borrador → enviar (o, si ya está enviada, «Guardar
  cambios») → chip «Enviada». Hace falta reconstruir el `.app` del simulador tras
  subir a 1.0.95 (memoria «Simulator min version»).
- Panel en local con `e2e-panel-owner@losresis.test` (el usuario inicia sesión; la
  contraseña va a Supabase de producción y no la teclea Claude): antes del envío
  sale «todavía no ha completado», después sale la reflexión y la columna «Enviada».

## Casos límite

- Borrador nunca visible para el tutor (RLS, probado como owner y como
  speciality_manager).
- Residente con app antigua: sigue con los 4 campos; el panel enseña esos si no hay
  preparación nueva.
- Tutoría reprogramada: la preparación cuelga del id, no de la fecha; sigue ahí.
- Tutoría cancelada: no se puede preparar; finalizada: solo lectura.
- Enviar vacío: botón deshabilitado y la RPC lo rechaza.
- Objetivos propuestos duplicados o vacíos: se limpian los vacíos; duplicados se
  dejan (son texto libre del residente).
- Borrado de usuario: FK con `ON DELETE CASCADE`, sin triggers con DML.

## Fuera de alcance (fases siguientes)

- Fase 4: que el residente vea la valoración estructurada del tutor, «Pendientes
  de validación», validar / solicitar revisión, constancia de ambas partes, PDF
  (borrador y definitivo), «Mis objetivos de mejora» en la app.
- Fase 5: actividad del Libro en la tutoría, resumen anual, indicadores.
- Convertir los objetivos propuestos en objetivos de mejora del tutor
  automáticamente.

## Cierre

Con todo verde: commit + push de `losresis-db`, panel con `vercel --prod`, app en
`main` con su entrada en `docs/releases/1.0.95.md`. **La tarea de ClickUp sigue en
«in progress»** hasta que salgan las fases 4 y 5.
