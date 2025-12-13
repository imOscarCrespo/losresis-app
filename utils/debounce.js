/**
 * Utilidad para debounce de funciones
 * Útil para optimizar búsquedas y evitar llamadas excesivas a APIs
 */

/**
 * Crea una función con debounce
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en milisegundos
 * @returns {Function} Función con debounce
 */
export const debounce = (func, wait) => {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
