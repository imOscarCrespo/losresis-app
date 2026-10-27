# Casos clínicos · Fase 2 — Revisión formativa del tutor

Este plan se ejecuta con `/clickup-task https://app.clickup.com/t/90151808476/124b4z9vc4y`, la
misma tarea de ClickUp. Esta pasada es **solo la fase 2** (§8 de la tarea y estados de §6). Se
escribió el 2026-10-27, al cerrar la fase 1.

## Contexto: lo que ya está hecho y no se vuelve a discutir

Fase 1 en producción desde el 2026-10-27:

- **Migración** `losresis-db/20261028160000_libro_clinical_cases.sql` (commit `a538920`), aplicada.
  - **Tablas:**
    - `libro_clinical_case_block`: el hueco del rail, uno por plantilla y año.
    - `libro_clinical_case_requirement`: ya tiene `tutor_review_enabled boolean DEFAULT false`, que
      se guarda pero aún no hace nada.
    - `libro_clinical_case`:
      - `status` admite `draft` o `completed`;
      - un CHECK `libro_clinical_case_completed_fields` exige la ficha entera para `completed`;
      - el trigger `libro_clinical_case_guard` valida el requisito y fija `completed_at`.
  - **RPCs:**
    - `save_libro_clinical_case_block`: el panel guarda la plantilla. Ya acepta
      `tutor_review_enabled` en cada requisito.
    - `get_clinical_cases_for_panel(p_user_id)`: devuelve un jsonb `{residency_year, requirements,
      cases}`. Usa `SECURITY DEFINER` y `has_teaching_scope_for_user`. No devuelve el contenido de
      los borradores.
- **Panel** (commit `ed2e45d`):
  - `src/lib/libroClinicalCases.ts`;
  - `src/components/libro/ClinicalCasesEditor.tsx`;
  - `src/components/residents/ResidentClinicalCases.tsx`, la pestaña «Casos clínicos» del
    expediente;
  - el `useResidentDossier` carga la RPC.
- **App 1.0.95** (commit `9770fe5`):
  - `utils/clinicalCases.js`, `services/clinicalCaseService.js`;
  - `components/libro/clinicalCases/ClinicalCasesView.js` y `ClinicalCaseFormScreen.js`;
  - la integración en `screens/ResidenceLibraryScreen.js`.
- **Decisiones del usuario (fase 1):**
  - el registro libre es para todos los residentes;
  - completar exige todo salvo servicio y rotación;
  - el panel no ve el contenido de un borrador;
  - la plantilla de Sant Pau la configura el hospital.
- **Pruebas:**
  - E2E: `e2e/flows/clickup-124b4z9vc4y-casos-clinicos.yaml`. Se ejecuta con
    `E2E_CREDENTIALS=~/.config/losresis/e2e-r1.env` y necesita `~/.config/losresis/e2e-panel.env`.
  - El seed (`e2e/scripts/seed-124b4z9vc4y-clinical-cases.js`) pide los tres casos de Sant Pau en
    R1 de MFyC del Hospital E2E. Sus ids son fijos, `c4a5e000-…-0000000000e1/e2/e3`.
  - La plantilla del Hospital E2E está **sin publicar**: el seed la publica y el assert la
    despublica.

## Qué pide producto (§6, §8 y criterios de aceptación)

- **Activación:** «Revisar caso clínico» se activa por caso pedido, con el interruptor «Revisión
  tutor» de la plantilla (mockup: columna con toggle). Por defecto está desactivado.
- **Formulario del tutor:** cuatro textos libres (valoración general, aspectos positivos, aspectos
  a mejorar y comentarios para el residente) y un resultado, **Revisado** o **Solicitar
  modificaciones**. Sin notas ni calificaciones.
- **Estados nuevos** (solo con la revisión activada): «Pendiente de revisión» y «Revisado».
- **Lo que ve el residente:**
  - el nuevo estado del caso;
  - la valoración del tutor dentro del caso (mockup pantalla 4: «Revisión del tutor» con chip
    «Revisado», los cuatro bloques y la fecha de revisión);
  - un aviso si tiene que hacer modificaciones; entonces puede editar y volver a enviar.
