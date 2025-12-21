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
  },
  {
    id: "mi-resena",
    name: "Mi Reseña",
    icon: "star",
    description: "Comparte tu experiencia como residente en tu hospital",
    doctorOnly: true,
  },
  {
    id: "hospitales",
    name: "Hospitales",
    icon: "business",
    description:
      "Explora los hospitales y encuentra el mejor para tu residencia médica",
    studentOnly: true,
  },
  {
    id: "preferencias",
    name: "Mis Preferencias",
    icon: "heart",
    description: "Gestiona tus preferencias de hospital y especialidad",
    studentOnly: true,
  },
  {
    id: "guardias",
    name: "Guardias",
    icon: "time",
    description: "Revisa tus próximas guardias programadas",
    doctorOnly: true,
  },
  {
    id: "nota-mir",
    name: "Simulador MIR",
    icon: "school",
    description:
      "Consulta las probabilidades de acceso a hospitales según tu nota del MIR",
    studentOnly: true,
  },
  {
    id: "libro-residente",
    name: "Libro de residente",
    icon: "book",
    description: "Registro de formación y actividades",
    doctorOnly: true,
  },
  {
    id: "rotaciones-externas",
    name: "Rotaciones externas",
    icon: "globe",
    description: "Visualiza y gestiona tus rotaciones externas",
    doctorOnly: true,
  },
  {
    id: "reseñas",
    name: "Reseñas",
    icon: "document-text",
    description:
      "Consulta las reseñas de residentes sobre hospitales y especialidades",
  },
  {
    id: "cursos",
    name: "Cursos y formaciones",
    icon: "bookmark",
    description: "Explora cursos y formaciones disponibles en tu área",
    doctorOnly: true,
  },
  {
    id: "articulos",
    name: "Artículos",
    icon: "document-text",
    description: "Comparte y lee artículos de la comunidad",
    studentOnly: true,
  },
  {
    id: "vivienda",
    name: "Vivienda",
    icon: "home",
    description: "Busca o publica anuncios de habitaciones para residentes",
  },
  {
    id: "jobs",
    name: "Ofertas de trabajo",
    icon: "briefcase",
    description: "Explora ofertas de trabajo para residentes y adjuntos",
    doctorOnly: true,
    commingSoon: true,
  },
  {
    id: "faq-reseñas",
    name: "Gestión interna",
    icon: "help-circle",
    description: "Gestiona las reseñas de usuarios sobre la aplicación",
    superAdminOnly: true,
  },
  {
    id: "contacto",
    name: "Contacto",
    icon: "mail",
    description: "Reporta errores o contacta con nosotros",
  },
  {
    id: "usuario",
    name: "Mi Perfil",
    icon: "person",
    description: "Configuración del usuario",
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
