import { useCallback, useEffect, useMemo, useState } from "react";

import { getLibroYearOverview } from "../services/libroYearService";
import {
  getAssessments,
  isAssessmentDueThisMonth,
} from "../services/mentalHealthService";
import {
  formatPayoutPeriodLabel,
  getResidentPayoutForMonth,
  getResidentPayoutsByYear,
} from "../services/residentPayoutService";
import {
  daysOverdue,
  findServicio,
  getServiceReminders,
} from "../services/serviceRemindersService";
import { getResidencyYearWindow } from "../utils/residencyYear";

/**
 * Lo que el inicio del residente necesita para "Te toca a ti" y "Tu año de un
 * vistazo": lo que tiene pendiente de hacer, y los tres números de su año.
 *
 * Cada fuente va en su propio try/catch porque son independientes: que un
 * residente no tenga servicio (sin hospital o sin especialidad) no debe dejarle
 * la lista de pendientes vacía, ni un fallo de permisos en el Libro borrarle las
 * guardias del año.
 *
 * Lo de Docencia (tutorías y autoevaluaciones) NO se pide aquí: la home ya lo
 * carga con `getResidentTeachingModules` para la sección Docencia del final, y
 * pedirlo dos veces sería una consulta de más por cada apertura de la app.
 */

// Las dos frases del año: el curso de residencia (junio-mayo) manda en formación
// y guardias; la nómina va por año natural, que es como se cobra y se declara.
const buildYearFrame = (userProfile, now) => ({
  residencyYear: Number(userProfile?.resident_year) || null,
  calendarYear: now.getFullYear(),
});

