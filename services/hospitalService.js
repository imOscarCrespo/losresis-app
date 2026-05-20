/**
 * Servicio para obtener hospitales y especialidades.
 *
 * Los catálogos estáticos se leen desde JSON empaquetado en la app para evitar
 * cached egress de Supabase. Las operaciones dinámicas siguen usando Supabase.
 */

import { supabase } from "../config/supabase";
import {
  getHospitalDiscoveryRankingsCatalog,
  getHospitalsCatalog,
  getHospitalSpecialityCatalog,
  getHospitalSpecialityGradesCatalog,
  getSpecialitiesCatalog,
  getSpecialityByIdFromCatalog,
} from "./staticCatalogService";

let discoveryRankingSnapshotPromise = null;
let hospitalSpecialtyCachePromise = null;
let hospitalSpecialityGradesPromise = null;

export const fetchHospitalsCache = async () => getHospitalsCatalog();

const normalizeRankingEntry = (entry) => {
  if (!entry || typeof entry !== "object") return null;

  const hospitalId = entry.hospital_id || entry.hospitalId || entry.id;
  if (!hospitalId) return null;

  return {
    hospital_id: hospitalId,
    speciality_id: entry.speciality_id ?? entry.specialityId ?? null,
    approved_review_count:
      entry.approved_review_count ?? entry.approvedReviewCount ?? 0,
    organic_rank: entry.organic_rank ?? entry.organicRank ?? null,
    blended_rank: entry.blended_rank ?? entry.blendedRank ?? null,
    organic_score: entry.organic_score ?? entry.organicScore ?? null,
    final_score: entry.final_score ?? entry.finalScore ?? null,
    is_sponsored: Boolean(entry.is_sponsored ?? entry.isSponsored ?? false),
    sponsorship_label:
      entry.sponsorship_label ?? entry.sponsorshipLabel ?? null,
  };
};

const normalizeRankingScope = (scope) => {
  if (!scope || typeof scope !== "object") {
    return {
      orderedHospitalIds: [],
      rankingByHospitalId: {},
    };
  }

  const orderedHospitalIdsSource =
    scope.ordered_hospital_ids ||
    scope.orderedHospitalIds ||
    scope.ranked_hospital_ids ||
    scope.rankedHospitalIds ||
    [];

  const orderedHospitalIds = Array.isArray(orderedHospitalIdsSource)
    ? [...new Set(orderedHospitalIdsSource.filter(Boolean))]
    : [];

  const rankingByHospitalId = {};
  const entriesSource =
    scope.by_hospital_id || scope.byHospitalId || scope.rankings || null;

  if (entriesSource && typeof entriesSource === "object") {
    Object.entries(entriesSource).forEach(([hospitalId, rawEntry]) => {
      const normalized = normalizeRankingEntry({
        hospital_id: hospitalId,
        ...rawEntry,
      });
      if (normalized) {
        rankingByHospitalId[normalized.hospital_id] = normalized;
      }
    });
  }

  if (Array.isArray(scope.entries)) {
    scope.entries.forEach((entry) => {
      const normalized = normalizeRankingEntry(entry);
      if (normalized) {
        rankingByHospitalId[normalized.hospital_id] = normalized;
      }
    });
  }

  return {
    orderedHospitalIds:
      orderedHospitalIds.length > 0
        ? orderedHospitalIds
        : Object.keys(rankingByHospitalId),
    rankingByHospitalId,
  };
};

const getEmptyRankingScope = () => ({
  orderedHospitalIds: [],
  rankingByHospitalId: {},
});

const getDiscoveryRankingSnapshot = async () => {
  if (!discoveryRankingSnapshotPromise) {
    discoveryRankingSnapshotPromise = (async () => {
      try {
        const snapshot = getHospitalDiscoveryRankingsCatalog();

        const bySpecialtyRaw =
          snapshot?.by_specialty || snapshot?.bySpecialty || {};
        const bySpecialty = {};

        Object.entries(bySpecialtyRaw).forEach(([specialtyId, scope]) => {
          bySpecialty[specialtyId] = normalizeRankingScope(scope);
        });

        return {
          success: true,
          general: normalizeRankingScope(snapshot?.general),
          bySpecialty,
          generatedAt: snapshot?.generated_at ?? snapshot?.generatedAt ?? null,
          error: null,
        };
      } catch (error) {
        if (error.status === 404) {
          return {
            success: true,
            general: getEmptyRankingScope(),
            bySpecialty: {},
            generatedAt: null,
            error: null,
          };
        }

        console.warn(
          "⚠️ Failed to fetch hospital discovery rankings cache",
          error
        );
        return {
          success: false,
          general: getEmptyRankingScope(),
          bySpecialty: {},
          generatedAt: null,
          error: error.message,
        };
      }
    })();
  }

  return discoveryRankingSnapshotPromise;
};

