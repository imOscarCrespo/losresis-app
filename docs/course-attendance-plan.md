# Plan: inscripción en la app y asistencia a cursos

Plan cerrado el 2026-10-11. Todas las decisiones de producto ya están tomadas (sección 2). Si algo
del código o de la base no cuadra con lo que se describe aquí, **para y pregunta**; no inventes otra
regla.

## 0. Cómo trabajar

- Repos: `~/code/losresis-shared/losresis-db` (migraciones, fuente de verdad), `losresis-app`
  (Expo/React Native, JS), `losresis-panel` (Next.js, TS). Lee el `AGENTS.md` de app y panel antes
  de empezar: allí están las convenciones de headers (`HeroScreenLayout`), iconos (`components/Icon.js`,
  solo Phosphor), la paleta del panel y los nombres en inglés para todo lo de base de datos.
- Proyecto Supabase: `chgretwxywvaaruwovbb`.
  - Lectura: `mcp__supabase__execute_sql` con ese `project_id` (corre como usuario de solo lectura).
  - DDL: `mcp__supabase__apply_migration` (el CLI `supabase db query --linked` ha dado 403; pruébalo
    solo si el MCP falla). Nunca `supabase db push` ni escribir en `supabase_migrations.schema_migrations`.
  - Aplicar las migraciones es tarea tuya: escribe el `.sql` en `losresis-db`, ensáyalo, aplícalo,
    verifícalo y commitéalo. No dejes nada pendiente de aplicar.
- Procedimiento por migración: comprobaciones previas en solo lectura → ensayo dentro de un
  `DO $$ … RAISE EXCEPTION 'rollback'; $$` (revierte todo) → aplicar → verificar con datos reales
  simulando sesiones (`set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`)
  → probar lo que debe fallar (`anon`, otro usuario, gestor de otra org).
- **Grants**: en esta base toda función nueva nace con EXECUTE para `anon` y `authenticated`
  (default privileges). En cada función nueva:
  ```sql
  REVOKE ALL ON FUNCTION public.f(args) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.f(args) FROM anon;
  REVOKE ALL ON FUNCTION public.f(args) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.f(args) TO authenticated; -- solo si la llama un cliente
  GRANT EXECUTE ON FUNCTION public.f(args) TO service_role;
  ```
  Verifica con `has_function_privilege('anon','public.f(args)','EXECUTE')` = false. Igual con las
  tablas nuevas: `REVOKE ALL ON TABLE … FROM anon`.
- Toda función `SECURITY DEFINER` lleva `SET search_path = public` y comprueba `auth.uid()` ella
  misma; no confíes en que el cliente pase el usuario.
- "Hoy" siempre es la fecha de Madrid: `(now() AT TIME ZONE 'Europe/Madrid')::date`. La base está
  en UTC.
- Textos al usuario en español; identificadores en inglés.

### Entrega

- Commits locales separados por repo y por paso lógico. **Sin push**, sin EAS Update y sin desplegar
  el panel: eso lo hace el usuario.
- `losresis-db` tiene trabajo del usuario sin trackear: `20261011120000_hospital_profile_documents_and_video.sql`
  (no lo toques ni lo commitees) y `20261011140000_hospital_open_day_registrants_rpc.sql` (ver paso 1).
  La rama ya va 1 commit por delante de origin; no pasa nada.
- `losresis-app` tiene `data/staticCatalog/*.json` modificados por el usuario: no los commitees.
- Antes de commitear en la app, pasa el skill `bug-review` en modo gate sobre el diff. En el panel:
  `npm run lint`, `npx tsc --noEmit`, `npm test`.
- Este fichero de plan no se commitea.

## 1. Contexto: cómo está hoy

- `public.courses`: la crea un hospital desde el panel (`org_id`, `status` draft/published/archived) o
  un usuario desde la app. Fechas en `event_dates date[]` (solo días; 37 de 64 cursos con org tienen
  varios días). `seats_available int` (null = sin límite). `registration_url` es un formulario externo.
