import {
  assessmentStatus,
  buildRotationCards,
  buildRubricAnswer,
  computeBlockScore,
  formatGrade,
  isRubricAnswerValid,
  linkableNodes,
  missingObjectives,
  missingRubricBlocks,
  needsExactScore,
  normalizeVersion,
  objectiveProgress,
  objectivesStatus,
  rubricStatus,
  scoreOptions,
  templateNodeFor,
} from "../../utils/rotationAssessment";

// Una versión como la que congela publish_rotation_assessment: la escala de
// Sant Pau en los criterios y Sí / Parcialmente / No en la consecución.
const SCALE = [
  { id: "na", code: "NA", name: "No aplicable", description: "No aplica", min: null, max: null, not_applicable: true },
  { id: "l12", code: "1-2", name: "Muy insuficiente", description: "d", min: 1, max: 2 },
  { id: "l34", code: "3-4", name: "Insuficiente", description: "d", min: 3, max: 4 },
  { id: "l5", code: "5", name: "Suficiente", description: "Alcanza los objetivos de la rotación.", min: 5, max: 5 },
  { id: "l67", code: "6-7", name: "Bueno", description: "d", min: 6, max: 7 },
  { id: "l89", code: "8-9", name: "Muy bueno", description: "Domina todos los objetivos de la rotación.", min: 8, max: 9 },
  { id: "l10", code: "10", name: "Excelente", description: "d", min: 10, max: 10 },
];

const content = ({ selfAssessable = true, scoring = { method: "sum_over_applicable", out_of: 10 } } = {}) => ({
  rotation: { id: "rot", name: "Medicina Interna y Geriatría", duration_months: 2, residency_year: 1 },
  objectives: [
    { id: "o2", title: "Síndromes agudos", description: "Identificar…", position: 1 },
    { id: "o1", title: "Valoración clínica", description: "Realizar…", position: 0 },
  ],
  blocks: [
    {
      id: "bc",
      kind: "criteria",
      title: "Conocimientos y habilidades",
      position: 1,
      scale: SCALE,
      scoring,
      resident_self_assessment: selfAssessable,
      criteria: [
        { id: "c1", name: "Conocimientos adquiridos", position: 0 },
        { id: "c2", name: "Seguridad del paciente", position: 1 },
      ],
    },
    {
      id: "bo",
      kind: "objectives",
      title: "Grado de consecución",
      position: 0,
      scale: [
        { id: "yes", code: "Sí", name: "Sí", description: "d", min: null, max: null },
        { id: "no", code: "No", name: "No", description: "d", min: null, max: null },
      ],
      scoring: null,
      resident_self_assessment: selfAssessable,
      criteria: [],
    },
    {
      id: "ba",
      kind: "criteria",
      title: "Actitudes",
      position: 2,
      scale: SCALE,
      scoring,
      // Bloque de Docencia: sin marca.
      criteria: [{ id: "a1", name: "Motivación", position: 0 }],
    },
  ],
});

