// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder y la respuesta final ({ data, error }) la decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { response: { data: null, error: null } };
  ["from", "select", "eq", "order"].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.in = jest.fn(() => Promise.resolve(builder.response));
  builder.rpc = jest.fn(() => Promise.resolve(builder.response));
  return { supabase: builder };
});

const { supabase: mockBuilder } = jest.requireMock("../../config/supabase");

import {
  getTutoringPreparations,
  saveTutoringPreparation,
} from "../../services/docenciaService";

beforeEach(() => {
  jest.clearAllMocks();
  mockBuilder.response = { data: null, error: null };
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("getTutoringPreparations", () => {
  it("sin tutorías no consulta", async () => {
    await expect(getTutoringPreparations([])).resolves.toEqual([]);
    expect(mockBuilder.from).not.toHaveBeenCalled();
  });

  it("lee la tabla nueva filtrando por las tutorías", async () => {
    mockBuilder.response = { data: [{ tutoring_id: "t1", status: "draft" }], error: null };

    await expect(getTutoringPreparations(["t1", "t2"])).resolves.toEqual([
      { tutoring_id: "t1", status: "draft" },
    ]);
    expect(mockBuilder.from).toHaveBeenCalledWith("hospital_tutoring_preparation");
    expect(mockBuilder.in).toHaveBeenCalledWith("tutoring_id", ["t1", "t2"]);
  });

  it("propaga el error", async () => {
    mockBuilder.response = { data: null, error: { message: "boom" } };
    await expect(getTutoringPreparations(["t1"])).rejects.toEqual({ message: "boom" });
  });
});

describe("saveTutoringPreparation", () => {
  it("llama a la RPC con borrador o envío", async () => {
    mockBuilder.response = { data: { status: "sent" }, error: null };

    await expect(
      saveTutoringPreparation("t1", { learnings: "a" }, ["g"], true)
    ).resolves.toEqual({ status: "sent" });
    expect(mockBuilder.rpc).toHaveBeenCalledWith("save_hospital_tutoring_preparation", {
      p_tutoring_id: "t1",
      p_answers: { learnings: "a" },
      p_proposed_goals: ["g"],
      p_send: true,
    });

    await saveTutoringPreparation("t1", null, null, undefined);
    expect(mockBuilder.rpc).toHaveBeenLastCalledWith("save_hospital_tutoring_preparation", {
      p_tutoring_id: "t1",
      p_answers: {},
      p_proposed_goals: [],
      p_send: false,
    });
  });

  it("propaga el error de la RPC", async () => {
    mockBuilder.response = { data: null, error: { message: "Esta tutoria ya no se puede modificar" } };
    await expect(saveTutoringPreparation("t1", {}, [], false)).rejects.toEqual({
      message: "Esta tutoria ya no se puede modificar",
    });
  });
});
