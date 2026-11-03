import {
  DEFAULT_REVIEW_PREFERENCES,
  addDays,
  buildMoreQueue,
  buildTodayQueue,
  cardInFolders,
  formatDay,
  formatLimit,
  formatTime,
  formatWeekdays,
  includedFolderSet,
  isPaused,
  normalizePreferences,
  snoozeOptions,
} from "../../utils/flashcards";

/**
 * Tarjetas de repaso, pasada B (ClickUp 124b4z9w0z0): configuración de repaso
 * (límites, carpetas, pausa), posponer, fragmentos seleccionados y tarjetas
 * parecidas.
 */

const card = (id, extra = {}) => ({
  id,
  status: "active",
  source_state: "ok",
  deleted_at: null,
  due_on: null,
  lapse_count: 0,
  created_at: `2026-10-01T10:00:${String(id.length).padStart(2, "0")}Z`,
  source_item_id: `note-${id}`,
  source: { folder_id: null },
  ...extra,
});

// Obstetricia > Preeclampsia (subcarpeta), Urgencias, y una carpeta en la papelera.
const FOLDERS = [
  { id: "obs", parent_id: null },
  { id: "pre", parent_id: "obs" },
  { id: "urg", parent_id: null },
  { id: "old", parent_id: null, deleted_at: "2026-10-01" },
];

describe("includedFolderSet", () => {
  it("null o vacío = todas", () => {
    expect(includedFolderSet(FOLDERS, null)).toBeNull();
    expect(includedFolderSet(FOLDERS, [])).toBeNull();
  });

  it("incluye las subcarpetas", () => {
    expect(Array.from(includedFolderSet(FOLDERS, ["obs"])).sort()).toEqual(["obs", "pre"]);
  });

  it("ignora carpetas que ya no existen; si no queda ninguna, cuenta como todas", () => {
    expect(Array.from(includedFolderSet(FOLDERS, ["urg", "gone"]))).toEqual(["urg"]);
    expect(includedFolderSet(FOLDERS, ["gone", "old"])).toBeNull();
  });
});

describe("cardInFolders", () => {
  const set = includedFolderSet(FOLDERS, ["obs"]);
  it("las tarjetas a mano sin apunte entran siempre", () => {
    expect(cardInFolders(card("m", { source_item_id: null, source: null }), set)).toBe(true);
  });
  it("las de una nota de la carpeta o de una subcarpeta entran; las de otra o sin clasificar, no", () => {
    expect(cardInFolders(card("a", { source: { folder_id: "pre" } }), set)).toBe(true);
    expect(cardInFolders(card("b", { source: { folder_id: "urg" } }), set)).toBe(false);
    expect(cardInFolders(card("c", { source: { folder_id: null } }), set)).toBe(false);
  });
  it("sin filtro entra todo", () => {
    expect(cardInFolders(card("c"), null)).toBe(true);
  });
});

describe("buildTodayQueue con la configuración", () => {
  const today = "2026-11-02";

  it("el límite diario sustituye al de 5", () => {
    const cards = ["a", "b", "c", "d", "e", "f"].map((id) => card(id, { due_on: "2026-11-01" }));
    expect(buildTodayQueue({ cards, today, limit: 3 }).queue).toHaveLength(3);
    expect(buildTodayQueue({ cards, today, limit: 10 }).queue).toHaveLength(6);
  });

  it("las nuevas tienen su propio límite y descuenta las nuevas ya repasadas hoy", () => {
    const cards = [card("d1", { due_on: "2026-11-01" }), card("n1"), card("n2"), card("n3")];
    expect(buildTodayQueue({ cards, today, limit: 10, newLimit: 2 }).queue.map((c) => c.id)).toEqual(["d1", "n1", "n2"]);
    expect(buildTodayQueue({ cards, today, limit: 10, newLimit: 0 }).queue.map((c) => c.id)).toEqual(["d1"]);
    expect(
      buildTodayQueue({ cards, today, limit: 10, newLimit: 2, newReviewedToday: 1 }).queue.map((c) => c.id)
    ).toEqual(["d1", "n1"]);
  });

  it("filtra por carpetas (con subcarpetas) y deja las manuales", () => {
    const cards = [
      card("pre", { due_on: "2026-11-01", source: { folder_id: "pre" } }),
      card("urg", { due_on: "2026-11-01", source: { folder_id: "urg" } }),
      card("man", { source_item_id: null, source: null }),
    ];
    const folderSet = includedFolderSet(FOLDERS, ["obs"]);
    expect(buildTodayQueue({ cards, today, folderSet }).queue.map((c) => c.id)).toEqual(["pre", "man"]);
    expect(buildMoreQueue({ cards, today, folderSet }).map((c) => c.id)).toEqual(["pre", "man"]);
  });

  // Mismo caso que el ensayo de la BD (resinotes_review_pending_count):
  // diario 3, nuevas 2, 4 nuevas -> 2; con nuevas 10 -> 3; repasadas 3 -> 0.
  it("cuenta igual que la BD", () => {
    const cards = ["m", "c1", "c2", "c3"].map((id) => card(id));
    expect(buildTodayQueue({ cards, today, limit: 3, newLimit: 2 }).queue).toHaveLength(2);
    expect(buildTodayQueue({ cards, today, limit: 3, newLimit: 10 }).queue).toHaveLength(3);
    expect(
      buildTodayQueue({ cards, today, limit: 3, newLimit: 10, reviewedTodayIds: ["c1", "c2", "c3"], newReviewedToday: 3 }).queue
    ).toHaveLength(0);
  });
});

