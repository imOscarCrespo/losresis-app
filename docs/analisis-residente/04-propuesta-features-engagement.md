# 04 · Propuesta de features para subir el engagement del residente

> Síntesis de [`01`](./01-inventario-features-residente.md) (qué tenemos hoy),
> [`02`](./02-analisis-datos-posthog.md) (qué hacen realmente) y
> [`03`](./03-investigacion-necesidades-residente.md) (qué necesitan según ellos).
> Objetivo: pasar la retención de 8+ días/mes del **13% actual → 35-40%** (mitad de
> camino al estudiante) en 2 trimestres.

## 1. Hipótesis de fondo

> El residente no abre la app a diario hoy porque ninguna de las features actuales
> tiene sentido en su flujo *clínico* o *laboral* diario. Lo social (grupos, reseñas)
> ya está cubierto y saturado al 100% — el techo está cerca. Lo administrativo (agenda,
> nómina) son visitas mensuales por definición. Para mover la aguja hace falta una
> **superficie con sentido de uso cada turno**.

Dos dominios cumplen ese criterio:

1. **Clínico bedside**: calculadoras, protocolos, fármacos, scores. Se consulta en
   planta varias veces al día. Hoy lo resuelven con UpToDate (si tienen acceso) o
   Google.
2. **Laboral diario**: cuántas guardias llevo, libranzas, horas semanales, alertas
   sindicales. Se consulta cuando hay decisiones que tomar (cambiar guardia, pedir
   librar, denunciar, votar huelga). En 2026 es el momento *político* perfecto.

El resto de propuestas (libro, nómina, post-MIR, salud mental, sesiones) son
acompañantes que cierran el círculo competitivo y mejoran retención en momentos clave
de la residencia.

## 2. Priorización

Eje X = impacto en engagement / lock-in. Eje Y = coste de construir (incluye datos,
contenido y mantenimiento).

| # | Feature | Impacto | Coste | Diferenciación | Cuándo |
|---|---------|--------:|------:|---------------:|--------|
| 1 | **Contador legal de guardias + huelga** | Alto | Bajo | Alta (nadie lo tiene) | Q2 2026 (aprovecha huelga 18-22 mayo) |
| 2 | **Salud mental: MBI mensual + PAIME** | Alto | Bajo-Med | Alta | Q2 2026 |
| 3 | **Libro del residente "real" con BOE** | Medio | Med | Media (mejora lo existente) | Q3 2026 |
| 4 | **Consulta bedside ES (calculadoras + protocolos + UpToDate)** | Muy alto | Alto | Muy alta | Q3-Q4 2026 |
| 5 | **Hub Post-MIR (fellowships/opos/CV)** | Alto | Med-Alto | Alta | Q4 2026 |
| 6 | **Asistente de sesión clínica** | Medio | Med | Media | Q1 2027 |
| 7 | **Simulador nómina IRPF + comparativa CCAA** | Medio | Bajo | Baja (cierra una feature existente) | Q2 2026 (rápido) |

Recomendación: **arrancar simultáneamente con #1, #2 y #7** (todas bajas en coste y
oportunas con la huelga MIR de mayo). Mover #3 a Q3. **#4 es la gran apuesta de 2026
H2** y debe planificarse con un product-led runway: hace falta partnership con
contenidos (UpToDate institucional, Fisterra, MDCalc clones) y un equipo dedicado de
~1 trimestre.

## 3. Las 7 propuestas con detalle

### #1 — Contador legal de guardias y movilización
**Pantalla nueva**: `LegalGuardCounterScreen` (entry desde `AgendaScreen` y
`HomeDashboardScreen` como widget).

**Qué hace**:
- Lee la `AgendaScreen` actual y deriva: guardias del mes, presenciales vs no
  presenciales, libranzas pendientes, horas trabajadas en los últimos 7 días.
- Alerta automática cuando se cruza un umbral legal (>48h/semana, >7 guardias/mes,
  no librado tras guardia >24h).
- Botón "Denunciar" que abre formulario anónimo y lo envía a Asociación MIR España
  (acuerdo institucional pendiente; alternativa: copy-paste pre-rellenado al
  WhatsApp/email del delegado sindical del hospital).
- Panel "Huelgas y movilizaciones" con convocatorias actuales (datos curados por
  equipo LosResis, push notification al confirmarse).

**Tech**: reutilizar `agendaService.js`. Tabla nueva `legal_thresholds` con valores
configurables por CCAA. Push notif `legal_threshold_breached`.

**Métrica de éxito**: DAU del residente +20% durante semana de movilización; >40% de
residentes ven el contador al menos 1×/semana.

### #2 — Salud mental: MBI mensual + recursos PAIME + peer support
**Pantalla nueva**: `WellbeingScreen` (entry desde `HomeDashboardScreen`).

