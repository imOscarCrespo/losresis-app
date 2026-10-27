# Casos clínicos · Fase 3 — Tutorías y exportación a PDF

Este plan se ejecuta con `/clickup-task https://app.clickup.com/t/90151808476/124b4z9vc4y`, la
misma tarea de ClickUp. Esta pasada es **solo la fase 3**: §9 (Tutorías), §10 (PDF) y
«seguimiento histórico» de §14. Se escribió el 2026-10-27, al cerrar la fase 2.

## Contexto: lo que ya está hecho y no se vuelve a discutir

**Fase 1** (en producción desde el 2026-10-27; detalle en `docs/releases/1.0.95.md`):

- **Migración** `losresis-db/20261028160000_libro_clinical_cases.sql`.
  - Tablas `libro_clinical_case_block`, `libro_clinical_case_requirement` y
    `libro_clinical_case`.
  - RPC `get_clinical_cases_for_panel(p_user_id)`, que devuelve el jsonb
    `{residency_year, requirements, cases}`. No da el contenido de los borradores. Alcance:
    `has_teaching_scope_for_user`.
- **Panel:** `src/lib/libroClinicalCases.ts` y `src/components/residents/ResidentClinicalCases.tsx`.
- **App:** `utils/clinicalCases.js`, `services/clinicalCaseService.js` y
  `components/libro/clinicalCases/*`.
- **Decisiones del usuario:**
  - el registro libre es para todos;
  - completar exige todo salvo servicio y rotación;
  - el panel no ve el contenido de un borrador.

**Fase 2** (en producción desde el 2026-10-27, revisión del tutor):

- **Migración** `losresis-db/20261029120000_libro_clinical_case_review.sql`:
  - `libro_clinical_case.review_status`: `null`, `pending`, `reviewed` o `changes_requested`.
    Lo calcula el guard; la app nunca lo escribe.
  - Historial en `libro_clinical_case_review`, que el residente lee por RLS.
  - RPC `review_clinical_case`.
  - `get_clinical_cases_for_panel` ya devuelve `review_status` y `reviews`, la más reciente
    primero, con `reviewer_name`.
  - Un caso `reviewed` no se edita ni se borra, salvo los residentes de hospitales `is_test`,
    que sí pueden borrarlo (para el E2E).
- **Panel:**
  - `ResidentClinicalCases.tsx` tiene la ficha `Ficha`, con las pestañas «Caso del residente» /
    «Evaluación del tutor».
  - `useResidentDossier.recargarCasosClinicos`.
- **App:**
  - `ClinicalCaseFormScreen` pinta la «Revisión del tutor».
  - `utils/clinicalCases.js` tiene `displayStatusOf`, `isDoneStatus`, `isLockedByReview`,
    `reviewsOf` y `CLINICAL_CASE_REVIEW_FIELDS`.
- **Decisiones del usuario (fase 2):**
  - «Revisado» bloquea;
  - «Pendiente de revisión» cuenta como completado;
  - revisa cualquier cuenta con alcance docente;
  - hay push en los dos resultados.

**Pruebas que ya hay:**

- `e2e/flows/clickup-124b4z9vc4y-casos-clinicos.yaml` (fase 1) y `…-casos-clinicos-revision.yaml`
  (fase 2).
  - Se ejecutan con `E2E_CREDENTIALS=~/.config/losresis/e2e-r1.env`.
  - Necesitan `~/.config/losresis/e2e-panel.env`, con `PANEL_OWNER_*` y `PANEL_TUTOR_*`.
- Residente R1 de pruebas: `d1ee0bdd-…`, MFyC del Hospital E2E `470d62b7-…`.
- La plantilla `df9bf83a-…` está **sin publicar**: los seeds la publican y los asserts la
  despublican.
- **Probar el panel en el navegador sin pasar la contraseña por el chat** (se hizo así en la
  fase 2):
  1. Un script en el scratchpad inicia sesión como el tutor con `e2e-panel.env`.
  2. Escribe un `public/e2e-session.html` temporal que deja la sesión en
     `localStorage["sb-<ref>-auth-token"]` y redirige.
  3. Se abre `next dev` y se navega a esa página.
  4. Se borra el fichero enseguida.
  - El `window.confirm` del panel bloquea la extensión de Chrome: sobrescríbelo antes con
    `javascript_tool`.

