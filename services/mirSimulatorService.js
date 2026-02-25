import { supabase } from "../config/supabase";
import { getCurrentUser } from "./authService";

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
  const { data, error } = await supabase
    .from("hospital_specialities")
    .select("hospital_id, info_note")
    .eq("speciality_id", specialtyId)
    .in("hospital_id", hospitalIds);

  if (error) {
    console.warn("Error fetching info_notes:", error);
    return {};
  }
  const map = {};
  (data || []).forEach((row) => {
    if (row.info_note != null && row.info_note !== "") map[row.hospital_id] = row.info_note;
  });
  return map;
};

const fetchGradesInBatches = async (hospitalIds, specialtyId) => {
  const BATCH_SIZE = 50; // Reducido para evitar límites de respuesta de Supabase
  const allResults = [];

  // Dividir hospitalIds en batches
  for (let i = 0; i < hospitalIds.length; i += BATCH_SIZE) {
    const batch = hospitalIds.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from("hospital_speciality_grades")
      .select("*")
      .eq("speciality_id", specialtyId)
      .in("hospital_id", batch)
      .order("hospital_id, year");

    if (error) {
      console.error(`Error fetching batch ${i / BATCH_SIZE + 1}:`, error);
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      allResults.push(...data);
    }
  }

  return allResults;
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

    // Step 1: Get hospitals from JSON cache
    const hospitalsResponse = await fetch(
      "https://chgretwxywvaaruwovbb.supabase.co/storage/v1/object/public/cache//hospitals.json"
    );

    if (!hospitalsResponse.ok) {
      throw new Error(`HTTP error! status: ${hospitalsResponse.status}`);
    }

    const allHospitalsData = await hospitalsResponse.json();

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

    // Step 6: Calculate results for each hospital
    const results = filteredHospitals
      .map((hospital) => {
        const hospitalGrades = hospitalGradesMap[hospital.id];

        if (!hospitalGrades || hospitalGrades.length === 0) {
          return null; // Hospital doesn't offer this specialty
        }

        // Convert grades to format expected by calculation
        const grades = [];

        hospitalGrades.forEach((record) => {
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
            grades.push({
              year: year.toString(),
              grade: score,
            });
          } else {
            grades.push({
              year: year.toString(),
              grade: null,
            });
          }
        });

        // Sort by year (most recent first)
        grades.sort((a, b) => parseInt(b.year) - parseInt(a.year));

        // Calculate probability
        const validGrades = grades.filter(
          (g) =>
            g.grade !== null &&
            g.grade !== undefined &&
            typeof g.grade === "number"
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

        // Get slots for current year
        const currentYear = new Date().getFullYear();
        const currentYearRecord = hospitalGrades.find(
          (record) => parseInt(record.year) === currentYear
        );
        const currentYearSlots =
          currentYearRecord?.slots !== null &&
          currentYearRecord?.slots !== undefined
            ? currentYearRecord.slots
            : null;

        return {
          hospital: hospital,
          probability,
          grades,
          yearsUsed: validGrades.length,
          currentYearSlots,
          info_note: infoNotesMap[hospital.id] || null,
        };
      })
      .filter((result) => result !== null)
      .sort((a, b) => {
        // Sort by probability (higher first), then by hospital name
        if (a.probability === "NA" && b.probability === "NA") {
          return a.hospital.name.localeCompare(b.hospital.name);
        }
        if (a.probability === "NA") return 1;
        if (b.probability === "NA") return -1;

        const probA = parseInt(a.probability.replace("%", ""));
        const probB = parseInt(b.probability.replace("%", ""));
        return probB - probA;
      });

    console.log(`✅ MIR results calculated: ${results.length} hospitals`);

    return {
      success: true,
      results,
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
