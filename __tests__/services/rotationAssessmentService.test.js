// Supabase se mockea en la frontera: el servicio solo llama a RPC.
jest.mock("../../config/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

const { supabase: mockSupabase } = jest.requireMock("../../config/supabase");

import {
  completeRotationSelfAssessment,
  getMyRotationAssessments,
  saveRotationSelfAssessmentDraft,
  startRotationSelfAssessment,
} from "../../services/rotationAssessmentService";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("getMyRotationAssessments", () => {
  it("pide el año y devuelve listas aunque la RPC no traiga nada", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { context: null }, error: null });
    const result = await getMyRotationAssessments(1);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_my_rotation_assessments", {
      p_residency_year: 1,
    });
    expect(result).toEqual({ context: null, rotations: [], assessments: [] });
  });

  it("lanza el error para que la pantalla ofrezca reintentar", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getMyRotationAssessments(1)).rejects.toEqual({ message: "boom" });
  });
});

describe("startRotationSelfAssessment", () => {
  it("sin ficha ni periodo nuevo por defecto", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { id: "a1" }, error: null });
    await expect(startRotationSelfAssessment("r1")).resolves.toEqual({ id: "a1" });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("start_rotation_self_assessment", {
      p_rotation_id: "r1",
      p_libro_node_id: null,
      p_new_period: false,
    });
  });

  it("pasa la ficha elegida y el periodo nuevo", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { id: "a2" }, error: null });
    await startRotationSelfAssessment("r1", { libroNodeId: "n1", newPeriod: true });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("start_rotation_self_assessment", {
      p_rotation_id: "r1",
      p_libro_node_id: "n1",
      p_new_period: true,
    });
  });

  it("lanza el error", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "no" } });
    await expect(startRotationSelfAssessment("r1")).rejects.toEqual({ message: "no" });
  });
});

describe("saveRotationSelfAssessmentDraft", () => {
  it("una parte que no llega va como null: la base no la toca", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { id: "a1" }, error: null });
    await saveRotationSelfAssessmentDraft("a1", { objectiveAnswers: { o1: "x" } });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("save_rotation_self_assessment_draft", {
      p_id: "a1",
      p_objective_answers: { o1: "x" },
      p_rubric_answers: null,
      p_final_reflection: null,
    });
  });

  it("una reflexión borrada viaja como texto vacío para que se borre", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { id: "a1" }, error: null });
    await saveRotationSelfAssessmentDraft("a1", { rubricAnswers: {}, finalReflection: null });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("save_rotation_self_assessment_draft", {
      p_id: "a1",
      p_objective_answers: null,
      p_rubric_answers: {},
      p_final_reflection: "",
    });
  });

  it("si falla, lanza: la pantalla no puede decir que se ha guardado", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(saveRotationSelfAssessmentDraft("a1", { objectiveAnswers: {} })).rejects.toEqual({
      message: "offline",
    });
  });
});

describe("completeRotationSelfAssessment", () => {
  it("finaliza la parte pedida", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { id: "a1", objectives_completed_at: "x" }, error: null });
    await completeRotationSelfAssessment("a1", "objectives");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("complete_rotation_self_assessment", {
      p_id: "a1",
      p_part: "objectives",
    });
  });

  it("si falla, lanza: una finalización fallida no se da por completada", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "Faltan objetivos" } });
    await expect(completeRotationSelfAssessment("a1", "rubric")).rejects.toEqual({
      message: "Faltan objetivos",
    });
  });
});