- **Historial:** se conserva el de todas las revisiones.
- **Bloqueo:** el residente edita «mientras no esté bloqueado por una validación».

## Solución propuesta

### 1. `losresis-db`: `<ts>_libro_clinical_case_review.sql`

**El estado de revisión va en una columna aparte, sin tocar `status`.** La app 1.0.95 solo
entiende `draft` y `completed`, y puede salir a las tiendas antes que esta fase. Con una columna
aparte, esa app sigue pintando bien (Completado / En progreso):

- `libro_clinical_case.review_status text NULL CHECK (review_status IN ('pending', 'reviewed',
  'changes_requested'))`.
  - `NULL`: sin revisión (requisito sin toggle o caso libre).
  - `pending`: «Pendiente de revisión».
  - `reviewed`: «Revisado».
  - `changes_requested`: «Modificaciones solicitadas».

**Tabla de historial `libro_clinical_case_review`.** Es solo de inserción:

- `id`;
- `case_id` → `libro_clinical_case` `ON DELETE CASCADE`;
- `reviewer_user_id uuid` (cuenta del panel, sin FK, como `libro_template.created_by`) y
  `reviewer_name text`;
- `overall_assessment`, `strengths`, `improvements` y `comments_for_resident`, todos `text`
  limitados a 10000;
- `outcome text CHECK IN ('reviewed', 'changes_requested')`;
- `created_at`.

La revisión vigente es la última.

**Trigger `libro_clinical_case_guard` (ampliarlo):**

- Al pasar a `completed`, si el requisito tiene `tutor_review_enabled`, pone
  `review_status = 'pending'`. Si no lo tiene, lo deja en `NULL`.
- Si `OLD.review_status = 'reviewed'`, rechaza cualquier cambio del residente en el contenido o el
  estado: `RAISE 'Tu tutor ya ha revisado este caso: no se puede editar'`. La 1.0.95 enseñará ese
  mensaje en su alerta de error.
- La RPC del tutor tiene que poder escribir `review_status`. Se resuelve con un GUC local
  (`set_config('losresis.clinical_case_review', 'on', true)`) que el trigger respeta, o
  comprobando `current_user`. Elegir uno y documentarlo.

**RPC `review_clinical_case(p_case_id, p_outcome, p_overall, p_strengths, p_improvements,
p_comments)`.** Usa `SECURITY DEFINER`:

- Alcance: `has_teaching_scope_for_user(case.user_id)`.
- Solo revisa casos con `review_status = 'pending'`. Si no, error con un mensaje claro.
- Inserta la revisión. Con nombre del revisor de `employer_account` / `users` (mirar cómo lo
  resuelve `hospital_tutoring.tutor_name`).
- Si el resultado es `reviewed`: `review_status = 'reviewed'`.
- Si es `changes_requested`: `review_status = 'changes_requested'` y `status = 'draft'`. El trigger
  pone `completed_at = NULL`.
- Inserta una notificación para el residente:
  - `type`: `libro_clinical_case_reviewed` o `libro_clinical_case_changes_requested`. El prefijo
    `libro_` hace que el trigger `set_notification_destination` (migración `20260820150000`) le
    ponga `destination_section = 'residenceLibrary'`.
  - `data.clinical_case_id`.
  - Registrar los dos `notification_types`, como hace `20261028120000_shift_debrief.sql`.
  - Texto, por ejemplo:
    - «Tu tutor ha revisado tu caso «EPOC»» / «Ya puedes ver su valoración en tu Libro».
    - «Tu tutor te pide cambios en «EPOC»» / «Revisa sus comentarios y vuelve a enviarlo».

**Reenvío tras modificaciones.** Cuando el residente vuelve a completar un caso con
`changes_requested`, el trigger lo pone otra vez en `pending`. Comprobar que funciona con la regla
«al pasar a completed».

