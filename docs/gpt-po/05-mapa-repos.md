# Mapa de repos y superficies de LosResis

Sirve para que una tarea diga **dónde** ocurre algo. No hace falta acertar el fichero
exacto: basta con nombrar la pantalla, la ruta del panel o la tabla. El agente de
desarrollo encuentra el fichero solo.

## Los repos

| Repo | Qué es | Cuándo se toca |
|---|---|---|
| `losresis-app` | App móvil del residente y del estudiante. Expo / React Native (JavaScript, algo de TypeScript en `src/`). | Todo lo que ve el residente o el estudiante en el móvil. |
| `losresis-panel` | Panel web de hospitales y empleadores. Next.js (App Router) + TypeScript + Tailwind. | Todo lo que ve el Owner, el Responsable de especialidad o el Médico del equipo. |
| `losresis-db` | **Source of truth** de la base de datos: todas las migraciones SQL, RLS, triggers, funciones. | Siempre que la tarea necesite un campo, tabla, permiso o notificación nuevos. |
| `losresis-landing`, `losresis-housing`, `losresis-sponsors` | Webs satélite. | Solo si la tarea es de la web pública. |

Regla dura: **ninguna migración SQL se crea dentro de app ni de panel**. Si la tarea toca
esquema, se dice explícitamente "requiere migración en losresis-db".

## Reglas de arrastre (efectos que una tarea suele olvidar)

- **Catálogos estáticos**: hospitales, especialidades, relación hospital-especialidad, notas MIR
  y preguntas estáticas se sirven desde `data/staticCatalog/*.json`, no desde Supabase.
  Cambiarlos en la base de datos **no** los cambia en la app publicada: hay que regenerar
  (`npm run export:static-catalog`) y publicar build o EAS Update. Si la tarea toca cualquiera
  de esos datos, decirlo.
- **Borrado de usuario**: cualquier relación nueva hacia un usuario tiene que definir qué pasa
  al borrar la cuenta.
- **Pantalla nueva en la app**: usa `HeroScreenLayout`; iconos siempre vía `components/Icon.js` (Phosphor).
- **Panel**: solo la paleta de marca (`brand-*`, `mint-*`, `navy-*`, `ink-*`), sin hex sueltos.
- **Nombres en base de datos en inglés**; textos visibles al usuario en español.
- **Test de especialidad MIR**: conviven v2 y v3; nada que rompa sesiones históricas.

## Superficies de la app (`losresis-app/screens/`)

Nombra la pantalla por su nombre visible o por este fichero:

- AgendaScreen
- ArticleDetailScreen
- ArticlesScreen
- ClinicalAssistantScreen
- ComunityScreen
- ContactScreen
- CourseDetailScreen
- CreateCourseScreen
- CreateHousingAdScreen
- CreateRoommateProfileScreen
- DashboardScreen
- EvaluationsScreen
- ExternalRotationsScreen
- GroupChatScreen
- GroupsScreen
- HomeDashboardScreen
- HospitalDetailScreen
- HospitalInfoScreen
- HospitalsScreen
- HousingAdDetailScreen
- HousingScreen
- LecturesScreen
- LeisureForumScreen
- LeisureScreen
- MentalHealthQuestionnaireScreen
- MentalHealthScreen
- MenuScreen
- MirOrientationScreen
- MirProjectedScoreScreen
- MirQuestionBankScreen
- MirSimulatorScreen
- MyConnectionsScreen
- MyPostsScreen
- MyPreferencesScreen
- MyReviewScreen
- OnboardingScreen
- OpenDayFeedbackScreen
- ProfileEditScreen
- ProfileScreen
- ResidenceLibraryScreen
- ResidentPayoutDetailScreen
- ResidentPayoutEntryScreen
- ResidentPayoutsScreen
- ResidentsDirectoryScreen
- ReviewComposerScreen
- ReviewDetailScreen
- ReviewsScreen
- RoommateScreen
- RotationReviewDetailScreen
- SelfAssessmentAnswerScreen
- SelfAssessmentsScreen
- ServiceRemindersScreen
- SpecialityQuizScreen
- SportsSelectionScreen
- StudyPhotoScreen
- ThreadDetailScreen
- TutoringScreen
- WelcomeScreen

Vistas adicionales en `src/screens/` (TypeScript): ajustes y notificaciones.

### Dominios de datos de la app (`losresis-app/services/`)

Cada fichero es un dominio funcional; ayuda a situar la tarea:

- agenda
- appUpdate
- articles
- auth
- biometric
- clinicalAssistant
- community
- connections
- dashboardAdvertisement
- directChats
- docencia
- emailReview
- example
- externalRotationReview
- externalRotation
- featureAccess
- feed
- filterStorage
- forum
- groupMessages
- group
- hospital
- housing
- lecture
- libroArchive
- libroAttachment
- libroPdf
- libro
- libroTemplate
- libroYear
- mentalHealth
- mirProjection
- mirQuestionBank
- mirSimulator
- posthog
- preferences
- referral
- residentPayout
- residentReviewGate
- residentTransitionConfig
- review
- reviews
- roommateChats
- roommate
- serviceReminders
- shiftPayroll
- shift
- specialityQuiz
- staticCatalog
- studentQuestions
- studyPhoto
- userProfileCache
- user
- version

## Superficies del panel (`losresis-panel/src/app/dashboard/`)

Nombra la sección del panel por su ruta:

- `/dashboard/autoevaluacion`
- `/dashboard/comunicados`
- `/dashboard/courses`
- `/dashboard/cuenta`
- `/dashboard/evaluaciones`
- `/dashboard/formative-plans`
- `/dashboard/hospital-profile`
- `/dashboard/jobs`
- `/dashboard/libro-template`
- `/dashboard/mir-recruitment-profile`
- `/dashboard/open-days`
- `/dashboard/organization`
- `/dashboard/pase`
- `/dashboard/plans`
- `/dashboard/recordatorios`
- `/dashboard/residents-libros`
- `/dashboard/seguimiento`
- `/dashboard/team`
- `/dashboard/tutorias`
- `/dashboard/users`
- `/dashboard/visibility`

Rutas fuera del dashboard: `/login`, `/signup`, `/welcome`, `/forgot-password`,
`/reset-password`, `/libro-template`.

APIs del panel: `src/app/api/` (auth, admin, team, seguimiento, hospitals,
hospital-visibility, billing, stripe).

## Cómo se prueba cada cosa

- App en local: `npm start` / `npm run ios` (Expo). Lo que ve el usuario final llega por
  build de TestFlight o EAS Update.
- Panel en local: `npm run dev`. Tests: `npm run test` (vitest). Lint: `npm run lint`.
- Si la tarea es un bug de la app, es importante saber **la versión del build** donde ocurre.
