import {
  DAILY_CARD_LIMIT,
  buildMoreQueue,
  buildTodayQueue,
  cardDisplayState,
  daysBetween,
  estimateMinutes,
  filterCards,
  formatNextReview,
  formatPending,
  localDateString,
  newClientReviewId,
  normalizeText,
  summarizeReviews,
  textContains,
} from "../../utils/flashcards";


describe("normalizeText / textContains", () => {
  it("colapsa espacios, saltos y espacios duros como la BD", () => {
    expect(normalizeText("  a\n\tb   c  ")).toBe("a b c");
  });

  it("encuentra un fragmento aunque cambien los saltos de línea", () => {
    expect(textContains("Uno\nDos  tres", "Dos tres")).toBe(true);
    expect(textContains("Uno", "")).toBe(false);
    expect(textContains("Uno", "Cuatro")).toBe(false);
  });
});

describe("fechas", () => {
  it("usa el día local del dispositivo", () => {
    expect(localDateString(new Date(2026, 10, 2, 23, 59))).toBe("2026-11-02");
    expect(localDateString(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });

  it("cuenta días sin depender del horario de verano", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("formatea el próximo repaso", () => {
    expect(formatNextReview(null, "2026-11-02")).toBe("Nueva");
    expect(formatNextReview("2026-10-30", "2026-11-02")).toBe("Hoy");
    expect(formatNextReview("2026-11-02", "2026-11-02")).toBe("Hoy");
    expect(formatNextReview("2026-11-03", "2026-11-02")).toBe("Mañana");
    expect(formatNextReview("2026-11-06", "2026-11-02")).toBe("En 4 días");
  });

  it("estima el tiempo: 5 tarjetas, unos 3 minutos", () => {
    expect(estimateMinutes(5)).toBe(3);
    expect(estimateMinutes(1)).toBe(1);
    expect(estimateMinutes(8)).toBe(5);
    expect(formatPending(1)).toBe("1 tarjeta pendiente");
    expect(formatPending(5)).toBe("5 tarjetas pendientes");
  });
});

const card = (id, extra = {}) => ({
  id,
  status: "active",
  source_state: "ok",
  deleted_at: null,
  due_on: null,
  lapse_count: 0,
  created_at: `2026-10-0${id.length}T10:00:00Z`,
  ...extra,
});

describe("buildTodayQueue", () => {
  const today = "2026-11-02";

  it("primero las vencidas (más antiguas y más falladas), después las nuevas, hasta 5", () => {
    const cards = [
      card("new1", { created_at: "2026-10-01" }),
      card("due-today", { due_on: "2026-11-02" }),
      card("due-old", { due_on: "2026-10-20" }),
      card("due-lapsed", { due_on: "2026-11-02", lapse_count: 3 }),
      card("future", { due_on: "2026-11-05" }),
      card("new2", { created_at: "2026-10-02" }),
      card("new3", { created_at: "2026-10-03" }),
    ];
    const { queue, dueCount, newCount } = buildTodayQueue({ cards, reviewedTodayIds: [], today });
    expect(queue.map((c) => c.id)).toEqual(["due-old", "due-lapsed", "due-today", "new1", "new2"]);
    expect(queue).toHaveLength(DAILY_CARD_LIMIT);
    expect(dueCount).toBe(3);
    expect(newCount).toBe(3);
  });

  it("no incluye tarjetas futuras, suspendidas, borradas ni sin fuente", () => {
    const cards = [
      card("future", { due_on: "2026-11-03" }),
      card("susp", { status: "suspended" }),
      card("del", { deleted_at: "2026-11-01" }),
      card("mod", { source_state: "modified" }),
      card("miss", { source_state: "missing" }),
    ];
    expect(buildTodayQueue({ cards, today }).queue).toEqual([]);
  });

  it("descuenta lo ya repasado hoy (retomar un repaso abandonado)", () => {
    const cards = ["a", "b", "c", "d", "e", "f"].map((id) => card(id, { due_on: "2026-11-01" }));
    const { queue, reviewedToday } = buildTodayQueue({ cards, reviewedTodayIds: ["a", "b"], today });
    expect(reviewedToday).toBe(2);
    expect(queue.map((c) => c.id)).toEqual(["c", "d", "e"]);
  });

  it("si ya ha hecho su repaso, no queda nada para hoy aunque haya más vencidas", () => {
    const cards = ["a", "b", "c", "d", "e", "f"].map((id) => card(id, { due_on: "2026-10-01" }));
    const done = buildTodayQueue({ cards, reviewedTodayIds: ["a", "b", "c", "d", "e"], today });
    expect(done.queue).toEqual([]);
    expect(done.dueCount).toBe(1);
  });

  it("tras semanas sin repasar, sigue siendo un repaso de 5 sin culpas", () => {
    const cards = Array.from({ length: 300 }, (_, i) => card(`c${i}`, { due_on: "2026-09-01" }));
    expect(buildTodayQueue({ cards, today }).queue).toHaveLength(5);
  });
});

describe("buildMoreQueue", () => {
  it("después del repaso de hoy, ofrece lo vencido, lo nuevo y lo más próximo", () => {
    const today = "2026-11-02";
    const cards = [
      card("later", { due_on: "2026-12-01" }),
      card("soon", { due_on: "2026-11-04" }),
      card("new", {}),
      card("reviewed", { due_on: "2026-11-03" }),
    ];
    expect(buildMoreQueue({ cards, reviewedTodayIds: ["reviewed"], today, size: 3 }).map((c) => c.id)).toEqual([
      "new",
      "soon",
      "later",
    ]);
  });
});

describe("summarizeReviews", () => {
  it("cuenta cada tarjeta una vez, con su primera respuesta del día", () => {
    const reviews = [
      { flashcard_id: "a", rating: "good", reviewed_at: "2026-11-02T10:00:00Z" },
      { flashcard_id: "b", rating: "again", reviewed_at: "2026-11-02T10:01:00Z" },
      { flashcard_id: "c", rating: "hard", reviewed_at: "2026-11-02T10:02:00Z" },
      { flashcard_id: "b", rating: "good", reviewed_at: "2026-11-02T10:05:00Z" },
      { flashcard_id: "d", rating: "good", reviewed_at: "2026-11-02T10:03:00Z" },
    ];
    expect(summarizeReviews(reviews)).toEqual({ total: 4, good: 2, hard: 1, again: 1 });
  });
});

describe("Mis tarjetas", () => {
  const cards = [
    card("a", { question: "¿Manejo inicial?", answer: "ABC", source: { title: "Eclampsia", folder_id: "f1" } }),
    card("b", { question: "¿Dosis?", answer: "4 g", status: "suspended", source: { title: "Sulfato", folder_id: "f2" } }),
    card("c", { question: "¿Otra?", answer: "x", source_state: "modified", source: { title: "Eclampsia", folder_id: "f1" } }),
    card("d", { question: "¿Manual?", answer: "y", source: null }),
    card("e", { question: "¿Borrada?", answer: "z", deleted_at: "2026-11-01" }),
  ];

  it("enseña el estado de la fuente por encima del de la tarjeta", () => {
    expect(cards.map(cardDisplayState)).toEqual(["active", "suspended", "modified", "active", "active"]);
    expect(cardDisplayState({ status: "suspended", source_state: "missing" })).toBe("missing");
  });

  it("filtra por pestaña, búsqueda y carpeta, y nunca enseña las borradas", () => {
    expect(filterCards(cards).map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
    expect(filterCards(cards, { tab: "active" }).map((c) => c.id)).toEqual(["a", "d"]);
    expect(filterCards(cards, { tab: "suspended" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCards(cards, { tab: "review" }).map((c) => c.id)).toEqual(["c"]);
    expect(filterCards(cards, { query: "eclampsia" }).map((c) => c.id)).toEqual(["a", "c"]);
    expect(filterCards(cards, { query: "  4  G " }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCards(cards, { folderId: "f1" }).map((c) => c.id)).toEqual(["a", "c"]);
  });
});

describe("newClientReviewId", () => {
  it("genera UUID v4 distintos", () => {
    const a = newClientReviewId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newClientReviewId()).not.toBe(a);
  });
});

// ---------------------------------------------------------------------------
// ClickUp 124b4z9w5nh: sin generación, preguntas a mano y apunte completo
// ---------------------------------------------------------------------------
describe("estudiar una nota (124b4z9w5nh)", () => {
  const {
    RATINGS,
    cardFrontText,
    cardType,
    formatPendingReview,
    isValidQuestion,
    noteHasStudyContent,
    selectionToAnswer,
  } = require("../../utils/flashcards");
  const flashcards = require("../../utils/flashcards");

  it("ya no hay generador automático", () => {
    expect(flashcards.generateFlashcards).toBeUndefined();
    expect(flashcards.generateFromSelection).toBeUndefined();
    expect(flashcards.markSimilar).toBeUndefined();
  });

  it("valoraciones «Otra vez», «Me costó» y «Fácil»", () => {
    expect([RATINGS.again.label, RATINGS.hard.label, RATINGS.good.label]).toEqual(["Otra vez", "Me costó", "Fácil"]);
  });

  it("una nota vacía no se puede repasar; con texto o con una imagen, sí", () => {
    expect(noteHasStudyContent("")).toBe(false);
    expect(noteHasStudyContent("<p></p><p>  </p>")).toBe(false);
    expect(noteHasStudyContent("<p>Oxitocina 10 UI</p>")).toBe(true);
    expect(noteHasStudyContent('<p></p><img src="resinotes://u/n/a.jpg">')).toBe(true);
  });

  it("el texto seleccionado pasa a la respuesta, una línea por elemento", () => {
    expect(selectionToAnswer("<p>Vitamina E, ácido hialurónico y caléndula</p>")).toBe(
      "Vitamina E, ácido hialurónico y caléndula"
    );
    expect(selectionToAnswer("<ul><li><p>Vitamina E</p></li><li><p>Caléndula &amp; tomillo</p></li></ul>")).toBe(
      "Vitamina E\nCaléndula & tomillo"
    );
    expect(selectionToAnswer("x".repeat(5000))).toHaveLength(4000);
    expect(selectionToAnswer(null)).toBe("");
  });

  it("pregunta y respuesta son obligatorias", () => {
    expect(isValidQuestion({ question: "¿Qué contiene Gixoderm?", answer: "Vitamina E" })).toBe(true);
    expect(isValidQuestion({ question: "   ", answer: "Vitamina E" })).toBe(false);
    expect(isValidQuestion({ question: "¿Qué contiene?", answer: "\n " })).toBe(false);
  });

  it("una tarjeta de apunte enseña el título actual de su nota; las antiguas son de pregunta", () => {
    expect(cardType({ card_type: "note" })).toBe("note");
    expect(cardType({ origin: "generated" })).toBe("qa");
    expect(cardFrontText({ card_type: "note", question: "Título viejo", source: { title: "Hemorragia posparto" } })).toBe(
      "Hemorragia posparto"
    );
    expect(cardFrontText({ card_type: "note", question: "Título viejo", source: null })).toBe("Título viejo");
    expect(cardFrontText({ card_type: "qa", question: "¿Dosis?" })).toBe("¿Dosis?");
  });

  it("«Tienes 5 tarjetas para repasar»", () => {
    expect(formatPendingReview(5)).toBe("Tienes 5 tarjetas para repasar");
    expect(formatPendingReview(1)).toBe("Tienes 1 tarjeta para repasar");
  });
});
