/**
 * Utilidades para trabajar con filtros
 */

/**
 * Contar cuántos filtros están activos
 * @param {Array} filters - Array de configuración de filtros
 * @returns {number} Número de filtros activos
 */
export const countActiveFilters = (filters = []) => {
  if (!Array.isArray(filters) || filters.length === 0) {
    return 0;
  }

  return filters.reduce((count, filter) => {
    // Para filtros de búsqueda, considerar activo si tiene texto
    if (filter.type === "search") {
      const value = filter.value || "";
      if (value.trim().length > 0) {
        return count + 1;
      }
    }

    // Para filtros de selección, considerar activo si tiene un valor seleccionado
    if (filter.type === "select") {
      const value = filter.value || "";
      if (value !== "" && value !== null && value !== undefined) {
        return count + 1;
      }
    }

    return count;
  }, 0);
};

/**
 * Obtener los nombres de los filtros activos
 * @param {Array} filters - Array de configuración de filtros
 * @returns {Array<string>} Array con los nombres de los filtros activos
 */
export const getActiveFilterNames = (filters = []) => {
  if (!Array.isArray(filters) || filters.length === 0) {
    return [];
  }

  return filters
    .filter((filter) => {
      if (filter.type === "search") {
        const value = filter.value || "";
        return value.trim().length > 0;
      }

      if (filter.type === "select") {
        const value = filter.value || "";
        return value !== "" && value !== null && value !== undefined;
      }

      return false;
    })
    .map((filter) => filter.label || filter.id || "");
};

const ACCENT_FALLBACK = {
  á: "a", à: "a", ä: "a", â: "a", ã: "a",
  é: "e", è: "e", ë: "e", ê: "e",
  í: "i", ì: "i", ï: "i", î: "i",
  ó: "o", ò: "o", ö: "o", ô: "o", õ: "o",
  ú: "u", ù: "u", ü: "u", û: "u",
  ñ: "n", ç: "c",
};

const stripAccents = (text) => {
  if (typeof text.normalize === "function") {
    try {
      return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (error) {
      // Algunos motores JS no implementan normalize; usamos la tabla manual.
    }
  }
  return text.replace(/[^\u0000-\u007f]/g, (char) => ACCENT_FALLBACK[char] || char);
};

/**
 * Normalizar texto para búsquedas: minúsculas, sin tildes y sin espacios sobrantes.
 * "Ginecología" y "GINECOLOGIA" producen el mismo resultado.
 * @param {*} value - Texto a normalizar
 * @returns {string} Texto normalizado
 */
export const normalizeSearchText = (value) =>
  stripAccents(String(value ?? "").toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
