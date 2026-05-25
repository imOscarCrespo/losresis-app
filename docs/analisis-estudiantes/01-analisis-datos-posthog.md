# 01 · Análisis de datos PostHog — segmento estudiante

> Fuente: proyecto PostHog `LosResis` (id 97501). Consultas HogQL ejecutadas el 2026-05-22.
> Todas las cifras son de los **últimos 90 días** salvo que se indique otra ventana.

## 1. Tamaño del segmento

| Tipo de usuario (`userType`) | Usuarios únicos (90d) |
|------------------------------|----------------------:|
| `student`                    | **1.677**             |
| `resident`                   | 441                   |
| sin tipo (anónimos / pre-onboarding) | 4.688         |

El estudiante es ya el **mayor segmento identificado** de la plataforma — casi **4× los
residentes** — pese a que la app nació orientada al residente ("LosResis").

> ⚠️ **Caveat de instrumentación:** la propiedad `userType` empezó a poblarse hace poco
> (primeros valores en marzo 2026). El histórico previo de "estudiante" está infravalorado;
> el segmento real es probablemente mayor.

## 2. El journey real del estudiante

Pantallas más vistas por las personas identificadas como estudiantes (90 días). Todo el
recorrido gira en torno a la **elección de plaza post-MIR**, no a estudiar para el examen:

| # | Pantalla | Vistas | Usuarios | Función |
|---|----------|-------:|---------:|---------|
| 1 | `MirSimulatorScreen` (nota-mir) | 41.214 | **1.656** | Metes tu nota MIR → probabilidades de plaza. **El usa el 99% de los estudiantes.** |
| 2 | `HospitalsScreen` | 82.047 | 1.643 | Explorar hospitales |
| 3 | `HospitalDetailScreen` | 51.990 | 1.396 | Detalle de un hospital |
| 4 | `SpecialityQuizScreen` | 3.198 | 1.168 | Quiz de orientación vocacional → especialidad |
| 5 | `MyPreferencesScreen` | 6.192 | 1.055 | Preferencias del usuario |
| 6 | `HousingScreen` | 7.847 | 1.032 | Vivienda |
| 7 | `GroupChatScreen` | 2.705 | 901 | Chat de grupos |
| 8 | `ReviewsScreen` | 6.197 | 791 | Reseñas de hospitales/servicios |
| – | `GroupsScreen` / roomies | 10.250 / 1.835 | 1.677 / 632 | Grupos y compañeros de piso |

Apenas usado por estudiantes: asistente clínico (`ClinicalAssistantScreen`, 3 usuarios),
agenda (151), cursos/lectures (72), biblioteca de residencia (103). Son features de residente.

## 3. Engagement

Distribución de estudiantes por nº de días activos (90 días):

| Días activos | Estudiantes |
|--------------|------------:|
| 8+ días      | **1.022**   |
| 4-7 días     | 294         |
| 2-3 días     | 211         |
| 1 día        | 150         |

**~61% de los estudiantes vuelven 8+ días.** No es uso de "usar y tirar": exploran de forma
recurrente durante la temporada de elección.

## 4. Estacionalidad

Estudiantes activos por mes (`$screen`, `userType='student'`):

| Mes        | Estudiantes activos |
|------------|--------------------:|
| 2026-03    | 5                   |
| 2026-04    | 1.144               |
| 2026-05    | 1.014               |

El pico coincide con la **adjudicación de plaza MIR** (examen en enero, elección en primavera).
Hoy (mayo 2026) estamos en plena temporada alta. El riesgo del modelo actual es que **fuera de
esta ventana de ~3 meses el estudiante no tiene motivo para abrir la app.**

## 5. El hueco detectado

La plataforma cubre **excelentemente el "después del MIR"**:

- ¿Con mi nota qué puedo coger? → simulador de nota (`MirSimulatorScreen`, `MirOrientationScreen`)
- ¿Qué hospital? → hospitales + detalle + reseñas
- ¿Qué especialidad encaja conmigo? → quiz de especialidad
- ¿Dónde vivo? → vivienda + roomies + grupos

Pero **no cubre nada del "antes del MIR"** — el año (o años) de preparación, que es donde el
estudiante pasa el 95% de su tiempo y donde se concentra toda la angustia. No hay banco de
preguntas, ni simulacros, ni planificador de estudio, ni seguimiento de progreso.

Abrir ese "antes" convierte la app de **herramienta de 3 meses** en **compañera de 12+ meses**,
y multiplica tanto el mercado direccionable como la retención fuera de temporada.

## 6. Acción de instrumentación pendiente

El evento `mir_calculate_clicked` solo tiene **8 disparos / 2 usuarios** pese a que 1.656
estudiantes usan `MirSimulatorScreen`. **El evento de cálculo no se está disparando
correctamente.** Conviene arreglarlo para poder medir la conversión real
"abre simulador → calcula nota", que será la métrica puente con las features de estudio.
