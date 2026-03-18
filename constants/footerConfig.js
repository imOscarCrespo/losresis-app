/**
 * Configuración del Footer v2
 * Estudiantes: Inicio, Hospitales, MIR, Vivienda, Perfil
 * Residentes: Inicio, Agenda, Chats, Reseñas, Perfil
 */

export const STUDENT_FOOTER_ITEMS = [
  {
    id: "inicio",
    icon: "home",
    label: "Inicio",
    screen: "inicio",
  },
  {
    id: "hospitales",
    icon: "medkit",
    label: "Hospitales",
    screen: "hospitales",
  },
  {
    id: "nota-mir",
    icon: "bar-chart",
    label: "MIR",
    screen: "nota-mir",
  },
  {
    id: "vivienda",
    icon: "business",
    label: "Vivienda",
    screen: "vivienda",
  },
  {
    id: "usuario",
    icon: "person",
    label: "Perfil",
    screen: "usuario",
  },
];

export const RESIDENT_FOOTER_ITEMS = [
  {
    id: "inicio",
    icon: "home",
    label: "Inicio",
    screen: "inicio",
  },
  {
    id: "agenda",
    icon: "calendar",
    label: "Agenda",
    screen: "agenda",
  },
  {
    id: "grupos",
    icon: "chatbubbles",
    label: "Chats",
    screen: "grupos",
  },
  {
    id: "reseñas",
    icon: "document-text",
    label: "Reseñas",
    screen: "reseñas",
  },
  {
    id: "usuario",
    icon: "person",
    label: "Perfil",
    screen: "usuario",
  },
];

/**
 * Obtiene la configuración del footer según el tipo de usuario
 */
export const getFooterConfig = (userProfile) => {
  if (userProfile?.is_resident || userProfile?.is_doctor) {
    return RESIDENT_FOOTER_ITEMS;
  }

  return STUDENT_FOOTER_ITEMS;
};
