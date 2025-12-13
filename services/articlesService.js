/**
 * Servicio para gestionar los artículos
 */

import { supabase } from "../config/supabase";

const ITEMS_PER_PAGE = 20;

/**
 * Obtener artículos con paginación
 * @param {number} page - Página actual (0-indexed)
 * @param {number} limit - Límite de artículos por página
 * @param {string} userId - ID del usuario actual (opcional, para verificar likes)
 * @returns {Promise<{success: boolean, articles: array|null, total: number, hasMore: boolean, error: string|null}>}
 */
export const getArticles = async (page = 0, limit = ITEMS_PER_PAGE, userId = null) => {
  try {
    const from = page * limit;
    const to = from + limit - 1;

    // Primero obtener el total
    const { count, error: countError } = await supabase
      .from("article")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true);

    if (countError) {
      console.error("Error counting articles:", countError);
    }

    // Obtener los artículos
    const { data, error } = await supabase
      .from("article")
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching articles:", error);
      return {
        success: false,
        articles: null,
        total: 0,
        hasMore: false,
        error: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        articles: [],
        total: count || 0,
        hasMore: false,
        error: null,
      };
    }

    // Obtener los IDs de los artículos
    const articleIds = data.map((article) => article.id);

    // Preparar queries para obtener likes (en paralelo para mejor performance)
    const likesQuery = supabase
      .from("article_like")
      .select("article_id")
      .in("article_id", articleIds);

    const userLikesQuery = userId
      ? supabase
          .from("article_like")
          .select("article_id")
          .eq("user_id", userId)
          .in("article_id", articleIds)
      : Promise.resolve({ data: [], error: null });

    // Ejecutar queries en paralelo
    const [likesResult, userLikesResult] = await Promise.all([
      likesQuery,
      userLikesQuery,
    ]);

    // Manejar errores de likes sin fallar toda la operación
    if (likesResult.error) {
      console.error("Error fetching likes:", likesResult.error);
    }
    if (userLikesResult.error) {
      console.error("Error fetching user likes:", userLikesResult.error);
    }

    // Crear un Set para búsqueda O(1) en lugar de O(n) con includes
    const userLikesSet = new Set(
      (userLikesResult.data || []).map((like) => like.article_id)
    );

    // Contar likes por artículo usando reduce para mejor performance
    const likesCountMap = (likesResult.data || []).reduce((acc, like) => {
      acc[like.article_id] = (acc[like.article_id] || 0) + 1;
      return acc;
    }, {});

    // Formatear los artículos con información de likes
    const formattedArticles = data.map((article) => ({
      ...article,
      like_count: likesCountMap[article.id] || 0,
      is_liked: userId ? userLikesSet.has(article.id) : false,
    }));

    const total = count || 0;
    const hasMore = to < total - 1;

    return {
      success: true,
      articles: formattedArticles,
      total,
      hasMore,
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching articles:", error);
    return {
      success: false,
      articles: null,
      total: 0,
      hasMore: false,
      error: error.message,
    };
  }
};

/**
 * Obtener un artículo por ID
 * @param {string} articleId - ID del artículo
 * @param {string} userId - ID del usuario actual (para verificar likes)
 * @returns {Promise<{success: boolean, article: object|null, error: string|null}>}
 */