## Qué pide producto

### §9 Tutorías

En **Docencia → Tutorías → Entrevista → Áreas revisadas → Casos clínicos** se muestran
automáticamente los casos del período evaluado (tabla Caso / Estado: EPOC Completado, Ictus
Completado, FRA Pendiente). El tutor puede:

- consultar los casos completados;
- revisar las reflexiones;
- identificar los requisitos pendientes;
- registrar observaciones generales.

No se duplican los análisis dentro de la tutoría.

### §10 PDF

**Exportación individual** («Exportar casos clínicos», desde la app y el panel):

- Contenido:
  - hospital, residente, especialidad y año;
  - título, fecha y servicio;
  - los siete campos clínicos;
  - la reflexión.
- La revisión del tutor, si existe, se puede incluir en una sección aparte.

**Exportación del portafolio:** al exportar el Libro, los casos clínicos del período van
dentro:

- en el orden de la plantilla (en Sant Pau: EPOC, Ictus, FRA);
- los pendientes, identificados como tales y sin contenido inventado.

### §11 Privacidad

Ningún dato de paciente en lo exportado. La ficha no tiene campos de paciente, así que basta con
exportar solo los campos de la ficha.

### §14 Fase 3

«Vinculación con tutorías, consulta desde el Libro del Residente, exportación a PDF, seguimiento
histórico».

### Mockup

Es la imagen de la tarea, que `fetch_task.mjs` descarga. Ábrela antes de diseñar.

- **Panel:** botón «Descargar PDF» en la ficha del caso (arriba a la derecha).
- **PDF «Fitxa de cas clínic»:**
  - cabecera con logo de Sant Pau y «RE-IMPULS SANT PAU · Portafoli del resident»;
  - en catalán;
  - bloques «Dades identificatives / Informació del cas / Descripció clínica».
- **Discrepancia:** el texto no pide marca ni idioma del hospital. **Por defecto:** PDF en
  castellano, con la cabecera de LosResis y el nombre del hospital, y la estructura de bloques
  del mockup.

## Lo que hay hoy en el código (comprobado el 2026-10-27)

**Tutorías (panel)**

- `src/lib/tutoringRecord.ts`: `AREAS_REVISADAS` ya tiene la clave `clinical_cases` («Casos
  clínicos»), con `reviewed` y `notes` en `hospital_tutoring.reviewed_areas`. Las notas son las
  «observaciones generales»: **no hay que añadir nada a la BD para eso**.
- `src/app/dashboard/tutorias/[id]/page.tsx`:
  - pinta `AreasRevisadasPanel` con un `extra` por área (`chip` + `contenido`);
  - hoy solo Guardias lo usa, con `GuardiasDelPeriodo`;
  - el período es `registro.period_start` / `period_end` (fechas `YYYY-MM-DD`, cualquiera de
    las dos puede faltar).
- `src/components/tutoring/GuardiasDelPeriodo.tsx` es el patrón a copiar:
  - un hook `useGuardiasDelResidente(residentUserId)` que **lee donde vive**, sin copiar a la
    tutoría;
  - `chipGuardias(...)`;
  - un componente de solo lectura;
  - `delPeriodo` está en `src/lib/shiftDebrief.ts`.

**PDF del panel**

- `src/lib/libroPdf.ts` (`construirLibroPdf`, pdfmake, función pura con tests en
  `libroPdf.test.ts`), `src/lib/libroPdfRender.ts` y `src/hooks/useLibroExport.ts`.
  - La exportación individual y la masiva (zip, residente a residente en un `for`) usan el
    mismo documento.
- `src/lib/libroExport.ts`:
  - `ModoExportacion` = `complete` | `current` | `year`. **Ese es el «período seleccionado».**
  - `aniosAExportar(...)` da los años.
- `construirLibroPdf` ya recibe `hospitalName` y `residentName`. Hoy no pinta casos clínicos.

**PDF de la app**

- `services/libroPdfService.js`:
  - HTML con `expo-print` y `Sharing.shareAsync`;
  - pinta por arquetipo y ya tiene `renderCustom` para los apartados personalizados.
