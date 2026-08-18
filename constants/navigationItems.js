/**
 * Constantes de navegación - Items del menú de la aplicación
 * Basado en la estructura del sidebar web
 */

export const NAVIGATION_ITEMS = [
  {
    id: "mi-resena",
    name: "Mi Reseña",
    icon: "star",
    description: "Comparte tu experiencia como residente en tu hospital",
    doctorOnly: true,
    color: "#F59E0B", // Amber
    lightColor: "#FEF3C7",
  },
  {
    id: "hospitales",
    name: "Hospitales",
    icon: "business",
    description:
      "Explora los hospitales y encuentra el mejor para tu residencia médica",
    studentOnly: true,
    color: "#3B82F6", // Blue
    lightColor: "#DBEAFE",
  },
  {
    id: "preferencias",
    name: "Mis Preferencias",
    icon: "heart",
    description: "Gestiona tus preferencias de hospital y especialidad",
    studentOnly: true,
    color: "#EC4899", // Pink
    lightColor: "#FCE7F3",
  },
  {
    id: "agenda",
    name: "Agenda",
    icon: "calendar",
    description: "Gestiona guardias, estudio, cursos y eventos en un solo calendario",
    doctorOnly: true,
    color: "#8B5CF6", // Purple
    lightColor: "#F3E8FF",
  },
  {
    id: "nota-mir",
    name: "Simulador MIR",
    icon: "school",
    description:
      "Consulta las probabilidades de acceso a hospitales según tu nota del MIR",
    studentOnly: true,
    color: "#06B6D4", // Cyan
    lightColor: "#CFFAFE",
  },
  {
    id: "nota-proyectada",
    name: "Nota proyectada",
    icon: "trending-up",
    description:
      "Registra tus simulacros y estima tu número de orden final del MIR",
    studentOnly: true,
    color: "#670CF5",
    lightColor: "#EDE4FF",
  },
  {
    id: "study-photo",
    name: "Explícamelo fácil",
    icon: "camera",
    description:
      "Sube la foto de una pregunta que no entiendas y recibe una explicación sencilla",
    studentOnly: true,
    requiredFeatureKey: "photo_study_analysis",
    color: "#EC4899", // Pink
    lightColor: "#FCE7F3",
  },
  {
    id: "specialityQuiz",
    name: "Test de especialidad",
    icon: "help-buoy",
    description: "Descubre qué especialidad encaja contigo",
    studentOnly: true,
    color: "#A855F7", // Purple fun
    lightColor: "#F3E8FF",
  },
  {
    id: "libro-residente",
    name: "Libro de residente",
    icon: "book",
    description: "Registro de formación y actividades",
    doctorOnly: true,
    color: "#10B981", // Emerald
    lightColor: "#D1FAE5",
  },
  {
    id: "rotaciones-externas",
    name: "Rotaciones externas",
    icon: "globe",
    description: "Visualiza y gestiona tus rotaciones externas",
    doctorOnly: true,
    color: "#14B8A6", // Teal
    lightColor: "#CCFBF1",
  },
  {
    id: "recordatoriosServicio",
    name: "Recordatorios del servicio",
    icon: "checkmark-done",
    description: "Lo pendiente que tu servicio comparte contigo",
    residentOnly: true,
    color: "#0F5F8F",
    lightColor: "#E0F2FE",
  },
  {
    id: "residentPayouts",
    name: "Nóminas",
    icon: "cash",
    description: "Registra tu nómina mensual y revisa la evolución anual",
    residentOnly: true,
    color: "#670CF5",
    lightColor: "#F4EEFF",
  },
  {
    id: "mentalHealth",
    name: "Salud mental",
    icon: "heart-circle",
    description: "Cuida tu bienestar durante la residencia y accede a recursos de ayuda",
    residentOnly: true,
    color: "#0EA5E9", // Sky
    lightColor: "#E0F2FE",
  },
  {
    id: "grupos",
    name: "Chats",
    icon: "people",
    description:
      "Chatea con residentes y estudiantes de tu especialidad y ciudad",
    color: "#6D28D9", // Violet
    lightColor: "#EDE9FE",
  },
  {
    id: "notifications",
    name: "Notificaciones",
    icon: "notifications",
    description: "Consulta avisos de actividad, recordatorios y novedades",
    color: "#EF4444",
    lightColor: "#FEE2E2",
  },
  {
    id: "reseñas",
    name: "Reseñas",
    icon: "document-text",
    description:
      "Consulta las reseñas de residentes sobre hospitales y especialidades",
    color: "#F97316", // Orange
    lightColor: "#FFEDD5",
  },
  {
    id: "cursos",
    name: "Cursos",
    icon: "bookmark",
    description: "Explora cursos y formaciones disponibles en tu área",
    color: "#6366F1", // Indigo
    lightColor: "#E0E7FF",
    doctorOnly: true,
  },
  {
    id: "clinicalAssistant",
    name: "Chat clínico",
    icon: "medical",
    description: "Consulta al asistente clínico solo si tienes acceso habilitado",
    requiredFeatureKey: "clinical_assistant_chat",
    color: "#15803D",
    lightColor: "#DCFCE7",
  },
  {
    id: "articulos",
    name: "Artículos",
    icon: "newspaper",
    description: "Comparte y lee artículos de la comunidad",
    studentOnly: true,
    color: "#0EA5E9", // Sky
    lightColor: "#E0F2FE",
  },
  {
    id: "vivienda",
    name: "Vivienda",
    icon: "home",
    description: "Busca o publica anuncios de habitaciones para residentes",
    color: "#84CC16", // Lime
    lightColor: "#ECFCCB",
  },
  {
    id: "roomies",
    name: "Roomies",
    icon: "heart",
    description: "Haz match con futuros compañeros de piso según convivencia",
    color: "#670CF5",
    lightColor: "#F3E8FF",
  },
  {
    id: "ocio",
    name: "Ocio",
    icon: "wine",
    description: "Comparte actividades de ocio en tu ciudad",
    color: "#EC4899", // Pink
    lightColor: "#FCE7F3",
  },
  {
    id: "jobs",
    name: "Ofertas de trabajo",
    icon: "briefcase",
    description: "Explora ofertas de trabajo para residentes y adjuntos",
    doctorOnly: true,
    comingSoon: true,
    color: "#EF4444", // Red
    lightColor: "#FEE2E2",
  },
  // {
  //   id: "faq-reseñas",
  //   name: "Gestión interna",
  //   icon: "help-circle",
  //   description: "Gestiona las reseñas de usuarios sobre la aplicación",
  //   superAdminOnly: true,
  //   color: "#A855F7", // Purple
  //   lightColor: "#F3E8FF",
  // },
  {
    id: "contacto",
    name: "Contacto",
    icon: "mail",
    description: "Reporta errores o contacta con nosotros",
    color: "#64748B", // Slate
    lightColor: "#F1F5F9",
  },
  {
    id: "usuario",
    name: "Mi Perfil",
    icon: "person",
    description: "Configuración del usuario",
    color: "#8B5CF6", // Purple
    lightColor: "#F3E8FF",
  },
];

/**
 * Secciones que ya tienen implementación
 */
export const IMPLEMENTED_SECTIONS = [
  "hospitales",
  "nota-mir",
  "nota-proyectada",
  "specialityQuiz",
  "usuario",
  "mi-resena",
  "myPreferences",
  "comunity",
  "myReview",
  "residenceLibrary",
  "menu",
  "reseñas",
  "reviewDetail",
  "articulos",
  "vivienda",
  "roomies",
  "ocio",
  "leisureForum",
  "grupos",
  "groupChat",
  "agenda",
  "residentPayouts",
  "mentalHealth",
  "notifications",
  "clinicalAssistant",
  "study-photo",
];

/**
 * Verifica si una sección está implementada
 */
export const isSectionImplemented = (sectionId) => {
  return IMPLEMENTED_SECTIONS.includes(sectionId);
};
