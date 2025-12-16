import { useState, useEffect, useCallback } from "react";
import {
  getHousingAds,
  getHousingAdById,
  createHousingAd,
  updateHousingAd,
  deleteHousingAd,
  toggleHousingAdStatus,
} from "../services/housingService";
import { getCurrentUser } from "../services/authService";

const ITEMS_PER_PAGE = 20;

/**
 * Hook personalizado para manejar los anuncios de vivienda
 */
export const useHousingAds = () => {
  const [housingAds, setHousingAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  // Filtros
  const [city, setCity] = useState("");
  const [kind, setKind] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [showMyAds, setShowMyAds] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Cargar usuario actual
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const { success, user } = await getCurrentUser();
        if (success && user) {
          setCurrentUserId(user.id);
        }
      } catch (err) {
        console.error("Error loading current user:", err);
      }
    };
    loadCurrentUser();
  }, []);

  // Cargar anuncios con paginación y filtros
  const fetchHousingAds = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);

        const page = reset ? 0 : currentPage;

        const filters = {
          city: city || undefined,
          kind: kind || undefined,
          hospital_id: hospitalId || undefined,
          user_id: showMyAds && currentUserId ? currentUserId : undefined,
        };

        const {
          success,
          ads,
          total,
          hasMore: hasMoreData,
          error: err,
        } = await getHousingAds(page, ITEMS_PER_PAGE, filters);

        if (success) {
          if (reset) {
            setHousingAds(ads || []);
            setCurrentPage(1);
          } else {
            setHousingAds((prev) => [...prev, ...(ads || [])]);
            setCurrentPage((prev) => prev + 1);
          }
          setTotalCount(total || 0);
          setHasMore(hasMoreData || false);
        } else {
          setError(err || "Error al cargar los anuncios de vivienda");
        }
      } catch (err) {
        setError(err.message || "Error inesperado al cargar los anuncios");
      } finally {
        setLoading(false);
      }
    },
    [currentPage, city, kind, hospitalId, showMyAds, currentUserId]
  );

  // Cargar más anuncios
  const loadMoreHousingAds = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchHousingAds(false);
  }, [hasMore, loading, fetchHousingAds]);

  // Refrescar anuncios (resetear a primera página)
  const refreshHousingAds = useCallback(async () => {
    await fetchHousingAds(true);
  }, [fetchHousingAds]);

  // Limpiar filtros
  const clearFilters = useCallback(() => {
    setCity("");
    setKind("");
    setHospitalId("");
    setShowMyAds(false);
  }, []);

  // Obtener un anuncio por ID
  const fetchHousingAdById = useCallback(async (adId) => {
    try {
      setLoading(true);
      setError(null);

      const { success, ad, error: err } = await getHousingAdById(adId);

      if (success) {
        return ad;
      } else {
        setError(err || "Error al cargar el anuncio");
        return null;
      }
    } catch (err) {
      setError(err.message || "Error inesperado al cargar el anuncio");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear un nuevo anuncio
  const createNewHousingAd = useCallback(async (adData) => {
    try {
      setLoading(true);
      setError(null);

      const { success, ad, error: err } = await createHousingAd(adData);

      if (success) {
        // Añadir el nuevo anuncio al inicio de la lista
        setHousingAds((prev) => [ad, ...prev]);
        setTotalCount((prev) => prev + 1);
        return ad;
      } else {
        setError(err || "Error al crear el anuncio");
        return null;
      }
    } catch (err) {
      setError(err.message || "Error inesperado al crear el anuncio");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Actualizar un anuncio
  const updateExistingHousingAd = useCallback(async (adId, adData) => {
    try {
      setLoading(true);
      setError(null);

      const { success, ad, error: err } = await updateHousingAd(adId, adData);

      if (success) {
        // Actualizar el anuncio en la lista
        setHousingAds((prev) => prev.map((a) => (a.id === adId ? ad : a)));
        return ad;
      } else {
        setError(err || "Error al actualizar el anuncio");
        return null;
      }
    } catch (err) {
      setError(err.message || "Error inesperado al actualizar el anuncio");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Eliminar un anuncio
  const removeHousingAd = useCallback(async (adId) => {
    try {
      setLoading(true);
      setError(null);

      const { success, error: err } = await deleteHousingAd(adId);

      if (success) {
        // Eliminar el anuncio de la lista
        setHousingAds((prev) => prev.filter((a) => a.id !== adId));
        setTotalCount((prev) => Math.max(0, prev - 1));
        return true;
      } else {
        setError(err || "Error al eliminar el anuncio");
        return false;
      }
    } catch (err) {
      setError(err.message || "Error inesperado al eliminar el anuncio");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle estado activo/inactivo
  const toggleStatus = useCallback(async (adId, isActive) => {
    try {
      setError(null);

      const { success, error: err } = await toggleHousingAdStatus(
        adId,
        isActive
      );

      if (success) {
        // Actualizar el estado en la lista
        setHousingAds((prev) =>
          prev.map((ad) =>
            ad.id === adId ? { ...ad, is_active: isActive } : ad
          )
        );
        return true;
      } else {
        setError(err || "Error al cambiar el estado del anuncio");
        return false;
      }
    } catch (err) {
      setError(err.message || "Error inesperado al cambiar el estado");
      return false;
    }
  }, []);

  // Auto-fetch cuando cambian los filtros
  useEffect(() => {
    fetchHousingAds(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, kind, hospitalId, showMyAds]);

  return {
    // Data
    housingAds,
    loading,
    error,
    hasMore,
    totalCount,

    // Filters
    city,
    setCity,
    kind,
    setKind,
    hospitalId,
    setHospitalId,
    showMyAds,
    setShowMyAds,
    clearFilters,
    currentUserId,

    // Actions
    fetchHousingAds,
    loadMoreHousingAds,
    refreshHousingAds,
    fetchHousingAdById,
    createHousingAd: createNewHousingAd,
    updateHousingAd: updateExistingHousingAd,
    deleteHousingAd: removeHousingAd,
    toggleAdStatus: toggleStatus,
  };
};
