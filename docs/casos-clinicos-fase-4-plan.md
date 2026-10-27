# Casos clínicos · Fase 4 — Número mínimo de casos y casos por categoría

Este plan se ejecuta con `/clickup-task https://app.clickup.com/t/90151808476/124b4z9vc4y`, la
misma tarea de ClickUp. Esta pasada es **solo la fase 4** («Escalabilidad» de §14): requisitos
por categorías, número mínimo de casos y configuración para otras especialidades y hospitales
(§3.3). Es la última fase: al terminarla, la tarea pasa a `complete`. Se escribió el
2026-10-27, al cerrar la fase 3.

## Contexto: lo que ya está hecho y no se vuelve a discutir

Las fases 1, 2 y 3 están en producción desde el 2026-10-27. El detalle está en
`docs/releases/1.0.95.md` y en `docs/casos-clinicos-fase-3-tutorias-pdf-plan.md`.

**Modelo (losresis-db):**

- `libro_clinical_case_block`: el apartado «Casos clínicos» de un año de la plantilla. Uno por
  plantilla y año (`uq_libro_clinical_case_block_year`).
- `libro_clinical_case_requirement`: cada caso pedido (título, descripción, `is_required`,
  `tutor_review_enabled`, `position`, `archived_at`). Los títulos son únicos por bloque.
- `libro_clinical_case`: la ficha del residente.
  - `requirement_id` null significa caso libre.
  - **Un caso por requisito y residente** (`uq_libro_clinical_case_user_requirement`, índice
    único parcial).
  - `status` vale `draft` o `completed`. `review_status` lo calcula el guard.
- RPC:
  - `save_libro_clinical_case_block(p_template_id, p_residency_year, p_block)` (panel). La
    última definición es la de `20261029120000_libro_clinical_case_review.sql`.
  - `get_clinical_cases_for_panel(p_user_id)` (panel). La última definición es la de
    `20261030120000_libro_clinical_cases_history.sql`: casos pedidos de R1 hasta el año en
    curso.
  - `review_clinical_case` (tutor).

**Panel:**

- `src/components/libro/ClinicalCasesEditor.tsx`: el editor de la plantilla (por año).
  `src/hooks/useLibroTemplate.ts` guarda con la RPC.
- `src/lib/libroClinicalCases.ts`:
  - `portfolioRows(data, year)`, `portfolioProgress`, `otherCases`;
  - `casosDelPeriodo` y `chipCasosClinicos` (tutoría);
  - `casosClinicosDelAnio` (PDF del Libro).
- Expediente: `components/residents/ResidentClinicalCases.tsx` y `ClinicalCaseSheet.tsx`.
- Tutoría: `components/tutoring/CasosClinicosDelPeriodo.tsx`.
- PDF: `lib/clinicalCasePdf.ts` y `lib/libroPdf.ts`.

**App:**

- `utils/clinicalCases.js`:
  - `requirementsForYear`, `portfolioRows`, `portfolioProgress`;
  - `portfolioGoals`, que suma al Progreso del año del Libro;
  - `freeCasesForYear`, `linkableCases`, `indexCountFor`.
- `services/clinicalCaseService.js`: `getClinicalCaseRequirements` lee la plantilla publicada
  por RLS; `getClinicalCaseYearGoals` lo usa `hooks/useResidentHomeSummary.js`.
- `components/libro/clinicalCases/ClinicalCasesView.js` («Mi portafolio» / «Mis casos
  clínicos») y `ClinicalCaseFormScreen.js`.
- PDF: `utils/clinicalCaseHtml.js` y `services/libroArchiveService.js`.

**Decisiones del usuario que siguen en pie:**

- Registro libre para todos.
- Completar exige todo salvo servicio y rotación.
- El panel no ve el contenido de un borrador.
- «Revisado» bloquea el caso.
- «Pendiente de revisión» cuenta como completado.
- PDF en castellano, sin marca del hospital.

**Pruebas y cuentas** (igual que en la fase 3):

