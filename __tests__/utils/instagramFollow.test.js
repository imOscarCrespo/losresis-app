import {
  INSTAGRAM_FOLLOW_OFFERED_KEY,
  shouldOfferInstagramFollow,
} from "../../utils/instagramFollow";

describe("shouldOfferInstagramFollow", () => {
  it("se ofrece a quien aún no lo ha visto", () => {
    expect(shouldOfferInstagramFollow({ id: "u1", user_metadata: {} })).toBe(true);
    expect(shouldOfferInstagramFollow({ id: "u1" })).toBe(true);
  });

  it("no se repite cuando ya se le enseñó", () => {
    expect(
      shouldOfferInstagramFollow({
        id: "u1",
        user_metadata: { [INSTAGRAM_FOLLOW_OFFERED_KEY]: true },
      })
    ).toBe(false);
  });

  it("sin usuario no se ofrece", () => {
    expect(shouldOfferInstagramFollow(null)).toBe(false);
    expect(shouldOfferInstagramFollow({})).toBe(false);
  });
});
