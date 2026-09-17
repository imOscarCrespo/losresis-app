/**
 * Resuelve con `fallback` si la promesa tarda más de `ms`.
 *
 * Ninguna llamada de red de Supabase lleva timeout propio, así que una petición
 * que se queda colgada (red móvil que acepta la conexión pero no responde)
 * dejaba el arranque bloqueado para siempre. Aquí no rechazamos nunca: el
 * arranque tiene que poder continuar con valores seguros por defecto.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {T} fallback - valor devuelto si se agota el tiempo
 * @returns {Promise<T>}
 */
export const withTimeout = (promise, ms, fallback) => {
  let timer = null;

  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

export default withTimeout;
