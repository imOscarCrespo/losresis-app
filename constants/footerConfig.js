/**
 * Configuración del Footer v2
 * Estudiantes: Inicio, Hospitales, MIR, Chats, Perfil
 * Residentes: Inicio, Agenda, Chats, Perfil
 * Doctores: Inicio, Agenda, Chats, Reseñas, Perfil
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
    id: "grupos",
    icon: "chatbubbles",
    label: "Chats",
    screen: "grupos",
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
  if (userProfile?.is_resident) {
    return RESIDENT_FOOTER_ITEMS.filter((item) => item.id !== "reseñas");
  }

  if (userProfile?.is_doctor) {
    return RESIDENT_FOOTER_ITEMS;
  }

  return STUDENT_FOOTER_ITEMS;
};