- R1 E2E `d1ee0bdd-…` (MFyC, Hospital E2E `470d62b7-…`), con
  `E2E_CREDENTIALS=~/.config/losresis/e2e-r1.env`.
- `~/.config/losresis/e2e-panel.env`, con `PANEL_OWNER_*` y `PANEL_TUTOR_*`.
- La plantilla `df9bf83a-…` está **sin publicar**: los seeds la publican y los asserts o
  `e2e/scripts/restore-124b4z9vc4y-clinical-cases-template.js` la despublican.
- Flujos existentes:
  - `e2e/flows/clickup-124b4z9vc4y-casos-clinicos*.yaml` (fase 1, revisión y PDF);
  - el subflujo `e2e/subflows/close-share-sheet.yaml`, que en iOS 26 cierra la hoja de
    compartir tocando fuera.
- **Panel en el navegador sin pasar la contraseña por el chat:**
  1. Un script del scratchpad inicia sesión como el tutor con `e2e-panel.env`.
  2. Escribe un `public/e2e-session.html` temporal que deja la sesión en
     `localStorage["sb-<ref>-auth-token"]` y redirige.
  3. Se abre `next dev` y se navega a esa página.
  4. Se borra el fichero enseguida.
- Una descarga del panel no aparece en `~/Downloads`. Para mirar el PDF:
  1. Intercepta `HTMLAnchorElement.prototype.click` con `javascript_tool`.
  2. Manda el blob a un receptor `node` en `127.0.0.1` del scratchpad.

## Qué pide producto

**§3.3 «Flexibilidad para otros hospitales».** La estructura debe permitir:

- añadir casos específicos;
- modificar títulos;
- eliminar requisitos futuros;
- **establecer un número mínimo de casos**;
- **configurar casos por categoría**;
- **no establecer requisitos obligatorios**.

Son «ampliaciones de producto, no exigencias expresas de Sant Pau».

**§14, fase 4:**

- requisitos por categorías;
- número mínimo de casos;
- configuración para otras especialidades y hospitales.

**Mockup.** Es la imagen de la tarea; `fetch_task.mjs` la descarga. En el panel, debajo de la
tabla de la plantilla, hay un bloque «Opciones adicionales» con cuatro opciones excluyentes:

- «Casos específicos (como en Sant Pau)», marcada por defecto;
- «Número mínimo de casos», con un campo numérico;
- «Casos por categoría»;
- «Sin requisitos (registro libre)».

Lo que ya existe hoy:

- Los casos específicos, los títulos editables y retirar un requisito con casos (se archiva):
  fase 1.
- «No obligatorio»: la casilla «Obligatorio» de cada caso.
- «Sin requisitos»: un bloque sin casos. La app enseña solo «Mis casos clínicos».
- «Otras especialidades y hospitales»: la plantilla ya es por hospital, especialidad y año, y
  cualquier hospital puede configurarla.

Lo nuevo son **dos modos**: el número mínimo y las categorías. Además, el selector del mockup
hace explícitos los cuatro.

## Solución propuesta

### Modelo: un modo por bloque (año)

**El modo vive en el bloque**, no en cada requisito, igual que el selector del mockup: un año
de una plantilla tiene un solo modo.

- **`specific`** (por defecto): como hoy. Un renglón por caso pedido y **una ficha por
  requisito**.
- **`minimum`**: sin casos pedidos. El residente tiene que completar **N casos** ese año, de
  cualquier tipo. Cuentan los libres y los vinculados.
  - Progreso: «X de N completados», con `isDoneStatus`, así que los pendientes de revisión
    cuentan.
  - Con más de N completados, el progreso queda en N/N, con «+K» aparte.
- **`category`**: cada requisito es una **categoría** con su mínimo (`minimum_cases`, 1 por
  defecto). El residente vincula o crea **varios casos por categoría**.
  - Progreso: suma de `min(completados, mínimo)` entre la suma de mínimos de las categorías
    obligatorias.
  - Las no obligatorias cuentan solo si no hay ninguna obligatoria (la regla de hoy).