- En la app, "Inscribirme" (`screens/CourseDetailScreen.js`, ~línea 197) solo abre `registration_url`.
  En la base no queda nada de quién se inscribe. Solo existe `course_like`.
- RLS: `courses`, `agenda_events` y `employer_account` tienen una política `allow_all` (cualquiera lee
  y escribe). No es tarea de este plan arreglarlas, pero **por eso** todo lo nuevo se escribe solo por
  RPC y las tablas nuevas no se pueden escribir directamente desde el cliente.
- Gestor de una org = fila de `employer_account` con `org_id = courses.org_id`, `user_id = auth.uid()`
  y `is_active`. Roles existentes: `owner`, `editor`, `speciality_manager`; todos cuentan.
  Modelo a copiar: `public.hospital_open_day_managing_account(uuid)`.
- Push: insertar en `public.notifications (user_id, type, title, body, entity_type, entity_id, data)`.
  Un trigger llama a la edge function `send-push-notifications`. Con `entity_type = 'course'` y
  `entity_id = <course_id>`, la app ya abre el detalle del curso (`screens/DashboardScreen.js`,
  handler de `setNotificationNavigationHandler`, ~línea 561). Modelo de recordatorio:
  `public.send_hospital_tutoring_reminders`. Revisa también `set_notification_destination()` (trigger
  BEFORE INSERT) y la edge function por si filtran por `type`.
- Copias en agenda: modelo de `crear_evento_servicio` (migración `20260727120000_eventos_del_servicio.sql`):
  inserta en `agenda_events` con `metadata` que apunta al origen.
- Deep links: la app registra el esquema `losresis://` (iOS y Android) pero solo lo procesa para
  `losresis://auth/callback` en `services/authService.js`. No hay listener general de `Linking`.
- La app no tiene `expo-camera` ni librería de QR: **no se añade ninguna**. Todo es JS y sale por
  EAS Update.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Inscripción vs. formulario externo | Selector por curso en el panel: `external` (como hoy) o `in_app`. Los cursos existentes quedan en `external`. |
| Quién se inscribe | Cualquier usuario que vea el curso. La audiencia `notify_*` solo decide a quién se notifica. |
| Plazas | `seats_available` es el aforo total. Si está lleno, se bloquea ("Completo"). Sin lista de espera. Al cancelar se libera la plaza. Null = sin límite. |
| Asistencia | QR dinámico proyectado desde el panel + pase de lista manual en el panel para corregir o completar. |
| Granularidad | Un fichaje de entrada por cada día de `event_dates`. % = días fichados / días del curso. Sin horas. |
| Fichar sin inscripción | No. La app dice "No estás inscrito"; el gestor puede añadirlo a mano desde el panel. |
| Permisos del panel | Cualquier `employer_account` activa de la org propietaria del curso. |
| Enlace del QR | `losresis://course-checkin?c=<course_id>&k=<code>` + el mismo código de 6 dígitos en grande para teclearlo en la app (la cámara de muchos Android no abre esquemas propios). |
| Extra 1 | Recordatorios push a inscritos. |
| Extra 2 | Cerrar la RLS `allow_all` de `hospital_open_day_registration`. |

## 3. Base de datos (`losresis-db`)

### Paso 1. Aplicar la migración del usuario `20261011140000_hospital_open_day_registrants_rpc.sql`

Está escrita pero **no aplicada**. El panel ya la llama (`src/hooks/useHospitalOpenDays.ts`) y, si no
existe, cae a leer la tabla directamente, que dejará de funcionar en el paso 5. Aplícala tal cual
(con el procedimiento de la sección 0), verifica que un gestor del hospital ve inscritos y que `anon`
no puede ejecutarla, y commitéala **sola** con un mensaje que diga que es del usuario.

### Paso 2. `20261011150000_course_enrollment_and_attendance.sql`

