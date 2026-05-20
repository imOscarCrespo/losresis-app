# Eventos de PostHog

Este documento lista los eventos que la app envia a PostHog para que Producto pueda construir dashboards, funnels y cohorts sin tener que revisar el codigo.

## Notas rapidas

- Los eventos personalizados se envian con `posthogLogger.capture(nombre, propiedades)`.
- Las vistas de pantalla se envian con `posthogLogger.logScreen(nombrePantalla, propiedades)`, que internamente llama al metodo `screen` del SDK de PostHog.
- Todas las pantallas incluyen automaticamente la propiedad `timestamp`.
- La app tambien tiene activados eventos automaticos del SDK de PostHog, como lifecycle de aplicacion, deep links y Session Replay. Este documento se centra en los eventos definidos explicitamente por el equipo.

## Eventos personalizados

| Evento | Cuando se envia | Propiedades principales |
| --- | --- | --- |
| `App Opened` | Al abrir la app. | `app_version`, `os`, `device_type` |
| `Session Started` | Al iniciar una sesion de uso de la app. No es una sesion de login. | `app_version`, `os`, `device_type` |
| `Daily Active` | Una vez al dia por dispositivo activo. | `app_version`, `os`, `device_type`, `day_of_week` |
| `Auth Started` | Al iniciar autenticacion con Google o Apple. | `provider`, `platform` |
| `Auth Completed` | Cuando la autenticacion con Google o Apple termina correctamente. | `provider`, `platform` |
| `Onboarding Completed` | Cuando el usuario completa el onboarding/perfil inicial. | `completed_at` |
| `App Update Clicked` | Cuando el usuario pulsa para actualizar la app desde el banner/pantalla de update. | `platform`, `source`, `has_custom_update_url`, `target_url` |
| `clinical_assistant_message_sent` | Cuando se envia un mensaje al asistente clinico. | `source` |
| `clinical_assistant_response_received` | Cuando el asistente clinico responde correctamente. | Sin propiedades especificas |
| `clinical_assistant_response_failed` | Cuando falla la respuesta del asistente clinico. | `error` |
| `clinical_assistant_mode_changed` | Cuando el usuario cambia el modo del asistente clinico. | `mode` |
| `resident_book_pdf_exported` | Cuando un residente exporta su libro del residente a PDF. | `section`, `categories_count`, `entries_count`, `events_count` |
| `resident_review_gate_prompt_clicked` | Cuando el usuario pulsa el CTA para escribir su resena desde el bloqueo/recordatorio. | `source`, `status` |
| `resident_review_gate_blocked_navigation` | Cuando un residente bloqueado intenta navegar a una seccion no permitida. | `section`, `current_section` |
| `resident_review_gate_qualified_action` | Cuando se registra una accion cualificada para el sistema de bloqueo por resena pendiente. | `action_type`, `current_section`, `budget_count`, `sessions_count` |
| `resident_review_gate_prompt_shown` | Cuando se muestra el prompt del gate de resena. | `budget_count`, `sessions_count` |
| `resident_review_gate_hard_locked` | Cuando el residente pasa a estado de bloqueo duro por no haber dejado resena. | `budget_count`, `sessions_count` |
| `resident_review_gate_unlocked_by_review` | Cuando el gate se desbloquea porque el residente ha creado una resena. | `user_id` |
| `resident_review_gate_reset_after_review_deleted` | Cuando se resetea el gate tras eliminar una resena. | `user_id`, `status` |

## Pantallas

Estas entradas son nombres de pantalla enviados con `logScreen`. En PostHog conviene usarlas para dashboards de navegacion, visitas por seccion y retencion por pantalla.

