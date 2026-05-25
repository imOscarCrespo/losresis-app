# Análisis: usuario "residente" y oportunidades de engagement

Carpeta de razonamientos y propuestas para añadir nuevas funcionalidades a LosResis
orientadas al **residente** (médico ya con plaza MIR, R1-R5) — el segmento que da
nombre a la app pero que hoy presenta un engagement notablemente más bajo que el
estudiante.

Fecha del análisis: **2026-05-25** · Autor: Oscar Crespo · Datos: PostHog proyecto `LosResis` (id 97501).

## Índice

| Doc | Contenido |
|-----|-----------|
| [`01-inventario-features-residente.md`](./01-inventario-features-residente.md) | Inventario exhaustivo de lo que la app ofrece HOY al residente, por categorías funcionales, con pantallas, servicios, gates de acceso y valoración cubierto/parcial/hueco. |
| [`02-analisis-datos-posthog.md`](./02-analisis-datos-posthog.md) | Qué hacen hoy los residentes en la app con datos reales de PostHog (últimos 30 días). Tamaño del segmento, pantallas usadas, acciones explícitas, engagement, estacionalidad, y comparación con el estudiante. |
| [`03-investigacion-necesidades-residente.md`](./03-investigacion-necesidades-residente.md) | Investigación web sobre necesidades y pain points reales del residente español 2025-2026: burnout, derechos laborales, tutores, post-MIR. Quotes reales y análisis de competencia (UpToDate, Medscape, MDCalc, Doximity, Univadis, casiMedicos…). |
| [`04-propuesta-features-engagement.md`](./04-propuesta-features-engagement.md) | Propuesta priorizada de 7 funcionalidades para subir el engagement del residente, con impacto estimado vs esfuerzo, factor diferencial, riesgos y secuencia recomendada. |

## TL;DR

- El **residente** es un segmento pequeño (459 usuarios activos en 30 días, ~28% del estudiante) y con engagement bajo: solo **13% vuelven 8+ días/mes** (vs 61% del estudiante). Mucha estacionalidad concentrada en mayo (post toma-de-posesión MIR).
- La app cubre bien **lo social, lo administrativo y lo "ya-pasó-el-MIR"**: grupos (uso del 100%), reseñas (84%), agenda (85%), nóminas (51%), libro residente (54%), vivienda (57%). El **asistente clínico apenas se usa** (<1%) y las **rotaciones externas** son testimoniales (28%).
- El residente vive en 2025-2026 un momento de **máxima conflictividad**: huelga MIR 18-22 mayo, 94% de burnout diagnosticado, 80% supera las 48h/semana legales, 40% califica de "mala" la relación con su tutor.
- **El hueco grande no es social** (eso está cubierto): es **clínica diaria bedside en español**, **derechos laborales/guardias contabilizadas**, **salud mental** y **post-MIR** (fellowships, opos, plantillas CV). Nadie en España lo cubre.
- **Factor diferencial defendible**: LosResis ya tiene la red social vertical + datos de hospital + agenda. Sumar utilidad clínica diaria y herramientas laborales convierte la app de "abro 2 días al mes para chatear y mirar mi nómina" en "abro todos los días en planta".
- La propuesta prioriza: (1) Contador legal de guardias, (2) Salud mental con MBI mensual + recursos PAIME, (3) Libro del residente "real" con códigos BOE, (4) Consulta clínica bedside ES (calculadoras + protocolos + atajo UpToDate), (5) Hub Post-MIR, (6) Asistente sesión clínica, (7) Simulador de nómina + IRPF.