**Qué hace**:
- Cuestionario **MBI-HSS** (Maslach Burnout Inventory — Human Services Survey, 22
  ítems) mensual, ~3 minutos. Resultado anonimizado, agregado por hospital/especialidad.
- Detección automática de riesgo (alto agotamiento + alta despersonalización + baja
  realización) → push con recursos PAIME locales y línea anónima.
- "Peer support" — chat anónimo emparejado con otro residente del mismo tipo de turno
  (urgencias↔urgencias, planta↔planta). Sesión limitada de 20 minutos.
- Recursos PAIME mapeados por colegio (Madrid, Barcelona, Sevilla, etc.).

**Tech**: tabla `wellbeing_assessments` con `score_aggregate`, `flag_risk`,
`completed_at`. Edge function que matchea peer-support evitando autoassign.
Confidencialidad: cifrado y no asociado al perfil público.

**Cuidado de diseño**: NO gamificar el burnout. NO rankings. Privacidad por defecto.
Ver `02-investigacion-opiniones-reales.md` del análisis de estudiantes para precedente
de "trampa emocional de la comparación".

**Métrica de éxito**: >25% completan el MBI mensual el segundo mes; reducción del
indicador agregado de burnout a 6 meses.

### #3 — Libro del residente "real" con códigos BOE
**Pantalla**: refactor de `ResidenceLibraryScreen`.

**Qué hace**:
- Plantillas por especialidad cargadas desde el **Programa Oficial BOE** (Cardiología
  BOE 2008/A-12080, Cirugía General BOE 2007/A-15498, etc.). Cada especialidad tiene
  su catálogo de competencias y procedimientos mínimos por año.
- Para cada procedimiento: contador con objetivo anual, % de avance, alerta cuando
  faltan <30 días para fin de año y sigue por debajo del objetivo.
- Exportación a PDF en **formato memoria anual MEF** (firma del tutor con QR
  verificable).
- Modo "co-residente": compartir progreso con otros R del mismo hospital/año para
  comparar (con consent).

**Tech**: tabla `residency_programs_boe` con plantillas por especialidad. Plantilla
PDF en `libroPdfService.js`. Eventos `library_milestone_reached`,
`library_pdf_exported_for_evaluation`.

**Métrica de éxito**: uso pasa de 54% → 80% en 6 meses; >3× exportaciones de PDF/mes
por usuario.

### #4 — Consulta clínica bedside en español
**Pantalla nueva**: `BedsideScreen` (botón flotante global "🩺 Consulta rápida"
accesible desde cualquier pantalla).

**Qué hace** (3 pestañas):
- **Calculadoras**: 50 scores más usados (CHA2DS2-VASc, Wells, qSOFA, GFR-CKD-EPI,
  ABCD2, NIHSS, SOFA, APACHE II, Glasgow, Child-Pugh, MELD, Killip…) implementadas
  nativas — *no scraping* — con resultado interpretado en español.
- **Protocolos del hospital**: PDFs/URLs de protocolos locales subidos por la
  Comisión de Docencia o residentes con verificación. Búsqueda por texto.
- **Atajo a evidencia**: deep-link a UpToDate Anywhere (si la CCAA del usuario lo
  tiene contratado, detectado por dominio email corporativo) + Fisterra + Medscape.
  Búsqueda federada que abre el primero disponible.

**Tech**: tabla `clinical_calculators` con `slug`, `formula_js`, `inputs_schema`,
`interpretation_es`. Tabla `hospital_protocols` con `hospital_id`,
`uploaded_by_user_id`, `verified`, `pdf_url`, `tags`. Función de búsqueda federada
con fallback a Google con `site:fisterra.com`.

**Por qué es el lock-in**: el residente abre la app **cada vez que necesita un
score** — eso son varias veces al día. Cualquier feature social pierde frente a
eso. Esta es la apuesta diferencial de 2026 H2.

**Métrica de éxito**: ≥10 aperturas/día por residente activo; ≥5 calculadoras
diferentes usadas/mes por usuario.

### #5 — Hub Post-MIR
**Pantalla nueva**: `PostMirHubScreen` (activable a partir de R3, visible a partir de R4).

**Qué hace**:
- **Mapa de fellowships España + extranjero**: catálogo curado por especialidad,
  con plazas/año, requisitos, plazos, contacto.
- **Bolsas de empleo por CCAA**: SAS, SERMAS, SACYL, SERGAS, OSI, etc. Filtros y
  alertas de apertura.
- **Plantillas de CV médico** español + inglés (formato europeo y americano).
- **Roadmap USMLE/PLAB/MIR Italia** para los que se plantean salir.
- **Calendario de oposiciones** por CCAA con recordatorios.

**Tech**: contenido curado en `post_mir_fellowships`, `post_mir_opos`,
`post_mir_resources` (admin-only writes). Push notif `opo_deadline_approaching`.