- Los datos salen de `services/libroArchiveService.js` (`getLibroArchive(userId,
  currentResidencyYear)` → `booksByYear`). Hoy no hay casos clínicos.
- La exportación la lanza `screens/ResidenceLibraryScreen.js` (`handleExportArchivePdf`).
- Hoy el PDF de la app **no lleva el nombre del hospital**: hay que leerlo de `hospitals.name`
  por `userProfile.hospital_id` (mira cómo lo resuelve el panel en `useLibroExport.ts`).

**RPC del panel**

- `get_clinical_cases_for_panel` devuelve los requisitos del **año en curso** y los de otros
  años **solo si el residente tiene caso en ellos**.
- Para el PDF de un año pasado, los requisitos de ese año sin caso (pendientes) no llegan. Ver la
  solución en la BD.

## Solución propuesta

### 1. `losresis-db`: `<ts>_libro_clinical_cases_history.sql` (pequeña)

**`get_clinical_cases_for_panel` devuelve los requisitos vivos de todos los años hasta el en
curso** (R1…min(año, 5)), no solo los del año en curso. Así:

- el PDF de cualquier año identifica los pendientes;
- el panel puede enseñar el histórico por año.

**Compatibilidad:**

- `portfolioRows` del panel ya filtra por `residency_year === templateYear`, así que la pestaña
  actual no cambia.
- **Comprobar** que `otherCases` y la tabla no enseñan de más con los requisitos nuevos de
  otros años.
- Es aditivo: la app no usa esta RPC.

**Comprobaciones:**

- ensayo que se revierte con residente R1 y un R2 (`e2e-resident`, `31ba1da6-…`, R2 MFyC de
  Ramón y Cajal);
- `CREATE OR REPLACE` sobre la definición actual (la de la fase 2);
- no tocar nada más.

> Si prefieres no tocar la BD: el panel puede leer los requisitos de años pasados de las tablas
> por RLS (`libro_clinical_case_requirement_panel`). La RPC es más simple y deja una sola
> fuente. Elige y anótalo.

### 2. `losresis-panel`

**Tutorías: `src/components/tutoring/CasosClinicosDelPeriodo.tsx`** (nuevo), con el patrón de
`GuardiasDelPeriodo`:

- **`useCasosClinicosDelResidente(residentUserId)`:** llama a `get_clinical_cases_for_panel` y
  pasa el resultado por `leerCasosClinicos`.
- **`casosDelPeriodo(data, desde, hasta)`** (lógica pura en `libroClinicalCases.ts`, con tests),
  con dos listas:
  - **Requisitos:** los del portafolio (`portfolioRows`) **siempre**, con su estado, sea cual sea
    el período. Así se identifican los pendientes.
  - **Casos libres:** los que tienen fecha dentro del período. Fecha del caso: `case_date`; si
    no hay, `completed_at`; y si tampoco, `updated_at` del día.
  - Sin período (las dos fechas vacías), todos.
- **`chipCasosClinicos`:** «2 de 3 completados», con `portfolioProgress`. Sin portafolio, «N
  casos».
- **Componente:**
  - tabla Caso / Estado (`displayStatusOf` + rótulos), con el chip de revisión si aplica;
  - «Ver» abre la ficha **de solo lectura**, sin formulario de revisión (en la tutoría no se
    revisa casos; eso se hace en el expediente).
    - **Por defecto:** reutilizar `Ficha` de `ResidentClinicalCases.tsx`. Sácala a
      `src/components/residents/ClinicalCaseSheet.tsx` con una prop `readOnlyReview`.
    - La reflexión se ve en la pestaña «Caso del residente»: con eso se cumple «revisar las
      reflexiones».
- **En `tutorias/[id]/page.tsx`:** `extra.clinical_cases = { chip, contenido }`, igual que
  `on_call`. Las observaciones son las `notes` del área, que ya existen.

**Seguimiento histórico (expediente):**

- En `ResidentClinicalCases`, un selector de año (R1…año en curso) encima del portafolio, que
  por defecto es el año en curso.
- `portfolioRows` y `portfolioProgress` reciben el año.
- Los casos libres de otros años siguen en «Otros casos clínicos».

**PDF individual del caso:**

