import {
  activityTree,
  buildCustomFieldValues,
  canAddCustomEntry,
  combineLibroProgress,
  customSectionGoals,
  formatCustomValue,
  mergeCustomIntoIndex,
  performedAtFor,
  templateYearFor,
  validateCustomEntry,
  visibleCustomSections,
} from "../../utils/libroCustom";

const field = (overrides) => ({
  id: "f",
  label: "Campo",
  field_type: "short_text",
  required: false,
  options: [],
  unit: null,
  min_value: null,
  max_value: null,
  position: 0,
  archived_at: null,
  ...overrides,
});

describe("validateCustomEntry", () => {
  it("avisa del campo obligatorio sin completar con su nombre", () => {
    const fields = [field({ id: "p", label: "Procedimiento", required: true })];
    expect(validateCustomEntry(fields, {})).toEqual([
      { fieldId: "p", message: "Falta «Procedimiento»." },
    ]);
    expect(validateCustomEntry(fields, { p: "   " })).toHaveLength(1);
    expect(validateCustomEntry(fields, { p: "Sutura" })).toEqual([]);
  });

  it("un número a cero es una respuesta, no un hueco", () => {
    const fields = [field({ id: "n", label: "Intervenciones", field_type: "integer", required: true })];
    expect(validateCustomEntry(fields, { n: 0 })).toEqual([]);
  });

  it("un «No» es una respuesta en un Sí / No obligatorio", () => {
    const fields = [field({ id: "b", field_type: "boolean", required: true })];
    expect(validateCustomEntry(fields, { b: false })).toEqual([]);
  });

  it("respeta mínimo, máximo y enteros", () => {
    const fields = [
      field({ id: "s", label: "Autonomía", field_type: "scale", min_value: 1, max_value: 5 }),
      field({ id: "h", label: "Horas", field_type: "decimal", min_value: "0.5" }),
    ];
    expect(validateCustomEntry(fields, { s: 6 }).map((e) => e.message)).toEqual([
      "«Autonomía» no puede ser mayor que 5.",
    ]);
    expect(validateCustomEntry(fields, { s: 2.5 }).map((e) => e.message)).toEqual([
      "«Autonomía» tiene que ser un número entero.",
    ]);
    expect(validateCustomEntry(fields, { h: 0.25 }).map((e) => e.message)).toEqual([
      "«Horas» no puede ser menor que 0.5.",
    ]);
  });

  it("comprueba el formato de hora y de fecha y hora", () => {
    const fields = [
      field({ id: "t", label: "Inicio", field_type: "time" }),
      field({ id: "d", label: "Momento", field_type: "datetime" }),
    ];
    expect(validateCustomEntry(fields, { t: "25:00", d: "2026-03-15" })).toHaveLength(2);
    expect(validateCustomEntry(fields, { t: "08:30", d: "2026-03-15T08:30" })).toEqual([]);
  });
});

describe("buildCustomFieldValues", () => {
  it("quita los vacíos y conserva las respuestas de campos retirados", () => {
    const fields = [field({ id: "a" }), field({ id: "b" })];
    expect(
      buildCustomFieldValues(fields, { a: "x", b: "" }, { old: "respuesta vieja", a: "antes" })
    ).toEqual({ old: "respuesta vieja", a: "x" });
  });
});

describe("performedAtFor", () => {
  it("usa la primera fecha del formulario y si no hay, hoy", () => {
    const fields = [field({ id: "d", field_type: "datetime" })];
    expect(performedAtFor(fields, { d: "2026-03-15T08:30" })).toBe("2026-03-15");
    expect(performedAtFor(fields, {}, new Date(2026, 9, 18))).toBe("2026-10-18");
  });
});

describe("formatCustomValue", () => {
  it("pinta cada tipo como lo leerá el residente", () => {
    const select = field({
      field_type: "multi_choice",
      options: [{ id: "a", label: "Sutura" }, { id: "b", label: "Drenaje", archived: true }],
    });
    expect(formatCustomValue(select, ["a", "b"])).toBe("Sutura, Drenaje");
    expect(formatCustomValue(field({ field_type: "duration" }), 90)).toBe("1 h 30 min");
    expect(formatCustomValue(field({ field_type: "decimal", unit: "h" }), 1.5)).toBe("1,5 h");
    expect(formatCustomValue(field({ field_type: "scale", max_value: "5" }), 4)).toBe("4 de 5");
    expect(formatCustomValue(field({ field_type: "integer" }), 0)).toBe("0");
  });
});

