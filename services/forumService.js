/**
 * Servicio para gestionar forums y threads
 */

import { supabase } from "../config/supabase";

/**
 * Obtener o crear un foro para una ciudad y tipo específico
 * @param {string} city - Nombre de la ciudad del usuario
 * @param {string} forumType - Tipo de foro: "Fiesta" o "Deporte"
 * @param {string} roleScope - Rol del usuario: "student", "resident" o "doctor"
 * @returns {Promise<{success: boolean, forum: object|null, error: string|null}>}
 */
export const getOrCreateForum = async (city, forumType, roleScope) => {
  try {
    if (!city || !forumType || !roleScope) {
      return {
        success: false,
        forum: null,
        error: "City, forum type and role scope are required",
      };
    }

    // Validar y sanitizar inputs
    const trimmedCity = city.trim();
    const trimmedForumType = forumType.trim();
    const trimmedRoleScope = roleScope.trim();

    if (!trimmedCity || !trimmedForumType || !trimmedRoleScope) {
      return {
        success: false,
        forum: null,
        error: "City, forum type and role scope are required",
      };
    }

    const forumName = `Ocio - ${trimmedCity} - ${trimmedForumType}`;
    const scope = "ocio"; // El scope siempre es "ocio"

    // Buscar si ya existe el foro
    const { data: existingForum, error: searchError } = await supabase
      .from("forum")
      .select("*")
      .eq("name", forumName)
      .eq("scope", scope)
      .eq("role_scope", roleScope)
      .eq("city", city)
      .maybeSingle();

    if (searchError && searchError.code !== "PGRST116") {
      // PGRST116 es "no rows returned", que es normal si no existe
      console.error("Error searching forum:", searchError);
      return {
        success: false,
        forum: null,
        error: searchError.message,
      };
    }

    // Si existe, retornarlo
    if (existingForum) {
      return {
        success: true,
        forum: existingForum,
        error: null,
      };
    }

    // Si no existe, crearlo
    const { data: newForum, error: createError } = await supabase
      .from("forum")
      .insert({
        name: forumName,
        scope: "ocio", // El scope siempre es "ocio"
        role_scope: trimmedRoleScope,
        city: trimmedCity,
        description: `Foro de ${trimmedForumType} para ${trimmedCity}`,
        speciality_id: null, // No hay especialidad para ocio
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating forum:", createError);
      return {
        success: false,
        forum: null,
        error: createError.message,
      };
    }

    return {
      success: true,
      forum: newForum,
      error: null,
    };
  } catch (error) {
    console.error("Exception in getOrCreateForum:", error);
    return {
      success: false,
      forum: null,
      error: error.message,
    };
  }
};

/**
 * Obtener threads de un foro con paginación
 * @param {string} forumId - ID del foro
 * @param {number} page - Página actual (0-indexed)
 * @param {number} limit - Límite de threads por página
 * @returns {Promise<{success: boolean, threads: array|null, total: number, hasMore: boolean, error: string|null}>}
 */
export const getForumThreads = async (forumId, page = 0, limit = 20) => {
  try {
    if (!forumId) {
      return {
        success: false,
        threads: null,
        total: 0,
        hasMore: false,
        error: "Forum ID is required",
      };
    }

    const from = page * limit;
    const to = from + limit - 1;

    // Obtener el total de threads
    const { count, error: countError } = await supabase
      .from("thread")
      .select("*", { count: "exact", head: true })
      .eq("forum_id", forumId);

    if (countError) {
      console.error("Error counting threads:", countError);
    }

    // Obtener los threads con información del usuario
    const { data, error } = await supabase
      .from("thread")
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .eq("forum_id", forumId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching threads:", error);
      return {
        success: false,
        threads: null,
        total: 0,
        hasMore: false,
        error: error.message,
      };
    }

    const threads = data || [];
    const total = count || 0;
    const hasMore = to < total - 1;

    return {
      success: true,
      threads,
      total,
      hasMore,
      error: null,
    };
  } catch (error) {
    console.error("Exception in getForumThreads:", error);
    return {
      success: false,
      threads: null,
      total: 0,
      hasMore: false,
      error: error.message,
    };
  }
};

/**
 * Crear un nuevo thread
 * @param {string} forumId - ID del foro
 * @param {string} userId - ID del usuario
 * @param {string} title - Título del thread
 * @param {string} body - Cuerpo del thread (opcional)
 * @returns {Promise<{success: boolean, thread: object|null, error: string|null}>}
 */
export const createThread = async (forumId, userId, title, body = null) => {
  try {
    if (!forumId || !userId || !title) {
      return {
        success: false,
        thread: null,
        error: "Forum ID, User ID and title are required",
      };
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return {
        success: false,
        thread: null,
        error: "El título no puede estar vacío",
      };
    }

    if (trimmedTitle.length > 200) {
      return {
        success: false,
        thread: null,
        error: "El título no puede exceder 200 caracteres",
      };
    }

    const trimmedBody = body?.trim() || null;
    if (trimmedBody && trimmedBody.length > 5000) {
      return {
        success: false,
        thread: null,
        error: "El cuerpo no puede exceder 5000 caracteres",
      };
    }

    const { data, error } = await supabase
      .from("thread")
      .insert({
        forum_id: forumId,
        user_id: userId,
        title: trimmedTitle,
        body: trimmedBody,
      })
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .single();

    if (error) {
      console.error("Error creating thread:", error);
      return {
        success: false,
        thread: null,
        error: error.message,
      };
    }

    return {
      success: true,
      thread: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception in createThread:", error);
    return {
      success: false,
      thread: null,
      error: error.message,
    };
  }
};

/**
 * Obtener un thread por ID
 * @param {string} threadId - ID del thread
 * @returns {Promise<{success: boolean, thread: object|null, error: string|null}>}
 */
export const getThreadById = async (threadId) => {
  try {
    if (!threadId) {
      return {
        success: false,
        thread: null,
        error: "Thread ID is required",
      };
    }

    const { data, error } = await supabase
      .from("thread")
      .select(
        `
        *,
        user:user_id(id, name, surname),
        forum:forum_id(id, name, scope, city)
      `
      )
      .eq("id", threadId)
      .single();

    if (error) {
      console.error("Error fetching thread:", error);
      return {
        success: false,
        thread: null,
        error: error.message,
      };
    }

    return {
      success: true,
      thread: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception in getThreadById:", error);
    return {
      success: false,
      thread: null,
      error: error.message,
    };
  }
};

/**
 * Obtener posts de un thread con estructura anidada
 * @param {string} threadId - ID del thread
 * @returns {Promise<{success: boolean, posts: array|null, error: string|null}>}
 */
export const getThreadPosts = async (threadId) => {
  try {
    if (!threadId) {
      return {
        success: false,
        posts: null,
        error: "Thread ID is required",
      };
    }

    // Obtener todos los posts del thread
    const { data, error } = await supabase
      .from("post")
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching posts:", error);
      return {
        success: false,
        posts: null,
        error: error.message,
      };
    }

    // Organizar posts en estructura jerárquica
    const postsMap = new Map();
    const rootPosts = [];

    // Primero, crear un mapa de todos los posts
    (data || []).forEach((post) => {
      postsMap.set(post.id, { ...post, replies: [] });
    });

    // Luego, organizar en jerarquía
    (data || []).forEach((post) => {
      const postWithReplies = postsMap.get(post.id);
      if (post.parent_post_id) {
        // Es una respuesta, agregarlo a su padre
        const parent = postsMap.get(post.parent_post_id);
        if (parent) {
          parent.replies.push(postWithReplies);
        }
      } else {
        // Es un post raíz
        rootPosts.push(postWithReplies);
      }
    });

    return {
      success: true,
      posts: rootPosts,
      error: null,
    };
  } catch (error) {
    console.error("Exception in getThreadPosts:", error);
    return {
      success: false,
      posts: null,
      error: error.message,
    };
  }
};

/**
 * Crear un nuevo post
 * @param {string} threadId - ID del thread
 * @param {string} userId - ID del usuario
 * @param {string} body - Cuerpo del post
 * @param {string} parentPostId - ID del post padre (opcional, para respuestas)
 * @returns {Promise<{success: boolean, post: object|null, error: string|null}>}
 */
export const createPost = async (
  threadId,
  userId,
  body,
  parentPostId = null
) => {
  try {
    if (!threadId || !userId || !body) {
      return {
        success: false,
        post: null,
        error: "Thread ID, User ID and body are required",
      };
    }

    const trimmedBody = body.trim();
    if (!trimmedBody) {
      return {
        success: false,
        post: null,
        error: "El mensaje no puede estar vacío",
      };
    }

    if (trimmedBody.length > 5000) {
      return {
        success: false,
        post: null,
        error: "El mensaje no puede exceder 5000 caracteres",
      };
    }

    const { data, error } = await supabase
      .from("post")
      .insert({
        thread_id: threadId,
        user_id: userId,
        body: trimmedBody,
        parent_post_id: parentPostId || null,
      })
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .single();

    if (error) {
      console.error("Error creating post:", error);
      return {
        success: false,
        post: null,
        error: error.message,
      };
    }

    return {
      success: true,
      post: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception in createPost:", error);
    return {
      success: false,
      post: null,
      error: error.message,
    };
  }
};

/**
 * Eliminar un thread
 * @param {string} threadId - ID del thread
 * @param {string} userId - ID del usuario (para verificar permisos)
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteThread = async (threadId, userId) => {
  try {
    if (!threadId || !userId) {
      return {
        success: false,
        error: "Thread ID and User ID are required",
      };
    }

    // Verificar que el thread pertenece al usuario
    const { data: thread, error: fetchError } = await supabase
      .from("thread")
      .select("user_id")
      .eq("id", threadId)
      .single();

    if (fetchError) {
      console.error("Error fetching thread:", fetchError);
      return {
        success: false,
        error: fetchError.message,
      };
    }

    if (!thread || !thread.user_id) {
      return {
        success: false,
        error: "Thread no encontrado",
      };
    }

    if (thread.user_id !== userId) {
      return {
        success: false,
        error: "No tienes permiso para eliminar este thread",
      };
    }

    // Eliminar el thread (los posts se eliminarán en cascada)
    const { error: deleteError } = await supabase
      .from("thread")
      .delete()
      .eq("id", threadId);

    if (deleteError) {
      console.error("Error deleting thread:", deleteError);
      return {
        success: false,
        error: deleteError.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Exception in deleteThread:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
