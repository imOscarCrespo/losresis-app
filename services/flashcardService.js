import { supabase } from "../config/supabase";
import { deviceTimeZone, normalizePreferences } from "../utils/flashcards";

/**
 * Tarjetas de repaso de ResiNotes (ClickUp 124b4z9w0z0).
 *
 * Tablas resinotes_flashcards y resinotes_flashcard_reviews (migración
 * losresis-db 20261112120000_resinotes_flashcards.sql). Todo es del dueño por
 * RLS. La app solo puede escribir la pregunta, la respuesta, el estado y el
 * borrado; la fuente la comprueba la BD al guardar y la programación la
 * calcula resinotes_review_flashcard.
 */

const LIST_LIMIT = 2000;
const QUEUE_LIMIT = 100;

const CARD_COLUMNS =
  "id, source_item_id, source_excerpt, source_locator, source_version_at, source_state, question, answer, origin, status, due_on, interval_days, review_count, lapse_count, learning_state, last_rating, last_reviewed_at, created_at, updated_at, deleted_at";
const CARD_WITH_SOURCE = `${CARD_COLUMNS}, source:resinotes_items(id, title, folder_id, deleted_at)`;

const raise = (error, context) => {
  console.error(`ResiNotes tarjetas · ${context}:`, error);
  const err = new Error(error?.message || "Error en las tarjetas");
  err.code = error?.code;
  err.cause = error;
  throw err;
};

/** Mensaje para el usuario a partir de un error de la BD o de red. */
export const flashcardErrorMessage = (error, fallback = "No se ha podido guardar. Inténtalo de nuevo.") => {
  const message = String(error?.message || "");
  if (message.includes("resinotes_flashcard_source_changed")) {
    return "El apunte ha cambiado mientras revisabas las tarjetas. Vuelve a prepararlas.";
  }
  if (message.includes("resinotes_item_not_found")) return "El apunte original ya no está disponible.";
  if (message.includes("resinotes_flashcard_answer_not_in_source")) {
    return "Una de las respuestas ya no coincide con tu apunte. Vuelve a prepararlas.";
  }
  if (message.includes("resinotes_flashcard_suspended")) return "Esta tarjeta está suspendida.";
  if (message.includes("resinotes_flashcard_not_found")) return "Esta tarjeta ya no existe.";
  if (message.includes("resinotes_flashcards_question_check") || message.includes("resinotes_flashcards_answer_check")) {
    return "La pregunta y la respuesta no pueden quedar vacías.";
  }
  if (/network|fetch|timeout/i.test(message)) return "Sin conexión. Revisa tu conexión e inténtalo de nuevo.";
  return fallback;
};

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** Todas las tarjetas vivas del residente (o las de un apunte), con su fuente. */
export const listFlashcards = async (userId, { sourceItemId = null } = {}) => {
  let query = supabase
    .from("resinotes_flashcards")
    .select(CARD_WITH_SOURCE)
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (sourceItemId) query = query.eq("source_item_id", sourceItemId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) raise(error, "listFlashcards");
  return data || [];
};

export const getFlashcard = async (cardId) => {
  const { data, error } = await supabase
    .from("resinotes_flashcards")
    .select(CARD_WITH_SOURCE)
    .eq("id", cardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) raise(error, "getFlashcard");
  return data;
};

const reviewableQuery = (userId) =>
  supabase
    .from("resinotes_flashcards")
    .select(CARD_WITH_SOURCE)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("source_state", "ok")
    .is("deleted_at", null);

/**
 * Lo necesario para montar el repaso de hoy (utils/flashcards buildTodayQueue
 * y buildMoreQueue): tarjetas vencidas, nuevas y próximas, lo repasado hoy y
 * cuántas tarjetas tiene en total.
 */
