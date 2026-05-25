# 04 · Nota MIR proyectada — análisis técnico de implementación

> Diseño técnico para la funcionalidad diferenciadora identificada en
> [`03-propuesta-antes-del-mir.md`](./03-propuesta-antes-del-mir.md) §Funcionalidad 3.
> Basado en exploración del código real (rutas y líneas citadas). Fecha: 2026-05-22.

---

## 1. Qué es realmente la "nota proyectada" (cadena de puntuación MIR)

Para no confundir conceptos, esta es la cadena real del MIR en España:

```
Rendimiento estudio  ─▶  NETO del examen        ─▶  Nota estandarizada     ─▶  NÚMERO DE ORDEN     ─▶  PLAZA
(% aciertos en        (aciertos − fallos/3,      (baremo: 90% examen +      (ranking entre los      (el simulador
 simulacros)           sobre 210 preguntas)       10% expediente)            ~14.000 candidatos)      ya existente)
```

**Dato crítico confirmado en el código:** el simulador NO trabaja con la "nota" sino con el
**número de orden** (posición). En `data/staticCatalog/hospital_speciality_grades.json` el campo
`grades` es un array con los **números de orden de las últimas plazas adjudicadas** ese año
(ej. `"grades": [1986, 2054]` = 2 plazas, la peor adjudicada fue el nº de orden 2054). Y en
`mirSimulatorService.js:94` la regla es `mirScore <= g.grade` → "tu posición es igual o mejor
(menor) que la nota de corte". Lo confirma la UI (`MirSimulatorScreen.js:505`):
*"los números más bajos representan mejores posiciones"*.

> **Conclusión de diseño nº1:** la nota proyectada debe terminar produciendo un **número de orden
> proyectado** (con su rango de incertidumbre), porque eso es exactamente lo que come el simulador
> de plazas que ya usa el 99% de los estudiantes. No hay que invertir nada del simulador: solo
> alimentarlo con un número de orden estimado en vez de uno tecleado a mano.

---

## 2. El reto de modelado: de rendimiento → número de orden

Es el único componente que no existe hoy. Se descompone en dos conversiones:

### 2.1 Rendimiento → NETO
Trivial y determinista. Fórmula oficial MIR: `neto = aciertos − (fallos / 3)` sobre las preguntas
válidas. Si conocemos aciertos/fallos de un simulacro, el neto es inmediato.

### 2.2 NETO → número de orden  ← **aquí está toda la dificultad**
La relación neto↔orden **cambia cada convocatoria** (depende de la dificultad del examen y de la
distribución de notas de todos los candidatos). El Ministerio de Sanidad publica cada año la
relación entre puntuación/neto y número de orden. Necesitamos una **tabla de conversión por año**:

```
mir_score_conversion(year, neto_min, neto_max, orden_aprox)
```

Estrategias posibles (de menor a mayor esfuerzo de contenido):

| Estrategia | Cómo | Precisión | Coste |
|------------|------|-----------|-------|
| **A. Tabla histórica** | Cargar la relación neto→orden de las últimas 3-4 convocatorias (datos públicos del Ministerio) y usar la media/última | Media-alta | Bajo (datos públicos) |
| **B. Curva ajustada** | Ajustar una función (neto→percentil→orden) sobre los datos históricos | Alta | Medio |
| **C. El usuario ya trae el orden** | Muchas academias (AMIR/CTO) dan un **número de orden simulado** en cada simulacro. El usuario lo introduce y nos saltamos 2.1 y 2.2 | Máxima (es el dato de la academia) | **Nulo** |

> **Conclusión de diseño nº2:** la estrategia **C habilita un MVP sin coste de contenido** (ver §4).
> A/B son la evolución natural cuando tengamos banco de preguntas propio.

---

## 3. Reutilización del código existente (qué NO hay que construir)

| Necesidad | Ya existe | Ubicación |
|-----------|-----------|-----------|
| Convertir orden → plazas/probabilidades | `calculateMIRProbabilities(mirScore, specialtyId, region)` | `services/mirSimulatorService.js:165` |
| Probabilidad por hospital | `computeHospitalProbability(grades, mirScore)` | `mirSimulatorService.js:60` |
| **Tendencia por regresión lineal** | `getGradeTrend(grades)` — ¡ya hace regresión lineal sobre series temporales! | `screens/MirSimulatorScreen.js:171` |
| Persistencia de intentos del usuario | Patrón sesión+respuestas del quiz | `services/specialityQuizService.js` (startSession/saveAnswer/finishSession + `getQuizHistoryForUser`) |
| Histórico de búsquedas de nota | Tabla `mir_simulator_searches` (ya guarda `user_id, grade, speciality_id, created_at`) | `mirSimulatorService.js:137` (`getMirSimulatorStats`) |
| Catálogos (hospitales, especialidades, notas de corte) | Catálogo estático en memoria | `services/staticCatalogService.js` |
| Perfil/identidad de usuario | `userService.js` (`speciality_id`, `is_student`) + `authService.getCurrentUser()` | `services/userService.js` |
| Analítica | `posthogLogger.logScreen()` / `.capture()` / `.identify()` | `services/posthogService.js` |

