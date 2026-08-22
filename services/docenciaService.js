import { supabase } from "../config/supabase";

/**
 * Los módulos de Docencia como los ve el residente: Tutorías, Evaluaciones y
 * Autoevaluación anual.
 *
 * NO son apartados del Libro del Residente. Salieron de la plantilla (ADR 0025 del
 * panel) porque no son estructura que el tutor configura una vez, sino trabajo que
 * hace de forma continua. En la app viven en su propia pantalla, con acceso desde
 * los iconos de Inicio.
 *
 * Tutorías y Evaluaciones se leen por VISTA, no por tabla:
 * hospital_tutoring_for_resident y hospital_evaluation_for_resident filtran por
 * auth.uid() y anulan el contenido mientras el tutor no lo haya compartido
 * (shared_at). RLS es por filas y no puede esconder columnas, así que la vista es la
 * que hace cumplir que el residente vea que tiene una tutoría el día 22 sin ver las
 * notas de trabajo que su tutor todavía está escribiendo.
 *
 * Los estados NO se guardan: se derivan al leer, igual que en el panel. Una tutoría
 * "pendiente de completar" es una programada con la fecha pasada; un estado derivado
 * no puede desincronizarse.
 */

// ---------------------------------------------------------------------------
// Tutorías
// ---------------------------------------------------------------------------

export const TUTORING_STATE = {
  UPCOMING: "upcoming",
  PENDING: "pending",
  DONE: "done",
  CANCELLED: "cancelled",
};

/** El estado de una tutoría, derivado. */
export const tutoringStateOf = (tutoring, now = new Date()) => {
  if (tutoring.status === "cancelled") return TUTORING_STATE.CANCELLED;
  if (tutoring.status === "finished") return TUTORING_STATE.DONE;

  const scheduled = new Date(tutoring.scheduled_at);
  if (Number.isNaN(scheduled.getTime())) return TUTORING_STATE.UPCOMING;

  return scheduled >= now ? TUTORING_STATE.UPCOMING : TUTORING_STATE.PENDING;
};

export const getResidentTutoring = async (userId) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("hospital_tutoring_for_resident")
    .select("*")
    .order("scheduled_at", { ascending: false });

  if (error) {
    console.error("Error fetching resident tutoring:", error);
    throw error;
  }

  return data || [];
};

/**
 * Los campos que el residente aporta a una tutoría (§13 del documento).
 *
 * Son fijos y no configurables a propósito: el interruptor «si el hospital lo
 * permite» solo existía como config del apartado retirado `tutoring_sessions`, y
 * resucitarlo devolvería Tutorías a la plantilla del Libro justo después de que el
 * ADR 0025 la sacara.
 *
 * Van a hospital_tutoring.resident_answers, que es SUYA: las seis columnas de
 * contenido que ya había son del tutor, y si los dos escribieran encima, él la
 * pisaría sin dejar rastro.
 */
export const TUTORING_RESIDENT_FIELDS = [
  { key: "agreements", label: "Acuerdos alcanzados" },
  { key: "goals", label: "Objetivos que me marco" },
  { key: "comments", label: "Comentarios" },
  { key: "notes", label: "Observaciones" },
];

/**
 * Guarda la parte del residente. Va por RPC porque la tabla es de solo lectura para
 * él: escribir pasa siempre por una función que comprueba que la tutoría es suya.
 *
 * Su tutor lo ve en cuanto se guarda, sin esperar a `shared_at`: es su preparación
 * para la reunión, esconderla no tendría sentido.
 */
