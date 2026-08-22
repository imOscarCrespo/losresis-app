# Glosario de dominio — LosResis PANEL (Next.js) y modelo compartido

> Fuentes: losresis-panel/CONTEXT.md y losresis-panel/docs/SHARED_CONTEXT.md

# LosResis Panel

Panel web de organizaciones (hospitales y empleadores) que consume la base de datos compartida con la app. Este glosario fija el lenguaje del panel; el modelo de datos base vive en `docs/SHARED_CONTEXT.md` y en `losresis-db`.

## Language

### Organización y cuentas

**Organización**:
Entidad empleadora (`employer_org`). Un hospital tiene una organización asociada mediante `hospital_id`.
_Avoid_: empresa, empleador, cuenta

**Cuenta**:
Enlace entre un usuario autenticado y una organización (`employer_account`). Una organización tiene varias cuentas, cada una con un rol. No es la única puerta del panel: los miembros del servicio sin poderes de gestión entran sin cuenta (ver ADR 0018).
_Avoid_: usuario, miembro

**Owner**:
La cuenta que creó la organización (`role = 'owner'`). Tiene acceso sin restricción a todas las especialidades de su hospital.
_Avoid_: administrador, creador

**Responsable de especialidad**:
Cuenta creada por el Owner, restringida a una o más especialidades (`role = 'speciality_manager'`). Solo ve y edita las entidades de sus especialidades. Su alcance se define en la tabla de enlace `employer_account_speciality`.
_Avoid_: tutor, editor, manager, coordinador

**Alcance de especialidad**:
Conjunto de especialidades que una cuenta puede gestionar. Vacío = todas (Owner); una o más = restringido (Responsable). Se impone solo en la UI (ver ADR 0001).
_Avoid_: permisos, scope

**Médico del equipo**:
Médico que el Owner invita con su email corporativo para trabajar en el seguimiento de su Servicio, sin cuenta ni poderes de gestión (`is_doctor = true` en `users`, sin `employer_account`). Todo Responsable es también médico; no todo médico es Responsable (ver ADR 0018).
_Avoid_: adjunto, staff, colaborador, manager

**Miembro del servicio**:
Quien tiene acceso clínico a un Servicio: los residentes y médicos cuyo perfil (`users`) apunta a ese hospital y especialidad, más las cuentas con esa especialidad en su alcance. El acceso clínico nace del perfil o del alcance, nunca del rol (ver ADR 0014 y 0018).
_Avoid_: usuario del servicio, participante, empleado

### Libro de residente

**Libro de residente**:
Registro del día a día del residente, organizado en Apartados, cada uno con el Arquetipo que le toque (ver ADR 0025). Cada residente tiene el suyo (`libro_book` + `libro_node`).
_Avoid_: cuaderno, logbook, diario

**Plantilla de libro**:
Estructura de libro que un responsable diseña por hospital+especialidad (`libro_template`), definida **por año de residencia**. Se instancia automáticamente en el libro del residente según su año.
_Avoid_: template, modelo

**Año de residencia (R1–R5)**:
Curso del residente dentro de su especialidad (`residency_year`, 1–5). Tanto el libro (`libro_book`) como la plantilla se organizan por año: cada año tiene sus propios Apartados.
_Avoid_: curso, promoción, cohorte

**Docencia**:
Quien tiene alcance docente sobre un residente, sea por rango o por especialidad: el Owner y el editor sobre todo su hospital, el Responsable de especialidad sobre las suyas. Es exactamente lo que resuelve `has_teaching_scope`, y es el actor de **Preguntar al Libro**. No es un rol nuevo en la base de datos: es el conjunto de los que ya lo tienen.
_Avoid_: tutor, unidad docente (eso es la institución), jefe de estudios

**Preguntar al Libro**:
La consulta en lenguaje natural que Docencia hace sobre los Libros de residente de su alcance ("¿cuántas intubaciones lleva Ana en 30 días?"). Traduce la pregunta a filtros y **no redacta la respuesta**: la cifra la pinta el panel. No amplía lo que Docencia puede leer, solo el camino para llegar a lo que ya ve.
_Avoid_: chat del tutor, asistente del libro, IA del libro, búsqueda (eso es Seguimiento)

