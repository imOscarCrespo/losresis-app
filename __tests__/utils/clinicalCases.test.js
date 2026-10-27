import {
  buildClinicalCasePayload,
  displayStatusOf,
  formValuesFor,
  freeCasesForYear,
  indexCountFor,
  isLockedByReview,
  linkableCases,
  missingFieldsFor,
  portfolioGoals,
  portfolioProgress,
  portfolioRows,
  requirementsForYear,
  reviewsOf,
  templateYearFor,
} from "../../utils/clinicalCases";

const requirement = (id, title, overrides = {}) => ({
  id,
  title,
  description: null,
  is_required: true,
  position: 0,
  residency_year: 1,
  archived: false,
  ...overrides,
});

const caso = (id, overrides = {}) => ({
  id,
  requirement_id: null,
  residency_year: 1,
  title: "Caso",
  status: "draft",
  case_date: null,
  updated_at: "2026-10-20T10:00:00Z",
  ...overrides,
});

// Sant Pau, Medicina Intensiva R1.
const SANT_PAU = [
  requirement("epoc", "EPOC", { position: 0 }),
  requirement("ictus", "Ictus isquémico", { position: 1 }),
  requirement("fra", "Fracaso renal agudo", { position: 2 }),
];

const COMPLETE = {
  title: "EPOC",
  case_date: "2026-09-15",
  service: "",
  rotation: "",
  chief_complaint: "Disnea de 48 h",
  relevant_history: "EPOC grave",
  physical_exam: "Tiraje",
  complementary_tests: "Gasometría",
  clinical_course: "Mejoría",
  final_diagnosis: "Reagudización de EPOC",
  treatment_and_outcome: "VMNI",
  reflection: "Línea 1\nLínea 2",
};

describe("formulario del caso clínico", () => {
  it("un caso nuevo desde un requisito trae su título", () => {
    expect(formValuesFor(null, SANT_PAU[0]).title).toBe("EPOC");
    expect(formValuesFor(null).title).toBe("");
    expect(formValuesFor(caso("c", { title: "Mío", reflection: "x" })).reflection).toBe("x");
  });

  it("un borrador solo pide título", () => {
    expect(missingFieldsFor({ title: "EPOC" }, { complete: false })).toEqual([]);
    expect(missingFieldsFor({ title: "  " }, { complete: false })).toEqual([
      "Título del caso clínico",
    ]);
  });

  it("completar pide todo menos servicio y rotación", () => {
    expect(missingFieldsFor(COMPLETE, { complete: true })).toEqual([]);
    expect(
      missingFieldsFor({ ...COMPLETE, reflection: " ", case_date: "" }, { complete: true })
    ).toEqual(["Fecha", "¿Qué he aprendido de este caso?"]);
  });

  it("el payload conserva los saltos de línea y manda null lo vacío", () => {
    const payload = buildClinicalCasePayload(COMPLETE, {
      userId: "u",
      residencyYear: 1,
      requirementId: "epoc",
      complete: true,
    });
    expect(payload).toMatchObject({
      user_id: "u",
      residency_year: 1,
      requirement_id: "epoc",
      status: "completed",
      case_date: "2026-09-15",
      service: null,
      rotation: null,
      reflection: "Línea 1\nLínea 2",
    });
    expect(
      buildClinicalCasePayload({ title: "Libre" }, { userId: "u", residencyYear: 2, complete: false })
    ).toMatchObject({ status: "draft", requirement_id: null, case_date: null, title: "Libre" });
  });

  it("no hay campos de identificación del paciente en el payload", () => {
    const keys = Object.keys(
      buildClinicalCasePayload(COMPLETE, { userId: "u", residencyYear: 1, complete: true })
    );
    expect(keys.some((key) => /patient|paciente|dni|history_number|nhc/i.test(key))).toBe(false);
  });
});

