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
 * @param {string} userId
 * @returns {Promise<{id: string}|null>} null si su hospital no ha publicado una
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
      .select("id")
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

// Los ids se generan en cliente para poder insertar padres e hijos en dos lotes
// en vez de una petición por categoría. El proyecto no trae dependencia de uuid y
// crypto.randomUUID no está garantizado en Hermes, así que se compone a mano.
const newUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

/**
 * Cambia el libro de un año al que ha definido el tutor.
 *
 * DESTRUCTIVO: borra el libro que el residente tenga de ese año y con él la
 * actividad que hubiera registrado (libro_node cae por el ON DELETE CASCADE de
 * book_id, y con los nodos caen sus entradas y eventos). Quien llama tiene que
 * haberlo confirmado antes.
 *
 * Los años que el residente ya cerró no se tocan: solo se reemplaza el año que
 * se le pasa.
 *
 * @param {{userId: string, templateId: string, residencyYear: number}} params
 * @returns {Promise<number>} cuántos bloques se han creado
 */
export const switchLibroYearToTemplate = async ({
  userId,
  templateId,
  residencyYear,
}) => {
  if (!userId || !templateId || !residencyYear) {
    throw new Error("userId, templateId and residencyYear are required");
  }

  // 1. Los años anteriores que sigan activos pasan a archivados. Es lo que antes
  //    hacía el botón de "archivar y empezar nuevo año", y además es obligatorio:
  //    libro_book_one_active_per_user_section_idx no admite dos libros activos de
  //    la misma sección, así que sin archivar R1 no cabe el R2.
  const { error: archiveError } = await supabase
    .from("libro_book")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("residency_year", residencyYear);

  if (archiveError) {
    console.error("Error archiving previous libro years:", archiveError);
    throw archiveError;
  }

  // 2. Fuera el libro de ese año.
  const { error: deleteError } = await supabase
    .from("libro_book")
    .delete()
    .eq("user_id", userId)
    .eq("residency_year", residencyYear);

  if (deleteError) {
    console.error("Error deleting libro books before switch:", deleteError);
    throw deleteError;
  }

  // 2. Los bloques que la plantilla define en ese año.
  const { data: blocks, error: blocksError } = await supabase
    .from("libro_template_block")
    .select("section, position")
    .eq("template_id", templateId)
    .eq("residency_year", residencyYear)
    .order("position", { ascending: true });

  if (blocksError) {
    console.error("Error fetching template blocks for switch:", blocksError);
    throw blocksError;
  }

  // 3. Un libro por bloque, con la estructura de la plantilla clonada dentro.
  let created = 0;

  for (const block of blocks || []) {
    const { data: book, error: bookError } = await supabase
      .from("libro_book")
      .insert({
        user_id: userId,
        section: block.section,
        residency_year: residencyYear,
        status: "active",
      })
      .select("id")
      .single();

    if (bookError) {
      console.error("Error creating libro book on switch:", bookError);
      throw bookError;
    }

    const tree = await getLibroTemplateTree(templateId, block.section, residencyYear);
    const parentRows = [];
    const childRows = [];

    for (const [categoryIndex, category] of tree.entries()) {
      const categoryId = newUuid();

      parentRows.push({
        id: categoryId,
        user_id: userId,
        book_id: book.id,
        section: block.section,
        parent_node_id: null,
        name: category.name,
        goal: category.goal ?? null,
        icon_name: category.icon_name,
        color_token: category.color_token,
        tracking_mode: category.tracking_mode || "counter",
        position: category.position ?? categoryIndex,
      });

      for (const [childIndex, child] of (category.children || []).entries()) {
        childRows.push({
          id: newUuid(),
          user_id: userId,
          book_id: book.id,
          section: block.section,
          parent_node_id: categoryId,
          name: child.name,
          goal: child.goal ?? null,
          icon_name: child.icon_name,
          color_token: child.color_token,
          tracking_mode: child.tracking_mode || "counter",
          position: child.position ?? childIndex,
        });
      }
    }

    // Los padres antes que los hijos: parent_node_id tiene FK.
    if (parentRows.length) {
      const { error } = await supabase.from("libro_node").insert(parentRows);
      if (error) {
        console.error("Error cloning template categories:", error);
        throw error;
      }
    }

    if (childRows.length) {
      const { error } = await supabase.from("libro_node").insert(childRows);
      if (error) {
        console.error("Error cloning template activities:", error);
        throw error;
      }
    }

    // El sello va DESPUÉS de clonar, no antes: trigger_libro_node_structure_locked
    // rechaza escribir nodos en un libro que ya tenga template_id, así que
    // sellarlo primero abortaría su propia siembra.
    const { error: stampError } = await supabase
      .from("libro_book")
      .update({ template_id: templateId })
      .eq("id", book.id);

    if (stampError) {
      console.error("Error stamping libro book with template:", stampError);
      throw stampError;
    }

    created += 1;
  }

  return created;
};

export default {
  getPublishedLibroTemplateForUser,
  getLibroTemplateOutline,
  getLibroTemplateTree,
  switchLibroYearToTemplate,
};
