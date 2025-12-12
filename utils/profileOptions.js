/**
 * Utilidades para preparar opciones de selects del perfil
 */

/**
 * Prepara las opciones de hospitales para el SelectFilter
 * Filtra hospitales que empiezan con "Ud" y los formatea
 */
export const prepareHospitalOptions = (hospitals) => {
  if (!hospitals || hospitals.length === 0) return [];

  return hospitals
    .filter((hospital) => !hospital.name.toLowerCase().startsWith("ud"))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((hospital) => ({
      id: hospital.id,
      name: `${hospital.name} - ${hospital.city}`,
    }));
};

/**
 * Prepara las opciones de especialidades para el SelectFilter
 */
export const prepareSpecialtyOptions = (specialties) => {
  if (!specialties || specialties.length === 0) return [];

  return specialties
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((specialty) => ({
      id: specialty.id,
      name: specialty.name,
    }));
};

/**
 * Prepara las opciones de ciudades para el SelectFilter
 */
export const prepareCityOptions = (cities) => {
  if (!cities || cities.length === 0) return [];

  return cities
    .slice()
    .sort()
    .map((city) => ({
      id: city,
      name: city,
    }));
};