const getHospitalSpecialtyCache = async () => {
  if (!hospitalSpecialtyCachePromise) {
    hospitalSpecialtyCachePromise = (async () => {
      try {
        const data = getHospitalSpecialityCatalog();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn("⚠️ Failed to read hospital specialties catalog", error);
        return [];
      }
    })();
  }

  return hospitalSpecialtyCachePromise;
};

const getHospitalSpecialityGradesCache = async () => {
  if (!hospitalSpecialityGradesPromise) {
    hospitalSpecialityGradesPromise = Promise.resolve(
      getHospitalSpecialityGradesCatalog()
    );
  }

  return hospitalSpecialityGradesPromise;
};

/**
 * Obtener todos los hospitales desde el catálogo local empaquetado
 * @returns {Promise<{success: boolean, hospitals: array, error: string|null}>}
 */
export const getHospitals = async () => {
  try {
    console.log("🔍 Fetching hospitals from local static catalog...");
    const hospitalsData = await fetchHospitalsCache();

    if (!hospitalsData || hospitalsData.length === 0) {
      console.warn("⚠️ No hospitals data found in local static catalog");
      return {
        success: true,
        hospitals: [],
        error: null,
      };
    }

    const rankingSnapshot = await getDiscoveryRankingSnapshot();
    const rankingByHospitalId = rankingSnapshot.general.rankingByHospitalId;
    const hospitalsMapped = hospitalsData.map((hospital, index) => {
      const ranking = rankingByHospitalId[hospital.id] || null;

      return {
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
        specialtyCount: 0,
        catalog_order: index,
        approved_review_count: ranking?.approved_review_count ?? 0,
        organic_rank: ranking?.organic_rank ?? null,
        blended_rank: ranking?.blended_rank ?? null,
        organic_score: ranking?.organic_score ?? null,
        final_score: ranking?.final_score ?? null,
        is_sponsored: Boolean(ranking?.is_sponsored ?? false),
        sponsorship_label: ranking?.sponsorship_label ?? null,
      };
    });

    hospitalsMapped.sort((a, b) => {
      const aRanked = a.final_score !== null || a.blended_rank !== null;
      const bRanked = b.final_score !== null || b.blended_rank !== null;

      if (aRanked && bRanked) {
        if ((b.final_score ?? -1) !== (a.final_score ?? -1)) {
          return (b.final_score ?? -1) - (a.final_score ?? -1);
        }
        if ((b.organic_score ?? -1) !== (a.organic_score ?? -1)) {
          return (b.organic_score ?? -1) - (a.organic_score ?? -1);
        }
        if ((b.approved_review_count ?? 0) !== (a.approved_review_count ?? 0)) {
          return (b.approved_review_count ?? 0) - (a.approved_review_count ?? 0);
        }
      } else if (aRanked !== bRanked) {
        return aRanked ? -1 : 1;
      }

      return (a.catalog_order ?? 0) - (b.catalog_order ?? 0);
    });

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
    console.log("🔍 Fetching specialties from local static catalog...");
    const data = getSpecialitiesCatalog();

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

    const data = getSpecialityByIdFromCatalog(specialtyId);

    return {
      success: Boolean(data),
      specialty: data,
      error: data ? null : "Specialty not found",
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
    const hospitalSpecialtyData = await getHospitalSpecialtyCache();

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

    // Obtener notas de corte desde el catálogo local
    const gradesData = (await getHospitalSpecialityGradesCache())
      .filter((item) => item.hospital_id === hospitalId)
      .sort((a, b) => {
        const specialityOrder = String(a.speciality_id || "").localeCompare(
          String(b.speciality_id || "")
        );
        if (specialityOrder !== 0) return specialityOrder;
        return Number(a.year || 0) - Number(b.year || 0);
      });

    if (!gradesData || gradesData.length === 0) {
      console.log("No grades data found for this hospital");
      return {
        success: true,
        specialties: [],
        error: null,
      };
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

    // Obtener info_note de hospital_specialities desde el catálogo local
    const infoNotesData = (await getHospitalSpecialtyCache()).filter(
      (item) =>
        item.hospital_id === hospitalId &&
        specialtyIds.includes(item.speciality_id)
    );
    const infoNoteBySpecialty = {};
    (infoNotesData || []).forEach((row) => {
      if (row.info_note != null && row.info_note !== "") {
        infoNoteBySpecialty[row.speciality_id] = row.info_note;
      }
    });

    // Obtener nombres de especialidades desde el catálogo local
    const specialtyDetails = getSpecialitiesCatalog().filter((specialty) =>
      specialtyIds.includes(specialty.id)
    );

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
        info_note: infoNoteBySpecialty[specialty.id] || null,
      };
    });

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
 * Obtener la información pública ampliada del hospital gestionada desde losresis-panel
 * @param {string} hospitalId - ID del hospital
 * @returns {Promise<{success: boolean, profile: object|null, error: string|null}>}
 */
export const getHospitalProfileContent = async (hospitalId) => {
  try {
    if (!hospitalId) {
      return {
        success: false,
        profile: null,
        error: "Hospital ID is required",
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    const { data: orgRow, error: orgError } = await supabase
      .from("employer_org")
      .select("id, hospital_id")
      .eq("hospital_id", hospitalId)
      .maybeSingle();

    if (orgError) {
      throw new Error(orgError.message);
    }

    if (!orgRow?.id) {
      return {
        success: true,
        profile: {
          org_id: null,
          about: null,
          differential_points: [],
          images: [],
          open_day: null,
          plans: [],
        },
        error: null,
      };
    }

    const [
      { data: profileRow, error: profileError },
      { data: imageRows, error: imageError },
      { data: openDayRows, error: openDayError },
      { data: planRows, error: planError },
    ] = await Promise.all([
      supabase
        .from("employer_org_profile")
        .select("org_id, about, differential_points")
        .eq("org_id", orgRow.id)
        .maybeSingle(),
      supabase
        .from("employer_org_profile_image")
        .select("*")
        .eq("org_id", orgRow.id)
        .order("position", { ascending: true }),
      supabase
        .from("hospital_open_day")
        .select("*")
        .eq("hospital_id", hospitalId)
        .eq("is_published", true)
        .gte("event_date", todayIso)
        .order("event_date", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("employer_org_profile_speciality")
        .select(
          "org_id, speciality_id, plan_formativo_storage_path, plan_formativo_url, description, differential_points, specialities(name)"
        )
        .eq("org_id", orgRow.id),
    ]);

    if (profileError) {
      throw new Error(profileError.message);
    }
    if (imageError) {
      throw new Error(imageError.message);
    }
    if (openDayError) {
      throw new Error(openDayError.message);
    }
    if (planError) {
      throw new Error(planError.message);
    }

    const plans = ((planRows || []).map((row) => {
      const specialty = Array.isArray(row.specialities)
        ? row.specialities[0]
        : row.specialities;

      return {
        org_id: row.org_id,
        speciality_id: row.speciality_id,
        speciality_name: specialty?.name || "Especialidad",
        plan_formativo_storage_path: row.plan_formativo_storage_path || null,
        plan_formativo_url: row.plan_formativo_url || null,
        description: row.description || "",
        differential_points: Array.isArray(row.differential_points)
          ? row.differential_points.filter(Boolean)
          : [],
      };
    }) || []).sort((a, b) =>
      a.speciality_name.localeCompare(b.speciality_name, "es")
    );

    return {
      success: true,
      profile: {
        org_id: orgRow.id,
        about: profileRow?.about?.trim() || null,
        differential_points: Array.isArray(profileRow?.differential_points)
          ? profileRow.differential_points.filter(Boolean)
          : [],
        images: imageRows || [],
        open_day: openDayRows?.[0] || null,
        plans,
      },
      error: null,
    };
  } catch (error) {
    console.error("❌ Error fetching hospital profile content:", error);
    return {
      success: false,
      profile: null,
      error: error.message,
    };
  }
};

/**
 * Comprobar si un usuario ya está inscrito a una jornada abierta
 * @param {string} openDayId
 * @param {string} userId
 * @returns {Promise<{success: boolean, isRegistered: boolean, error: string|null}>}
 */
export const getHospitalOpenDayRegistrationStatus = async (openDayId, userId) => {
  try {
    if (!openDayId || !userId) {
      return {
        success: true,
        isRegistered: false,
        error: null,
      };
    }

    const { data, error } = await supabase
      .from("hospital_open_day_registration")
      .select("id")
      .eq("open_day_id", openDayId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      isRegistered: Boolean(data?.id),
      error: null,
    };
  } catch (error) {
    console.error("❌ Error fetching open day registration status:", error);
    return {
      success: false,
      isRegistered: false,
      error: error.message,
    };
  }
};

/**
 * Registrar a un usuario en una jornada abierta
 * @param {string} openDayId
 * @param {string} userId
 * @returns {Promise<{success: boolean, alreadyRegistered: boolean, error: string|null}>}
 */
export const registerForHospitalOpenDay = async (openDayId, userId) => {
  try {
    if (!openDayId || !userId) {
      return {
        success: false,
        alreadyRegistered: false,
        error: "Open day ID and user ID are required",
      };
    }

    const { error } = await supabase
      .from("hospital_open_day_registration")
      .upsert(
        {
          open_day_id: openDayId,
          user_id: userId,
        },
        {
          onConflict: "open_day_id,user_id",
          ignoreDuplicates: false,
        }
      );

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      alreadyRegistered: false,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error registering for hospital open day:", error);
    return {
      success: false,
      alreadyRegistered: false,
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

    // Obtener todas las notas de esta especialidad en este hospital desde catálogo local
    const gradesData = (await getHospitalSpecialityGradesCache())
      .filter(
        (item) =>
          item.hospital_id === hospitalId && item.speciality_id === specialtyId
      )
      .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));

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
 * Obtener ranking de hospitales para una especialidad usando snapshots cacheados
 * @param {string} specialtyId - ID de la especialidad
 * @returns {Promise<{success: boolean, orderedHospitalIds: array, rankingByHospitalId: object, error: string|null}>}
 */
export const getHospitalRankingBySpecialty = async (specialtyId) => {
  try {
    if (!specialtyId) {
      return {
        success: true,
        orderedHospitalIds: [],
        rankingByHospitalId: {},
        error: null,
      };
    }

    console.log("🔍 Fetching hospitals for specialty:", specialtyId);

    const rankingSnapshot = await getDiscoveryRankingSnapshot();
    const specialtyScope = rankingSnapshot.bySpecialty[specialtyId];

    if (specialtyScope) {
      return {
        success: true,
        orderedHospitalIds: specialtyScope.orderedHospitalIds,
        rankingByHospitalId: specialtyScope.rankingByHospitalId,
        error: null,
      };
    }

    const hospitalSpecialtyData = await getHospitalSpecialtyCache();

    if (!hospitalSpecialtyData || hospitalSpecialtyData.length === 0) {
      console.log("No hospital specialty data found in JSON cache");
      return {
        success: true,
        orderedHospitalIds: [],
        rankingByHospitalId: {},
        error: null,
      };
    }

    const orderedHospitalIds = [
      ...new Set(
        hospitalSpecialtyData
          .filter((item) => item.speciality_id === specialtyId)
          .map((item) => item.hospital_id)
          .filter(Boolean)
      ),
    ];

    console.log(
      `✅ Found ${orderedHospitalIds.length} hospitals for specialty ${specialtyId}`
    );

    return {
      success: true,
      orderedHospitalIds,
      rankingByHospitalId: {},
      error: null,
    };
  } catch (error) {
    console.error("❌ Error fetching hospitals by specialty:", error);
    return {
      success: false,
      orderedHospitalIds: [],
      rankingByHospitalId: {},
      error: error.message,
    };
  }
};

export const getHospitalIdsBySpecialty = async (specialtyId) => {
  const result = await getHospitalRankingBySpecialty(specialtyId);

  return {
    success: result.success,
    hospitalIds: result.orderedHospitalIds,
    error: result.error,
  };
};
