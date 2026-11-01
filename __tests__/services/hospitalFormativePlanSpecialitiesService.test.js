// Supabase se mockea en la frontera: cada consulta es un builder encadenable
// que, al esperarlo, devuelve la respuesta ({ data, error }) de su tabla.
jest.mock("../../config/supabase", () => {
  const state = { responses: {} };
  const supabase = {
    state,
    from: jest.fn((table) => {
      const query = {};
      ["select", "eq", "order", "maybeSingle"].forEach((method) => {
        query[method] = jest.fn(() => query);
      });
      query.then = (resolve, reject) =>
        Promise.resolve(state.responses[table] || { data: null, error: null }).then(
          resolve,
          reject
        );
      return query;
    }),
  };
  return { supabase };
});

jest.mock("../../services/staticCatalogService", () => ({
  getHospitalByIdFromCatalog: jest.fn(),
  getHospitalDiscoveryRankingsCatalog: jest.fn(() => []),
  getHospitalsCatalog: jest.fn(() => []),
  getHospitalSpecialityCatalog: jest.fn(() => []),
  getHospitalSpecialityGradesCatalog: jest.fn(() => []),
  getSpecialitiesCatalog: jest.fn(() => []),
  getSpecialityByIdFromCatalog: jest.fn(),
}));

const { supabase: mockSupabase } = jest.requireMock("../../config/supabase");

import { getHospitalFormativePlanSpecialityIds } from "../../services/hospitalService";

const ORG = "org-1";

const respond = (responses) => {
  mockSupabase.state.responses = {
    employer_org: { data: { id: ORG }, error: null },
    employer_org_profile_speciality_plan: { data: [], error: null },
    employer_org_profile_speciality: { data: [], error: null },
    ...responses,
  };
};

const ids = (result) => [...result.specialityIds].sort();

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockSupabase.from.mockClear();
});

afterEach(() => {
  console.error.mockRestore();
});

describe("getHospitalFormativePlanSpecialityIds", () => {
  it("devuelve las especialidades con algún PDF del plan", async () => {
    respond({
      employer_org_profile_speciality_plan: {
        data: [
          { speciality_id: "card" },
          { speciality_id: "card" },
          { speciality_id: "gine" },
        ],
        error: null,
      },
      employer_org_profile_speciality: {
        data: [
          { speciality_id: "card", plan_formativo_url: null },
          { speciality_id: "gine", plan_formativo_url: null },
        ],
        error: null,
      },
    });

    const result = await getHospitalFormativePlanSpecialityIds("h1");

    expect(result.success).toBe(true);
    expect(ids(result)).toEqual(["card", "gine"]);
  });

  it("cuenta el plan antiguo de un solo PDF (plan_formativo_url)", async () => {
    respond({
      employer_org_profile_speciality: {
        data: [{ speciality_id: "card", plan_formativo_url: "https://x/card.pdf" }],
        error: null,
      },
    });

    const result = await getHospitalFormativePlanSpecialityIds("h1");

    expect(ids(result)).toEqual(["card"]);
  });

  it("no cuenta una especialidad con descripción pero sin ningún PDF", async () => {
    respond({
      employer_org_profile_speciality: {
        data: [{ speciality_id: "card", plan_formativo_url: "  " }],
        error: null,
      },
    });

    const result = await getHospitalFormativePlanSpecialityIds("h1");

    expect(result.success).toBe(true);
    expect(ids(result)).toEqual([]);
  });

  it("no cuenta un PDF sin fila de especialidad: la pantalla del plan no lo enseñaría", async () => {
    respond({
      employer_org_profile_speciality_plan: {
        data: [{ speciality_id: "huerfana" }],
        error: null,
      },
    });

    const result = await getHospitalFormativePlanSpecialityIds("h1");

    expect(ids(result)).toEqual([]);
  });

  it("un hospital sin cuenta en el panel no tiene planes", async () => {
    respond({ employer_org: { data: null, error: null } });

    const result = await getHospitalFormativePlanSpecialityIds("h1");

    expect(result.success).toBe(true);
    expect(ids(result)).toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it("sin hospital no consulta y falla", async () => {
    const result = await getHospitalFormativePlanSpecialityIds(null);

    expect(result.success).toBe(false);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it.each([
    "employer_org",
    "employer_org_profile_speciality_plan",
    "employer_org_profile_speciality",
  ])("si falla la consulta de %s, devuelve error y ningún plan", async (table) => {
    respond({
      employer_org_profile_speciality: {
        data: [{ speciality_id: "card", plan_formativo_url: "https://x/card.pdf" }],
        error: null,
      },
      [table]: { data: null, error: { message: "Network request failed" } },
    });

    const result = await getHospitalFormativePlanSpecialityIds("h1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network request failed");
    expect(ids(result)).toEqual([]);
  });
});