describe("portafolio", () => {
  it("Sant Pau: EPOC completado, ictus en progreso y FRA pendiente → 1 de 3", () => {
    const cases = [
      caso("c1", { requirement_id: "epoc", status: "completed" }),
      caso("c2", { requirement_id: "ictus" }),
    ];
    const rows = portfolioRows(SANT_PAU, cases, 1);
    expect(rows.map((row) => [row.requirement.title, row.status])).toEqual([
      ["EPOC", "completed"],
      ["Ictus isquémico", "in_progress"],
      ["Fracaso renal agudo", "pending"],
    ]);
    expect(portfolioProgress(rows)).toEqual({ done: 1, total: 3, percent: 33 });
    expect(portfolioGoals(rows)).toEqual([{ done: true }, { done: false }, { done: false }]);
    expect(indexCountFor(rows, [])).toEqual({ count: 1, total: 3 });
  });

  it("los requisitos de otro año o de otra plantilla no aparecen", () => {
    const requirements = [...SANT_PAU, requirement("r2", "Caso de R2", { residency_year: 2 })];
    expect(portfolioRows(requirements, [], 1)).toHaveLength(3);
    expect(portfolioRows(requirements, [], 2).map((row) => row.requirement.id)).toEqual(["r2"]);
  });

  it("un R6 usa los requisitos de R5", () => {
    expect(templateYearFor(6)).toBe(5);
    const requirements = [requirement("r5", "Caso de R5", { residency_year: 5 })];
    expect(portfolioRows(requirements, [], 6)).toHaveLength(1);
  });

  it("solo cuentan los obligatorios; sin obligatorios cuentan todos", () => {
    const mixed = SANT_PAU.map((item, index) => ({ ...item, is_required: index === 0 }));
    const cases = [caso("c", { requirement_id: "ictus", status: "completed" })];
    expect(portfolioProgress(portfolioRows(mixed, cases, 1))).toEqual({
      done: 0,
      total: 1,
      percent: 0,
    });
    const none = SANT_PAU.map((item) => ({ ...item, is_required: false }));
    expect(portfolioProgress(portfolioRows(none, cases, 1))).toEqual({
      done: 1,
      total: 3,
      percent: 33,
    });
    expect(portfolioGoals(portfolioRows(none, cases, 1))).toEqual([]);
  });

  it("sin requisitos no hay progreso y el índice cuenta los casos libres", () => {
    const rows = portfolioRows([], [], 1);
    expect(portfolioProgress(rows)).toBeNull();
    expect(indexCountFor(rows, [caso("a"), caso("b")])).toEqual({ count: 2, total: null });
  });

  it("un requisito retirado sale del portafolio y su caso pasa a Mis casos clínicos", () => {
    const requirements = [...SANT_PAU, requirement("old", "Retirado", { archived: true })];
    const cases = [
      caso("c1", { requirement_id: "epoc" }),
      caso("retirado", { requirement_id: "old", updated_at: "2026-10-01T00:00:00Z" }),
      caso("libre", { case_date: "2026-10-10" }),
      caso("r2", { residency_year: 2 }),
    ];
    expect(requirementsForYear(requirements, cases, 1).map((item) => item.id)).toContain("old");
    const rows = portfolioRows(requirements, cases, 1);
    expect(rows.map((row) => row.requirement.id)).not.toContain("old");
    expect(freeCasesForYear(cases, rows, 1).map((item) => item.id)).toEqual([
      "libre",
      "retirado",
    ]);
  });

  it("solo se pueden vincular casos sin requisito", () => {
    const cases = [caso("a"), caso("b", { requirement_id: "epoc" })];
    expect(linkableCases(cases).map((item) => item.id)).toEqual(["a"]);
  });

  it("estado de una ficha", () => {
    expect(displayStatusOf(null)).toBe("pending");
    expect(displayStatusOf(caso("a"))).toBe("in_progress");
    expect(displayStatusOf(caso("a", { status: "completed" }))).toBe("completed");
  });
});

describe("revisión del tutor", () => {
  const REQS = [
    requirement("epoc", "EPOC", { position: 0, tutor_review_enabled: true }),
    requirement("ictus", "Ictus isquémico", { position: 1, tutor_review_enabled: true }),
    requirement("fra", "Fracaso renal agudo", { position: 2 }),
  ];

  it("el estado que se enseña sigue a la revisión", () => {
    expect(displayStatusOf(caso("a", { status: "completed", review_status: "pending" }))).toBe("pending_review");
    expect(displayStatusOf(caso("a", { status: "completed", review_status: "reviewed" }))).toBe("reviewed");
    expect(displayStatusOf(caso("a", { status: "draft", review_status: "changes_requested" }))).toBe(
      "changes_requested"
    );
    expect(displayStatusOf(caso("a", { status: "completed", review_status: null }))).toBe("completed");
    expect(displayStatusOf(caso("a", { status: "draft" }))).toBe("in_progress");
  });

  it("pendiente de revisión y revisado cuentan; devuelto no (1 de 3 → 2 de 3)", () => {
    const cases = [
      caso("c1", { requirement_id: "epoc", status: "completed", review_status: "reviewed" }),
      caso("c2", { requirement_id: "ictus", status: "draft", review_status: "changes_requested" }),
    ];
    const rows = portfolioRows(REQS, cases, 1);
    expect(portfolioProgress(rows)).toEqual({ done: 1, total: 3, percent: 33 });
    expect(portfolioGoals(rows)).toEqual([{ done: true }, { done: false }, { done: false }]);

    cases[1] = { ...cases[1], status: "completed", review_status: "pending" };
    expect(portfolioProgress(portfolioRows(REQS, cases, 1))).toEqual({ done: 2, total: 3, percent: 67 });
  });

  it("solo un caso revisado queda bloqueado", () => {
    expect(isLockedByReview(caso("a", { status: "completed", review_status: "reviewed" }))).toBe(true);
    expect(isLockedByReview(caso("a", { status: "completed", review_status: "pending" }))).toBe(false);
    expect(isLockedByReview(caso("a", { review_status: "changes_requested" }))).toBe(false);
    expect(isLockedByReview(null)).toBe(false);
  });

  it("las revisiones, la más reciente primero, sin tocar las de la ficha", () => {
    const reviews = [
      { id: "r1", outcome: "changes_requested", created_at: "2026-10-01T10:00:00Z" },
      { id: "r2", outcome: "reviewed", created_at: "2026-10-05T10:00:00Z" },
    ];
    const clinicalCase = caso("a", { reviews });
    expect(reviewsOf(clinicalCase).map((review) => review.id)).toEqual(["r2", "r1"]);
    expect(reviews[0].id).toBe("r1");
    expect(reviewsOf(caso("b"))).toEqual([]);
    expect(reviewsOf(null)).toEqual([]);
  });

  it("el payload del residente nunca lleva review_status", () => {
    const payload = buildClinicalCasePayload(
      { title: "EPOC", review_status: "reviewed" },
      { userId: "u1", residencyYear: 1, requirementId: "epoc", complete: false }
    );
    expect(payload).not.toHaveProperty("review_status");
  });
});
