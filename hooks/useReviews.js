import { useState, useEffect, useCallback, useRef } from "react";
import { getReviewSummaries } from "../services/reviewsService";
import { debounce } from "../utils/debounce";
import { usePersistedFilters } from "./usePersistedFilters";

/**
 * Hook personalizado para manejar las reseñas
 */
export const useReviews = () => {
  const [reviewSummaries, setReviewSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [internalSearchTerm, setInternalSearchTerm] = useState("");

  // Filtros persistentes
  const {
    filters,
    updateFilter,
    clearAllFilters: clearPersistedFilters,
  } = usePersistedFilters(
    "reviews",
    {
      selectedHospital: "",
      selectedSpecialty: "",
      hospitalSearchTerm: "",
    },
    { enableDebounce: true, debounceMs: 500 }
  );

  const selectedHospital = filters.selectedHospital;
  const selectedSpecialty = filters.selectedSpecialty;
  const hospitalSearchTerm = filters.hospitalSearchTerm;

  // Setters que actualizan los filtros persistentes
  const setSelectedHospital = useCallback(
    (value) => updateFilter("selectedHospital", value),
    [updateFilter]
  );
  const setSelectedSpecialty = useCallback(
    (value) => updateFilter("selectedSpecialty", value),
    [updateFilter]
  );
  const setHospitalSearchTerm = useCallback(
    (value) => updateFilter("hospitalSearchTerm", value),
    [updateFilter]
  );

  // Cargar resúmenes de reseñas
  const fetchReviewSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters = {
        hospitalId: selectedHospital || undefined,
        specialtyId: selectedSpecialty || undefined,
        hospitalSearchTerm: internalSearchTerm || undefined,
      };

      const {
        success,
        summaries,
        error: err,
      } = await getReviewSummaries(filters);

      if (success) {
        setReviewSummaries(summaries || []);
      } else {
        setError(err || "Error al cargar las reseñas");
        setReviewSummaries([]);
      }
    } catch (err) {
      setError(err.message || "Error inesperado al cargar las reseñas");
      setReviewSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHospital, selectedSpecialty, internalSearchTerm]);

  // Debounce para el término de búsqueda (300ms)
  const debouncedSearch = useRef(
    debounce((searchTerm) => {
      setInternalSearchTerm(searchTerm);
    }, 300)
  ).current;

  // Actualizar búsqueda con debounce
  const handleSearchChange = useCallback(
    (value) => {
      setHospitalSearchTerm(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Limpiar filtros
  const clearFilters = useCallback(async () => {
    await clearPersistedFilters();
    setInternalSearchTerm("");
  }, [clearPersistedFilters]);

  // Cargar reseñas cuando cambian los filtros
  useEffect(() => {
    fetchReviewSummaries();
  }, [fetchReviewSummaries]);

  return {
    reviewSummaries,
    loading,
    error,
    selectedHospital,
    setSelectedHospital,
    selectedSpecialty,
    setSelectedSpecialty,
    hospitalSearchTerm,
    setHospitalSearchTerm: handleSearchChange,
    clearFilters,
    refreshReviews: fetchReviewSummaries,
  };
};
