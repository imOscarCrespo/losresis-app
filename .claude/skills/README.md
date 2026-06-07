# Skills de LosResis — guía de uso

Skills locales de este proyecto (Expo / React Native + Supabase), pensadas para un flujo de
**un solo dev que sube directo a `main` sin revisión humana**. Viven en `.claude/skills/` y
se versionan con la app.

Se invocan escribiendo `/<nombre>` en el chat de Claude Code, o Claude las activa sola cuando
detecta la intención. Si acabas de crearlas/editarlas, **reinicia la sesión** para que Claude
las descubra.

---

## El flujo, paso a paso (cronológico)

```
  ┌─ 1. /grill-with-docs ──┐   ┌─ 2. /tdd ──────────┐   ┌─ 3. /bug-review ──┐   ┌─ 4. push ─┐
  │  DISEÑO                │ → │  IMPLEMENTAR        │ → │  GATE antes de    │ → │  git push │
  │  afinar plan + dominio │   │  red-green-refactor │   │  subir (PASS/BLOCK)│   │  a main   │
  └────────────────────────┘   └─────────────────────┘   └────────────────────┘   └───────────┘
```

No es obligatorio usar las tres en cada tarea. La única que conviene volver **un hábito fijo**
es el paso 3 (`/bug-review`): como nadie revisa tu código después, es tu última red antes de
`main`.

---

### Paso 1 — `/grill-with-docs` · cuando estás *diseñando* (antes de escribir código)

**Cuándo:** tienes una idea o un plan para una feature/cambio no trivial y quieres afinarlo
antes de tocar código. Ideal para cosas que afectan al dominio (agenda, guardias, conexiones,
salud mental…).

**Qué hace:** te entrevista a fondo, una pregunta a la vez, retando tu plan contra el modelo
de dominio. Cruza lo que dices contra el código y contra tu glosario `CONTEXT.md`. A medida que
las decisiones se concretan:
- Actualiza `CONTEXT.md` (el glosario) cuando se afina o nace un término.
- Te ofrece crear un ADR en `docs/adr/` **solo** cuando la decisión es difícil de revertir,
  sorprendente sin contexto, y fruto de un trade-off real.

**Cómo lanzarlo:**
```
/grill-with-docs
Quiero añadir recordatorios recurrentes a los eventos de agenda. Esta es mi idea: ...
```

**Resultado:** un plan claro y tu documentación (`CONTEXT.md` / `docs/adr/`) ya al día. Sales
de aquí sabiendo *qué* construir y con qué lenguaje.

> Sáltalo si el cambio es trivial o mecánico (un fix pequeño, un ajuste de copy, un estilo).

---

### Paso 2 — `/tdd` · cuando estás *implementando*

**Cuándo:** vas a construir la feature o arreglar un bug y quieres hacerlo con tests primero.
Especialmente útil para lógica de `services/*.js`, `utils/*` y `hooks/*`.

**Qué hace:** ciclo **red → green → refactor** en rebanadas verticales (un test → su código →
repite; nunca todos los tests de golpe).
- La **primera vez** te ayuda a montar el runner (este proyecto aún **no tiene tests**):
  `jest-expo` + `@testing-library/react-native`. Pregunta antes de instalar nada.
- Te enseña a **mockear Supabase** en la frontera (la API encadenada `from().select()...` que
  termina en `{ data, error }`) y a testear los casos que luego vigila el bug-review: `error`
  no nulo, `data` vacío/`null`, `.single()` con 0 o >1 filas.

**Cómo lanzarlo:**
```
/tdd
Vamos a implementar connectionsService.acceptRequest con tests primero.
```

**Resultado:** la feature implementada con tests de comportamiento que sobreviven a refactors.

> Sáltalo si no vas a escribir tests para ese cambio. No pasa nada: el paso 3 sigue aplicando.

---

### Paso 3 — `/bug-review` · *justo antes de subir a `main`* (el hábito clave)

**Cuándo:** terminaste de programar y, antes de `git push`, quieres una última pasada. Este es
el paso que **no deberías saltarte**, porque después de `main` no hay revisor humano.

**Qué hace (modo GATE — el principal):** revisa tu diff local sin pushear y emite un veredicto
`✅ PASS` / `🚫 BLOCK`. Comprueba:
- **Criterios mínimos**: sin `console.log`/debug; errores de Supabase comprobados; queries
  alineadas con esquema/migraciones/**RLS**; sin secretos (`service_role` nunca en cliente);
  suscripciones/efectos con cleanup; UI robusta ante datos vacíos.
- **Caza sistemática de bugs A–G** (flujo de datos, límites, lógica, async/estado de React,
  errores, datos/persistencia, seguridad).
- **Comprobaciones automáticas**: `tsc --noEmit`, `node --check`, `deno check` en Edge
  Functions.

**Cómo lanzarlo:**
```
/bug-review
```
(o simplemente "revisa esto antes de subir" / "¿está listo para main?").

**Resultado:** si **PASS**, subes tú a mano (`git push`); el skill nunca sube nada. Si
**BLOCK**, te da la lista numerada y accionable de qué arreglar. Vuelve al paso 2 si hace falta.

**Modo REVIEW (secundario):** si en vez de cambios locales le pegas una URL
`github.com/.../pull/123`, revisa ese PR y, tras confirmar, publica comentarios inline. Útil
si alguna vez abres un PR en lugar de subir directo.

---

### Paso 4 — Subir a `main`

`/bug-review` no sube nada por diseño. Cuando el veredicto sea PASS, el push lo haces tú:

```bash
git add -A && git commit -m "..." && git push origin main
```

---

## Tabla resumen

| Paso | Skill | Momento | Pregunta que responde |
|---|---|---|---|
| 1 | `/grill-with-docs` | Diseñando, antes de codear | ¿Estoy construyendo lo correcto y con el lenguaje correcto? |
| 2 | `/tdd` | Implementando | ¿Mi código hace lo que debe, probado? |
| 3 | `/bug-review` | Antes de `git push` | ¿Esto va a romper en producción? (PASS/BLOCK) |
| 4 | `git push` | Publicar | — |

## Notas

- **Orden flexible, gate fijo:** usa 1 y 2 según convenga; haz de 3 un hábito.
- **Estas copias son un snapshot.** Vienen de `~/code/joinmitte-mirror/claude-skills`. Si
  actualizas ese repo, vuelve a copiar las carpetas para refrescarlas aquí.
- **Otros skills** (improve-codebase-architecture, thermo-nuclear, linear-task…) siguen
  disponibles vía el plugin global con el prefijo `mitte-skills:` si alguna vez los necesitas.
