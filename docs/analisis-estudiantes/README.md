# Análisis: usuarios "estudiante" y oportunidad "antes del MIR"

Carpeta de razonamientos y propuestas para expandir LosResis hacia el estudiante de
medicina que se prepara el examen MIR (no solo el residente que ya tiene plaza).

Fecha del análisis: **2026-05-22** · Autor: Oscar Crespo · Datos: PostHog proyecto `LosResis` (id 97501).

## Índice

| Doc | Contenido |
|-----|-----------|
| [`01-analisis-datos-posthog.md`](./01-analisis-datos-posthog.md) | Qué hacen hoy los estudiantes en la app, con datos reales de PostHog. Tamaño del segmento, journey, engagement, estacionalidad y el hueco detectado. |
| [`02-investigacion-opiniones-reales.md`](./02-investigacion-opiniones-reales.md) | Opiniones reales de estudiantes (foros casiMedicos, prensa médica) + análisis de la competencia (MirMeApp, MirSimulador, MiMIR, Anki). Pain points validados. |
| [`03-propuesta-antes-del-mir.md`](./03-propuesta-antes-del-mir.md) | Propuesta de implementación de las 3 funcionalidades de prioridad alta, fundamentada en los dos documentos anteriores. Incluye el factor diferencial vs. competencia. |
| [`04-nota-proyectada-diseno-tecnico.md`](./04-nota-proyectada-diseno-tecnico.md) | Análisis técnico exhaustivo de la "nota proyectada": cadena de puntuación MIR, reto de modelado neto→número de orden, reutilización del código existente, modelo de datos, algoritmo, UI, fases y un MVP sin coste de contenido. |

## TL;DR

- El **estudiante** es ya el mayor segmento identificado de la app (**1.677** vs. 441 residentes en 90 días) y tiene buena retención (~61% activos 8+ días).
- Su uso gira **al 100% en torno a la elección de plaza post-MIR** (simulador de nota, hospitales, reseñas, quiz de especialidad, vivienda). El simulador de nota lo usa el **99%** de los estudiantes.
- La app **no cubre nada del "antes del MIR"** (el año de estudio), que es donde el estudiante pasa el 95% de su tiempo. Ese es el hueco.
- La investigación valida que el dolor nº1 del estudiante es **entrenar con preguntas** (el examen se gana a base de test, no de lectura) y **no perder lo estudiado** (repaso espaciado).
- El **factor diferencial** de LosResis frente a las apps de preguntas (que ya existen y son buenas) es conectar el progreso de estudio → **nota MIR proyectada** → **simulador de plazas que ya usa el 99%** → hospital y vivienda. Eso es el foso defensivo.
