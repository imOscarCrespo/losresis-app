// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder y la respuesta final ({ data, error }) la decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { response: { data: null, error: null } };
  ["from", "select"].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.eq = jest.fn(() => Promise.resolve(builder.response));
  builder.rpc = jest.fn(() => Promise.resolve(builder.response));
  return { supabase: builder };
});

// El catálogo empaquetado no hace falta para estas funciones.
jest.mock("../../services/staticCatalogService", () => ({
  getHospitalByIdFromCatalog: jest.fn(),
  getHospitalDiscoveryRankingsCatalog: jest.fn(() => []),
  getHospitalsCatalog: jest.fn(() => []),
  getHospitalSpecialityCatalog: jest.fn(() => [
    { hospital_id: "h1", speciality_id: "card" },
    { hospital_id: "h1", speciality_id: "mi" },
  ]),
  getHospitalSpecialityGradesCatalog: jest.fn(() => []),
  getSpecialitiesCatalog: jest.fn(() => [
    { id: "card", name: "Cardiología" },
    { id: "mi", name: "Medicina Interna" },
  ]),
  getSpecialityByIdFromCatalog: jest.fn(),
}));

const { supabase: mockBuilder } = jest.requireMock("../../config/supabase");

import {
  getMyOpenDayRegistrations,
  getOpenDaySpecialityOptions,
  saveOpenDayRegistration,
} from "../../services/hospitalService";

beforeEach(() => {
  jest.clearAllMocks();
  mockBuilder.response = { data: null, error: null };
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("getMyOpenDayRegistrations", () => {
  it("devuelve las jornadas inscritas y las especialidades de cada una", async () => {
    mockBuilder.response = {
      data: [
        {
          open_day_id: "d1",
          hospital_open_day_registration_speciality: [
            { speciality_id: "card" },
            { speciality_id: "mi" },
          ],
        },
        // Inscripción anterior a la selección de especialidades.
        { open_day_id: "d2", hospital_open_day_registration_speciality: [] },
      ],
      error: null,
    };

    const result = await getMyOpenDayRegistrations("u1");

    expect(mockBuilder.from).toHaveBeenCalledWith("hospital_open_day_registration");
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(result).toEqual({
      success: true,
      openDayIds: ["d1", "d2"],
      specialityIdsByOpenDay: { d1: ["card", "mi"], d2: [] },
      error: null,
    });
  });

  it("sin usuario no consulta nada", async () => {
    const result = await getMyOpenDayRegistrations(null);
    expect(mockBuilder.from).not.toHaveBeenCalled();
    expect(result.openDayIds).toEqual([]);
  });

  it("propaga el error de Supabase sin inventar inscripciones", async () => {
    mockBuilder.response = { data: null, error: { message: "boom" } };
    const result = await getMyOpenDayRegistrations("u1");
    expect(result).toEqual({
      success: false,
      openDayIds: [],
      specialityIdsByOpenDay: {},
      error: "boom",
    });
  });
});

describe("saveOpenDayRegistration", () => {
  it("inscribe y guarda la selección en una sola llamada al RPC", async () => {
    const result = await saveOpenDayRegistration("d1", ["card", "mi", "ped"]);

    expect(mockBuilder.rpc).toHaveBeenCalledWith("save_hospital_open_day_registration", {
      p_open_day_id: "d1",
      p_speciality_ids: ["card", "mi", "ped"],
    });
    expect(result).toEqual({ success: true, error: null });
  });

  it("no da por guardado lo que el RPC rechaza", async () => {
    mockBuilder.response = {
      data: null,
      error: { message: "La jornada ya ha empezado: tus especialidades ya no se pueden modificar" },
    };
    const result = await saveOpenDayRegistration("d1", ["card"]);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ya ha empezado/);
  });

  it("sin jornada no llama al RPC", async () => {
    const result = await saveOpenDayRegistration(null, ["card"]);
    expect(mockBuilder.rpc).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

describe("getOpenDaySpecialityOptions", () => {
  it("sale del catálogo hospital-especialidad, no de todas las MIR", () => {
    expect(getOpenDaySpecialityOptions("h1")).toEqual([
      { id: "card", name: "Cardiología" },
      { id: "mi", name: "Medicina Interna" },
    ]);
    expect(getOpenDaySpecialityOptions("h2")).toEqual([]);
  });
});
