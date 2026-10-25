import { supabase } from "../config/supabase";

/**
 * Autoevaluación de rotaciones (ClickUp 124b4z9ueuv).
 *
 * La configuración la publica Docencia desde el panel (rotation_plan y sus
 * versiones congeladas); el residente no lee esas tablas: todo va por RPC, que
 * resuelve su hospital, especialidad y año y valida cada escritura contra la
 * versión que está respondiendo. La tabla rotation_self_assessment es de solo
 * lectura para él.
 */

/**
 * Las rotaciones publicadas de su hospital, especialidad y año, y sus propias
 * autoevaluaciones de ese año (con la versión que respondió).
 * `context` es null si no tiene hospital o especialidad.
 */
export const getMyRotationAssessments = async (residencyYear) => {
  const { data, error } = await supabase.rpc("get_my_rotation_assessments", {
    p_residency_year: residencyYear,
  });

  if (error) {
    console.error("Error fetching rotation assessments:", error);
    throw error;
  }

  return {
    context: data?.context || null,
    rotations: Array.isArray(data?.rotations) ? data.rotations : [],
    assessments: Array.isArray(data?.assessments) ? data.assessments : [],
  };
};

/**
 * Empieza (o recupera) la autoevaluación de una rotación. Idempotente: si ya hay
 * una abierta, devuelve esa. `libroNodeId` enlaza la ficha del Libro que elige
 * el residente; sin él, en el Libro oficial se enlaza sola por la plantilla.
 * `newPeriod` abre otra realización cuando la anterior ya está completada.
 */
export const startRotationSelfAssessment = async (
  rotationId,
  { libroNodeId = null, newPeriod = false } = {}
) => {
  const { data, error } = await supabase.rpc("start_rotation_self_assessment", {
    p_rotation_id: rotationId,
    p_libro_node_id: libroNodeId,
    p_new_period: newPeriod,
  });

  if (error) {
    console.error("Error starting rotation self assessment:", error);
    throw error;
  }

  return data;
};

/**
 * Guarda sin finalizar. Cada parte que llega como undefined no se toca; así
 * guardar los objetivos no exige que la rúbrica esté habilitada, y al revés.
 */
export const saveRotationSelfAssessmentDraft = async (
  id,
  { objectiveAnswers, rubricAnswers, finalReflection } = {}
) => {
  const { data, error } = await supabase.rpc("save_rotation_self_assessment_draft", {
    p_id: id,
    p_objective_answers: objectiveAnswers === undefined ? null : objectiveAnswers,
    p_rubric_answers: rubricAnswers === undefined ? null : rubricAnswers,
    p_final_reflection: finalReflection === undefined ? null : finalReflection ?? "",
  });

  if (error) {
    console.error("Error saving rotation self assessment:", error);
    throw error;
  }

  return data;
};

/** Finaliza una parte: "objectives" o "rubric". A partir de ahí es de solo lectura. */
export const completeRotationSelfAssessment = async (id, part) => {
  const { data, error } = await supabase.rpc("complete_rotation_self_assessment", {
    p_id: id,
    p_part: part,
  });

  if (error) {
    console.error("Error completing rotation self assessment:", error);
    throw error;
  }

  return data;
};
