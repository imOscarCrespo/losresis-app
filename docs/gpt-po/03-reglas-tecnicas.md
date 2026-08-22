# Reglas técnicas obligatorias de los repos LosResis

## === Reglas de losresis-app ===


## Database Source Of Truth

- La source of truth de la base de datos y de todas las migraciones compartidas es `~/code/losresis-shared/losresis-db`.
- Todas las migraciones SQL nuevas deben crearse siempre en `~/code/losresis-shared/losresis-db`, nunca en `losresis-app/supabase/migrations`.
- Nunca crear, editar ni considerar definitivas migraciones SQL dentro de `losresis-app` o sus submódulos locales si el cambio no existe también en `~/code/losresis-shared/losresis-db`.
- Cuando una tarea afecte al esquema, migraciones, funciones SQL, RLS, triggers, seeds o tipos derivados de la base de datos, trabajar primero en `~/code/losresis-shared/losresis-db`.
- Tratar `losresis-app` como consumidor de ese repo compartido, no como fuente de verdad para cambios de base de datos.
- Después de añadir o modificar una migración en `losresis-db`, el siguiente paso en `losresis-app` es actualizar el puntero del submódulo o reflejar el cambio consumido, no recrear la migración localmente.

## Database Naming Convention

- A partir de ahora, todo lo que se cree en base de datos lleva **siempre el nombre en inglés**: tablas, columnas, funciones, triggers, índices, políticas RLS, enums y sus valores.
- Los objetos existentes con nombre en español no se renombran; conviven con la convención nueva.
- Los textos destinados al usuario final (títulos/cuerpos de notificaciones, mensajes de error visibles) siguen en español; la convención aplica solo a los identificadores.

## Static Catalogs And Cached Egress

- `data/staticCatalog/*.json` son artefactos generados para reducir `Cached Egress` de Supabase; no son la source of truth.
- La app lee desde esos JSON para catálogos estáticos como hospitals, specialities, `hospital_specialities`, `hospital_speciality_grades`, preguntas estáticas y config estática pequeña.
- Si se cambia un hospital, especialidad, relación hospital-especialidad, nota/plaza MIR o pregunta estática en la DB, la app publicada no lo verá automáticamente.
- Después de cambiar la DB/source of truth, ejecutar siempre en `losresis-app`: `npm run export:static-catalog`.
- Tras regenerar `data/staticCatalog/*.json`, publicar una nueva build o EAS Update para que los usuarios reciban esos cambios.
- No editar manualmente los JSON como solución definitiva; si se hace para una emergencia, hay que reconciliarlo después con la DB y regenerar.
- Documentación operativa: `docs/static-catalog-cache-egress.md`.

## User Deletion Safety

- Si se añade una foreign key hacia `public.users(id)` o `auth.users(id)`, hay que definir explícitamente su comportamiento durante el borrado de usuario: `ON DELETE CASCADE`, `ON DELETE SET NULL` o una estrategia equivalente justificada.
- Si una relación nueva puede bloquear el borrado completo de una cuenta, la misma tarea debe incluir la migración necesaria para que la eliminación del usuario siga siendo posible sin limpieza manual posterior.
- No dar por válido un cambio de esquema que referencia usuarios si no se ha revisado también el flujo de eliminación de cuenta y sus dependencias históricas.

## Screen Layout And Header Convention

- Toda pantalla nueva dentro de `screens/` con header propio (título + botón volver opcional + acciones) debe usar `HeroScreenLayout` (`components/HeroScreenLayout.js`). Esto envuelve `BottomMenuHeroHeader` y resuelve el botón "Volver" automáticamente cuando se pasa `onBack`.
- Props relevantes: `title`, `subtitle`, `onBack`, `leftSlot`, `rightSlot`, `bottomContent`, `overlay`, `children`. Modales y FABs van en `overlay`; el contenido scrolleable va como `children`.
- Referencia canónica: `screens/HousingScreen.js` (uso de `heroProps` + `overlay` con `FilterModal` y `FloatingActionButton`).
- No reimplementar headers manuales con `View` + back button propio en pantallas nuevas; si necesitas un header distinto, primero amplía `HeroScreenLayout`/`BottomMenuHeroHeader` para que el patrón siga siendo uno solo.
- Para vistas embebidas dentro de un Dashboard que no son pantallas raíz (p.ej. listas dentro de una tab interna sin botón volver), sigue usando `HeroScreenLayout` y simplemente no pases `onBack`.

## Icon Library Convention

