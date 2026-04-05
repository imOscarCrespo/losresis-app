import { supabase } from "../config/supabase";

const TABLE_NAME = "resident_monthly_payouts";

export const PAYOUT_MONTH_LABELS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export const PAYOUT_MONTH_LABELS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePayout = (row) => {
  if (!row) return null;

  const weekdayGuardCount = toNumber(
    row.weekday_guard_count ?? row.guard_count ?? 0
  );
  const fridayGuardCount = toNumber(row.friday_guard_count);
  const saturdayGuardCount = toNumber(row.saturday_guard_count);
  const sundayGuardCount = toNumber(row.sunday_guard_count);
  const holidayGuardCount = toNumber(row.holiday_guard_count);
  const totalGuardCount =
    weekdayGuardCount +
    fridayGuardCount +
    saturdayGuardCount +
    sundayGuardCount +
    holidayGuardCount;

  return {
    ...row,
    gross_total_eur: toNumber(row.gross_total_eur),
    guard_count: totalGuardCount,
    friday_guard_count: fridayGuardCount,
    holiday_guard_count: holidayGuardCount,
    strike_count: toNumber(row.strike_count),
    pending_payment_description: row.pending_payment_description ?? "",
    period_month: toNumber(row.period_month),
    period_year: toNumber(row.period_year),
    saturday_guard_count: saturdayGuardCount,
    sunday_guard_count: sundayGuardCount,
    weekday_guard_count: weekdayGuardCount,
  };
};

export const getPayoutMonthLabel = (month, format = "short") => {
  const labels =
    format === "long" ? PAYOUT_MONTH_LABELS_LONG : PAYOUT_MONTH_LABELS_SHORT;
  return labels[Number(month) - 1] || "";
};

export const formatPayoutPeriodLabel = (year, month, format = "long") => {
  const monthLabel = getPayoutMonthLabel(month, format);
  return monthLabel ? `${monthLabel} ${year}` : String(year || "");
};

export const getCurrentPayoutReminderTargetDate = (now = new Date()) => {
  const referenceDate = new Date(now);
  referenceDate.setHours(12, 0, 0, 0);

  const day = referenceDate.getDate();
  if (day >= 28) {
    return {
      year: referenceDate.getFullYear(),
      month: referenceDate.getMonth() + 1,
    };
  }

  if (day <= 3) {
    const previousMonth = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - 1,
      1
    );
    return {
      year: previousMonth.getFullYear(),
      month: previousMonth.getMonth() + 1,
    };
  }

  return null;
};

export const shouldShowPayoutReminder = ({
  userProfile,
  existingRecord,
  now = new Date(),
}) => {
  if (!userProfile?.is_resident) {
    return false;
  }

  const targetDate = getCurrentPayoutReminderTargetDate(now);
  if (!targetDate) {
    return false;
  }

  return !existingRecord;
};

export const getResidentPayoutsByYear = async (userId, year) => {
  if (!userId || !year) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("user_id", userId)
    .eq("period_year", year)
    .order("period_month", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizePayout);
};

export const getResidentPayoutForMonth = async (userId, year, month) => {
  if (!userId || !year || !month) {
    return null;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("user_id", userId)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizePayout(data);
};

export const upsertResidentPayout = async (payload) => {
  const weekdayGuardCount = toNumber(payload.weekday_guard_count);
  const fridayGuardCount = toNumber(payload.friday_guard_count);
  const saturdayGuardCount = toNumber(payload.saturday_guard_count);
  const sundayGuardCount = toNumber(payload.sunday_guard_count);
  const holidayGuardCount = toNumber(payload.holiday_guard_count);
  const guardCount =
    weekdayGuardCount +
    fridayGuardCount +
    saturdayGuardCount +
    sundayGuardCount +
    holidayGuardCount;

  const payoutPayload = {
    user_id: payload.user_id,
    period_year: toNumber(payload.period_year),
    period_month: toNumber(payload.period_month),
    gross_total_eur: toNumber(payload.gross_total_eur),
    guard_count: guardCount,
    weekday_guard_count: weekdayGuardCount,
    friday_guard_count: fridayGuardCount,
    saturday_guard_count: saturdayGuardCount,
    sunday_guard_count: sundayGuardCount,
    holiday_guard_count: holidayGuardCount,
    strike_count: toNumber(payload.strike_count),
    has_double_pay: Boolean(payload.has_double_pay),
    has_pending_payment: Boolean(payload.has_pending_payment),
    pending_payment_description: payload.has_pending_payment
      ? String(payload.pending_payment_description || "").trim() || null
      : null,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(payoutPayload, {
      onConflict: "user_id,period_year,period_month",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizePayout(data);
};

export const buildPayoutChartData = (rows = []) => {
  const amountByMonth = new Map(
    rows.map((row) => [Number(row.period_month), toNumber(row.gross_total_eur)])
  );

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return {
      month,
      label: getPayoutMonthLabel(month, "short"),
      total: amountByMonth.get(month) || 0,
    };
  });
};
