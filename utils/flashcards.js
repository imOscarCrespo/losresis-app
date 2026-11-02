import { descendantIds, htmlToPlainText } from "./resinotes";

/**
 * Tarjetas de repaso de ResiNotes (ClickUp 124b4z9w0z0).
 *
 * Generación SIN IA: las propuestas salen de la estructura del apunte
 * (encabezados con su contenido, listas con una línea «Etiqueta:» delante,
 * líneas «Término: definición» y filas de tabla). La respuesta es siempre texto
 * literal del apunte y cada propuesta lleva el fragmento del que sale
 * (excerpt), que la BD vuelve a comprobar al guardar
 * (losresis-db 20261112120000_resinotes_flashcards.sql). Si el apunte no tiene
 * estructura suficiente, no se inventa nada: no salen tarjetas.
 *
 * La programación (repetición espaciada) se calcula en la BD
 * (resinotes_review_flashcard); aquí solo se decide qué toca repasar hoy.
 */

export const DAILY_CARD_LIMIT = 5;
export const MORE_BATCH_SIZE = 5;
export const SECONDS_PER_CARD = 36;
export const MAX_PROPOSALS = 40;
export const MAX_ANSWER_CHARS = 700;
export const MAX_ANSWER_LINES = 15;
export const MAX_LINE_CHARS = 300;
export const MAX_QUESTION_CHARS = 500;

export const RATINGS = {
  again: { label: "No lo sabía", summary: "necesitas reforzar", icon: "close", bg: "#FDE8EF", fg: "#DB2777" },
  hard: { label: "Me costó", summary: "te ha costado", icon: "remove", bg: "#FEF6DC", fg: "#D97706" },
  good: { label: "Lo sabía", summary: "las sabías", icon: "checkmark", bg: "#E3F6EA", fg: "#16A34A" },
};
export const RATING_KEYS = ["again", "hard", "good"];

export const ORIGIN_LABELS = {
  generated: "Creada desde tu apunte",
  generated_edited: "Creada desde tu apunte y editada por ti",
  manual: "Creada a mano",
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
// HTML -> bloques
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set(["br", "img", "hr", "input", "meta", "link", "col", "source", "wbr"]);
const CONTAINER_TAGS = new Set(["div", "blockquote", "section", "article"]);
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>|<!--[\s\S]*?-->/g;

/** Trocea el HTML en sus elementos de primer nivel ({tag, html}). */
export const topLevelElements = (html) => {
  const source = String(html || "");
  const out = [];
  let depth = 0;
  let start = 0;
  let rootTag = null;
  let textStart = 0;
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(source))) {
    if (m[0].startsWith("<!--")) continue;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const selfClosing = m[3] === "/" || VOID_TAGS.has(tag);
    if (depth === 0) {
      const loose = source.slice(textStart, m.index);
      if (loose.trim()) out.push({ tag: "p", html: loose });
      if (closing) {
        textStart = TAG_RE.lastIndex;
        continue;
      }
      if (selfClosing) {
        out.push({ tag, html: m[0] });
        textStart = TAG_RE.lastIndex;
        continue;
      }
      rootTag = tag;
      start = m.index;
      depth = 1;
      continue;
    }
    if (selfClosing) continue;
    if (closing) {
      depth -= 1;
      if (depth === 0) {
        out.push({ tag: rootTag, html: source.slice(start, TAG_RE.lastIndex) });
        textStart = TAG_RE.lastIndex;
      }
    } else {
      depth += 1;
    }
  }
  if (depth > 0) {
    out.push({ tag: rootTag, html: source.slice(start) });
  } else {
    const loose = source.slice(textStart);
    if (loose.trim()) out.push({ tag: "p", html: loose });
  }
  return out;
};

const innerHtml = (html) => String(html).replace(/^<[^>]+>/, "").replace(/<\/[a-zA-Z0-9]+>\s*$/, "");

