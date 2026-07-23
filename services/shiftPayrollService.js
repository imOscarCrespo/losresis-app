/**
 * Shift Payroll Service
 * Puente entre la agenda (eventos de guardia) y las nóminas del residente:
 * clasifica guardias en las mismas categorías que resident_monthly_payouts
 * (lunes-jueves, viernes, sábado, domingo, festivo) y detecta guardias
 * hechas según la agenda que no aparecen reflejadas en la nómina.
 */

export const SHIFT_CATEGORY_KEYS = [
  "weekday",
  "friday",
  "saturday",
  "sunday",
  "holiday",
];

// Etiquetas en minúscula pensadas para frases ("faltan 2 de sábado").
export const SHIFT_CATEGORY_PHRASE_LABELS = {
  weekday: "de lunes a jueves",
  friday: "de viernes",
  saturday: "de sábado",
  sunday: "de domingo",
  holiday: "en festivo",
};

const CATEGORY_BY_DAY_OF_WEEK = {
  0: "sunday",
  5: "friday",
  6: "saturday",
};

/**
 * Categoría retributiva de una guardia. El festivo lo marca el usuario en el
 * evento (metadata.shift_is_holiday) y prevalece sobre el día de la semana.
 */
export const deriveShiftCategory = (dateString, isHoliday = false) => {
  if (isHoliday) {
    return "holiday";
  }

  const dayOfWeek = new Date(`${dateString}T12:00:00`).getDay();
  return CATEGORY_BY_DAY_OF_WEEK[dayOfWeek] || "weekday";
};

const emptyCounts = () => ({
  weekday: 0,
  friday: 0,
  saturday: 0,
  sunday: 0,
  holiday: 0,
  total: 0,
});

/**
 * Cuenta las guardias de la agenda de un mes por categoría retributiva.
 * @param {Array} agendaEvents - Eventos de agenda_events del usuario
 * @param {number} year - Año del periodo
 * @param {number} month - Mes del periodo (1-12, convención de nóminas)
 */
export const countMonthShiftsByCategory = (agendaEvents, year, month) => {
  const counts = emptyCounts();

  if (!year || !month) {
    return counts;
  }

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;

  (agendaEvents || []).forEach((event) => {
    if (event?.event_type !== "shift" || !event.event_date) {
      return;
    }
    if (!event.event_date.startsWith(monthPrefix)) {
      return;
    }

    const category = deriveShiftCategory(
      event.event_date,
      Boolean(event.metadata?.shift_is_holiday)
    );
    counts[category] += 1;
    counts.total += 1;
  });

  return counts;
};

/**
 * Guardias que según la agenda se hicieron pero la nómina no recoge.
 * Solo señala defecto (nómina < agenda); un exceso en la nómina no es un
 * impago, normalmente es una guardia sin registrar en la agenda.
 * @returns {Array<{key, label, agenda, payout, missing}>}
 */
export const buildPayoutMismatches = (agendaCounts, payoutCounts) => {
  if (!agendaCounts || !payoutCounts) {
    return [];
  }

  return SHIFT_CATEGORY_KEYS.reduce((mismatches, key) => {
    const agenda = Number(agendaCounts[key]) || 0;
    const payout = Number(payoutCounts[key]) || 0;
    if (payout < agenda) {
      mismatches.push({
        key,
        label: SHIFT_CATEGORY_PHRASE_LABELS[key],
        agenda,
        payout,
        missing: agenda - payout,
      });
    }
    return mismatches;
  }, []);
};

/** Resumen legible de un recuento: "2 de lunes a jueves, 1 de sábado". */
export const formatCountsSummary = (counts) => {
  if (!counts) {
    return "";
  }

  return SHIFT_CATEGORY_KEYS.filter((key) => (Number(counts[key]) || 0) > 0)
    .map((key) => `${counts[key]} ${SHIFT_CATEGORY_PHRASE_LABELS[key]}`)
    .join(", ");
};

/** Descripción autogenerada para el campo de pago pendiente de la nómina. */
export const buildPendingPaymentDescription = (mismatches, periodLabel) => {
  if (!mismatches?.length) {
    return "";
  }

  const missingSummary = mismatches
    .map((item) => `${item.missing} ${item.label}`)
    .join(", ");

  return `Guardias de ${periodLabel} sin reflejar en nómina según mi agenda: ${missingSummary}.`;
};
