import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getHospitals,
  getSpecialties,
  getHospitalRankingBySpecialty,
  getSpecialtyCounts,
} from "../services/hospitalService";
import { usePersistedFilters } from "./usePersistedFilters";

const compareByRankingMetadata = (a, b, rankingByHospitalId) => {
  const aRanking = rankingByHospitalId[a.id] || a;
  const bRanking = rankingByHospitalId[b.id] || b;
  const aRanked =
    aRanking &&
    (aRanking.final_score !== null ||
      aRanking.organic_score !== null ||
      aRanking.blended_rank !== null);
  const bRanked =
    bRanking &&
    (bRanking.final_score !== null ||
      bRanking.organic_score !== null ||
      bRanking.blended_rank !== null);

  if (aRanked && bRanked) {
    if ((bRanking.final_score ?? -1) !== (aRanking.final_score ?? -1)) {
      return (bRanking.final_score ?? -1) - (aRanking.final_score ?? -1);
    }
    if ((bRanking.organic_score ?? -1) !== (aRanking.organic_score ?? -1)) {
      return (bRanking.organic_score ?? -1) - (aRanking.organic_score ?? -1);
    }
    if (
      (bRanking.approved_review_count ?? 0) !==
      (aRanking.approved_review_count ?? 0)
    ) {
      return (
        (bRanking.approved_review_count ?? 0) -
        (aRanking.approved_review_count ?? 0)
      );
    }
  } else if (aRanked !== bRanked) {
    return aRanked ? -1 : 1;
  }

  return (a.catalog_order ?? 0) - (b.catalog_order ?? 0);
};

/**
 * Hook para obtener y filtrar hospitales
 * @returns {Object} Estado y funciones para manejar hospitales
 */
