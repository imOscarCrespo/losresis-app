import { supabase } from "../config/supabase";

// Banco de preguntas MIR (mir_questions + mir_question_attempts +
// mir_user_question_state, migración 20260802130000 de losresis-db).
//
// Mecánica del drill sin repetición: se sirven primero preguntas nunca
// respondidas en modo drill (aleatorio entre ellas); agotado el pool del
// filtro se avisa (roundCompleted) y se continúa por las menos recientemente
// respondidas. Los intentos en modo 'review' (re-práctica desde Repaso) no
// alteran ese orden. is_correct lo calcula el servidor: aquí nunca se decide.

const QUESTION_FIELDS =
  "id, source_id, exam_year, specialty, clinical_case, question, options, " +
  "n_options, correct_option, explanation, has_image, image_url, " +
  "times_answered, times_failed";

const shuffleValue = () => Math.random();

/**
 * Especialidades y años disponibles entre las preguntas activas, para los
 * filtros del drill.
 */
export const getMirFilterOptions = async () => {
  try {
    const { data, error } = await supabase
      .from("mir_questions")
      .select("specialty, exam_year")
      .eq("is_active", true);

    if (error) throw error;

    const specialties = [
      ...new Set((data || []).map((row) => row.specialty).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es"));

    const years = [
      ...new Set((data || []).map((row) => row.exam_year).filter(Boolean)),
    ].sort((a, b) => b - a);

    return { success: true, specialties, years };
  } catch (error) {
    console.error("Error loading MIR filter options:", error);
    return { success: false, specialties: [], years: [] };
  }
};

const buildCandidatesQuery = (filters = {}) => {
  let query = supabase
    .from("mir_questions")
    .select("id")
    .eq("is_active", true);

  if (filters.specialty) query = query.eq("specialty", filters.specialty);
  if (filters.examYear) query = query.eq("exam_year", filters.examYear);

  return query;
};

/**
 * Pool del drill para unos filtros: ids de preguntas candidatas y cuándo
 * respondió el usuario cada una en modo drill. Se carga UNA vez por cambio de
 * filtro (cuidar el egress); la elección de la siguiente pregunta es local
 * con pickNextFromPool.
 */
export const getMirDrillPool = async (userId, filters = {}) => {
  try {
    const [{ data: candidates, error: candidatesError }, { data: stateRows, error: stateError }] =
      await Promise.all([
        buildCandidatesQuery(filters),
        supabase
          .from("mir_user_question_state")
          .select("question_id, last_drill_answered_at")
          .eq("user_id", userId)
          .not("last_drill_answered_at", "is", null),
      ]);

    if (candidatesError) throw candidatesError;
    if (stateError) throw stateError;

    const answeredAt = {};
    (stateRows || []).forEach((row) => {
      answeredAt[row.question_id] = row.last_drill_answered_at;
    });

    return {
      success: true,
      candidateIds: (candidates || []).map((row) => row.id),
      answeredAt,
    };
  } catch (error) {
    console.error("Error loading MIR drill pool:", error);
    return { success: false, candidateIds: [], answeredAt: {} };
  }
};

/**
 * Elige la siguiente pregunta del pool: aleatoria entre las nunca
 * respondidas; si no queda ninguna (ronda completada), la menos reciente.
 * Pura y síncrona: no toca red.
 */
export const pickNextFromPool = (candidateIds, answeredAt) => {
  if (!candidateIds || candidateIds.length === 0) {
    return { questionId: null, answeredInPool: 0, roundCompleted: false };
  }

  const unanswered = candidateIds.filter((id) => !answeredAt[id]);
  const answeredInPool = candidateIds.length - unanswered.length;

  if (unanswered.length > 0) {
    return {
      questionId: unanswered[Math.floor(shuffleValue() * unanswered.length)],
      answeredInPool,
      roundCompleted: false,
    };
  }

  const leastRecent = candidateIds
    .slice()
    .sort((a, b) => String(answeredAt[a]).localeCompare(String(answeredAt[b])))[0];

  return { questionId: leastRecent, answeredInPool, roundCompleted: true };
};

/** Una pregunta concreta con el estado personal del usuario (o null). */
export const getMirQuestion = async (userId, questionId) => {
  try {
    const [{ data: question, error: questionError }, { data: state, error: stateError }] =
      await Promise.all([
        supabase
          .from("mir_questions")
          .select(QUESTION_FIELDS)
          .eq("id", questionId)
          .single(),
        supabase
          .from("mir_user_question_state")
          .select("is_important, note, times_correct, times_failed")
          .eq("user_id", userId)
          .eq("question_id", questionId)
          .maybeSingle(),
      ]);

    if (questionError) throw questionError;
    if (stateError) throw stateError;

    return { success: true, question, state: state || null };
  } catch (error) {
    console.error("Error loading MIR question:", error);
    return { success: false, question: null, state: null };
  }
};

/**
 * Registra una respuesta. El trigger del servidor valida la opción y calcula
 * is_correct contra la plantilla oficial; devolvemos su veredicto.
 * @param {"drill"|"review"} mode
 */
export const submitMirAnswer = async (userId, questionId, selectedOption, mode = "drill") => {
  try {
    const { data, error } = await supabase
      .from("mir_question_attempts")
      .insert({
        user_id: userId,
        question_id: questionId,
        selected_option: selectedOption,
        mode,
      })
      .select("is_correct")
      .single();

    if (error) throw error;

    return { success: true, isCorrect: data.is_correct };
  } catch (error) {
    console.error("Error submitting MIR answer:", error);
    return { success: false, isCorrect: null };
  }
};

/** Marca o desmarca una pregunta como importante. */
export const setMirQuestionImportant = async (userId, questionId, isImportant) => {
  try {
    const { error } = await supabase.from("mir_user_question_state").upsert(
      {
        user_id: userId,
        question_id: questionId,
        is_important: isImportant,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,question_id" }
    );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error setting MIR question importance:", error);
    return { success: false };
  }
};

/** Guarda (o borra con null/"") la nota personal de una pregunta. */
export const saveMirQuestionNote = async (userId, questionId, note) => {
  try {
    const trimmed = (note || "").trim();
    const { error } = await supabase.from("mir_user_question_state").upsert(
      {
        user_id: userId,
        question_id: questionId,
        note: trimmed.length > 0 ? trimmed : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,question_id" }
    );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error saving MIR question note:", error);
    return { success: false };
  }
};

/**
 * Listas de Repaso: importantes, con nota y falladas, con la pregunta
 * embebida. Una sola consulta; el cliente separa.
 */
export const getMirReviewLists = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("mir_user_question_state")
      .select(
        "question_id, is_important, note, times_correct, times_failed, updated_at, " +
          "mir_questions (id, source_id, exam_year, specialty, question, has_image)"
      )
      .eq("user_id", userId)
      .or("is_important.eq.true,note.not.is.null,times_failed.gt.0")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data || []).filter((row) => row.mir_questions);
    return {
      success: true,
      important: rows.filter((row) => row.is_important),
      withNote: rows.filter((row) => row.note),
      failed: rows
        .filter((row) => row.times_failed > 0)
        .sort((a, b) => b.times_failed - a.times_failed),
    };
  } catch (error) {
    console.error("Error loading MIR review lists:", error);
    return { success: false, important: [], withNote: [], failed: [] };
  }
};

/**
 * Ranking global de preguntas más falladas y más fáciles entre las que ya
 * tienen alguna respuesta de la comunidad. Con pocos datos el porcentaje es
 * ruidoso, pero un umbral alto dejaría la pestaña vacía al principio; el
 * desempate por times_answered ya favorece a las preguntas con más muestras.
 */
export const getMirQuestionRanking = async ({ minAnswers = 1, limit = 10 } = {}) => {
  try {
    const { data, error } = await supabase
      .from("mir_questions")
      .select(
        "id, source_id, exam_year, specialty, question, times_answered, times_failed"
      )
      .eq("is_active", true)
      .gte("times_answered", minAnswers);

    if (error) throw error;

    const withRate = (data || []).map((row) => ({
      ...row,
      failRate: row.times_answered > 0 ? row.times_failed / row.times_answered : 0,
    }));

    return {
      success: true,
      hardest: withRate
        .slice()
        .sort((a, b) => b.failRate - a.failRate || b.times_answered - a.times_answered)
        .slice(0, limit),
      easiest: withRate
        .slice()
        .sort((a, b) => a.failRate - b.failRate || b.times_answered - a.times_answered)
        .slice(0, limit),
    };
  } catch (error) {
    console.error("Error loading MIR question ranking:", error);
    return { success: false, hardest: [], easiest: [] };
  }
};

/** Resumen personal para la cabecera: respondidas, aciertos y fallos totales. */
export const getMirUserSummary = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("mir_user_question_state")
      .select("times_correct, times_failed, is_important, note")
      .eq("user_id", userId);

    if (error) throw error;

    const rows = data || [];
    const totals = rows.reduce(
      (acc, row) => {
        acc.correct += row.times_correct;
        acc.failed += row.times_failed;
        return acc;
      },
      { correct: 0, failed: 0 }
    );

    return {
      success: true,
      answeredQuestions: rows.filter((r) => r.times_correct + r.times_failed > 0).length,
      totalCorrect: totals.correct,
      totalFailed: totals.failed,
      importantCount: rows.filter((r) => r.is_important).length,
      noteCount: rows.filter((r) => r.note).length,
    };
  } catch (error) {
    console.error("Error loading MIR user summary:", error);
    return {
      success: false,
      answeredQuestions: 0,
      totalCorrect: 0,
      totalFailed: 0,
      importantCount: 0,
      noteCount: 0,
    };
  }
};
