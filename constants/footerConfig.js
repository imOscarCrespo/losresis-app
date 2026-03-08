/**
 * Configuración del Footer v2
 * Mismo menú para estudiantes y residentes: Inicio, Especialidades, MIR, Vivienda, Perfil
 */

const PRIMARY = "#670CF5";

// Menú único para todos los usuarios (v2)
export const FOOTER_ITEMS = [
  {
    id: "inicio",
    icon: "home",
    label: "Inicio",
    screen: "inicio",
  },
  {
    id: "hospitales",
    icon: "medkit",
    label: "Especialidades",
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

/**
 * Obtiene la configuración del footer (mismo para estudiantes y residentes)
 */
export const getFooterConfig = (userProfile) => {
  return FOOTER_ITEMS;
};

// Compatibilidad: exportar con nombres antiguos por si se usan en otros archivos
export const STUDENT_FOOTER_ITEMS = FOOTER_ITEMS;
export const RESIDENT_FOOTER_ITEMS = FOOTER_ITEMS;
