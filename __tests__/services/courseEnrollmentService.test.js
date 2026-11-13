jest.mock("../../config/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

const { supabase: mockSupabase } = jest.requireMock("../../config/supabase");

import {
  submitCourseSurvey,
  submitCourseSurveyAnswers,
} from "../../services/courseEnrollmentService";

const ANSWERS = {
  overall_rating: 5,
  content_rating: 4,
  speakers_rating: 4,
  organization_rating: 3,
  would_recommend: true,
  comments: "  Muy útil  ",
};

beforeEach(() => jest.clearAllMocks());

describe("submitCourseSurvey", () => {
  it("envía las respuestas a submit_course_survey y devuelve el certificado", async () => {
    const certificate = { code: "AD2018BC73", attended_count: 4, session_count: 5 };
    mockSupabase.rpc.mockResolvedValue({
      data: { status: "submitted", certificate },
      error: null,
    });

    const result = await submitCourseSurvey("course-1", ANSWERS);

    expect(mockSupabase.rpc).toHaveBeenCalledWith("submit_course_survey", {
      p_course_id: "course-1",
      p_overall_rating: 5,
      p_content_rating: 4,
      p_speakers_rating: 4,
      p_organization_rating: 3,
      p_would_recommend: true,
      p_comments: "Muy útil",
    });
    expect(result).toEqual({
      success: true,
      data: { status: "submitted", certificate },
      error: null,
      errorCode: null,
    });
  });

  it("comentario vacío va como null", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: {}, error: null });
    await submitCourseSurvey("course-1", { ...ANSWERS, comments: "   " });
    expect(mockSupabase.rpc.mock.calls[0][1].p_comments).toBeNull();
  });

  it("si no llega al mínimo, la base lo deniega y se traduce el motivo", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "min_attendance_not_met" },
    });

    const result = await submitCourseSurvey("course-1", ANSWERS);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("min_attendance_not_met");
    expect(result.error).toMatch(/asistencia mínima/);
  });

  it("si la llamada lanza, devuelve el error genérico", async () => {
    mockSupabase.rpc.mockRejectedValue(new Error("Network request failed"));
    const result = await submitCourseSurvey("course-1", ANSWERS);
    expect(result).toMatchObject({ success: false, error: "Algo ha fallado. Inténtalo de nuevo." });
  });
});

describe("submitCourseSurveyAnswers", () => {
  it("envía el mapa id → valor a submit_course_survey_answers", async () => {
    const certificate = { code: "AD2018BC73", organizer_name: "Hospital de Manresa" };
    mockSupabase.rpc.mockResolvedValue({
      data: { status: "submitted", certificate },
      error: null,
    });

    const result = await submitCourseSurveyAnswers("course-1", { docentes: 5, repetirias: true });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("submit_course_survey_answers", {
      p_course_id: "course-1",
      p_answers: { docentes: 5, repetirias: true },
    });
    expect(result).toMatchObject({ success: true, data: { status: "submitted", certificate } });
  });

  it("sin respuestas manda un objeto vacío", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: {}, error: null });
    await submitCourseSurveyAnswers("course-1", null);
    expect(mockSupabase.rpc.mock.calls[0][1].p_answers).toEqual({});
  });

  it.each([
    ["invalid_answers", /no es válida/],
    ["app_update_required", /Actualiza la app/],
    ["min_attendance_not_met", /asistencia mínima/],
    ["survey_not_open_yet", /último día/],
  ])("traduce %s", async (code, message) => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: code } });
    const result = await submitCourseSurveyAnswers("course-1", { docentes: 5 });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(code);
    expect(result.error).toMatch(message);
  });
});