> **Conclusión de diseño nº3:** el grueso (simulador, regresión, persistencia, catálogos) ya está.
> Lo nuevo es: (a) registrar resultados de simulacros, (b) la conversión neto→orden, (c) la lógica
> de proyección/tendencia, (d) la pantalla.

---

## 4. Dos variantes de producto

### Variante A — MVP "Registro de simulacros + proyección" (sin banco de preguntas)
**Idea:** el estudiante registra sus simulacros (de su academia o propios). La app calcula la
tendencia, proyecta su número de orden final y **enlaza al simulador de plazas existente**.

- Sortea el riesgo nº1 del proyecto (coste de contenido de preguntas, ver doc 03 §Riesgos).
- Ataca directamente el dolor emocional validado ("haz simulacros y no te compares", doc 02 §1.4):
  damos al alumno **su propia trayectoria** en vez de comparación social tóxica.
- Aprovecha que el alumno YA hace simulacros en su academia (no le pedimos cambiar de hábito).
- Entrada flexible: el usuario mete **(aciertos, fallos)** → calculamos neto→orden (estrategia A/B),
  **o** directamente el **número de orden simulado** que le dio su academia (estrategia C).

**Flujo:**
1. "Añadir simulacro" → fecha, academia/origen, nº preguntas, aciertos, fallos *(o nº de orden simulado)*.
2. Guardar en `mir_mock_results` (nuevo).
3. Calcular neto y orden proyectado (reusar `getGradeTrend` para la tendencia de los últimos N).
4. Mostrar: gráfica de evolución + **orden proyectado (con rango)** + CTA → simulador de plazas.

### Variante B — Integrada (sobre el banco de preguntas propio, Funcionalidad 1)
Igual que A pero los simulacros se generan **dentro de la app** (Funcionalidad 1) y el resultado
alimenta automáticamente `mir_mock_results`. Cero entrada manual. Requiere el banco de preguntas.

> **Recomendación:** construir **A primero** (ship sin bloqueos de contenido) y migrar a B cuando
> exista el banco. La tabla de datos y la pantalla son las mismas; solo cambia el origen del resultado.

---

## 5. Modelo de datos (alineado con el formato real de la academia)

Tras ver un correo real de CTO (mayo 2026) sabemos que la academia entrega por simulacro:
NETO, **puesto MIR como rango** (mejor–peor caso) y puesto sólo entre alumnos de la academia.
El expediente académico del alumno pondera el 10% del baremo y determina el puesto MIR, así que
lo guardamos en el perfil para que el cálculo sea comparable.

```sql
-- Resultados de simulacros del usuario (origen del cálculo)
mir_mock_results (
  id                     uuid pk,
  user_id                uuid fk users.id,
  taken_at               date,
  source                 text,           -- 'amir' | 'cto' | 'mir_asturias' | 'otro'
  simulacro_label        text,           -- "SM-2", "Simulacro 3", etc. (tal como lo llama la academia)
  neto                   numeric null,   -- aciertos − fallos/3, lo da la academia
  reported_order_best    int null,       -- extremo MEJOR del rango MIR (más bajo)
  reported_order_worst   int null,       -- extremo PEOR del rango MIR (más alto)
  reported_order         int,            -- midpoint(best, worst), calculado en cliente. Alimenta la proyección.
  academy_only_order     int null,       -- "Nº" sólo entre los alumnos de la academia
  created_at             timestamptz default now()
)

-- Perfil del alumno
users.mir_expediente numeric  -- 0.00–10.00, opcional, pondera 10% del baremo MIR

-- Tabla de conversión neto -> número de orden por convocatoria (futuro, datos públicos del Ministerio)
mir_score_conversion (
  year       int,
  neto       numeric,
  orden      int,
  primary key (year, neto)
)
```

Reutilizar `mir_simulator_searches` para conocer si el alumno ya usó el simulador y enlazar ambos
mundos en analítica.

---

## 6. Algoritmo de proyección