Todo aditivo e idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`).

**Columna nueva en `courses`**
```sql
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS enrollment_mode text NOT NULL DEFAULT 'external'
  CHECK (enrollment_mode IN ('external','in_app'));
```
Comprueba antes que el trigger `trg_enforce_course_plan_limits` no bloquea un UPDATE que solo
cambie esta columna.

**Tablas**
- `course_enrollment`
  - `id uuid pk default gen_random_uuid()`
  - `course_id uuid not null references courses(id) on delete cascade`
  - `user_id uuid not null references users(id) on delete cascade` (borrar la cuenta borra la inscripción y su asistencia)
  - `enrolled_by_account_id uuid references employer_account(id) on delete set null` (null = se inscribió el propio usuario)
  - `created_at timestamptz not null default now()`
  - `unique (course_id, user_id)`; índices en `(course_id)` y `(user_id)`.
- `course_attendance`
  - `id uuid pk`, `enrollment_id uuid not null references course_enrollment(id) on delete cascade`
  - `session_date date not null`
  - `method text not null check (method in ('qr','manual'))`
  - `marked_by_account_id uuid references employer_account(id) on delete set null` (solo en `manual`)
  - `checked_in_at timestamptz not null default now()`
  - `unique (enrollment_id, session_date)`
- `course_checkin_window` (la "sesión de fichaje" abierta por el gestor un día concreto)
  - `id uuid pk`, `course_id uuid not null references courses(id) on delete cascade`
  - `session_date date not null`
  - `secret bytea not null default extensions.gen_random_bytes(32)`
  - `opened_by_account_id uuid references employer_account(id) on delete set null`
  - `opened_at timestamptz not null default now()`, `closed_at timestamptz`
  - `unique (course_id, session_date)` (reabrir = poner `closed_at = null`)

**RLS**: activar en las tres.
- `course_enrollment`: `SELECT` para `authenticated` con `user_id = auth.uid()`. Sin políticas de
  escritura.
- `course_attendance`: `SELECT` para `authenticated` si la inscripción es suya. Sin escritura.
- `course_checkin_window`: ninguna política (el `secret` no debe salir nunca de la base).
- `REVOKE ALL … FROM anon` en las tres; `GRANT SELECT` a `authenticated` solo en las dos primeras.

**Helpers**
- `course_managing_account(p_course_id uuid) returns uuid`: copia de
  `hospital_open_day_managing_account` pero con `ea.org_id = c.org_id`. STABLE, SECURITY DEFINER.
- `course_checkin_code(p_secret bytea, p_bucket bigint) returns text` (interna, sin grant a clientes):
  6 dígitos derivados de `extensions.hmac(p_bucket::text, p_secret, 'sha256')` (p. ej. los primeros
  4 bytes como entero `% 1000000`, con ceros a la izquierda).
  Bucket = `floor(extract(epoch from now()) / 30)`: el código cambia cada 30 s.
- `madrid_today() returns date` si no existe ya algo equivalente (búscalo antes).

**RPC del residente** (grant a `authenticated`; errores con `RAISE EXCEPTION` y un código legible en
`MESSAGE`, p. ej. `'course_full'`, para que la app los traduzca):
- `get_course_enrollment_summary(p_course_id uuid) returns jsonb`:
  `{enrollment_mode, seats_available, enrolled_count, is_enrolled, can_cancel, attended_dates[],
  session_dates[], is_session_today, checkin_open_now}`. La usa el detalle del curso de la app.
- `enroll_in_course(p_course_id uuid) returns jsonb`:
  - Bloquea el curso con `SELECT … FOR UPDATE` (evita superar el aforo con inscripciones simultáneas).
  - Errores: `course_not_found`, `course_not_open` (no publicado o `enrollment_mode <> 'in_app'`),
    `course_finished` (último día de `event_dates` < hoy), `course_full`.
  - Ya inscrito → devuelve `{status:'already_enrolled'}` sin error.
  - Crea la inscripción y las copias en agenda (ver abajo).
- `cancel_course_enrollment(p_course_id uuid) returns void`: solo si hoy < primer día de
  `event_dates`; si no, `cancel_not_allowed`. Borra la fila.
- `check_in_course(p_course_id uuid, p_code text) returns jsonb`:
  - Errores: `not_enrolled`, `no_session_today` (hoy no está en `event_dates`), `checkin_closed`
    (no hay ventana abierta hoy o tiene `closed_at`), `invalid_code`.
  - Acepta el código del bucket actual y del anterior (validez real 30–60 s).
  - `INSERT … ON CONFLICT DO NOTHING`; devuelve `{status:'checked_in'|'already_checked_in', session_date}`.

**RPC del gestor** (todas empiezan comprobando `course_managing_account(...) IS NOT NULL`; si no,
`not_allowed`):
- `get_course_enrollments(p_course_id uuid)` → tabla con `enrollment_id, user_id, created_at,
  enrolled_by_account_id, name, surname, email (auth.users), work_email, phone, is_student,
  is_resident, resident_year, speciality_name, avatar_url, attended_dates date[]`. Modelo: el RPC
  del paso 1.
- `add_course_enrollment_by_email(p_course_id uuid, p_email text)`: busca el usuario en
  `auth.users` (sin distinguir mayúsculas) o por `users.work_email`. Errores `user_not_found`.
  **Ignora el aforo** (lo decide el gestor). Rellena `enrolled_by_account_id` y crea las copias en agenda.
- `remove_course_enrollment(p_enrollment_id uuid)`: error `has_attendance` si tiene algún fichaje.
- `set_course_attendance(p_enrollment_id uuid, p_session_date date, p_attended boolean)`:
  `p_session_date` debe estar en `event_dates` y ser ≤ hoy. `true` → inserta `method='manual'`
  (si ya existe por QR, no lo toques); `false` → borra el fichaje sea del método que sea.
- `open_course_checkin(p_course_id uuid) returns jsonb`: solo si hoy está en `event_dates` y el curso
  es `in_app`. Crea la ventana o la reabre.
- `get_course_checkin_code(p_course_id uuid) returns jsonb`: `{code, expires_at, session_date,
  checked_in_count, enrolled_count, is_open}` de la ventana de hoy. El panel la consulta cada ~5 s.
- `close_course_checkin(p_course_id uuid)`: pone `closed_at = now()`.

**Copias en agenda** (función interna `sync_course_enrollment_agenda(p_enrollment_id uuid)`, sin
grant a clientes):
- Borra las copias que tenga la inscripción y crea una por cada fecha de `event_dates`:
  `event_type 'course'`, `all_day true`, `title = courses.title`, `notes` = sede y dirección si
  existen, `metadata = {course_id, course_enrollment_id}`.
- Trigger `AFTER DELETE ON course_enrollment` → borra las copias con
  `metadata->>'course_enrollment_id' = OLD.id::text`. Cubre cancelar, que el gestor quite a alguien
  y que se borre el curso (cascade).
- Trigger `AFTER UPDATE OF event_dates, title, venue_name, venue_address ON courses` → si es
  `in_app`, resincroniza las copias de todos sus inscritos.
- Cuando el usuario se borra, sus `agenda_events` ya caen por `agenda_events.user_id ON DELETE CASCADE`.

**Verificación mínima del paso 2**
- `anon`: sin acceso a las tres tablas ni a ninguna RPC.
- Residente A no ve la inscripción de B; no puede insertar directamente en las tablas.
- Gestor de otra org: `not_allowed` en todas las RPC de gestor.
- Aforo: con `seats_available = 1`, la segunda inscripción da `course_full`.
- Código: el de hace 2 buckets da `invalid_code`; el actual y el anterior funcionan.
- Borrar un usuario de prueba (dentro del `DO … RAISE EXCEPTION`) no falla por FKs.
- `explain` de `get_course_enrollments` sobre un curso real: usa los índices.

### Paso 3. `20261011160000_course_session_reminders.sql`

- `send_due_course_session_reminders() returns integer`, SECURITY DEFINER, sin grant a clientes.
  Se ejecuta cada hora y decide por la hora de Madrid (así no le afecta el cambio de horario):
  - A las 18:00 de Madrid: a cada inscrito de un curso `in_app` publicado cuyo `event_dates` incluye
    **mañana** → `type 'course_session_reminder'`, título `"Mañana: <título>"`, cuerpo
    `"Recuerda fichar tu asistencia con el QR de la sala."`.
  - A las 08:00 de Madrid: lo mismo para **hoy** → `type 'course_checkin_reminder'`, título
    `"Hoy: <título>"`, cuerpo `"Al llegar, escanea el QR de la sala o introduce el código en el curso."`.
  - `entity_type 'course'`, `entity_id = course_id`, `data = {course_id, session_date}`.
  - Sin duplicados: `NOT EXISTS` en `notifications` con mismo `user_id`, `type`, `entity_id` y
    `data->>'session_date'`.
  - Son recordatorios de algo a lo que el usuario se ha apuntado: no apliques las preferencias de
    notificación de cursos (`user_notification_preferences`). Si el código existente obliga a otra
    cosa, pregunta.
- `cron.schedule('course-session-reminders-hourly', '0 * * * *', 'select public.send_due_course_session_reminders();')`
  de forma idempotente (desprograma antes si ya existe).
- Verifica `set_notification_destination()` y la edge function `send-push-notifications` por si hay
  una lista de `type` permitidos.

### Paso 4. Tipos y catálogo

- Los cursos no están en `data/staticCatalog`, así que no hace falta regenerarlo. Compruébalo con un
  grep antes de darlo por hecho.

### Paso 5. `20261011170000_open_day_registration_rls.sql` (solo después del paso 1)

- `DROP POLICY hospital_open_day_registration_allow_all`.
- Políticas para `authenticated` con `user_id = auth.uid()`: `SELECT`, `INSERT` (with check),
  `UPDATE` (using + with check; la app hace `upsert`, que necesita UPDATE) y `DELETE`.
- `REVOKE ALL ON TABLE public.hospital_open_day_registration FROM anon`.
- Lectores conocidos: `losresis-app/services/hospitalService.js` (`getMyOpenDayRegistrations`,
  `registerForHospitalOpenDay`; los dos usan el propio usuario) y el panel por RPC. Las funciones
  SECURITY DEFINER de `20260812140000_hospital_open_day_section.sql` no se ven afectadas.
- Antes de aplicarlo, haz un grep en los cinco repos para confirmar que no hay más lectores.
- En el panel, elimina la lectura directa de respaldo de `fetchRegistrants`
  (`src/hooks/useHospitalOpenDays.ts`): con la RLS cerrada devolvería una lista vacía en silencio.
  Que un error del RPC se muestre como error.
- Verifica: un usuario registra y lee lo suyo desde la app, no ve lo de otros, `anon` no lee nada y el
  gestor sigue viendo inscritos en el panel.

## 4. App (`losresis-app`)

Todo en JS: sale por EAS Update. Nada nativo.

1. **`services/courseEnrollmentService.js`** (nuevo, mismo estilo que `lectureService.js`, devuelve
   `{success, data, error}`): `getCourseEnrollmentSummary`, `enrollInCourse`, `cancelCourseEnrollment`,
   `checkInCourse(courseId, code)`. Traduce los códigos de error de la sección 3 a textos en español
   ("El curso está completo", "Hoy no hay sesión de este curso", "El fichaje aún no está abierto",
   "Código incorrecto o caducado", "No estás inscrito en este curso"…).
2. **`screens/CourseDetailScreen.js`**:
   - `enrollment_mode === 'external'` (o ausente): nada cambia.
   - `in_app`: carga el resumen. El botón principal pasa a ser "Inscribirme", "Inscrito ✓" o
     "Completo" (deshabilitado). Si `can_cancel`, enlace "Cancelar inscripción" con confirmación
     (con un modal de la app, no `Alert` encadenados). Muestra "Quedan N plazas" si hay aforo.
     Si `in_app`, ignora `registration_url`.
   - Si está inscrito y `is_session_today`: sección "Asistencia de hoy" con botón "Fichar" que abre
     un modal con un campo de 6 dígitos (teclado numérico) → `checkInCourse`. Si ya fichó:
     "Asistencia registrada ✓".
   - Si está inscrito: lista de días del curso con su estado (fichado / pendiente / no asistió).
   - Acepta un prop/param nuevo `checkinCode`: si llega, lanza el fichaje al montar (deep link) y
     muestra el resultado.
3. **Deep link** `losresis://course-checkin?c=<course_id>&k=<code>`:
   - En `screens/DashboardScreen.js`, junto al `setNotificationNavigationHandler`, añade un listener
     de `Linking` de `react-native` (`getInitialURL` + `addEventListener('url')`) que **solo** procese
     el host `course-checkin` y llame a
     `handleSectionChange('courseDetail', { courseId, checkinCode })`. No toques ni interceptes
     `losresis://auth/callback`.
   - Comprueba que `handleSectionChange` y el estado persistido (`selectedCourseId`, ~línea 833)
     pasan el código sin guardarlo en `AsyncStorage` (un código caducado no debe relanzarse al
     reabrir la app).
   - Si el usuario no ha iniciado sesión, el enlace se pierde: aceptable (puede teclear el código).
