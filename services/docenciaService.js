import { supabase } from "../config/supabase";

/**
 * Los módulos de Docencia como los ve el residente: Comunicados, Tutorías,
 * Evaluaciones y Autoevaluación anual.
 *
 * NO son apartados del Libro del Residente. Salieron de la plantilla (ADR 0025 del
 * panel) porque no son estructura que el tutor configura una vez, sino trabajo que
 * hace de forma continua. En la app viven en sus propias pantallas, con acceso
 * desde la sección Docencia del Inicio.
 *
 * Los cuatro se leen por VISTA, no por tabla:
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
// Comunicados
// ---------------------------------------------------------------------------

/**
 * Los comunicados de la Unidad Docente que le han llegado a este residente.
 *
 * `hospital_announcement_for_resident` ya junta el comunicado con su fila de
 * destinatario y filtra por auth.uid(), así que aquí no hay join ni filtro: pedirlo
 * por las dos tablas obligaría a la app a conocer las dos policies.
 *
 * El comunicado no tiene detalle que abrir: título y cuerpo son todo lo que hay, y
 * la lista los enseña enteros.
 */
export const getResidentAnnouncements = async (userId) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("hospital_announcement_for_resident")
    .select("*")
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("Error fetching resident announcements:", error);
    throw error;
  }

  return data || [];
};

/**
 * Sella la primera lectura. Va por RPC porque la fila del destinatario es de solo
 * lectura para el residente (`hospital_announcement_recipient_owner` es FOR SELECT).
 *
 * No lanza: marcar como leído es un efecto secundario de abrir la pantalla, y que
 * falle no debe impedir leer el comunicado que ya está en la mano.
 */
export const markAnnouncementRead = async (announcementId) => {
  if (!announcementId) return false;

  const { data, error } = await supabase.rpc(
    "mark_hospital_announcement_read",
    { p_announcement_id: announcementId }
  );

  if (error) {
    console.error("Error marking announcement as read:", error);
    return false;
  }

  return !!data;
};

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
 * El estado inicial, y también el de repuesto cuando algo falla.
 *
 * `loaded` distingue las dos cosas que antes se confundían en un objeto a ceros:
 * "todavía no sé nada" y "ya lo sé, y no hay nada". La sección Docencia lo necesita
 * porque su estado apagado es visible —tarjeta gris, sin abrir nada— y pintarlo
 * mientras carga, o porque se cayó la red, le diría al residente que su hospital no
 * tiene Tutorías cuando lo que pasa es que no hemos podido preguntarlo.
 */
export const emptyTeachingModules = (loaded = false) => ({
  loaded,
  announcements: { available: false, count: 0, unread: 0, lastSentAt: null },
  tutoring: { available: false, count: 0, pending: 0, nextAt: null },
  evaluations: { available: false, count: 0 },
  selfAssessments: { available: false, count: 0, pending: 0, dueAt: null },
});

/**
 * Qué módulos de Docencia enseñarle en Inicio, y con qué estado.
 *
 * Devuelve DOS cosas por módulo que no se pueden mezclar:
 *
 *   `available`  Si su hospital usa ese módulo. Es un hecho del HOSPITAL, y por eso
 *                sale de una RPC y no de una consulta: la RLS del residente le deja
 *                ver sus filas y ninguna más, así que desde aquí "no tengo tutorías"
 *                y "en mi hospital nadie tiene tutorías" son la misma respuesta
 *                vacía. Antes se derivaba de `count > 0`, que apagaba el acceso al
 *                residente al que su tutor todavía no le ha puesto la primera.
 *
 *   el estado    Lo suyo: cuántas tiene, cuántas le tocan y cuándo es la próxima.
 *                Solo lo ACCIONABLE, que es lo que cabe en un badge.
 *
 * Una sola llamada para los cuatro módulos: eran tres consultas por apertura de la
 * app, y la sección Docencia habría añadido una cuarta.
 *
 * No lanza: un fallo aquí no debe tumbar la pantalla de Inicio. Devuelve
 * `loaded: true` con todo a `available: false` solo cuando la base ha contestado de
 * verdad; si falla, `loaded` se queda en `false` y la sección no pinta el gris.
 */
export const getResidentTeachingModules = async (userId) => {
  if (!userId) return emptyTeachingModules();

  try {
    const { data, error } = await supabase.rpc("resident_teaching_home");

    // supabase-js no lanza en los errores de query: devuelve { data, error }. Sin
    // mirar el error, un fallo de permisos se vería como "este residente no tiene
    // nada" y la sección entera se pintaría en gris sin que nadie se enterara.
    if (error) throw error;
    if (!data) return emptyTeachingModules();

    return {
      loaded: true,
      announcements: {
        available: !!data.announcements?.available,
        count: data.announcements?.total || 0,
        unread: data.announcements?.unread || 0,
        lastSentAt: data.announcements?.last_sent_at || null,
      },
      tutoring: {
        available: !!data.tutoring?.available,
        count: data.tutoring?.total || 0,
        pending: data.tutoring?.pending || 0,
        nextAt: data.tutoring?.next_at || null,
      },
      evaluations: {
        available: !!data.evaluations?.available,
        count: data.evaluations?.total || 0,
      },
      selfAssessments: {
        available: !!data.self_assessments?.available,
        count: data.self_assessments?.total || 0,
        pending: data.self_assessments?.pending || 0,
        dueAt: data.self_assessments?.due_at || null,
      },
    };
  } catch (error) {
    console.error("Error resolving teaching modules:", error);
    return emptyTeachingModules();
  }
};

export default {
  getResidentAnnouncements,
  markAnnouncementRead,
  getResidentTutoring,
  saveTutoringResidentAnswers,
  emptyTeachingModules,
  tutoringStateOf,
  getResidentEvaluations,
  getEvaluationCompetencies,
  getResidentSelfAssessments,
  selfAssessmentStateOf,
  saveSelfAssessmentDraft,
  submitSelfAssessment,
  getResidentTeachingModules,
};