**RLS de `libro_clinical_case_review`:**

- El residente hace `SELECT` de las revisiones de sus casos (`EXISTS` sobre el caso con
  `user_id = auth.uid()`).
- Nadie escribe por tabla.
- Docencia lee por la RPC del panel.

**`get_clinical_cases_for_panel`:**

- Añadir `review_status` y `reviews` (historial ordenado) a cada caso.
- Mostrar el contenido también cuando `review_status IN ('pending', 'reviewed')`. Ya ocurre,
  porque esos casos están en `completed`.
- Un caso en `draft` con `changes_requested` sigue sin contenido (el residente lo está rehaciendo),
  pero sí devuelve su historial de revisiones.

**Comprobaciones antes de aplicar:**

- **Compatibilidad:**
  - con la 1.0.95 sin actualizar, un caso devuelto vuelve a `draft` («En progreso») y el
    residente puede editarlo y completarlo;
  - un caso `reviewed` da error al editar, con un mensaje claro.
- **Borrado de usuario:** cascade desde el caso.
- **Ensayo que se revierte:** con residente, tutor (`e2e-panel-tutor`, `da1e925f-…`), owner
  (`c7cec1f1-…`) y un residente de otro hospital.

### 2. `losresis-panel`

- **`ClinicalCasesEditor`:** añadir la columna «Revisión tutor» con checkbox, igual que
  «Obligatorio». El payload ya manda `tutor_review_enabled`.
- **`lib/libroClinicalCases.ts`:**
  - tipos `review_status` y `reviews`;
  - rótulos «Pendiente de revisión», «Revisado» y «Modificaciones solicitadas»;
  - helper `reviewLabel`;
  - el estado que se enseña sigue el orden reviewed > pending > completed > changes_requested >
    in_progress > pending (sin ficha).
  - Tests en vitest.
- **`ResidentClinicalCases`:**
  - **Tabla:** nueva columna «Revisión tutor» (mockup: Revisado / Pendiente / —). El chip de
    estado distingue «Pendiente de revisión».
  - **Ficha:** dos pestañas, «Caso del residente» y «Evaluación del tutor» (mockup). Si
    `review_status = 'pending'`, la segunda tiene el formulario (cuatro textareas y los botones
    «Marcar como revisado» y «Solicitar modificaciones»). Si no, enseña la última revisión y el
    historial.
  - Después de guardar, recargar el dossier.
  - La llamada va por `supabase.rpc("review_clinical_case", …)`. Puede ir en un hook pequeño o en
    `useResidentDossier`; mirar cómo guarda la ficha de tutorías.
- **Antes de desplegar:** `npx tsc --noEmit`, lint y `npx vitest run`. Probarlo en el navegador
  como `e2e-panel-tutor`; en la fase 1 no se hizo.

### 3. `losresis-app`

**Versión:** si `docs/releases/1.0.95.md` sigue en `Estado: en desarrollo`, va en la 1.0.95. Si
ya se ha publicado, preguntar a qué versión va y ponerle el tag en ClickUp.

**`utils/clinicalCases.js`:**

- `displayStatusOf` devuelve también `pending_review`, `reviewed` y `changes_requested`, con su
  entrada en `CLINICAL_CASE_STATUS`. Colores: revisado verde, pendiente de revisión azul o
  violeta, modificaciones ámbar o rojo.
- `portfolioProgress`: un caso cuenta como completado si `status = 'completed'`, esté pendiente
  de revisión o revisado (ver Dudas).
- Helper `isLockedByReview(case)`.
- Tests en Jest.

**`services/clinicalCaseService.js`:** leer `review_status` y las revisiones. Hay dos opciones:
embebidas (`reviews:libro_clinical_case_review(*)` ordenadas) o una consulta aparte. Traducir el
error del bloqueo.

**`ClinicalCaseFormScreen`:**

- Bloque «Revisión del tutor» (mockup pantalla 4) arriba, si hay revisiones: chip, valoración
  general, aspectos positivos, aspectos a mejorar, comentarios y fecha de revisión. Debajo, el
  historial plegado.
