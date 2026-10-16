import {
  PAYOUT_EXPENSE_CATEGORIES,
  buildExpenseSummary,
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
