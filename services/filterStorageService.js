/**
 * Servicio para persistir filtros en AsyncStorage
 * Permite guardar y restaurar filtros de diferentes pantallas
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// Prefijo para las claves de storage
const FILTERS_STORAGE_PREFIX = "@losresis:filters:";

/**
 * Obtener la clave de storage para un tipo de filtro
 * @param {string} filterType - Tipo de filtro (ej: 'hospitals', 'reviews')
 * @returns {string} Clave completa para AsyncStorage
 */
const getStorageKey = (filterType) => {
  return `${FILTERS_STORAGE_PREFIX}${filterType}`;
};

/**
 * Guardar filtros en AsyncStorage
 * @param {string} filterType - Tipo de filtro (ej: 'hospitals', 'reviews')
 * @param {Object} filters - Objeto con los filtros a guardar
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const saveFilters = async (filterType, filters) => {
  try {
    const key = getStorageKey(filterType);
    const filtersJson = JSON.stringify(filters);
    await AsyncStorage.setItem(key, filtersJson);
    return { success: true, error: null };
  } catch (error) {
    console.error(`Error al guardar filtros de ${filterType}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Cargar filtros desde AsyncStorage
 * @param {string} filterType - Tipo de filtro (ej: 'hospitals', 'reviews')
 * @returns {Promise<{success: boolean, filters: Object|null, error: string|null}>}
 */
export const loadFilters = async (filterType) => {
  try {
    const key = getStorageKey(filterType);
    const filtersJson = await AsyncStorage.getItem(key);
    
    if (!filtersJson) {
      return { success: true, filters: null, error: null };
    }

    const filters = JSON.parse(filtersJson);
    return { success: true, filters, error: null };
  } catch (error) {
    console.error(`Error al cargar filtros de ${filterType}:`, error);
    return { success: false, filters: null, error: error.message };
  }
};

/**
 * Limpiar filtros guardados para un tipo específico
 * @param {string} filterType - Tipo de filtro (ej: 'hospitals', 'reviews')
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const clearFilters = async (filterType) => {
  try {
    const key = getStorageKey(filterType);
    await AsyncStorage.removeItem(key);
    return { success: true, error: null };
  } catch (error) {
    console.error(`Error al limpiar filtros de ${filterType}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Limpiar todos los filtros guardados (útil para logout)
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const clearAllFilters = async () => {
  try {
    // Obtener todas las claves que empiezan con el prefijo
    const allKeys = await AsyncStorage.getAllKeys();
    const filterKeys = allKeys.filter((key) =>
      key.startsWith(FILTERS_STORAGE_PREFIX)
    );

    if (filterKeys.length > 0) {
      await AsyncStorage.multiRemove(filterKeys);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Error al limpiar todos los filtros:", error);
    return { success: false, error: error.message };
  }
};
