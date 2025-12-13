import { useState, useEffect, useCallback } from "react";
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  toggleArticleLike,
} from "../services/articlesService";
import { getCurrentUser } from "../services/authService";

const ITEMS_PER_PAGE = 20;

/**
 * Hook personalizado para manejar los artículos
 */
export const useArticles = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Obtener el ID del usuario actual
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const { success, user } = await getCurrentUser();
        if (success && user) {
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.error("Error loading current user:", error);
      }
    };
    loadCurrentUser();
  }, []);

  // Cargar artículos con paginación
  const fetchArticles = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);

        const page = reset ? 0 : currentPage;

        const { success, articles: articlesData, total, hasMore: hasMoreData, error: err } =
          await getArticles(page, ITEMS_PER_PAGE, currentUserId);

        if (success) {
          if (reset) {
            setArticles(articlesData || []);
            setCurrentPage(1);
          } else {
            setArticles((prev) => [...prev, ...(articlesData || [])]);
            setCurrentPage((prev) => prev + 1);
          }
          setTotalCount(total || 0);
          setHasMore(hasMoreData || false);
        } else {
          setError(err || "Error al cargar los artículos");
        }
      } catch (err) {
        setError(err.message || "Error inesperado al cargar los artículos");
      } finally {
        setLoading(false);
      }
    },
    [currentPage, currentUserId]
  );

  // Cargar más artículos
  const loadMoreArticles = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchArticles(false);
  }, [hasMore, loading, fetchArticles]);

  // Refrescar artículos (resetear a primera página)
  const refreshArticles = useCallback(async () => {
    await fetchArticles(true);
  }, [fetchArticles]);

  // Obtener un artículo por ID
  const fetchArticleById = useCallback(async (articleId) => {
    try {
      setLoading(true);
      setError(null);

      const { success, article, error: err } = await getArticleById(
        articleId,
        currentUserId
      );

      if (success) {
        return article;
      } else {
        setError(err || "Error al cargar el artículo");
        return null;
      }
    } catch (err) {
      setError(err.message || "Error inesperado al cargar el artículo");
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Crear un nuevo artículo
  const createNewArticle = useCallback(
    async (articleData) => {
      if (!currentUserId) {
        setError("Usuario no autenticado");
        return null;
      }

      try {
        setLoading(true);
        setError(null);

        const { success, article, error: err } = await createArticle({
          ...articleData,
          user_id: currentUserId,
        });

        if (success) {
          // Añadir el nuevo artículo al inicio de la lista
          setArticles((prev) => [article, ...prev]);
          setTotalCount((prev) => prev + 1);
          return article;
        } else {
          setError(err || "Error al crear el artículo");
          return null;
        }
      } catch (err) {
        setError(err.message || "Error inesperado al crear el artículo");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [currentUserId]
  );

  // Actualizar un artículo
  const updateExistingArticle = useCallback(async (articleId, articleData) => {
    if (!currentUserId) {
      setError("Usuario no autenticado");
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const { success, article, error: err } = await updateArticle(
        articleId,
        articleData
      );

      if (success) {
        // Actualizar el artículo en la lista
        setArticles((prev) =>
          prev.map((a) => (a.id === articleId ? article : a))
        );
        return article;
      } else {
        setError(err || "Error al actualizar el artículo");
        return null;
      }
    } catch (err) {
      setError(err.message || "Error inesperado al actualizar el artículo");
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Eliminar un artículo
  const removeArticle = useCallback(
    async (articleId) => {
      if (!currentUserId) {
        setError("Usuario no autenticado");
        return false;
      }

      try {
        setLoading(true);
        setError(null);

        const { success, error: err } = await deleteArticle(articleId);

        if (success) {
          // Eliminar el artículo de la lista
          setArticles((prev) => prev.filter((a) => a.id !== articleId));
          setTotalCount((prev) => Math.max(0, prev - 1));
          return true;
        } else {
          setError(err || "Error al eliminar el artículo");
          return false;
        }
      } catch (err) {
        setError(err.message || "Error inesperado al eliminar el artículo");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [currentUserId]
  );

  // Toggle like en un artículo
  const toggleLike = useCallback(
    async (articleId) => {
      if (!currentUserId) {
        setError("Usuario no autenticado");
        return false;
      }

      try {
        setError(null);

        const { success, liked, error: err } = await toggleArticleLike(
          articleId,
          currentUserId
        );

        if (success) {
          // Actualizar el estado del like en la lista
          setArticles((prev) =>
            prev.map((article) => {
              if (article.id === articleId) {
                return {
                  ...article,
                  is_liked: liked,
                  like_count: liked
                    ? (article.like_count || 0) + 1
                    : Math.max(0, (article.like_count || 0) - 1),
                };
              }
              return article;
            })
          );
          return liked;
        } else {
          setError(err || "Error al procesar el like");
          return false;
        }
      } catch (err) {
        setError(err.message || "Error inesperado al procesar el like");
        return false;
      }
    },
    [currentUserId]
  );

  return {
    articles,
    loading,
    error,
    hasMore,
    totalCount,
    currentUserId,
    fetchArticles,
    loadMoreArticles,
    refreshArticles,
    fetchArticleById,
    createArticle: createNewArticle,
    updateArticle: updateExistingArticle,
    deleteArticle: removeArticle,
    toggleLike,
  };
};

