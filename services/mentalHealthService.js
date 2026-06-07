import { supabase } from "../config/supabase";
import {
  CBI_QUESTIONS,
  CBI_REVERSED_ITEM_IDS,
} from "../constants/cbiQuestionnaire";

const ASSESSMENTS_TABLE = "mental_health_assessments";
const CONSENT_TABLE = "mental_health_consent";

/** Versión actual del texto de consentimiento. Subir si cambia el texto legal. */
export const CONSENT_VERSION = "1.0";

const toScore = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeAssessment = (row) => {
  if (!row) return null;
  return {
    ...row,
    personal_score: toScore(row.personal_score),
    work_score: toScore(row.work_score),
    patient_score: toScore(row.patient_score),
    answers: row.answers || {},
  };
};

/**
 * Calcula las tres puntuaciones del CBI (0-100) a partir de las respuestas.
 * Cada dimensión es la media de sus ítems; los ítems invertidos se puntúan 100 - valor.
 * @param {Object} answers - { [questionId]: number }
 */
export const calculateCbiScores = (answers = {}) => {
  const buckets = { personal: [], work: [], patient: [] };

  CBI_QUESTIONS.forEach((question) => {
    const raw = answers[question.id];
    if (raw === undefined || raw === null) return;

    const value = CBI_REVERSED_ITEM_IDS.includes(question.id)
      ? 100 - Number(raw)
      : Number(raw);

    if (Number.isFinite(value)) {
      buckets[question.domain].push(value);
    }
  });

  const average = (values) =>
    values.length
      ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) /
        100
      : null;

  return {
    personal_score: average(buckets.personal),
    work_score: average(buckets.work),
    patient_score: average(buckets.patient),
  };
};

/** Lee el consentimiento del usuario (o null si no ha consentido). */
export const getConsent = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from(CONSENT_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

/** Guarda (upsert) el consentimiento del usuario con la versión actual. */
export const saveConsent = async (userId) => {
  if (!userId) throw new Error("userId requerido");

  const { data, error } = await supabase
    .from(CONSENT_TABLE)
    .upsert(
      { user_id: userId, version: CONSENT_VERSION },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

/** Historial de evaluaciones, más reciente primero. */
export const getAssessments = async (userId) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from(ASSESSMENTS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeAssessment);
};

/** Guarda una nueva evaluación calculando las puntuaciones. */
export const saveAssessment = async (userId, answers) => {
  if (!userId) throw new Error("userId requerido");

  const scores = calculateCbiScores(answers);

  const { data, error } = await supabase
    .from(ASSESSMENTS_TABLE)
    .insert({
      user_id: userId,
      answers,
      personal_score: scores.personal_score,
      work_score: scores.work_score,
      patient_score: scores.patient_score,
    })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeAssessment(data);
};

/** Borra todo el historial de evaluaciones del usuario (RGPD Art. 17). */
export const deleteAllAssessments = async (userId) => {
  if (!userId) throw new Error("userId requerido");

  const { error } = await supabase
    .from(ASSESSMENTS_TABLE)
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
  return true;
};

/** True si la fecha pertenece al mes natural actual. */
const isInCurrentMonth = (isoDate) => {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
};

/**
 * ¿Toca el recordatorio mensual? (solo para el nudge in-app, no bloquea nada).
 * @param {Array} assessments - historial ordenado desc.
 */
export const isAssessmentDueThisMonth = (assessments = []) => {
  const last = assessments[0];
  return !last || !isInCurrentMonth(last.created_at);
};
