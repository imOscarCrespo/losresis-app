// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder y la respuesta final ({ data, error }) la decide cada test, en orden.
jest.mock("../../config/supabase", () => {
  const builder = { responses: [] };
  ["from", "select", "eq", "order", "update", "insert", "delete"].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  const next = () =>
    Promise.resolve(builder.responses.shift() || { data: null, error: null });
  builder.single = jest.fn(next);
  builder.maybeSingle = jest.fn(next);
  // `await` directo sobre el builder (delete().eq(), insert()) también consume respuesta.
  builder.then = (resolve, reject) => next().then(resolve, reject);
  return { supabase: builder };
});

jest.mock("../../services/staticCatalogService", () => ({
  getExternalRotationQuestionsCatalog: jest.fn(() => []),
  getHospitalByIdFromCatalog: jest.fn(() => null),
  getSpecialityByIdFromCatalog: jest.fn(() => null),
}));

const { supabase: mockBuilder } = jest.requireMock("../../config/supabase");

import {
  DUPLICATE_REVIEW_ERROR,
  createRotationReview,
  updateRotationReview,
} from "../../services/externalRotationReviewService";
import { respondToReviewInvite } from "../../services/externalRotationService";

const quickReview = {
  userId: "u1",
  rotationId: null,
  externalHospitalName: "  Mayo Clinic ",
  serviceName: "",
  specialityId: null,
  city: "Rochester",
  country: "United States",
  startDate: "2026-05-01",
  endDate: null,
  recommendation: "yes",
  highlightTags: ["good_supervision", "made_up", "learned_a_lot"],
  difficulty: "hard",
  rotationKind: "observational",
  beforeYouGo: "",
  answers: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBuilder.responses = [];
});

describe("createRotationReview", () => {
  it("publica una reseña rápida con las respuestas estructuradas y sin texto libre", async () => {
    mockBuilder.responses = [{ data: { id: "r1" }, error: null }];

    await createRotationReview(quickReview);

    const [row] = mockBuilder.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      user_id: "u1",
      external_hospital_name: "Mayo Clinic",
      recommendation: "yes",
      highlight_tags: ["learned_a_lot", "good_supervision"],
      difficulty: "hard",
      rotation_kind: "observational",
      before_you_go: null,
      highlight_summary: null,
      is_approved: true,
    });
  });

  it("guarda null en vez de un array vacío si no elige etiquetas", async () => {
    mockBuilder.responses = [{ data: { id: "r1" }, error: null }];

    await createRotationReview({ ...quickReview, highlightTags: [] });

    expect(mockBuilder.insert.mock.calls[0][0][0].highlight_tags).toBeNull();
  });

  it("con plan enlazado manda lo escrito y el plan solo rellena huecos", async () => {
    mockBuilder.responses = [
      {
        data: {
          id: "plan-1",
          hospital_name: "Mayo Clinic Rochester",
          service_name: "Cardiología",
          speciality_id: "spec-1",
          country: "United States",
          city: "Rochester",
          start_date: "2026-04-01",
          end_date: "2026-06-30",
        },
        error: null,
      },
      { data: { id: "r1" }, error: null },
    ];

    await createRotationReview({ ...quickReview, rotationId: "plan-1" });

    const [row] = mockBuilder.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      rotation_id: "plan-1",
      external_hospital_name: "Mayo Clinic",
      service_name: "Cardiología",
      speciality_id: "spec-1",
      start_date: "2026-05-01",
      end_date: "2026-06-30",
    });
  });

  it("convierte el índice único por plan en un error de duplicado reconocible", async () => {
    mockBuilder.responses = [
      { data: { id: "plan-1", country: "Spain", city: "Madrid", hospital_name: "H" }, error: null },
      { data: null, error: { code: "23505", message: "duplicate key" } },
    ];

    await expect(
      createRotationReview({ ...quickReview, rotationId: "plan-1" })
    ).rejects.toMatchObject({ code: DUPLICATE_REVIEW_ERROR });
  });

  it("propaga otros errores de Supabase", async () => {
    mockBuilder.responses = [{ data: null, error: { code: "42501", message: "rls" } }];

    await expect(createRotationReview(quickReview)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("updateRotationReview", () => {
  it("amplía la reseña con los detalles y conserva las valoraciones antiguas enviadas", async () => {
    mockBuilder.responses = [
      { data: { id: "r1" }, error: null }, // update
      { data: null, error: null }, // delete answers
      { data: null, error: null }, // insert answers
    ];

    await updateRotationReview("r1", {
      ...quickReview,
      accommodationNotes: "Residencia del hospital",
      costNotes: " 1.200 $ al mes ",
      answers: [{ question_id: "q1", rating_value: 4, text_value: null }],
    });

    expect(mockBuilder.update.mock.calls[0][0]).toMatchObject({
      accommodation_notes: "Residencia del hospital",
      cost_notes: "1.200 $ al mes",
      recommendation: "yes",
    });
    expect(mockBuilder.insert.mock.calls[0][0]).toEqual([
      { review_id: "r1", question_id: "q1", rating_value: 4, text_value: null },
    ]);
  });
});

describe("respondToReviewInvite", () => {
  it("guarda la respuesta solo en el plan del propio usuario", async () => {
    mockBuilder.responses = [{ data: { id: "plan-1" }, error: null }];

    await respondToReviewInvite("plan-1", "u1", "not_completed");

    expect(mockBuilder.update.mock.calls[0][0]).toMatchObject({
      review_invite_response: "not_completed",
    });
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("rechaza respuestas fuera del catálogo sin llamar a Supabase", async () => {
    await expect(respondToReviewInvite("plan-1", "u1", "later")).rejects.toThrow();
    expect(mockBuilder.update).not.toHaveBeenCalled();
  });
});