export const useHospitals = () => {
  const [hospitals, setHospitals] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const [loadingSpecialtyFilter, setLoadingSpecialtyFilter] = useState(false);
  const [specialtyRanking, setSpecialtyRanking] = useState({
    isLoaded: false,
    orderedHospitalIds: [],
    rankingByHospitalId: {},
  });

  // Filtros persistentes
  const {
    filters,
    updateFilter,
    clearAllFilters: clearPersistedFilters,
  } = usePersistedFilters(
    "hospitals",
    {
      searchTerm: "",
      selectedRegion: "",
      selectedCity: "",
      selectedSpecialty: "",
      sortMode: "ranking",
      sponsorshipOnly: false,
    },
    { enableDebounce: true, debounceMs: 500 }
  );

  const searchTerm = filters.searchTerm;
  const selectedRegion = filters.selectedRegion;
  const selectedCity = filters.selectedCity;
  const selectedSpecialty = filters.selectedSpecialty;
  const sortMode = filters.sortMode || "ranking";
  const sponsorshipOnly = Boolean(filters.sponsorshipOnly);

  // Setters que actualizan los filtros persistentes
  const setSearchTerm = useCallback(
    (value) => updateFilter("searchTerm", value),
    [updateFilter]
  );
  const setSelectedRegion = useCallback(
    (value) => updateFilter("selectedRegion", value),
    [updateFilter]
  );
  const setSelectedCity = useCallback(
    (value) => updateFilter("selectedCity", value),
    [updateFilter]
  );
  const setSelectedSpecialty = useCallback(
    (value) => updateFilter("selectedSpecialty", value),
    [updateFilter]
  );
  const setSortMode = useCallback(
    (value) => updateFilter("sortMode", value),
    [updateFilter]
  );
  const setSponsorshipOnly = useCallback(
    (value) => updateFilter("sponsorshipOnly", Boolean(value)),
    [updateFilter]
  );

  // Obtener regiones únicas
  const uniqueRegions = useMemo(
    () => [...new Set(hospitals.map((h) => h.region))].sort(),
    [hospitals]
  );

  // Obtener ciudades únicas
  const uniqueCities = useMemo(
    () => [...new Set(hospitals.map((h) => h.city))].sort(),
    [hospitals]
  );

  // Obtener ciudades disponibles basadas en la región seleccionada
  const availableCities = useMemo(() => {
    if (selectedRegion) {
      return hospitals
        .filter((h) => h.region === selectedRegion)
        .map((h) => h.city)
        .filter((city, index, self) => self.indexOf(city) === index)
        .sort();
    }
    return uniqueCities;
  }, [hospitals, selectedRegion, uniqueCities]);

  // Filtrar hospitales
  const filteredHospitals = useMemo(() => {
    const rankingByHospitalId = selectedSpecialty
      ? specialtyRanking.rankingByHospitalId
      : {};
    const orderedHospitalIds = selectedSpecialty
      ? specialtyRanking.orderedHospitalIds
      : [];
    const rankingIndex = new Map(
      orderedHospitalIds.map((hospitalId, index) => [hospitalId, index])
    );

    let filtered = hospitals.map((hospital) => {
      const scopedRanking = rankingByHospitalId[hospital.id];
      return scopedRanking ? { ...hospital, ...scopedRanking } : hospital;
    });

    // Aplicar filtro de especialidad primero
    if (selectedSpecialty && specialtyRanking.isLoaded) {
      filtered = filtered.filter((hospital) =>
        rankingIndex.has(hospital.id)
      );
    }

    filtered = filtered.filter((hospital) => {
      const matchesSearch = hospital.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesRegion =
        selectedRegion === "" || hospital.region === selectedRegion;
      const matchesCity =
        selectedCity === "" ||
        hospital.city.toLowerCase() === selectedCity.toLowerCase();

      return matchesSearch && matchesRegion && matchesCity;
    });

    if (sponsorshipOnly) {
      filtered = filtered.filter((hospital) => hospital.is_sponsored);
    }

    if (sortMode === "alphabetical") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    if (selectedSpecialty && specialtyRanking.isLoaded) {
      return [...filtered].sort((a, b) => {
        const rankingOrder = compareByRankingMetadata(
          a,
          b,
          rankingByHospitalId
        );

        if (rankingOrder !== 0) return rankingOrder;

        const aIndex = rankingIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = rankingIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;

        return (a.catalog_order ?? 0) - (b.catalog_order ?? 0);
      });
    }

    return [...filtered].sort((a, b) =>
      compareByRankingMetadata(a, b, {})
    );
  }, [
    hospitals,
    searchTerm,
    selectedRegion,
    selectedCity,
    selectedSpecialty,
    specialtyRanking,
    sortMode,
    sponsorshipOnly,
  ]);

  // Cargar hospitales
  const fetchHospitals = useCallback(async () => {
    setLoadingHospitals(true);
    try {
      const { success, hospitals: hospitalsData, error } = await getHospitals();
      if (success) {
        // Obtener conteos de especialidades
        const { success: countsSuccess, counts } = await getSpecialtyCounts();

        // Agregar specialtyCount a cada hospital
        const hospitalsWithCounts = hospitalsData.map((hospital) => ({
          ...hospital,
          specialtyCount: countsSuccess ? counts[hospital.id] || 0 : 0,
        }));

        setHospitals(hospitalsWithCounts);
      } else {
        console.error("Error loading hospitals:", error);
      }
    } catch (error) {
      console.error("Exception fetching hospitals:", error);
    } finally {
      setLoadingHospitals(false);
    }
  }, []);

  // Cargar especialidades
  const fetchSpecialties = useCallback(async () => {
    setLoadingSpecialties(true);
    try {
      const {
        success,
        specialties: specialtiesData,
        error,
      } = await getSpecialties();
      if (success) {
        setSpecialties(specialtiesData);
      } else {
        console.error("Error loading specialties:", error);
      }
    } catch (error) {
      console.error("Exception fetching specialties:", error);
    } finally {
      setLoadingSpecialties(false);
    }
  }, []);

  // Cargar IDs de hospitales por especialidad
  const fetchHospitalRankingBySpecialty = useCallback(async (specialtyId) => {
    if (!specialtyId) {
      setSpecialtyRanking({
        isLoaded: false,
        orderedHospitalIds: [],
        rankingByHospitalId: {},
      });
      return;
    }

    setLoadingSpecialtyFilter(true);
    try {
      const { success, orderedHospitalIds, rankingByHospitalId, error } =
        await getHospitalRankingBySpecialty(specialtyId);
      if (success) {
        setSpecialtyRanking({
          isLoaded: true,
          orderedHospitalIds,
          rankingByHospitalId,
        });
      } else {
        console.error("Error loading hospitals by specialty:", error);
        setSpecialtyRanking({
          isLoaded: true,
          orderedHospitalIds: [],
          rankingByHospitalId: {},
        });
      }
    } catch (error) {
      console.error("Exception fetching hospitals by specialty:", error);
      setSpecialtyRanking({
        isLoaded: true,
        orderedHospitalIds: [],
        rankingByHospitalId: {},
      });
    } finally {
      setLoadingSpecialtyFilter(false);
    }
  }, []);

  // Limpiar todos los filtros
  const clearFilters = useCallback(async () => {
    await clearPersistedFilters();
    setSpecialtyRanking({
      isLoaded: false,
      orderedHospitalIds: [],
      rankingByHospitalId: {},
    });
  }, [clearPersistedFilters]);

  // Resetear ciudad cuando cambia la región (solo si hay hospitales cargados)
  useEffect(() => {
    // Solo ejecutar si hay hospitales cargados y hay una región seleccionada
    if (hospitals.length === 0 || !selectedRegion) {
      return;
    }

    // Si hay una ciudad seleccionada, verificar que pertenece a la región actual
    if (selectedCity) {
      const citiesInRegion = hospitals
        .filter((h) => h.region === selectedRegion)
        .map((h) => h.city)
        .filter((city, index, self) => self.indexOf(city) === index);
      
      // Si la ciudad seleccionada no está en la región actual, resetearla
      if (!citiesInRegion.includes(selectedCity)) {
        setSelectedCity("");
      }
    }
  }, [selectedRegion, hospitals, selectedCity, setSelectedCity]);

  // Cargar hospitales y especialidades al montar
  useEffect(() => {
    fetchHospitals();
    fetchSpecialties();
  }, [fetchHospitals, fetchSpecialties]);

  // Cargar hospitales por especialidad cuando cambia la especialidad seleccionada
  useEffect(() => {
    if (selectedSpecialty) {
      fetchHospitalRankingBySpecialty(selectedSpecialty);
    } else {
      setSpecialtyRanking({
        isLoaded: false,
        orderedHospitalIds: [],
        rankingByHospitalId: {},
      });
    }
  }, [selectedSpecialty, fetchHospitalRankingBySpecialty]);

  return {
    hospitals,
    specialties,
    searchTerm,
    setSearchTerm,
    selectedRegion,
    setSelectedRegion,
    selectedCity,
    setSelectedCity,
    selectedSpecialty,
    setSelectedSpecialty,
    sortMode,
    setSortMode,
    sponsorshipOnly,
    setSponsorshipOnly,
    filteredHospitals,
    uniqueRegions,
    uniqueCities,
    availableCities,
    loadingHospitals,
    loadingSpecialties,
    loadingSpecialtyFilter,
    fetchHospitals,
    fetchSpecialties,
    clearFilters,
  };
};
