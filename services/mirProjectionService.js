/**
 * Servicio de "Nota MIR proyectada" (Variante A — MVP).
 *
 * Capturamos los datos en el mismo formato en que las academias (CTO en particular)
 * los entregan al alumno tras cada simulacro:
 *   - simulacro_label (ej. "SM-2") y source (academia)
 *   - neto del examen (aciertos − fallos/3)
 *   - rango mejor/peor del puesto MIR estimado
 *   - puesto sólo entre alumnos de la academia
 *
 * Con la serie de registros proyectamos el número de orden final (regresión lineal
 * sobre el midpoint del rango) para alimentar el simulador de plazas existente
 * (calculateMIRProbabilities en mirSimulatorService.js).
 *
 * Recuerda: en el MIR un número de orden MÁS BAJO es MEJOR.
 */

import { supabase, supabaseQuery } from "../config/supabase";

const TABLE_MOCK = "mir_mock_results";

// Fecha objetivo de la próxima convocatoria MIR (~último sábado de enero).
export const MIR_EXAM_DATE = "2027-01-23";

// Número de orden máximo posible = total de participantes con número asignado.
export const MAX_MIR_ORDER = 14000;

const clampOrder = (value) =>
  Math.min(MAX_MIR_ORDER, Math.max(1, Math.round(value)));

// Origen del simulacro (academias habituales + otro).
export const MOCK_SOURCES = [
  { id: "amir", name: "AMIR" },
  { id: "cto", name: "CTO" },
  { id: "mir_asturias", name: "MIR Asturias" },
  { id: "otro", name: "Otro" },
];

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toFinitePositiveInt = (value) => {
  const n = toFiniteNumber(value);
  if (n === null || n <= 0) return null;
  return Math.round(n);
};

/**
 * Añadir el resultado de un simulacro.
 *
 * Shape:
 *   {
 *     takenAt, source, simulacroLabel,
 *     neto,
 *     reportedOrderBest, reportedOrderWorst,   // rango mejor/peor (CTO da rango)
 *     reportedOrder,                            // legacy: un único número
 *     academyOnlyOrder,
 *   }
 *
 * Reglas:
 * - takenAt obligatorio.
 * - Hay que entregar al menos un puesto: best, worst, o reportedOrder.
 * - best <= worst si ambos vienen.
 * - reported_order persistido = midpoint(best, worst) o reportedOrder si no hay rango.
 */
export const addMockResult = async (userId, input = {}) => {
  if (!userId) {
    return { success: false, data: null, error: "userId es obligatorio" };
  }
  const {
    takenAt,
    source = null,
    simulacroLabel = null,
    neto = null,
    reportedOrderBest = null,
    reportedOrderWorst = null,
    reportedOrder = null,
    academyOnlyOrder = null,
  } = input;

  if (!takenAt) {
    return { success: false, data: null, error: "La fecha del simulacro es obligatoria" };
  }

  const best = toFinitePositiveInt(reportedOrderBest);
  const worst = toFinitePositiveInt(reportedOrderWorst);
  const single = toFinitePositiveInt(reportedOrder);

  if (!best && !worst && !single) {
    return {
      success: false,
      data: null,
      error: "Necesitamos al menos un puesto (mejor, peor o único)",
    };
  }
  if (best && worst && best > worst) {
    return {
      success: false,
      data: null,
      error: "El puesto en el mejor caso no puede ser mayor que el peor",
    };
  }

  let midpoint;
  if (best && worst) midpoint = Math.round((best + worst) / 2);
  else if (best && !worst) midpoint = best;
  else if (worst && !best) midpoint = worst;
  else midpoint = single;

  const label = simulacroLabel && String(simulacroLabel).trim()
    ? String(simulacroLabel).trim()
    : null;

  return supabaseQuery(() =>
    supabase
      .from(TABLE_MOCK)
      .insert([
        {
          user_id: userId,
          taken_at: takenAt,
          source: source || null,
          reported_order: clampOrder(midpoint),
          reported_order_best: best,
          reported_order_worst: worst,
          academy_only_order: toFinitePositiveInt(academyOnlyOrder),
          neto: toFiniteNumber(neto),
          simulacro_label: label,
          label,
        },
      ])
      .select("*")
      .single()
  );
};

/**
 * Obtener los simulacros de un usuario, ordenados por fecha (más antiguo primero).
 */
