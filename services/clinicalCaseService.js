import { supabase } from "../config/supabase";
import { getPublishedLibroTemplateForUser } from "./libroTemplateService";
import { yearPortfolio, yearPortfolioGoals } from "../utils/clinicalCases";

/**
 * Lectura y escritura de los casos clínicos del Libro (utils/clinicalCases.js
 * explica el modelo).
 *
 * Los requisitos se leen EN VIVO de la plantilla publicada, como los apartados
 * personalizados: lo que el hospital cambie aparece al refrescar. La RLS solo
 * deja leer los de la plantilla publicada de su hospital y especialidad.
 */

const CASE_SELECT =
  "id, requirement_id, residency_year, title, case_date, service, rotation, " +
  "chief_complaint, relevant_history, physical_exam, complementary_tests, clinical_course, " +
  "final_diagnosis, treatment_and_outcome, reflection, status, review_status, completed_at, " +
  "created_at, updated_at, " +
  // Las revisiones del tutor (RLS: solo las de sus casos). utils/reviewsOf las ordena.
  "reviews:libro_clinical_case_review(id, reviewer_name, overall_assessment, strengths, " +
  "improvements, comments_for_resident, outcome, created_at)";

/**
 * Los requisitos de la plantilla (todos los años, también los retirados: hacen
 * falta para leer las fichas vinculadas a ellos), la posición del apartado en
 * el índice de cada año y su modo (fase 4). Cada requisito lleva el modo de su
 * año: el formulario necesita saber si es una categoría.
 *
 * @returns {{ requirements: Array, blockPositions: Map<number, number>,
 *   blockModes: Map<number, { mode: string, minimum: number|null }> }}
 */
export const getClinicalCaseRequirements = async (templateId, { throwOnError = false } = {}) => {
  const empty = { requirements: [], blockPositions: new Map(), blockModes: new Map() };
  if (!templateId) return empty;

  const { data, error } = await supabase
    .from("libro_clinical_case_block")
    .select(
      "id, residency_year, position, archived_at, requirement_mode, minimum_cases, " +
        "requirements:libro_clinical_case_requirement(id, title, description, is_required, tutor_review_enabled, minimum_cases, position, archived_at)"
    )
    .eq("template_id", templateId);

  if (error) {
    console.error("Error fetching clinical case requirements:", error);
    // El PDF del Libro no puede salir incompleto sin decirlo.
    if (throwOnError) throw error;
    // Un fallo de red no impide abrir el Libro: los casos libres siguen ahí.
    return empty;
  }

  const blockPositions = new Map();
  const blockModes = new Map();
  const requirements = [];
  (data || []).forEach((block) => {
    const mode = block.requirement_mode || "specific";
    if (!block.archived_at) {
      blockPositions.set(block.residency_year, block.position);
      blockModes.set(block.residency_year, { mode, minimum: block.minimum_cases ?? null });
    }
    (block.requirements || []).forEach((requirement) => {
      requirements.push({
        id: requirement.id,
        title: requirement.title,
        description: requirement.description,
        is_required: requirement.is_required,
        tutor_review_enabled: requirement.tutor_review_enabled,
        minimum_cases: requirement.minimum_cases ?? 1,
        requirement_mode: mode,
        position: requirement.position,
        residency_year: block.residency_year,
        archived: !!(requirement.archived_at || block.archived_at),
      });
    });
  });

  return { requirements, blockPositions, blockModes };
};

/** Las fichas del residente, de todos los años. */
export const getClinicalCases = async (userId, { throwOnError = false } = {}) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("libro_clinical_case")
    .select(CASE_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching clinical cases:", error);
    if (throwOnError) throw error;
    return [];
  }

  return data || [];
};

/**
 * Crea o actualiza una ficha. Lanza con el mensaje de la base, que ya viene en
 * castellano cuando es una regla del caso («Tu hospital ya no pide el caso …»,
 * «Tu tutor ya ha revisado este caso: no se puede editar»). `review_status` no
 * viaja: lo calcula la base.
 * «Un caso por requisito» (casos específicos; lo comprueba el guard) llega como 23505.
 */
export const saveClinicalCase = async ({ caseId = null, payload }) => {
  if (!payload?.user_id || !payload?.residency_year) {
    throw new Error("Faltan datos para guardar el caso clínico");
  }

  const query = caseId
    ? supabase
        .from("libro_clinical_case")
        .update(payload)
        .eq("id", caseId)
        .eq("user_id", payload.user_id)
    : supabase.from("libro_clinical_case").insert(payload);

  const { data, error } = await query.select(CASE_SELECT).single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya tienes un caso vinculado a este requisito.");
    }
    if (error.code === "23514" && /completed_fields/.test(error.message || "")) {
      throw new Error("Rellena todos los campos obligatorios para marcarlo como completado.");
    }
    throw new Error(error.message || "No se pudo guardar el caso clínico");
  }

  return data;
};

/** Vincula un caso libre ya registrado a un requisito de su portafolio. */
export const linkClinicalCase = async ({ caseId, userId, requirementId }) => {
  const { data, error } = await supabase
    .from("libro_clinical_case")
    .update({ requirement_id: requirementId })
    .eq("id", caseId)
    .eq("user_id", userId)
    .select(CASE_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya tienes un caso vinculado a este requisito.");
    }
    throw new Error(error.message || "No se pudo vincular el caso clínico");
  }

  return data;
};

export const deleteClinicalCase = async ({ caseId, userId }) => {
  const { error } = await supabase
    .from("libro_clinical_case")
    .delete()
    .eq("id", caseId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el caso clínico");
  }
};

/**
 * Los objetivos que el portafolio de casos clínicos aporta al Progreso del año,
 * para quien no tiene el Libro abierto (el inicio).
 */
export const getClinicalCaseYearGoals = async (userId, residencyYear) => {
  if (!userId || !residencyYear) return [];

  const template = await getPublishedLibroTemplateForUser(userId);
  if (!template?.id) return [];

  const [{ requirements, blockModes }, cases] = await Promise.all([
    getClinicalCaseRequirements(template.id),
    getClinicalCases(userId),
  ]);

  return yearPortfolioGoals(yearPortfolio(requirements, cases, blockModes, residencyYear));
};

export default {
  getClinicalCaseRequirements,
  getClinicalCases,
  saveClinicalCase,
  linkClinicalCase,
  deleteClinicalCase,
  getClinicalCaseYearGoals,
};
