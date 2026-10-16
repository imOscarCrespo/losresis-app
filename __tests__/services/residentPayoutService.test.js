// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder y la respuesta final ({ data, error }) la decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { response: { data: null, error: null } };
  ["from", "select", "eq", "order", "update", "upsert"].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.single = jest.fn(() => Promise.resolve(builder.response));
  builder.maybeSingle = jest.fn(() => Promise.resolve(builder.response));
  return { supabase: builder };
});

const { supabase: mockBuilder } = jest.requireMock("../../config/supabase");
const mockResponse = {
  set current(value) {
    mockBuilder.response = value;
  },
};

import {
  getResidentPayoutForMonth,
  saveResidentPayoutExpenses,
  upsertResidentPayout,
} from "../../services/residentPayoutService";

const EXPENSE_COLUMNS = [
  "housing_expense_eur",
  "food_expense_eur",
  "transport_expense_eur",
  "leisure_expense_eur",
  "other_expense_eur",
  "expenses_organized_at",
];

beforeEach(() => {
  jest.clearAllMocks();
  mockResponse.current = { data: null, error: null };
});

describe("upsertResidentPayout", () => {
  it("no envía columnas de gastos, así que editar la nómina no los pisa", async () => {
    mockResponse.current = { data: { id: "p1", gross_total_eur: "3600" }, error: null };

    await upsertResidentPayout({
      user_id: "u1",
      period_year: 2026,
      period_month: 9,
      gross_total_eur: 3600,
    });

    const payload = mockBuilder.upsert.mock.calls[0][0];
    EXPENSE_COLUMNS.forEach((column) => expect(payload).not.toHaveProperty(column));
  });
});

describe("saveResidentPayoutExpenses", () => {
  it("actualiza solo los gastos de la nómina del propio usuario", async () => {
    mockResponse.current = {
      data: { id: "p1", housing_expense_eur: "700", expenses_organized_at: "2026-10-16T10:00:00Z" },
      error: null,
    };

    const result = await saveResidentPayoutExpenses({
      payoutId: "p1",
      userId: "u1",
      expensesEurByKey: { housing_expense_eur: 700, food_expense_eur: 450.5 },
    });

    const payload = mockBuilder.update.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([...EXPENSE_COLUMNS].sort());
    expect(payload).toMatchObject({
      housing_expense_eur: 700,
      food_expense_eur: 450.5,
      transport_expense_eur: 0,
    });
    expect(mockBuilder.eq).toHaveBeenCalledWith("id", "p1");
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(result.housing_expense_eur).toBe(700);
    expect(result.is_expenses_organized).toBe(true);
  });

  it("propaga el error para no dar por guardado lo que no se guardó", async () => {
    mockResponse.current = { data: null, error: new Error("Network request failed") };

    await expect(
      saveResidentPayoutExpenses({ payoutId: "p1", userId: "u1", expensesEurByKey: {} })
    ).rejects.toThrow("Network request failed");
  });
});

describe("getResidentPayoutForMonth", () => {
  it("distingue un mes nunca organizado aunque las columnas aún no existan", async () => {
    mockResponse.current = { data: { id: "p1", gross_total_eur: "3452" }, error: null };

    const row = await getResidentPayoutForMonth("u1", 2026, 9);

    expect(row.is_expenses_organized).toBe(false);
    expect(row.housing_expense_eur).toBe(0);
    expect(row.gross_total_eur).toBe(3452);
  });
});
