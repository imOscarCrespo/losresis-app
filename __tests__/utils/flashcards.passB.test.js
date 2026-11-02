import {
  DEFAULT_REVIEW_PREFERENCES,
  SIMILAR_THRESHOLD,
  addDays,
  buildMoreQueue,
  buildTodayQueue,
  cardInFolders,
  cardSimilarity,
  formatDay,
  formatLimit,
  formatTime,
  formatWeekdays,
  generateFromSelection,
  includedFolderSet,
  isPaused,
  jaccard,
  markDuplicates,
  markSimilar,
  normalizePreferences,
  similarityTokens,
  snoozeOptions,
} from "../../utils/flashcards";
import { htmlToPlainText } from "../../utils/resinotes";

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

describe("tarjetas parecidas", () => {
  it("las palabras significativas ignoran tildes, mayúsculas y la plantilla de la pregunta", () => {
    expect(Array.from(similarityTokens("¿Qué incluye «Manejo» en tu apunte?"))).toEqual(["manejo"]);
    expect(Array.from(similarityTokens("Sulfato de MAGNESIO, 4 g"))).toEqual(["sulfato", "magnesio", "4", "g"]);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("detecta una reformulación y no confunde tarjetas distintas del mismo apunte", () => {
    const existing = {
      question: "¿Qué incluye «Manejo inicial» en tu apunte de «Eclampsia»?",
      answer: "Estabilización materna (ABC).\nSulfato de magnesio.\nControl de la presión arterial.",
    };
    const reworded = {
      question: "¿Cuál es el manejo inicial de la eclampsia?",
      answer: "Estabilización materna (ABC).\nSulfato de magnesio.\nControl de la presión arterial.",
    };
    const other = {
      question: "¿Cómo define tu apunte «Eclampsia»?",
      answer: "Convulsiones tónico-clónicas en el contexto de preeclampsia, sin otra causa que lo explique.",
    };
    expect(cardSimilarity(existing, reworded)).toBeGreaterThanOrEqual(SIMILAR_THRESHOLD);
    expect(cardSimilarity(existing, other)).toBeLessThan(SIMILAR_THRESHOLD);
  });

  it("cambiar una cifra en una respuesta corta la deja por debajo del umbral", () => {
    const a = { question: "Según tu apunte, ¿qué corresponde a «Dosis»?", answer: "5 mg" };
    const b = { question: "Según tu apunte, ¿qué corresponde a «Dosis»?", answer: "10 mg" };
    expect(cardSimilarity(a, b)).toBeLessThan(SIMILAR_THRESHOLD);
  });

  it("markSimilar marca la más parecida, deja en paz las exactas y no descarta nada", () => {
    const existing = [
      { id: "x", question: "¿Qué incluye «Manejo inicial»?", answer: "Sulfato de magnesio. Control de la presión arterial." },
      { id: "y", question: "Otra", answer: "Nada que ver", deleted_at: "2026-11-01" },
    ];
    const proposals = markDuplicates(
      [
        { question: "¿Cuál es el manejo inicial?", answer: "Sulfato de magnesio. Control de la presión arterial." },
        { question: "¿Qué incluye «Manejo inicial»?", answer: "Sulfato de magnesio. Control de la presión arterial." },
        { question: "¿Color?", answer: "azul" },
      ],
      existing
    );
    const marked = markSimilar(proposals, existing);
    expect(marked).toHaveLength(3);
    expect(marked[0].similar).toMatchObject({ id: "x" });
    expect(marked[1].duplicate).toBe(true);
    expect(marked[1].similar).toBeNull();
    expect(marked[2].similar).toBeNull();
  });
});

describe("generateFromSelection", () => {
  const NOTE = [
    "<h2>Manejo inicial</h2>",
    "<ul><li><p>Estabilización materna (ABC).</p></li><li><p>Sulfato de magnesio.</p></li></ul>",
    "<p>Dosis: 4 g en 15 min</p>",
    "<p>Texto suelto sin estructura.</p>",
  ].join("");
  const contentText = htmlToPlainText(NOTE);

  it("una selección con título y lista da su tarjeta, con el fragmento literal", () => {
    const sel = "<h2>Manejo inicial</h2><ul><li><p>Estabilización materna (ABC).</p></li><li><p>Sulfato de magnesio.</p></li></ul>";
    const { proposals, reason } = generateFromSelection({ selectionHtml: sel, title: "Eclampsia", contentText });
    expect(reason).toBeNull();
    expect(proposals[0].answer).toBe("Estabilización materna (ABC).\nSulfato de magnesio.");
  });

  it("una línea «Término: definición» seleccionada a medias sigue valiendo si está tal cual", () => {
    const { proposals } = generateFromSelection({ selectionHtml: "<p>Dosis: 4 g en 15 min</p>", contentText });
    expect(proposals.map((p) => p.answer)).toEqual(["4 g en 15 min"]);
  });

  it("texto sin estructura: necesita más contexto", () => {
    expect(generateFromSelection({ selectionHtml: "<p>Texto suelto</p>", contentText }).reason).toBe("needs_context");
    expect(generateFromSelection({ selectionHtml: "", contentText }).reason).toBe("needs_context");
  });

  it("descarta lo que no está en el texto guardado del apunte (selección de algo sin guardar)", () => {
    const { proposals, reason } = generateFromSelection({ selectionHtml: "<p>Vía: oral</p>", contentText });
    expect(proposals).toEqual([]);
    expect(reason).toBe("needs_context");
  });
});
