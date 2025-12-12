/**
 * Configuración del Footer según el tipo de usuario
 * Estilo Zara: 5 elementos (iconos + texto MENU en el medio)
 */

// Configuración para estudiantes
export const STUDENT_FOOTER_ITEMS = [
  {
    id: "hospitales",
    icon: "business", // edificio
    label: "Hospitales",
    screen: "hospitales", // pantalla existente
  },
  {
    id: "nota-mir",
    icon: "school", // simulador MIR
    label: "Simulador",
    screen: "nota-mir", // pantalla existente
  },
  {
    id: "menu",
    icon: null, // texto MENU
    label: "MENU",
    screen: "menu", // pantalla en blanco
  },
  {
    id: "preferencias",
    icon: "heart", // corazón
    label: "Preferencias",
    screen: "myPreferences", // pantalla en blanco
  },
  {
    id: "usuario",
    icon: "person", // perfil
    label: "Perfil",
    screen: "usuario", // pantalla existente
  },
];

// Configuración para residentes
export const RESIDENT_FOOTER_ITEMS = [
  {
    id: "comunidad",
    icon: "people", // comunidad
    label: "Comunidad",
    screen: "comunity", // pantalla en blanco
  },
  {
    id: "mi-resena",
    icon: "star", // estrella
    label: "Mi Reseña",
    screen: "myReview", // pantalla en blanco
  },
  {
    id: "menu",
    icon: null, // texto MENU
    label: "MENU",
    screen: "menu", // pantalla en blanco
  },
  {
    id: "libro-residente",
    icon: "book", // libro
    label: "Libro",
    screen: "residenceLibrary", // pantalla en blanco
  },
  {
    id: "usuario",
    icon: "person", // perfil
    label: "Perfil",
    screen: "usuario", // pantalla existente
  },
];

/**
 * Obtiene la configuración del footer según el perfil del usuario
 */
export const getFooterConfig = (userProfile) => {
  if (!userProfile) {
    // Por defecto, mostrar footer de estudiante si no hay perfil
    return STUDENT_FOOTER_ITEMS;
  }

  // Si es estudiante, mostrar footer de estudiante
  if (userProfile.is_student) {
    return STUDENT_FOOTER_ITEMS;
  }

  // Si es residente, mostrar footer de residente
  if (userProfile.is_resident) {
    return RESIDENT_FOOTER_ITEMS;
  }

  // Por defecto, footer de estudiante
  return STUDENT_FOOTER_ITEMS;
};

