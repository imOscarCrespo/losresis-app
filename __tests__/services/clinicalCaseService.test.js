// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder y la respuesta final ({ data, error }) la decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { response: { data: null, error: null } };
  ["from", "select", "eq", "order", "update", "insert", "delete"].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.single = jest.fn(() => Promise.resolve(builder.response));
  builder.then = (resolve, reject) => Promise.resolve(builder.response).then(resolve, reject);
  return { supabase: builder };
});

jest.mock("../../services/libroTemplateService", () => ({
  getPublishedLibroTemplateForUser: jest.fn(),
}));

const { supabase: mockBuilder } = jest.requireMock("../../config/supabase");
const respond = (value) => {
  mockBuilder.response = value;
};

import {
  deleteClinicalCase,
  getClinicalCaseRequirements,
  getClinicalCases,
  linkClinicalCase,
  saveClinicalCase,
} from "../../services/clinicalCaseService";

beforeEach(() => {
  jest.clearAllMocks();
  respond({ data: null, error: null });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("getClinicalCaseRequirements", () => {
  it("aplana los requisitos con el año y lo retirado de su apartado", async () => {
    respond({
      data: [
        {
          id: "b1",
          residency_year: 1,
          position: 3,
          archived_at: null,
          requirements: [
            { id: "epoc", title: "EPOC", is_required: true, position: 0, archived_at: null },
            { id: "old", title: "Viejo", is_required: true, position: 1, archived_at: "2026-10-01" },
          ],
        },
        {
          id: "b2",
          residency_year: 2,
          position: 0,
          archived_at: "2026-10-02",
          requirements: [{ id: "r2", title: "R2", is_required: true, position: 0, archived_at: null }],
        },
      ],
      error: null,
    });

    const { requirements, blockPositions } = await getClinicalCaseRequirements("t");

    expect(mockBuilder.from).toHaveBeenCalledWith("libro_clinical_case_block");
    expect(mockBuilder.eq).toHaveBeenCalledWith("template_id", "t");
    expect(requirements.map((item) => [item.id, item.residency_year, item.archived])).toEqual([
      ["epoc", 1, false],
      ["old", 1, true],
      ["r2", 2, true],
    ]);
    expect(Array.from(blockPositions.entries())).toEqual([[1, 3]]);
  });

  it("sin plantilla no pregunta, y si la base falla el Libro se abre sin requisitos", async () => {
    expect((await getClinicalCaseRequirements(null)).requirements).toEqual([]);
    expect(mockBuilder.from).not.toHaveBeenCalled();

    respond({ data: null, error: { message: "boom" } });
    expect((await getClinicalCaseRequirements("t")).requirements).toEqual([]);
  });
});

describe("getClinicalCases", () => {
  it("lee las fichas del residente y devuelve [] si falla", async () => {
    respond({ data: [{ id: "c" }], error: null });
    expect(await getClinicalCases("u")).toEqual([{ id: "c" }]);
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "u");

    respond({ data: null, error: { message: "boom" } });
    expect(await getClinicalCases("u")).toEqual([]);
  });
});

describe("saveClinicalCase", () => {
  const payload = { user_id: "u", residency_year: 1, title: "EPOC", status: "draft" };

  it("inserta uno nuevo y actualiza uno existente solo si es suyo", async () => {
    respond({ data: { id: "c" }, error: null });
    await saveClinicalCase({ payload });
    expect(mockBuilder.insert).toHaveBeenCalledWith(payload);

    await saveClinicalCase({ caseId: "c", payload });
    expect(mockBuilder.update).toHaveBeenCalledWith(payload);
    expect(mockBuilder.eq).toHaveBeenCalledWith("id", "c");
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "u");
  });

  it("traduce el duplicado y la ficha incompleta", async () => {
    respond({ data: null, error: { code: "23505", message: "duplicate key" } });
    await expect(saveClinicalCase({ payload })).rejects.toThrow(
      "Ya tienes un caso vinculado a este requisito."
    );

    respond({
      data: null,
      error: { code: "23514", message: 'violates check constraint "libro_clinical_case_completed_fields"' },
    });
    await expect(saveClinicalCase({ payload })).rejects.toThrow(/campos obligatorios/);

    respond({ data: null, error: { code: "23514", message: "Tu hospital ya no pide el caso «EPOC»" } });
    await expect(saveClinicalCase({ payload })).rejects.toThrow("Tu hospital ya no pide el caso «EPOC»");
  });

  it("sin usuario o año no llama a la base", async () => {
    await expect(saveClinicalCase({ payload: { title: "x" } })).rejects.toThrow(/Faltan datos/);
    expect(mockBuilder.from).not.toHaveBeenCalled();
  });
});

describe("linkClinicalCase y deleteClinicalCase", () => {
  it("vincula fijando requirement_id", async () => {
    respond({ data: { id: "c", requirement_id: "epoc" }, error: null });
    const result = await linkClinicalCase({ caseId: "c", userId: "u", requirementId: "epoc" });
    expect(mockBuilder.update).toHaveBeenCalledWith({ requirement_id: "epoc" });
    expect(result.requirement_id).toBe("epoc");

    respond({ data: null, error: { code: "23505", message: "dup" } });
    await expect(
      linkClinicalCase({ caseId: "c", userId: "u", requirementId: "epoc" })
    ).rejects.toThrow("Ya tienes un caso vinculado a este requisito.");
  });

  it("borra solo lo suyo y lanza si falla", async () => {
    await deleteClinicalCase({ caseId: "c", userId: "u" });
    expect(mockBuilder.delete).toHaveBeenCalled();
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "u");

    respond({ data: null, error: { message: "boom" } });
    await expect(deleteClinicalCase({ caseId: "c", userId: "u" })).rejects.toThrow("boom");
  });
});
