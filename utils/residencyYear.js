// La ventana de fechas de un año de residencia.
//
// Hace falta porque las Guardias del Libro del Residente se leen de agenda_events
// (arquetipo `automatic`) y agenda_events guarda fecha, no año de residencia. Sin
// una ventana no hay forma de saber qué guardia es de R1 y cuál de R2.
//
// El año de residencia va del 1 de junio al 31 de mayo, que es como funciona la
// residencia de verdad, y se ancla en el resident_year del perfil más la fecha de
// hoy: si hoy es R3, la ventana que contiene hoy es la de R3 y las anteriores se
// derivan hacia atrás. Falla con quien se incorporó fuera de ciclo, que verá
// alguna guardia en el año de al lado. Decidido así para no añadir configuración
// (ver docs/adr/0008 para el criterio general de no inventar campos que el panel
// no ofrece).

// Junio en base 0. El curso de residencia arranca aquí.
const RESIDENCY_YEAR_START_MONTH = 5;

/**
 * El año natural en el que arrancó el curso de residencia que contiene esa fecha.
 * Para el 20 de agosto de 2026 devuelve 2026; para el 3 de marzo de 2026, 2025.
 */
const startYearOf = (date) =>
  date.getMonth() >= RESIDENCY_YEAR_START_MONTH
    ? date.getFullYear()
    : date.getFullYear() - 1;

/**
 * La ventana [start, end) de un año de residencia concreto.
 *
 * @param {number} residencyYear - el año que se quiere acotar (1-5)
 * @param {number} currentResidencyYear - el resident_year del perfil
 * @param {Date} [today] - para poder fijar el "hoy" en tests
 * @returns {{start: Date, end: Date}|null} null si faltan datos para anclar
 */
export const getResidencyYearWindow = (
  residencyYear,
  currentResidencyYear,
  today = new Date()
) => {
  const target = Number(residencyYear);
  const current = Number(currentResidencyYear);

  if (!target || !current) return null;

  const currentStartYear = startYearOf(today);
  const startYear = currentStartYear + (target - current);

  return {
    start: new Date(startYear, RESIDENCY_YEAR_START_MONTH, 1),
    end: new Date(startYear + 1, RESIDENCY_YEAR_START_MONTH, 1),
  };
};

/**
 * Si una fecha cae dentro del año de residencia dado.
 *
 * Sin ventana anclable (el residente no tiene resident_year en el perfil) devuelve
 * true: es mejor enseñarle sus guardias en el año que tenga abierto que esconderlas.
 */
export const isInResidencyYear = (
  value,
  residencyYear,
  currentResidencyYear,
  today = new Date()
) => {
  const window = getResidencyYearWindow(residencyYear, currentResidencyYear, today);
  if (!window) return true;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date >= window.start && date < window.end;
};

export default {
  getResidencyYearWindow,
  isInResidencyYear,
};
