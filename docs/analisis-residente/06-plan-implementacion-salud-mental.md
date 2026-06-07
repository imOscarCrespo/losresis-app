# 06 · Plan de implementación: sección "Salud Mental"

> Plan técnico para implementar la funcionalidad de salud mental descrita en
> [`05-investigacion-salud-mental.md`](./05-investigacion-salud-mental.md).
> Stack: React Native + Expo + Supabase. Patrón del proyecto: `Screen → Hook → Service → Supabase`.

---

## Estado: Sprint 1 implementado (2026-06-06)

Archivos creados/modificados:
- `supabase/migrations/20260606120000_mental_health.sql` — tablas + RLS
- `supabase/migrations/20260606130000_mental_health_monthly_reminder.sql` — push mensual
- `constants/cbiQuestionnaire.js` · `constants/paimeResources.js`
- `services/mentalHealthService.js` · `hooks/useMentalHealth.js`
- `screens/MentalHealthScreen.js` · `screens/MentalHealthQuestionnaireScreen.js`
- `constants/navigationItems.js` (item `mentalHealth` residentOnly + IMPLEMENTED_SECTIONS)
- `screens/DashboardScreen.js` (import, KNOWN/GENERIC_BACK sections, render case, router de
  push, **y las dos allow-lists de gate** `residentHardGateAllowedSections` y el redirect de
  email-lock, para que los recursos sigan accesibles con el gate activo)

Pendiente real antes de lanzar: texto validado del CBI, contactos PAIME del resto de CCAA,
EIPD, política de privacidad.

## Qué hacer primero (Sprint 1 — MVP)

El orden de implementación va de abajo arriba: base de datos → servicio → hook → pantallas.

### Paso 1 · Migración SQL

Crear `supabase/migrations/xxx_mental_health.sql`:

```sql
-- Tabla de evaluaciones CBI
CREATE TABLE mental_health_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  personal_score  NUMERIC(5,2),
  work_score      NUMERIC(5,2),
  patient_score   NUMERIC(5,2),
  answers         JSONB NOT NULL
);

ALTER TABLE mental_health_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY mha_select_own ON mental_health_assessments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY mha_insert_own ON mental_health_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY mha_delete_own ON mental_health_assessments
  FOR DELETE USING (auth.uid() = user_id);

-- Tabla de consentimiento RGPD (datos de salud = categoría especial Art. 9)
CREATE TABLE mental_health_consent (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version      TEXT NOT NULL DEFAULT '1.0'
);

ALTER TABLE mental_health_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY mhc_select_own ON mental_health_consent
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY mhc_insert_own ON mental_health_consent
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY mhc_delete_own ON mental_health_consent
  FOR DELETE USING (auth.uid() = user_id);
```

> Decisión: las respuestas se guardan como `JSONB` en `answers` (`{ "p1": 50, "w1": 75, ... }`)
> en lugar de una tabla `answer` separada — el CBI es un cuestionario fijo, no hay catálogo dinámico.

### Paso 2 · Datos estáticos del CBI

Crear `constants/cbiQuestionnaire.js` con las 19 preguntas y las 5 opciones de respuesta
(ver listado completo abajo en sección "Contenido del CBI").

Crear `constants/paimeResources.js` con los recursos PAIME por CCAA y las líneas de crisis.

### Paso 3 · Servicio `services/mentalHealthService.js`

Funciones:
- `getConsent(userId)` → fila de consentimiento o `null`
- `saveConsent(userId, version)` → upsert
- `getAssessments(userId)` → historial ordenado por fecha desc
- `saveAssessment(userId, answers)` → calcula scores y hace insert
- `deleteAllAssessments(userId)` → borrado total (Art. 17 RGPD)
- `calculateCbiScores(answers)` → `{ personal_score, work_score, patient_score }`

> Nota: **no** habrá `getScoreLevel` ni umbrales — los resultados se muestran como
> puntuación + evolución, sin clasificar en niveles (ver decisión en "Resultado").

### Paso 4 · Hook `hooks/useMentalHealth.js`

Estado: `assessments`, `consent`, `loading`, `saving`, `error`.
Derivados: `lastAssessment`, `isAssessmentDueThisMonth` (para el nudge, no para bloquear), `hasConsented`.
Métodos: `fetchAll`, `saveConsent`, `saveAssessment`, `deleteAllData`.

### Paso 5 · Pantallas