describe("normalizeVersion", () => {
  it("ordena objetivos y bloques como Docencia y el bloque de objetivos usa los objetivos de la versión", () => {
    const version = normalizeVersion(content());
    expect(version.objectives.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(version.blocks.map((b) => b.id)).toEqual(["bo", "bc", "ba"]);
    expect(version.blocks[0].items.map((i) => i.id)).toEqual(["o1", "o2"]);
    expect(version.blocks[1].items.map((i) => i.title)).toEqual([
      "Conocimientos adquiridos",
      "Seguridad del paciente",
    ]);
  });

  it("un bloque sin la marca resident_self_assessment es solo de consulta", () => {
    const version = normalizeVersion(content());
    expect(version.blocks.find((b) => b.id === "ba").selfAssessable).toBe(false);
  });
});

describe("objetivos", () => {
  const version = normalizeVersion(content());

  it("una respuesta en blanco no cuenta", () => {
    expect(objectiveProgress(version, { o1: "Aprendí", o2: "   " })).toEqual({ answered: 1, total: 2 });
    expect(missingObjectives(version, { o1: "Aprendí" })).toEqual(["Síndromes agudos"]);
  });

  it("pendiente sin respuestas, en curso con alguna, completada al finalizar", () => {
    expect(objectivesStatus(null, version)).toBe("pending");
    expect(objectivesStatus({ objective_answers: {} }, version)).toBe("pending");
    expect(objectivesStatus({ objective_answers: { o1: "x" } }, version)).toBe("draft");
    expect(
      objectivesStatus({ objective_answers: { o1: "x" }, objectives_completed_at: "2026-10-25" }, version)
    ).toBe("completed");
  });
});

describe("respuestas de rúbrica", () => {
  const version = normalizeVersion(content());
  const criteria = version.blocks.find((b) => b.id === "bc");
  const objectivesBlock = version.blocks.find((b) => b.id === "bo");
  const level = (id) => criteria.scale.find((l) => l.id === id);

  it("un nivel con rango pide la puntuación exacta: 6 o 7, no «6-7»", () => {
    expect(needsExactScore(criteria, level("l67"))).toBe(true);
    expect(scoreOptions(level("l67"))).toEqual([6, 7]);
    expect(buildRubricAnswer(criteria, level("l67"))).toEqual({ level_id: "l67", score: null });
    expect(isRubricAnswerValid(criteria, buildRubricAnswer(criteria, level("l67")))).toBe(false);
    expect(isRubricAnswerValid(criteria, buildRubricAnswer(criteria, level("l67"), 7))).toBe(true);
    expect(isRubricAnswerValid(criteria, { level_id: "l67", score: 8 })).toBe(false);
  });

  it("un nivel de un solo valor lleva ese valor", () => {
    expect(needsExactScore(criteria, level("l5"))).toBe(false);
    expect(buildRubricAnswer(criteria, level("l5"))).toEqual({ level_id: "l5", score: 5 });
  });

  it("NA se guarda como nivel sin puntuación, nunca como 0", () => {
    const answer = buildRubricAnswer(criteria, level("na"), 0);
    expect(answer).toEqual({ level_id: "na", score: null });
    expect(isRubricAnswerValid(criteria, answer)).toBe(true);
    expect(isRubricAnswerValid(criteria, { level_id: "na", score: 0 })).toBe(false);
  });

  it("la consecución de objetivos no lleva puntuación", () => {
    expect(buildRubricAnswer(objectivesBlock, objectivesBlock.scale[0])).toEqual({ level_id: "yes", score: null });
  });

  it("un nivel que no es de la escala del bloque no vale", () => {
    expect(isRubricAnswerValid(criteria, { level_id: "yes", score: null })).toBe(false);
  });

  it("solo faltan los bloques que responde el residente", () => {
    const answers = {
      bc: { c1: { level_id: "l5", score: 5 }, c2: { level_id: "na", score: null } },
      bo: { o1: { level_id: "yes", score: null } },
    };
    expect(missingRubricBlocks(version, answers)).toEqual(["Grado de consecución"]);
  });
});

describe("computeBlockScore", () => {
  const block = (opts) => normalizeVersion(content(opts)).blocks.find((b) => b.id === "bc");

  it("suma / (máximo × aplicables) × 10, con NA fuera del cálculo", () => {
    const result = computeBlockScore(block(), {
      c1: { level_id: "l67", score: 7 },
      c2: { level_id: "na", score: null },
    });
    expect(result).toEqual({ grade: 7, outOf: 10, reason: "ok" });
    expect(formatGrade(7.25)).toBe("7,3");
  });

  it("todo NA: sin puntuación aplicable, no 0/10", () => {
    const result = computeBlockScore(block(), {
      c1: { level_id: "na", score: null },
      c2: { level_id: "na", score: null },
    });
    expect(result.grade).toBeNull();
    expect(result.reason).toBe("no_applicable");
  });

  it("con algo sin valorar no hay nota", () => {
    expect(computeBlockScore(block(), { c1: { level_id: "l5", score: 5 } }).reason).toBe("incomplete");
  });

  it("sin reglas de cálculo publicadas no se inventa una nota", () => {
    const result = computeBlockScore(block({ scoring: null }), {
      c1: { level_id: "l5", score: 5 },
      c2: { level_id: "l5", score: 5 },
    });
    expect(result).toEqual({ grade: null, outOf: null, reason: "no_rules" });
  });
});

describe("estados de la rúbrica y global", () => {
  it("sin bloques: no disponible; sin bloques para el residente: solo consulta", () => {
    const empty = normalizeVersion({ ...content(), blocks: [] });
    expect(rubricStatus(null, empty)).toBe("unavailable");
    const teacherOnly = normalizeVersion(content({ selfAssessable: false }));
    expect(rubricStatus(null, teacherOnly)).toBe("consult");
  });

  it("objetivos completados con la rúbrica pendiente: la autoevaluación sigue en curso", () => {
    const version = normalizeVersion(content());
    const assessment = {
      objective_answers: { o1: "a", o2: "b" },
      objectives_completed_at: "2026-10-25",
      rubric_answers: {},
      completed_at: null,
    };
    expect(objectivesStatus(assessment, version)).toBe("completed");
    expect(rubricStatus(assessment, version)).toBe("pending");
    expect(assessmentStatus(assessment, version)).toBe("draft");
    expect(assessmentStatus({ ...assessment, completed_at: "2026-10-26" }, version)).toBe("completed");
  });

  it("una reflexión final sola ya pone la rúbrica en curso", () => {
    const version = normalizeVersion(content());
    expect(rubricStatus({ rubric_answers: {}, final_reflection: "Mejorar" }, version)).toBe("draft");
  });
});

describe("buildRotationCards", () => {
  const plan = (id, extra = {}) => ({
    rotation_id: id,
    version: 3,
    content: { ...content(), rotation: { id, name: id } },
    ...extra,
  });
  const assessment = (id, rotationId, extra = {}) => ({
    id,
    rotation_id: rotationId,
    created_at: extra.created_at || "2026-10-01",
    version: 2,
    content: { ...content(), rotation: { id: rotationId, name: `${rotationId} v2` } },
    objective_answers: {},
    rubric_answers: {},
    ...extra,
  });

  it("sin autoevaluación la tarjeta usa la última versión publicada", () => {
    const [card] = buildRotationCards({ rotations: [plan("r1")], assessments: [] });
    expect(card.status).toBe("pending");
    expect(card.versionNumber).toBe(3);
    expect(card.version.rotation.name).toBe("r1");
  });

  it("con autoevaluación usa SU versión, aunque haya otra publicada", () => {
    const [card] = buildRotationCards({
      rotations: [plan("r1")],
      assessments: [assessment("a1", "r1", { objective_answers: { o1: "x" } })],
    });
    expect(card.versionNumber).toBe(2);
    expect(card.version.rotation.name).toBe("r1 v2");
    expect(card.status).toBe("draft");
  });

  it("una rotación repetida: la tarjeta lleva la abierta y guarda la anterior", () => {
    const done = assessment("a1", "r1", { completed_at: "2026-09-01", created_at: "2026-08-01" });
    const open = assessment("a2", "r1", { created_at: "2026-10-01" });
    const [card] = buildRotationCards({ rotations: [plan("r1")], assessments: [done, open] });
    expect(card.assessment.id).toBe("a2");
    expect(card.previous.map((a) => a.id)).toEqual(["a1"]);
  });

  it("las autoevaluaciones de rotaciones retiradas siguen en el historial", () => {
    const cards = buildRotationCards({
      rotations: [plan("r1")],
      assessments: [assessment("old", "gone", { completed_at: "2026-05-01" })],
    });
    expect(cards.map((c) => [c.rotationId, c.retired])).toEqual([
      ["r1", false],
      ["gone", true],
    ]);
    expect(cards[1].status).toBe("completed");
  });
});

describe("fichas del Libro", () => {
  const nodes = [
    { id: "n1", name: "Medicina Interna", template_node_id: "t1" },
    { id: "n2", name: "Nefrología", template_node_id: "t2" },
    { id: "n3", name: "Mi rotación", template_node_id: null },
  ];
  const rotations = [
    { rotation_id: "r1", source_template_node_id: "t1" },
    { rotation_id: "r2", source_template_node_id: "t2" },
    { rotation_id: "r3", source_template_node_id: null },
  ];

  it("en el Libro oficial la ficha se encuentra por el nodo de plantilla, no por el nombre", () => {
    expect(templateNodeFor(rotations[0], nodes, []).id).toBe("n1");
    expect(templateNodeFor(rotations[2], nodes, [])).toBeNull();
  });

  it("una ficha ya enlazada no se vuelve a ofrecer", () => {
    expect(templateNodeFor(rotations[0], nodes, [{ libro_node_id: "n1" }])).toBeNull();
    expect(linkableNodes(nodes, rotations, [{ libro_node_id: "n3" }]).map((n) => n.id)).toEqual([]);
  });

  it("no se ofrecen las fichas que ya son otra rotación publicada", () => {
    expect(linkableNodes(nodes, rotations, []).map((n) => n.id)).toEqual(["n3"]);
  });
});
