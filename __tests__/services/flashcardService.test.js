// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder; las respuestas salen en orden de una cola que decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { queue: [], calls: [] };
  const next = () => Promise.resolve(builder.queue.length ? builder.queue.shift() : { data: null, error: null });
  ["from", "select", "eq", "is", "lte", "gt", "order", "limit", "insert", "update"].forEach((m) => {
    builder[m] = jest.fn((...args) => {
      builder.calls.push([m, ...args]);
      return builder;
    });
  });
  builder.then = (resolve, reject) => next().then(resolve, reject);
  builder.single = jest.fn(next);
  builder.maybeSingle = jest.fn(next);
  builder.rpc = jest.fn((...args) => {
    builder.calls.push(["rpc", ...args]);
    return next();
  });
  return { supabase: builder };
});

const { supabase: mock } = jest.requireMock("../../config/supabase");

import {
  deleteFlashcard,
  flashcardErrorMessage,
  keepFlashcard,
  listFlashcards,
  loadReviewData,
  reviewFlashcard,
  saveProposals,
  updateFlashcard,
} from "../../services/flashcardService";

const queue = (...responses) => mock.queue.push(...responses);
const callsOf = (name) => mock.calls.filter((c) => c[0] === name);

beforeEach(() => {
  jest.clearAllMocks();
  mock.queue = [];
  mock.calls = [];
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveProposals", () => {
  it("guarda el lote en un solo INSERT con su fuente; las editadas van como generated_edited", async () => {
    queue({ data: [{ id: "c1" }, { id: "c2" }], error: null });
    const saved = await saveProposals("u1", "n1", [
      { question: " ¿A? ", answer: "Uno", excerpt: "Uno", locator: "Sección" },
      { question: "¿B?", answer: "Dos cambiada", excerpt: "Dos", locator: null, edited: true },
    ]);
    expect(saved).toHaveLength(2);
    const inserts = callsOf("insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1]).toEqual([
      {
        user_id: "u1",
        source_item_id: "n1",
        source_excerpt: "Uno",
        source_locator: "Sección",
        question: "¿A?",
        answer: "Uno",
        origin: "generated",
      },
      {
        user_id: "u1",
        source_item_id: "n1",
        source_excerpt: "Dos",
        source_locator: null,
        question: "¿B?",
        answer: "Dos cambiada",
        origin: "generated_edited",
      },
    ]);
  });

  it("sin propuestas no llama a la BD", async () => {
    expect(await saveProposals("u1", "n1", [])).toEqual([]);
    expect(callsOf("insert")).toHaveLength(0);
  });

  it("si el apunte cambió, propaga el error con un mensaje claro", async () => {
    queue({ data: null, error: { message: "resinotes_flashcard_source_changed", code: "23514" } });
    const error = await saveProposals("u1", "n1", [{ question: "q", answer: "a", excerpt: "a" }]).catch((e) => e);
    expect(error.code).toBe("23514");
    expect(flashcardErrorMessage(error)).toBe(
      "El apunte ha cambiado mientras revisabas las tarjetas. Vuelve a prepararlas."
    );
  });
});

describe("reviewFlashcard", () => {
  it("manda la valoración con su clave de idempotencia y el día local", async () => {
    queue({ data: { id: "c1", due_on: "2026-11-06" }, error: null });
    const card = await reviewFlashcard({ cardId: "c1", rating: "good", clientReviewId: "r1", localDate: "2026-11-02" });
    expect(card.due_on).toBe("2026-11-06");
    expect(callsOf("rpc")[0]).toEqual([
      "rpc",
      "resinotes_review_flashcard",
      { p_flashcard_id: "c1", p_rating: "good", p_client_review_id: "r1", p_local_date: "2026-11-02" },
    ]);
  });

  it("sin conexión: falla (no se da por guardada) con un mensaje claro", async () => {
    queue({ data: null, error: { message: "TypeError: Network request failed" } });
    const error = await reviewFlashcard({ cardId: "c1", rating: "again", clientReviewId: "r1", localDate: "2026-11-02" }).catch(
      (e) => e
    );
    expect(flashcardErrorMessage(error)).toBe("Sin conexión. Revisa tu conexión e inténtalo de nuevo.");
  });
});

describe("loadReviewData", () => {
  it("junta vencidas, nuevas y próximas y saca lo repasado hoy sin repetir", async () => {
    queue(
      { data: [{ id: "due" }], error: null },
      { data: [{ id: "new" }], error: null },
      { data: [{ id: "future" }], error: null },
      {
        data: [
          { flashcard_id: "x", rating: "again" },
          { flashcard_id: "x", rating: "good" },
          { flashcard_id: "y", rating: "good" },
        ],
        error: null,
      },
      { data: null, count: 7, error: null }
    );
    const data = await loadReviewData("u1", "2026-11-02");
    expect(data.cards.map((c) => c.id)).toEqual(["due", "new", "future"]);
    expect(data.reviewedTodayIds).toEqual(["x", "y"]);
    expect(data.totalCards).toBe(7);
    // Solo tarjetas activas con la fuente disponible.
    expect(callsOf("eq")).toEqual(expect.arrayContaining([["eq", "status", "active"], ["eq", "source_state", "ok"]]));
    expect(callsOf("lte")).toEqual([["lte", "due_on", "2026-11-02"]]);
  });

  it("propaga cualquier error de lectura", async () => {
    queue({ data: null, error: { message: "boom" } });
    await expect(loadReviewData("u1", "2026-11-02")).rejects.toThrow("boom");
  });
});

describe("resto", () => {
  it("lista las tarjetas de un apunte sin las borradas", async () => {
    queue({ data: [{ id: "c1" }], error: null });
    await listFlashcards("u1", { sourceItemId: "n1" });
    expect(callsOf("is")).toEqual([["is", "deleted_at", null]]);
    expect(callsOf("eq")).toEqual([
      ["eq", "user_id", "u1"],
      ["eq", "source_item_id", "n1"],
    ]);
  });

  it("editar solo manda pregunta y respuesta (nunca la programación)", async () => {
    queue({ data: { id: "c1" }, error: null });
    await updateFlashcard("c1", { question: " ¿Nueva? ", answer: "Sí " });
    expect(callsOf("update")[0][1]).toEqual({ question: "¿Nueva?", answer: "Sí" });
  });

  it("eliminar es un borrado lógico", async () => {
    queue({ data: null, error: null });
    await deleteFlashcard("c1");
    expect(Object.keys(callsOf("update")[0][1])).toEqual(["deleted_at"]);
  });

  it("mantener tarjeta llama a la RPC y propaga su error", async () => {
    queue({ data: null, error: { message: "resinotes_flashcard_not_found" } });
    const error = await keepFlashcard("c1").catch((e) => e);
    expect(flashcardErrorMessage(error)).toBe("Esta tarjeta ya no existe.");
  });
});