- `src/lib/clinicalCasePdf.ts` (nuevo): función pura `construirCasoClinicoPdf({ hospitalName,
  residentName, specialityName, residencyYear, caso, incluirRevision })` → `TDocumentDefinitions`.
- Bloques:
  - Datos identificativos (hospital, residente, especialidad, año);
  - Información del caso (título, fecha, servicio, rotación);
  - Descripción clínica (los siete campos con `CLINICAL_CASE_SECTIONS`);
  - Reflexión personal;
  - con `incluirRevision`, la sección «Revisión del tutor»: la última revisión (quién y cuándo,
    los cuatro textos) y el resultado.
- Reutiliza los colores y la cabecera de `libroPdf.ts`; extrae lo común si hace falta. Renderiza
  con `libroPdfRender.ts`.
- **Botón «Descargar PDF»** en la cabecera de la ficha:
  - solo con el caso completado (de un borrador el panel no tiene contenido);
  - con la casilla «Incluir la revisión del tutor», si hay revisiones;
  - nombre de fichero `LosResis_caso_<titulo>_<residente>.pdf`, con `trozoDeNombre` de
    `libroExport.ts`.
- Tests en vitest: el documento con y sin revisión, sin campos vacíos inventados y con los saltos
  de línea conservados.

**Exportación del Libro (`construirLibroPdf`):**

- Recibe `casosClinicos: ResidentClinicalCases`. `useLibroExport.ts` llama a la RPC, en paralelo
  con lo que ya lee.
- Por cada año exportado, el apartado «Casos clínicos»:
  - los requisitos del año en el orden de la plantilla;
  - por requisito, su estado y, si está completado, la ficha (los mismos bloques que el
    individual, sin la revisión por defecto);
  - **pendiente → una línea «Pendiente», sin contenido**;
  - después, los libres de ese año.
- Va en la posición del bloque de la plantilla. **Por defecto:** al final del año, si es
  complicado sacar la posición.
- La masiva (zip) hereda lo mismo. Va en serie, así que no hay ráfaga de RPC.

### 3. `losresis-app`

**Versión:** mira `docs/releases/1.0.95.md`. Si sigue `en desarrollo`, va en la 1.0.95 (el tag
de ClickUp es `1.0.95`). Si ya se publicó, pregunta y retaguea con `add_tag.mjs`.

**PDF individual:**

- `services/clinicalCasePdfService.js` (nuevo): `exportClinicalCaseToPdf({ clinicalCase,
  requirement, hospitalName, residentName, specialtyName, residencyYear, includeReview })`.
  - HTML con `expo-print` y `Sharing.shareAsync`, con el estilo de `libroPdfService.js`;
    reutiliza su CSS y su cabecera si se pueden extraer.
  - Los mismos bloques que el del panel. `escapeHtml` en todo el texto del residente y del
    tutor.
- Lógica pura de contenido (secciones y campos no vacíos) en `utils/clinicalCases.js`, con tests
  en Jest.
- **Botón en `ClinicalCaseFormScreen`** («Exportar PDF», icono vía `components/Icon.js`), en
  modo lectura y en casos completados.
  - Si hay revisiones, un `Alert` pregunta «¿Incluir la revisión del tutor?».
  - En un borrador, **por defecto** no se ofrece. Puedes ofrecerlo con la marca «Borrador»; elige
    y anótalo.
- El nombre del hospital: una lectura de `hospitals.name` (helper en un servicio, cacheado en
  la pantalla).

**Exportación del Libro (`libroArchiveService` y `libroPdfService`):**

- `getLibroArchive` añade por año `clinicalCases: { rows, freeCases }`. Usa
  `getClinicalCaseRequirements(template.id)`, `getClinicalCases(userId)`, `portfolioRows` y
  `freeCasesForYear`, con los años del archivo.
- `buildHtml` pinta un bloque «Casos clínicos» por año:
  - pendientes como «Pendiente», sin contenido;
  - completados con su ficha.
- Cuenta en los totales del resumen si el resto de apartados lo hace.

**Consulta desde el Libro del Residente** (§14): ya existe desde la fase 1 (Libro → Casos
clínicos). No hay nada nuevo salvo el PDF. Dilo en el plan.

