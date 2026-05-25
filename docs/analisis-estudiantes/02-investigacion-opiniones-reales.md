# 02 · Investigación de opiniones reales y competencia

> Investigación web realizada el 2026-05-22 sobre foros de estudiantes de medicina (casiMedicos),
> prensa médica especializada y apps competidoras. El objetivo es validar (o refutar) las
> hipótesis del documento [01](./01-analisis-datos-posthog.md) con la voz real del estudiante.

## 1. Pain points validados (voz del estudiante)

### 1.1 "El examen se gana a base de preguntas, no de páginas leídas"
El error nº1 documentado en la preparación del MIR es el **insuficiente entrenamiento con
preguntas tipo test**: priorizar leer temario y hacer resúmenes sobre hacer simulacros y tests.
Los resúmenes excesivos dan una "sensación falsa de control". 
→ **Valida la funcionalidad de banco de preguntas + simulacros como la de mayor impacto.**

### 1.2 "Si no repaso, se me olvida"
Los estudiantes describen la "constante necesidad de repasar o se olvidan los conceptos" con
un temario enorme. El **repaso espaciado** (estilo Anki) es una técnica masivamente adoptada;
Anki aparece en todas las recomendaciones de foros para fijar farmacología, microbiología, etc.
→ **Valida el repaso espaciado / flashcards integrado.**

### 1.3 Agobio, ritmo "frenético" y mala gestión del tiempo
Testimonios recurrentes: "bajón" emocional, percentiles por debajo de la media pese al esfuerzo,
pérdida de motivación, "el ritmo de estos meses tiene que ser frenético". Errores frecuentes
asociados: **empezar tarde**, **no priorizar** por frecuencia de aparición en el examen,
**sacrificar descanso** hasta el agotamiento.
→ **Valida el planificador adaptativo** (con priorización por frecuencia y gestión de descanso).

### 1.4 La trampa emocional de la comparación
Consejo repetido por prensa y tutores: **"haz simulacros y no te compares"**. La obsesión con
el percentil parcial frente a otros alumnos es una "trampa emocional" que desmotiva.
→ **Matiz de diseño:** el seguimiento de progreso debe centrarse en el **progreso personal y la
proyección** del propio alumno, NO en rankings sociales agresivos (aunque la competencia los usa).

## 2. Análisis de la competencia

| App | Preguntas | Funciones clave | Modelo |
|-----|----------:|-----------------|--------|
| **MirMeApp** | +7.000 oficiales | Stats de progreso, comparativas entre usuarios, rankings semanal/mensual/global, preguntas comentadas. +150k descargas, 4.7★ | Gratis |
| **MirSimulador** | +3.600 + 2.700 flashcards | Genera simulacros (10/20/50/100/210 preg.), **evita repetir las que ya aciertas**, **modo solo-falladas**, explicaciones detalladas | Web/freemium |
| **MiMIR** | preguntas de años pasados | Exámenes personalizados por año, **pregunta flash diaria**, planificación de objetivos | App store |
| **Anki** | mazos comunitarios | Repetición espaciada pura, personalizable | Gratis |

### Lo que la competencia ya hace bien (no reinventar)
- Banco grande de preguntas oficiales clasificadas por asignatura.
- Modos de simulacro configurables (nº de preguntas, por año, solo falladas).
- Estadísticas de progreso y preguntas comentadas.
- Pregunta diaria como hábito de retención.

### Lo que la competencia **NO** hace (el hueco de LosResis)
Ninguna de estas apps conecta el estudio con el **destino**: ninguna te dice
*"con tu progreso actual, tu nota proyectada te daría estas plazas/hospitales"*.
Son silos de preguntas. **LosResis ya tiene la otra mitad** (simulador de plazas que usa el 99%
de sus estudiantes, hospitales, reseñas, vivienda). Unir ambas mitades es algo que ningún
competidor puede copiar fácilmente.

## 3. Conclusión para el diseño

1. **No competir como "otra app de preguntas"** — el mercado está cubierto y hay opciones gratis muy buenas.
2. **El wedge es la integración estudio → nota proyectada → plaza → hospital/vivienda.**
3. Priorizar: práctica con preguntas (impacto) + repaso espaciado (retención de conocimiento) +
   proyección de nota (diferenciación). Evitar rankings sociales agresivos por el riesgo emocional documentado.
4. La **pregunta diaria** es el gancho de retención más barato y validado para mantener al
   estudiante activo fuera de la temporada de elección.

## Fuentes

- [casiMedicos — Apps para practicar simulacros MIR](https://www.casimedicos.com/foro/threads/apps-para-practicar-simulacros-mir.27587/)
- [casiMedicos — "Preparación MIR y simulacros. Me va mal"](https://www.casimedicos.com/foro/threads/preparacion-mir-y-simulacros-me-va-mal.30778/)
- [casiMedicos — Comparativa Academias MIR](https://www.casimedicos.com/comparativa-academias-mir-2021/)
- [ConSalud — Las mejores apps para preparar el MIR según los estudiantes](https://www.consalud.es/formacion/las-mejores-apps-para-preparar-el-mir-y-el-eir-este-verano-segun-los-estudiantes.html)
- [Redacción Médica — "Haz simulacros y no te compares"](https://www.redaccionmedica.com/secciones/formacion/consejos-para-un-examen-mir-2026-de-exito-haz-simulacros-y-no-te-compares-5191)
- [Blog PROMIR — Errores más frecuentes en la preparación del MIR](https://blog.promir.es/los-errores-mas-frecuentes-durante-la-preparacion-del-examen-mir/)
- [MirMeApp](https://www.mirmeapp.com/) · [MirSimulador](https://mirsimulador.com/) · [MiMIR (App Store)](https://apps.apple.com/es/app/prepara-ex%C3%A1men-mir-2025-mimir/id6450206958)
