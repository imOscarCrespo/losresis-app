import { useState, useEffect, useMemo } from "react";
import { getCities } from "../services/communityService";

/**
 * Hook para obtener ciudades únicas de usuarios residentes
 * @returns {Object} Ciudades y estado de carga
 */
export const useCities = () => {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoading(true);
        setError(null);

        const { success, cities: citiesData, error: fetchError } = await getCities();

        if (success) {
          setCities(citiesData);
        } else {
          setError(fetchError);
          setCities([]);
        }
      } catch (err) {
        console.error("Exception fetching cities:", err);
        setError("Error al cargar ciudades");
        setCities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCities();
  }, []);

  // Convertir ciudades a formato de opciones para el selector
  const cityOptions = useMemo(() => {
    return cities.map((city) => ({
      id: city,
      name: city,
    }));
  }, [cities]);

  return {
    cities,
    cityOptions,
    loading,
    error,
  };
};

