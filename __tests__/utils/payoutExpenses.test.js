import {
  PAYOUT_EXPENSE_CATEGORIES,
  adaptPreviousExpenses,
  buildExpenseSummary,
  getPayoutPendingToOrganize,
  getPreviousPayoutPeriod,
  formatEuroAmount,
  formatEuroInput,
  parseEuroInputToCents,
} from "../../utils/payoutExpenses";

// Intl usa espacios no separables entre importe y símbolo; se normalizan para comparar.
const plain = (text) => text.replace(/\s/g, " ");

describe("formatEuroAmount", () => {
  it("muestra los enteros sin decimales", () => {
    expect(plain(formatEuroAmount(700))).toBe("700 €");
  });

  it("muestra siempre dos decimales cuando hay céntimos", () => {
    expect(plain(formatEuroAmount(999.8))).toBe("999,80 €");
    expect(plain(formatEuroAmount(0.3))).toBe("0,30 €");
  });

  it("redondea al céntimo restos de coma flotante", () => {
    expect(plain(formatEuroAmount(0.1 + 0.2))).toBe("0,30 €");
  });
});

const expenses = (...cents) =>
  Object.fromEntries(PAYOUT_EXPENSE_CATEGORIES.map((c, i) => [c.key, cents[i] ?? 0]));

describe("buildExpenseSummary", () => {
  it("calcula gastos y saldo del ejemplo de la tarjeta #113", () => {
    const summary = buildExpenseSummary(3452, expenses(70000, 45000, 12000, 30000, 54200));
    expect(summary).toEqual({
      incomeEur: 3452,
      expensesEur: 2112,
      remainingEur: 1340,
      isOverBudget: false,
    });
  });

  it("con todo a cero deja la nómina entera disponible", () => {
    expect(buildExpenseSummary(3452, expenses()).remainingEur).toBe(3452);
  });

  it("marca el exceso cuando los gastos superan la nómina, también con nómina de 0 €", () => {
    const summary = buildExpenseSummary(0, expenses(1000));
    expect(summary.isOverBudget).toBe(true);
    expect(summary.remainingEur).toBe(-10);
  });

  it("no arrastra errores de coma flotante", () => {
    const summary = buildExpenseSummary(1000.1, expenses(10, 20));
    expect(summary.expensesEur).toBe(0.3);
    expect(summary.remainingEur).toBe(999.8);
  });
});

describe("parseEuroInputToCents", () => {
  it.each([
    ["", 0],
    ["700", 70000],
    ["700,5", 70050],
    ["700.50", 70050],
    ["1.234,56", 123456],
    ["1.234", 123400],
    [" 12 € ", 1200],
    ["99999999,99", 9999999999],
  ])("acepta %p", (input, cents) => {
    expect(parseEuroInputToCents(input)).toBe(cents);
  });

  it.each(["-5", "abc", "1,234", "12,345", "100000000"])("rechaza %p", (input) => {
    expect(parseEuroInputToCents(input)).toBeNull();
  });
});

describe("formatEuroInput", () => {
  it("deja vacío el cero y usa coma decimal", () => {
    expect(formatEuroInput(0)).toBe("");
    expect(formatEuroInput(700)).toBe("700");
    expect(formatEuroInput(700.5)).toBe("700,50");
  });
});

// ClickUp 124b4z9w0da · Organizar nóminas
const row = (...euros) =>
  Object.fromEntries(PAYOUT_EXPENSE_CATEGORIES.map((c, i) => [c.key, euros[i] ?? 0]));
const total = (centsByKey) => Object.values(centsByKey).reduce((a, b) => a + b, 0);

describe("getPreviousPayoutPeriod", () => {
  it("devuelve el mes anterior del mismo año", () => {
    expect(getPreviousPayoutPeriod(2026, 11)).toEqual({ year: 2026, month: 10 });
  });

  it("de enero pasa a diciembre del año anterior", () => {
    expect(getPreviousPayoutPeriod(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("adaptPreviousExpenses", () => {
  it("copia el reparto tal cual si cabe en la nueva nómina", () => {
    const adapted = adaptPreviousExpenses(2900, row(700, 450, 120, 300, 542));
    expect(adapted).toEqual(expenses(70000, 45000, 12000, 30000, 54200));
  });

  it("copia exacto cuando el reparto suma justo el ingreso", () => {
    expect(total(adaptPreviousExpenses(2112, row(700, 450, 120, 300, 542)))).toBe(211200);
  });

  it("escala en proporción para no superar un ingreso menor", () => {
    // 2.000 € repartidos el mes pasado, ahora se cobran 1.000 €: la mitad en cada apartado.
    const adapted = adaptPreviousExpenses(1000, row(800, 600, 200, 300, 100));
    expect(adapted).toEqual(expenses(40000, 30000, 10000, 15000, 5000));
  });

  it("al escalar con céntimos nunca se pasa del ingreso", () => {
    const adapted = adaptPreviousExpenses(999.99, row(333.33, 333.33, 333.34, 500, 0.01));
    expect(total(adapted)).toBeLessThanOrEqual(99999);
    Object.values(adapted).forEach((cents) => expect(Number.isInteger(cents)).toBe(true));
  });

  it("no ofrece nada si el mes anterior no tenía importes o no hay ingreso", () => {
    expect(adaptPreviousExpenses(2900, row(0, 0, 0, 0, 0))).toBeNull();
    expect(adaptPreviousExpenses(0, row(700))).toBeNull();
    expect(adaptPreviousExpenses(2900, null)).toBeNull();
  });

  it("no modifica la fila del mes anterior", () => {
    const previous = row(800, 600, 200, 300, 100);
    const copy = { ...previous };
    adaptPreviousExpenses(1000, previous);
    expect(previous).toEqual(copy);
  });
});

describe("getPayoutPendingToOrganize", () => {
  const payout = (overrides) => ({
    period_year: 2026,
    period_month: 10,
    gross_total_eur: 2340,
    is_expenses_organized: false,
    ...overrides,
  });

  it("enseña el importe real de la última nómina sin organizar", () => {
    expect(getPayoutPendingToOrganize(payout())).toEqual({
      year: 2026,
      month: 10,
      amountEur: 2340,
    });
  });

  it("no sale si la nómina ya está organizada (aunque sobre dinero)", () => {
    expect(getPayoutPendingToOrganize(payout({ is_expenses_organized: true }))).toBeNull();
  });

  it("no sale sin nóminas ni con una nómina de 0 €", () => {
    expect(getPayoutPendingToOrganize(null)).toBeNull();
    expect(getPayoutPendingToOrganize(payout({ gross_total_eur: 0 }))).toBeNull();
  });
});