**E2E:**

- **Flujo:** `e2e/flows/clickup-124b4z9vc4y-casos-clinicos-pdf.yaml`.
  - El seed deja EPOC completado y revisado, con el patrón de los scripts de la fase 2:
    completar por API y revisar como tutor por RPC.
  - En la app: abre EPOC → «Exportar PDF» → aparece la hoja de compartir de iOS (asserta un
    texto suyo y ciérrala).
  - Exportar el Libro: lo mismo.
  - No se puede abrir el PDF desde Maestro. **Comprueba el contenido con Jest** sobre el HTML
    generado.
- **Panel:** la tutoría y el PDF se prueban en el navegador como `e2e-panel-tutor` (ver
  Contexto). El PDF descargado se abre con Read y se mira.

## Casos límite que hay que cubrir

**Período de la tutoría**

- Sin fechas: todos los casos.
- Solo «desde» o solo «hasta»: abierto por el otro lado.
- Un caso libre sin `case_date` (borrador): cae por `updated_at`.

**Contenido y lectura**

- **Borrador o modificaciones solicitadas:** en la tutoría y en el PDF del panel sale el estado,
  sin contenido. La RPC no lo da, y no hay que inventarlo.
- **Requisito archivado con caso:** sale en el año del caso como «Retirado por el hospital»,
  igual que en la app.
- **Residente R6+:** la plantilla usa R5 (`templateYearFor`).
- **Tutor sin alcance:** la RPC devuelve `null` y `leerCasosClinicos` lo convierte en vacío. Hay
  que pintar un estado vacío, no un error.

**Textos y nombres**

- **Textos largos y saltos de línea:** los campos admiten 20000 caracteres. El PDF parte páginas
  sin cortar a medias una línea de tabla. En pdfmake, `text` con `\n` y no `table`. En HTML,
  `white-space: pre-wrap`.
- **Nombres con caracteres raros** en el fichero: usa `trozoDeNombre`.

**Revisión del tutor**

- **Con la revisión:** solo la última por defecto. Las anteriores **no** van, salvo que lo
  decidas (ver Dudas).

**Privacidad**

- Ningún identificador del paciente; la ficha no tiene ninguno.
- No metas el `user_id` ni los ids en el PDF.

## Dudas para presentar en el plan (cada una con su respuesta por defecto)

1. **¿Qué casos entran en el período de la tutoría?** Por defecto:
   - **todos los requisitos del portafolio del año en curso**, con su estado, para identificar
     pendientes;
   - **más los casos libres con fecha en el período.**
2. **¿Marca del hospital (logo y «RE-IMPULS») e idioma catalán en el PDF, como el mockup?** Por
   defecto, **no**: castellano, cabecera de LosResis y nombre del hospital. El texto de la tarea
   no lo pide.
3. **¿La revisión del tutor en el PDF individual?** Por defecto, **opcional al exportar, y solo
   la última revisión.** En el PDF del Libro, **no**.
4. **¿El PDF individual de un borrador?** Por defecto, **no** se ofrece, ni en la app ni en el
   panel.
5. **«Seguimiento histórico».** Por defecto: un **selector de año** en el expediente del panel y
   **casos por año** en el PDF del Libro. No hay ninguna pantalla nueva en la app.
6. **¿Toca la BD?** Por defecto, **sí**: `get_clinical_cases_for_panel` con los requisitos de los
   años anteriores. La alternativa por RLS está en Solución, BD.

## Fuera de alcance de esta pasada

- **Fase 4:** número mínimo de casos y categorías.
- **Revisar el caso desde la tutoría:** se revisa en el expediente, como en la fase 2.
- **Casos clínicos en la «Preparación» de la tutoría que rellena el residente en la app**
  (`20261027180000_tutoring_resident_preparation.sql`): la tarea no lo pide.

## Al terminar

- Sigue el paso 6 de la skill:
  - subir a `main`;
  - `vercel --prod` del panel;
  - la migración, si la hay, aplicada antes;
  - la entrada en `docs/releases/<versión>.md`.
- La tarea de ClickUp **sigue `in progress`**: queda la fase 4.
- Actualiza la memoria `losresis-clinical-cases-phases.md`.
