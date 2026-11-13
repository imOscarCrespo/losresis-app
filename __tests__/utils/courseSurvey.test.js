import {
  DEFAULT_SURVEY_QUESTIONS,
  buildSurveyAnswersPayload,
  describeCourseSurvey,
  emptySurveyAnswers,
  isSurveyComplete,
  surveyFormFor,
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

  it("curso sin mínimo y ninguna sesión asistida: no puede", () => {
    expect(
      describeCourseSurvey(
        summary({
          min_attendance_percent: null,
          attendance_percent: 0,
          meets_min_attendance: true,
          survey_available: false,
          attended_count: 0,
        })
      )
    ).toEqual({
      kind: "locked",
      message:
        "No tienes ninguna sesión registrada. Para obtener el certificado tienes que haber asistido al menos a una.",
    });
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

// Plantillas de encuesta (Hospital de Manresa, 2026-11-13).
const CUSTOM_QUESTIONS = [
  { id: "docentes", type: "rating", label: "Docentes", required: true },
  { id: "repetirias", type: "yes_no", label: "¿Repetirías?", required: false },
  { id: "mejoras", type: "text", label: "¿Qué mejorarías?", required: true },
  { id: "extra", type: "text", label: "Algo más", required: false },
];

describe("surveyFormFor", () => {
  it("base con plantillas: usa las preguntas del curso", () => {
    expect(surveyFormFor(summary({ survey_questions: CUSTOM_QUESTIONS }))).toEqual({
      questions: CUSTOM_QUESTIONS,
      dynamic: true,
    });
  });

  it("base anterior (sin survey_questions): la encuesta fija y la RPC antigua", () => {
    expect(surveyFormFor(summary())).toEqual({
      questions: DEFAULT_SURVEY_QUESTIONS,
      dynamic: false,
    });
    expect(surveyFormFor(null).dynamic).toBe(false);
  });

  it("la encuesta fija son las preguntas de la plantilla de LosResis", () => {
    expect(DEFAULT_SURVEY_QUESTIONS.map((q) => [q.id, q.type, q.required])).toEqual([
      ["overall_rating", "rating", true],
      ["content_rating", "rating", true],
      ["speakers_rating", "rating", true],
      ["organization_rating", "rating", true],
      ["would_recommend", "yes_no", true],
      ["comments", "text", false],
    ]);
  });

  it("salta tipos desconocidos, preguntas mal formadas e ids repetidos", () => {
    const form = surveyFormFor(
      summary({
        survey_questions: [
          { id: "a", type: "rating", label: "A", required: true },
          { id: "b", type: "multiple_choice", label: "B", required: true },
          { id: "", type: "text", label: "C" },
          null,
          { id: "a", type: "text", label: "A otra vez" },
          { id: "d", type: "yes_no", label: " D " },
        ],
      })
    );
    expect(form.questions).toEqual([
      { id: "a", type: "rating", label: "A", required: true },
      { id: "d", type: "yes_no", label: "D", required: false },
    ]);
  });
});

describe("encuesta con preguntas del curso", () => {
  it("respuestas vacías según el tipo", () => {
    expect(emptySurveyAnswers(CUSTOM_QUESTIONS)).toEqual({
      docentes: null,
      repetirias: null,
      mejoras: "",
      extra: "",
    });
  });

  it("solo pide las obligatorias; un texto obligatorio no vale en blanco", () => {
    const answers = { docentes: 4, repetirias: null, mejoras: "Más casos", extra: "" };
    expect(isSurveyComplete(answers, CUSTOM_QUESTIONS)).toBe(true);
    expect(isSurveyComplete({ ...answers, mejoras: "   " }, CUSTOM_QUESTIONS)).toBe(false);
    expect(isSurveyComplete({ ...answers, docentes: 0 }, CUSTOM_QUESTIONS)).toBe(false);
    expect(isSurveyComplete(emptySurveyAnswers(CUSTOM_QUESTIONS), CUSTOM_QUESTIONS)).toBe(false);
  });

  it("el envío lleva solo lo respondido, con el texto recortado", () => {
    expect(
      buildSurveyAnswersPayload(
        { docentes: 5, repetirias: false, mejoras: "  Más casos  ", extra: "   " },
        CUSTOM_QUESTIONS
      )
    ).toEqual({ docentes: 5, repetirias: false, mejoras: "Más casos" });
  });

  it("no envía respuestas de preguntas que no son del curso ni texto de más de 2000", () => {
    const payload = buildSurveyAnswersPayload(
      { docentes: 3, mejoras: "x".repeat(2500), intrusa: 5 },
      CUSTOM_QUESTIONS
    );
    expect(Object.keys(payload).sort()).toEqual(["docentes", "mejoras"]);
    expect(payload.mejoras).toHaveLength(2000);
  });
});
