// Autoevaluación de rotaciones (ClickUp 124b4z9ueuv): la lógica que no pinta.
//
// Todo se lee de la VERSIÓN publicada (rotation_assessment_version.content), que
// es una foto congelada: los ids de objetivos, bloques, criterios y niveles son
// los de esa foto, y las respuestas se guardan contra ellos. Por eso una
// autoevaluación siempre se pinta con su propia versión, nunca con la última.
//
// Las reglas de validación y de nota son espejo de losresis-db
// (20261025160000_rotation_self_assessment.sql) y del panel
// (src/lib/rotationAssessment.ts → computeBlockScore). La base es la que manda;
// aquí solo se adelanta para poder decirlo en pantalla.

const byPosition = (a, b) => (Number(a?.position) || 0) - (Number(b?.position) || 0);

const isBlank = (value) => typeof value !== "string" || value.trim() === "";

const asLevel = (raw) => ({
  id: String(raw?.id ?? ""),
  code: typeof raw?.code === "string" ? raw.code : "",
  name: typeof raw?.name === "string" ? raw.name : "",
  description: typeof raw?.description === "string" ? raw.description : "",
  min: typeof raw?.min === "number" ? raw.min : null,
  max: typeof raw?.max === "number" ? raw.max : null,
  notApplicable: raw?.not_applicable === true,
});

/** La foto de una versión, en la forma con la que se pinta. */
export const normalizeVersion = (content) => {
  const rotation = content?.rotation || {};
  const objectives = (Array.isArray(content?.objectives) ? content.objectives : [])
    .filter((objective) => objective?.id)
    .slice()
    .sort(byPosition)
    .map((objective) => ({
      id: String(objective.id),
      title: objective.title || "",
      description: objective.description || "",
    }));

  const blocks = (Array.isArray(content?.blocks) ? content.blocks : [])
    .filter((block) => block?.id)
    .slice()
    .sort(byPosition)
    .map((block) => {
      const kind = block.kind === "objectives" ? "objectives" : "criteria";
      const items =
        kind === "objectives"
          ? objectives.map((objective) => ({
              id: objective.id,
              title: objective.title,
              description: objective.description,
            }))
          : (Array.isArray(block.criteria) ? block.criteria : [])
              .filter((criterion) => criterion?.id)
              .slice()
              .sort(byPosition)
              .map((criterion) => ({
                id: String(criterion.id),
                title: criterion.name || "",
                description: criterion.description || "",
              }));
      return {
        id: String(block.id),
        kind,
        title: block.title || "",
        description: block.description || "",
        scale: (Array.isArray(block.scale) ? block.scale : []).map(asLevel),
        scoring: block.scoring && typeof block.scoring === "object" ? block.scoring : null,
        // Sin la marca (versiones publicadas antes de que existiera) el bloque es
        // de Docencia: estar publicado no da permiso para responderlo.
        selfAssessable: block.resident_self_assessment === true,
        items,
      };
    });

  return {
    rotation: {
      id: rotation.id || null,
      name: rotation.name || "",
      description: rotation.description || "",
      durationMonths:
        typeof rotation.duration_months === "number" ? rotation.duration_months : null,
      residencyYear: rotation.residency_year ?? null,
    },
    objectives,
    blocks,
  };
};

export const durationLabel = (months) => {
  if (!months) return "";
  return `${months} ${months === 1 ? "mes" : "meses"}`;
};

export const objectivesLabel = (count) =>
  `${count} ${count === 1 ? "objetivo formativo" : "objetivos formativos"}`;

// ---------------------------------------------------------------------------
// Objetivos
// ---------------------------------------------------------------------------

export const isObjectiveAnswered = (answers, objectiveId) =>
  !isBlank(answers?.[objectiveId]);

export const objectiveProgress = (version, answers) => {
  const total = version.objectives.length;
  const answered = version.objectives.filter((objective) =>
    isObjectiveAnswered(answers, objective.id)
  ).length;
  return { answered, total };
};

/** Títulos de los objetivos sin respuesta, en el orden de Docencia. */
export const missingObjectives = (version, answers) =>
  version.objectives
    .filter((objective) => !isObjectiveAnswered(answers, objective.id))
    .map((objective) => objective.title);

// ---------------------------------------------------------------------------
// Rúbrica
// ---------------------------------------------------------------------------

const isNumericLevel = (level) =>
  !level.notApplicable && typeof level.min === "number" && typeof level.max === "number";

/** Nivel con rango (6-7): hay que elegir la puntuación exacta. */
export const needsExactScore = (block, level) =>
  block.kind === "criteria" && isNumericLevel(level) && level.min < level.max;

