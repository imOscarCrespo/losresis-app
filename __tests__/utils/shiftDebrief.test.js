import {
  addDaysIso,
  buildProceduresSnapshot,
  cleanReflection,
  computeLibroDeltas,
  findProcedureByName,
  formatProcedureTotal,
  getCountableProcedures,
  getDebriefStatus,
  getShiftEndDate,
  getShiftLibroDates,
  hasReflection,
  isShiftFinished,
  moveItem,
  procedureKey,
  resolveFrequentProcedures,
  searchProcedures,
  sumLibroCountsForShift,
  summarizeDebrief,
} from "../../utils/shiftDebrief";

const shift24 = {
  id: "ev1",
  event_date: "2026-10-26",
  end_date: null,
  metadata: { shift_duration: "24h" },
};
const shift12 = {
  id: "ev2",
  event_date: "2026-10-26",
  end_date: null,
  metadata: { shift_duration: "12h" },
};

describe("fechas de la guardia", () => {
  it("suma días sin zona horaria, también al cambiar de mes", () => {
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysIso("bad", 1)).toBeNull();
  });

  it("sin hora de fin, la guardia acaba en su fecha de fin del calendario", () => {
    expect(getShiftEndDate(shift24)).toBe("2026-10-26");
    expect(
      getShiftEndDate({ event_date: "2026-10-26", end_date: "2026-10-27" }),
    ).toBe("2026-10-27");
  });

  it("se puede registrar desde el día en que acaba, no antes", () => {
    expect(isShiftFinished(shift24, "2026-10-25")).toBe(false);
    expect(isShiftFinished(shift24, "2026-10-26")).toBe(true);
    expect(isShiftFinished(shift24, "2026-10-27")).toBe(true);
    expect(isShiftFinished({ event_date: null }, "2026-10-27")).toBe(false);
  });

  it("una de 24 h cuenta también lo apuntado el día siguiente; una de 12 h no", () => {
    expect(getShiftLibroDates(shift24)).toEqual(["2026-10-26", "2026-10-27"]);
    expect(getShiftLibroDates(shift12)).toEqual(["2026-10-26"]);
    expect(
      getShiftLibroDates({ event_date: "2026-10-26", metadata: {} }),
    ).toEqual(["2026-10-26", "2026-10-27"]);
  });
});

describe("contadores contra el Libro", () => {
  const entries = [
    { node_id: "a", count: 1, performed_at: "2026-10-26" },
    { node_id: "a", count: 1, performed_at: "2026-10-27" },
    { node_id: "a", count: 5, performed_at: "2026-10-20" },
    { node_id: "b", count: 1, performed_at: "2026-10-26" },
    { node_id: "b", count: -1, performed_at: "2026-10-26" },
    { node_id: "c", count: -1, performed_at: "2026-10-26" },
  ];

  it("arranca con lo que el Libro ya tiene en las fechas de la guardia", () => {
    expect(sumLibroCountsForShift(entries, shift24)).toEqual({
      a: 2,
      b: 0,
      c: 0,
    });
    expect(sumLibroCountsForShift(entries, shift12)).toEqual({
      a: 1,
      b: 0,
      c: 0,
    });
  });

  it("solo escribe la diferencia: nada si no cambia, negativo si baja", () => {
    expect(computeLibroDeltas({ a: 2 }, { a: 2 })).toEqual([]);
    expect(computeLibroDeltas({ a: 2 }, { a: 4, b: 1 })).toEqual([
      { nodeId: "a", delta: 2 },
      { nodeId: "b", delta: 1 },
    ]);
    expect(computeLibroDeltas({ a: 2 }, { a: 0 })).toEqual([
      { nodeId: "a", delta: -2 },
    ]);
  });

  it("no toca actividades que no están en pantalla ni baja de cero", () => {
    expect(computeLibroDeltas({ a: 3, z: 9 }, { a: -4 })).toEqual([
      { nodeId: "a", delta: -3 },
    ]);
  });

  it("guardar dos veces lo mismo no duplica", () => {
    const first = computeLibroDeltas({}, { a: 2 });
    const libroAfter = { a: first[0].delta };
    expect(computeLibroDeltas(libroAfter, { a: 2 })).toEqual([]);
  });
});