- **`free`**: sin requisitos. Es explícito para el panel; la app lo pinta como un bloque sin
  casos.

### 1. `losresis-db`: `<ts>_libro_clinical_case_modes.sql`

**`libro_clinical_case_block`:**

- `requirement_mode text NOT NULL DEFAULT 'specific'`, con
  `CHECK (requirement_mode IN ('specific','minimum','category','free'))`;
- `minimum_cases smallint NULL`, con `CHECK (minimum_cases IS NULL OR minimum_cases BETWEEN 1
  AND 50)`;
- `CHECK (requirement_mode <> 'minimum' OR minimum_cases IS NOT NULL)`.

**`libro_clinical_case_requirement`:**

- `minimum_cases smallint NOT NULL DEFAULT 1`, con `CHECK (BETWEEN 1 AND 50)`. Solo cuenta en
  modo `category`.

**Un caso por requisito, solo en `specific`:**

- Se borra el índice único `uq_libro_clinical_case_user_requirement` y su regla pasa al guard
  (`libro_clinical_case_guard`): si el bloque del requisito está en `specific` y el residente ya
  tiene otro caso con ese requisito, se rechaza con 23505 y el mismo mensaje de hoy.
- Copia la definición vigente del guard, la de la fase 2, y añade solo esa comprobación.
- **Ojo con la carrera:** el índice era atómico y el guard no.
  - Hay que tomar un `pg_advisory_xact_lock` por (usuario, requisito) antes de comprobarlo.
  - Alternativa: un índice único parcial sobre una columna denormalizada `one_per_requirement`.
  - Elige una y anótala en el plan.

**`save_libro_clinical_case_block`:**

- Lee `p_block->>'requirement_mode'` y `p_block->>'minimum_cases'`. Por defecto `specific` y
  null, así que un panel desplegado antes que la migración sigue guardando igual.
- Lee también `minimum_cases` por requisito.
- Valida:
  - en `minimum` y en `free`, el bloque no lleva requisitos vivos (los que tengan casos se
    archivan como hoy);
  - **pasar de `category` a `specific` se rechaza si algún residente tiene más de un caso en
    una categoría**, con un mensaje en castellano que diga cuántos.

**`get_clinical_cases_for_panel`:**

- Cada requisito lleva `minimum_cases`.
- La respuesta suma `blocks: [{residency_year, requirement_mode, minimum_cases}]` de R1 hasta
  el año en curso.
- `CREATE OR REPLACE` sobre la definición de `20261030120000`.

**RLS:** el residente ya lee bloque y requisitos de su plantilla publicada. Las columnas nuevas
no cambian nada.

**Compatibilidad:**

- Todo es aditivo y tiene default.
- **Ninguna app publicada lee estas tablas si la 1.0.95 sigue sin publicarse**: compruébalo en
  `docs/releases/1.0.95.md`. Si ya salió, una 1.0.95 en un bloque `category` enseñaría cada
  categoría como un caso único. Es aceptable (degrada, no rompe); dilo en el plan.
- El panel desplegado de hoy no manda el modo, así que guarda `specific`.

**Ensayo revertido**, con el patrón de la fase 3 (un `.sql` con `BEGIN`, el DDL, las pruebas y
`RAISE EXCEPTION 'ENSAYO_OK …'`):

- un bloque `specific` sigue rechazando el segundo caso del mismo requisito;
- un bloque `category` acepta dos;
- el cambio `category` → `specific` con dos casos se rechaza;
- `get_clinical_cases_for_panel` devuelve `blocks`;
- prueba como residente y como tutor con `SET LOCAL ROLE authenticated` y `request.jwt.claims`.

### 2. `losresis-panel`

**Plantilla (`ClinicalCasesEditor.tsx` y `libroClinicalCases.ts`):**

- El bloque «Opciones adicionales» del mockup: cuatro radios y el campo numérico para el
  mínimo.