**Comparativa del servicio**:
La respuesta de **Preguntar al Libro** que abarca a varios residentes a la vez ("¿quién lleva menos guardias?"). Solo existe donde hay una clave común entre libros: las **Guardias** (que salen de la Agenda) siempre, y una actividad concreta únicamente cuando los libros comparados vienen de la misma **Plantilla de libro** publicada. Sin esa clave no da un cero: dice que no puede comparar.
_Avoid_: ranking, clasificación, comparativa (a secas)

### Seguimiento de pacientes

**Seguimiento**:
El apartado donde un servicio archiva y consulta sus casos por carpetas. Es el continente; el Pase es una de sus consecuencias, no su nombre.
_Avoid_: pacientes, casos (como nombre del apartado)

**Pase**:
La reunión diaria de las 08:00 donde el equipo expone los casos documentados desde el pase anterior, y la vista que la alimenta (ventana 08:00→08:00, ver ADR 0010). Tiene entrada propia en el menú, hermana de Seguimiento.
_Avoid_: parte, traspaso, handoff, cambio de turno

**Servicio**:
Un hospital y una especialidad concretos ("Servicio de Ginecología del Hospital Clínic"): la unidad de aislamiento del seguimiento de pacientes. Se identifica por `(hospital_id, speciality_id)`; ve su contenido quien sea miembro del servicio.
_Avoid_: equipo, unidad, departamento, organización

**Paciente**:
La persona. El panel no guarda ni muestra su nombre: la conoce **únicamente** por su NHC (ver ADR 0004).
_Avoid_: enfermo, usuario

**Caso**:
El seguimiento de un paciente por un servicio. Identificado por `(hospital, especialidad, NHC)`, así que la misma persona seguida por dos servicios son dos casos que no se ven entre sí. Dice el sexo, la edad y el estado una sola vez, y agrupa las notas.
_Avoid_: paciente, expediente, ficha, historia

**NHC**:
Número de historia clínica del paciente en su hospital. Único identificador del paciente en el panel; obligatorio. Re-identificable solo por el hospital contra su propio HIS.
_Avoid_: id de paciente, nº historia, expediente

**Carpeta**:
Contenedor donde el servicio archiva notas. Nace sembrada con un juego por defecto y el servicio puede renombrarla, borrarla o crear otras. Una nota vive en una sola carpeta.
_Avoid_: sección, categoría, directorio

**Vista**:
Consulta con nombre propio sobre las notas del servicio, presentada junto a las carpetas pero sin contener nada: no se puede borrar ni renombrar, y las notas que muestra siguen viviendo en su carpeta. El **Pase** es una vista (ver ADR 0007).
_Avoid_: carpeta inteligente, filtro guardado

**Nota**:
Lo que un miembro del equipo escribe sobre un caso en un momento dado: ubicación, autor declarado, motivo y texto libre de qué controlar (ver ADR 0005). Va dentro de un caso y dentro de una carpeta.
_Avoid_: documento, entrada, registro, apunte

**Estado del caso**:
Cómo está el paciente **ahora** (`crítico` entre otros). Es del caso, no de la nota: un "crítico" anotado el martes no debe seguir marcando al paciente el viernes.
_Avoid_: gravedad, prioridad, etiqueta

**Autor declarado**:
El médico que el selector señala como quien escribió la nota. Es lo que se muestra y por lo que se busca; no está verificado contra la sesión (ver ADR 0006).
_Avoid_: autor, creador, firmante

**Recordatorio**:
Algo pendiente que el servicio comparte en su pantalla propia. Puede ir vinculado a una nota o existir suelto. Se cierra a mano; si no se cierra, se arrastra vencido al día siguiente (ver ADR 0008). No es un **Evento del servicio**: el recordatorio se cierra, el evento se celebra.
_Avoid_: tarea, aviso, pendiente, alerta

**Evento del servicio**:
Acto con fecha y hora —sesión clínica, curso, reunión, examen— que un Responsable de especialidad convoca para residentes de su Servicio. Se proyecta como copia de solo lectura en la Agenda de la app de cada convocado y avisa por push al crearse, cambiarse o cancelarse. Cancelarlo lo marca (quién y cuándo) y retira las copias; no se cierra, no se arrastra, no se archiva y no lleva NHC. Convive con los recordatorios en su misma pantalla, pero es otra entidad.
_Avoid_: scheduler event, convocatoria (en la app es la edición del examen MIR), cita, sesión (nombre de un subtipo, no de la entidad)

