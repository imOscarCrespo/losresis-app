import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "staticCatalog");
const CACHE_BUCKET = "cache";
const CACHE_ASSETS = {
  hospitals: "hospitals.json",
  hospital_speciality: "hospital_speciality.json",
  hospital_discovery_rankings: "hospital_discovery_rankings.json",
};

const loadDotEnv = async () => {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env"), "utf8");
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .forEach((line) => {
        const index = line.indexOf("=");
        if (index === -1) return;
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        if (key && process.env[key] == null) {
          process.env[key] = value;
        }
      });
  } catch {
    // The script can also run in CI with env vars already injected.
  }
};

const writeJson = async (fileName, value) => {
  const filePath = path.join(OUT_DIR, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
  const size = Buffer.byteLength(JSON.stringify(value));
  console.log(`Wrote ${fileName} (${size} bytes)`);
};

const fetchStorageJson = async (supabaseUrl, objectPath) => {
  const url = `${supabaseUrl}/storage/v1/object/public/${CACHE_BUCKET}/${objectPath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Storage ${objectPath} returned HTTP ${response.status}`);
  }
  return response.json();
};

const selectAll = async (supabase, table, select, applyQuery = (query) => query) => {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    query = applyQuery(query);
    const { data, error } = await query;

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
};

const readStorageOrTable = async ({ supabase, supabaseUrl, storagePath, table, select, query }) => {
  try {
    return await fetchStorageJson(supabaseUrl, storagePath);
  } catch (error) {
    console.warn(`Could not read ${storagePath} from Storage; falling back to ${table}: ${error.message}`);
    return selectAll(supabase, table, select, query);
  }
};

const run = async () => {
  await loadDotEnv();
  await fs.mkdir(OUT_DIR, { recursive: true });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !key) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/EXPO_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [
    hospitals,
    hospitalSpeciality,
    hospitalDiscoveryRankings,
    specialities,
    hospitalSpecialityGrades,
    reviewQuestions,
    roommateQuestions,
    externalRotationQuestions,
    quizQuestionsV2,
    quizQuestionsV3,
    residentTransitionConfig,
  ] = await Promise.all([
    readStorageOrTable({
      supabase,
      supabaseUrl,
      storagePath: CACHE_ASSETS.hospitals,
      table: "hospitals",
      select: "*",
      query: (query) => query.order("name", { ascending: true }),
    }),
    readStorageOrTable({
      supabase,
      supabaseUrl,
      storagePath: CACHE_ASSETS.hospital_speciality,
      table: "hospital_specialities",
      select: "hospital_id, speciality_id, info_note",
      query: (query) =>
        query
          .order("hospital_id", { ascending: true })
          .order("speciality_id", { ascending: true }),
    }),
    fetchStorageJson(supabaseUrl, CACHE_ASSETS.hospital_discovery_rankings).catch(
      (error) => {
        console.warn(`Could not read hospital_discovery_rankings.json: ${error.message}`);
        return {};
      }
    ),
    selectAll(supabase, "specialities", "id, name", (query) =>
      query.order("name", { ascending: true })
    ),
    selectAll(supabase, "hospital_speciality_grades", "*", (query) =>
      query
        .order("hospital_id", { ascending: true })
        .order("speciality_id", { ascending: true })
        .order("year", { ascending: true })
    ),
    selectAll(supabase, "question", "*", (query) =>
      query.eq("is_active", true).order("position", { ascending: true })
    ),
    selectAll(supabase, "roommate_question", "*", (query) =>
      query
        .eq("is_active", true)
        .order("step_number", { ascending: true })
        .order("display_order", { ascending: true })
    ),
    selectAll(supabase, "external_rotation_question", "*", (query) =>
      query.order("position", { ascending: true })
    ),
    selectAll(
      supabase,
      "speciality_quiz_question",
      "id, order_index, text, dimension, question_type, quiz_version, options:speciality_quiz_option(id, label, value, order_index)",
      (query) =>
        query
          .eq("quiz_version", "v2_profiles_abcd")
          .order("order_index", { ascending: true })
    ),
    selectAll(
      supabase,
      "speciality_quiz_question",
      "id, order_index, text, dimension, question_type, quiz_version, options:speciality_quiz_option(id, label, value, order_index)",
      (query) =>
        query
          .eq("quiz_version", "v3_profiles_abcd_18")
          .order("order_index", { ascending: true })
    ),
    selectAll(supabase, "resident_transition_config", "*", (query) =>
      query.order("key", { ascending: true })
    ),
  ]);

  const compactHospitals = (hospitals || []).map((hospital) => ({
    id: hospital.id,
    name: hospital.name,
    city: hospital.city,
    region: hospital.region,
    coordinates: hospital.coordinates ?? null,
    salary_r1_fixed_eur: hospital.salary_r1_fixed_eur ?? null,
    salary_r2_fixed_eur: hospital.salary_r2_fixed_eur ?? null,
    salary_r3_fixed_eur: hospital.salary_r3_fixed_eur ?? null,
    salary_r4_fixed_eur: hospital.salary_r4_fixed_eur ?? null,
    email_domain: hospital.email_domain ?? [],
  }));

  const compactHospitalSpeciality = (hospitalSpeciality || []).map((row) => ({
    hospital_id: row.hospital_id,
    speciality_id: row.speciality_id,
    ...(row.info_note ? { info_note: row.info_note } : {}),
  }));

  const compactHospitalSpecialityGrades = (hospitalSpecialityGrades || []).map(
    (row) => ({
      hospital_id: row.hospital_id,
      speciality_id: row.speciality_id,
      year: row.year,
      slots: row.slots ?? 0,
      grades: Array.isArray(row.grades) ? row.grades : [],
    })
  );

  const manifest = {
    generated_at: new Date().toISOString(),
    catalog_year: new Date().getFullYear(),
    assets: {
      hospitals: compactHospitals.length || 0,
      hospital_speciality: compactHospitalSpeciality.length || 0,
      hospital_discovery_rankings:
        Object.keys(hospitalDiscoveryRankings || {}).length || 0,
      specialities: specialities.length || 0,
      hospital_speciality_grades: compactHospitalSpecialityGrades.length || 0,
      review_questions: reviewQuestions.length || 0,
      roommate_questions: roommateQuestions.length || 0,
      external_rotation_questions: externalRotationQuestions.length || 0,
      speciality_quiz_questions_v2: quizQuestionsV2.length || 0,
      speciality_quiz_questions_v3: quizQuestionsV3.length || 0,
      resident_transition_config: residentTransitionConfig.length || 0,
    },
  };

  await Promise.all([
    writeJson("hospitals.json", compactHospitals),
    writeJson("hospital_speciality.json", compactHospitalSpeciality),
    writeJson("hospital_discovery_rankings.json", hospitalDiscoveryRankings || {}),
    writeJson("specialities.json", specialities),
    writeJson("hospital_speciality_grades.json", compactHospitalSpecialityGrades),
    writeJson("review_questions.json", reviewQuestions),
    writeJson("roommate_questions.json", roommateQuestions),
    writeJson("external_rotation_questions.json", externalRotationQuestions),
    writeJson("speciality_quiz_questions_v2.json", quizQuestionsV2),
    writeJson("speciality_quiz_questions_v3.json", quizQuestionsV3),
    writeJson("resident_transition_config.json", residentTransitionConfig),
    writeJson("manifest.json", manifest),
  ]);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
