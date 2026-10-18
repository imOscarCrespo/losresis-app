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

// El catálogo empaquetado no hace falta para esta función.
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

import { getHospitalProfileContent } from "../../services/hospitalService";

const ORG = "org-1";

const respond = (responses) => {
  mockSupabase.state.responses = {
    employer_org: { data: { id: ORG, hospital_id: "h1" }, error: null },
    employer_org_profile: {
      data: { org_id: ORG, about: "Hospital", differential_points: [], institutional_video_url: "https://youtu.be/AAAAAAAAAAA" },
      error: null,
    },
    employer_org_profile_image: {
      data: [{ id: "general-1", public_url: "https://x/hospital.jpg", position: 1 }],
      error: null,
    },
    employer_org_profile_document: { data: [], error: null },
    employer_org_profile_speciality: {
      data: [
        {
          org_id: ORG,
          speciality_id: "gine",
          plan_formativo_url: "https://x/gine.pdf",
          plan_formativo_storage_path: "gine.pdf",
          description: "Formación cercana",
          differential_points: ["Buen ambiente"],
          video_url: " https://www.youtube.com/watch?v=K7z3eJpQ9mE ",
          specialities: { name: "Obstetricia y Ginecología" },
        },
        {
          org_id: ORG,
          speciality_id: "card",
          plan_formativo_url: "https://x/card.pdf",
          plan_formativo_storage_path: "card.pdf",
          description: null,
          differential_points: [],
          video_url: null,
          specialities: { name: "Cardiología" },
        },
      ],
      error: null,
    },
    employer_org_profile_speciality_plan: { data: [], error: null },
    employer_org_profile_speciality_image: {
      data: [
        { id: "g1", speciality_id: "gine", public_url: "https://x/paritorio.jpg", alt_text: null, position: 1 },
        { id: "g2", speciality_id: "gine", public_url: "https://x/quirofano.jpg", alt_text: "Quirófano", position: 2 },
      ],
      error: null,
    },
    ...responses,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("getHospitalProfileContent · fotos y vídeo de cada especialidad", () => {
  it("cada especialidad trae solo sus fotos y su vídeo", async () => {
    respond();

    const { success, profile } = await getHospitalProfileContent("h1");

    expect(success).toBe(true);
    const [card, gine] = profile.plans;
    expect(gine.speciality_name).toBe("Obstetricia y Ginecología");
    expect(gine.images).toEqual([
      { id: "g1", public_url: "https://x/paritorio.jpg", alt_text: null },
      { id: "g2", public_url: "https://x/quirofano.jpg", alt_text: "Quirófano" },
    ]);
    expect(gine.video_url).toBe("https://www.youtube.com/watch?v=K7z3eJpQ9mE");
    // Sin contenido multimedia: listas vacías y sin vídeo, para no pintar apartados.
    expect(card.images).toEqual([]);
    expect(card.video_url).toBeNull();
  });

  it("no mezcla las fotos de la especialidad con las generales del hospital", async () => {
    respond();

    const { profile } = await getHospitalProfileContent("h1");

    expect(profile.images).toEqual([
      { id: "general-1", public_url: "https://x/hospital.jpg", position: 1 },
    ]);
    expect(profile.institutional_video_url).toBe("https://youtu.be/AAAAAAAAAAA");
  });

  it("un vídeo en blanco cuenta como sin vídeo", async () => {
    respond();
    mockSupabase.state.responses.employer_org_profile_speciality.data[1].video_url = "   ";

    const { profile } = await getHospitalProfileContent("h1");

    expect(profile.plans[0].video_url).toBeNull();
  });

  it("devuelve el error si falla la consulta de fotos de las especialidades", async () => {
    respond({
      employer_org_profile_speciality_image: { data: null, error: { message: "permission denied" } },
    });

    const result = await getHospitalProfileContent("h1");

    expect(result).toEqual({ success: false, profile: null, error: "permission denied" });
  });
});
