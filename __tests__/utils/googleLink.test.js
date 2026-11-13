import {
  GOOGLE_LINK_ERRORS,
  hasGoogleIdentity,
  mapGoogleLinkError,
  parseAuthCallbackUrl,
  shouldOfferGoogleLink,
} from "../../utils/googleLink";

const hospitalUser = (over = {}) => ({
  id: "u1",
  identities: [{ provider: "email" }],
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { must_change_password: false },
  ...over,
});

describe("shouldOfferGoogleLink", () => {
  it("se ofrece a quien entra con email y aún no lo ha visto", () => {
    expect(shouldOfferGoogleLink(hospitalUser())).toBe(true);
  });

  it("no se ofrece otra vez si ya se le ofreció (vinculara o no)", () => {
    expect(
      shouldOfferGoogleLink(hospitalUser({ user_metadata: { google_link_offered: true } }))
    ).toBe(false);
  });

  it("no se ofrece a quien ya tiene Google", () => {
    const withIdentity = hospitalUser({
      identities: [{ provider: "email" }, { provider: "google" }],
    });
    const withProvider = hospitalUser({
      identities: undefined,
      app_metadata: { providers: ["email", "google"] },
    });
    expect(hasGoogleIdentity(withIdentity)).toBe(true);
    expect(hasGoogleIdentity(withProvider)).toBe(true);
    expect(shouldOfferGoogleLink(withIdentity)).toBe(false);
    expect(shouldOfferGoogleLink(withProvider)).toBe(false);
  });

  it("sin usuario no se ofrece", () => {
    expect(shouldOfferGoogleLink(null)).toBe(false);
  });
});

describe("parseAuthCallbackUrl", () => {
  it("lee tokens del hash", () => {
    expect(
      parseAuthCallbackUrl("losresis://auth/callback#access_token=a.b&refresh_token=r1&type=x")
    ).toMatchObject({ access_token: "a.b", refresh_token: "r1" });
  });

  it("lee errores de la query y del hash, decodificados", () => {
    expect(
      parseAuthCallbackUrl(
        "losresis://auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user"
      )
    ).toEqual({
      error: "server_error",
      error_code: "identity_already_exists",
      error_description: "Identity is already linked to another user",
    });
    expect(
      parseAuthCallbackUrl("losresis://auth/callback#error=access_denied&error_code=bad%20oauth")
    ).toEqual({ error: "access_denied", error_code: "bad oauth" });
    expect(parseAuthCallbackUrl(null)).toEqual({});
  });
});

describe("mapGoogleLinkError", () => {
  it("cuenta de Google de otro usuario", () => {
    expect(mapGoogleLinkError({ code: "identity_already_exists" })).toBe(
      "Esa cuenta de Google ya está en uso"
    );
    expect(
      mapGoogleLinkError({ error_description: "Identity is already linked to another user" })
    ).toBe(GOOGLE_LINK_ERRORS.alreadyInUse);
  });

  it("vinculación manual desactivada en el proyecto", () => {
    expect(mapGoogleLinkError({ code: "manual_linking_disabled" })).toBe(
      GOOGLE_LINK_ERRORS.disabled
    );
    expect(mapGoogleLinkError({ message: "Manual linking is disabled" })).toBe(
      GOOGLE_LINK_ERRORS.disabled
    );
  });

  it("cualquier otra cosa: genérico", () => {
    expect(mapGoogleLinkError(new Error("Network request failed"))).toBe(
      GOOGLE_LINK_ERRORS.generic
    );
    expect(mapGoogleLinkError(null)).toBe(GOOGLE_LINK_ERRORS.generic);
  });
});
