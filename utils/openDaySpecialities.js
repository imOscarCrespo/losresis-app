/**
 * Especialidades que un postMIR quiere conocer en una jornada de puertas
 * abiertas. Lógica pura: la pantalla decide con esto qué pinta y el RPC
 * `save_hospital_open_day_registration` vuelve a comprobarlo en la BD.
 */

/**
 * Las especialidades del hospital, ordenadas por nombre. Solo las vinculadas al
 * hospital (catálogo hospital-especialidad), nunca todas las MIR.
 * @param {string} hospitalId
 * @param {Array<{hospital_id: string, speciality_id: string}>} hospitalSpecialityRows
 * @param {Array<{id: string, name: string}>} specialities
 * @returns {Array<{id: string, name: string}>}
 */
export const buildOpenDaySpecialityOptions = (
  hospitalId,
  hospitalSpecialityRows,
  specialities
) => {
  if (!hospitalId) return [];

  const namesById = new Map(
    (specialities || []).map((speciality) => [speciality.id, speciality.name])
  );
  const seen = new Set();

  return (hospitalSpecialityRows || [])
    .filter((row) => row?.hospital_id === hospitalId)
    .map((row) => row.speciality_id)
    .filter((id) => {
      if (!id || seen.has(id) || !namesById.get(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id) => ({ id, name: namesById.get(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
};

/**
 * La jornada solo tiene fecha, sin hora: el mismo día ya cuenta como empezada y
 * la selección de quien estaba inscrito pasa a solo lectura.
 * @param {string} eventDate YYYY-MM-DD
 * @param {string} todayIso YYYY-MM-DD
 * @returns {boolean}
 */
export const canEditOpenDaySpecialities = (eventDate, todayIso) =>
  Boolean(eventDate && todayIso) && eventDate > todayIso;

/**
 * Se puede confirmar si hay al menos una especialidad marcada, o si el hospital
 * no tiene ninguna (inscripción general, sin selección imposible de completar).
 * @param {string[]} selectedIds
 * @param {Array<{id: string}>} options
 * @returns {boolean}
 */
export const canConfirmOpenDaySpecialities = (selectedIds, options) => {
  if (!options?.length) return true;
  const available = new Set(options.map((option) => option.id));
  return (selectedIds || []).some((id) => available.has(id));
};

/**
 * Los nombres de la selección guardada, en el orden de las opciones. Ignora ids
 * que ya no están en el catálogo del hospital.
 * @param {string[]} selectedIds
 * @param {Array<{id: string, name: string}>} options
 * @returns {string[]}
 */
export const getSelectedSpecialityNames = (selectedIds, options) => {
  const selected = new Set(selectedIds || []);
  return (options || [])
    .filter((option) => selected.has(option.id))
    .map((option) => option.name);
};
