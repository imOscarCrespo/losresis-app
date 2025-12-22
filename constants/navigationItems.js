/**
 * Constantes de navegación - Items del menú de la aplicación
 * Basado en la estructura del sidebar web
 */

export const NAVIGATION_ITEMS = [
  {
    id: "comunidad",
    name: "Comunidad",
    icon: "people",
    description: "Conecta con otros residentes de tu especialidad",
    doctorOnly: true,
    color: "#7C3AED", // Violet
    lightColor: "#EDE9FE",
  },
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
    id: "guardias",
    name: "Guardias",
    icon: "time",
    description: "Revisa tus próximas guardias programadas",
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
    name: "Cursos y formaciones",
    icon: "bookmark",
    description: "Explora cursos y formaciones disponibles en tu área",
    doctorOnly: true,
    color: "#6366F1", // Indigo
    lightColor: "#E0E7FF",
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
    id: "jobs",
    name: "Ofertas de trabajo",
    icon: "briefcase",
    description: "Explora ofertas de trabajo para residentes y adjuntos",
    doctorOnly: true,
    commingSoon: true,
    color: "#EF4444", // Red
    lightColor: "#FEE2E2",
  },
  {
    id: "faq-reseñas",
    name: "Gestión interna",
    icon: "help-circle",
    description: "Gestiona las reseñas de usuarios sobre la aplicación",
    superAdminOnly: true,
    color: "#A855F7", // Purple
    lightColor: "#F3E8FF",
  },
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
];

/**
 * Verifica si una sección está implementada
 */
export const isSectionImplemented = (sectionId) => {
  return IMPLEMENTED_SECTIONS.includes(sectionId);
};
