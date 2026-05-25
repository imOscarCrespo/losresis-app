import { supabase } from "../config/supabase";
import { getCurrentUser } from "./authService";
import { fetchHospitalsCache } from "./hospitalService";
import {
  getHospitalSpecialityCatalog,
  getHospitalSpecialityGradesCatalog,
  getSpecialityByIdFromCatalog,
} from "./staticCatalogService";

/**
 * Consultar hospital_speciality_grades en batches para evitar límites de Supabase
 * @param {Array<number>} hospitalIds - Array de IDs de hospitales
 * @param {string} specialtyId - ID de la especialidad
 * @returns {Promise<Array>} Array con todos los registros obtenidos
 */
/**
 * Obtener info_note de hospital_specialities por hospital y especialidad
 */
const fetchInfoNotes = async (hospitalIds, specialtyId) => {
  const hospitalIdSet = new Set(hospitalIds);
  const map = {};
  getHospitalSpecialityCatalog().forEach((row) => {
    if (
      row.speciality_id !== specialtyId ||
      !hospitalIdSet.has(row.hospital_id)
    ) {
      return;
    }
    if (row.info_note != null && row.info_note !== "") map[row.hospital_id] = row.info_note;
  });
  return map;
};

const fetchGradesInBatches = async (hospitalIds, specialtyId) => {
  const hospitalIdSet = new Set(hospitalIds);
  return getHospitalSpecialityGradesCatalog()
    .filter(
      (row) =>
        row.speciality_id === specialtyId && hospitalIdSet.has(row.hospital_id)
    )
    .sort((a, b) => {
      const hospitalOrder = String(a.hospital_id || "").localeCompare(
        String(b.hospital_id || "")
      );
      if (hospitalOrder !== 0) return hospitalOrder;
      return Number(a.year || 0) - Number(b.year || 0);
    });
};

/**
 * Calcular la probabilidad de un hospital (para una especialidad) a partir de sus
 * registros históricos de notas de corte. Lógica compartida por el simulador MIR
 * (calculateMIRProbabilities) y el Orientador MIR (calculateMIROrientation) para
 * garantizar resultados consistentes entre ambas pantallas.
 *
 * @param {Array} hospitalGrades - Registros { year, slots, grades|grade|rate } de un hospital/especialidad
 * @param {number} mirScore - Posición del usuario en el MIR
 * @param {number|null} targetSlotsYear - Año para el cómputo de plazas vigentes.
 *   Si no se pasa, se usa el año natural actual (mantiene compatibilidad).
 * @returns {{ probability: string, grades: Array<{year:string, grade:number|null}>, yearsUsed: number, currentYearSlots: number|null }}
 */
export const computeHospitalProbability = (
  hospitalGrades,
  mirScore,
  targetSlotsYear = null
) => {
  const grades = [];

  (hospitalGrades || []).forEach((record) => {
    const year = parseInt(record.year);
    if (isNaN(year)) return;

    // Get the grade - use highest if array
    let score = record.rate || record.grade || record.grades;

    if (Array.isArray(score) && score.length > 0) {
      score = Math.max(...score);
    } else if (score !== null && score !== undefined) {
      score = typeof score === "string" ? parseFloat(score) : score;
    }

    if (!isNaN(score) && score !== null && score !== undefined) {
      grades.push({ year: year.toString(), grade: score });
    } else {
      grades.push({ year: year.toString(), grade: null });
    }
  });

  // Sort by year (most recent first)
  grades.sort((a, b) => parseInt(b.year) - parseInt(a.year));

  // Calculate probability
  const validGrades = grades.filter(
    (g) => g.grade !== null && g.grade !== undefined && typeof g.grade === "number"
  );

  let probability = "NA";

  if (validGrades.length > 0) {
    const aboveGradeCount = validGrades.filter(
      (g) => g.grade && mirScore <= g.grade
    ).length;
    const probabilityPercentage = Math.round(
      (aboveGradeCount / validGrades.length) * 100
    );
    probability = `${probabilityPercentage}%`;
  }

  // Get slots for the target year (derivado del catálogo, no del calendario)
  const slotsYear =
    targetSlotsYear != null ? targetSlotsYear : new Date().getFullYear();
  const currentYearRecord = (hospitalGrades || []).find(
    (record) => parseInt(record.year) === slotsYear
  );
  const currentYearSlots =
    currentYearRecord?.slots !== null && currentYearRecord?.slots !== undefined
      ? currentYearRecord.slots
      : null;

  return { probability, grades, yearsUsed: validGrades.length, currentYearSlots };
};

