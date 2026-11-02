// Pasada B (ClickUp 124b4z9w0z0): configuración de repaso, restablecer y
// «Actualizar a mano» atómico. Supabase se mockea en la frontera.
jest.mock("../../config/supabase", () => {
  const builder = { queue: [], calls: [] };
  const next = () => Promise.resolve(builder.queue.length ? builder.queue.shift() : { data: null, error: null });
  ["from", "select", "eq", "is", "lte", "gt", "order", "limit", "insert", "update", "upsert"].forEach((m) => {
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
  getReviewPreferences,
  loadReviewData,
  resetSchedules,
  saveReviewPreferences,
  updateAndKeepFlashcard,
} from "../../services/flashcardService";

const queue = (...responses) => mock.queue.push(...responses);
const callsOf = (name) => mock.calls.filter((c) => c[0] === name);

beforeEach(() => {
  jest.clearAllMocks();
  mock.queue = [];
  mock.calls = [];
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("getReviewPreferences", () => {
  it("sin fila devuelve los valores por defecto", async () => {
    queue({ data: null, error: null });
    const prefs = await getReviewPreferences("u1");
    expect(prefs).toMatchObject({ daily_card_limit: 5, new_card_limit: 5, review_enabled: true, reminders_enabled: false, saved: false });
    expect(callsOf("from")[0][1]).toBe("resinotes_review_preferences");
  });

  it("con fila la normaliza", async () => {
    queue({ data: { daily_card_limit: 10, reminder_time: "21:00:00", reminders_enabled: true }, error: null });
    const prefs = await getReviewPreferences("u1");
    expect(prefs).toMatchObject({ daily_card_limit: 10, reminder_time: "21:00", reminders_enabled: true, saved: true });
  });

  it("propaga el error", async () => {
    queue({ data: null, error: { message: "boom" } });
    await expect(getReviewPreferences("u1")).rejects.toThrow("boom");
  });
});

describe("saveReviewPreferences", () => {
  it("hace upsert solo con las columnas permitidas y la zona horaria del dispositivo", async () => {
    const spy = jest.spyOn(Intl, "DateTimeFormat").mockReturnValue({ resolvedOptions: () => ({ timeZone: "Atlantic/Canary" }) });
    queue({ data: { daily_card_limit: 3 }, error: null });
    const prefs = await saveReviewPreferences("u1", { daily_card_limit: 3, user_id: "otro", hack: true });
    spy.mockRestore();
    const [, row, opts] = callsOf("upsert")[0];
    expect(row).toEqual({ user_id: "u1", daily_card_limit: 3, timezone: "Atlantic/Canary" });
    expect(opts).toEqual({ onConflict: "user_id" });
    expect(prefs.daily_card_limit).toBe(3);
  });

  it("propaga el error (p. ej. sin conexión)", async () => {
    queue({ data: null, error: { message: "Network request failed" } });
    await expect(saveReviewPreferences("u1", { review_enabled: false })).rejects.toThrow("Network request failed");
  });
});

describe("resetSchedules", () => {
  it("llama a la RPC y devuelve cuántas tarjetas ha restablecido", async () => {
    queue({ data: 12, error: null });
    await expect(resetSchedules()).resolves.toBe(12);
    expect(callsOf("rpc")[0][1]).toBe("resinotes_reset_flashcard_schedules");
  });

  it("propaga el error", async () => {
    queue({ data: null, error: { message: "not_authenticated" } });
    await expect(resetSchedules()).rejects.toThrow("not_authenticated");
  });
});

describe("updateAndKeepFlashcard", () => {
  it("edita y mantiene en una sola llamada", async () => {
    queue({ data: { id: "c1", source_state: "ok" }, error: null });
    const card = await updateAndKeepFlashcard("c1", { question: " ¿Q? ", answer: " R " });
    expect(card.source_state).toBe("ok");
    expect(callsOf("rpc")).toEqual([
      ["rpc", "resinotes_update_flashcard_and_keep", { p_flashcard_id: "c1", p_question: "¿Q?", p_answer: "R" }],
    ]);
    expect(callsOf("update")).toHaveLength(0);
  });

  it("si falla no queda nada a medias (la BD lo revierte) y se propaga el error", async () => {
    queue({ data: null, error: { message: "resinotes_flashcards_answer_check" } });
    await expect(updateAndKeepFlashcard("c1", { question: "¿Q?", answer: "" })).rejects.toThrow("answer_check");
  });
});

describe("loadReviewData", () => {
  it("cuenta las nuevas repasadas hoy (primer repaso = previous_due_on vacío)", async () => {
    queue(
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          { flashcard_id: "a", rating: "again", previous_due_on: null },
          { flashcard_id: "a", rating: "good", previous_due_on: "2026-11-03" },
          { flashcard_id: "b", rating: "good", previous_due_on: "2026-11-01" },
          { flashcard_id: "c", rating: "hard", previous_due_on: null },
        ],
        error: null,
      },
      { count: 9, error: null }
    );
    const data = await loadReviewData("u1", "2026-11-02");
    expect(data.reviewedTodayIds).toEqual(["a", "b", "c"]);
    expect(data.newReviewedToday).toBe(2);
  });
});
