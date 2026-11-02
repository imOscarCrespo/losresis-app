import { htmlToPlainText } from "../../utils/resinotes";
import {
  DAILY_CARD_LIMIT,
  answerLines,
  buildMoreQueue,
  buildTodayQueue,
  cardDisplayState,
  daysBetween,
  estimateMinutes,
  filterCards,
  fingerprint,
  formatNextReview,
  formatPending,
  generateFlashcards,
  localDateString,
  markDuplicates,
  newClientReviewId,
  normalizeText,
  noteBlocks,
  summarizeReviews,
  textContains,
  topLevelElements,
} from "../../utils/flashcards";

// Un apunte tal y como lo guarda el editor (TenTap): párrafos dentro de <li>,
// tablas con <th>/<td> con párrafos y bloques especiales en <div data-callout>.
const ECLAMPSIA = [
  "<h2>Definición</h2>",
  "<p>Convulsiones tónico-clónicas en el contexto de preeclampsia, sin otra causa que lo explique.</p>",
  "<h2>Manejo inicial</h2>",
  "<ul><li><p>Estabilización materna (ABC).</p></li><li><p>Sulfato de magnesio.</p></li>",
  "<li><p>Control de la presión arterial.</p></li><li><p>Valoración de finalización de la gestación.</p></li></ul>",
  "<h2>Fármacos</h2>",
  "<table><tbody><tr><th><p>Fármaco</p></th><th><p>Dosis</p></th><th><p>Vía</p></th></tr>",
  "<tr><td><p>Sulfato de magnesio</p></td><td><p>4 g en 20 min</p></td><td><p>IV</p></td></tr>",
  "<tr><td><p>Labetalol</p></td><td><p>20 mg</p></td><td><p>IV</p></td></tr></tbody></table>",
  '<div data-callout="pearl"><p>Criterios de gravedad:</p><ul><li><p>TAS ≥ 160 mmHg</p></li><li><p>Plaquetas &lt; 100.000</p></li></ul></div>',
  "<p>Magnesemia objetivo: 4-7 mEq/L</p>",
].join("");

const contentText = htmlToPlainText(ECLAMPSIA);

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

describe("noteBlocks", () => {
  it("separa encabezados, párrafos, listas y tablas y abre los bloques especiales", () => {
    const types = noteBlocks(ECLAMPSIA).map((b) => b.type);
    expect(types).toEqual(["heading", "paragraph", "heading", "list", "heading", "table", "paragraph", "list", "paragraph"]);
  });

  it("decodifica entidades y lee cada celda", () => {
    const table = noteBlocks(ECLAMPSIA).find((b) => b.type === "table");
    expect(table.rows[0]).toEqual(["Fármaco", "Dosis", "Vía"]);
    expect(noteBlocks("<ul><li><p>Plaquetas &lt; 100.000</p></li></ul>")[0].lines).toEqual(["Plaquetas < 100.000"]);
  });

  it("no se rompe con HTML suelto o sin cerrar", () => {
    expect(topLevelElements("texto suelto<p>uno</p>").map((e) => e.tag)).toEqual(["p", "p"]);
    expect(noteBlocks("<p>sin cerrar").map((b) => b.lines)).toEqual([["sin cerrar"]]);
    expect(noteBlocks("<p></p><img src=\"x\"><hr>")).toEqual([]);
  });
});