/**
 * Comparador para ordenar resultados por probabilidad (mayor primero); empates "NA"
 * o sin probabilidad caen al final, desempatando por nombre.
 */
const compareByProbability = (a, b, getName) => {
  if (a.probability === "NA" && b.probability === "NA") {
    return getName(a).localeCompare(getName(b));
  }
  if (a.probability === "NA") return 1;
  if (b.probability === "NA") return -1;

  const probA = parseInt(a.probability.replace("%", ""));
  const probB = parseInt(b.probability.replace("%", ""));
  return probB - probA;
};

/**
 * Obtener estadísticas de uso del simulador MIR para un usuario
 * @param {string} userId
 * @returns {Promise<{success: boolean, count: number, lastGrade: number|null}>}
 */
export const getMirSimulatorStats = async (userId) => {
  if (!userId) return { success: false, count: 0, lastGrade: null };

  const { data, error } = await supabase
    .from("mir_simulator_searches")
    .select("grade, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Error fetching MIR simulator stats:", error);
    return { success: false, count: 0, lastGrade: null };
  }

  return {
    success: true,
    count: data?.length ?? 0,
    lastGrade: data?.[0]?.grade ?? null,
  };
};

/**
 * Calcular probabilidades MIR para hospitales
 * @param {number} mirScore - Posición del usuario en el MIR
 * @param {string} specialtyId - ID de la especialidad
 * @param {string} region - Región/comunidad autónoma (opcional)
 * @returns {Promise<{success: boolean, results: array, error: string|null}>}
 */
