/**
 * Hook reutilizable para manejar filtros persistentes
 * Guarda automáticamente los filtros en AsyncStorage cuando cambian
 * y los restaura al montar el componente
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { saveFilters, loadFilters, clearFilters } from "../services/filterStorageService";

/**
 * Hook para manejar filtros persistentes
 * @param {string} filterType - Tipo de filtro (ej: 'hospitals', 'reviews')
 * @param {Object} defaultFilters - Objeto con los valores por defecto de los filtros
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.enableDebounce - Habilitar debounce para guardar (default: true)
 * @param {number} options.debounceMs - Milisegundos para el debounce (default: 500)
 * @returns {Object} Estado y funciones para manejar filtros persistentes
 */
export const usePersistedFilters = (filterType, defaultFilters = {}, options = {}) => {
  const {
    enableDebounce = true,
    debounceMs = 500,
  } = options;

  // Estado inicial con valores por defecto
  const [filters, setFilters] = useState(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ref para evitar guardar en el primer render
  const isInitialMount = useRef(true);
  // Ref para el timeout del debounce
  const debounceTimeoutRef = useRef(null);

  // Cargar filtros guardados al montar
  useEffect(() => {
    const loadPersistedFilters = async () => {
      try {
        const { success, filters: savedFilters } = await loadFilters(filterType);
        
        if (success && savedFilters) {
          // Combinar filtros guardados con los valores por defecto
          // Esto asegura que si se añaden nuevos filtros, tengan valores por defecto
          setFilters({ ...defaultFilters, ...savedFilters });
        } else {
          // Si no hay filtros guardados, usar los valores por defecto
          setFilters(defaultFilters);
        }
      } catch (error) {
        console.error(`Error al cargar filtros de ${filterType}:`, error);
        setFilters(defaultFilters);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersistedFilters();
  }, [filterType]); // Solo ejecutar cuando cambia el tipo de filtro

  // Guardar filtros cuando cambian (con debounce para optimizar)
  useEffect(() => {
    // No guardar en el primer render
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Limpiar timeout anterior si existe
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const savePersistedFilters = async () => {
      try {
        await saveFilters(filterType, filters);
      } catch (error) {
        console.error(`Error al guardar filtros de ${filterType}:`, error);
      }
    };

    if (enableDebounce) {
      debounceTimeoutRef.current = setTimeout(savePersistedFilters, debounceMs);
    } else {
      savePersistedFilters();
    }

    // Cleanup: limpiar timeout si el componente se desmonta
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [filters, filterType, enableDebounce, debounceMs]);

  // Función para actualizar un filtro específico
  const updateFilter = useCallback((key, value) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [key]: value,
    }));
  }, []);

  // Función para actualizar múltiples filtros a la vez
  const updateFilters = useCallback((updates) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      ...updates,
    }));
  }, []);

  // Función para limpiar todos los filtros
  const clearAllFilters = useCallback(async () => {
    setFilters(defaultFilters);
    await clearFilters(filterType);
  }, [filterType, defaultFilters]);

  // Función para obtener el valor de un filtro específico
  const getFilter = useCallback((key) => {
    return filters[key];
  }, [filters]);

  return {
    filters,
    isLoading,
    updateFilter,
    updateFilters,
    clearAllFilters,
    getFilter,
    setFilters, // Exponer setFilters directamente para casos avanzados
  };
};
