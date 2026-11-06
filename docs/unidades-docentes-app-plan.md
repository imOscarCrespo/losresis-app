# Plan 2 — Unidades docentes en la app (losresis-app)

**Ya hecho (2026-11-06, versión 1.0.96, commit `01238ea`):** el registro (onboarding) y Explorar
hospitales esconden las unidades docentes (`utils/teachingUnits.js`,
`useHospitals({ hideTeachingUnits })`). El simulador MIR sigue enseñándolas. No lo deshagas.

Plan cerrado el 2026-11-06. Va después del Plan 1
(`losresis-panel/docs/unidades-docentes-plan.md`): lee sus secciones 1 y 2 antes de empezar,
porque explican qué es una unidad docente (UD) y qué se decidió. Si algo no cuadra, **para y
pregunta**.

Necesita del Plan 1 **solo el paso P1 (base de datos)** aplicado en producción: la columna
`sender_name` de la vista `hospital_announcement_for_resident`. Compruébalo antes de empezar:
```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'hospital_announcement_for_resident';
```
Si no está `sender_name`, el Plan 1 no ha llegado aún: para.

## 0. Cómo trabajar

- Repo `~/code/losresis-shared/losresis-app` (Expo / React Native, JS). Lee `AGENTS.md` (headers
  con `HeroScreenLayout`, iconos solo de `components/Icon.js`, textos en español).
- Base: solo lectura, por CLI desde este repo (`supabase db query --linked "<sql>"`, tras comprobar
  que `supabase/.temp/project-ref` es `chgretwxywvaaruwovbb`). Este plan no crea migraciones.
- La app publicada tarda días en actualizarse. Todo lo que cambies tiene que tolerar datos viejos
  (`sender_name` null).
- **Versión**: esto es trabajo de la app, va en la versión que esté "en desarrollo" en
  `docs/releases/` (hoy `1.0.96`; confírmalo en `docs/releases/README.md`). Pregunta al usuario
  en qué versión va antes de escribir la entrada. Si hay tarea en Freedcamp, la versión va en un
  comentario.
- Entrega: `npm test` (Jest) en verde; skill `bug-review` en modo gate sobre el diff; entrada en
  `docs/releases/<versión>.md` con el formato de las demás; commit y push a `main`. Este fichero
  no se commitea.

### Trabajo en paralelo

Los pasos 1 y 2 tocan ficheros distintos y pueden ir en paralelo (1 o 2 agentes). El paso 3 es la
publicación.

## 1. La ficha del hospital solo mira organizaciones de tipo hospital

**Por qué:** hoy `services/hospitalService.js` busca la organización de un hospital con
`.from("employer_org").eq("hospital_id", X).maybeSingle()` (~línea 618, perfil del hospital, y
~línea 793, especialidades con plan formativo). La RLS del Plan 1 (3.1) ya esconde las UD a quien
no es miembro, así que esto **no bloquea nada**. Es una defensa para el único caso que la RLS no
cubre: una persona que es miembro de una UD y además usa la app. Esa persona ve dos filas, y
`maybeSingle()` da error en la ficha de su hospital.

- En las dos consultas: `.eq("org_kind", "hospital")` además de `hospital_id`.
- Busca en `services/`, `screens/`, `hooks/` y `components/` cualquier otra lectura de
  `employer_org` o de `employer_org_profile*` que llegue por `hospital_id` sin pasar por
  `org_kind` (`getHospitalsWithFormativePlans` ya filtra; `lectureService.getResidentFallbackOrg`
  busca por nombre y no aplica). Arregla las que encuentres con el mismo criterio.
- Tests en `__tests__/services/` que cubran: con una org `hospital` y otra `teaching_unit` en el
  mismo hospital, el perfil devuelto es el del hospital; con solo una `teaching_unit`, se comporta
  como "hospital sin organización" (el perfil vacío que ya devuelve hoy).

## 2. Comunicados enseñan quién los manda

**Por qué:** decisión de producto: la UD quiere que sus residentes la reconozcan por su nombre.

- `services/docenciaService.js` ya lee `hospital_announcement_for_resident` con `select("*")`:
  `sender_name` llega sin tocar la consulta. Comprueba que el mapeo no descarta columnas.
- `screens/ComunicadosScreen.js` (~línea 144): la línea de metadatos pasa de
  `[created_by_name, sentAt]` a `[sender_name, created_by_name, sentAt]`, filtrando vacíos. Ejemplo:
  "UDM AFyC de Valencia. La Fe · Marta Ruiz · 12 nov".
  Para un hospital se verá el nombre de su organización, que es lo esperado.
- Si `sender_name` es null (comunicados antiguos), la línea queda como hoy.
- El subtítulo "Avisos y noticias de tu Unidad Docente" y el estado vacío no cambian.
- Test del componente o de la función que monta la línea con los tres casos (con remitente, sin
  remitente, sin persona).
- Cursos: no hay nada que hacer en la app. El Plan 1 rellena `courses.organization` con el nombre
  de la UD y la app ya lo enseña en `CourseCard` y `CourseDetailScreen`.

## 3. Publicación

Entrada en `docs/releases/<versión>.md` con: qué se hizo (los dos puntos de arriba en lenguaje de
usuario), cambios técnicos y tests.

No hay que subir la versión mínima obligatoria por este plan: nada del panel ni de la base
depende de que la gente actualice.

## 5. Casos a vigilar

- **Simulador MIR**: las unidades docentes tienen que seguir apareciendo. Sale del catálogo estático
  (`data/staticCatalog/hospitals.json`, `hospital_speciality*.json`), no de `employer_org`: no
  filtres por `org_kind` ni apliques `isSubHospitalName` en `services/mirSimulatorService.js` ni en
  `screens/MirSimulatorScreen.js`. Comprueba a mano que "Medicina Familiar y Comunitaria" sigue
  devolviendo unidades "Udm Afyc …".

- Un residente con la app antigua: sin `sender_name` en pantalla; todo lo demás igual.
- Vista sin `sender_name` (Plan 1 sin aplicar): la app nueva no puede romper; `item.sender_name`
  undefined se filtra igual que null.
- Nombres de UD largos ("Udm Afyc Vega Media Y Alta Del Segura Y Altiplano De Murcia. H.Comarcal
  Virgen Del Castillo De Yecla"): la línea de metadatos tiene que cortar o envolver sin desbordar.
  Prueba con ese nombre.