describe("generateFlashcards", () => {
  const { proposals, reason } = generateFlashcards({ html: ECLAMPSIA, title: "Eclampsia" });
  const byQuestion = (q) => proposals.find((p) => p.question === q);

  it("crea una tarjeta por apartado con su contenido literal", () => {
    expect(reason).toBeNull();
    expect(byQuestion("¿Cómo define tu apunte «Eclampsia»?").answer).toBe(
      "Convulsiones tónico-clónicas en el contexto de preeclampsia, sin otra causa que lo explique."
    );
    const manejo = byQuestion("¿Qué incluye «Manejo inicial» en tu apunte de «Eclampsia»?");
    expect(answerLines(manejo.answer)).toEqual([
      "Estabilización materna (ABC).",
      "Sulfato de magnesio.",
      "Control de la presión arterial.",
      "Valoración de finalización de la gestación.",
    ]);
    expect(manejo.locator).toBe("Manejo inicial");
  });

  it("crea una tarjeta por fila de tabla preguntando por sus columnas", () => {
    const row = byQuestion("En tu tabla «Fármacos», ¿qué pone en «Dosis» y «Vía» para «Labetalol»?");
    expect(row.answer).toBe("20 mg\nIV");
    expect(row.excerpt).toBe("Labetalol\n20 mg\nIV");
  });

  it("usa una línea «Etiqueta:» como título de la lista que la sigue", () => {
    const list = byQuestion("¿Qué incluye «Criterios de gravedad» en tu apunte de «Eclampsia»?");
    expect(list.answer).toBe("TAS ≥ 160 mmHg\nPlaquetas < 100.000");
  });

  it("crea tarjetas de «Término: definición» sin tocar cifras ni unidades", () => {
    const term = byQuestion("Según tu apunte de «Eclampsia», ¿qué corresponde a «Magnesemia objetivo»?");
    expect(term.answer).toBe("4-7 mEq/L");
  });

  it("todas las respuestas y fragmentos son texto literal del apunte (lo que comprueba la BD)", () => {
    expect(proposals.length).toBeGreaterThan(4);
    proposals.forEach((p) => {
      expect(textContains(contentText, p.excerpt)).toBe(true);
      expect(textContains(p.excerpt, p.answer)).toBe(true);
    });
  });

  it("no repite propuestas", () => {
    const keys = proposals.map((p) => fingerprint(p.question, p.answer));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("apunte vacío: no genera nada y lo dice", () => {
    expect(generateFlashcards({ html: "", title: "x" })).toEqual({ proposals: [], reason: "empty" });
    expect(generateFlashcards({ html: "<p></p><h2>Solo título</h2>" }).reason).toBe("empty");
  });

  it("una sola palabra o prosa sin estructura: se abstiene", () => {
    expect(generateFlashcards({ html: "<p>Preeclampsia</p>" })).toEqual({ proposals: [], reason: "no_structure" });
    const prose = "<p>La paciente tuvo una evolución favorable y se decidió el alta al tercer día.</p>";
    expect(generateFlashcards({ html: prose, title: "Caso" }).reason).toBe("no_structure");
  });

  it("no completa nada: «revisar protocolo» se queda tal cual", () => {
    const { proposals: p } = generateFlashcards({
      html: "<h2>Tratamiento</h2><p>Revisar protocolo.</p>",
      title: "Patología X",
    });
    expect(p).toEqual([
      {
        question: "¿Qué recoge tu apunte de «Patología X» sobre «Tratamiento»?",
        answer: "Revisar protocolo.",
        excerpt: "Revisar protocolo.",
        locator: "Tratamiento",
      },
    ]);
  });

  it("conserva negaciones literalmente", () => {
    const { proposals: p } = generateFlashcards({ html: "<p>Contraindicación: no administrar en asmáticos</p>" });
    expect(p[0].answer).toBe("no administrar en asmáticos");
  });

  it("no toma horas ni URLs por «Término: definición»", () => {
    const html = "<p>Pase de guardia a las 8:30 en la sala</p><p>Fuente: https://example.com</p>";
    const { proposals: p } = generateFlashcards({ html });
    expect(p.map((x) => x.question)).toEqual(["Según tu apunte, ¿qué corresponde a «Fuente»?"]);
  });

  it("deja fuera un apartado demasiado largo para una tarjeta, pero no sus definiciones", () => {
    const long = Array.from({ length: 20 }, (_, i) => `<li><p>Elemento ${i}</p></li>`).join("");
    const { proposals: p } = generateFlashcards({ html: `<h2>Lista larga</h2><ul>${long}</ul><p>Dosis: 4 g</p>` });
    expect(p.find((x) => x.locator === "Lista larga")).toBeUndefined();
    expect(p.find((x) => x.answer === "4 g")).toBeDefined();
  });

  it("un apartado sin contenido (solo subapartados) no crea tarjeta", () => {
    const { proposals: p } = generateFlashcards({ html: "<h1>Tema</h1><h2>Sub</h2><p>Texto del sub.</p>" });
    expect(p.map((x) => x.locator)).toEqual(["Sub"]);
  });
});

describe("markDuplicates", () => {
  it("marca las que ya tienes (ignorando mayúsculas y espacios) y no las borradas", () => {
    const proposals = [
      { question: "¿A?", answer: "Uno" },
      { question: "¿B?", answer: "Dos" },
    ];
    const marked = markDuplicates(proposals, [
      { question: "¿a? ", answer: "uno" },
      { question: "¿B?", answer: "Dos", deleted_at: "2026-01-01" },
    ]);
    expect(marked.map((p) => p.duplicate)).toEqual([true, false]);
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
