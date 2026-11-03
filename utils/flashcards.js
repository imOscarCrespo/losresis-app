import { descendantIds, htmlToPlainText } from "./resinotes";

/**
 * Tarjetas de repaso de ResiNotes (ClickUp 124b4z9w0z0 y 124b4z9w5nh).
 *
 * Sin generación automática (retirada en 124b4z9w5nh): el residente crea sus
 * preguntas a mano (desde una nota, o desde un texto seleccionado que pasa a
 * ser la respuesta) o guarda una nota entera como tarjeta de «Apunte
 * completo» (card_type = 'note', que enseña siempre el contenido actual de la
 * nota). Las tarjetas generadas antes se conservan y se repasan igual.
 *
 * La programación (repetición espaciada) se calcula en la BD
 * (resinotes_review_flashcard); aquí solo se decide qué toca repasar hoy.
 */

export const DAILY_CARD_LIMIT = 5;
export const MORE_BATCH_SIZE = 5;
export const SECONDS_PER_CARD = 36;
export const MAX_QUESTION_CHARS = 500;
export const MAX_ANSWER_LENGTH = 4000;

export const RATINGS = {
  again: { label: "Otra vez", summary: "necesitas reforzar", icon: "close", bg: "#FDE8EF", fg: "#DB2777" },
  hard: { label: "Me costó", summary: "te ha costado", icon: "remove", bg: "#FEF6DC", fg: "#D97706" },
  good: { label: "Fácil", summary: "las sabías", icon: "checkmark", bg: "#E3F6EA", fg: "#16A34A" },
};
export const RATING_KEYS = ["again", "hard", "good"];

/** Tipo de tarjeta (ClickUp 124b4z9w5nh). Las anteriores son todas 'qa'. */
export const CARD_TYPES = {
  qa: { label: "Pregunta y respuesta", icon: "help-circle-outline" },
  note: { label: "Apunte completo", icon: "document-text-outline" },
};
export const cardType = (card) => (card?.card_type === "note" ? "note" : "qa");

/** Lo que se enseña como «pregunta»: en una tarjeta de apunte, el título actual de la nota. */
export const cardFrontText = (card) =>
  cardType(card) === "note" ? card?.source?.title || card?.question || "Nota sin título" : card?.question || "";

export const ORIGIN_LABELS = {
  generated: "Creada desde tu apunte",
  generated_edited: "Creada desde tu apunte y editada por ti",
  manual: "Creada por ti",
};

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Igual que resinotes_normalize_text en la BD: cualquier espacio -> uno. */
export const normalizeText = (value) =>
  String(value ?? "")
    .replace(/[ \t\n\r\f\v ]+/g, " ")
    .replace(/^ +| +$/g, "");

/** ¿Está `needle` dentro de `haystack`? Igual que resinotes_text_contains. */
export const textContains = (haystack, needle) => {
  const n = normalizeText(needle);
  return n !== "" && normalizeText(haystack).includes(n);
};

export const fingerprint = (question, answer) =>
  `${normalizeText(question).toLowerCase()}|${normalizeText(answer).toLowerCase()}`;

