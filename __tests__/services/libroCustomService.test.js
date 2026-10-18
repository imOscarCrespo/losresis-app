// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder y la respuesta final ({ data, error }) la decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { response: { data: null, error: null } };
  ["from", "select", "eq", "order", "update", "insert", "delete"].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.single = jest.fn(() => Promise.resolve(builder.response));
  // await directo sobre el builder (select/delete sin .single()).
  builder.then = (resolve, reject) => Promise.resolve(builder.response).then(resolve, reject);
  return { supabase: builder };
});

const { supabase: mockBuilder } = jest.requireMock("../../config/supabase");
const respond = (value) => {
  mockBuilder.response = value;
};

import {
  deleteLibroCustomEntry,
  getLibroCustomSections,
  saveLibroCustomEntry,
} from "../../services/libroCustomService";

beforeEach(() => {
  jest.clearAllMocks();
  respond({ data: null, error: null });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("getLibroCustomSections", () => {
  it("convierte a número los límites que PostgREST manda como texto", async () => {
    respond({
      data: [
        {
          id: "s",
          fields: [{ id: "f", options: null, min_value: "1", max_value: "5" }],
          activities: null,
        },
      ],
      error: null,
    });

    const [section] = await getLibroCustomSections("t");

    expect(mockBuilder.from).toHaveBeenCalledWith("libro_custom_section");
    expect(mockBuilder.eq).toHaveBeenCalledWith("template_id", "t");
    expect(section.fields[0]).toMatchObject({ options: [], min_value: 1, max_value: 5 });
    expect(section.activities).toEqual([]);
  });

  it("sin plantilla no pregunta, y si la base falla el Libro se abre sin ellos", async () => {
    expect(await getLibroCustomSections(null)).toEqual([]);
    expect(mockBuilder.from).not.toHaveBeenCalled();

    respond({ data: null, error: { message: "relation does not exist" } });
    expect(await getLibroCustomSections("t")).toEqual([]);
  });
});

describe("saveLibroCustomEntry", () => {
  it("crea el registro con su apartado, actividad y año", async () => {
    respond({ data: { id: "e" }, error: null });

    await saveLibroCustomEntry({
      userId: "u",
      sectionId: "s",
      activityId: "a",
      residencyYear: 2,
      fieldValues: { f: 0 },
      performedAt: "2026-10-18",
    });

    expect(mockBuilder.insert).toHaveBeenCalledWith({
      field_values: { f: 0 },
      performed_at: "2026-10-18",
      count: 1,
      user_id: "u",
      section_id: "s",
      activity_id: "a",
      residency_year: 2,
    });
  });

  it("al editar no toca apartado, actividad ni año", async () => {
    respond({ data: { id: "e" }, error: null });

    await saveLibroCustomEntry({
      entryId: "e",
      userId: "u",
      sectionId: "s",
      residencyYear: 2,
      fieldValues: { f: "x" },
    });

    expect(mockBuilder.update).toHaveBeenCalledWith({
      field_values: { f: "x" },
      performed_at: null,
      count: 1,
    });
    expect(mockBuilder.eq).toHaveBeenCalledWith("id", "e");
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "u");
  });

  it("devuelve el mensaje de la base cuando la regla del apartado lo rechaza", async () => {
    respond({
      data: null,
      error: { message: "Ya tienes un registro en «Valoración»: edítalo en lugar de crear otro" },
    });

    await expect(
      saveLibroCustomEntry({ userId: "u", sectionId: "s", residencyYear: 1 })
    ).rejects.toThrow("Ya tienes un registro en «Valoración»");
  });
});

describe("deleteLibroCustomEntry", () => {
  it("borra solo lo suyo y lanza si falla", async () => {
    await deleteLibroCustomEntry({ entryId: "e", userId: "u" });
    expect(mockBuilder.delete).toHaveBeenCalled();
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "u");

    respond({ data: null, error: { message: "boom" } });
    await expect(deleteLibroCustomEntry({ entryId: "e", userId: "u" })).rejects.toThrow("boom");
  });
});
