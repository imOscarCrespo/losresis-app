/**
 * Servicio para obtener hospitales y especialidades desde Supabase
 */

import { supabase } from "../config/supabase";

/**
 * Obtener todos los hospitales desde el JSON cache de Supabase Storage
 * @returns {Promise<{success: boolean, hospitals: array, error: string|null}>}
 */
export const getHospitals = async () => {
  try {
    console.log("🔍 Fetching hospitals from JSON cache...");

    // URL del JSON cache de hospitales
    const hospitalsUrl =
      "https://chgretwxywvaaruwovbb.supabase.co/storage/v1/object/public/cache//hospitals.json";

    const response = await fetch(hospitalsUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const hospitalsData = await response.json();

    if (!hospitalsData || hospitalsData.length === 0) {
      console.warn("⚠️ No hospitals data received from JSON cache");
      return {
        success: true,
        hospitals: [],
        error: null,
      };
    }

    // Mapear los datos de hospitales al formato esperado
    const hospitalsMapped = hospitalsData.map((hospital) => ({
      id: hospital.id,
      name: hospital.name,
      city: hospital.city,
      region: hospital.region,
      coordinates: hospital.coordinates,
      salary_r1_fixed_eur: hospital.salary_r1_fixed_eur,
      salary_r2_fixed_eur: hospital.salary_r2_fixed_eur,
      salary_r3_fixed_eur: hospital.salary_r3_fixed_eur,
      salary_r4_fixed_eur: hospital.salary_r4_fixed_eur,
      email_domain: (() => {
        if (Array.isArray(hospital.email_domain)) {
          return hospital.email_domain;
        }
        if (
          typeof hospital.email_domain === "string" &&
          hospital.email_domain
        ) {
          try {
            const parsed = JSON.parse(hospital.email_domain);
            return Array.isArray(parsed) ? parsed : [hospital.email_domain];
          } catch {
            return [hospital.email_domain];
          }
        }
        return [];
      })(),
      specialtyCount: 0, // Se puede agregar después si es necesario
    }));

    console.log("✅ Successfully fetched hospitals:", hospitalsMapped.length);

    return {
      success: true,
      hospitals: hospitalsMapped,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error fetching hospitals:", error);
    return {
      success: false,
      hospitals: [],
      error: error.message,
    };
  }
};

/**
 * Obtener todas las especialidades desde Supabase
 * @returns {Promise<{success: boolean, specialties: array, error: string|null}>}
 */
export const getSpecialties = async () => {
  try {
    console.log("🔍 Fetching specialties...");

    const { data, error } = await supabase
      .from("specialities")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("❌ Error fetching specialties:", error);
      return {
        success: false,
        specialties: [],
        error: error.message,
      };
    }

    console.log("✅ Successfully fetched specialties:", data?.length || 0);

    return {
      success: true,
      specialties: data || [],
      error: null,
    };
  } catch (error) {
    console.error("❌ Exception fetching specialties:", error);
    return {
      success: false,
      specialties: [],
      error: error.message,
    };
  }
};

/**
 * Obtener una especialidad por ID
 * @param {string} specialtyId - ID de la especialidad
 * @returns {Promise<{success: boolean, specialty: object|null, error: string|null}>}
 */
export const getSpecialtyById = async (specialtyId) => {
  try {
    if (!specialtyId) {
      return {
        success: false,
        specialty: null,
        error: "Specialty ID is required",
      };
    }

    const { data, error } = await supabase
      .from("specialities")
      .select("id, name")
      .eq("id", specialtyId)
      .single();

    if (error) {
      console.error("❌ Error fetching specialty:", error);
      return {
        success: false,
        specialty: null,
        error: error.message,
      };
    }

    return {
      success: true,
      specialty: data,
      error: null,
    };
  } catch (error) {
    console.error("❌ Exception fetching specialty:", error);
    return {
      success: false,
      specialty: null,
      error: error.message,
    };
  }
};

/**
 * Obtener conteos de especialidades por hospital
 * @returns {Promise<{success: boolean, counts: object, error: string|null}>}
 * counts es un objeto donde la clave es el hospital_id y el valor es el número de especialidades
 */
export const getSpecialtyCounts = async () => {
  try {
    console.log("🔍 Fetching specialty counts...");

    const hospitalSpecialtyUrl =
      "https://chgretwxywvaaruwovbb.supabase.co/storage/v1/object/public/cache//hospital_speciality.json";

    const response = await fetch(hospitalSpecialtyUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const hospitalSpecialtyData = await response.json();

    if (!hospitalSpecialtyData || hospitalSpecialtyData.length === 0) {
      console.log("No hospital specialty data found in JSON cache");
      return {
        success: true,
        counts: {},
        error: null,
      };
    }

    // Contar especialidades por hospital
    const counts = {};
    hospitalSpecialtyData.forEach((item) => {
      const hospitalId = item.hospital_id;
      if (hospitalId) {
        counts[hospitalId] = (counts[hospitalId] || 0) + 1;
      }
    });

    console.log(
      `✅ Successfully calculated specialty counts for ${
        Object.keys(counts).length
      } hospitals`
    );

    return {
      success: true,
      counts,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error fetching specialty counts:", error);
    return {
      success: false,
      counts: {},
      error: error.message,
    };
  }
};

/**
 * Obtener especialidades de un hospital con notas de corte
 * @param {string} hospitalId - ID del hospital
 * @returns {Promise<{success: boolean, specialties: array, error: string|null}>}
 */
export const getHospitalSpecialties = async (hospitalId) => {
  try {
    if (!hospitalId) {
      return {
        success: false,
        specialties: [],
        error: "Hospital ID is required",
      };
    }

    console.log("🔍 Fetching specialties for hospital:", hospitalId);

    // Obtener notas de corte desde la tabla hospital_speciality_grades
    const { data: gradesData, error: gradesError } = await supabase
      .from("hospital_speciality_grades")
      .select("*")
      .eq("hospital_id", hospitalId)
      .order("speciality_id", { ascending: true })
      .order("year", { ascending: true });

    if (gradesError) {
      throw new Error(gradesError.message);
    }

    if (!gradesData || gradesData.length === 0) {
      console.log("No grades data found for this hospital");
      return {
        success: true,
        specialties: [],
        error: null,
      };
    }

    console.log("📊 Grades data received:", gradesData.length, "records");
    if (gradesData.length > 0) {
      console.log(
        "📊 First grade item sample:",
        JSON.stringify(gradesData[0], null, 2)
      );
    }

    // Agrupar por especialidad con años dinámicos (igual que la web app)
    const specialtiesMap = {};
    const currentYear = new Date().getFullYear();

    gradesData.forEach((gradeItem) => {
      const specialtyId = gradeItem.speciality_id;

      if (!specialtiesMap[specialtyId]) {
        // Inicializar con estructura dinámica
        specialtiesMap[specialtyId] = {
          speciality_id: specialtyId,
          hospital_id: gradeItem.hospital_id,
          years: [], // Array dinámico de años
          slots: null,
        };
      }

      // Obtener el año
      let year = gradeItem.year;
      if (typeof year === "string") {
        year = parseInt(year.trim());
      } else if (typeof year === "number") {
        year = Math.floor(year);
      }

      if (isNaN(year)) return;

      // Obtener la nota - intentar diferentes nombres de campos posibles
      let score =
        gradeItem.rate ||
        gradeItem.grade ||
        gradeItem.grades ||
        gradeItem.cut_off_score ||
        gradeItem.nota;

      // Si es un array, tomar el valor más alto (nota de corte más alta)
      if (Array.isArray(score)) {
        if (score.length > 0) {
          score = Math.max(...score);
        } else {
          score = null;
        }
      }

      // Convertir a número si es string
      if (typeof score === "string" && score.trim() !== "") {
        score = parseFloat(score);
        if (isNaN(score)) {
          score = null;
        }
      }

      // Añadir o actualizar el año en el array dinámico
      const existingYearIndex = specialtiesMap[specialtyId].years.findIndex(
        (y) => y.year === year
      );

      const gradeValue =
        score !== null && score !== undefined && !isNaN(score) ? score : null;

      if (existingYearIndex >= 0) {
        // Si el año ya existe, tomar el valor más alto
        const currentGrade =
          specialtiesMap[specialtyId].years[existingYearIndex].grade;
        if (
          currentGrade === null ||
          (gradeValue !== null && gradeValue > currentGrade)
        ) {
          specialtiesMap[specialtyId].years[existingYearIndex].grade =
            gradeValue;
        }
      } else {
        // Añadir nuevo año
        specialtiesMap[specialtyId].years.push({
          year: year,
          grade: gradeValue,
        });
      }

      // Guardar slots por año para poder obtener el del año actual después
      if (gradeItem.slots !== null && gradeItem.slots !== undefined) {
        if (!specialtiesMap[specialtyId].slotsByYear) {
          specialtiesMap[specialtyId].slotsByYear = {};
        }
        specialtiesMap[specialtyId].slotsByYear[year] = gradeItem.slots;
      }
    });

    // Convertir el mapa a array (similar a fetchHospitalSpecialties)
    const hospitalSpecialtiesData = Object.values(specialtiesMap);
    console.log(
      "📊 Hospital specialties data (formatted):",
      hospitalSpecialtiesData
    );

    // Obtener IDs de especialidades únicas
    const specialtyIds = hospitalSpecialtiesData.map(
      (item) => item.speciality_id
    );

    if (specialtyIds.length === 0) {
      return {
        success: true,
        specialties: [],
        error: null,
      };
    }

    // Obtener nombres de especialidades desde Supabase
    const { data: specialtyDetails, error: specialtyDetailsError } =
      await supabase
        .from("specialities")
        .select("id, name")
        .in("id", specialtyIds);

    if (specialtyDetailsError) {
      throw new Error(specialtyDetailsError.message);
    }

    // Combinar datos: especialidad + plazas + años dinámicos (igual que la web app)
    const formattedSpecialties = (specialtyDetails || []).map((specialty) => {
      const gradeInfo = hospitalSpecialtiesData.find(
        (item) => item.speciality_id === specialty.id
      );

      // Ordenar años descendente
      const years = (gradeInfo?.years || [])
        .sort((a, b) => b.year - a.year)
        .map((y) => ({
          year: y.year,
          grade: y.grade,
        }));

      // Obtener slots del año actual o más reciente disponible
      const currentYear = new Date().getFullYear();
      const slotsByYear = gradeInfo?.slotsByYear || {};
      const slots =
        slotsByYear[currentYear] !== null &&
        slotsByYear[currentYear] !== undefined
          ? slotsByYear[currentYear]
          : years.length > 0 &&
            slotsByYear[years[0].year] !== null &&
            slotsByYear[years[0].year] !== undefined
          ? slotsByYear[years[0].year]
          : undefined;

      return {
        id: specialty.id || "",
        name: specialty.name || "",
        description: "", // No description field in specialities table
        years: years, // Array dinámico de años con grades
        slots: slots !== null && slots !== undefined ? slots : undefined,
      };
    });

    console.log("Final specialties data:", formattedSpecialties);

    return {
      success: true,
      specialties: formattedSpecialties,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error fetching hospital specialties:", error);
    return {
      success: false,
      specialties: [],
      error: error.message,
    };
  }
};

/**
 * Obtener notas detalladas de una especialidad de un hospital (agrupadas por año)
 * @param {string} hospitalId - ID del hospital
 * @param {string} specialtyId - ID de la especialidad
 * @returns {Promise<{success: boolean, grades: array, error: string|null}>}
 * grades es un array de objetos: [{ year: number, slots: number, grades: number[] }, ...]
 */
export const getDetailedGrades = async (hospitalId, specialtyId) => {
  try {
    if (!hospitalId || !specialtyId) {
      return {
        success: false,
        grades: [],
        error: "Hospital ID and Specialty ID are required",
      };
    }

    console.log(
      "🔍 Fetching detailed grades for hospital:",
      hospitalId,
      "specialty:",
      specialtyId
    );

    // Obtener todas las notas de esta especialidad en este hospital
    const { data: gradesData, error: gradesError } = await supabase
      .from("hospital_speciality_grades")
      .select("*")
      .eq("hospital_id", hospitalId)
      .eq("speciality_id", specialtyId)
      .order("year", { ascending: false });

    if (gradesError) {
      throw new Error(gradesError.message);
    }

    if (!gradesData || gradesData.length === 0) {
      return {
        success: true,
        grades: [],
        error: null,
      };
    }

    // Agrupar por año
    const gradesByYear = {};

    gradesData.forEach((gradeItem) => {
      const year = parseInt(gradeItem.year);
      if (isNaN(year)) return;

      if (!gradesByYear[year]) {
        gradesByYear[year] = {
          year: year,
          slots: gradeItem.slots || 0,
          grades: [],
        };
      }

      // Obtener la nota
      let score = gradeItem.rate || gradeItem.grade || gradeItem.grades;

      // Si es un array, agregar todas las notas
      if (Array.isArray(score)) {
        score.forEach((s) => {
          const numScore = typeof s === "string" ? parseFloat(s) : s;
          if (!isNaN(numScore) && numScore !== null && numScore !== undefined) {
            gradesByYear[year].grades.push(numScore);
          }
        });
      } else if (score !== null && score !== undefined) {
        // Si es un valor único, convertirlo a número
        const numScore = typeof score === "string" ? parseFloat(score) : score;
        if (!isNaN(numScore)) {
          gradesByYear[year].grades.push(numScore);
        }
      }

      // Actualizar plazas si está disponible
      if (gradeItem.slots !== null && gradeItem.slots !== undefined) {
        gradesByYear[year].slots = gradeItem.slots;
      }
    });

    // Convertir a array y ordenar por año descendente
    const detailedGrades = Object.values(gradesByYear)
      .map((item) => ({
        ...item,
        grades: item.grades.sort((a, b) => b - a), // Ordenar notas descendente
      }))
      .sort((a, b) => b.year - a.year);

    console.log("✅ Detailed grades:", detailedGrades);

    return {
      success: true,
      grades: detailedGrades,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error fetching detailed grades:", error);
    return {
      success: false,
      grades: [],
      error: error.message,
    };
  }
};

/**
 * Filtrar hospitales por especialidad usando el JSON cache
 * @param {string} specialtyId - ID de la especialidad
 * @returns {Promise<{success: boolean, hospitalIds: array, error: string|null}>}
 */
export const getHospitalIdsBySpecialty = async (specialtyId) => {
  try {
    if (!specialtyId) {
      return {
        success: true,
        hospitalIds: [],
        error: null,
      };
    }

    console.log("🔍 Fetching hospitals for specialty:", specialtyId);

    const hospitalSpecialtyUrl =
      "https://chgretwxywvaaruwovbb.supabase.co/storage/v1/object/public/cache//hospital_speciality.json";

    const response = await fetch(hospitalSpecialtyUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const hospitalSpecialtyData = await response.json();

    if (!hospitalSpecialtyData || hospitalSpecialtyData.length === 0) {
      console.log("No hospital specialty data found in JSON cache");
      return {
        success: true,
        hospitalIds: [],
        error: null,
      };
    }

    // Filtrar hospitales que ofrecen esta especialidad
    const hospitalIds = hospitalSpecialtyData
      .filter((item) => item.speciality_id === specialtyId)
      .map((item) => item.hospital_id);

    console.log(
      `✅ Found ${hospitalIds.length} hospitals for specialty ${specialtyId}`
    );

    return {
      success: true,
      hospitalIds,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error fetching hospitals by specialty:", error);
    return {
      success: false,
      hospitalIds: [],
      error: error.message,
    };
  }
};