4. **Agenda**: comprueba cómo pinta `AgendaScreen` las copias con `metadata.course_id` (tipo `course`).
   Si las copias de evento del servicio tienen tratamiento de solo lectura, aplica lo mismo; si no,
   no cambies nada.
5. **Analítica**: añade eventos PostHog `course_enrolled`, `course_enrollment_cancelled` y
   `course_checked_in` (`{course_id, method: 'deep_link'|'code'}`) siguiendo `docs/posthog-events.md`.
6. Icono, header y layout según `AGENTS.md`. No subas versión en `app.json` (lo hace el usuario).

Compatibilidad: las versiones antiguas de la app no conocen `enrollment_mode`. En un curso `in_app`
verán el botón externo solo si el curso tiene `registration_url`. Por eso el panel avisa (ver abajo).

## 5. Panel (`losresis-panel`)

1. **Tipos** (`src/types/index.ts`): `enrollment_mode: 'external' | 'in_app'` en el curso, y los
   tipos de las filas de las RPC.
2. **`src/components/CourseForm.tsx`**: selector "Inscripción" con dos opciones: "En la app de
   LosResis (permite medir asistencia)" y "Formulario externo". Con `in_app`, `registration_url` pasa
   a ser opcional, con la ayuda: "Solo lo verán usuarios con versiones antiguas de la app". Con
   `external` se queda como hoy. Guarda el valor en `useCourses.ts`.