1. `screens/MentalHealthScreen.js` — hub:
   - Si no ha consentido → muestra pantalla de consentimiento bloqueante.
   - Si no hay evaluaciones → CTA "Hacer mi primera evaluación".
   - Si hay evaluaciones → resumen de la última (3 barras) + acceso al historial.
   - Sección "Recursos" siempre visible (PAIME + 024 + Teléfono de la Esperanza).

2. `screens/MentalHealthQuestionnaireScreen.js` — cuestionario CBI:
   - Barra de progreso ("7 / 19").
   - Una pregunta a la vez con 5 opciones grandes (touch-friendly).
   - Al terminar: calcula scores, guarda, navega a resultado.

3. Resultado (modal sobre el hub o pantalla):
   - 3 puntuaciones (Personal / Laboral / Pacientes) con foco en **su evolución temporal**
     (¿subo o bajo respecto a mediciones anteriores?).
   - **Sin etiquetas de nivel** (nada de bajo/moderado/alto ni "zona de alerta") — no
     existen umbrales validados para MIR españoles y etiquetar rozaría lo clínico.
   - Lenguaje **no clínico**, centrado en el cambio personal, no en un juicio de valor.
   - Los **recursos de ayuda están siempre accesibles** desde el hub, NO se disparan por
     umbral. Nunca alarmamos por una cifra.

### Acceso (gate de residente)

- Los **recursos de crisis** (PAIME, 024, Teléfono de la Esperanza) son accesibles para
  **todo residente**, sin importar el estado del gate (REVIEW_PENDING/REJECTED, bloqueo
  estacional MIR). Quien está en burnout no debe encontrarse un muro.
- El **cuestionario CBI y el guardado de datos** sí requieren ser residente validado
  (mismas reglas que el resto de features que escriben datos).
- Implicación de diseño: la pantalla `MentalHealthScreen` debe poder renderizar la sección
  de recursos aunque el gate bloquee la parte de evaluación.

### Paso 6 · Integración en navegación

- `constants/navigationItems.js` → añadir item `mentalHealth` para residentes.
- `DashboardScreen.js` → añadir `case "mentalHealth"` al switch de secciones.

### Paso 7 · Recordatorio push mensual

Replica el patrón de `supabase/migrations/20260526100000_resident_monthly_payroll_upload_reminder.sql`:

- Registrar un `notification_type` dedicado (ej. `mental_health_monthly_reminder`) para que
  el usuario pueda **silenciarlo** desde `user_notification_preferences`.
- Función `SECURITY DEFINER` idempotente programada con `pg_cron` cada hora; dispara solo
  el día elegido a las 10:00 hora España; deduplica por periodo (año/mes).
- Solo notifica a residentes que **aún no han hecho una evaluación ese mes** (paralelo al
  `NOT EXISTS` sobre `resident_monthly_payouts` del recordatorio de nómina).
- Inserta en `public.notifications` con `destination_section: 'mentalHealth'`; eso dispara
  el push vía la edge function existente y aparece en el centro de notificaciones in-app.
- **Copy no alarmante**: tono de cuidado, nunca de urgencia clínica. Ej: *"¿Cómo llevas el
  mes? Tómate 5 minutos para tu evaluación de bienestar."*

> El "sin bloqueo" de la cadencia (decisión arriba) sigue valiendo: el recordatorio invita,
> pero el usuario puede evaluarse cuando quiera y cuantas veces quiera.

---

## Contenido del CBI (19 ítems, dominio público)

> ⚠️ **El texto de abajo es una traducción provisional, NO la versión española validada.**
> Antes de implementar el contenido hay que sustituirlo por el texto exacto del CBI
> validado en español (estudio PMID 23775105). Usar una traducción propia invalidaría el
> argumento de "instrumento validado". La estructura (dominios, escala, puntuación) sí es
> correcta y se puede desarrollar en paralelo con texto placeholder.

**Opciones de respuesta** (todas las preguntas):
`Nunca` (0) · `Casi nunca` (25) · `A veces` (50) · `Casi siempre` (75) · `Siempre` (100)

**Burnout personal (6 ítems):**
1. ¿Con qué frecuencia te sientes agotado/a?
2. ¿Con qué frecuencia te sientes físicamente exhausto/a?
3. ¿Con qué frecuencia te sientes emocionalmente exhausto/a?
4. ¿Con qué frecuencia piensas: "No aguanto más"?
5. ¿Con qué frecuencia te sientes desgastado/a?
6. ¿Con qué frecuencia te sientes débil y susceptible de enfermar?