- En `category`, la tabla cambia «Título del caso» por «Categoría» y añade la columna «Mínimo».
- En `minimum` y en `free`, la tabla de casos se oculta. Si había casos, avisa de que se
  retiran; los que tienen fichas se archivan.
- `ClinicalCaseBlockDraft` gana `requirement_mode` y `minimum_cases`, y
  `ClinicalCaseRequirementDraft` gana `minimum_cases`.
- Hay que tocar a la vez:
  - `toClinicalCaseBlockPayload`, `clinicalCaseBlockFromRows` y `clinicalCaseBlockError`
    (mínimo entre 1 y 50; en `category`, al menos una categoría);
  - `clinicalCaseBlockSummary` («Mínimo 5 casos», «3 categorías · 7 casos»);
  - `cloneClinicalCaseBlock`, que copia el modo.
- `useLibroTemplate.ts` lee las columnas nuevas.

**Seguimiento** (expediente, tutoría y PDF):

- `leerCasosClinicos` lee `blocks`.
- Una función nueva `portfolioDelAnio(data, year)` devuelve
  `{ mode, rows, progress, otros }`:
  - en `specific`, lo de hoy;
  - en `category`, una fila por categoría con sus casos (`cases: ClinicalCase[]`), «X de N» y
    su estado («Completada» si llega al mínimo, «En progreso» si tiene alguno, «Pendiente» si
    no tiene ninguno);
  - en `minimum`, ninguna fila de requisito, un progreso «X de N casos» y todos los casos del
    año como lista;
  - en `free`, sin progreso.
- Con esa función:
  - `portfolioRows` y `portfolioProgress` quedan para `specific`;
  - `ResidentClinicalCases`, `casosDelPeriodo`, `chipCasosClinicos`, `casosClinicosDelAnio` y
    `renderCasosClinicos` (PDF del Libro) pasan a usarla.
- **Tests en vitest** de los cuatro modos, con los números copiados de los criterios.

### 3. `losresis-app`

**`utils/clinicalCases.js`** (con tests en Jest):

- El modo y el mínimo vienen de `getClinicalCaseRequirements`, que ya lee el bloque: añade
  `requirement_mode` y `minimum_cases` al `select` y devuelve `blockModes: Map<year, …>`.
- Generaliza `portfolioRows`, `portfolioProgress`, `portfolioGoals`, `freeCasesForYear`,
  `indexCountFor` y `linkableCases` para los cuatro modos, con el mismo contrato que el panel:
  - en `category`, `linkableCases` ofrece casos libres; un caso ya vinculado a otra categoría
    no se ofrece;
  - en `minimum`, `portfolioGoals` da N objetivos, hechos según los completados;
  - en `category`, da la suma de los mínimos.

**`ClinicalCasesView.js`:**

- En `category`, «Mi portafolio» lista las categorías («Respiratorio · 1 de 2») con sus casos
  dentro, y en cada una «Añadir caso» y «Vincular caso».
- En `minimum`, la tarjeta de progreso «X de N casos» encima de «Mis casos clínicos». No hay
  pestaña de portafolio: no hay nada que pedir uno a uno.
- **Antes de construir la UI de la app, lee el diseño** (mockup de la tarea). Si no cubre
  estos modos, dilo en **Dudas** con la propuesta de arriba.

**PDF** (`utils/clinicalCaseHtml.js` y `libroArchiveService`):

- `renderClinicalCasesForYear` pinta las categorías con sus casos, y en `minimum`, «X de N» y
  la lista.

**`hooks/useResidentHomeSummary.js`:** vía `getClinicalCaseYearGoals`, hereda los objetivos
nuevos. Comprueba que el «Progreso» del inicio cuadra.

**E2E:** `e2e/flows/clickup-124b4z9vc4y-casos-clinicos-modos.yaml`.

- El seed, como owner, pone el bloque R1 de la plantilla MFyC en `category` con dos categorías
  (mínimos 2 y 1) y la publica.