const tableRows = (html) => {
  const rows = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let r;
  while ((r = rowRe.exec(html))) {
    const cells = [];
    const cellRe = /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let c;
    while ((c = cellRe.exec(r[1]))) {
      cells.push(normalizeText(htmlToPlainText(c[2])));
    }
    rows.push(cells);
  }
  return rows;
};

/**
 * Bloques del apunte en orden: heading | paragraph | list | table. Los bloques
 * especiales (callouts) y las citas se abren y se leen como su contenido.
 */
export const noteBlocks = (html) => {
  const blocks = [];
  const walk = (elements) => {
    elements.forEach(({ tag, html: el }) => {
      if (CONTAINER_TAGS.has(tag)) {
        walk(topLevelElements(innerHtml(el)));
        return;
      }
      if (/^h[1-6]$/.test(tag)) {
        const text = normalizeText(htmlToPlainText(el));
        if (text) blocks.push({ type: "heading", level: Number(tag[1]), text });
        return;
      }
      if (tag === "ul" || tag === "ol") {
        const lines = htmlToPlainText(el)
          .split("\n")
          .map(normalizeText)
          .filter(Boolean);
        if (lines.length) blocks.push({ type: "list", lines });
        return;
      }
      if (tag === "table") {
        const rows = tableRows(el).filter((cells) => cells.some(Boolean));
        if (rows.length) blocks.push({ type: "table", rows });
        return;
      }
      if (VOID_TAGS.has(tag)) return;
      const lines = htmlToPlainText(el)
        .split("\n")
        .map(normalizeText)
        .filter(Boolean);
      if (lines.length) blocks.push({ type: "paragraph", lines });
    });
  };
  walk(topLevelElements(html));
  return blocks;
};

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------

const DEFINITION_RE = /^(definici[oó]n|concepto|qu[eé] es)\b/i;
// «Término: definición» (con espacio tras los dos puntos: deja fuera horas y URLs).
const TERM_RE = /^([^:]{2,60}?)\s*:\s+(\S[\s\S]*)$/;

const cleanLabel = (text) =>
  normalizeText(text)
    .replace(/[\s:.;,·-]+$/u, "")
    .replace(/^[•\-–·*\s]+/u, "");

const sameText = (a, b) => normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const ofTitle = (title, label) => (title && !sameText(title, label) ? ` de «${title}»` : "");

const questionForSection = (label, title, kind) => {
  if (DEFINITION_RE.test(label)) {
    return title ? `¿Cómo define tu apunte «${title}»?` : `¿Qué recoge tu apunte sobre «${label}»?`;
  }
  if (kind === "list") return `¿Qué incluye «${label}» en tu apunte${ofTitle(title, label)}?`;
  return `¿Qué recoge tu apunte${ofTitle(title, label)} sobre «${label}»?`;
};

const questionForTerm = (term, title) => `Según tu apunte${ofTitle(title, term)}, ¿qué corresponde a «${term}»?`;

const questionForRow = (label, headers, key) => {
  const cols = headers.filter(Boolean).map((h) => `«${h}»`);
  const what = cols.length ? cols.join(" y ") : "esta fila";
  const where = label ? ` «${label}»` : "";
  return `En tu tabla${where}, ¿qué pone en ${what} para «${key}»?`;
};

const answerFits = (lines) =>
  lines.length > 0 &&
  lines.length <= MAX_ANSWER_LINES &&
  lines.join("\n").length <= MAX_ANSWER_CHARS &&
  lines.every((l) => l.length <= MAX_LINE_CHARS);

/** Una línea es «solo» una etiqueta si acaba en dos puntos. */
const isLabelLine = (line) => /:\s*$/.test(line) && cleanLabel(line).length >= 2 && line.length <= 120;

/**
 * Propuestas de tarjetas para un apunte.
 * Devuelve { proposals: [{question, answer, excerpt, locator}], reason }
 * con reason = 'empty' | 'no_structure' | null.
 */