export const calculateMIRProbabilities = async (
  mirScore,
  specialtyId,
  region = null
) => {
  try {
    if (!mirScore || !specialtyId) {
      return {
        success: false,
        results: [],
        error: "MIR score and specialty are required",
      };
    }

    // Normalizar región: convertir strings vacíos a null
    const normalizedRegion = 
      region && typeof region === "string" && region.trim() !== "" 
        ? region.trim() 
        : null;

    console.log("🔍 Calculating MIR probabilities:", {
      score: mirScore,
      specialty: specialtyId,
      region: normalizedRegion || "all",
    });

    // Log search to Supabase if user is logged in
    try {
      const { success, user } = await getCurrentUser();
      if (success && user?.id) {
        await supabase.from("mir_simulator_searches").insert({
          user_id: user.id,
          grade: mirScore,
          speciality_id: specialtyId,
        });
      }
    } catch (logError) {
      console.error("Error logging MIR search:", logError);
      // Continue even if logging fails
    }

    // Step 1: Get hospitals from JSON cache (persisted client-side cache)
    const allHospitalsData = await fetchHospitalsCache();

    if (!allHospitalsData) {
      return {
        success: false,
        results: [],
        error: "No hospitals data received",
      };
    }

    // Step 2: Filter hospitals by region if specified
    const filteredHospitals = normalizedRegion
      ? allHospitalsData.filter((hospital) => hospital.region === normalizedRegion)
      : allHospitalsData;

    if (filteredHospitals.length === 0) {
      return {
        success: true,
        results: [],
        error: null,
      };
    }

    // Step 3: Get hospital IDs
    const hospitalIds = filteredHospitals.map((h) => h.id).filter((id) => id);

    if (hospitalIds.length === 0) {
      return {
        success: true,
        results: [],
        error: null,
      };
    }

    // Step 4: Get detailed grades and info_notes in parallel
    let detailedGradesData;
    let infoNotesMap = {};

    try {
      [detailedGradesData, infoNotesMap] = await Promise.all([
        fetchGradesInBatches(hospitalIds, specialtyId),
        fetchInfoNotes(hospitalIds, specialtyId),
      ]);
    } catch (error) {
      throw new Error(`Error fetching grades: ${error.message}`);
    }

    if (!detailedGradesData || detailedGradesData.length === 0) {
      return {
        success: true,
        results: [],
        error: null,
      };
    }

    // Step 5: Group grades by hospital
    const hospitalGradesMap = {};

    detailedGradesData.forEach((record) => {
      if (!hospitalGradesMap[record.hospital_id]) {
        hospitalGradesMap[record.hospital_id] = [];
      }
      hospitalGradesMap[record.hospital_id].push(record);
    });

    // Año de la última convocatoria publicada para esta especialidad. Se usa como
    // referencia de plazas vigentes en lugar del año del calendario.
    const slotsYear = getLatestPublishedYear(detailedGradesData);

    // Step 6: Calculate results for each hospital
    const results = filteredHospitals
      .map((hospital) => {
        const hospitalGrades = hospitalGradesMap[hospital.id];

        if (!hospitalGrades || hospitalGrades.length === 0) {
          return null; // Hospital doesn't offer this specialty
        }

        const { probability, grades, yearsUsed, currentYearSlots } =
          computeHospitalProbability(hospitalGrades, mirScore, slotsYear);

        return {
          hospital: hospital,
          probability,
          grades,
          yearsUsed,
          currentYearSlots,
          info_note: infoNotesMap[hospital.id] || null,
        };
      })
      .filter((result) => result !== null)
      .sort((a, b) => compareByProbability(a, b, (r) => r.hospital.name));

    const gradeYearsRange = computeGradeYearsRange(results);

    console.log(`✅ MIR results calculated: ${results.length} hospitals`);

    return {
      success: true,
      results,
      slotsYear,
      gradeYearsRange,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error calculating MIR probabilities:", error);
    return {
      success: false,
      results: [],
      error: error.message,
    };
  }
};

// Umbral de probabilidad a partir del cual consideramos un hospital "accesible"
const ACCESSIBLE_THRESHOLD = 50;

// Mínimo de años con nota de corte válida para considerar un hospital "evaluable".
// Por debajo de este umbral la muestra es demasiado pequeña para una probabilidad
// fiable (1 año => 0% o 100% según un único dato), así que se excluye del numerador
// y del denominador de "X de Y hospitales accesibles".
const MIN_EVALUABLE_YEARS = 3;

const probabilityToNumber = (probability) =>
  probability === "NA" ? -1 : parseInt(probability.replace("%", ""), 10);

/**
 * Devuelve el año más reciente con datos publicados para una especialidad. Se usa
 * como "año de plazas vigentes" en lugar del año natural, porque el año del
 * calendario y el de la última convocatoria pueden no coincidir (p.ej. en mayo de
 * 2026 la convocatoria publicada sigue siendo la "2026", y la "2027" no existe
 * todavía en BOE).
 *
 * @param {Array} specialityRecords
 * @returns {number|null}
 */
const getLatestPublishedYear = (specialityRecords) => {
  let maxYear = null;
  (specialityRecords || []).forEach((row) => {
    const y = parseInt(row.year, 10);
    if (!Number.isFinite(y)) return;
    if (maxYear === null || y > maxYear) maxYear = y;
  });
  return maxYear;
};

/**
 * Calcula el rango [minYear, maxYear] de años con nota de corte válida observada
 * en una colección de resultados ya procesados por `computeHospitalProbability`.
 * Se usa para informar en UI sobre qué histórico respalda las probabilidades.
 *
 * @param {Array<{grades: Array<{year:string|number, grade:number|null}>}>} hospitals
 * @returns {{minYear:number, maxYear:number}|null}
 */
const computeGradeYearsRange = (hospitals) => {
  let minY = null;
  let maxY = null;
  (hospitals || []).forEach((h) => {
    (h.grades || []).forEach((g) => {
      if (g.grade == null) return;
      const y = typeof g.year === "string" ? parseInt(g.year, 10) : g.year;
      if (!Number.isFinite(y)) return;
      if (minY === null || y < minY) minY = y;
      if (maxY === null || y > maxY) maxY = y;
    });
  });
  if (minY === null || maxY === null) return null;
  return { minYear: minY, maxYear: maxY };
};

/**
 * Orientador MIR (simulador inverso): a partir de una nota (número de orden) y,
 * opcionalmente, una comunidad autónoma, recorre TODAS las especialidades y
 * hospitales y devuelve las especialidades ordenadas por encaje con la nota.
 *
 * Reutiliza computeHospitalProbability para que las probabilidades por hospital
 * coincidan exactamente con las del simulador MIR.
 *
 * @param {number} mirScore - Posición del usuario en el MIR
 * @param {string|null} region - Comunidad autónoma (opcional)
 * @returns {Promise<{success: boolean, results: Array, error: string|null}>}
 */
export const calculateMIROrientation = async (mirScore, region = null) => {
  try {
    if (!mirScore) {
      return { success: false, results: [], error: "MIR score is required" };
    }

    const normalizedRegion =
      region && typeof region === "string" && region.trim() !== ""
        ? region.trim()
        : null;

    // Hospitales (filtrados por región si procede) indexados por id
    const allHospitalsData = await fetchHospitalsCache();
    if (!allHospitalsData) {
      return { success: false, results: [], error: "No hospitals data received" };
    }

    const filteredHospitals = normalizedRegion
      ? allHospitalsData.filter((h) => h.region === normalizedRegion)
      : allHospitalsData;

    const hospitalsById = {};
    filteredHospitals.forEach((h) => {
      if (h?.id) hospitalsById[h.id] = h;
    });

    if (Object.keys(hospitalsById).length === 0) {
      return { success: true, results: [], error: null };
    }

    // Una sola pasada: agrupar registros por especialidad -> hospital
    const bySpecialty = {};
    getHospitalSpecialityGradesCatalog().forEach((row) => {
      if (!hospitalsById[row.hospital_id]) return;
      const specialtyMap =
        bySpecialty[row.speciality_id] || (bySpecialty[row.speciality_id] = {});
      const hospitalRecords =
        specialtyMap[row.hospital_id] || (specialtyMap[row.hospital_id] = []);
      hospitalRecords.push(row);
    });

    // Agregar por especialidad
    const results = Object.entries(bySpecialty)
      .map(([specialityId, hospitalMap]) => {
        // Año de plazas vigentes para esta especialidad: máximo año observado en
        // los registros del catálogo, no el año del calendario.
        const allRecords = Object.values(hospitalMap).flat();
        const slotsYear = getLatestPublishedYear(allRecords);

        const allHospitals = Object.entries(hospitalMap)
          .map(([hospitalId, records]) => {
            const hospital = hospitalsById[hospitalId];
            if (!hospital) return null;

            const { probability, grades, yearsUsed, currentYearSlots } =
              computeHospitalProbability(records, mirScore, slotsYear);

            return {
              hospital,
              probability,
              grades,
              yearsUsed,
              currentYearSlots,
            };
          })
          .filter((h) => h !== null)
          .sort((a, b) => compareByProbability(a, b, (r) => r.hospital.name));

        if (allHospitals.length === 0) return null;

        const specialityName =
          getSpecialityByIdFromCatalog(specialityId)?.name || "Especialidad";

        // Sólo entran al ratio "X de Y accesibles" hospitales con muestra suficiente
        // de notas de corte (>= MIN_EVALUABLE_YEARS). Hospitales sin histórico o
        // con 1-2 años de dato no son comparables y distorsionan el denominador.
        const evaluableHospitals = allHospitals.filter(
          (h) => (h.yearsUsed || 0) >= MIN_EVALUABLE_YEARS
        );

        const accessibleCount = evaluableHospitals.filter(
          (h) => probabilityToNumber(h.probability) >= ACCESSIBLE_THRESHOLD
        ).length;

        const maxProbability = allHospitals.reduce(
          (max, h) => Math.max(max, probabilityToNumber(h.probability)),
          -1
        );

        // Plazas vigentes sumadas sólo sobre los hospitales evaluables, para que
        // el "X plazas" sea coherente con el denominador "Y hospitales".
        const totalCurrentYearSlots = evaluableHospitals.reduce(
          (sum, h) => sum + (h.currentYearSlots || 0),
          0
        );

        const gradeYearsRange = computeGradeYearsRange(evaluableHospitals);

        return {
          specialityId,
          specialityName,
          hospitals: allHospitals,
          hospitalCount: evaluableHospitals.length,
          totalHospitalCount: allHospitals.length,
          accessibleCount,
          maxProbability,
          totalCurrentYearSlots,
          slotsYear,
          gradeYearsRange,
        };
      })
      .filter((s) => s !== null)
      .sort((a, b) => {
        // Ordenar por encaje: más hospitales accesibles, luego mayor probabilidad
        if (b.accessibleCount !== a.accessibleCount) {
          return b.accessibleCount - a.accessibleCount;
        }
        if (b.maxProbability !== a.maxProbability) {
          return b.maxProbability - a.maxProbability;
        }
        return a.specialityName.localeCompare(b.specialityName);
      });

    return { success: true, results, error: null };
  } catch (error) {
    console.error("❌ Error calculating MIR orientation:", error);
    return { success: false, results: [], error: error.message };
  }
};