export const saveTutoringResidentAnswers = async (id, answers) => {
  const { error } = await supabase.rpc(
    "save_hospital_tutoring_resident_answers",
    { p_id: id, p_answers: answers || {} }
  );

  if (error) {
    console.error("Error saving tutoring resident answers:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Evaluaciones
// ---------------------------------------------------------------------------

/**
 * Las evaluaciones que su tutor le ha compartido.
 *
 * El residente SOLO LEE: hospital_evaluation es el documento del tutor y no tiene
 * ni una columna donde el residente escriba. Lo que se responde y se envía es la
 * Autoevaluación anual, que es otra cosa.
 */
export const getResidentEvaluations = async (userId) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("hospital_evaluation_for_resident")
    .select("*")
    .order("evaluation_date", { ascending: false });

  if (error) {
    console.error("Error fetching resident evaluations:", error);
    throw error;
  }

  return data || [];
};

/** Los niveles de competencia que el tutor fijó en una evaluación. */
export const getEvaluationCompetencies = async (evaluationId) => {
  if (!evaluationId) return [];

  const { data, error } = await supabase
    .from("hospital_evaluation_competency")
    .select("node_id, level, comment, libro_node(name, description)")
    .eq("evaluation_id", evaluationId);

  if (error) {
    console.error("Error fetching evaluation competencies:", error);
    return [];
  }

  return data || [];
};

// ---------------------------------------------------------------------------
// Autoevaluación anual
// ---------------------------------------------------------------------------

export const SELF_ASSESSMENT_STATE = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  CLOSED: "closed",
};

/**
 * El estado de una autoevaluación, derivado.
 *
 * "En progreso" es pendiente con algo ya empezado, y eso lo dice `started_at`, que
 * marca el primer borrador guardado. Antes se contaban las respuestas no vacías del
 * jsonb, y con preguntas tipadas eso miente en los dos sentidos: marcar "No" en un
 * sí/no escribe `false`, que un truthy descarta, y un 0 en una escala, igual.
 */
export const selfAssessmentStateOf = (item) => {
  if (item.status === "closed") return SELF_ASSESSMENT_STATE.CLOSED;
  if (item.status === "submitted") return SELF_ASSESSMENT_STATE.SUBMITTED;
  if (item.started_at) return SELF_ASSESSMENT_STATE.IN_PROGRESS;

  // Las solicitudes de antes de `started_at` no lo tienen: para ellas sigue valiendo
  // que haya algo escrito, que en su caso siempre era texto.
  const answered = Object.values(item.answers || {}).filter((value) =>
    String(value ?? "").trim()
  ).length;

  return answered
    ? SELF_ASSESSMENT_STATE.IN_PROGRESS
    : SELF_ASSESSMENT_STATE.PENDING;
};

/**
 * Las autoevaluaciones del residente.
 *
 * Se leen de `hospital_self_assessment_for_resident` y no de la tabla: la vista deja
 * fuera `tutor_comment`, que son las notas privadas del tutor para preparar la
 * tutoría. Esta pantalla llegó a pintarlas.
 */
export const getResidentSelfAssessments = async (userId) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("hospital_self_assessment_for_resident")
    .select("*")
    .eq("resident_user_id", userId)
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching resident self assessments:", error);
    throw error;
  }

  return data || [];
};

/**
 * Guarda sin enviar. Va por RPC porque la tabla es de solo lectura para el
 * residente: escribir es siempre a través de una función que comprueba que la
 * autoevaluación es suya y que sigue pendiente.
 */
export const saveSelfAssessmentDraft = async (id, answers) => {
  const { error } = await supabase.rpc("save_hospital_self_assessment_draft", {
    p_id: id,
    p_answers: answers || {},
  });

  if (error) {
    console.error("Error saving self assessment draft:", error);
    throw error;
  }
};

