// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder y la respuesta final ({ data, error }) la decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { response: { data: null, error: null } };
  ["from", "select", "eq", "in", "order", "update", "upsert"].forEach(
    (method) => {
      builder[method] = jest.fn(() => builder);
    },
  );
  builder.single = jest.fn(() => Promise.resolve(builder.response));
  builder.maybeSingle = jest.fn(() => Promise.resolve(builder.response));
  return { supabase: builder };
});

jest.mock("../../services/libroService", () => ({
  createEntry: jest.fn(() => Promise.resolve({})),
  createNode: jest.fn(),
  ensureLibroForResident: jest.fn(),
  getAllLibroData: jest.fn(),
}));

jest.mock("../../services/hospitalService", () => ({
  getSpecialtyById: jest.fn(() =>
    Promise.resolve({ success: true, specialty: { name: "Obstetricia" } }),
  ),
}));

const { supabase: mockBuilder } = jest.requireMock("../../config/supabase");
const libro = jest.requireMock("../../services/libroService");

import {
  canAddLibroProcedures,
  getDebriefLibro,
  getFrequentProcedures,
  saveFrequentProcedures,
  saveShiftDebrief,
  syncDebriefWithLibro,
} from "../../services/shiftDebriefService";

const shift = {
  id: "ev1",
  event_date: "2026-10-26",
  metadata: { shift_duration: "24h" },
};
const activeBook = {
  id: "b1",
  status: "active",
  template_id: null,
  residency_year: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBuilder.response = { data: null, error: null };
});

describe("saveShiftDebrief", () => {
  it("el guardado automático no cambia el estado y limpia los textos", async () => {
    mockBuilder.response = { data: { id: "d1" }, error: null };
    await saveShiftDebrief({
      userId: "u1",
      shift,
      fields: {
        autonomy: "occasional_support",
        autonomy_comment: "  ",
        learnings: null,
      },
    });
    const [[rows], options] = mockBuilder.upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "agenda_event_id" });
    expect(rows).toEqual({
      user_id: "u1",
      agenda_event_id: "ev1",
      shift_date: "2026-10-26",
      autonomy: "occasional_support",
      autonomy_comment: null,
      learnings: [],
    });
  });

  it("completar marca el estado y la fecha", async () => {
    mockBuilder.response = { data: { id: "d1" }, error: null };
    await saveShiftDebrief({
      userId: "u1",
      shift,
      fields: { rating: 4 },
      complete: true,
    });
    const [[rows]] = mockBuilder.upsert.mock.calls[0];
    expect(rows.status).toBe("completed");
    expect(rows.completed_at).toEqual(expect.any(String));
  });

  it("propaga el error de la BD", async () => {
    mockBuilder.response = { data: null, error: new Error("rls") };
    await expect(
      saveShiftDebrief({ userId: "u1", shift, fields: {} }),
    ).rejects.toThrow("rls");
  });
});

describe("frecuentes", () => {
  it("null si nunca los ha configurado", async () => {
    mockBuilder.response = {
      data: { shift_frequent_procedures: null },
      error: null,
    };
    await expect(getFrequentProcedures("u1")).resolves.toBeNull();
  });

  it("guarda solo su columna, sin vacíos", async () => {
    mockBuilder.response = {
      data: { shift_frequent_procedures: [] },
      error: null,
    };
    await saveFrequentProcedures("u1", [
      { node_id: "n1", name: "Cesáreas", area_name: "Sala" },
      { node_id: null, name: " " },
    ]);
    const [[rows]] = mockBuilder.upsert.mock.calls[0];
    expect(rows).toEqual({
      user_id: "u1",
      shift_frequent_procedures: [{ node_id: "n1", name: "Cesáreas" }],
    });
  });

  it("propaga el error de la BD", async () => {
    mockBuilder.response = { data: null, error: new Error("boom") };
    await expect(getFrequentProcedures("u1")).rejects.toThrow("boom");
  });
});

