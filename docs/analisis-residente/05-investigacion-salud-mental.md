# 05 · Investigación: funcionalidad de salud mental para el residente

> Investigación basada en 113 agentes, 30 fuentes verificadas, 25 claims adversarialmente
> comprobados (16 confirmados / 9 refutados). Fecha: 2026-06-06.

---

## TL;DR de decisiones clave

| Decisión | Veredicto |
|---|---|
| **Cuestionario a usar** | **CBI (Copenhagen Burnout Inventory)** — 19 ítems, dominio público, validado en español |
| **MBI — ¿usar?** | **No.** Requiere licencia comercial ($2.75/uso mín. 50 usos). Inviable para despliegue libre |
| **PAIME — ¿es un programa único?** | **No.** Opera por comunidad autónoma, cada una con su colegio médico |
| **¿Datos de salud mental son datos especiales RGPD?** | **Sí.** Categoría especial (Art. 9). Requiere consentimiento explícito + EIPD si hay riesgo alto |
| **¿Diagnóstico clínico en la app?** | **No.** Solo "indicadores de bienestar". Nunca la palabra "diagnóstico" |

---

## 1. El instrumento: CBI en lugar de MBI

### 1.1 Por qué no el MBI

El **MBI-HSS (Medical Personnel)** es el gold standard académico: 22 ítems en escala 0–6,
tres subescalas (Agotamiento Emocional 9 ítems, Despersonalización 5, Realización Personal 8),
CFI=0.941, α=0.733–0.844. Es el instrumento usado en el **76% de los 67 estudios españoles
revisados** (meta-análisis Gaceta Sanitaria 2024, n=16.076 participantes).