**Burnout laboral (7 ítems):**
7. ¿Te cansa tu trabajo?
8. ¿Te agota trabajar todo el día?
9. ¿Sientes que tu trabajo te consume emocionalmente?
10. ¿Te sientes frustrado/a con tu trabajo?
11. ¿Te sientes al límite de tus fuerzas en el trabajo?
12. ¿Piensas que cada día de trabajo es interminable?
13. ¿Tienes energía suficiente para tu familia y amigos en tu tiempo libre? *(ítem invertido)*

**Burnout por pacientes (6 ítems):**
14. ¿Te cansa trabajar con los pacientes?
15. ¿Sientes que das más de lo que recibes cuando trabajas con pacientes?
16. ¿Estás cansado/a de trabajar con los pacientes?
17. ¿A veces te preguntas cuánto más podrás aguantar trabajando con pacientes?
18. ¿Sientes que no tienes nada más que dar a los pacientes?
19. ¿Tu trabajo con pacientes te resulta frustrante?

**Puntuación:** cada dimensión = media de sus ítems (0–100). El ítem 13 se invierte (`100 - valor`).

**Presentación:** se muestra la puntuación (0–100) por dimensión y su **evolución temporal**,
sin clasificar en niveles. NO usamos cortes (0-49/50-74/75-100) porque no existen umbrales
validados para residentes MIR españoles y etiquetar "alto/alerta" rozaría una afirmación
clínica. Los recursos de ayuda están siempre disponibles, no condicionados a una cifra.

---

## Recursos (contenido a mostrar)

**PAIME por CCAA** (verificados):
- Cataluña → Clínica Galatea · tel. `93 205 72 67` · clinica-galatea.com
- Madrid → ICOMEM PAIME · icomem.es/seccion/SALUD-MENTAL-MEDICO/equipo-paime
- Resto → mapa de colegios médicos: cgcom.es/colegios-mapa

> ⚠️ Solo Cataluña y Madrid verificados. Antes de publicar, completar las 15 CCAA restantes
> o usar el fallback al mapa de CGCOM.
>
> **Detección de CCAA:** el perfil solo guarda `city` (texto libre), no hay campo de CCAA.
> En el MVP el usuario **selecciona su CCAA manualmente** en la pantalla de recursos; si
> tenemos PAIME verificado para esa CCAA lo mostramos, si no, link al mapa de CGCOM. No se
> construye mapa ciudad→CCAA en Sprint 1.

**Líneas de crisis (24h):**
- 024 — Línea de atención a la conducta suicida (Ministerio de Sanidad)
- 717 003 717 — Teléfono de la Esperanza

---

## Decisiones clave tomadas

| Tema | Decisión |
|---|---|
| Cuestionario | **CBI** (dominio público), no MBI (licencia de pago) |
| Periodicidad | Mensual **sugerida, sin bloqueo** — recordatorio + estado "toca tu evaluación mensual", pero se puede hacer cuando se quiera. El gráfico pinta todas las mediciones |
| Almacenamiento respuestas | JSONB en una columna, sin tabla de respuestas separada |
| Consentimiento | Pantalla bloqueante la 1ª vez (RGPD Art. 9), no checkbox genérico |
| Privacidad | Datos aislados del feed social; nunca cruzados con datos de uso |
| Borrado | Botón "Borrar historial" disponible (RGPD Art. 17) |
| Analytics | Solo evento `assessment_completed` sin scores; nunca el contenido |
| Lenguaje | "Indicadores de bienestar", nunca "diagnóstico" / "trastorno" |
| Resultados | Puntuación + **evolución temporal**, sin niveles ni umbrales (no hay cortes validados para MIR ES) |
| Recursos | Accesibles para todo residente (sin gate); no se disparan por umbral |
| Cuestionario | Texto exacto **pendiente**: versión española validada del CBI, no traducción propia |
| Recordatorio | Push mensual replicando patrón de recordatorio de nómina; silenciable; copy de cuidado |

---

## Pendiente antes de lanzar (no bloquea desarrollo)

- [ ] Verificar contactos PAIME de las 15 CCAA restantes.
- [ ] Documentar la EIPD (Evaluación de Impacto en Protección de Datos) — obligatoria por
      tratar datos de categoría especial con seguimiento sistemático.
- [ ] Actualizar política de privacidad con la mención a datos de salud.
- [ ] Confirmar si el item entra en el footer de residentes o solo en el menú.

---

## Fases siguientes (fuera del Sprint 1)

| Fase | Alcance |
|---|---|
| Sprint 2 | Historial con gráfico temporal + borrado de datos + PAIME por CCAA completo |
| v1.1 | Micro check-in semanal (3 preguntas libres, tabla `mental_health_checkins`) |
| v1.2 | PHQ-9 / GAD-7 opcionales como escalado si CBI ≥75 |
