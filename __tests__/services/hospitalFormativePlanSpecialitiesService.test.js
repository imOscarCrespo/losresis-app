// Supabase se mockea en la frontera: cada consulta es un builder encadenable
// que, al esperarlo, devuelve la respuesta ({ data, error }) de su tabla.
jest.mock("../../config/supabase", () => {
  const state = { responses: {} };
  const supabase = {
    state,
    from: jest.fn((table) => {
      const query = { filters: {} };
      ["select", "order", "maybeSingle"].forEach((method) => {
        query[method] = jest.fn(() => query);
      });
      query.eq = jest.fn((column, value) => {
        query.filters[column] = value;
        return query;
      });
      // Una respuesta puede ser una función de los filtros .eq() de la consulta.
      query.then = (resolve, reject) => {
        const response = state.responses[table];
        const resolved =
          typeof response === "function" ? response(query.filters) : response;
        return Promise.resolve(resolved || { data: null, error: null }).then(
          resolve,
          reject
        );
      };
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

// employer_org como tabla de verdad: filtra por los .eq() y se comporta como
// maybeSingle (error si quedan dos filas), que es lo que rompería la ficha.
const orgRows = (rows) => (filters) => {
  const matches = rows.filter((row) =>
    Object.entries(filters).every(([column, value]) => row[column] === value)
  );
  if (matches.length > 1) {
    return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } };
  }
  return { data: matches[0] || null, error: null };
};

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

  it("ignora la unidad docente del mismo hospital: los planes son los del hospital", async () => {
    respond({
      employer_org: orgRows([
        { id: ORG, hospital_id: "h1", org_kind: "hospital" },
        { id: "ud-1", hospital_id: "h1", org_kind: "teaching_unit" },
      ]),
      employer_org_profile_speciality: {
        data: [{ speciality_id: "card", plan_formativo_url: "https://x/card.pdf" }],
        error: null,
      },
    });

    const result = await getHospitalFormativePlanSpecialityIds("h1");

    expect(result.success).toBe(true);
    expect(ids(result)).toEqual(["card"]);
  });

  it("con solo una unidad docente, no hay planes", async () => {
    respond({
      employer_org: orgRows([{ id: "ud-1", hospital_id: "h1", org_kind: "teaching_unit" }]),
    });

    const result = await getHospitalFormativePlanSpecialityIds("h1");

    expect(result.success).toBe(true);
    expect(ids(result)).toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });
});