| Pantalla | Propiedades principales |
| --- | --- |
| `WelcomeScreen` | `timestamp` |
| `DashboardScreen` | `timestamp` |
| `DashboardScreen_<section>` | `section`, `timestamp` |
| `ClinicalAssistantScreen` | `timestamp` |
| `ResidenceLibraryScreen` | `timestamp` |
| `ThreadDetailScreen` | `threadId`, `timestamp` |
| `LecturesScreen` | `timestamp` |
| `CreateCourseScreen_Create` | `courseId`, `isEditMode`, `timestamp` |
| `CreateCourseScreen_Edit` | `courseId`, `isEditMode`, `timestamp` |
| `ArticleDetailScreen` | `articleId`, `timestamp` |
| `ComunityScreen` | `timestamp` |
| `CourseDetailScreen` | `courseId`, `timestamp` |
| `MirSimulatorScreen` | `timestamp` |
| `HospitalsScreen` | `timestamp` |
| `LeisureForumScreen` | `forumType`, `timestamp` |
| `SportsSelectionScreen` | `timestamp` |
| `ProfileScreen` | `isOnboarding`, `timestamp` |
| `ProfileScreen_Onboarding` | `isOnboarding`, `timestamp` |
| `SpecialityQuizScreen` | `timestamp` |
| `GroupChatScreen` | `groupId`, `timestamp` |
| `MyPreferencesScreen` | `timestamp` |
| `GroupsScreen` | `userType`, `timestamp` |
| `LeisureScreen` | `timestamp` |
| `ReviewsScreen` | `timestamp` |
| `ArticlesScreen` | `timestamp` |
| `TeamCalendarView` | `timestamp` |
| `CreateHousingAdScreen_Create` | `adId`, `isEditMode`, `timestamp` |
| `CreateHousingAdScreen_Edit` | `adId`, `isEditMode`, `timestamp` |
| `ContactScreen` | `timestamp` |
| `HousingScreen` | `timestamp` |
| `HospitalInfoScreen` | `hospitalId`, `timestamp` |
| `AgendaScreen` | `timestamp` |
| `MyReviewScreen` | `timestamp` |
| `ReviewDetailScreen` | `reviewId`, `timestamp` |
| `HousingAdDetailScreen` | `adId`, `timestamp` |
| `HospitalDetailScreen` | `hospitalId`, `specialtyId`, `timestamp` |
| `RotationReviewDetailScreen` | `reviewId`, `timestamp` |
| `ExternalRotationsScreen` | `timestamp` |
| `MenuScreen` | `timestamp` |

## Secciones dinamicas del dashboard

El patron `DashboardScreen_<section>` se genera cada vez que cambia `currentSection`. Ejemplos habituales:

| Screen name generado | Seccion |
| --- | --- |
| `DashboardScreen_inicio` | Inicio |
| `DashboardScreen_hospitales` | Hospitales |
| `DashboardScreen_nota-mir` | Nota MIR |
| `DashboardScreen_specialityQuiz` | Test de especialidad |
| `DashboardScreen_usuario` | Perfil |
| `DashboardScreen_notificationSettings` | Ajustes de notificaciones |
| `DashboardScreen_notifications` | Notificaciones |
| `DashboardScreen_clinicalAssistant` | Asistente clinico |
| `DashboardScreen_menu` | Menu |
| `DashboardScreen_myPreferences` | Mis preferencias |
| `DashboardScreen_comunity` | Comunidad |
| `DashboardScreen_myReview` | Mi resena |
| `DashboardScreen_libro-residente` | Libro del residente |
| `DashboardScreen_articulos` | Articulos |
| `DashboardScreen_vivienda` | Vivienda |
| `DashboardScreen_roomies` | Roomies |
| `DashboardScreen_ocio` | Ocio |
| `DashboardScreen_sportsSelection` | Seleccion de deportes |
| `DashboardScreen_leisureForum` | Foro de ocio |
| `DashboardScreen_contacto` | Contacto |
| `DashboardScreen_agenda` | Agenda |
| `DashboardScreen_rotaciones-externas` | Rotaciones externas |
| `DashboardScreen_cursos` | Cursos |
| `DashboardScreen_residentPayouts` | Pagos a residentes |
| `DashboardScreen_residentPayoutDetail` | Detalle de pagos |
| `DashboardScreen_residentPayoutEntry` | Registro/edicion de pago |
| `DashboardScreen_grupos` | Chats/grupos |
| `DashboardScreen_reseñas` | Resenas |

## Propiedades de usuario identificadas

Cuando hay usuario autenticado, la app identifica el usuario en PostHog con:

| Propiedad | Significado |
| --- | --- |
| `email` | Email del usuario autenticado |
| `is_resident` | Si el perfil esta marcado como residente |
| `is_student` | Si el perfil esta marcado como estudiante |
| `is_super_admin` | Si el perfil esta marcado como super admin |

Si el usuario aun no tiene perfil completo, solo se envia `email`.