- `reviewed` → solo lectura.
- `changes_requested` → aviso destacado «Tu tutor te ha pedido cambios», formulario editable y
  botón «Volver a enviar».
- `pending`, el residente lo edita:
  - **Por defecto:** se puede seguir editando y el caso sigue `pending`.
  - **Alternativa:** que vuelva a `draft`.
  - Decidir y anotarlo.

**Destino del push:** el destino `residenceLibrary` abre el Libro en el índice. Si es barato,
abrir directamente «Casos clínicos». Mirar cómo `DashboardScreen` pasa parámetros a
`residenceLibrary` (`handleSectionChange`) y si `ResidenceLibraryScreen` acepta una sección
inicial. Si no es barato, dejarlo en el índice y decirlo.

**E2E:** ampliar el flujo o crear `…-casos-clinicos-revision.yaml`:

1. El seed activa `tutor_review_enabled` en EPOC.
2. Al completar EPOC sale «Pendiente de revisión».
3. Un script, como owner o tutor, pide modificaciones por RPC.
4. Al relanzar la app sale «Modificaciones solicitadas» con los comentarios.
5. El residente lo vuelve a enviar.
6. Un script marca el caso como revisado.
7. Sale «Revisado», la ficha queda en solo lectura y se ve la valoración.
8. Se comprueba por API que hay **dos** revisiones en el historial.

Al final hay que dejar la plantilla como estaba (sin publicar).

## Casos límite que hay que cubrir

- **El hospital apaga la revisión con casos pendientes:**
  - **Por defecto:** los `pending` pasan a `NULL` (completados normales) en
    `save_libro_clinical_case_block`.
  - Los `reviewed` se quedan.
- **El hospital la enciende con casos ya completados:**
  - **Por defecto:** no pasan a `pending` solos. Solo los que se completen a partir de entonces.
- **El residente borra un caso revisado:**
  - **Por defecto:** no puede (trigger `BEFORE DELETE`).
  - Con la revisión pendiente sí puede, y se borra el historial en cascada.
- **Desvincular o cambiar de requisito un caso con revisiones:** no se puede.
- **Tutor sin alcance sobre el residente:** error de permiso.
- **Dos tutores revisan a la vez:** solo vale el primero. La RPC comprueba `pending` con
  `FOR UPDATE`.
- **Casos libres:** no se revisan (no tienen toggle).

## Dudas para presentar en el plan (cada una con su respuesta por defecto)

1. **¿«Revisado» bloquea la edición?** Por defecto, **sí**, como dice la tarea («mientras no esté
   bloqueado por una validación»).
2. **¿«Pendiente de revisión» cuenta en «X de N completados»?** Por defecto, **sí**: el residente
   ya ha cumplido su parte. Así los números no bajan cuando se activa la revisión.
3. **¿Quién revisa?** Por defecto, **cualquier cuenta con alcance docente** sobre el residente
   (owner, editor o tutor de su especialidad, [[losresis-tutor-assignment-by-speciality]]).
4. **¿Se avisa al residente con push en los dos resultados?** Por defecto, **sí** (la tarea solo
   exige avisar de las modificaciones; el «Revisado» también es útil y es barato).
5. **Si el tutor ve el caso devuelto mientras el residente lo rehace:** por defecto, **no ve el
   contenido**, solo el estado y su historial (misma regla que los borradores).

## Fuera de alcance de esta pasada

- **Fase 3:** área «Casos clínicos» en Tutorías (`tutoringRecord.ts` ya tiene la clave
  `clinical_cases`) y PDF individual y del Libro.
- **Fase 4:** número mínimo y categorías.

## Al terminar

- Seguir el paso 6 de la skill: subir a `main`, `vercel --prod` del panel y la entrada en
  `docs/releases/<versión>.md`.
- La tarea de ClickUp **sigue `in progress`**, porque quedan las fases 3 y 4.
- Actualizar la memoria `losresis-clinical-cases-phases.md`.