**Convocado**:
Residente concreto al que un Evento del servicio cita. La lista se resuelve al crear: marcar "R1" expande a las personas que son R1 en ese momento, y queda nominal —quién estaba convocado tiene respuesta fija—. Editable después (añadir crea copia y avisa; quitar retira la copia en silencio). Solo residentes; los médicos del equipo no son convocables en v1.
_Avoid_: destinatario (es del Recordatorio), invitado, asistente, participante

### Jornada de puertas abiertas

**Jornada de puertas abiertas**:
Acto con fecha que un hospital convoca para que los residentes lo conozcan por dentro. Tiene sección propia en el menú (ver ADR 0024) porque no es un dato del perfil: acumula inscritos, avisos y valoraciones. Hay una activa por hospital; se publica desde el panel y se ve en la ficha del hospital en la app.
_Avoid_: open day, evento del hospital, puertas abiertas (a secas)

**Inscrito**:
Residente que se ha apuntado a la Jornada desde la app. Es a quien llegan los Avisos y a quien se le pide la Valoración. No es un **Convocado**: al convocado lo cita el Servicio, el inscrito se apunta solo.
_Avoid_: asistente, participante, registrado

**Aviso de la jornada**:
Mensaje que el hospital manda de golpe a todos los inscritos ("empieza mañana a las 10:00", "cambiamos de sala"). Llega como push y queda registrado con su fecha y a cuántos llegó. No es un **Recordatorio**: no se cierra ni se arrastra, solo se envía.
_Avoid_: notificación, comunicado, push

**Valoración de la jornada**:
Estrellas (1–5) y comentario que un inscrito deja una vez celebrada la jornada, a petición del hospital. Una por persona y jornada: volver a enviarla corrige la anterior. No es una **Reseña**: la reseña valora el hospital y cuenta para el ranking, la valoración solo cuenta para la próxima edición de la jornada.
_Avoid_: reseña, feedback, encuesta

---

# Modelo de datos compartido

# Contexto compartido con `losresis-app`

Este panel (`losresis-panel`) y la app principal (`~/code/losresis-app`) comparten la misma base de datos de Supabase. La intención de este documento es dejar claro qué entidades son comunes, cómo se relacionan y qué partes del panel dependen del modelo ya existente en la app principal.

## Repositorio fuente de referencia

Cuando haya dudas sobre el modelo de datos base, la fuente más completa hoy está en:

- `~/code/losresis-app/supabase/migrations/20260315162436_remote_schema.sql`
- `~/code/losresis-app/src/lib/database.types.ts`

El panel tiene tipos locales simplificados en `src/types/index.ts`, pero no representan el esquema completo.

## Tablas compartidas que usa este panel

### `public.hospitals`

Tabla maestra de hospitales. Existe en la app principal y es consumida por ambos proyectos.

Columnas relevantes:

- `id uuid`
- `name text`
- `city text`
- `region text`
- `salary_r1_fixed_eur` a `salary_r4_fixed_eur`
- `email_domain text`
- `ownership ownership_type`

Uso actual:

- En el panel se consulta directamente desde Supabase en `src/hooks/useHospitals.ts`.
- En la app móvil se consume normalmente desde un JSON cacheado en Storage (`services/hospitalService.js`) y no siempre desde la tabla en tiempo real.

Implicación:

- Si cambia el shape real de `hospitals`, el panel y la app pueden divergir rápido porque no lo leen igual.

### `public.specialities`

Catálogo maestro de especialidades.

Columnas relevantes:

- `id uuid`
- `name text`

Uso actual:

- El panel lo usa para formularios y filtros de empleo, cursos y perfil hospitalario.
- La app lo usa para hospital detail, filtros y otras secciones ligadas a hospital/especialidad.

### `public.employer_org`

Entidad organizativa del hospital o empleador que publica ofertas.

Columnas relevantes:

