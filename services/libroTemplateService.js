import { supabase } from "../config/supabase";

/**
 * Lectura de la plantilla del libro que define el tutor desde losresis-panel.
 *
 * El residente solo tiene libro (libro_book) de su año en curso y de los años que
 * ya cerró. Los años que su tutor tiene definidos por delante no son libros
 * suyos todavía: son el plan del hospital, y se leen de aquí en solo lectura.
 */

/**
 * La plantilla publicada que le corresponde al residente, por hospital y
 * especialidad.
 *
 * updated_at viaja porque es la señal de "el tutor ha tocado esto": el trigger
 * trigger_update_libro_template_updated_at lo bumpea en cada UPDATE de la fila, y
 * el panel hace upsert de la plantilla en cada guardado. La app lo usa para volver
 * a ofrecer Migrar a la plantilla cuando hay algo nuevo, sin insistir mientras no
 * lo haya.
 *
 * @param {string} userId
 * @returns {Promise<{id: string, updated_at: string}|null>} null si su hospital no
 *   ha publicado una
 */
export const getPublishedLibroTemplateForUser = async (userId) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    // hospital_id no viaja en userProfile, así que se resuelve aquí.
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("hospital_id, speciality_id")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("Error fetching user for libro template:", userError);
      throw userError;
    }

    if (!user?.hospital_id || !user?.speciality_id) {
      return null;
    }

    const { data, error } = await supabase
      .from("libro_template")
      .select("id, updated_at")
      .eq("hospital_id", user.hospital_id)
      .eq("speciality_id", user.speciality_id)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching published libro template:", error);
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error("Exception in getPublishedLibroTemplateForUser:", error);
    return null;
  }
};

/**
 * Qué años y qué bloques cubre la plantilla.
 *
 * Se lee de libro_template_block porque un bloque existe como fila aunque el
 * tutor todavía no le haya puesto contenido, así que es la lista fiel de lo que
 * el tutor ha montado.
 *
 * @param {string} templateId
 * @returns {Promise<Array<{section: string, residency_year: number}>>}
 */
export const getLibroTemplateOutline = async (templateId) => {
  try {
    if (!templateId) {
      return [];
    }

    const { data, error } = await supabase
      .from("libro_template_block")
      .select("section, residency_year, position")
      .eq("template_id", templateId)
      .order("residency_year", { ascending: true })
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching libro template outline:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Exception in getLibroTemplateOutline:", error);
    return [];
  }
};

/**
 * La estructura de un bloque de la plantilla en un año concreto, en el mismo
 * formato de árbol que devuelve useLibroSection para el libro del residente, para
 * que la pantalla la pinte con los mismos componentes.
 *
 * Los contadores van a cero: la plantilla es la estructura, no la actividad.
 *
 * @param {string} templateId
 * @param {string} section
 * @param {number} residencyYear
 * @returns {Promise<Array>} categorías con sus hijos en `children`
 */
export const getLibroTemplateTree = async (templateId, section, residencyYear) => {
  try {
    if (!templateId || !section || !residencyYear) {
      return [];
    }

    const { data, error } = await supabase
      .from("libro_template_node")
      .select(
        "id, parent_node_id, name, goal, icon_name, color_token, tracking_mode, position"
      )
      .eq("template_id", templateId)
      .eq("section", section)
      .eq("residency_year", residencyYear)
      .order("position", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching libro template tree:", error);
      throw error;
    }

    const nodes = data || [];
    const toDisplayNode = (node) => ({
      ...node,
      total_count: 0,
      entries: [],
      events: [],
    });

    const categories = nodes
      .filter((node) => !node.parent_node_id)
      .map((node) => ({ ...toDisplayNode(node), children: [] }));

    const byId = new Map(categories.map((category) => [category.id, category]));

    for (const node of nodes) {
      if (!node.parent_node_id) continue;
      byId.get(node.parent_node_id)?.children.push(toDisplayNode(node));
    }

    return categories;
  } catch (error) {
    console.error("Exception in getLibroTemplateTree:", error);
    return [];
  }
};

/**
 * Migrar a la plantilla: sustituye el Libro propio de un año por el Libro oficial.
 *
 * DESTRUCTIVO: borra el libro que el residente tenga de ese año y con él lo
 * registrado dentro. Quien llama tiene que haberlo confirmado antes, y la app le
 * ofrece descargarse el libro completo en PDF primero.
 *
 * Aquí no se clona nada. Antes esto montaba los nodos a mano desde el cliente, y
 * era la tercera copia de la lógica plantilla→libro: se dejaba comments_mode,
 * duration_amount, duration_unit, center y description, y no sellaba
 * template_node_id, lo que dejaba el libro invisible para
 * sync_libro_template_for_user. Ahora la siembra vive en un solo sitio, en
 * losresis-db (ver docs/adr/0006).
 *
 * Requiere la migración 20260820130000 de losresis-db.
 *
 * @param {{userId: string, residencyYear: number}} params
 * @returns {Promise<number>} cuántos apartados se han creado
 */
export const switchLibroYearToTemplate = async ({ userId, residencyYear }) => {
  if (!userId || !residencyYear) {
    throw new Error("userId and residencyYear are required");
  }

  const { data, error } = await supabase.rpc("migrate_libro_year_to_template", {
    p_user_id: userId,
    p_residency_year: residencyYear,
  });

  if (error) {
    console.error("Error migrating libro year to template:", error);
    throw error;
  }

  return data || 0;
};

/**
 * Reconcilia el libro del residente con la plantilla: altas, cambios y bajas sin
 * actividad detrás. Idempotente.
 *
 * Es lo que hace verdad que un cambio del tutor llegue a un libro ya sembrado. Se
 * llama al abrir el Libro y al tirar para refrescar, no en tiempo real: nadie mira
 * su libro mientras su tutor lo edita, y resembrar la estructura bajo los dedos de
 * quien está registrando algo sería peor que esperar.
 *
 * No lanza: que falle la reconciliación no debe impedir abrir el libro.
 *
 * @param {string} userId
 * @returns {Promise<boolean>} si se pudo reconciliar
 */
export const syncLibroTemplateForUser = async (userId) => {
  if (!userId) return false;

  const { error } = await supabase.rpc("sync_libro_template_for_user", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Error syncing libro template:", error);
    return false;
  }

  return true;
};

export default {
  getPublishedLibroTemplateForUser,
  getLibroTemplateOutline,
  getLibroTemplateTree,
  switchLibroYearToTemplate,
  syncLibroTemplateForUser,
};