export const getArticleById = async (articleId, userId = null) => {
  try {
    if (!articleId) {
      return {
        success: false,
        article: null,
        error: "Article ID is required",
      };
    }

    const { data, error } = await supabase
      .from("article")
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .eq("id", articleId)
      .single();

    if (error) {
      console.error("Error fetching article:", error);
      return {
        success: false,
        article: null,
        error: error.message,
      };
    }

    // Obtener el conteo de likes
    const { count: likeCount } = await supabase
      .from("article_like")
      .select("*", { count: "exact", head: true })
      .eq("article_id", articleId);

    // Verificar si el usuario actual le dio like
    let isLiked = false;
    if (userId) {
      const { data: likeData } = await supabase
        .from("article_like")
        .select("id")
        .eq("article_id", articleId)
        .eq("user_id", userId)
        .single();

      isLiked = !!likeData;
    }

    const article = {
      ...data,
      like_count: likeCount || 0,
      is_liked: isLiked,
    };

    return {
      success: true,
      article,
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching article:", error);
    return {
      success: false,
      article: null,
      error: error.message,
    };
  }
};

/**
 * Crear un nuevo artículo
 * @param {object} articleData - Datos del artículo
 * @param {string} articleData.user_id - ID del usuario
 * @param {string} articleData.title - Título del artículo
 * @param {string} articleData.slug - Slug del artículo
 * @param {string} articleData.summary - Resumen del artículo
 * @param {string} articleData.body - Cuerpo del artículo (HTML)
 * @param {string} articleData.cover_image_url - URL de la imagen de portada
 * @param {boolean} articleData.is_published - Si está publicado
 * @returns {Promise<{success: boolean, article: object|null, error: string|null}>}
 */
export const createArticle = async (articleData) => {
  try {
    const {
      user_id,
      title,
      slug,
      summary,
      body,
      cover_image_url,
      is_published,
    } = articleData;

    if (!user_id || !title || !slug || !body) {
      return {
        success: false,
        article: null,
        error: "User ID, title, slug and body are required",
      };
    }

    const insertData = {
      user_id,
      title,
      slug,
      summary: summary || null,
      body,
      cover_image_url: cover_image_url || null,
      is_published: is_published || false,
      published_at: is_published ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from("article")
      .insert(insertData)
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .single();

    if (error) {
      console.error("Error creating article:", error);
      return {
        success: false,
        article: null,
        error: error.message,
      };
    }

    return {
      success: true,
      article: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception creating article:", error);
    return {
      success: false,
      article: null,
      error: error.message,
    };
  }
};

/**
 * Actualizar un artículo
 * @param {string} articleId - ID del artículo
 * @param {object} articleData - Datos actualizados del artículo
 * @returns {Promise<{success: boolean, article: object|null, error: string|null}>}
 */
export const updateArticle = async (articleId, articleData) => {
  try {
    if (!articleId) {
      return {
        success: false,
        article: null,
        error: "Article ID is required",
      };
    }

    const updateData = {
      updated_at: new Date().toISOString(),
      ...articleData,
    };

    // Si se publica por primera vez, establecer published_at
    if (articleData.is_published && !updateData.published_at) {
      const { data: existing } = await supabase
        .from("article")
        .select("published_at")
        .eq("id", articleId)
        .single();

      if (existing && !existing.published_at) {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from("article")
      .update(updateData)
      .eq("id", articleId)
      .select(
        `
        *,
        user:user_id(id, name, surname)
      `
      )
      .single();

    if (error) {
      console.error("Error updating article:", error);
      return {
        success: false,
        article: null,
        error: error.message,
      };
    }

    return {
      success: true,
      article: data,
      error: null,
    };
  } catch (error) {
    console.error("Exception updating article:", error);
    return {
      success: false,
      article: null,
      error: error.message,
    };
  }
};

/**
 * Eliminar un artículo
 * @param {string} articleId - ID del artículo
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteArticle = async (articleId) => {
  try {
    if (!articleId) {
      return {
        success: false,
        error: "Article ID is required",
      };
    }

    const { error } = await supabase.from("article").delete().eq("id", articleId);

    if (error) {
      console.error("Error deleting article:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Exception deleting article:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Toggle like en un artículo
 * @param {string} articleId - ID del artículo
 * @param {string} userId - ID del usuario
 * @returns {Promise<{success: boolean, liked: boolean, error: string|null}>}
 */
export const toggleArticleLike = async (articleId, userId) => {
  try {
    if (!articleId || !userId) {
      return {
        success: false,
        liked: false,
        error: "Article ID and User ID are required",
      };
    }

    // Verificar si ya existe el like
    const { data: existingLike } = await supabase
      .from("article_like")
      .select("id")
      .eq("article_id", articleId)
      .eq("user_id", userId)
      .single();

    if (existingLike) {
      // Eliminar like
      const { error } = await supabase
        .from("article_like")
        .delete()
        .eq("article_id", articleId)
        .eq("user_id", userId);

      if (error) {
        console.error("Error unliking article:", error);
        return {
          success: false,
          liked: false,
          error: error.message,
        };
      }

      return {
        success: true,
        liked: false,
        error: null,
      };
    } else {
      // Crear like
      const { error } = await supabase
        .from("article_like")
        .insert({
          article_id: articleId,
          user_id: userId,
        });

      if (error) {
        console.error("Error liking article:", error);
        return {
          success: false,
          liked: false,
          error: error.message,
        };
      }

      return {
        success: true,
        liked: true,
        error: null,
      };
    }
  } catch (error) {
    console.error("Exception toggling article like:", error);
    return {
      success: false,
      liked: false,
      error: error.message,
    };
  }
};

