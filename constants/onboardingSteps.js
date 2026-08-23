/**
 * Definición declarativa del wizard de onboarding.
 *
 * Cada paso describe `kind` (qué renderizar) y, según el kind, los campos que
 * `OnboardingScreen` necesita para pintar el input y validar la respuesta.
 *
 * `getOnboardingSteps(userType)` devuelve la lista final ordenada según el tipo
 * elegido. Si todavía no hay tipo (paso 1), solo se conocen los pasos comunes
 * iniciales; el wizard recalcula la lista cuando el usuario elige tipo.
 */

const isFilled = (value) =>
  typeof value === "string" ? value.trim().length > 0 : Boolean(value);

const COMMON_PRE_TYPE_STEPS = [
  {
    id: "userType",
    kind: "userType",
    title: "¿En qué momento estás?",
    subtitle: "Personalizamos la app según tu situación.",
    field: "userType",
    footerHint: "Puedes cambiar esto más adelante",
    validate: (value) => (value ? null : "Selecciona un tipo de usuario"),
  },
];

const COMMON_BASIC_INFO_STEPS = [
  {
    id: "name",
    kind: "text",
    title: "¿Cuál es tu nombre?",
    subtitle: "Así sabremos cómo dirigirnos a ti.",
    field: "name",
    placeholder: "Tu nombre",
    autoCapitalize: "words",
    validate: (value) =>
      isFilled(value) ? null : "Introduce tu nombre para continuar",
  },
  {
    id: "surname",
    kind: "text",
    title: "¿Y tus apellidos?",
    subtitle: "Opcional, puedes saltarlo si lo prefieres.",
    field: "surname",
    placeholder: "Tus apellidos",
    autoCapitalize: "words",
    optional: true,
    validate: () => null,
  },
  {
    id: "city",
    kind: "city",
    title: "¿En qué ciudad estás?",
    subtitle: "Nos ayuda a mostrarte contenido relevante de tu zona.",
    field: "city",
    validate: (value) =>
      isFilled(value) ? null : "Selecciona tu ciudad para continuar",
  },
  {
    id: "phone",
    kind: "text",
    title: "Teléfono de contacto",
    subtitle: "Opcional. Lo usaremos solo si hace falta contactarte.",
    field: "phone",
    placeholder: "Teléfono",
    keyboardType: "phone-pad",
    optional: true,
    validate: () => null,
  },
];

const STUDENT_STEPS = [
  {
    id: "mirAcademy",
    kind: "mirAcademy",
    title: "¿En qué academia preparas el MIR?",
    subtitle: "Opcional. Sirve para precargar la nota proyectada.",
    field: "mir_academy",
    optional: true,
    validate: () => null,
  },
];

const RESIDENT_STEPS = [
  {
    id: "hospital",
    kind: "hospital",
    title: "¿En qué hospital trabajas?",
    subtitle: "Busca el hospital donde estás haciendo la residencia.",
    field: "hospital_id",
    validate: (value) => (value ? null : "Selecciona tu hospital"),
  },
  {
    id: "speciality",
    kind: "speciality",
    title: "¿Cuál es tu especialidad?",
    subtitle: "Selecciona la especialidad que estás cursando.",
    field: "speciality_id",
    validate: (value) => (value ? null : "Selecciona tu especialidad"),
  },
  {
    id: "residentYear",
    kind: "residentYear",
    title: "¿En qué año de residencia estás?",
    field: "resident_year",
    validate: (value) =>
      value ? null : "Selecciona tu año de residencia",
  },
  {
    id: "workEmail",
    kind: "text",
    title: "Tu email corporativo",
    subtitle:
      "Lo usamos para verificar que perteneces al hospital. Si aún no lo tienes, puedes saltarlo.",
    field: "work_email",
    placeholder: "nombre@hospital.es",
    keyboardType: "email-address",
    autoCapitalize: "none",
    optional: true,
    validate: () => null,
  },
];

const AVATAR_STEP = {
  id: "avatar",
  kind: "avatar",
  title: "Pon cara a tu perfil",
  subtitle:
    "Sube una foto para que tu perfil sea más reconocible en la comunidad. Es totalmente opcional.",
  field: "avatar_asset",
  optional: true,
  validate: () => null,
};

const DONE_STEP = {
  id: "done",
  kind: "done",
  title: "¡Todo listo!",
  subtitle:
    "Tu perfil está preparado. Vamos a abrir la app con todo configurado para ti.",
  cta: "Continuar",
};

const INSTAGRAM_STEP = {
  id: "instagram",
  kind: "instagram",
  title: "Síguenos en Instagram",
  subtitle:
    "Te contamos novedades, consejos y trucos para tu día a día en la residencia. No te pierdas nada.",
  cta: "Seguir en Instagram",
  optional: true,
  skipLabel: "Quizás más tarde",
};

// "host" ya no existe como tipo de usuario del onboarding: los anunciantes de
// vivienda se registran en el portal de propietarios (vivienda.losresis.com).
const STEPS_BY_TYPE = {
  student: STUDENT_STEPS,
  resident: RESIDENT_STEPS,
};

export const getOnboardingSteps = (userType) => {
  const typeSteps = STEPS_BY_TYPE[userType] || [];
  const wantsAvatar = userType === "student" || userType === "resident";
  return [
    ...COMMON_PRE_TYPE_STEPS,
    ...COMMON_BASIC_INFO_STEPS,
    ...typeSteps,
    ...(wantsAvatar ? [AVATAR_STEP] : []),
    DONE_STEP,
    INSTAGRAM_STEP,
  ];
};