3. **`src/lib/courseAttendance.ts`** (+ `courseAttendance.test.ts`): funciones puras: `% asistencia`,
   `isSessionToday(event_dates, now)` (en Madrid), construcción del CSV (una fila por inscrito, una
   columna por día con Sí/No, % final; con separador `;` y BOM para Excel en español).
4. **`src/app/dashboard/courses/[id]/page.tsx`**, solo si `in_app`:
   - Sección "Inscritos (N / aforo)": tabla con nombre, email, especialidad, año, una casilla por día
     del curso (marcar o desmarcar asistencia manual; deshabilitadas las fechas futuras) y % de
     asistencia. Un fichaje por QR se distingue visualmente del manual.
   - "Añadir por email" → `add_course_enrollment_by_email`. "Quitar" → `remove_course_enrollment`
     (deshabilitado con tooltip si tiene asistencia).
   - "Exportar CSV".
   - Botón "Abrir fichaje de hoy", activo solo si hoy está en `event_dates` → abre la ruta nueva.
5. **Ruta nueva `src/app/dashboard/courses/[id]/checkin/page.tsx`** (pantalla para proyectar):
   - Llama a `open_course_checkin` al entrar y luego a `get_course_checkin_code` cada 5 s.
   - QR grande con `losresis://course-checkin?c=<id>&k=<code>`, el código de 6 dígitos en grande, una
     cuenta atrás hasta `expires_at`, "Fichados X de Y" y un texto fijo: "Escanea el QR con la cámara
     o abre el curso en LosResis y pulsa Fichar".
   - Botón "Cerrar fichaje" → `close_course_checkin` y vuelve al detalle.
   - QR: añade la dependencia `qrcode` (+ `@types/qrcode`) con una versión exacta publicada hace más
     de dos semanas, y genera el QR en el cliente (SVG o canvas).
   - Paleta y estilos según `AGENTS.md` del panel.
