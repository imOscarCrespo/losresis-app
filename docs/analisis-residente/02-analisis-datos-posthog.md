# 02 · Análisis de datos PostHog — segmento residente

> Fuente: proyecto PostHog `LosResis` (id 97501). Consultas HogQL ejecutadas el
> 2026-05-25. Todas las cifras son de los **últimos 30 días** salvo que se indique otra
> ventana. Cohorte de "residente" derivada como: usuarios con al menos un evento
> `userType='resident'` en los últimos 60 días (ver caveat #6).

## 1. Tamaño del segmento

| Tipo de usuario | Usuarios activos (30d) |
|------------------------------|----------------------:|
| `student` | **1.219** |
| `resident` | **459** |
| sin tipo (anónimos / pre-onboarding) | 3.022 |

El residente es ~**38% del estudiante**, pese a ser el segmento que da nombre a la app.
Las cifras son consistentes con el análisis del estudiante (`analisis-estudiantes/01`)
hecho hace 3 días, escaladas a la ventana de 30 días.

## 2. Pantallas más usadas

Pantallas reales (omitimos las equivalentes `DashboardScreen_*` que son rutas de
navegación al mismo destino). Ordenado por usuarios únicos:

| # | Pantalla | Vistas | Usuarios | % de residentes |
|---|----------|-------:|---------:|----------------:|
| 1 | `GroupsScreen` | 3.453 | **457** | **100%** |
| 2 | `ProfileScreen` | 2.501 | 421 | 92% |
| 3 | `AgendaScreen` | 1.051 | 389 | 85% |
| 4 | `MyReviewScreen` | 1.097 | 388 | 84% |
| 5 | `WelcomeScreen` | 515 | 363 | 79% |
| 6 | `GroupChatScreen` | 1.377 | 350 | 76% |
| 7 | `HousingScreen` | 2.429 | 260 | 57% |
| 8 | `ResidenceLibraryScreen` | 405 | 246 | 54% |
| 9 | *(ResidentPayoutsScreen via dashboard route)* | 357 | 232 | 51% |
| 10 | `MirSimulatorScreen` | 1.217 | 174 | 38% |
| 11 | `HospitalsScreen` | 1.841 | 167 | 36% |
| 12 | `LecturesScreen` | 384 | 168 | 37% |
| 13 | `HousingAdDetailScreen` | 956 | 163 | 36% |
| 14 | `ExternalRotationsScreen` | 191 | 127 | **28%** |
| 15 | `HospitalDetailScreen` | 1.415 | 113 | 25% |
| 16 | `CourseDetailScreen` | 200 | 105 | 23% |
| 17 | `SpecialityQuizScreen` | 138 | 68 | 15% |
| 18 | `ReviewsScreen` | 204 | 40 | 9% |
| 19 | `ReviewDetailScreen` | 122 | 32 | 7% |
| 20 | `MyPreferencesScreen` | 52 | 27 | 6% |
| 21 | `TeamCalendarView` | 29 | 21 | 5% |
| 22 | `ContactScreen` | 21 | 16 | 3% |
| 23 | `ClinicalAssistantScreen` | 31 | **4** | **<1%** |
| 24 | `MirOrientationScreen` | 44 | 1 | – |

**Lectura**:
- El **grupo de chat** es el ancla universal: 100% de residentes lo abren.
- **Perfil/Agenda/Reseña propia/Welcome** forman el "núcleo administrativo" usado por
  el 79-92% de residentes.
- **Vivienda, Libro del residente y Nóminas** son features de "media-larga cola":
  50-57% de uso.
- **Reseñas ajenas** (`ReviewsScreen`, `ReviewDetailScreen`) tienen uso bajo (~7-9%):
  el residente publica su reseña pero rara vez consume las de otros hospitales — eso
  es consumo del estudiante.
- **El asistente clínico es residual**: solo 4 usuarios lo abrieron, 14 mensajes
  enviados, 5 errores de respuesta. La feature actual no funciona como compañera diaria.
- **`ExternalRotationsScreen` es testimonial** (28%) y solo 8 personas vieron una
  reseña de rotación ajena en 30 días.

## 3. Acciones explícitas (eventos custom)

Top eventos no-pageview disparados por residentes en 30 días:

| Evento | Disparos | Usuarios |
|--------|---------:|---------:|
| `Session Started` / `App Opened` | 3.679 | 459 |
| `Daily Active` | 1.904 | 458 |
| `Onboarding Completed` | 351 | 305 |
| `App Update Clicked` | 446 | 246 |
| `resident_review_gate_qualified_action` | 56 | 15 |
| `resident_review_gate_prompt_clicked` | 8 | 7 |
| `resident_review_gate_unlocked_by_review` | 6 | 6 |
| `resident_review_gate_blocked_navigation` | 13 | 6 |
| `clinical_assistant_message_sent` | 14 | 4 |
| `clinical_assistant_response_received` | 7 | 3 |
| `clinical_assistant_response_failed` | 5 | 3 |
| `resident_book_pdf_exported` | 5 | 3 |
| `resident_review_gate_prompt_shown` | 4 | 4 |
| `resident_review_gate_hard_locked` | 1 | 1 |

**Lectura**:
- El **review-gate funciona como mecanismo de fricción** pero es marginal en volumen
  (15 usuarios lo dispararon). Solo 6 personas hicieron una reseña tras el prompt.
- **El asistente clínico tiene tasa de error muy alta**: 5 fallos de 14 envíos (35%).
  Suficiente para que quien lo prueba no vuelva.
- El **PDF del libro del residente apenas se exporta** (3 usuarios en 30 días): la
  utilidad final del libro no está cerrada.

## 4. Engagement: días activos en 30 días

| Días activos en 30d | Residentes | % |
|--------|------------:|----:|
| 1 día  | 120 | 26% |
| 2-3 días | 156 | 34% |
| 4-7 días | 121 | 27% |
| 8-14 días | 56 | 12% |
| 15+ días | 6 | 1% |

Solo el **13% de los residentes vuelven 8+ días al mes**. Compáralo con el estudiante:
**~61% volvía 8+ días en 90d**. El residente está casi un **5×** por debajo en
intensidad de retorno.

Esto es coherente con el patrón observado en pantallas: el residente entra a por algo
concreto (mirar nómina, abrir el chat, comprobar la agenda), lo hace, y se va. No hay
una superficie de uso *diario*.

## 5. Estacionalidad

Residentes activos por semana (90 días):

| Semana ISO | Residentes activos |
|------------|-------------------:|
| 2026-02-23 | 78 |
| 2026-03-02 | 84 |
| 2026-03-09 | 87 |
| 2026-03-16 | 76 |
| 2026-03-23 | 89 |
| 2026-03-30 | 61 |
| 2026-04-06 | 88 |
| 2026-04-13 | 104 |
| 2026-04-20 | 95 |
| 2026-04-27 | 104 |
| 2026-05-04 | **305** |
| 2026-05-11 | **269** |
| 2026-05-18 | **212** |

Baseline ~80-100 residentes/semana, con un **pico ×3 en mayo** coincidiendo con la
toma de posesión MIR (los R1 nuevos descubren la app, viejos residentes vuelven para
charlar del cambio). Sin un *driver de uso diario*, el riesgo es que la app se
abandone tras este pico estacional y el baseline vuelva a ~80/semana en agosto.

## 6. Caveats de instrumentación

1. **`userType` solo se setea en `GroupsScreen`**. Si filtras `properties.userType =
   'resident'` directamente en `events`, solo verás eventos de esa pantalla.
   Workaround usado en este análisis: derivar la cohorte como "person que tuvo al menos
   un `$screen` con `userType=resident` en 60 días" y luego agregar todos sus eventos.
   Acción pendiente: setear `userType` en `$register` o como `person.properties` global
   para que la segmentación funcione de forma trivial.
2. **`person.properties.userType` está vacío en todos los eventos**: PostHog
   person-on-events está activo, pero como `userType` nunca se propagó como propiedad
   de persona, el query natural devuelve `None` para todos. Mismo workaround.
3. La cifra 459 "residentes activos" en 30 días es **mínima** (solo capta a quien tocó
   `GroupsScreen` u otra pantalla instrumentada con `userType` alguna vez en 60d). El
   residente real probablemente sea un 10-20% mayor.
4. **`ExternalRotationsScreen` puede estar infravalorado** por residentes en
   PENDING_SEASONAL que tienen creación bloqueada.

## 7. Conclusiones para el diseño

1. **El residente NO tiene una superficie de uso diario hoy**. Las 4 pantallas más
   usadas (`Groups`, `Profile`, `Agenda`, `MyReview`) son administrativas o sociales,
   no clínicas. Falta una "razón clínica" para abrir la app cada turno.
2. **Lo social está saturado** (chat al 100%): seguir invirtiendo ahí da diminishing
   returns. El roof está cerca.
3. **Los huecos de uso bajo son DOS** y muy distintos:
   - **Asistente clínico** — la feature existe pero no engancha (problema de
     producto, no de demanda).
   - **Rotaciones externas** — uso bajo posiblemente por fricción burocrática (no
     resuelve el papeleo Comisión de Docencia).
4. **Las medias colas son oportunidades de polish**: libro del residente (54%) y
   nóminas (51%) ya están en la mitad alta, basta con cerrarlas bien.
5. **La estacionalidad es un riesgo**: mayo dispara pero el baseline de 80/semana no
   es defensible para una app que aspire a uso recurrente. Necesita un *daily driver*
   nuevo (ver propuesta).

> Ver también: [`03-investigacion-necesidades-residente.md`](./03-investigacion-necesidades-residente.md)
> para qué dice el residente que necesita realmente, fuera de la app.