/** Envía definitivamente. A partir de aquí solo el tutor puede reabrirla. */
export const submitSelfAssessment = async (id, answers) => {
  const { error } = await supabase.rpc("submit_hospital_self_assessment", {
    p_id: id,
    p_answers: answers || {},
  });

  if (error) {
    console.error("Error submitting self assessment:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Qué módulos tiene activos este residente
// ---------------------------------------------------------------------------

/**
 * Qué módulos de Docencia enseñarle en Inicio, y con qué estado.
 *
 * "Configurado" se deriva del dato: el acceso aparece cuando el residente TIENE al
 * menos una fila. No hay interruptor en el panel que consultar, y derivarlo así
 * evita además llevarle a una pantalla vacía.
 *
 * El estado que se devuelve es solo lo ACCIONABLE, porque el sitio donde se pinta es
 * un badge de 17 píxeles: las tutorías que le toca completar, la fecha de la próxima
 * y las autoevaluaciones pendientes. Las evaluaciones no llevan estado a propósito:
 * el residente solo las lee, así que un número permanente encima del icono sería
 * ruido y no una llamada a la acción.
 *
 * No lanza: un fallo aquí no debe tumbar la pantalla de Inicio, solo esconder los
 * accesos.
 */
export const getResidentTeachingModules = async (userId) => {
  const empty = {
    tutoring: { count: 0, pending: 0, nextAt: null },
    evaluations: { count: 0 },
    selfAssessments: { count: 0, pending: 0 },
  };
  if (!userId) return empty;

  try {
    const [tutoring, evaluations, selfAssessments] = await Promise.all([
      supabase
        .from("hospital_tutoring_for_resident")
        .select("id, scheduled_at, status"),
      supabase
        .from("hospital_evaluation_for_resident")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("hospital_self_assessment_for_resident")
        .select("id, status")
        .eq("resident_user_id", userId),
    ]);

    // supabase-js no lanza en los errores de query: devuelve { data, error }. Sin
    // mirar el error, un fallo de permisos se vería como "este residente no tiene
    // tutorías" y los accesos desaparecerían sin que nadie se enterara.
    for (const result of [tutoring, evaluations, selfAssessments]) {
      if (result.error) {
        console.error("Error resolving teaching modules:", result.error);
        return empty;
      }
    }

    const tutoringRows = tutoring.data || [];
    const now = new Date();

    // Pendiente de completar: programada, con la fecha ya pasada. Igual que en el
    // panel, es un estado derivado y no una columna.
    const pending = tutoringRows.filter(
      (row) => tutoringStateOf(row, now) === TUTORING_STATE.PENDING
    ).length;

    const upcoming = tutoringRows
      .filter((row) => tutoringStateOf(row, now) === TUTORING_STATE.UPCOMING)
      .map((row) => row.scheduled_at)
      .filter(Boolean)
      .sort();

    const selfRows = selfAssessments.data || [];

    return {
      tutoring: {
        count: tutoringRows.length,
        pending,
        nextAt: upcoming[0] || null,
      },
      evaluations: { count: evaluations.count || 0 },
      selfAssessments: {
        count: selfRows.length,
        pending: selfRows.filter((row) => row.status === "pending").length,
      },
    };
  } catch (error) {
    console.error("Error resolving teaching modules:", error);
    return empty;
  }
};

/**
 * El badge del acceso: lo accionable primero, y si no hay nada que hacer, cuándo es
 * lo siguiente. Sin nada que decir devuelve null y no se pinta badge.
 */
export const teachingModuleBadge = (module, state) => {
  if (module === "tutoring") {
    if (state?.pending > 0) return String(state.pending);
    if (state?.nextAt) {
      const date = new Date(state.nextAt);
      if (Number.isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "short",
      })
        .format(date)
        .replace(".", "")
        .toUpperCase();
    }
    return null;
  }

  if (module === "selfAssessments") {
    return state?.pending > 0 ? String(state.pending) : null;
  }

  // Evaluaciones: se leen, no se completan. Sin badge.
  return null;
};

export default {
  getResidentTutoring,
  saveTutoringResidentAnswers,
  teachingModuleBadge,
  tutoringStateOf,
  getResidentEvaluations,
  getEvaluationCompetencies,
  getResidentSelfAssessments,
  selfAssessmentStateOf,
  saveSelfAssessmentDraft,
  submitSelfAssessment,
  getResidentTeachingModules,
};