const countResidencyYearShifts = (agendaEvents, residencyYear, now) => {
  const shifts = (agendaEvents || []).filter(
    (event) => event.event_type === "shift" && event.event_date
  );

  // El número es "las guardias que llevas hechas", no "las que tienes puestas en
  // la agenda": las de la semana que viene ya están en agenda_events y contarlas
  // le inflaría el año con trabajo que aún no ha hecho. El corte es el final de
  // hoy, para que la guardia de esta noche cuente desde que empieza el día.
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  const window = getResidencyYearWindow(residencyYear, residencyYear, now);

  return shifts.filter((event) => {
    const date = new Date(`${event.event_date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    if (date >= endOfToday) return false;
    // Sin resident_year no hay ventana que anclar. Igual que en el Libro
    // (utils/residencyYear), se cuentan todas las pasadas: mejor un número de
    // más que esconderle sus guardias.
    if (!window) return true;
    return date >= window.start && date < window.end;
  }).length;
};

/** El mes cerrado más reciente: el que ya toca registrar en Nóminas. */
const lastClosedMonth = (now) => {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: previous.getFullYear(), month: previous.getMonth() + 1 };
};

export const useResidentHomeSummary = ({
  userProfile,
  agendaEvents,
  teachingModules,
  // El banner de cierre de nómina de la cabecera ya pide lo mismo entre el día 28
  // y el 3. Mientras está visible, la fila de nómina no se repite aquí.
  payoutBannerVisible = false,
}) => {
  const userId = userProfile?.id || null;
  const isResident = !!userProfile?.is_resident;
  const hospitalId = userProfile?.hospital_id || null;
  const specialityId = userProfile?.speciality_id || null;
  const residentYear = Number(userProfile?.resident_year) || null;

  const [loading, setLoading] = useState(false);
  const [reminders, setReminders] = useState({ forMe: 0, overdue: 0 });
  const [wellbeingDue, setWellbeingDue] = useState(false);
  const [missingPayout, setMissingPayout] = useState(null);
  const [libroProgress, setLibroProgress] = useState(null);
  const [grossEur, setGrossEur] = useState(null);

  const load = useCallback(async () => {
    if (!userId || !isResident) {
      setReminders({ forMe: 0, overdue: 0 });
      setWellbeingDue(false);
      setMissingPayout(null);
      setLibroProgress(null);
      setGrossEur(null);
      return;
    }

    const now = new Date();
    setLoading(true);

    const loadReminders = async () => {
      if (!hospitalId || !specialityId) return { forMe: 0, overdue: 0 };
      const servicioId = await findServicio(hospitalId, specialityId);
      if (!servicioId) return { forMe: 0, overdue: 0 };
      const { forMe } = await getServiceReminders(servicioId, userId);
      return {
        forMe: forMe.length,
        overdue: forMe.filter((row) => daysOverdue(row.fecha) > 0).length,
      };
    };

    const loadWellbeing = async () => {
      const assessments = await getAssessments(userId);
      // Solo se le recuerda a quien ya empezó su seguimiento. A quien nunca ha
      // entrado en Salud mental no se le pone un pendiente permanente en el
      // inicio: la sección no diagnostica ni presiona (ver CONTEXT.md).
      return assessments.length > 0 && isAssessmentDueThisMonth(assessments);
    };

    const loadMissingPayout = async () => {
      const target = lastClosedMonth(now);
      const existing = await getResidentPayoutForMonth(
        userId,
        target.year,
        target.month
      );
      return existing ? null : target;
    };

    const loadLibroProgress = async () => {
      if (!residentYear) return null;
      const { progress } = await getLibroYearOverview(
        userId,
        residentYear,
        residentYear
      );
      return progress;
    };

    const loadGross = async () => {
      const payouts = await getResidentPayoutsByYear(userId, now.getFullYear());
      if (!payouts.length) return null;
      return payouts.reduce((sum, row) => sum + (row.gross_total_eur || 0), 0);
    };

    const settle = async (label, fn, fallback) => {
      try {
        return await fn();
      } catch (error) {
        console.error(`Error loading resident home summary (${label}):`, error);
        return fallback;
      }
    };

    const [
      remindersResult,
      wellbeingResult,
      payoutResult,
      progressResult,
      grossResult,
    ] = await Promise.all([
      settle("recordatorios", loadReminders, { forMe: 0, overdue: 0 }),
      settle("bienestar", loadWellbeing, false),
      settle("nómina", loadMissingPayout, null),
      settle("libro", loadLibroProgress, null),
      settle("neto", loadGross, null),
    ]);

    setReminders(remindersResult);
    setWellbeingDue(wellbeingResult);
    setMissingPayout(payoutResult);
    setLibroProgress(progressResult);
    setGrossEur(grossResult);
    setLoading(false);
  }, [userId, isResident, hospitalId, specialityId, residentYear]);

  useEffect(() => {
    let cancelled = false;
    // `load` ya hace sus propios setState; el flag solo evita dejar el spinner
    // colgado si el perfil cambia a mitad de carga.
    load().finally(() => {
      if (cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Orden de la lista: primero lo que ya se ha pasado de fecha, después lo que
  // el residente tiene que rellenar, y al final los recordatorios suaves.
  const pending = useMemo(() => {
    if (!isResident) return [];

    const items = [];

    if (reminders.overdue > 0) {
      items.push({
        key: "reminders-overdue",
        icon: "clipboard-outline",
        tint: "#FEE4E2",
        color: "#B42318",
        title: "Recordatorios del servicio",
        meta:
          reminders.overdue === 1
            ? "1 vencido"
            : `${reminders.overdue} vencidos`,
        section: "recordatoriosServicio",
        urgent: true,
      });
    }

    const selfAssessmentsPending = teachingModules?.selfAssessments?.pending || 0;
    if (selfAssessmentsPending > 0) {
      items.push({
        key: "self-assessments",
        icon: "create-outline",
        tint: "#FEF3C7",
        color: "#B45309",
        title:
          selfAssessmentsPending === 1
            ? "Autoevaluación anual"
            : "Autoevaluaciones anuales",
        meta:
          selfAssessmentsPending === 1
            ? "Pendiente de enviar"
            : `${selfAssessmentsPending} pendientes de enviar`,
        section: "autoevaluacion",
      });
    }

    const tutoringPending = teachingModules?.tutoring?.pending || 0;
    if (tutoringPending > 0) {
      items.push({
        key: "tutoring",
        icon: "people-outline",
        tint: "#EDE9FE",
        color: "#6D28D9",
        title: tutoringPending === 1 ? "Tutoría" : "Tutorías",
        meta:
          tutoringPending === 1
            ? "Pendiente de completar"
            : `${tutoringPending} pendientes de completar`,
        section: "tutorias",
      });
    }

    if (reminders.overdue === 0 && reminders.forMe > 0) {
      items.push({
        key: "reminders",
        icon: "clipboard-outline",
        tint: "#E0E7FF",
        color: "#4338CA",
        title: "Recordatorios del servicio",
        meta:
          reminders.forMe === 1 ? "1 para ti" : `${reminders.forMe} para ti`,
        section: "recordatoriosServicio",
      });
    }

    if (missingPayout && !payoutBannerVisible) {
      items.push({
        key: "payout",
        icon: "cash-outline",
        tint: "#FFEDD5",
        color: "#C2410C",
        title: `Nómina de ${formatPayoutPeriodLabel(
          missingPayout.year,
          missingPayout.month
        )}`,
        meta: "Sin registrar",
        section: "residentPayoutEntry",
        params: {
          initialYear: missingPayout.year,
          initialMonth: missingPayout.month,
          lockInitialPeriod: true,
        },
      });
    }

    if (wellbeingDue) {
      items.push({
        key: "wellbeing",
        icon: "pulse-outline",
        tint: "#D1FAE5",
        color: "#047857",
        title: "Evaluación de bienestar",
        meta: "Toca este mes",
        section: "mentalHealth",
      });
    }

    return items;
  }, [
    isResident,
    missingPayout,
    payoutBannerVisible,
    reminders,
    teachingModules,
    wellbeingDue,
  ]);

  const year = useMemo(() => {
    const now = new Date();
    const frame = buildYearFrame(userProfile, now);
    return {
      ...frame,
      progress: libroProgress,
      shifts: countResidencyYearShifts(
        agendaEvents,
        frame.residencyYear,
        now
      ),
      grossEur,
    };
  }, [agendaEvents, grossEur, libroProgress, userProfile]);

  return { pending, year, loading, refresh: load };
};

export default useResidentHomeSummary;