describe("normalizePreferences", () => {
  it("sin fila = valores por defecto (recordatorios desactivados)", () => {
    expect(normalizePreferences(null)).toEqual({ ...DEFAULT_REVIEW_PREFERENCES, active_weekdays: [1, 2, 3, 4, 5, 6, 7] });
    expect(normalizePreferences(null).reminders_enabled).toBe(false);
    expect(normalizePreferences(null).daily_card_limit).toBe(5);
  });

  it("recorta límites, ordena días y limpia la hora", () => {
    const p = normalizePreferences({
      daily_card_limit: 500,
      new_card_limit: -3,
      reminder_time: "07:05:00",
      active_weekdays: [7, 1, 1, 9],
      included_folder_ids: [],
    });
    expect(p.daily_card_limit).toBe(100);
    expect(p.new_card_limit).toBe(0);
    expect(p.reminder_time).toBe("07:05");
    expect(p.active_weekdays).toEqual([1, 7]);
    expect(p.included_folder_ids).toBeNull();
  });
});

describe("pausa y fechas", () => {
  it("en pausa mientras hoy < paused_until", () => {
    expect(isPaused({ paused_until: "2026-11-09" }, "2026-11-08")).toBe(true);
    expect(isPaused({ paused_until: "2026-11-09" }, "2026-11-09")).toBe(false);
    expect(isPaused({ paused_until: null }, "2026-11-09")).toBe(false);
  });

  it("addDays cruza meses, años y el cambio de hora", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("formatos", () => {
    expect(formatDay("2026-11-09")).toBe("9 nov");
    expect(formatTime("20:30:00")).toBe("20:30");
    expect(formatTime("basura")).toBe("20:30");
    expect(formatWeekdays([1, 2, 3, 4, 5, 6, 7])).toBe("Todos los días");
    expect(formatWeekdays([1, 2, 3, 4, 5])).toBe("De lunes a viernes");
    expect(formatWeekdays([1, 3, 7])).toBe("L X D");
    expect(formatWeekdays([])).toBe("Ninguno");
    expect(formatLimit(0)).toBe("Ninguna");
    expect(formatLimit(1)).toBe("1 tarjeta");
    expect(formatLimit(15)).toBe("15 tarjetas");
  });
});

describe("snoozeOptions", () => {
  it("a las 20:30: en 1 hora, esta noche a las 22:00 y mañana a su hora", () => {
    const now = new Date(2026, 10, 2, 20, 30);
    const opts = snoozeOptions(now, "20:30");
    expect(opts.map((o) => o.key)).toEqual(["hour", "tonight", "tomorrow"]);
    expect(opts[0].at.getTime() - now.getTime()).toBe(3600000);
    expect([opts[1].at.getHours(), opts[1].at.getMinutes(), opts[1].at.getDate()]).toEqual([22, 0, 2]);
    expect([opts[2].at.getHours(), opts[2].at.getMinutes(), opts[2].at.getDate()]).toEqual([20, 30, 3]);
  });

  it("después de las 21:00 no ofrece «esta noche»; mañana cruza de mes", () => {
    const opts = snoozeOptions(new Date(2026, 10, 30, 21, 15), "08:00");
    expect(opts.map((o) => o.key)).toEqual(["hour", "tomorrow"]);
    expect([opts[1].at.getMonth(), opts[1].at.getDate(), opts[1].at.getHours()]).toEqual([11, 1, 8]);
  });
});