**Métrica de éxito**: 70% de R4/R5 lo usan al menos 1×/mes; tasa de apertura push
oposiciones >40%.

### #6 — Asistente de sesión clínica
**Pantalla nueva**: `SessionPrepScreen` (entry desde `LecturesScreen` y notificación
del día previo).

**Qué hace**:
- Plantillas por tipo (caso clínico, bibliográfica, monográfica, congreso) en
  PowerPoint y Keynote.
- Subida de paper PDF → IA genera resumen estructurado + crítica metodológica + 5
  preguntas anticipadas.
- Traducción inglés→español de párrafos clave.
- Banco de imágenes anonimizadas compartido (modo Figure 1 vertical).
- Sesiones futuras de mi hospital sincronizadas desde calendario.

**Tech**: reutilizar pipeline LLM existente de `clinicalAssistantService.js` con
prompts dedicados. Tabla `session_anonymized_images` con verificación obligatoria.

**Métrica de éxito**: >30% R1-R3 usan el resumen IA antes de su próxima sesión.

### #7 — Simulador de nómina + IRPF + comparativa CCAA
**Pantalla**: extensión de `ResidentPayoutsScreen` con tab "Simulador".

**Qué hace**:
- Input: CCAA, año MIR, especialidad, número de guardias mes (24h y 12h).
- Output: bruto, retenciones IRPF/SS detalladas, neto. Explicación de por qué la
  guardia tributa al 37%.
- Comparativa visual entre las 17 CCAA y proyección anual.
- "¿Y si hiciera N guardias menos/más?" — slider interactivo.

**Tech**: tabla `payout_scales_by_ccaa_year` (datos públicos CESM). Cálculo IRPF
local con tablas vigentes. No requiere backend nuevo más allá de seed de datos.

**Métrica de éxito**: 40% de residentes usan el simulador al menos 1× en 30 días;
↑ uso de `ResidentPayoutsScreen` del 51% al 70%.

## 4. Métrica norte y plan de medición

**KPI principal**: % de residentes con ≥8 días activos en 30 días (objetivo:
**13% → 35%**, 6 meses).

**KPIs secundarios**:
- DAU residentes (baseline ~80/día → 200/día sostenido fuera de mayo).
- Sesiones por usuario / semana (mide rotura del techo).
- Funnel "open Bedside → calculate → save".
- % residentes con MBI ≥1 completado.

**Instrumentación previa**: resolver los caveats del doc 02 (setear `userType` como
person property, no solo en `$screen` de `GroupsScreen`). Es un fix de un día que
desbloquea segmentación trivial en todos los análisis futuros.

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Salud mental mal diseñada → daño en lugar de ayuda | Co-diseño con Comisión Nacional Deontología; defaults privacy-first; NO rankings |
| Contador legal de guardias → expone al hospital → reacción | Datos solo visibles para el residente; "Denuncia" siempre opt-in; legal review antes de lanzar |
| Bedside con calculadoras mal implementadas → daño asistencial | Validación bibliográfica de cada fórmula; disclaimer prominente; revisión por médico interno |
| Hub Post-MIR queda desactualizado → daño credibilidad | Equipo curador con SLA mensual; permitir reports de usuarios |
| Compite con UpToDate → conflicto institucional | Posicionarse como complemento, no sustituto; el atajo a UpToDate ayuda al SNS no le quita |
| Coste contenido (BOE × especialidad, calculadoras × N) | Empezar por las 5 especialidades más representadas en la cohorte y top-20 calculadoras; iterar |

## 6. Secuencia recomendada

```
Q2 2026 (jun-ago) — Aprovechar momento huelga MIR
  ├── #1 Contador legal de guardias (sprint 1-2)
  ├── #2 Wellbeing MBI (sprint 2-3)
  ├── #7 Simulador nómina IRPF (sprint 1)
  └── Instrumentación fix userType (sprint 1, día 1)

Q3 2026 (sep-nov) — Cerrar features existentes
  ├── #3 Libro del residente BOE (sprint 4-6)
  └── #4 Bedside MVP (calculadoras top 20, sin protocolos) — preparación

Q4 2026 (dic-feb 2027) — La apuesta diferencial
  └── #4 Bedside completo (protocolos hospital + atajo UpToDate)

Q1 2027 (mar-may) — Post-residencia
  ├── #5 Hub Post-MIR
  └── #6 Asistente sesión clínica
```

## 7. Cierre

El residente de LosResis hoy es un usuario social y administrativo que abre la app
unos pocos días al mes. La oportunidad para 2026 no es **más** social — es darle
**razones clínicas y laborales** para abrir la app cada turno. Si las propuestas #1,
#2 y #4 funcionan, LosResis pasa de ser "el WhatsApp de los residentes" a "el SO de
los residentes" — y eso es defensivo durante toda la carrera profesional, no solo en
los 4-5 años de residencia.
