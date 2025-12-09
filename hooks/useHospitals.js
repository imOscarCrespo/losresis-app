import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getHospitals,
  getSpecialties,
  getHospitalIdsBySpecialty,
  getSpecialtyCounts,
} from "../services/hospitalService";

/**
 * Hook para obtener y filtrar hospitales
 * @returns {Object} Estado y funciones para manejar hospitales
 */
export const useHospitals = () => {
  const [hospitals, setHospitals] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const [loadingSpecialtyFilter, setLoadingSpecialtyFilter] = useState(false);
  const [hospitalIdsBySpecialty, setHospitalIdsBySpecialty] = useState([]);

  // Hospitales destacados para mostrar primero cuando no hay filtros
  const featuredHospitalNames = [
    "H. General Universitario Gregorio Marañón",
    "H. Universitario La Paz",
    "H. Clinic De Barcelona",
    "H. Universitari Vall D´Hebron",
    "H. Universitari I Politecnic La Fe",
    "H. Universitario Virgen Del Rocío",
  ];

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
    let filtered = hospitals;

    // Aplicar filtro de especialidad primero
    if (selectedSpecialty && hospitalIdsBySpecialty.length > 0) {
      filtered = filtered.filter((hospital) =>
        hospitalIdsBySpecialty.includes(hospital.id)
      );
    }

    // Aplicar otros filtros
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

    // Si no hay filtros, priorizar hospitales destacados
    if (!searchTerm && !selectedRegion && !selectedCity && !selectedSpecialty) {
      const featured = filtered.filter((h) =>
        featuredHospitalNames.includes(h.name)
      );
      const others = filtered.filter(
        (h) => !featuredHospitalNames.includes(h.name)
      );
      filtered = [...featured, ...others];
    }

    return filtered;
  }, [
    hospitals,
    searchTerm,
    selectedRegion,
    selectedCity,
    selectedSpecialty,
    hospitalIdsBySpecialty,
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
  const fetchHospitalIdsBySpecialty = useCallback(async (specialtyId) => {
    if (!specialtyId) {
      setHospitalIdsBySpecialty([]);
      return;
    }

    setLoadingSpecialtyFilter(true);
    try {
      const { success, hospitalIds, error } = await getHospitalIdsBySpecialty(
        specialtyId
      );
      if (success) {
        setHospitalIdsBySpecialty(hospitalIds);
      } else {
        console.error("Error loading hospitals by specialty:", error);
        setHospitalIdsBySpecialty([]);
      }
    } catch (error) {
      console.error("Exception fetching hospitals by specialty:", error);
      setHospitalIdsBySpecialty([]);
    } finally {
      setLoadingSpecialtyFilter(false);
    }
  }, []);

  // Limpiar todos los filtros
  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedRegion("");
    setSelectedCity("");
    setSelectedSpecialty("");
    setHospitalIdsBySpecialty([]);
  }, []);

  // Resetear ciudad cuando cambia la región
  useEffect(() => {
    if (selectedRegion) {
      setSelectedCity("");
    }
  }, [selectedRegion]);

  // Cargar hospitales y especialidades al montar
  useEffect(() => {
    fetchHospitals();
    fetchSpecialties();
  }, [fetchHospitals, fetchSpecialties]);

  // Cargar hospitales por especialidad cuando cambia la especialidad seleccionada
  useEffect(() => {
    if (selectedSpecialty) {
      fetchHospitalIdsBySpecialty(selectedSpecialty);
    } else {
      setHospitalIdsBySpecialty([]);
    }
  }, [selectedSpecialty, fetchHospitalIdsBySpecialty]);

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
