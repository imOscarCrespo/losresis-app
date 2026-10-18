import { shouldBypassResidentReviewGate } from "../../utils/residentAccess";

describe("shouldBypassResidentReviewGate · residentes creados por el hospital (#100)", () => {
  const base = { is_resident: true, resident_year: 3, resident_state: "active", work_email: "a@h.es" };

  it("no exige reseña a quien dio de alta su hospital", () => {
    expect(shouldBypassResidentReviewGate({ ...base, created_by_org_id: "org-1" })).toBe(true);
  });

  it("al resto le sigue aplicando la puerta", () => {
    expect(shouldBypassResidentReviewGate({ ...base, created_by_org_id: null })).toBe(false);
    expect(shouldBypassResidentReviewGate(base)).toBe(false);
  });
});