- `id uuid`
- `name text`
- `legal_name text`
- `tax_id text`
- `website text`
- `contact_email citext`
- `contact_phone text`
- `is_verified boolean`
- `created_at timestamptz`

Uso actual:

- El panel aprovisiona organizaciones en `src/app/api/admin/create-user/route.ts`.
- El panel consulta y actualiza esta tabla en `src/hooks/useEmployerOrg.ts`.
- `job.org_id` apunta aquí.

### `public.employer_account`

Tabla de enlace entre usuario autenticado y organización empleadora.

Columnas relevantes:

- `user_id uuid`
- `org_id uuid`
- `role text` con valores `owner|editor`
- `is_active boolean`
- `display_name text`
- `created_at timestamptz`

Uso actual:

- El panel resuelve la organización activa del usuario desde aquí.
- `useEmployerOrg` y `useHospitalProfile` dependen de esta tabla.
- El endpoint `/api/admin/create-user` crea este vínculo tras crear `auth.users` y `employer_org`.

### `public.job`

Tabla compartida de ofertas. Es la principal integración real entre panel y app.

Columnas relevantes:

- `id uuid`
- `org_id uuid`
- `created_by_id uuid`
- `title text`
- `description text`
- `audience job_audience`
- `speciality_id uuid`
- `contract_type job_contract_type`
- `work_mode work_mode`
- `salary_min_eur integer`
- `salary_max_eur integer`
- `salary_text text`
- `region text`
- `city text`
- `country text`
- `facility_name text`
- `facility_ownership ownership_type`
- `application_url text`
- `application_email citext`
- `application_phone text`
- `status job_status`
- `published_at timestamptz`
- `expires_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`

Relaciones:

- `org_id -> employer_org.id`
- `speciality_id -> specialities.id`

Uso actual en el panel:

- Se filtra por `org_id` guardado en `localStorage` en `src/hooks/useJobs.ts`.
- Se hace join con `specialities` y `employer_org`.

Implicación:

- La app principal puede leer las mismas ofertas sin duplicación.
- El ownership del contenido no va por `hospital_id`, va por `org_id`.

### `public.courses`

Tabla compartida de cursos.

Columnas relevantes:

