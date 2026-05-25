# 03 · Propuesta de implementación — "Antes del MIR"

> Síntesis de los datos de PostHog ([01](./01-analisis-datos-posthog.md)) y la investigación de
> opiniones reales + competencia ([02](./02-investigacion-opiniones-reales.md)), aplicada a las
> 3 funcionalidades de prioridad alta.

## Principio rector

> **No construir "otra app de preguntas".** El mercado ya está cubierto (MirMeApp, MirSimulador,
> MiMIR, Anki) y hay opciones gratuitas muy buenas. El foso defensivo de LosResis es **conectar el
> estudio con el destino**: progreso → nota MIR proyectada → simulador de plazas (que ya usa el 99%
> de sus estudiantes) → hospital y vivienda. Ese bucle no lo tiene ningún competidor.

```
┌─────────────┐   ┌──────────────────┐   ┌─────────────────────┐   ┌────────────────────┐
│ Estudio     │   │ Nota MIR         │   │ Simulador de plazas │   │ Hospital + vivienda│
│ (preguntas, │──▶│ PROYECTADA       │──▶│ (YA EXISTE, 99% lo  │──▶│ (YA EXISTE)        │
│  repaso)    │   │ (a partir de tus │   │  usa)               │   │                    │
│  ★ NUEVO    │   │  simulacros) ★   │   │                     │   │                    │
└─────────────┘   └──────────────────┘   └─────────────────────┘   └────────────────────┘
        nuevo "antes del MIR"  ──────────▶  el "después del MIR" que ya funciona
```

---

## Funcionalidad 1 — Banco de preguntas + simulacros cronometrados

**Por qué (evidencia):** el error nº1 validado es el insuficiente entrenamiento con preguntas
("el examen se gana sobre test, no sobre páginas leídas", doc 02 §1.1). Es la feature de mayor
impacto sobre el resultado del estudiante.

**Alcance MVP:**
- Banco de preguntas clasificadas por **asignatura/especialidad** (mapea con `specialtyId`, que ya
  existe en el modelo de datos).
- Modos de práctica: **test corto** (10/20/50), **simulacro completo** (210, cronometrado, con
  cálculo de **nota neta MIR**), y **modo solo-falladas**.
- **Evitar repetir preguntas ya acertadas** (paridad con MirSimulador).
- Cada pregunta con **explicación comentada** de todas las respuestas.

**Diferenciador:** al terminar un simulacro, el resultado **alimenta directamente la nota
proyectada** (Funcionalidad 3) y enlaza con el simulador de plazas existente.

**Eventos PostHog a instrumentar:**
`question_bank_session_started` (props: `mode`, `specialtyId`, `num_questions`),
`question_answered` (`correct`, `specialtyId`, `time_ms`),
`simulacro_completed` (`score_neta`, `percentil`, `duration_min`).

---

## Funcionalidad 2 — Repaso espaciado adaptativo (flashcards / re-test)

**Por qué (evidencia):** "si no repaso, se me olvida" con un temario enorme; el repaso espaciado
estilo Anki es masivamente adoptado (doc 02 §1.2).

**Alcance MVP:**
- Las preguntas **falladas** entran automáticamente en una cola de **repaso espaciado** (intervalos
  crecientes según aciertos sucesivos).
- Flashcards de alto rendimiento (farmacología, valores, algoritmos) como complemento ligero.
- **Pregunta flash diaria** (paridad con MiMIR) → es el **gancho de retención más barato y validado**
  para mantener al estudiante activo **fuera de la temporada de elección** (clave dado el riesgo de
  estacionalidad del doc 01 §4). Se apoya en la **infra de notificaciones que ya existe**.

**Eventos PostHog:** `daily_question_shown`, `daily_question_answered`, `spaced_review_due`,
`spaced_review_completed`.

---

## Funcionalidad 3 — Seguimiento de progreso y "nota MIR proyectada" ★ diferenciador

**Por qué (evidencia):** es lo que **ningún competidor hace** (doc 02 §2) y lo que une las dos
mitades del producto. Cuidado de diseño: centrarse en **progreso personal y proyección**, no en
rankings sociales agresivos (trampa emocional documentada, doc 02 §1.4).

**Alcance MVP:**
- Dashboard de progreso por asignatura (aciertos, evolución, cobertura del temario).
- **Nota MIR proyectada** estimada a partir del histórico de simulacros del propio alumno.
- **El puente:** "con tu ritmo actual, tu nota proyectada (~X) te permitiría optar a estas plazas"
  → enlaza directamente con `MirSimulatorScreen` / `MirOrientationScreen` **ya existentes**.
- Priorización del estudio **por frecuencia de aparición en el examen** (combate el error de "no
  priorizar", doc 02 §1.3).

**Eventos PostHog:** `projected_score_viewed` (`projected_score`), `progress_dashboard_viewed`,
`projection_to_plaza_clicked` (la conversión estrella: estudio → elección de plaza).

---

## Planificador de estudio (transversal a 1-3)

Calendario hasta la fecha MIR con reparto de asignaturas, ajuste según fallos en los tests y
**recordatorios de descanso** (combate el agotamiento y el "empezar tarde", doc 02 §1.3). Se apoya
en notificaciones existentes y consume la señal de las Funcionalidades 1-3.

---

## Métricas de éxito propuestas

| Objetivo | Métrica | Fuente |
|----------|---------|--------|
| Activar el "antes del MIR" | % de estudiantes que inician ≥1 sesión de preguntas | `question_bank_session_started` |
| Retención fuera de temporada | DAU/WAU de estudiantes en meses sin elección (jun-dic) | `$screen` + `daily_question_*` |
| Hábito | % que responde la pregunta diaria ≥3 días/semana | `daily_question_answered` |
| **Foso defensivo** | % de estudiantes que pasan de estudio → simulador de plazas | `projection_to_plaza_clicked` |
| Resultado | Correlación nota proyectada vs. uso del banco | join `simulacro_completed` ↔ plazas |

## Riesgos y mitigaciones

- **Contenido (preguntas oficiales + explicaciones):** es el coste real, no el desarrollo. Definir
  origen del contenido (licencia, redacción propia, partnership) antes de construir.
- **Estacionalidad:** mitigada por la pregunta diaria + planificador (mantienen uso todo el año).
- **Comparación social tóxica:** evitar rankings agresivos; enfatizar progreso personal.
- **Canibalizar foco del residente:** segmentar por `userType` para no degradar la experiencia del residente.

## Siguientes pasos sugeridos

1. Arreglar la instrumentación de `mir_calculate_clicked` (doc 01 §6) para tener la métrica puente limpia.
2. Validar origen del contenido de preguntas (decisión de negocio bloqueante).
3. Prototipar Funcionalidad 3 (nota proyectada) reutilizando `mirSimulatorService` — es el mayor
   diferencial con menor coste de contenido.
4. MVP de Funcionalidad 1 (banco + simulacro) con un subconjunto de asignaturas.