- La librería de iconos oficial de la app es **Phosphor** (`phosphor-react-native`). Todos los iconos se renderizan a través del wrapper `components/Icon.js` (`<Icon name="..." />`), que mapea nombres estilo Ionicons a componentes Phosphor.
- **Prohibido** importar `@expo/vector-icons` (Ionicons, MaterialCommunityIcons, etc.) u otra librería de iconos en cualquier `screen` o `component` nuevo. Usa siempre `import { Icon } from "<ruta>/components/Icon"`.
- Si necesitas un icono que aún no está mapeado, añade la entrada a `IONICON_TO_PHOSPHOR` en `components/Icon.js` (y, si su relleno tiene significado de estado activo, a `FILLED`). No lo resuelvas importando otra librería.
- El `<Icon>` acepta `name`, `size`, `color` y `weight` (`thin|light|regular|bold|fill|duotone`). Por defecto usa `regular`, salvo los nombres en `FILLED` que usan `fill`. Para iconos directos de Phosphor (p.ej. menús con componentes), importa el componente concreto desde `phosphor-react-native`.
- Excepción de marca: el componente del menú de accesos rápidos de la home (`components/QuickActionsMenu.js`, incluido su modal "Ver más opciones") **no debe usar nunca el morado de marca** (`#670CF5`).

## Speciality Quiz Versioning

- El test de especialidad MIR tiene actualmente dos versiones que deben poder convivir en base de datos y en la app mientras existan usuarios sin actualizar.
- La versión antigua usa `meta.version = 'v2_profiles_abcd'` y la RPC `calculate_top_specialities`.
- La versión nueva usa `meta.version = 'v3_profiles_abcd_18'`, preguntas con `speciality_quiz_question.quiz_version = 'v3_profiles_abcd_18'` y la RPC `calculate_top_specialities_v3`.
- No reinterpretar, migrar en caliente ni sobrescribir sesiones históricas `v2` con la lógica `v3`.
- Cualquier cambio futuro en preguntas, scoring, perfiles o RPC del quiz debe ser versionado y compatible con ambas rutas hasta que se retire explícitamente la compatibilidad.
- Si una tarea toca el dashboard, histórico, persistencia de sesiones o lectura de `top_results` / `raw_scores`, revisar siempre compatibilidad con sesiones `v2` y `v3`.

## === Reglas de losresis-panel ===


## Paleta Corporativa

- Colores oficiales de LosResis, obligatorios en todo el panel:
  - Morado principal `#680CF5` → `brand-500` (`--brand`)
  - Lavanda secundario `#F4EFFE` → `brand-50` (`--brand-tint`)
  - Verde `#36E3A0` → `mint-400` (`--brand-green`; sobre fondo claro usa `mint-600/700`)
  - Azul oscuro terciario `#1E1147` → `navy-900` (`--brand-navy`)
- La fuente de verdad son las rampas de `tailwind.config.js`; `src/app/globals.css` solo
  refleja los cuatro valores oficiales como variables CSS para los componentes `app-*`.
- Usar siempre las escalas `brand-*`, `mint-*`, `navy-*` e `ink-*` (neutros tintados hacia
  la marca). No escribir hex sueltos ni clases arbitrarias tipo `text-[#680CF5]`.
- Los nombres de Tailwind `slate/gray/zinc/neutral/stone`, `sky/blue/indigo/violet/purple/fuchsia`
  y `emerald/green/teal` están reasignados en la config a esas rampas: el código antiguo hereda
  la marca y no puede colarse un azul o un verde ajenos.
- `red` y `amber` se mantienen como colores semánticos de error y aviso, no son colores de marca.

## Database Source Of Truth

- La source of truth de la base de datos y de todas las migraciones compartidas es `~/code/losresis-shared/losresis-db`.
- Todas las migraciones SQL nuevas deben crearse siempre en `~/code/losresis-shared/losresis-db`, nunca en `losresis-panel/supabase/migrations`.
- Nunca crear, editar ni considerar definitivas migraciones SQL dentro de `losresis-panel` o sus submódulos locales si el cambio no existe también en `~/code/losresis-shared/losresis-db`.
- Cuando una tarea afecte al esquema, migraciones, funciones SQL, RLS, triggers, seeds o tipos derivados de la base de datos, trabajar primero en `~/code/losresis-shared/losresis-db`.
- Tratar `losresis-panel` como consumidor de ese repo compartido, no como fuente de verdad para cambios de base de datos.
- Después de añadir o modificar una migración en `losresis-db`, el siguiente paso en `losresis-panel` es actualizar el puntero del submódulo o reflejar el cambio consumido, no recrear la migración localmente.

## Database Naming Convention

- A partir de ahora, todo lo que se cree en base de datos lleva **siempre el nombre en inglés**: tablas, columnas, funciones, triggers, índices, políticas RLS, enums y sus valores.
- Los objetos existentes con nombre en español no se renombran; conviven con la convención nueva.
- Los textos destinados al usuario final (títulos/cuerpos de notificaciones, mensajes de error visibles) siguen en español; la convención aplica solo a los identificadores.
