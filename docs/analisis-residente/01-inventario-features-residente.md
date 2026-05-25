# 01 · Inventario de funcionalidades para el residente

> Inventario realizado el 2026-05-25 leyendo el código de la app
> (`screens/`, `services/`, `constants/navigationItems.js`, `utils/residentAccess.js`,
> `App.js`). El objetivo es tener un mapa completo de lo que el usuario `is_resident=true`
> puede hacer hoy, ANTES de proponer nuevas features.

## 0. Modelo de acceso

El residente accede a la app tras completar onboarding y pasar una de las dos
combinaciones válidas:

- **VALIDATED** — email corporativo validado manualmente (revisión del admin).
- **REVIEW_PENDING** — email enviado, esperando revisión: usa la app en modo lectura,
  no puede crear reseñas ni rotaciones externas (ver
  `utils/residentAccess.js:canResidentCreateExternalRotation`,
  `canWriteResidentHospitalReview`).
- **PENDING_SEASONAL** — R1 dentro de la ventana MIR (hasta 2026-09-20) sin email
  corporativo aún disponible: acceso temporal con countdown.
- **REJECTED / LOCKED_SEASONAL** — redirect forzado a `ProfileScreen` con banner rojo/ámbar.

A esto se suma un **review-gate suave**: tras N "acciones cualificadas" sin haber
publicado reseña, la app muestra un prompt; tras más acciones aún sin reseña, bloquea
navegación (eventos `resident_review_gate_*` en PostHog).

Las pantallas siguientes asumen siempre `VALIDATED` o `PENDING_SEASONAL`.

## 1. Comunidad y chats — **CUBIERTO**

| Pantalla | Función |
|----------|---------|
| `screens/GroupsScreen.js` | Lista grupos por especialidad + ciudad (auto-join al crear perfil). |
| `screens/GroupChatScreen.js` | Chat de grupo en tiempo real (Supabase realtime). |
| `screens/LeisureScreen.js` + `LeisureForumScreen.js` | Foro de ocio por ciudad. |

**Servicios**: `groupService.js`, `groupMessagesService.js`, `forumService.js`.
**Gates**: ninguno relevante. **Valoración**: cubierto y muy usado (100% de residentes
activos visitan `GroupsScreen` en 30 días).

## 2. Reseñas de hospital — **CUBIERTO con review-gate**

| Pantalla | Función |
|----------|---------|
| `screens/MyReviewScreen.js` | Crear/editar la reseña del propio hospital. |
| `screens/ReviewsScreen.js` | Buscar reseñas ajenas (filtros, ordenar por rating). |
| `screens/ReviewDetailScreen.js` | Detalle de una reseña ajena. |
| `screens/ReviewComposerScreen.js` | Composer paso a paso. |

**Servicios**: `reviewService.js`, `communityService.js`, `emailReviewService.js`
(para validación de email).
**Gates**: requiere email corporativo VALIDATED o (en seasonal grace) bypass temporal.
**Valoración**: cubierto. Es la pieza que sostiene el contrato implícito "das reseña
→ tienes acceso completo".

## 3. Rotaciones externas — **PARCIAL (uso bajo)**

| Pantalla | Función |
|----------|---------|
| `screens/ExternalRotationsScreen.js` | CRUD de rotaciones externas (observacional, clínica, investigación). |
| `screens/RotationReviewDetailScreen.js` | Detalle de reseña de una rotación. |

**Servicios**: `externalRotationService.js`, `externalRotationReviewService.js`,
`directChatsService.js` (chat directo con tutor).
**Gates**: email corporativo VALIDATED.
**Valoración**: la feature existe pero el código + datos lo confirman: solo 28% de los
residentes activos la abre. Falta plantilla burocrática (formato Comisión de Docencia),
plazos y recordatorios.

## 4. Vivienda y compañeros de piso — **CUBIERTO**

| Pantalla | Función |
|----------|---------|
| `screens/HousingScreen.js` | Listado de anuncios filtrados por ciudad/precio. |
| `screens/HousingAdDetailScreen.js` | Detalle del anuncio. |
| `screens/CreateHousingAdScreen.js` | Publicar anuncio (solo `is_host`). |
| `screens/RoommateScreen.js` | Matching tipo Tinder de roomies. |
| `screens/CreateRoommateProfileScreen.js` | Perfil de roomie (hobbies, horarios). |

**Servicios**: `housingService.js`, `roommateService.js`.
**Valoración**: cubierto. Más usado por R1 que rotan ciudad; uso decrece para R3+.

## 5. Agenda / guardias — **CUBIERTO**

| Pantalla | Función |
|----------|---------|
| `screens/AgendaScreen.js` | Calendario con eventos (guardias, cursos, congresos, day-offs, recordatorios). Team-calendar para ver guardias de colegas del grupo. |

**Servicios**: `agendaService.js`, `shiftService.js` (legacy shifts).
**Valoración**: cubierto en lo visual. Falta capa "legal" (¿llevo >48h esta semana? ¿he
librado tras la guardia?) — ver propuesta #1.

## 6. Libro del residente — **PARCIAL**

| Pantalla | Función |
|----------|---------|
| `screens/ResidenceLibraryScreen.js` | Tracking de actividades (procedimientos, presentaciones, investigación) por categoría y año. Modos contador/nota/checklist. Exportar a PDF. |

