---
name: bug-review
description: >
  Revisión de corrección para LosResis (app Expo / React Native + backend Supabase),
  proyecto de un solo dev que sube directo a main sin revisión humana. UN skill, dos
  modos, el mismo cazador de bugs. Modo GATE (el principal — cambios locales sin pushear):
  valida el diff local contra los criterios mínimos del proyecto + la caza sistemática de
  bugs A–G + typecheck → veredicto PASS / BLOCK, sin subir nada. Modo REVIEW (pegas una
  URL github.com/*/pull/*): caza bugs sobre el PR publicado y, tras confirmar, publica
  comentarios inline. Úsalo cuando digas "antes de subir esto", "¿está listo para main?",
  "revisa mis cambios", "pre-push", "code review", o pegues una URL de PR — aunque no
  expliques nada más. Este skill encuentra BUGS y hace cumplir los criterios mínimos; NO
  es una revisión estructural / de mantenibilidad.
---

# Skill: Bug Review (gate de corrección + review de PR) — LosResis

Encuentra código que **va a fallar en producción** — bugs, errores de lógica, fallos de
datos, fugas de seguridad — y hace cumplir los **criterios mínimos del proyecto LosResis**.

Este proyecto es una **app Expo / React Native (JavaScript)** con backend **Supabase**
(Postgres + RLS, Edge Functions en Deno, Storage). Lo lleva **un solo dev** que **sube
los cambios directamente a `main` sin revisión humana**. Por eso el modo por defecto y más
importante es **GATE**: tu última red de seguridad antes de pushear. No hay revisor que te
salve después.

**Filosofía:** Esto NO es un linter ni una revisión de estilo o estructura. Su único
objetivo es la corrección: código que crashea la app, corrompe datos, rompe una query
contra el esquema, o deja la UI en un estado imposible. Estilo, nombres y formato se
ignoran salvo que escondan un bug o violen un criterio mínimo (§2). Para calidad de
abstracción, tamaño de archivos y spaghetti existe otra revisión (la de calidad); esta es
el eje de **corrección**.

---

## 0. Detecta el modo desde la entrada

| Entrada del usuario | Modo | Salida |
|---|---|---|
| "antes de subir", "pre-push", "¿está listo?", o nada + hay cambios locales | **GATE** | Veredicto `✅ PASS` / `🚫 BLOCK` en la conversación. No sube nada. |
| Una URL `github.com/*/pull/*` | **REVIEW** | Comentarios inline en el PR (tras confirmar) + resumen. |

Si la entrada es ambigua (hay una URL de PR *y* además cambios locales), pregunta cuál
quiere revisar. Si no hay cambios locales ni URL, dilo y para.

> Este proyecto no usa Linear. No intentes resolver tickets ni preguntes por ellos.

---

## 1. Determina el diff bajo revisión

### Modo GATE — el diff local sin pushear

Revisa lo que el dev está a punto de subir a `main`:

```bash
git rev-parse --abbrev-ref HEAD                              # rama actual
git status --short                                           # staged + working tree
git diff HEAD                                                # cambios sin commitear
git log --oneline origin/main..HEAD                          # commits locales sin pushear
git diff origin/main...HEAD                                  # diff completo sin pushear
```

El diff a revisar = **commits locales sin pushear + cambios sin commitear**. Como el dev
trabaja directo sobre `main`, frecuentemente lo relevante será `git diff HEAD` (working
tree) y/o `git diff origin/main`. Si no hay ningún cambio, dilo y para.

### Modo REVIEW — el diff del PR publicado

```bash
gh pr view {number} --json title,body,author,baseRefName,headRefName,additions,deletions,changedFiles
gh pr diff {number} --name-only
gh pr diff {number}
```

> Si `gh` no está autenticado, dile al usuario que ejecute `gh auth login`.

### Ambos modos — lee el archivo entero, no solo el hunk

Para cada archivo con lógica no trivial, **lee el archivo completo** (no solo el diff).
Muchos bugs solo se ven con contexto: una variable cuyo significado cambió, una función
llamada con la firma vieja, un estado compartido mutado sin actualizar a sus consumidores,
un `useEffect` cuya cleanup ya no cuadra con sus dependencias.

---

## 2. Criterios mínimos del proyecto (BLOQUEANTES en ambos modos)

Cualquier violación es bloqueante. En GATE fuerza `🚫 BLOCK`; en REVIEW se publica como
comentario CRITICAL/HIGH.

### 2a. Sin `console.log` / debug olvidados
Nada de `console.log`, `console.debug`, `console.info`, `debugger`, ni `alert(...)` de
depuración en el código a subir. `console.warn` / `console.error` legítimos para registrar
errores reales están permitidos.
```bash
git diff origin/main...HEAD | grep -nE '^\+.*(console\.(log|debug|info)|debugger)\b'
```

### 2b. Errores de Supabase siempre comprobados
`@supabase/supabase-js` **no lanza** en los errores de query: devuelve `{ data, error }`.
Ignorar `error` es el bug nº1 de este stack. Para cada llamada a Supabase en el diff
(`.from()...select/insert/update/delete/upsert/rpc`, `.auth.*`, `.storage.*`), confirma que:
- Se desestructura y **comprueba `error`** antes de usar `data`.
- No se asume que `data` no es `null`. Con `.select()` sin `.single()`, `data` es un array
  (puede venir `[]`). Con `.single()` / `.maybeSingle()` puede venir `null` o `error` si
  no hay exactamente una fila — **`.single()` da error con 0 o >1 filas**; usa
  `.maybeSingle()` cuando "cero filas" es un caso válido.
```bash
git diff origin/main...HEAD | grep -nE '^\+.*(supabase|\.from\(|\.rpc\(|\.auth\.|\.storage\.)'
```
Para cada match, lee el bloque y confirma el manejo de `error` y de `data` nulo/vacío.

### 2c. Consistencia query ↔ esquema / migración / RLS (cliente ↔ backend)
**Dispara (obligatorio)** cuando el diff:
1. Toca una query Supabase (`services/*.js`, hooks, pantallas) que lee/escribe columnas, **o**
2. Añade/cambia una migración en `supabase/migrations/`, **o**
3. Cambia las columnas/filtros/`select(...)` enviados o la forma de la respuesta leída.

**Verifica contra el esquema real (las migraciones de `supabase/migrations/`):**
- Las columnas referenciadas en `.select('...')`, `.eq()`, `.order()`, `.insert({...})`,
  `.update({...})` **existen** con ese nombre y tipo en la tabla.
- Los nombres de tablas y de relaciones embebidas (`select('*, otra_tabla(...)')`) existen.
- Si el diff añade una columna sin default a una tabla con filas, los `insert` viejos no se
  rompen; si renombra/elimina una columna, ninguna query del repo sigue usando el nombre viejo.
- **RLS**: si la tabla tiene Row Level Security, la operación (select/insert/update/delete)
  está cubierta por una policy para el rol del usuario autenticado. Una query correcta pero
  sin policy devuelve `[]` o un error de permisos en runtime, no en build. Si no puedes
  comprobar las policies, **dilo explícitamente** y pide confirmar — no asumas que pasa.

Una query desalineada con el esquema o sin policy = bug de integración = bloqueante.
Reporta por cada archivo de servicio/migración tocado: tabla y veredicto
(✅ alineado / 🚫 roto — columna/tabla X / ⚠️ no pude verificar RLS).

### 2d. Sin inconsistencias de código
Ningún estado queda incoherente por el cambio: imports/vars sin usar introducidos por el
diff, firmas de función cambiadas sin actualizar a todos los llamadores, props o tipos
desincronizados, ramas muertas, código duplicado que debería reutilizar algo existente. Si
se renombra un campo/constante, se actualiza cada uso del diff (y del archivo).

### 2e. Sin secretos hardcodeados
Nada de API keys, tokens, contraseñas ni connection strings en el código. En Expo, las
variables de cliente van por `app.config.js` / `expo-constants` / `EXPO_PUBLIC_*`. Recuerda:
todo lo que llega al bundle de la app es **público** — la `service_role` key de Supabase
**nunca** debe estar en el cliente; en el cliente solo va la `anon` key, y la seguridad real
la dan las **policies RLS**, no el ocultar la key. Secretos de verdad van en Edge Functions
(env de Supabase), no en la app.
```bash
git diff origin/main...HEAD | grep -nE '^\+.*(service_role|sk_live|secret|password|api[_-]?key)\s*[:=]'
```

### 2f. Suscripciones, listeners y async sin limpiar (fugas / setState tras unmount)
Hazard típico de React Native: efectos que se suscriben (Supabase Realtime
`channel(...).subscribe()`, `AppState`, navegación, timers, `Notifications` listeners) y no
limpian, o `setState` tras `await` cuando el componente ya se desmontó. Para cada `useEffect`
del diff comprueba:
- Si crea un canal/listener/intervalo/timeout, **devuelve una cleanup** que lo cierra
  (`supabase.removeChannel(ch)`, `subscription.remove()`, `clearInterval`, `clearTimeout`).
- El **array de dependencias** es coherente con lo que el efecto usa (ni de menos —stale
  closures— ni de más —re-suscripciones en bucle).
- Tras un `await` dentro del efecto o de un handler, no se hace `setState` sin un guard de
  "sigo montado" o un `AbortController`. Un `setState` tras unmount es un warning y a menudo
  un bug de estado.

### 2g. Sin romper la UI por datos ausentes
La causa más común de pantallazo blanco/crash en RN es leer propiedades de datos que aún no
llegaron o vinieron vacíos. Marca como bug:
- Acceso encadenado a datos remotos sin `?.` ni guard mientras `loading` (`user.hospital.name`
  cuando `user` puede ser `null` durante la carga).
- `.map()` / `.length` sobre algo que puede ser `undefined`/`null` (recuerda §2b: Supabase
  puede devolver `null`).
- Renderizar texto crudo fuera de `<Text>` (en RN crashea), o un valor numérico/booleano
  donde se espera string.
- Claves de lista (`key`) ausentes o no únicas en `.map()` que renderiza componentes.

---

## 3. Caza sistemática de bugs (A–G) — ambos modos

No leas por encima. Para cada archivo modificado recorre estos pasos en orden.

### A — Flujo de datos
De dónde vienen los inputs (props, params de navegación, respuesta de Supabase, AsyncStorage,
estado global), qué transformaciones se aplican (¿pueden fallar?), cómo se usa/persiste la
salida. Busca: `null`/`undefined` usado sin comprobar; tipos incompatibles; mutación in-place
cuando los consumidores asumen inmutabilidad (estado de React **nunca** se muta en sitio).

### B — Condiciones límite
Para cada rama (`if`, `switch`, ternario, guard): input vacío (string/array/objeto vacío, 0,
false); límites (primero/último, máx/mín, exactamente N); input inesperado (tipos erróneos,
negativos, NaN, fechas inválidas); falta de `else`/`default`. Cuidado con fechas/zonas
horarias (la Agenda y las Guardias dependen de fechas exactas).

### C — Errores de lógica
Condiciones invertidas / dobles negaciones / `&&`/`||` cambiados / comparaciones invertidas;
off-by-one (`<` vs `<=`, índices de slice, paginación que salta/repite); operador equivocado
(`=` vs `===`); precedencia sin paréntesis claros; variables sombreadas; return/break
temprano que se salta limpieza o actualización de estado.

### D — Concurrencia, async y estado de React
`await` olvidado o promesas sin manejar; condiciones de carrera entre comprobar y usar;
`setState` basado en estado previo sin la forma funcional (`setX(prev => ...)`); efectos que
disparan en bucle por dependencias mal puestas; doble submit de un botón sin deshabilitarlo;
`Promise.all` sobre una lista grande que dispara N llamadas concurrentes a Supabase (acota
con lotes/`p-limit`). Recuerda §2f para limpieza de suscripciones.

### E — Manejo de errores y fallos
Errores silenciados (`catch` vacío, `error` de Supabase ignorado —ver §2b—, logueado pero no
propagado a la UI); fallo parcial dejando estado inconsistente (p. ej. una Guardia que crea
también una fila legacy en `shifts` por `source_shift_id`: si la segunda escritura falla,
¿queda huérfana?); retry sin idempotencia (doble insert/doble cobro); índice fuera de rango,
división por cero sin guard. Tras un fallo, ¿la UI sale del estado `loading`? Un `loading`
que nunca se apaga por un error no manejado deja un spinner infinito.

### F — Datos y persistencia (Supabase / Postgres)
Migraciones (campos nuevos sin default sobre tablas con filas, campos eliminados aún
consultados, tipos cambiados sin migrar los datos); queries incorrectas (`.eq()` que
mis-filtra, joins embebidos que multiplican filas, N+1 dentro de un `.map()` que hace una
query por ítem); inserts/updates que pisan datos sin merge; `delete` sin el filtro correcto
(¡un `.delete()` sin `.eq()` borra toda la tabla!); enums/tipos de evento de agenda
(`shift`, `course`, `research`, `study`, `conference`, `day_off`, `reminder`) con un valor
nuevo que el código viejo no maneja. Comprueba también consistencia con los datos cacheados
en `supabase/cache/*.json` y en Storage si el diff los toca.

### G — Seguridad (solo explotable)
La superficie real aquí es **RLS y la frontera cliente/Edge Function**: ¿una tabla nueva o
una operación queda sin policy y expone datos de otros residentes (IDOR)? ¿una Edge Function
confía en datos del cliente sin validar? ¿se filtra la `service_role` key o un secreto al
bundle (§2e)? ¿una query construida con interpolación de strings en una RPC permite
inyección? No reportes "buenas prácticas" genéricas.

### Clasificación de severidad

| Severidad | Criterio | Emoji |
|---|---|---|
| **CRITICAL** | Crash en producción, pérdida de datos, vulnerabilidad explotable, fuga de datos entre usuarios | 🔴 |
| **HIGH** | Resultado incorrecto, corrupción silenciosa de datos, condición de carrera probable | 🟠 |
| **MEDIUM** | Bug de caso límite que ocurrirá en uso real, manejo de error incorrecto | 🟡 |
| **LOW** | Caso límite improbable, posible problema serio de rendimiento | 🔵 |

CRITICAL y HIGH son **bloqueantes**. MEDIUM/LOW son avisos que el dev decide.

---

## 4. Comprobaciones automáticas (modo GATE)

Detecta y ejecuta las herramientas del repo. Si una no existe, márcala "no aplica" — no
inventes comandos. Este proyecto es Expo/JS con TypeScript disponible pero código casi todo
en `.js`, y **sin runner de tests ni lint configurado** a día de hoy.

```bash
cat package.json | jq -r '.scripts | keys[]' 2>/dev/null
npx tsc --noEmit                      # typecheck (hay tsconfig.json); reporta errores de tipos
# Por archivo .js tocado con lógica, un chequeo de sintaxis rápido:
node --check <archivo.js>
```

- **`tsc --noEmit` falla** con errores en archivos del diff → BLOCK.
- **`node --check` falla** en un `.js` del diff → BLOCK (error de sintaxis).
- Edge Functions (Deno) en `supabase/functions/*`: si el diff las toca, `deno check <archivo>`
  cuando esté disponible.
- No hay tests que correr (aún). Si en el futuro se añade `npm test`, ejecútalo y un fallo → BLOCK.

Si una comprobación es pesada o poco clara, dilo y pregunta antes de ejecutarla.

---

## 5. Salida

### Modo GATE — veredicto PASS / BLOCK (en conversación, no sube nada)

Regla del veredicto: `🚫 BLOCK` si hay **cualquier** violación de §2, un bug 🔴/🟠 de §3, o
un fallo de typecheck/sintaxis de §4. Si no, `✅ PASS` (los MEDIUM/LOW se listan como avisos).

```
## 🧪 Bug Review (GATE) — main (local sin pushear)
Cambios: +{add} / -{del} en {N} archivos · {M} commits sin pushear

### Criterios mínimos
- [✅/🚫] Sin console.log / debug
- [✅/🚫] Errores de Supabase comprobados (data/error, null, single vs maybeSingle)
- [✅/🚫] Query ↔ esquema/migración/RLS verificado  (tabla: {t} → {veredicto})
- [✅/🚫] Sin inconsistencias de código
- [✅/🚫] Sin secretos hardcodeados (anon ok / service_role nunca en cliente)
- [✅/🚫] Suscripciones/efectos con cleanup y deps correctas
- [✅/🚫] UI robusta ante datos ausentes/vacíos

### Comprobaciones automáticas
- [✅/🚫/➖] tsc --noEmit
- [✅/🚫/➖] node --check (archivos .js tocados)
- [✅/🚫/➖] deno check (Edge Functions tocadas)

### 🐛 Bugs encontrados  (orden de severidad descendente)
1. 🔴 CRITICAL — {título}
   Archivo: `{path}:{línea}` · Problema: {qué falla} · Escenario: {cuándo} · Fix: {cómo}

### ⚠️ Avisos (no bloqueantes)
- 🟡 ... / 🔵 ...

---
## Veredicto: {✅ PASS · listo para subir a main | 🚫 BLOCK}
{Si BLOCK: lista numerada y accionable de qué arreglar antes de pushear.}
{Si PASS: confírmalo; recuerda que el push a main lo hace el dev — este skill no sube nada.}
```

**El modo GATE nunca sube nada.** Es un gate; el dev pushea a `main` manualmente cuando pasa.

### Modo REVIEW — comentarios inline en el PR

Solo si el usuario pega una URL de PR. Cada bug:

```
{emoji} **{SEVERIDAD}: {título corto}**

{qué falla, cuándo, qué impacto}

**Escenario de fallo:** {disparador concreto}

**Fix sugerido:**
​```{lenguaje}
{código corregido}
​```
```

Publica el review con comentarios inline:
```bash
COMMIT_SHA=$(gh pr view {number} --json headRefOid --jq '.headRefOid')
gh api repos/{owner}/{repo}/pulls/{number}/reviews \
  --method POST \
  --field commit_id="$COMMIT_SHA" \
  --field event="COMMENT" \
  --field body="## 🐛 Bug Review

Encontrados {N} posibles bugs ({N_critical} críticos, {N_high} altos, {N_medium} medios, {N_low} bajos).

_Review generado por Claude Code_" \
  --field 'comments=[
    { "path": "{file_path}", "line": {line_in_new_file}, "body": "{escaped_body}" }
  ]'
```
`line` es la línea en el archivo **nuevo** (lado derecho del diff). Escapa comillas/saltos en
el JSON. Si la API rechaza una posición, ajústala al hunk más cercano y reintenta.

**Confirma siempre antes de publicar:**
```
Voy a publicar estos comentarios en el PR #{number}:
1. 🔴 CRITICAL en `services/x.js:42` — ...
2. 🟠 HIGH en `screens/Y.js:88` — ...
¿Los publico?
```
Solo haz POST tras confirmación explícita. Añade además un resumen en la conversación.
Si está limpio: `## ✅ Sin bugs detectados — los cambios parecen correctos y seguros.`

---

## 6. Notas de comportamiento

- **Solo corrección.** No reportes estilo, nombres, formato ni mantenibilidad estructural —
  eso es otra revisión. La excepción son los criterios mínimos de §2, que sí bloquean.
- **Prioriza por severidad.** CRITICAL y HIGH primero, siempre.
- **Sé específico.** Cada bug: qué falla, cuándo (escenario concreto), cómo arreglarlo. Nada
  de "esto podría dar problemas".
- **No inventes bugs.** Si dudas, no lo marques como bloqueante — ponlo como aviso o pregunta.
  Los falsos positivos erosionan la confianza, y aquí no hay revisor humano que filtre.
- **Lee el contexto.** El archivo entero, no solo el hunk. Para queries de Supabase, cruza
  contra las migraciones de `supabase/migrations/`.
- **GATE nunca sube nada. REVIEW siempre pregunta antes de publicar comentarios.**
- Si el diff es grande (>500 líneas), avísalo y pregunta si enfocar archivos concretos.
- Como el dev sube directo a `main` sin red de seguridad, ante la duda en un cambio de datos
  (migración, `delete`, `update` masivo, RLS) sé conservador y márcalo para revisión manual.
