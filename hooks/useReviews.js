import { useState, useEffect, useCallback, useRef } from "react";
import { getReviewSummaries } from "../services/reviewsService";
import { debounce } from "../utils/debounce";

/**
 * Hook personalizado para manejar las reseñas
 */
export const useReviews = () => {
  const [reviewSummaries, setReviewSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [hospitalSearchTerm, setHospitalSearchTerm] = useState("");
  const [internalSearchTerm, setInternalSearchTerm] = useState("");

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

      const { success, summaries, error: err } = await getReviewSummaries(
        filters
      );

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
  const handleSearchChange = useCallback((value) => {
    setHospitalSearchTerm(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // Limpiar filtros
  const clearFilters = useCallback(() => {
    setSelectedHospital("");
    setSelectedSpecialty("");
    setHospitalSearchTerm("");
    setInternalSearchTerm("");
  }, []);

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

