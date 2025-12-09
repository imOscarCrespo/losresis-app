/**
 * Ejemplo de servicio para mostrar cómo usar el connector de Supabase
 *
 * Este es un template que puedes copiar y modificar para crear nuevos servicios.
 * Cada servicio debería manejar las operaciones CRUD de una tabla específica.
 */

import { supabase, supabaseQuery } from "../config/supabase";

/**
 * Ejemplo: Obtener todos los registros de una tabla
 * @param {string} tableName - Nombre de la tabla
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getAll = async (tableName) => {
  return supabaseQuery(() => supabase.from(tableName).select("*"));
};

/**
 * Ejemplo: Obtener un registro por ID
 * @param {string} tableName - Nombre de la tabla
 * @param {string|number} id - ID del registro
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getById = async (tableName, id) => {
  return supabaseQuery(() =>
    supabase.from(tableName).select("*").eq("id", id).single()
  );
};

/**
 * Ejemplo: Crear un nuevo registro
 * @param {string} tableName - Nombre de la tabla
 * @param {object} data - Datos a insertar
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const create = async (tableName, data) => {
  return supabaseQuery(() =>
    supabase.from(tableName).insert(data).select().single()
  );
};

/**
 * Ejemplo: Actualizar un registro
 * @param {string} tableName - Nombre de la tabla
 * @param {string|number} id - ID del registro
 * @param {object} data - Datos a actualizar
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const update = async (tableName, id, data) => {
  return supabaseQuery(() =>
    supabase.from(tableName).update(data).eq("id", id).select().single()
  );
};

/**
 * Ejemplo: Eliminar un registro
 * @param {string} tableName - Nombre de la tabla
 * @param {string|number} id - ID del registro
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const remove = async (tableName, id) => {
  return supabaseQuery(() => supabase.from(tableName).delete().eq("id", id));
};

/**
 * Ejemplo: Query personalizado con filtros
 * @param {string} tableName - Nombre de la tabla
 * @param {object} filters - Objeto con filtros { column: value }
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export const getByFilters = async (tableName, filters) => {
  let query = supabase.from(tableName).select("*");

  // Aplicar filtros dinámicamente
  Object.keys(filters).forEach((key) => {
    query = query.eq(key, filters[key]);
  });

  return supabaseQuery(() => query);
};
