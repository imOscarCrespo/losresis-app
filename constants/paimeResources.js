/**
 * Recursos de ayuda de la sección de Salud mental.
 *
 * - PAIME (Programa de Atención Integral al Médico Enfermo): NO es un programa nacional
 *   único, opera por comunidad autónoma vía los colegios médicos. Solo Cataluña y Madrid
 *   están verificados; el resto cae al mapa de colegios de CGCOM.
 *   ⚠️ Antes de lanzar hay que completar/verificar las CCAA restantes.
 * - Líneas de crisis: siempre visibles, accesibles para todo residente.
 *
 * El perfil solo guarda `city` (texto libre), no la CCAA, así que el usuario selecciona
 * su comunidad manualmente en la pantalla de recursos.
 */

/** Lista de CCAA para el selector manual. */
export const CCAA_LIST = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Baleares",
  "Canarias",
  "Cantabria",
  "Castilla-La Mancha",
  "Castilla y León",
  "Cataluña",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "La Rioja",
  "Madrid",
  "Murcia",
  "Navarra",
  "País Vasco",
  "Ceuta y Melilla",
];

/** Fallback cuando no hay PAIME verificado para la CCAA seleccionada. */
export const PAIME_DEFAULT = {
  name: "Tu colegio médico",
  description:
    "El PAIME se gestiona desde el colegio médico de tu provincia. Localiza el tuyo en el mapa de colegios.",
  web: "https://www.cgcom.es/colegios-mapa",
};

/** PAIME verificados por CCAA. Las no listadas usan PAIME_DEFAULT. */
export const PAIME_BY_CCAA = {
  Cataluña: {
    name: "Clínica Galatea (PAIME Cataluña)",
    description:
      "Atención confidencial y no punitiva para médicos. Tu información nunca llega a tu hospital o empleador.",
    phone: "932057267",
    email: "info@clinica-galatea.com",
    web: "https://www.clinica-galatea.com/es/bloc/medicos-enfermos/",
  },
  Madrid: {
    name: "ICOMEM (PAIME Madrid)",
    description:
      "Programa creado por médicos para médicos de la Comunidad de Madrid. Consultas confidenciales.",
    web: "https://www.icomem.es/seccion/SALUD-MENTAL-MEDICO/equipo-paime",
  },
};

export const getPaimeForCcaa = (ccaa) => PAIME_BY_CCAA[ccaa] || PAIME_DEFAULT;

/** Líneas de crisis 24h, siempre visibles. */
export const CRISIS_RESOURCES = [
  {
    name: "Línea de atención a la conducta suicida",
    description: "Ministerio de Sanidad · 24h, gratuita y confidencial.",
    phone: "024",
  },
  {
    name: "Teléfono de la Esperanza",
    description: "Apoyo en crisis emocional · 24h.",
    phone: "717003717",
  },
];