```
entrada: lista de mir_mock_results del usuario (ordenados por fecha)
1. Para cada simulacro:
   - order = midpoint(reported_order_best, reported_order_worst)  (lo persistimos en reported_order)
2. Tendencia: regresión lineal sobre (fecha, order) reutilizando la lógica de getGradeTrend.
   - proyectar order en la fecha del examen (configurable, ~finales de enero).
3. Incertidumbre: banda = ± max(std(residuos), media(rango_usuario/2), 1).
   El "suelo" basado en el rango que la propia academia entrega evita que prometamos más
   precisión que CTO (que ya da rango, no número único).
   -> projected_order_best / projected_order_expected / projected_order_worst
4. confidence: 'low' (<=2 simulacros) | 'medium' (3) | 'high' (>=4). La UI module el lenguaje.
5. Salida -> alimentar calculateMIRProbabilities(projected_order_expected, speciality_id) y
   mostrar cuántas plazas pasan de "en riesgo" a "seguras" según el escenario.
```

Mensajes orientados a progreso personal (no ranking): *"Con tu ritmo actual, tu orden proyectado
es ~3.200 (entre 2.800 y 3.700). Con ~2.800 podrías optar a estas plazas en tu especialidad."*

---

## 7. UI / navegación

- **Nueva pantalla `MirProjectedScoreScreen`** (sección en el Dashboard, p. ej. `nota-proyectada`),
  siguiendo el patrón de `MirSimulatorScreen` / `MirOrientationScreen` (mismo `BottomMenuHeroHeader`,
  `useHospitals`, `posthogLogger.logScreen(...)`).
- Bloques: (1) lista/timeline de simulacros con botón "Añadir", (2) gráfica de evolución del orden,
  (3) tarjeta "Orden proyectado" con escenarios best/expected/worst, (4) **CTA "Ver qué plazas
  puedo coger"** → navega a `MirSimulatorScreen` con el `projected_order_expected` precargado.
- Modal "Añadir simulacro" con los campos de `mir_mock_results`.

---

## 8. Eventos PostHog a instrumentar

| Evento | Props | Para qué |
|--------|-------|----------|
| `mir_mock_result_added` | `source`, `neto`, `reported_order?` | Adopción del registro de simulacros |
| `projected_score_viewed` | `projected_order_expected`, `num_mocks` | Uso de la proyección |
| `projection_to_plaza_clicked` | `projected_order_expected`, `speciality_id` | **Métrica estrella**: el puente estudio→plaza |
| `mir_mock_trend_improved` | `delta_orden` | Salud/motivación (mejoras de tendencia) |

(Recordatorio del doc 01 §6: arreglar antes `mir_calculate_clicked`, hoy roto, para medir la
conversión completa simulador→cálculo.)

---

## 9. Fases de entrega

1. **Fase 0 — datos:** conseguir y cargar `mir_score_conversion` (últimas 3-4 convocatorias, datos
   públicos del Ministerio). Decisión: ¿soportamos estrategia C (orden de academia) desde el día 1? (recomendado, es gratis y preciso).
2. **Fase 1 — MVP Variante A:** tabla `mir_mock_results`, servicio `mirProjectionService.js`
   (calcular neto, proyectar orden con `getGradeTrend`), `MirProjectedScoreScreen` + modal, CTA al simulador.
3. **Fase 2 — pulido:** escenarios best/expected/worst, gráfica, mensajes anti-comparación, notificaciones de "nuevo simulacro pendiente de registrar".
4. **Fase 3 — Variante B:** auto-rellenar desde el banco de preguntas (Funcionalidad 1) cuando exista.

---

## 10. Decisiones abiertas / riesgos

- **Origen de la tabla de conversión neto→orden** (Fase 0). Bloqueante para estrategias A/B; NO bloquea
  la estrategia C. → Recomendación: lanzar con C + cargar conversión histórica en paralelo.
- **Fecha del examen objetivo** configurable por convocatoria (para proyectar al punto correcto).
- **Pocos simulacros = proyección ruidosa.** Mitigación: exigir ≥2-3 registros antes de mostrar proyección con confianza; banda de incertidumbre amplia al principio.
- **Expediente académico (10% del baremo).** El MVP puede ignorarlo o pedir nota media para afinar; documentarlo como simplificación.
- **No prometer exactitud.** Es una *estimación orientativa*; lenguaje y disclaimers claros (coherente con "no te compares" y con el disclaimer ya presente en `MirSimulatorScreen.js:503`).

---

## Resumen ejecutivo

La nota proyectada **no requiere reescribir el simulador**: su salida es un *número de orden
proyectado* que alimenta el `calculateMIRProbabilities` ya existente. El único componente nuevo de
modelado es la conversión **neto→orden**, que se puede **esquivar en el MVP** dejando que el usuario
registre el número de orden simulado que ya le da su academia (estrategia C). Esto permite **lanzar
la funcionalidad diferenciadora sin coste de contenido de preguntas** — justo el riesgo que bloquea
al resto de la propuesta "antes del MIR" — y conecta de forma natural el estudio con el simulador de
plazas que el 99% de los estudiantes ya usa.