export const generateFlashcards = ({ html, title = "" } = {}) => {
  const noteTitle = cleanLabel(title);
  const blocks = noteBlocks(html);
  const textBlocks = blocks.filter((b) => b.type !== "heading");
  if (!textBlocks.length) return { proposals: [], reason: "empty" };

  // Secciones: un encabezado y los bloques hasta el siguiente encabezado.
  const sections = [];
  let current = { heading: null, blocks: [] };
  blocks.forEach((block) => {
    if (block.type === "heading") {
      sections.push(current);
      current = { heading: block.text, blocks: [] };
    } else {
      current.blocks.push(block);
    }
  });
  sections.push(current);

  const proposals = [];
  const seen = new Set();
  const add = ({ question, answer, excerpt, locator }) => {
    const q = normalizeText(question);
    const a = String(answer)
      .split("\n")
      .map(normalizeText)
      .filter(Boolean)
      .join("\n");
    if (!q || !a || q.length > MAX_QUESTION_CHARS || !textContains(excerpt, a)) return;
    const key = fingerprint(q, a);
    if (seen.has(key)) return;
    seen.add(key);
    proposals.push({ question: q, answer: a, excerpt: String(excerpt), locator: locator || null });
  };

  sections.forEach(({ heading, blocks: sectionBlocks }) => {
    const label = heading ? cleanLabel(heading) : null;
    const locatorBase = label || null;

    // 1. La sección entera (párrafos y listas, sin tablas) si cabe en una tarjeta.
    const prose = sectionBlocks.filter((b) => b.type !== "table");
    const proseLines = prose.flatMap((b) => b.lines);
    if (label && prose.length && prose.length === sectionBlocks.length && answerFits(proseLines)) {
      const kind = prose.every((b) => b.type === "list") ? "list" : "text";
      const answer = proseLines.join("\n");
      add({
        question: questionForSection(label, noteTitle, kind),
        answer,
        excerpt: answer,
        locator: locatorBase,
      });
    }

    sectionBlocks.forEach((block, idx) => {
      // 2. Lista con una línea «Etiqueta:» justo delante.
      if (block.type === "list") {
        const prev = sectionBlocks[idx - 1];
        const labelLine = prev && prev.type === "paragraph" ? prev.lines[prev.lines.length - 1] : null;
        if (labelLine && isLabelLine(labelLine) && answerFits(block.lines)) {
          const sub = cleanLabel(labelLine);
          const answer = block.lines.join("\n");
          add({
            question: `¿Qué incluye «${sub}» en tu apunte${ofTitle(noteTitle, sub)}?`,
            answer,
            excerpt: `${labelLine}\n${answer}`,
            locator: [locatorBase, sub].filter(Boolean).join(" › "),
          });
        }
      }

      // 3. Líneas «Término: definición».
      if (block.type === "list" || block.type === "paragraph") {
        block.lines.forEach((line) => {
          if (line.length > MAX_LINE_CHARS) return;
          const match = TERM_RE.exec(line);
          if (!match) return;
          const term = cleanLabel(match[1]);
          const definition = normalizeText(match[2]);
          if (!/\p{L}/u.test(term) || !/[\p{L}\p{N}]/u.test(definition)) return;
          add({
            question: questionForTerm(term, noteTitle),
            answer: definition,
            excerpt: line,
            locator: [locatorBase, term].filter(Boolean).join(" › "),
          });
        });
      }

      // 4. Filas de tabla: la primera fila son los encabezados.
      if (block.type === "table" && block.rows.length >= 2) {
        const [headers, ...rows] = block.rows;
        if (headers.length < 2) return;
        rows.forEach((cells) => {
          const key = cells[0];
          const rest = cells.slice(1).filter(Boolean);
          if (!key || !rest.length || cells.length < 2) return;
          const answer = rest.join("\n");
          if (!answerFits(rest)) return;
          add({
            question: questionForRow(label, headers.slice(1, cells.length), key),
            answer,
            excerpt: cells.join("\n"),
            locator: [locatorBase, key].filter(Boolean).join(" › "),
          });
        });
      }
    });
  });

  const capped = proposals.slice(0, MAX_PROPOSALS).map((p) => ({ ...p, question: truncate(p.question, MAX_QUESTION_CHARS) }));
  return { proposals: capped, reason: capped.length ? null : "no_structure" };
};