**Servicios**: `libroService.js`, `libroPdfService.js`.
**Valoración**: la usa el 54% de los residentes activos, pero las categorías son
genéricas (no atadas al itinerario formativo BOE por especialidad), no hay alertas de
"te faltan X procedimientos antes de fin de año" y el PDF no encaja con la memoria
anual oficial.

## 7. Nóminas — **CUBIERTO, mejorable**

| Pantalla | Función |
|----------|---------|
| `screens/ResidentPayoutsScreen.js` | Resumen anual con gráfico mensual. |
| `screens/ResidentPayoutDetailScreen.js` | Desglose mes (guardias L-V, viernes, sábado, domingo, festivo, bruto). |
| `screens/ResidentPayoutEntryScreen.js` | Entrada manual si no hay registro automático. |

**Servicios**: `residentPayoutService.js`.
**Valoración**: la usa el 51% de los residentes activos. Falta cálculo IRPF de guardias
(es el punto opaco), comparativa entre CCAA y proyección anual (ver propuesta #7).

## 8. Asistente clínico LLM — **HUECO funcional**

| Pantalla | Función |
|----------|---------|
| `screens/ClinicalAssistantScreen.js` | Chat con LLM (streaming SSE a `losresis-llm` en Supabase). Modo "guardia" con contexto. |

**Servicios**: `clinicalAssistantService.js`.
**Gates**: feature flag `can_use_clinical_assistant` por usuario.
**Valoración**: prácticamente inutilizado (4 usuarios en 30 días, solo 14 mensajes
enviados, 5 errores). El concepto es bueno pero el wrapper LLM genérico no compite con
UpToDate/Medscape. Conviene **rediseñar** hacia consulta determinista de calculadoras +
protocolos + atajo a UpToDate (ver propuesta #4).

## 9. Formación y cursos — **CUBIERTO en catálogo**

| Pantalla | Función |
|----------|---------|
| `screens/LecturesScreen.js` | Catálogo de cursos/congresos filtrado por especialidad. |
| `screens/CourseDetailScreen.js` | Detalle (fechas, ponentes, ubicación, registro externo). |

**Servicios**: `lectureService.js`.
**Valoración**: catálogo correcto. No gestiona inscripción ni recordatorios. Lo abre el
37% de los residentes activos.

## 10. Onboarding y perfil — **CUBIERTO**

| Pantalla | Función |
|----------|---------|
| `screens/OnboardingScreen.js` | Flujo multistep (tipo, nombre, ciudad, hospital, especialidad, año, email corporativo, avatar). |
| `screens/ProfileScreen.js` | Editar perfil + banners de validación email (pending, rejected, locked seasonal). |
| `components/ProfileAvatarEditor.js` *(nuevo)* | Editor de avatar. |
| `components/onboarding/` *(nuevo)* | Pasos del onboarding rediseñado 2026-05. |

**Servicios**: `userService.js`, `emailReviewService.js`, `biometricService.js`.
**Valoración**: cubierto y crítico (la validación de email corporativo es el gate
principal del modelo de negocio).

## 11. Notificaciones — **CUBIERTO**

| Pantalla | Función |
|----------|---------|
| `NotificationsScreen` | Historial. |
| `NotificationSettingsScreen` | Toggles. |

Push tokens y deeplinks operativos. Sin huecos relevantes.

## 12. Legacy MIR — **CUBIERTO (uso nostalgia)**

| Pantalla | Función |
|----------|---------|
| `screens/MirSimulatorScreen.js` | Simulador de probabilidad de plaza por nota (residente lo usa para "revivir" su elección). |
| `screens/MirProjectedScoreScreen.js` *(nuevo)* | Tracker de simulacros + proyección de orden final. |
| `screens/MirOrientationScreen.js` | Guía de orientación de especialidad. |

**Servicios**: `mirSimulatorService.js`, `mirProjectionService.js`.
**Valoración**: lo abre el 38% de los residentes (curiosidad/nostalgia), pero no
genera engagement recurrente.

## 13. Otras

- `screens/SpecialityQuizScreen.js` — quiz vocacional (uso bajo en residentes: 15%).
- `screens/ContactScreen.js` — feedback.
- `screens/DashboardScreen.js`, `screens/HomeDashboardScreen.js` — hub con hero card,
  próximos eventos, advertising carousel, quick actions.

## Resumen de cobertura

| Categoría | Cobertura | Uso real (30d) |
|---|---|---|
| Comunidad / chat grupos | Cubierto | 100% |
| Reseñas hospital | Cubierto | 84% |
| Agenda / guardias visual | Cubierto | 85% |
| Vivienda / roomies | Cubierto | 57% |
| Libro del residente | **Parcial** (categorías genéricas, sin BOE) | 54% |
| Nóminas | Parcial (sin IRPF ni comparativa CCAA) | 51% |
| Formación / cursos catálogo | Cubierto | 37% |
| Rotaciones externas | **Parcial** (sin plantilla burocrática) | 28% |
| Asistente clínico LLM | **Hueco funcional** | <1% |
| Salud mental / burnout | **Sin cubrir** | – |
| Derechos laborales / contador guardias legales | **Sin cubrir** | – |
| Consulta clínica bedside (calculadoras, protocolos) | **Sin cubrir** | – |
| Post-MIR (fellowships, opos, CV) | **Sin cubrir** | – |
| Asistente sesión clínica | **Sin cubrir** | – |

Los huecos sin cubrir y los "parcial" son la base de la propuesta de
[`04-propuesta-features-engagement.md`](./04-propuesta-features-engagement.md).
