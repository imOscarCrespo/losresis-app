import {
  describeCourseSurvey,
  emptySurveyAnswers,
  isSurveyComplete,
} from "../../utils/courseSurvey";

const CERTIFICATE = {
  code: "AD2018BC73",
  issued_at: "2026-01-16T18:00:00+00:00",
  course_title: "Curso",
  attended_count: 4,
  session_count: 5,
};

// Curso de 5 días (12–16 ene) con mínimo del 80 %, hoy es el último día.
const summary = (over = {}) => ({
  enrollment_mode: "in_app",
  is_enrolled: true,
  today: "2026-01-16",
  survey_opens_on: "2026-01-16",
  attendance_percent: 80,
  min_attendance_percent: 80,
  meets_min_attendance: true,
  survey_available: true,
  survey_submitted: false,
  certificate: null,
  ...over,
});

describe("describeCourseSurvey", () => {
  it("mínimo 80 % y 4 de 5: puede abrir la encuesta", () => {
    expect(describeCourseSurvey(summary())).toEqual({ kind: "available" });
  });

  it("mínimo 80 % y 3 de 5: no puede y ve cuánto ha asistido y cuánto necesita", () => {
    expect(
      describeCourseSurvey(
        summary({ attendance_percent: 60, meets_min_attendance: false, survey_available: false })
      )
    ).toEqual({
      kind: "locked",
      message:
        "Has asistido al 60 % de las sesiones. Para obtener el certificado necesitas un 80 %.",
    });
  });

  it("curso sin mínimo: la encuesta se abre igual", () => {
    expect(
      describeCourseSurvey(summary({ min_attendance_percent: null, attendance_percent: 20 }))
    ).toEqual({ kind: "available" });
  });

  it("antes del último día: dice cuándo se abre", () => {
    const view = describeCourseSurvey(
      summary({ today: "2026-01-13", survey_available: false, meets_min_attendance: false })
    );
    expect(view.kind).toBe("pending");
    expect(view.message).toContain("16 de enero de 2026");
  });

  it("con la encuesta hecha: enseña el certificado aunque ya no cumpla el mínimo", () => {
    expect(
      describeCourseSurvey(
        summary({
          survey_submitted: true,
          survey_available: false,
          meets_min_attendance: false,
          min_attendance_percent: 100,
          certificate: CERTIFICATE,
        })
      )
    ).toEqual({ kind: "certificate", certificate: CERTIFICATE });
  });

  it("no enseña nada a quien no está inscrito, en un curso externo o con una base anterior", () => {
    expect(describeCourseSurvey(null)).toBeNull();
    expect(describeCourseSurvey(summary({ is_enrolled: false }))).toBeNull();
    expect(describeCourseSurvey(summary({ enrollment_mode: "external" }))).toBeNull();
    const old = summary();
    delete old.survey_available;
    expect(describeCourseSurvey(old)).toBeNull();
  });

  it("curso sin días: no hay encuesta", () => {
    expect(
      describeCourseSurvey(summary({ survey_opens_on: null, survey_available: false }))
    ).toBeNull();
  });
});

describe("isSurveyComplete", () => {
  const full = {
    ...emptySurveyAnswers(),
    overall_rating: 5,
    content_rating: 4,
    speakers_rating: 4,
    organization_rating: 3,
    would_recommend: false,
  };

  it("pide las cuatro notas y la recomendación; el comentario es opcional", () => {
    expect(isSurveyComplete(full)).toBe(true);
    expect(isSurveyComplete(emptySurveyAnswers())).toBe(false);
    expect(isSurveyComplete({ ...full, speakers_rating: null })).toBe(false);
    expect(isSurveyComplete({ ...full, would_recommend: null })).toBe(false);
    expect(isSurveyComplete({ ...full, overall_rating: 6 })).toBe(false);
  });
});
