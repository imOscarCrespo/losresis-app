/**
 * Utilidades para formatear fechas
 * Centraliza la lógica de formateo para mantener consistencia
 */

/**
 * Formatea una fecha a formato corto (ej: "23 nov")
 * @param {string|Date} dateString - Fecha en formato string o Date
 * @returns {string} Fecha formateada
 */
export const formatShortDate = (dateString) => {
  if (!dateString) return "";
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting short date:", error);
    return "";
  }
};

/**
 * Formatea una fecha a formato largo con hora (ej: "23 de noviembre de 2025, 23:47")
 * @param {string|Date} dateString - Fecha en formato string o Date
 * @returns {string} Fecha formateada
 */
export const formatLongDate = (dateString) => {
  if (!dateString) return "";
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Error formatting long date:", error);
    return "";
  }
};

/**
 * Formatea una fecha a formato de fecha simple (ej: "23/11/2025")
 * @param {string|Date} dateString - Fecha en formato string o Date
 * @returns {string} Fecha formateada
 */
export const formatSimpleDate = (dateString) => {
  if (!dateString) return "";
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (error) {
    console.error("Error formatting simple date:", error);
    return "";
  }
};

