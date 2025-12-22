import { useState, useEffect, useMemo } from "react";
import {
  getCommunityUsers,
  getCityCoordinates,
  calculateOffsetCoordinates,
} from "../services/communityService";
import { getSpecialties } from "../services/hospitalService";

/**
 * Hook para obtener usuarios de la comunidad con coordenadas
 * @param {string} selectedCity - Ciudad seleccionada como filtro
 * @param {string} selectedSpecialty - Especialidad seleccionada como filtro
 * @returns {Object} Estado de usuarios, especialidades y carga
 */
export const useCommunityUsers = (selectedCity, selectedSpecialty) => {
  const [users, setUsers] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar usuarios basado en filtros
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener usuarios de la base de datos
        const {
          success,
          users: rawUsers,
          error: fetchError,
        } = await getCommunityUsers(selectedCity, selectedSpecialty);

        if (!success) {
          setError(fetchError);
          setUsers([]);
          return;
        }

        // Filtrar usuarios que tienen email Y especialidad
        const validUsers = rawUsers.filter((user) => {
          const hasEmail = user.work_email && user.work_email.trim() !== "";
          const hasSpecialty = user.speciality_id && user.specialities?.name;
          return hasEmail && hasSpecialty;
        });

        // Agrupar usuarios válidos por ciudad
        const usersByCity = validUsers.reduce((acc, user) => {
          const city = user.city;
          if (!acc[city]) {
            acc[city] = [];
          }
          acc[city].push(user);
          return acc;
        }, {});

        // Procesar cada ciudad y agregar coordenadas
        const usersWithCoordinates = [];

        for (const [city, cityUsers] of Object.entries(usersByCity)) {
          // Obtener coordenadas base de la ciudad
          const baseCoords = await getCityCoordinates(city);

          // Agregar coordenadas con offset para cada usuario
          cityUsers.forEach((user, index) => {
            const coords = calculateOffsetCoordinates(
              baseCoords.latitude,
              baseCoords.longitude,
              index,
              cityUsers.length
            );

            usersWithCoordinates.push({
              id: user.id,
              name: user.name,
              surname: user.surname,
              work_email: user.work_email,
              city: user.city,
              specialty_id: user.speciality_id,
              specialty_name: user.specialities?.name || "Sin especialidad",
              latitude: coords.latitude,
              longitude: coords.longitude,
            });
          });
        }

        setUsers(usersWithCoordinates);
      } catch (err) {
        console.error("Exception in useCommunityUsers:", err);
        setError("Error inesperado al cargar usuarios");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [selectedCity, selectedSpecialty]);

  // Cargar especialidades para el filtro
  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const { success, specialties: specialtiesData } =
          await getSpecialties();

        if (success) {
          setSpecialties(specialtiesData);
        }
      } catch (err) {
        console.error("Exception fetching specialties:", err);
      }
    };

    fetchSpecialties();
  }, []);

  // Calcular región del mapa basada en usuarios
  const mapRegion = useMemo(() => {
    if (users.length === 0) {
      // España por defecto
      return {
        latitude: 40.4168,
        longitude: -3.7038,
        latitudeDelta: 10,
        longitudeDelta: 10,
      };
    }

    if (users.length === 1) {
      return {
        latitude: users[0].latitude,
        longitude: users[0].longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }

    // Calcular bounds de todos los usuarios
    const lats = users.map((u) => u.latitude);
    const lngs = users.map((u) => u.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5; // Agregar padding
    const lngDelta = (maxLng - minLng) * 1.5;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.5),
      longitudeDelta: Math.max(lngDelta, 0.5),
    };
  }, [users]);

  return {
    users,
    specialties,
    loading,
    error,
    mapRegion,
  };
};