export const scoreOptions = (level) => {
  if (!isNumericLevel(level)) return [];
  const options = [];
  for (let value = Math.ceil(level.min); value <= Math.floor(level.max); value += 1) {
    options.push(value);
  }
  return options;
};

/**
 * La respuesta que se guarda al elegir un nivel (y, si tiene rango, un valor).
 * NA y los niveles sin número no llevan puntuación: NA no es un cero. Un nivel
 * de un solo valor (5) lleva ese valor.
 */
export const buildRubricAnswer = (block, level, score = null) => {
  if (block.kind !== "criteria" || !isNumericLevel(level)) {
    return { level_id: level.id, score: null };
  }
  if (level.min === level.max) return { level_id: level.id, score: level.min };
  return { level_id: level.id, score: typeof score === "number" ? score : null };
};

export const findLevel = (block, answer) =>
  block.scale.find((level) => level.id === answer?.level_id) || null;

/** Mismo criterio que rotation_rubric_answer_valid en la base. */
export const isRubricAnswerValid = (block, answer) => {
  if (!answer || typeof answer !== "object") return false;
  const level = findLevel(block, answer);
  if (!level) return false;
  if (block.kind === "criteria" && isNumericLevel(level)) {
    return (
      typeof answer.score === "number" &&
      answer.score >= level.min &&
      answer.score <= level.max
    );
  }
  return answer.score === null || answer.score === undefined;
};

export const selfAssessableBlocks = (version) =>
  version.blocks.filter((block) => block.selfAssessable);

export const rubricProgress = (version, rubricAnswers) => {
  let answered = 0;
  let total = 0;
  selfAssessableBlocks(version).forEach((block) => {
    block.items.forEach((item) => {
      total += 1;
      if (isRubricAnswerValid(block, rubricAnswers?.[block.id]?.[item.id])) answered += 1;
    });
  });
  return { answered, total };
};

/** Títulos de los bloques que el residente responde y tienen algo sin valorar. */
export const missingRubricBlocks = (version, rubricAnswers) =>
  selfAssessableBlocks(version)
    .filter((block) =>
      block.items.some(
        (item) => !isRubricAnswerValid(block, rubricAnswers?.[block.id]?.[item.id])
      )
    )
    .map((block) => block.title);

const maxPerCriterion = (scale) => {
  const numeric = scale.filter(isNumericLevel);
  if (!numeric.length) return null;
  return Math.max(...numeric.map((level) => level.max));
};

/**
 * La nota de un bloque de criterios con las reglas que publicó Docencia:
 * suma / (máximo de la escala × criterios aplicables) × out_of. NA no suma ni
 * cuenta para el máximo. Sin reglas válidas no hay nota (no se inventa una
 * fórmula), con algo sin valorar tampoco, y con todo NA es "sin puntuación
 * aplicable", nunca un 0.
 */
export const computeBlockScore = (block, blockAnswers) => {
  if (block.kind !== "criteria") return { grade: null, outOf: null, reason: "not_scored" };

  const outOf = block.scoring?.out_of;
  if (
    block.scoring?.method !== "sum_over_applicable" ||
    typeof outOf !== "number" ||
    outOf <= 0
  ) {
    return { grade: null, outOf: null, reason: "no_rules" };
  }

  const max = maxPerCriterion(block.scale);
  if (max === null) return { grade: null, outOf, reason: "no_rules" };

  const values = block.items.map((item) => {
    const answer = blockAnswers?.[item.id];
    if (!isRubricAnswerValid(block, answer)) return null;
    return findLevel(block, answer).notApplicable ? "NA" : answer.score;
  });

  if (values.some((value) => value === null)) {
    return { grade: null, outOf, reason: "incomplete" };
  }

  const applicable = values.filter((value) => typeof value === "number");
  if (!applicable.length) return { grade: null, outOf, reason: "no_applicable" };

  const obtained = applicable.reduce((sum, value) => sum + value, 0);
  const grade = Math.round((obtained / (max * applicable.length)) * outOf * 100) / 100;
  return { grade, outOf, reason: "ok" };
};

export const formatGrade = (grade) =>
  String(Math.round(grade * 10) / 10).replace(".", ",");

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

const hasRubricAnswers = (assessment) =>
  Object.values(assessment?.rubric_answers || {}).some(
    (block) => block && Object.keys(block).length > 0
  ) || !isBlank(assessment?.final_reflection);

/** pending | draft | completed */
export const objectivesStatus = (assessment, version) => {
  if (!assessment) return "pending";
  if (assessment.objectives_completed_at) return "completed";
  return objectiveProgress(version, assessment.objective_answers).answered > 0
    ? "draft"
    : "pending";
};