- `id uuid`
- `title text`
- `event_dates date[]`
- `teaching_hours text`
- `price_text text`
- `course_directors text`
- `organization text`
- `venue_name text`
- `venue_address text`
- `seats_available integer`
- `course_code text`
- `more_info text`
- `objectives text`
- `registration_url text`
- `hospital_id uuid`
- `speciality_id uuid`
- `created_by_id uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

Relaciones:

- `hospital_id -> hospitals.id`
- `speciality_id -> specialities.id`

Uso actual en el panel:

- El ownership se resuelve por `created_by_id`, no por `org_id`.
- Esto es distinto del patrón usado en `job`.

Implicación:

- Ahora mismo empleo y cursos no siguen la misma estrategia de multi-tenant.
- Si en el futuro varios usuarios de la misma organización deben compartir cursos, esta tabla probablemente necesitará `org_id`.

## Extensiones introducidas por este panel

Estas tablas no forman parte del `remote_schema.sql` actual de `losresis-app`, pero el panel ya las usa:

### `public.employer_org_profile`

Perfil ampliado de la organización/hospital:

- `org_id uuid` PK/FK a `employer_org.id`
- `about text`
- `exchange_program_available boolean`
- `exchange_program_details text`
- `created_at timestamptz`
- `updated_at timestamptz`

### `public.employer_org_profile_speciality`

Especialidades que muestra el perfil del hospital:

- `org_id uuid`
- `speciality_id uuid`
- `plan_formativo_storage_path text`
- `plan_formativo_url text`
- `created_at timestamptz`
- `updated_at timestamptz`

PK compuesta:

- `(org_id, speciality_id)`

### `public.employer_org_profile_image`

Imágenes públicas del perfil del hospital:

- `id uuid`
- `org_id uuid`
- `storage_path text`
- `public_url text`
- `position integer`
- `created_at timestamptz`

### Storage bucket `hospital-assets`

El panel también depende del bucket público `hospital-assets` para:

- imágenes del hospital
- PDFs de plan formativo por especialidad

Código implicado:

- `src/hooks/useHospitalProfile.ts`
- `supabase/migrations/20260321101500_employer_org_hospital_profile.sql`

## Relaciones funcionales entre proyectos

### Hospitales y especialidades

La app principal usa `hospitals`, `hospital_specialities` y `hospital_speciality_grades` para discovery y detalle de hospitales. El panel reutiliza `hospitals` y `specialities`, pero no administra esas tablas.

Conclusión:

- El panel consume catálogos existentes.
- La app principal sigue siendo la referencia funcional del dominio hospitalario base.

### Empleo

El panel es el backoffice de creación y edición de `job`. La app principal puede actuar como frontend consumidor de esas ofertas.

Conclusión:

- `job` es la integración más clara y madura entre ambos repos.

### Cursos

El panel crea y edita `courses`, pero el criterio de ownership actual es por usuario (`created_by_id`) y no por organización.

Conclusión:

- Hay contexto compartido a nivel de tabla, pero el modelo de permisos no está alineado con `job`.

### Perfil hospitalario

El panel ya modela un perfil editorial de hospital basado en `employer_org`, no en `hospitals`.

Conclusión:

- Aquí hay una decisión importante de dominio: "hospital visible en catálogo" y "organización empleadora con perfil editorial" no son exactamente la misma entidad.

## Diferencias y riesgos actuales

### 1. Migraciones no sincronizadas entre repos

La migración del panel:

- `supabase/migrations/20260321101500_employer_org_hospital_profile.sql`

incluye el comentario de mantener sincronía con `losresis-app/supabase/migrations`, pero esas tablas todavía no aparecen en las migraciones del proyecto principal.

Riesgo:

- alguien regenerará esquema/tipos desde `losresis-app` y perderá visibilidad de estas tablas
- el equipo asumirá que el esquema compartido está completo cuando no lo está

### 2. Tipos locales del panel simplificados

`src/types/index.ts` no refleja varias columnas reales del esquema compartido, por ejemplo:

- `hospitals.ownership`
- detalles completos de `employer_account`
- shape completo de tablas compartidas y enums

Riesgo:

- el panel puede compilar mientras deriva silenciosamente del contrato real

### 3. Estrategia de acceso diferente para hospitales

- La app móvil usa JSON cacheado desde Storage para listar hospitales.
- El panel usa `select * from hospitals`.

Riesgo:

- inconsistencias entre lo que ve un residente y lo que ve el panel si el cache no está actualizado

### 4. Multi-tenant inconsistente entre `job` y `courses`

- `job` se aísla por `org_id`
- `courses` se aísla por `created_by_id`

Riesgo:

- dos usuarios del mismo hospital no comparten visibilidad operativa de cursos como sí ocurre conceptualmente con empleo

## Mapa rápido de dependencias del panel

- Autenticación admin y aprovisionamiento: `src/app/api/admin/create-user/route.ts`
- Resolución de organización actual: `src/hooks/useEmployerOrg.ts`
- Perfil editorial del hospital: `src/hooks/useHospitalProfile.ts`
- Backoffice de ofertas: `src/hooks/useJobs.ts`
- Backoffice de cursos: `src/hooks/useCourses.ts`
- Catálogo base de hospitales: `src/hooks/useHospitals.ts`

## Recomendación operativa

Para mantener contexto real entre ambos proyectos:

1. Tomar `losresis-app/supabase/migrations/20260315162436_remote_schema.sql` como base histórica del esquema compartido.
2. Considerar las migraciones de `losresis-panel/supabase/migrations` como extensiones locales pendientes de replicar en el repo principal.
3. Si se regeneran tipos, hacerlo desde la base de datos real o incorporar al panel tipos generados en lugar de tipos manuales para las tablas compartidas.
4. Decidir explícitamente si `courses` debe seguir siendo por usuario o pasar a ownership por organización.
5. Si la app principal va a consumir `employer_org_profile`, portar también esas migraciones y tipos a `losresis-app`.

## Seguimiento de pacientes: tablas con reglas propias

La vertical de seguimiento de pacientes (`servicio`, `carpeta`, `caso`, `nota`,
`nota_version`, `recordatorio`) es la **excepción deliberada** al patrón del resto
de esta base de datos. Migración: `losresis-db/20260725130000_seguimiento_pacientes.sql`.
Decisiones en `docs/adr/0004`–`0017`.

### No las normalices a `allow_all`

El resto de la base usa políticas `USING (true) WITH CHECK (true)` **sin cláusula
`TO`**, es decir `TO PUBLIC`, que incluye el rol `anon`. Como la anon key viaja en
el bundle del navegador, en una tabla `allow_all` no hace falta ni autenticarse.

Estas tablas contienen **datos de salud pseudonimizados**, así que llevan:

- **RLS real** con la regla "ves los casos de las especialidades que tienes
  asignadas", vía `public.seguimiento_tiene_alcance(hospital_id, speciality_id)`.
- **Sin permisos para `anon`.** `authenticated` tiene CRUD salvo en
  `nota_version`, que es de solo lectura (la escribe un trigger `SECURITY
  DEFINER`, porque es lo que compensa que las notas se puedan editar).
- **El acceso clínico no deriva del rol.** Un owner sin especialidad asignada
  administra pero no ve contenido: `employer_account_speciality` es la única
  puerta. Ojo, esto invierte el significado que esa tabla tiene en el resto del
  panel, donde "sin filas" quiere decir "todas las especialidades".

### Del paciente solo se guarda el NHC

No hay columna de nombre ni de apellidos, y no debe añadirse (ADR 0004). El
formulario tampoco los pide, y un detector avisa —sin bloquear— cuando el texto
libre parece contener un nombre, un DNI, un teléfono o una fecha de nacimiento.

### Efecto sobre `public.users` y la app móvil

`POST /api/team/managers` ahora rellena `public.users` (`name`, `surname`,
`hospital_id`, `speciality_id`, `is_doctor`, `work_email`) para que las personas
dadas de alta por el owner aparezcan en el selector de autor del seguimiento y
sean miembros del servicio (ADR 0018).

**Invariante:** esas cuentas nunca llevan `is_resident = true`. Su `work_email`
es el **email corporativo ya verificado contra el dominio del hospital**
(ADR 0019) — nunca cadena vacía: `NULL` cuando no hay valor. Escribir
`hospital_id` + `speciality_id` las mete en la población que consulta la app
móvil, y el directorio de residentes
(`losresis-app/services/communityService.js`) las excluye **solo** por
`is_resident = false`: su filtro `work_email IS NOT NULL` no descarta la cadena
vacía que deja el trigger `on_auth_user_created`. La auditoría del 2026-07-26
confirmó que todos los gates de residente de la app (chat directo, directorio,
conexiones, `resident_state`) exigen `is_resident = true`, así que un
`work_email` poblado en un médico no los abre. Antes de dar login de app a
estos médicos hay que arreglar en `losresis-app`: el formulario de perfil
(valida `work_email` contra `hospitals.email_domain` sin válvula para
doctores) y el wizard de onboarding (no tiene tipo "doctor" y machacaría
`is_doctor`/`work_email`/`hospital_id`/`speciality_id`).

**Reconciliación (ADR 0019):** la invitación busca identidad por email de auth
**y por `public.users.work_email`**. Si encuentra a la persona, reutiliza su
`user_id` sin pisar su perfil; a un `is_resident` no se le puede nombrar
responsable ni hace falta darle de alta como médico (ya es miembro del
servicio por perfil). El ciclo de vida depende del origen: identidad creada
por el panel (provider `email`) se puede banear/borrar; identidad con vida en
la app, nunca — solo se le retiran poderes (`employer_account`, `is_doctor`).

### Dominio de correo del hospital

`employer_org.login_email_domain` guarda el dominio que declara el owner cuando
falta en el catálogo. **No se escribe en `hospitals.email_domain`**, que es
catálogo compartido y es lo que usa la app para verificar el correo corporativo de
los residentes: una errata ahí cambiaría las reglas de verificación de todo un
hospital desde otro repo.

### Nada de esto sale hacia la IA

La búsqueda en lenguaje natural manda a Moonshot **solo la pregunta del médico**,
nunca notas ni NHC (ADR 0013). Pseudonimizado no es anonimizado.