/** Las líneas de una respuesta (una lista se pinta con viñetas). */
export const answerLines = (answer) =>
  String(answer || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Estudiar una nota (ClickUp 124b4z9w5nh)
// ---------------------------------------------------------------------------

/** ¿Tiene la nota algo que repasar? Texto o, al menos, una imagen. */
export const noteHasStudyContent = (html) =>
  normalizeText(htmlToPlainText(html)) !== "" || /<img\b/i.test(String(html || ""));

/**
 * «Crear pregunta» desde un texto seleccionado: la selección (HTML del editor)
 * pasa a texto y es la respuesta, con una línea por párrafo o elemento de
 * lista. Recortada al máximo de la BD.
 */
export const selectionToAnswer = (selectionHtml) =>
  htmlToPlainText(selectionHtml || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_ANSWER_LENGTH);

/** Pregunta y respuesta obligatorias (sin contar espacios). */
export const isValidQuestion = ({ question, answer } = {}) =>
  normalizeText(question) !== "" && normalizeText(answer) !== "";

/** «Tienes 5 tarjetas para repasar». */
export const formatPendingReview = (n) => `Tienes ${n} ${n === 1 ? "tarjeta" : "tarjetas"} para repasar`;

// ---------------------------------------------------------------------------
// Fechas (días locales, 'YYYY-MM-DD')
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");

export const localDateString = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const dayNumber = (ymd) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

export const daysBetween = (fromYmd, toYmd) => dayNumber(toYmd) - dayNumber(fromYmd);

export const formatNextReview = (dueOn, today) => {
  if (!dueOn) return "Nueva";
  const diff = daysBetween(today, dueOn);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return `En ${diff} días`;
};

export const estimateMinutes = (cards, secondsPerCard = SECONDS_PER_CARD) =>
  Math.max(1, Math.round((cards * secondsPerCard) / 60));

export const formatPending = (n) => `${n} ${n === 1 ? "tarjeta pendiente" : "tarjetas pendientes"}`;
export const formatCardCount = (n) => `${n} ${n === 1 ? "tarjeta" : "tarjetas"}`;

// ---------------------------------------------------------------------------
// Cola de repaso
// ---------------------------------------------------------------------------

/** Puede entrar en un repaso: activa, no borrada y con su fuente disponible. */
export const isReviewable = (card) =>
  Boolean(card) && !card.deleted_at && card.status === "active" && card.source_state === "ok";

const byDue = (a, b) =>
  String(a.due_on).localeCompare(String(b.due_on)) ||
  (b.lapse_count || 0) - (a.lapse_count || 0) ||
  String(a.last_reviewed_at || "").localeCompare(String(b.last_reviewed_at || ""));
const byCreated = (a, b) => String(a.created_at || "").localeCompare(String(b.created_at || ""));

const uniqueById = (cards) => {
  const seen = new Set();
  return cards.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
};

/**
 * Carpetas incluidas en el repaso (configuración de repaso), con sus
 * subcarpetas. null = todas. Los ids de carpetas que ya no existen se ignoran
 * y, si no queda ninguna, cuenta como todas. Igual que
 * resinotes_review_pending_count en la BD.
 */
export const includedFolderSet = (folders = [], includedIds = null) => {
  if (!Array.isArray(includedIds) || !includedIds.length) return null;
  const alive = folders.filter((f) => !f.deleted_at);
  const known = new Set(alive.map((f) => f.id));
  const roots = includedIds.filter((id) => known.has(id));
  if (!roots.length) return null;
  const set = new Set(roots);
  roots.forEach((id) => descendantIds(alive, id).forEach((d) => set.add(d)));
  return set;
};

/** ¿Entra la tarjeta con este filtro de carpetas? Las tarjetas sin apunte entran siempre. */
export const cardInFolders = (card, folderSet) => {
  if (!folderSet) return true;
  if (!card.source_item_id) return true;
  return folderSet.has(card.source?.folder_id ?? null);
};

/**
 * El repaso de hoy: primero las vencidas (las más antiguas y las más falladas),
 * después las nuevas (hasta el límite de nuevas menos las nuevas ya repasadas
 * hoy), y todo hasta el límite diario menos lo ya repasado hoy. Igual que
 * resinotes_review_pending_count en la BD, que decide los recordatorios.
 */
export const buildTodayQueue = ({
  cards = [],
  reviewedTodayIds = [],
  newReviewedToday = 0,
  today,
  limit = DAILY_CARD_LIMIT,
  newLimit = Infinity,
  folderSet = null,
}) => {
  const reviewed = new Set(reviewedTodayIds);
  const eligible = uniqueById(cards).filter((c) => isReviewable(c) && !reviewed.has(c.id) && cardInFolders(c, folderSet));
  const due = eligible.filter((c) => c.due_on && c.due_on <= today).sort(byDue);
  const fresh = eligible.filter((c) => !c.due_on).sort(byCreated);
  const remaining = Math.max(0, limit - reviewed.size);
  const freshAllowed = Math.max(0, newLimit - newReviewedToday);
  return {
    queue: [...due, ...fresh.slice(0, freshAllowed)].slice(0, remaining),
    reviewedToday: reviewed.size,
    dueCount: due.length,
    newCount: fresh.length,
  };
};

/**
 * «Repasar otras tarjetas» (práctica, no cambia la programación): lo vencido o
 * nuevo que no ha entrado hoy y después lo más próximo.
 */
export const buildMoreQueue = ({ cards = [], reviewedTodayIds = [], today, size = MORE_BATCH_SIZE, folderSet = null }) => {
  const reviewed = new Set(reviewedTodayIds);
  const eligible = uniqueById(cards).filter((c) => isReviewable(c) && !reviewed.has(c.id) && cardInFolders(c, folderSet));
  const due = eligible.filter((c) => c.due_on && c.due_on <= today).sort(byDue);
  const fresh = eligible.filter((c) => !c.due_on).sort(byCreated);
  const future = eligible.filter((c) => c.due_on && c.due_on > today).sort(byDue);
  return [...due, ...fresh, ...future].slice(0, size);
};

/** Resumen del día a partir de los repasos de hoy: cuenta la primera nota de cada tarjeta. */
export const summarizeReviews = (reviews = []) => {
  const first = new Map();
  [...reviews]
    .sort((a, b) => String(a.reviewed_at).localeCompare(String(b.reviewed_at)))
    .forEach((r) => {
      if (!first.has(r.flashcard_id)) first.set(r.flashcard_id, r.rating);
    });
  const counts = { total: first.size, again: 0, hard: 0, good: 0 };
  first.forEach((rating) => {
    if (counts[rating] !== undefined) counts[rating] += 1;
  });
  return counts;
};

// ---------------------------------------------------------------------------
// Estados y textos
// ---------------------------------------------------------------------------

/** Estado que se enseña en Mis tarjetas. */
export const cardDisplayState = (card) => {
  if (card.source_state === "missing") return "missing";
  if (card.source_state === "modified") return "modified";
  return card.status === "suspended" ? "suspended" : "active";
};

export const CARD_STATES = {
  active: { label: "Activa", bg: "#E3F6EA", fg: "#15803D" },
  suspended: { label: "Suspendida", bg: "#EEF0F4", fg: "#475569" },
  modified: { label: "Fuente modificada", bg: "#FEF3C7", fg: "#B45309" },
  missing: { label: "Fuente no disponible", bg: "#FDE8EF", fg: "#BE185D" },
};

export const filterCards = (cards = [], { tab = "all", query = "", folderId = null } = {}) => {
  const q = normalizeText(query).toLowerCase();
  return cards.filter((card) => {
    if (card.deleted_at) return false;
    const state = cardDisplayState(card);
    if (tab === "active" && state !== "active") return false;
    if (tab === "suspended" && state !== "suspended") return false;
    if (tab === "review" && state !== "modified" && state !== "missing") return false;
    if (folderId !== null && (card.source?.folder_id || null) !== folderId) return false;
    if (!q) return true;
    return (
      normalizeText(cardFrontText(card)).toLowerCase().includes(q) ||
      normalizeText(card.question).toLowerCase().includes(q) ||
      normalizeText(card.answer).toLowerCase().includes(q) ||
      normalizeText(card.source?.title).toLowerCase().includes(q)
    );
  });
};

/** Clave de idempotencia de una respuesta (UUID v4). */
export const newClientReviewId = (random = Math.random) =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(random() * 16);
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

// ---------------------------------------------------------------------------
// Configuración de repaso (resinotes_review_preferences)
// ---------------------------------------------------------------------------

export const WEEKDAYS = [
  { key: 1, short: "L", label: "Lunes" },
  { key: 2, short: "M", label: "Martes" },
  { key: 3, short: "X", label: "Miércoles" },
  { key: 4, short: "J", label: "Jueves" },
  { key: 5, short: "V", label: "Viernes" },
  { key: 6, short: "S", label: "Sábado" },
  { key: 7, short: "D", label: "Domingo" },
];

/** Sin fila en la BD = estos valores (los mismos defaults que la tabla). */
export const DEFAULT_REVIEW_PREFERENCES = Object.freeze({
  daily_card_limit: DAILY_CARD_LIMIT,
  new_card_limit: DAILY_CARD_LIMIT,
  review_enabled: true,
  reminders_enabled: false,
  reminder_time: "20:30",
  timezone: null,
  active_weekdays: [1, 2, 3, 4, 5, 6, 7],
  included_folder_ids: null,
  paused_until: null,
  snoozed_until: null,
});

export const DAILY_LIMIT_OPTIONS = [3, 5, 10, 15];
export const NEW_LIMIT_OPTIONS = [0, 3, 5, 10, 15];
export const MAX_CARD_LIMIT = 100;

const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** «20:30:00» o «20:30» -> «20:30». */
export const formatTime = (value) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  if (!m) return DEFAULT_REVIEW_PREFERENCES.reminder_time;
  const h = clampInt(m[1], 0, 23, 20);
  const min = clampInt(m[2], 0, 59, 30);
  return `${pad(h)}:${pad(min)}`;
};