describe("catálogo y frecuentes", () => {
  const nodes = [
    { id: "area1", parent_node_id: null, name: "Sala de partos" },
    {
      id: "n1",
      parent_node_id: "area1",
      name: "Partos eutócicos",
      tracking_mode: "counter",
    },
    {
      id: "n2",
      parent_node_id: "area1",
      name: "Cesáreas",
      tracking_mode: "participation",
    },
    { id: "n3", parent_node_id: "area1", name: "Notas", tracking_mode: "note" },
    {
      id: "n4",
      parent_node_id: "area1",
      name: "Ecografías",
      tracking_mode: null,
    },
  ];
  const catalog = getCountableProcedures(nodes);

  it("el catálogo son las actividades que se cuentan, con su área", () => {
    expect(catalog.map((item) => item.name)).toEqual([
      "Partos eutócicos",
      "Cesáreas",
      "Ecografías",
    ]);
    expect(catalog[0]).toEqual({
      node_id: "n1",
      name: "Partos eutócicos",
      area_name: "Sala de partos",
    });
  });

  it("busca sin tildes ni mayúsculas y sin los ya elegidos", () => {
    expect(
      searchProcedures(catalog, "cesarea").map((item) => item.node_id),
    ).toEqual(["n2"]);
    expect(
      searchProcedures(catalog, "", [procedureKey({ node_id: "n1" })]).map(
        (item) => item.node_id,
      ),
    ).toEqual(["n2", "n4"]);
    expect(findProcedureByName(catalog, " ecografias ")?.node_id).toBe("n4");
  });

  it("resuelve los frecuentes por id, por nombre si el Libro cambió, y deja los personalizados", () => {
    const saved = [
      { node_id: "n2", name: "Cesáreas" },
      { node_id: "old", name: "partos EUTÓCICOS" },
      { node_id: null, name: "Legrados" },
      { node_id: "n2", name: "Cesáreas" },
      { node_id: null, name: "  " },
    ];
    expect(resolveFrequentProcedures(saved, catalog)).toEqual([
      { node_id: "n2", name: "Cesáreas" },
      { node_id: "n1", name: "Partos eutócicos" },
      { node_id: null, name: "Legrados" },
    ]);
    expect(resolveFrequentProcedures(null, catalog)).toEqual([]);
  });

  it("reordena sin salirse de la lista", () => {
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});

describe("resumen", () => {
  it("la foto solo guarda los procedimientos hechos", () => {
    const items = [
      { node_id: "n1", name: "Partos eutócicos" },
      { node_id: null, name: "Legrados" },
      { node_id: "n2", name: "Cesáreas" },
    ];
    const counts = { "node:n1": 2, "name:legrados": 1, "node:n2": 0 };
    expect(buildProceduresSnapshot(items, counts)).toEqual([
      { node_id: "n1", name: "Partos eutócicos", count: 2 },
      { node_id: null, name: "Legrados", count: 1 },
    ]);
  });

  it("tu guardia en números", () => {
    const summary = summarizeDebrief({
      procedures: [
        { name: "Partos eutócicos", count: 2 },
        { name: "Cesáreas", count: 1 },
        { name: "Ecografías", count: 4 },
        { name: "Suturas", count: 1 },
      ],
      learnings: ["teamwork", "new_technique"],
      autonomy: "occasional_support",
      rating: 4,
    });
    expect(summary.total).toBe(8);
    expect(formatProcedureTotal(summary.total)).toBe(
      "8 procedimientos registrados",
    );
    expect(formatProcedureTotal(1)).toBe("1 procedimiento registrado");
    expect(summary.learnings.map((item) => item.value)).toEqual([
      "new_technique",
      "teamwork",
    ]);
    expect(summary.autonomy.short).toBe("Con apoyo puntual");
    expect(summary.rating.label).toBe("Buena");
  });

  it("se puede completar sin escribir nada", () => {
    const summary = summarizeDebrief({
      procedures: [],
      learnings: [],
      autonomy: null,
      rating: null,
    });
    expect(summary).toMatchObject({ total: 0, autonomy: null, rating: null });
  });

  it("la ampliada guarda solo lo escrito", () => {
    expect(
      cleanReflection({ learnings: "  algo ", difficulties: " ", foo: "x" }),
    ).toEqual({ learnings: "algo" });
    expect(hasReflection({ personal: " " })).toBe(false);
    expect(hasReflection({ personal: "sí" })).toBe(true);
  });

  it("estado: completada, pendiente si ya acabó, nada si aún no", () => {
    expect(
      getDebriefStatus(shift24, { status: "completed" }, "2026-10-20"),
    ).toBe("completed");
    expect(getDebriefStatus(shift24, { status: "draft" }, "2026-10-27")).toBe(
      "pending",
    );
    expect(getDebriefStatus(shift24, null, "2026-10-27")).toBe("pending");
    expect(getDebriefStatus(shift24, null, "2026-10-25")).toBeNull();
  });
});