export const loadReviewData = async (userId, today) => {
  const [due, fresh, future, reviews, total] = await Promise.all([
    reviewableQuery(userId).lte("due_on", today).order("due_on", { ascending: true }).limit(QUEUE_LIMIT),
    reviewableQuery(userId).is("due_on", null).order("created_at", { ascending: true }).limit(QUEUE_LIMIT),
    reviewableQuery(userId).gt("due_on", today).order("due_on", { ascending: true }).limit(QUEUE_LIMIT),
    supabase
      .from("resinotes_flashcard_reviews")
      .select("flashcard_id, rating, reviewed_at, previous_due_on")
      .eq("user_id", userId)
      .eq("local_date", today)
      .order("reviewed_at", { ascending: true })
      .limit(LIST_LIMIT),
    supabase
      .from("resinotes_flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
  ]);
  [due, fresh, future, reviews, total].forEach((res, idx) => {
    if (res.error) raise(res.error, `loadReviewData ${idx}`);
  });
  const reviewRows = reviews.data || [];
  return {
    cards: [...(due.data || []), ...(fresh.data || []), ...(future.data || [])],
    reviews: reviewRows,
    reviewedTodayIds: Array.from(new Set(reviewRows.map((r) => r.flashcard_id))),
    // Tarjetas nuevas repasadas hoy (su primer repaso), para el límite de nuevas.
    newReviewedToday: new Set(reviewRows.filter((r) => !r.previous_due_on).map((r) => r.flashcard_id)).size,
    totalCards: total.count || 0,
  };
};

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/**
 * Guarda las propuestas aprobadas de un apunte. Las que el residente ha
 * editado van como 'generated_edited'. Es un único INSERT: si el apunte ha
 * cambiado, la BD rechaza el lote entero y no se guarda ninguna a medias.
 */
export const saveProposals = async (userId, itemId, proposals = []) => {
  if (!proposals.length) return [];
  const rows = proposals.map((p) => ({
    user_id: userId,
    source_item_id: itemId,
    source_excerpt: p.excerpt,
    source_locator: p.locator || null,
    question: String(p.question).trim(),
    answer: String(p.answer).trim(),
    origin: p.edited ? "generated_edited" : "generated",
  }));
  const { data, error } = await supabase.from("resinotes_flashcards").insert(rows).select(CARD_COLUMNS);
  if (error) raise(error, "saveProposals");
  return data || [];
};

export const createManualFlashcard = async (userId, { question, answer }) => {
  const { data, error } = await supabase
    .from("resinotes_flashcards")
    .insert({ user_id: userId, question: String(question).trim(), answer: String(answer).trim(), origin: "manual" })
    .select(CARD_WITH_SOURCE)
    .single();
  if (error) raise(error, "createManualFlashcard");
  return data;
};

const updateCard = async (cardId, payload, context) => {
  const { data, error } = await supabase
    .from("resinotes_flashcards")
    .update(payload)
    .eq("id", cardId)
    .select(CARD_WITH_SOURCE)
    .single();
  if (error) raise(error, context);
  return data;
};

/** Editar no cambia la programación de esta ni de ninguna otra tarjeta. */
export const updateFlashcard = (cardId, { question, answer }) =>
  updateCard(cardId, { question: String(question).trim(), answer: String(answer).trim() }, "updateFlashcard");

export const setFlashcardStatus = (cardId, status) => updateCard(cardId, { status }, "setFlashcardStatus");

export const deleteFlashcard = async (cardId) => {
  const { error } = await supabase
    .from("resinotes_flashcards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cardId);
  if (error) raise(error, "deleteFlashcard");
};

/**
 * «Actualizar a mano» de una tarjeta con la fuente modificada: edita y la
 * mantiene en una sola transacción (RPC resinotes_update_flashcard_and_keep).
 */
export const updateAndKeepFlashcard = async (cardId, { question, answer }) => {
  const { data, error } = await supabase.rpc("resinotes_update_flashcard_and_keep", {
    p_flashcard_id: cardId,
    p_question: String(question).trim(),
    p_answer: String(answer).trim(),
  });
  if (error) raise(error, "updateAndKeepFlashcard");
  return data;
};

/** «Mantener tarjeta» cuando el apunte ha cambiado. */
export const keepFlashcard = async (cardId) => {
  const { error } = await supabase.rpc("resinotes_keep_flashcard", { p_flashcard_id: cardId });
  if (error) raise(error, "keepFlashcard");
};

/**
 * Guarda una autoevaluación. clientReviewId hace que repetirla (doble toque,
 * reintento) no cuente dos veces. Devuelve la tarjeta con su próxima fecha.
 */
export const reviewFlashcard = async ({ cardId, rating, clientReviewId, localDate }) => {
  const { data, error } = await supabase.rpc("resinotes_review_flashcard", {
    p_flashcard_id: cardId,
    p_rating: rating,
    p_client_review_id: clientReviewId,
    p_local_date: localDate,
  });
  if (error) raise(error, "reviewFlashcard");
  return data;
};

// ---------------------------------------------------------------------------
// Configuración de repaso (resinotes_review_preferences)
// ---------------------------------------------------------------------------

const PREFERENCE_COLUMNS =
  "daily_card_limit, new_card_limit, review_enabled, reminders_enabled, reminder_time, timezone, active_weekdays, included_folder_ids, paused_until, snoozed_until";

/** Preferencias del residente; sin fila, los valores por defecto. */
export const getReviewPreferences = async (userId) => {
  const { data, error } = await supabase
    .from("resinotes_review_preferences")
    .select(PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) raise(error, "getReviewPreferences");
  return { ...normalizePreferences(data), saved: Boolean(data) };
};

/**
 * Guarda un cambio de preferencias (upsert). Siempre manda la zona horaria del
 * dispositivo: los recordatorios se calculan con ella.
 */
export const saveReviewPreferences = async (userId, patch = {}) => {
  const allowed = PREFERENCE_COLUMNS.split(", ");
  const row = { user_id: userId };
  allowed.forEach((key) => {
    if (patch[key] !== undefined) row[key] = patch[key];
  });
  const tz = deviceTimeZone();
  if (tz) row.timezone = tz;
  const { data, error } = await supabase
    .from("resinotes_review_preferences")
    .upsert(row, { onConflict: "user_id" })
    .select(PREFERENCE_COLUMNS)
    .single();
  if (error) raise(error, "saveReviewPreferences");
  return { ...normalizePreferences(data), saved: true };
};

/** «Restablecer programación»: todas vuelven a nuevas, sin borrar nada. Devuelve cuántas. */
export const resetSchedules = async () => {
  const { data, error } = await supabase.rpc("resinotes_reset_flashcard_schedules");
  if (error) raise(error, "resetSchedules");
  return data || 0;
};

export default {
  listFlashcards,
  getFlashcard,
  loadReviewData,
  saveProposals,
  createManualFlashcard,
  updateFlashcard,
  setFlashcardStatus,
  deleteFlashcard,
  keepFlashcard,
  updateAndKeepFlashcard,
  reviewFlashcard,
  getReviewPreferences,
  saveReviewPreferences,
  resetSchedules,
};