/** Una fila de la BD (o null) -> preferencias completas y válidas. */
export const normalizePreferences = (row) => {
  const p = { ...DEFAULT_REVIEW_PREFERENCES, ...(row || {}) };
  const weekdays = Array.isArray(p.active_weekdays) ? p.active_weekdays.map(Number) : DEFAULT_REVIEW_PREFERENCES.active_weekdays;
  return {
    daily_card_limit: clampInt(p.daily_card_limit, 1, MAX_CARD_LIMIT, DAILY_CARD_LIMIT),
    new_card_limit: clampInt(p.new_card_limit, 0, MAX_CARD_LIMIT, DAILY_CARD_LIMIT),
    review_enabled: p.review_enabled !== false,
    reminders_enabled: p.reminders_enabled === true,
    reminder_time: formatTime(p.reminder_time),
    timezone: p.timezone || null,
    active_weekdays: Array.from(new Set(weekdays.filter((d) => d >= 1 && d <= 7))).sort((a, b) => a - b),
    included_folder_ids: Array.isArray(p.included_folder_ids) && p.included_folder_ids.length ? p.included_folder_ids : null,
    paused_until: p.paused_until || null,
    snoozed_until: p.snoozed_until || null,
  };
};

/** En pausa mientras hoy < paused_until (el día en que se reanudan). */
export const isPaused = (prefs, today) => Boolean(prefs?.paused_until) && String(today) < String(prefs.paused_until);

