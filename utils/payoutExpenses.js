// Organización de gastos mensuales de una nómina (Trello #113).
// Las cuentas se hacen en céntimos para que los decimales no acumulen errores.

export const PAYOUT_EXPENSE_CATEGORIES = [
  {
    key: "housing_expense_eur",
    label: "Vivienda",
    hint: "Alquiler, suministros...",
    icon: "home-outline",
  },
  {
    key: "food_expense_eur",
    label: "Comida",
    hint: "Supermercado, comida fuera...",
    icon: "restaurant-outline",
  },
  {
    key: "transport_expense_eur",
    label: "Transporte",
    hint: "Abono, gasolina, transporte...",
    icon: "bus-outline",
  },
  {
    key: "leisure_expense_eur",
    label: "Ocio",
    hint: "Planes, viajes, suscripciones...",
    icon: "game-controller-outline",
  },
  {
    key: "other_expense_eur",
    label: "Otros",
    hint: "Ropa, salud, imprevistos...",
    icon: "ellipsis-horizontal",
  },
];

// numeric(10,2) en base de datos: hasta 99.999.999,99 €.
const MAX_EXPENSE_CENTS = 9999999999;

export const toCents = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};

export const centsToEuros = (cents) => cents / 100;

// Acepta "700", "700,5", "700.50" y "1.234,56". Devuelve céntimos,
// 0 para un campo vacío o null si el texto no es un importe válido (o es negativo).
export const parseEuroInputToCents = (text) => {
  const raw = String(text ?? "").replace(/\s|€/g, "");
  if (!raw) return 0;

  let normalized = raw;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;

  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents) || cents > MAX_EXPENSE_CENTS) return null;
  return cents;
};

// Texto inicial de un campo: vacío si es cero, para teclear directamente.
export const formatEuroInput = (value) => {
  const cents = toCents(value);
  if (!cents) return "";
  const euros = centsToEuros(cents);
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2).replace(".", ",");
};

export const buildExpenseSummary = (incomeEur, expenseCentsByKey) => {
  const incomeCents = toCents(incomeEur);
  const expensesCents = PAYOUT_EXPENSE_CATEGORIES.reduce(
    (sum, category) => sum + (expenseCentsByKey[category.key] || 0),
    0
  );
  const remainingCents = incomeCents - expensesCents;

  return {
    incomeEur: centsToEuros(incomeCents),
    expensesEur: centsToEuros(expensesCents),
    remainingEur: centsToEuros(remainingCents),
    isOverBudget: remainingCents < 0,
  };
};

// Enteros sin decimales ("700 €"); con céntimos, siempre dos ("999,80 €", no "999,8 €").
export const formatEuroAmount = (value) => {
  const amount = centsToEuros(toCents(value));
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return amount.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};