const grouped = {
  id: "s",
  record_mode: "grouped",
  allow_multiple: true,
  goal: null,
  archived_at: null,
  activities: [
    { id: "a2", kind: "activity", parent_id: "g1", name: "Cesárea", goal: 2, position: 1 },
    { id: "g1", kind: "group", parent_id: null, name: "Partos", position: 0 },
    { id: "a1", kind: "activity", parent_id: "g1", name: "Eutócico", goal: 20, position: 0 },
    { id: "g2", kind: "group", parent_id: null, name: "Vacío", position: 1 },
    { id: "a3", kind: "activity", parent_id: "g1", name: "Retirada", goal: 5, position: 2, archived_at: "2026-10-01" },
  ],
};

describe("activityTree", () => {
  it("agrupa en orden y deja fuera lo archivado y los grupos vacíos", () => {
    const tree = activityTree(grouped);
    expect(tree.map((group) => group.name)).toEqual(["Partos"]);
    expect(tree[0].children.map((activity) => activity.name)).toEqual(["Eutócico", "Cesárea"]);
  });
});

describe("customSectionGoals", () => {
  it("cuenta una meta por actividad viva con objetivo, sumando count", () => {
    const entries = [
      { activity_id: "a2", count: 1 },
      { activity_id: "a2", count: 1 },
      { activity_id: "a1", count: 3 },
    ];
    expect(customSectionGoals(grouped, entries)).toEqual([{ done: false }, { done: true }]);
  });

  it("un apartado retirado no aporta objetivos", () => {
    expect(customSectionGoals({ ...grouped, archived_at: "2026-10-01", goal: 3 }, [])).toEqual([]);
  });

  it("la meta del apartado entero cuenta como un objetivo", () => {
    const section = { record_mode: "free", goal: 2, activities: [] };
    expect(customSectionGoals(section, [{ count: 1 }, { count: 1 }])).toEqual([{ done: true }]);
  });
});

describe("canAddCustomEntry", () => {
  it("en los de un solo registro el segundo no se crea", () => {
    const single = { allow_multiple: false };
    expect(canAddCustomEntry(single, [])).toBe(true);
    expect(canAddCustomEntry(single, [{ activity_id: null }])).toBe(false);
    expect(canAddCustomEntry(single, [{ activity_id: "a1" }], "a2")).toBe(true);
    expect(canAddCustomEntry({ allow_multiple: true }, [{ activity_id: null }])).toBe(true);
  });
});

describe("visibleCustomSections", () => {
  const sections = [
    { id: "b", residency_year: 5, position: 4, archived_at: null },
    { id: "a", residency_year: 5, position: 2, archived_at: null },
    { id: "old", residency_year: 5, position: 1, archived_at: "2026-10-01" },
    { id: "gone", residency_year: 5, position: 0, archived_at: "2026-10-01" },
    { id: "r1", residency_year: 1, position: 0, archived_at: null },
  ];

  it("un R6 ve la estructura de R5 y los retirados solo si registró en ellos", () => {
    const entries = [{ section_id: "old", residency_year: 6 }, { section_id: "gone", residency_year: 5 }];
    expect(visibleCustomSections(sections, entries, 6).map((s) => s.id)).toEqual(["old", "a", "b"]);
  });

  it("no mezcla años", () => {
    expect(visibleCustomSections(sections, [], 1).map((s) => s.id)).toEqual(["r1"]);
    expect(templateYearFor(9)).toBe(5);
  });
});

describe("mergeCustomIntoIndex", () => {
  it("intercala por la posición de la plantilla sin reordenar los del catálogo", () => {
    const catalog = [{ section: "rotations" }, { section: "clinical_practice" }, { section: "competencies" }];
    const positions = new Map([
      ["rotations", 0],
      ["clinical_practice", 1],
      ["competencies", 3],
    ]);
    const custom = [
      { customSectionId: "z", position: 9 },
      { customSectionId: "x", position: 2 },
    ];
    expect(
      mergeCustomIntoIndex(catalog, custom, positions).map((i) => i.section || i.customSectionId)
    ).toEqual(["rotations", "clinical_practice", "x", "competencies", "z"]);
  });
});

describe("combineLibroProgress", () => {
  it("suma las metas de los personalizados al progreso del año", () => {
    expect(combineLibroProgress({ done: 1, total: 3, percent: 33 }, [{ done: true }])).toEqual({
      done: 2,
      total: 4,
      percent: 50,
    });
  });

  it("sin metas en ningún sitio no hay porcentaje", () => {
    expect(combineLibroProgress(null, [])).toBeNull();
    expect(combineLibroProgress(null, [{ done: false }])).toEqual({ done: 0, total: 1, percent: 0 });
  });
});
