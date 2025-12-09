import { supabase } from "../config/supabase";
import { getCurrentUser } from "./authService";

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

    console.log("🔍 Calculating MIR probabilities:", {
      score: mirScore,
      specialty: specialtyId,
      region: region || "all",
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
    const filteredHospitals = region
      ? allHospitalsData.filter((hospital) => hospital.region === region)
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

    // Step 4: Get detailed grades for this specialty
    // Use alternative approach if too many hospitals
    let detailedGradesData;

    if (hospitalIds.length > 500) {
      // Query all grades for specialty, then filter
      const { data, error } = await supabase
        .from("hospital_speciality_grades")
        .select("*")
        .eq("speciality_id", specialtyId)
        .order("hospital_id, year");

      if (error) {
        throw new Error(error.message);
      }

      const hospitalIdSet = new Set(hospitalIds);
      detailedGradesData =
        data?.filter((record) => hospitalIdSet.has(record.hospital_id)) || [];
    } else {
      // Query with hospital filter
      const { data, error } = await supabase
        .from("hospital_speciality_grades")
        .select("*")
        .eq("speciality_id", specialtyId)
        .in("hospital_id", hospitalIds)
        .order("hospital_id, year");

      if (error) {
        throw new Error(error.message);
      }

      detailedGradesData = data || [];
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

        return {
          hospital: hospital,
          probability,
          grades,
          yearsUsed: validGrades.length,
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