/**
 * Marca las propuestas que ya existen como tarjeta (misma pregunta y
 * respuesta). Las duplicadas no se aprueban en bloque.
 */
export const markDuplicates = (proposals = [], existing = []) => {
  const known = new Set(existing.filter((c) => !c.deleted_at).map((c) => fingerprint(c.question, c.answer)));
  return proposals.map((p) => ({ ...p, duplicate: known.has(fingerprint(p.question, p.answer)) }));
};

// Palabras que no dicen nada del contenido: artículos, preposiciones y las de
// las plantillas de las preguntas («¿Qué incluye … en tu apunte …?»).
const SIMILARITY_STOPWORDS = new Set(
  (
    "a al como con cual cuales de del el en es esta este fila la las lo los mi o para pone por que " +
    "se segun son su sus tabla tu tus un una unas uno unos y apunte apuntes incluye recoge sobre " +
    "corresponde define definicion"
  ).split(" ")
);

/** Palabras significativas de un texto: minúsculas, sin tildes, sin palabras vacías. */
export const similarityTokens = (text) =>
  new Set(
    normalizeText(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w && !SIMILARITY_STOPWORDS.has(w))
  );

/** Índice de Jaccard entre dos conjuntos (0 si los dos están vacíos). */
export const jaccard = (a, b) => {
  if (!a.size && !b.size) return 0;
  let shared = 0;
  a.forEach((w) => {
    if (b.has(w)) shared += 1;
  });
  return shared / (a.size + b.size - shared);
};

export const SIMILAR_THRESHOLD = 0.6;

/** Parecido determinista entre dos tarjetas: Jaccard de palabras de pregunta + respuesta. */
export const cardSimilarity = (a, b) =>
  jaccard(similarityTokens(`${a.question} ${a.answer}`), similarityTokens(`${b.question} ${b.answer}`));

/**
 * Marca las propuestas que se parecen a una tarjeta que ya tiene
 * (`similar` = la más parecida). Las exactas ya van como `duplicate`. Nunca se
 * descarta nada solo: el residente elige Ver existente, Mantener ambas o
 * Descartar nueva.
 */
export const markSimilar = (proposals = [], existing = [], threshold = SIMILAR_THRESHOLD) => {
  const pool = existing
    .filter((c) => !c.deleted_at)
    .map((c) => ({ card: c, tokens: similarityTokens(`${c.question} ${c.answer}`) }));
  return proposals.map((p) => {
    if (p.duplicate || !pool.length) return { ...p, similar: null };
    const tokens = similarityTokens(`${p.question} ${p.answer}`);
    let best = null;
    pool.forEach(({ card, tokens: other }) => {
      const score = jaccard(tokens, other);
      if (score >= threshold && (!best || score > best.score)) best = { score, card };
    });
    return {
      ...p,
      similar: best ? { id: best.card.id, question: best.card.question, answer: best.card.answer, score: best.score } : null,
    };
  });
};

/**
 * Propuestas de un fragmento seleccionado en el editor: las mismas reglas que
 * para el apunte entero, sobre el HTML de la selección. Como la BD comprueba
 * que el fragmento está en el texto guardado del apunte, se quedan solo las
 * que están tal cual en `contentText`. Sin ninguna: reason = 'needs_context'.
 */
export const generateFromSelection = ({ selectionHtml, title = "", contentText = "" } = {}) => {
  const { proposals } = generateFlashcards({ html: selectionHtml, title });
  const kept = proposals.filter((p) => textContains(contentText, p.excerpt) && textContains(p.excerpt, p.answer));
  return { proposals: kept, reason: kept.length ? null : "needs_context" };
};

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

/** «Repasar más»: lo vencido o nuevo que no ha entrado hoy y después lo más próximo. */
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
