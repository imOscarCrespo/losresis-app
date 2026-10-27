import {
  PREPARATION_KEYS,
  PREPARATION_SECTIONS,
  PREPARATION_STATUS,
  buildPreparationPayload,
  canEditPreparation,
  hasPreparationContent,
  preparationCounts,
  preparationStatusOf,
} from "../../utils/tutoringPreparation";

describe("PREPARATION_SECTIONS", () => {
  it("tiene las 10 preguntas de los apartados A–D con las claves que acepta la RPC", () => {
    expect(PREPARATION_SECTIONS.map((section) => section.title)).toEqual([
      "Evolución formativa",
      "Rotaciones realizadas",
      "Guardias y actividad asistencial",
      "Reflexión personal",
    ]);
    expect(PREPARATION_KEYS).toEqual([
      "learnings",
      "goals_achieved",
      "improved",
      "rotations",
      "difficulties",
      "competencies_to_reinforce",
      "on_call",
      "autonomy_supervision",
      "needs_improvement",
      "support_needs",
    ]);
  });
});

describe("preparationStatusOf", () => {
  it("sin fila es «sin iniciar»", () => {
    expect(preparationStatusOf(null)).toBe(PREPARATION_STATUS.NONE);
  });

  it("un borrador con contenido es borrador", () => {
    expect(
      preparationStatusOf({ status: "draft", answers: { learnings: "x" }, proposed_goals: [] })
    ).toBe(PREPARATION_STATUS.DRAFT);
  });

  it("un borrador vacío sigue siendo «sin iniciar»", () => {
    expect(preparationStatusOf({ status: "draft", answers: {}, proposed_goals: [] })).toBe(
      PREPARATION_STATUS.NONE
    );
  });

  it("enviada es enviada", () => {
    expect(
      preparationStatusOf({ status: "sent", answers: {}, proposed_goals: ["a"], sent_at: "2026-10-25" })
    ).toBe(PREPARATION_STATUS.SENT);
  });
});

describe("buildPreparationPayload", () => {
  it("recorta, quita vacíos y descarta claves desconocidas", () => {
    expect(
      buildPreparationPayload(
        { learnings: "  ecografía  ", on_call: "   ", hack: "x", difficulties: null },
        [" más quirófano ", "", "  ", "póster"]
      )
    ).toEqual({
      answers: { learnings: "ecografía" },
      proposedGoals: ["más quirófano", "póster"],
    });
  });

  it("deja los objetivos duplicados: son texto libre del residente", () => {
    expect(buildPreparationPayload({}, ["a", "a"]).proposedGoals).toEqual(["a", "a"]);
  });

  it("aguanta entradas vacías", () => {
    expect(buildPreparationPayload(undefined, undefined)).toEqual({
      answers: {},
      proposedGoals: [],
    });
  });
});

describe("hasPreparationContent", () => {
  it("no hay contenido si todo está en blanco (enviar deshabilitado)", () => {
    expect(hasPreparationContent({ learnings: "  " }, ["", " "])).toBe(false);
  });

  it("basta una respuesta o un objetivo", () => {
    expect(hasPreparationContent({ support_needs: "sí" }, [])).toBe(true);
    expect(hasPreparationContent({}, ["objetivo"])).toBe(true);
  });
});

describe("canEditPreparation", () => {
  it("solo se edita una tutoría programada", () => {
    expect(canEditPreparation({ status: "scheduled" })).toBe(true);
    expect(canEditPreparation({ status: "finished" })).toBe(false);
    expect(canEditPreparation({ status: "cancelled" })).toBe(false);
    expect(canEditPreparation(null)).toBe(false);
  });
});

describe("preparationCounts", () => {
  it("cuenta respuestas y objetivos con contenido", () => {
    expect(preparationCounts({ learnings: "a", improved: " " }, ["x", ""])).toEqual({
      answered: 1,
      goals: 1,
    });
  });
});