**El problema: requiere licencia de pago.** Mind Garden (distribuidor oficial) cobra
**$2.75/uso con mínimo de 50 usos** para licencia de reproducción y prohíbe explícitamente
la distribución en web/app abierta. Para una app con cientos de usuarios mensuales,
el coste escala rápidamente y el modelo legal es incompatible con uso libre.
[Fuente: mindgarden.com](https://www.mindgarden.com/315-mbi-human-services-survey-medical-personnel)

### 1.2 El CBI: la alternativa recomendada

El **Copenhagen Burnout Inventory (CBI)** fue diseñado explícitamente como alternativa
gratuita al MBI. Es de **dominio público** — uso libre sin licencia ni atribución
comercial.

**Estructura (19 ítems en 3 dominios):**

| Dominio | Ítems | α Cronbach (validación ES) | Qué mide |
|---|---|---|---|
| Burnout personal | 6 | 0.90 | Fatiga y agotamiento físico/emocional general |
| Burnout laboral | 7 | 0.83 | Agotamiento relacionado con el trabajo |
| Burnout por pacientes | 6 | 0.82 | Agotamiento relacionado con la atención al paciente |

**Escala de respuesta:** 5 opciones (Siempre / Casi siempre / A veces / Casi nunca / Nunca)
o en algunos ítems frecuencia (Siempre… Nunca). Puntuación de cada ítem: 0, 25, 50, 75, 100.
Puntuación total de cada dimensión: media de los ítems de esa dimensión (0–100).

**Interpretación orientativa** (no existe un corte oficial único — usar como indicadores):
- 0–49: nivel bajo
- 50–74: nivel moderado (zona de atención)
- 75–100: nivel alto (zona de alerta)

> ⚠️ La app debe presentar los resultados como **indicadores de bienestar**, nunca como
> diagnósticos clínicos. Mostrar el valor numérico junto con contexto comparativo y
> recomendaciones de acción positiva.

**Fuentes:** [PubMed 23775105](https://pubmed.ncbi.nlm.nih.gov/23775105/) ·
[PubMed 36030114](https://pubmed.ncbi.nlm.nih.gov/36030114/)

### 1.3 Instrumentos complementarios (opcionales / futuros)

| Instrumento | Ítems | Libre | Qué añade |
|---|---|---|---|
| **PHQ-9** | 9 | Sí (dominio público) | Cribado de depresión — complementa burnout |
| **GAD-7** | 7 | Sí (dominio público) | Cribado de ansiedad generalizada |
| **UWES-9** | 9 | Consultar Wilmar Schaufeli | Engagement laboral — contrapunto positivo al burnout |

Para el MVP: **solo CBI**. PHQ-9/GAD-7 pueden añadirse en una segunda iteración si el
resultado del CBI supera umbral de alerta, como escalado opcional.

---

## 2. Prevalencia: por qué es urgente

Los datos justifican la funcionalidad:

- **51%** de médicos españoles tienen al menos una dimensión de burnout afectada
- **29%** tienen dos dimensiones afectadas; **18%** las tres
- En residentes MIR específicamente (119 MIR, hospitales sureste Madrid, 2018):
  - **29.4%** burnout completo
  - **50.4%** alto agotamiento emocional
  - **72.3%** alta despersonalización ← el dato más alarmante
  - **59.7%** baja realización personal
- El estudio MEDIESTRES hizo seguimiento semestral con MBI durante R1

**Fuentes:** [Gaceta Sanitaria 2024](https://www.gacetasanitaria.org/es-prevalencia-del-sindrome-burnout-medicos-articulo-S0213911124000311) ·
[ISCIII/SciELO](https://scielo.isciii.es/scielo.php?script=sci_arttext&pid=S3020-11602019000100007)

---

## 3. PAIME: cómo funciona y cómo integrarlo

### 3.1 Estructura real del PAIME

**PAIME NO es un programa nacional único.** La FPSOMC (Fundación para la Protección
Social de la OMC) coordina a nivel conceptual, pero la **implementación y financiación
dependen de cada comunidad autónoma** y sus colegios médicos regionales.

Características comunes a todos los programas PAIME autonómicos:
- Atención **confidencial** (datos no accesibles al empleador ni al sistema sanitario público)
- Enfoque **no punitivo** — no afecta a la carrera profesional
- Gratuito para médicos colegiados
- Cubre: trastornos psiquiátricos, adicciones, problemas de salud mental relacionados con el trabajo

### 3.2 Contactos verificados por CCAA

| CCAA | Programa | Contacto verificado |
|---|---|---|
| **Cataluña** | Clínica Galatea | Tel: **93 205 72 67** · Email: info@clinica-galatea.com · Web: clinica-galatea.com |
| **Madrid** | ICOMEM PAIME | Web: icomem.es/seccion/SALUD-MENTAL-MEDICO/equipo-paime |
| **Resto CCAA** | Colegio médico regional | cgcom.es/colegios-mapa |

> ⚠️ **Solo Cataluña y Madrid fueron verificados con detalle.** Para las otras 15 CCAA,
> la app debe redirigir al mapa de colegios médicos de CGCOM y dejar que el residente
> localice el suyo. Los datos de contacto específicos deben verificarse antes de
> publicarlos en la app para evitar información desactualizada.

### 3.3 Cómo presentar PAIME en la app

Framing recomendado (basado en las barreras identificadas por Clínica Galatea):

> "PAIME es un programa **creado por médicos para médicos**. Tu colegio médico garantiza
> que ninguna información llegará a tu hospital o empleador. Es completamente confidencial
> y gratuito para médicos colegiados."

Las tres barreras que el diseño UX debe neutralizar:
1. **Cultura de invulnerabilidad** → framing: "los mejores médicos también cuidan su mente"
2. **Miedo a ser identificados** → énfasis explícito en confidencialidad, sin login social
3. **Estigma** → no usar la palabra "trastorno"; usar "bienestar", "energía", "recursos"

**Fuentes:** [ICOMEM](https://www.icomem.es/seccion/SALUD-MENTAL-MEDICO/equipo-paime) ·
[Clínica Galatea](https://www.clinica-galatea.com/es/bloc/medicos-enfermos/) ·
[CGCOM mapa colegios](https://www.cgcom.es/colegios-mapa)

---

## 4. Otros recursos para incluir

| Recurso | Qué es | Cómo integrar |
|---|---|---|
| **Teléfono de la Esperanza** | 717 003 717 — crisis emocional general | Mostrar si resultado CBI >75 |
| **024** | Línea atención conducta suicida (Ministerio de Sanidad) | Mostrar si resultado CBI >75 |
| **Asociación MIR España** | Defensa derechos laborales + apoyo colectivo | Link en sección derechos laborales |
| **FPSOMC** | Coordinación nacional PAIME, guías, recursos | fpsomc.es |
| **Guía del Residente 2025** | Ministerio de Sanidad — PDF con derechos y recursos | Link a PDF oficial |

---

## 5. Diseño UX: principios basados en evidencia

### 5.1 Principios generales para apps de salud mental

La investigación UX revisada (PMC9490524, Frontiers in Digital Health 2022, PMC8844980)
identifica los siguientes principios con mayor impacto en adherencia:

1. **Lenguaje no clínico**: usar "¿cómo te sientes?" en lugar de "síntomas". Nunca
   "diagnóstico", "trastorno", "patología". El residente médico es especialmente sensible
   a la medicación del lenguaje.

2. **Progreso visible**: mostrar tendencia temporal ("esta semana mejor que el mes pasado")
   — más motivador que puntuaciones aisladas.

3. **Micro-check-ins diarios opcionales** (1–3 preguntas) entre cuestionarios mensuales:
   reducen el coste de activación y mantienen el hábito de tracking.

4. **Resultados con acción inmediata**: cada resultado debe ir acompañado de una acción
   concreta y de baja fricción (ej: "esta semana intenta salir 20 min al día"). No solo
   mostrar números.

5. **Privacidad por diseño**: la sección de salud mental debe ser visualmente separada
   del feed social. El residente debe percibir que nadie más ve sus datos.

6. **Notificaciones controladas**: no más de 1 notificación semanal. Los recordatorios
   agresivos en salud mental generan rechazo.

### 5.2 Flujo recomendado para el MVP

```
[Onboarding de la sección]
  └─ Explicación en 3 pantallas: qué es, por qué es útil, privacidad garantizada
  └─ Consentimiento explícito (requerido por RGPD Art. 9)

[Cuestionario mensual CBI — 19 ítems]
  └─ Estimado: 5–7 minutos
  └─ Progreso visual (barra de avance)
  └─ Lenguaje adaptado al residente ("en guardia", "con los pacientes")

[Resultado]
  └─ Tres barras: Personal / Laboral / Pacientes (0–100)
  └─ Comparativa con medición anterior (si existe)
  └─ Interpretación en lenguaje positivo
  └─ Acción recomendada según nivel
  └─ Si nivel alto: botón "Hablar con alguien" → PAIME / 024

[Historial]
  └─ Gráfico de línea temporal por dimensión
  └─ Hitos automáticos ("hace 3 meses estabas en zona verde")

[Micro check-in semanal opcional — 3 preguntas]
  └─ "¿Cómo fue la semana en el hospital? (1–5)"
  └─ "¿Has podido descansar bien? (Sí / Regular / No)"
  └─ "¿Algo que te haya pesado especialmente esta semana?"
  └─ Sin análisis automático — solo almacenamiento + gráfico personal
```

### 5.3 Apps de referencia

| App | Qué hacer bien | Qué no copiar |
|---|---|---|
| **Headspace** | Progresión visual, micro-hábitos, lenguaje no clínico | No es específica para médicos; meditación no es suficiente |
| **Calm** | Notificaciones suaves, personalización del ritmo | Demasiado genérico |
| **Physician Support Line** (USA) | Específica para médicos, confidencialidad explícita, pares | Solo telefónica, no tiene tracking |
| **Woebot** | CBT conversacional accesible, bajo estigma | IA no validada clínicamente en España |

El gap real: **no existe ninguna app en España con tracking longitudinal de burnout
específica para médicos residentes**. LosResis puede ser la primera.

---

## 6. Marco legal: RGPD y datos de salud mental

### 6.1 Los datos de salud mental son "categoría especial"

El Art. 9 RGPD clasifica los **datos relativos a la salud** como categoría especial,
incluyendo datos sobre el estado mental. Esto implica:

- **Base de legitimación**: consentimiento explícito (no vale el consentimiento implícito
  de los términos de uso genéricos). Debe ser una acción activa y separada.
- **Minimización**: solo recoger lo estrictamente necesario para la funcionalidad.
- **No usar para perfilado**: los datos de bienestar no pueden cruzarse con datos de
  uso social (grupos, reseñas) sin consentimiento adicional.

**Fuentes:** [AEPD — bases legitimación categorías especiales](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/5-bases-legitimadoras-del-tratamiento/FAQ-0215-cuales-son-las-bases-de-legitimacion-para-el-tratamiento-de-las-categorias-especiales-de-datos) ·
[AEPD — consentimiento](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/5-bases-legitimadoras-del-tratamiento/FAQ-0211-segun-el-rgpd-como-debe-solicitarse-el-consentimiento-de-los-interesados-para-tratar-sus-datos-personales)

### 6.2 ¿Se requiere EIPD?

Una **Evaluación de Impacto en la Protección de Datos (EIPD)** es obligatoria cuando el
tratamiento implica datos de categoría especial a escala. La AEPD la exige cuando
concurren al menos dos de estos factores:
- Datos de categoría especial ✓
- Seguimiento sistemático de comportamiento ✓ (tracking mensual)
- Perfiles o evaluaciones personales ✓

**Recomendación**: hacer una EIPD antes del lanzamiento. No es un proceso largo para
una funcionalidad acotada, pero sí necesario para evitar sanciones.

[Fuente AEPD — EIPD](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/10-evaluacion-de-impacto/FAQ-0225-que-es-una-evaluacion-de-impacto-de-la-proteccion-de-datos)

### 6.3 Checklist legal mínimo para el MVP

- [ ] Pantalla de consentimiento explícito para datos de salud al activar la sección
- [ ] Los datos del CBI se almacenan en tabla separada, aislada del perfil social
- [ ] El usuario puede **exportar** sus datos (Art. 20 RGPD — portabilidad)
- [ ] El usuario puede **eliminar** sus datos de salud sin eliminar la cuenta (Art. 17)
- [ ] Política de privacidad actualizada con categoría especial de datos
- [ ] EIPD documentada antes del lanzamiento

---

## 7. Preguntas abiertas antes de implementar

1. **Contactos PAIME por todas las CCAA**: solo Cataluña y Madrid están verificados.
   Hay que completar las 15 restantes antes de publicar el directorio.

2. **Umbrales CBI para MIR españoles**: no existe un estudio con percentiles normativos
   específico para residentes MIR en España. Los umbrales 0–49/50–74/75–100 son
   orientativos. Considerar calibrar con datos propios una vez haya suficiente muestra.

3. **DPO**: ¿tiene LosResis un Delegado de Protección de Datos designado? Si se procesan
   datos de categoría especial a escala, puede ser recomendable (no siempre obligatorio
   para empresas pequeñas, pero sí aconsejable).

4. **Micro check-in vs. solo mensual**: ¿queremos datos semanales desde el MVP o empezar
   solo mensual y ver adherencia?

---

## 8. Propuesta de secuencia de implementación

| Fase | Alcance | Cuándo |
|---|---|---|
| **MVP** | CBI mensual + historial + PAIME por CCAA + líneas de crisis | Sprint 1–2 |
| **v1.1** | Micro check-in semanal (3 preguntas libres) | Sprint 3 |
| **v1.2** | PHQ-9/GAD-7 opcionales si CBI >75 | Sprint 4–5 |
| **Futuro** | UWES-9 (engagement positivo) + intervenciones basadas en CBT | TBD |

---

## Fuentes citadas

- [Mind Garden — MBI-HSS Medical Personnel (licencia)](https://www.mindgarden.com/315-mbi-human-services-survey-medical-personnel)
- [PMC8829575 — Validación MBI-HSS-MP](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8829575/)
- [PubMed 23775105 — CBI validación española](https://pubmed.ncbi.nlm.nih.gov/23775105/)
- [PubMed 36030114 — CBI en médicos](https://pubmed.ncbi.nlm.nih.gov/36030114/)
- [Gaceta Sanitaria 2024 — Prevalencia burnout médicos España](https://www.gacetasanitaria.org/es-prevalencia-del-sindrome-burnout-medicos-articulo-S0213911124000311)
- [SciELO ISCIII — Burnout residentes MIR Madrid](https://scielo.isciii.es/scielo.php?script=sci_arttext&pid=S3020-11602019000100007)
- [ICOMEM PAIME Madrid](https://www.icomem.es/seccion/SALUD-MENTAL-MEDICO/equipo-paime)
- [Clínica Galatea — PAIME Cataluña](https://www.clinica-galatea.com/es/bloc/medicos-enfermos/)
- [CGCOM — Mapa colegios médicos](https://www.cgcom.es/colegios-mapa)
- [FPSOMC — PAIME coordinación nacional](https://www.fpsomc.es/actividad/programas/programa-de-atencion-integral-al-medico-enfermo-paime)
- [Frontiers in Digital Health 2022 — UX apps salud mental](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2022.1045765/full)
- [PMC9490524 — Diseño apps salud mental](https://pmc.ncbi.nlm.nih.gov/articles/PMC9490524/)
- [AEPD — Bases legitimación categorías especiales](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/5-bases-legitimadoras-del-tratamiento/FAQ-0215-cuales-son-las-bases-de-legitimacion-para-el-tratamiento-de-las-categorias-especiales-de-datos)
- [AEPD — EIPD obligatoriedad](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/10-evaluacion-de-impacto/FAQ-0225-que-es-una-evaluacion-de-impacto-de-la-proteccion-de-datos)