describe("syncDebriefWithLibro", () => {
  // La lectura de libro_entry termina en .in(): la última llamada resuelve.
  const libroHas = (rows) => {
    mockBuilder.in
      .mockImplementationOnce(() => mockBuilder)
      .mockImplementationOnce(() =>
        Promise.resolve({ data: rows, error: null }),
      );
  };

  it("escribe solo la diferencia con lo que el Libro tiene ahora, con la fecha y el id de la guardia", async () => {
    libroHas([
      { node_id: "n1", count: 1, performed_at: "2026-10-26" },
      { node_id: "n2", count: 2, performed_at: "2026-10-27" },
    ]);
    const result = await syncDebriefWithLibro({
      userId: "u1",
      shift,
      book: activeBook,
      desiredCounts: { n1: 3, n2: 2, n3: 0 },
    });
    expect(mockBuilder.in).toHaveBeenCalledWith("performed_at", [
      "2026-10-26",
      "2026-10-27",
    ]);
    expect(libro.createEntry).toHaveBeenCalledTimes(1);
    expect(libro.createEntry).toHaveBeenCalledWith(
      "n1",
      {
        count: 2,
        residency_year: 2,
        performed_at: "2026-10-26",
        payload: { agenda_event_id: "ev1", source: "shift_debrief" },
      },
      "clinical_practice",
      "u1",
    );
    expect(result).toEqual({ n1: 3, n2: 2, n3: 0 });
  });

  it("reintentar tras un fallo a medias no duplica lo que ya entró", async () => {
    libroHas([]);
    libro.createEntry
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("red"));
    await expect(
      syncDebriefWithLibro({
        userId: "u1",
        shift,
        book: activeBook,
        desiredCounts: { n1: 2, n2: 1 },
      }),
    ).rejects.toThrow("red");

    // El Libro ya tiene los 2 de n1: el reintento solo escribe n2.
    libroHas([{ node_id: "n1", count: 2, performed_at: "2026-10-26" }]);
    libro.createEntry.mockClear();
    await syncDebriefWithLibro({
      userId: "u1",
      shift,
      book: activeBook,
      desiredCounts: { n1: 2, n2: 1 },
    });
    expect(libro.createEntry).toHaveBeenCalledTimes(1);
    expect(libro.createEntry.mock.calls[0][0]).toBe("n2");
  });

  it("un menos escribe un negativo, no borra", async () => {
    libroHas([{ node_id: "n1", count: 3, performed_at: "2026-10-26" }]);
    await syncDebriefWithLibro({
      userId: "u1",
      shift,
      book: activeBook,
      desiredCounts: { n1: 1 },
    });
    expect(libro.createEntry.mock.calls[0][1].count).toBe(-2);
  });

  it("propaga el error de la lectura sin escribir", async () => {
    mockBuilder.in
      .mockImplementationOnce(() => mockBuilder)
      .mockImplementationOnce(() =>
        Promise.resolve({ data: null, error: new Error("boom") }),
      );
    await expect(
      syncDebriefWithLibro({
        userId: "u1",
        shift,
        book: activeBook,
        desiredCounts: { n1: 1 },
      }),
    ).rejects.toThrow("boom");
    expect(libro.createEntry).not.toHaveBeenCalled();
  });

  it("no escribe en un libro archivado", async () => {
    const result = await syncDebriefWithLibro({
      userId: "u1",
      shift,
      book: { ...activeBook, status: "archived" },
      desiredCounts: { n1: 1 },
    });
    expect(result).toBeNull();
    expect(libro.createEntry).not.toHaveBeenCalled();
  });
});

describe("getDebriefLibro", () => {
  it("siembra el Libro si el residente nunca lo ha abierto", async () => {
    libro.getAllLibroData
      .mockResolvedValueOnce({ book: null, nodes: [], entries: [] })
      .mockResolvedValueOnce({
        book: activeBook,
        nodes: [{ id: "a" }],
        entries: [],
      });
    libro.ensureLibroForResident.mockResolvedValueOnce(true);

    const data = await getDebriefLibro({
      id: "u1",
      speciality_id: "s1",
      resident_year: 2,
    });
    expect(libro.ensureLibroForResident).toHaveBeenCalledWith({
      userId: "u1",
      specialityId: "s1",
      specialtyName: "Obstetricia",
      residencyYear: 2,
    });
    expect(data.book).toBe(activeBook);
  });

  it("solo el Libro propio activo admite procedimientos nuevos", () => {
    expect(canAddLibroProcedures(activeBook)).toBe(true);
    expect(canAddLibroProcedures({ ...activeBook, template_id: "t1" })).toBe(
      false,
    );
    expect(canAddLibroProcedures({ ...activeBook, status: "archived" })).toBe(
      false,
    );
    expect(canAddLibroProcedures(null)).toBe(false);
  });
});