/**
 * unavailable: la versión no tiene rúbrica.
 * consult: la tiene, pero ningún bloque es para el residente (solo la consulta).
 * pending | draft | completed: la parte que le toca a él.
 */
export const rubricStatus = (assessment, version) => {
  if (!version.blocks.length) return "unavailable";
  if (!selfAssessableBlocks(version).length) return "consult";
  if (!assessment) return "pending";
  if (assessment.rubric_completed_at) return "completed";
  return hasRubricAnswers(assessment) ? "draft" : "pending";
};

/** El estado de la autoevaluación entera: pending | draft | completed. */
export const assessmentStatus = (assessment, version) => {
  if (!assessment) return "pending";
  if (assessment.completed_at) return "completed";
  const parts = [objectivesStatus(assessment, version), rubricStatus(assessment, version)];
  return parts.some((status) => status === "draft" || status === "completed")
    ? "draft"
    : "pending";
};

export const ASSESSMENT_STATUS_COPY = {
  pending: { label: "Autoevaluación pendiente", action: "Ver rotación" },
  draft: { label: "Autoevaluación en curso", action: "Continuar" },
  completed: { label: "Autoevaluación completada", action: "Ver autoevaluación" },
};

export const PART_STATUS_LABEL = {
  unavailable: "No disponible",
  consult: "Solo consulta",
  pending: "Pendiente",
  draft: "En curso",
  completed: "Completada",
};

// ---------------------------------------------------------------------------
// Rotaciones del año ↔ fichas del Libro
// ---------------------------------------------------------------------------

const byCreatedAt = (a, b) => String(a.created_at).localeCompare(String(b.created_at));

/**
 * Una tarjeta por rotación publicada del año, con la autoevaluación que toca
 * (la abierta, o la última si todas están completadas) y las anteriores. Al
 * final, las autoevaluaciones de rotaciones que ya no están publicadas para él
 * (retiradas, o de otro hospital o especialidad): el historial no se pierde.
 */
export const buildRotationCards = ({ rotations = [], assessments = [] }) => {
  const published = new Set(rotations.map((rotation) => rotation.rotation_id));
  const assessmentsOf = (rotationId) =>
    assessments.filter((item) => item.rotation_id === rotationId).sort(byCreatedAt);

  const cardFor = (rotationId, plan) => {
    const own = assessmentsOf(rotationId);
    const current = own.find((item) => !item.completed_at) || own[own.length - 1] || null;
    const version = normalizeVersion(current ? current.content : plan?.content);
    return {
      key: rotationId,
      rotationId,
      plan: plan || null,
      retired: !plan,
      assessment: current,
      previous: own.filter((item) => item !== current),
      version,
      versionNumber: current ? current.version : plan?.version,
      status: assessmentStatus(current, version),
    };
  };

  const cards = rotations.map((plan) => cardFor(plan.rotation_id, plan));
  const history = [...new Set(assessments.map((item) => item.rotation_id))]
    .filter((rotationId) => !published.has(rotationId))
    .map((rotationId) => cardFor(rotationId, null));

  return [...cards, ...history];
};

/** La ficha del Libro de una autoevaluación ya empezada. */
export const nodeForAssessment = (assessment, nodes = []) =>
  (assessment?.libro_node_id &&
    nodes.find((node) => node.id === assessment.libro_node_id)) ||
  null;

const linkedNodeIds = (assessments) =>
  new Set(assessments.map((item) => item.libro_node_id).filter(Boolean));

/**
 * La ficha que es esta rotación en el Libro oficial: la sembrada del mismo nodo
 * de plantilla del que Docencia importó la rotación. Por id, nunca por nombre.
 */
export const templateNodeFor = (plan, nodes = [], assessments = []) => {
  if (!plan?.source_template_node_id) return null;
  const linked = linkedNodeIds(assessments);
  return (
    nodes.find(
      (node) =>
        node.template_node_id === plan.source_template_node_id && !linked.has(node.id)
    ) || null
  );
};

/**
 * Las fichas que el residente puede elegir al empezar una rotación que no se
 * enlaza sola: las suyas sin autoevaluación, salvo las que ya son (por plantilla)
 * otra rotación publicada.
 */
export const linkableNodes = (nodes = [], rotations = [], assessments = []) => {
  const linked = linkedNodeIds(assessments);
  const otherSources = new Set(
    rotations.map((rotation) => rotation.source_template_node_id).filter(Boolean)
  );
  return nodes.filter(
    (node) =>
      !linked.has(node.id) &&
      !(node.template_node_id && otherSources.has(node.template_node_id))
  );
};