export const getMockResultsForUser = async (userId) => {
  if (!userId) {
    return { success: false, data: null, error: "userId es obligatorio" };
  }

  return supabaseQuery(() =>
    supabase
      .from(TABLE_MOCK)
      .select(
        "id, taken_at, source, reported_order, reported_order_best, reported_order_worst, academy_only_order, neto, simulacro_label, label, created_at"
      )
      .eq("user_id", userId)
      .order("taken_at", { ascending: true })
  );
};

/**
 * Eliminar un simulacro por id.
 */
export const deleteMockResult = async (id) => {
  if (!id) {
    return { success: false, data: null, error: "id es obligatorio" };
  }

  return supabaseQuery(() =>
    supabase.from(TABLE_MOCK).delete().eq("id", id).select("id").single()
  );
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toTime = (dateStr) => {
  const t = new Date(dateStr).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Proyectar el número de orden final a partir de la serie de simulacros.
 *
 * Regresión lineal sobre el midpoint (reported_order) en el eje t (días).
 * La banda de incertidumbre nunca puede ser más estrecha que la mitad del rango
 * medio que el alumno introduce: no prometer más precisión que la academia.
 *
 * Devuelve además `confidence` ('low'|'medium'|'high') para que la UI module el lenguaje.
 */
export const projectOrder = (mockResults, examDate = MIR_EXAM_DATE) => {
  const points = (mockResults || [])
    .map((m) => ({
      t: toTime(m.taken_at),
      y: Number(m.reported_order),
      best: toFinitePositiveInt(m.reported_order_best),
      worst: toFinitePositiveInt(m.reported_order_worst),
    }))
    .filter((p) => p.t !== null && Number.isFinite(p.y) && p.y > 0)
    .sort((a, b) => a.t - b.t);

  if (points.length < 2) return null;

  const n = points.length;
  const t0 = points[0].t;
  const xs = points.map((p) => (p.t - t0) / DAY_MS);
  const ys = points.map((p) => p.y);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;

  const meanY = sumY / n;
  let slope = 0;
  let intercept = meanY;
  if (denom !== 0 && n >= 3) {
    // Con menos de 3 simulacros la "pendiente" es indistinguible del ruido y
    // extrapolada hasta la fecha del examen genera proyecciones absurdas
    // (caídas o subidas masivas). Tratamos n<3 como tendencia plana: usamos
    // el último valor reportado y dejamos que la banda de incertidumbre haga
    // el trabajo de comunicar que aún no podemos proyectar con confianza.
    slope = (n * sumXY - sumX * sumY) / denom;
    intercept = (sumY - slope * sumX) / n;
  } else {
    intercept = ys[ys.length - 1];
  }

  const examX = (toTime(examDate) - t0) / DAY_MS;
  const predict = (x) => intercept + slope * x;
  const projected = clampOrder(predict(examX));

  // Margen estadístico.
  let margin;
  if (n >= 3) {
    const residuals = xs.map((x, i) => ys[i] - predict(x));
    const variance =
      residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2);
    margin = Math.sqrt(Math.max(0, variance));
  } else {
    // Con n<3 la banda tiene que ser ancha: aún no sabes nada de la tendencia.
    margin = Math.abs(projected) * 0.2;
  }

  // Suelo del margen: media de la mitad del rango que el alumno ya introduce.
  // Así no prometemos más precisión que la propia academia.
  const userHalfRanges = points
    .filter((p) => p.best != null && p.worst != null && p.worst >= p.best)
    .map((p) => (p.worst - p.best) / 2);
  if (userHalfRanges.length > 0) {
    const avgHalfRange =
      userHalfRanges.reduce((a, b) => a + b, 0) / userHalfRanges.length;
    margin = Math.max(margin, avgHalfRange);
  }
  margin = Math.max(margin, 1);

  const best = clampOrder(projected - margin);
  const worst = clampOrder(projected + margin);

  const relativeSlope = meanY !== 0 ? slope / meanY : 0;
  let trend = "stable";
  if (relativeSlope < -0.02) trend = "up";
  else if (relativeSlope > 0.02) trend = "down";

  let confidence = "low";
  if (n >= 4) confidence = "high";
  else if (n === 3) confidence = "medium";

  return {
    projectedOrder: projected,
    best,
    worst,
    trend,
    count: n,
    confidence,
    rangeWidth: worst - best,
  };
};