6. Rutas: `/dashboard/courses` no está en `MEMBER_ALLOWED_PATHS` ni en `OWNER_ONLY_PATHS`; la subruta
   nueva hereda esa regla. No cambies `accountScope.ts`.
7. **ADR**: añade `docs/adr/0036-asistencia-a-cursos-con-codigo-rotatorio.md` (formato de los
   anteriores): por qué un código HMAC por bucket de 30 s con secreto en la base, por qué deep link
   + código y no cámara nativa, por qué un fichaje por día.

## 6. Casos límite que hay que cubrir

- Curso de varios días con fechas no consecutivas: una copia en agenda y un fichaje por cada fecha.
- El gestor cambia las fechas después de que haya inscritos: el trigger resincroniza las agendas. Los
  fichajes de fechas que ya no existen se quedan (no se borran), pero no cuentan para el %; el panel
  solo muestra las columnas de `event_dates` actuales.
- El curso pasa de `in_app` a `external` con inscritos: las inscripciones se quedan y el panel sigue
  mostrándolas en solo lectura. La app vuelve al botón externo.
- El gestor baja el aforo por debajo de los inscritos: nadie pierde su plaza; simplemente no entran más.
- Fichar con el código de ayer o de otro curso: `invalid_code` o `no_session_today`.
- Fichar dos veces el mismo día: `already_checked_in`, sin error visible.
- Dos pestañas del panel con el fichaje abierto: el mismo secreto muestra el mismo código.
- Borrar la cuenta de un residente: su inscripción, su asistencia y sus copias de agenda desaparecen
  sin bloquear el borrado.
- Borrar la cuenta de un gestor que marcó asistencias: `marked_by_account_id` y
  `opened_by_account_id` pasan a null.
- Un usuario borra a mano su copia en la agenda: no afecta a la inscripción.

## 7. Orden de ejecución

1. Paso 1 (migración del usuario) → commit en `losresis-db`.
2. Paso 2 → verificación → commit.
3. Paso 3 → verificación (llama a la función en un `DO … RAISE EXCEPTION` con un curso de prueba con
   la hora simulada o con una variante parametrizada) → commit.
4. Panel: tipos, formulario, detalle, fichaje, ADR, tests → lint/tsc/test → commit.
5. App: servicio, detalle, deep link, analítica → `bug-review` gate → commit.
6. Paso 5 (RLS open days) + quitar el respaldo del panel → verificación → commits.
7. Prueba de punta a punta contra producción con un curso de prueba en borrador de una org de prueba
   (pide al usuario cuál usar si no hay una evidente): inscribirse, abrir fichaje, fichar con el
   código, marcar y desmarcar a mano, exportar CSV. **Borra después los datos de prueba.**
8. Informe final al usuario: commits por repo, migraciones aplicadas, qué queda para él (push, EAS
   Update, desplegar el panel) y cualquier desviación del plan.