/** Zona horaria IANA del dispositivo (null si no se puede saber). */
export const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

export const addDays = (ymd, days) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** «2026-11-09» -> «9 nov». */
export const formatDay = (ymd) => {
  const [, m, d] = String(ymd).split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : "";
};

export const PAUSE_OPTIONS = [
  { days: 3, label: "3 días" },
  { days: 7, label: "1 semana" },
  { days: 14, label: "2 semanas" },
  { days: 30, label: "1 mes" },
];

/** Resumen de los días activos: «Todos los días», «L M X J V», «Ninguno». */
export const formatWeekdays = (days = []) => {
  const set = new Set(days);
  if (set.size === 7) return "Todos los días";
  if (!set.size) return "Ninguno";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "De lunes a viernes";
  return WEEKDAYS.filter((w) => set.has(w.key))
    .map((w) => w.short)
    .join(" ");
};

const atLocalTime = (base, dayOffset, hhmm) => {
  const [h, m] = formatTime(hhmm).split(":").map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, h, m, 0, 0);
};

export const TONIGHT_TIME = "22:00";

/**
 * Opciones de «Posponer» el aviso de hoy, con el instante (snoozed_until) de
 * cada una. «Esta noche» solo sale antes de las 21:00.
 */
export const snoozeOptions = (now = new Date(), reminderTime = DEFAULT_REVIEW_PREFERENCES.reminder_time) => {
  const options = [{ key: "hour", label: "En 1 hora", at: new Date(now.getTime() + 60 * 60 * 1000) }];
  const tonight = atLocalTime(now, 0, TONIGHT_TIME);
  if (tonight.getTime() - now.getTime() >= 60 * 60 * 1000) {
    options.push({ key: "tonight", label: "Esta noche", description: `A las ${TONIGHT_TIME}`, at: tonight });
  }
  options.push({
    key: "tomorrow",
    label: "Mañana",
    description: `A las ${formatTime(reminderTime)}`,
    at: atLocalTime(now, 1, reminderTime),
  });
  return options;
};

const pluralCards = (n) => (n === 1 ? "1 tarjeta" : `${n} tarjetas`);

/** Texto de la fila «Tarjetas por día» / «Tarjetas nuevas». */
export const formatLimit = (n) => (n === 0 ? "Ninguna" : pluralCards(n));