- El residente crea dos casos en la primera categoría y uno en la segunda → «3 de 3».
- El seed cambia el bloque a `minimum` con N = 4 → «3 de 4».
- El restore deja la plantilla en `specific` con EPOC, Ictus y FRA y la despublica, como
  `restore-124b4z9vc4y-clinical-cases-template.js`. Amplíalo, no lo dupliques.
- **Los flujos de las fases 1, 2 y 3 tienen que seguir en verde.** Lánzalos como regresión.

**Panel en el navegador:** como `e2e-panel-tutor` y como owner.

- El owner configura los modos en la plantilla.
- El tutor ve el progreso en el expediente, en la tutoría y en el PDF.

## Casos límite que hay que cubrir

**Cambio de modo con casos existentes:**

- `specific` → `category`: cada requisito pasa a ser una categoría de mínimo 1 y los casos
  vinculados se quedan.
- `category` → `specific` con varias fichas en una categoría: se rechaza (ver la RPC).
- → `minimum` o `free`: los requisitos con casos se archivan y sus casos salen como libres
  («Retirado por el hospital», igual que hoy).

**Progreso:**

- Más casos que el mínimo: el progreso no pasa de N/N, y el exceso se enseña aparte.
- Mínimo 0 o vacío en el formulario: no se guarda (validación del panel y CHECK de la BD).

**Revisión del tutor en una categoría:**

- Cada caso vinculado pasa por revisión.
- Un caso pendiente de revisión cuenta en el mínimo (decisión de la fase 2).

**Residente R6+:** usa el modo del bloque de R5 (`templateYearFor`).

**Concurrencia:** dos altas a la vez en el mismo requisito `specific` no pueden dejar dos
fichas (ver la nota del guard).

**Archivos de años pasados:** el PDF de un año usa el modo del bloque de ese año, no el del
año en curso.

## Dudas para presentar en el plan (cada una con su respuesta por defecto)

1. **¿Qué cuenta en el «número mínimo»?** Por defecto, **los casos completados del año, libres
   y vinculados**, también los pendientes de revisión.
2. **¿Una categoría tiene su propio mínimo?** Por defecto, **sí, 1 por defecto**, con la
   columna «Mínimo» en la tabla.
3. **¿Se pueden mezclar casos específicos y categorías en el mismo año?** Por defecto, **no**:
   un modo por año, como los radios del mockup.
4. **¿Qué pasa al cambiar de modo con fichas ya hechas?** Por defecto, lo de **Casos límite**:
   se conservan, se archivan o se rechaza el cambio, sin perder registros (§12).
5. **¿Qué UI tienen los modos nuevos en la app?** El mockup solo dibuja `specific`. Por
   defecto, la propuesta de arriba (categorías con sus casos; en `minimum`, una tarjeta de
   progreso).
6. **«Configuración para otras especialidades y hospitales»:** por defecto, **nada nuevo**. La
   plantilla ya es por hospital, especialidad y año. Copiar una configuración a otra
   especialidad no entra (fuera de alcance).
7. **Versión de la app:** mira `docs/releases/`. Si la 1.0.95 sigue `en desarrollo`, va en ella
   (tag `1.0.95`). Si ya salió, pregunta la versión y retaguea con `add_tag.mjs`.

## Fuera de alcance

- Copiar la configuración de casos clínicos a otra especialidad u hospital.
- Marca del hospital o idioma catalán en el PDF.
- Casos clínicos en la «Preparación» de la tutoría que rellena el residente.

## Al terminar

- Sigue el paso 6 de la skill:
  - subir a `main` (`losresis-db`, panel con `vercel --prod`, app);
  - la entrada en `docs/releases/<versión>.md`.
- **Es la última fase: pasa la tarea de ClickUp a `complete`** con `set_status.mjs`.
- Actualiza la memoria `losresis-clinical-cases-phases.md`.
- Queda pendiente, apuntado en el histórico: probar el push de la revisión en un móvil físico
  (fase 2).
