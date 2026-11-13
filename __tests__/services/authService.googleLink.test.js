// Supabase, el navegador y la caché se mockean en la frontera.
jest.mock("../../config/supabase", () => ({
  supabase: {
    auth: {
      linkIdentity: jest.fn(),
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock("../../services/biometricService", () => ({
  saveTokensSecurely: jest.fn(() => Promise.resolve({ success: true })),
  isBiometricEnabled: jest.fn(() => Promise.resolve(false)),
  clearStoredTokens: jest.fn(),
}));
jest.mock("../../services/filterStorageService", () => ({ clearAllFilters: jest.fn() }));
jest.mock("../../services/userProfileCacheService", () => ({
  cacheUserProfile: jest.fn(),
  clearActiveUserProfileCache: jest.fn(),
  getCachedUserProfile: jest.fn(),
  syncActiveProfileCacheUser: jest.fn(() => Promise.resolve()),
}));

import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../config/supabase";
import { linkGoogleIdentity, markGoogleLinkOffered } from "../../services/authService";

const AUTH_URL = "https://x.supabase.co/auth/v1/user/identities/authorize?provider=google";
const userWith = (providers) => ({
  data: { user: { id: "u1", identities: providers.map((provider) => ({ provider })) } },
  error: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.linkIdentity.mockResolvedValue({
    data: { provider: "google", url: AUTH_URL },
    error: null,
  });
  supabase.auth.setSession.mockResolvedValue({ data: { session: {} }, error: null });
});

describe("linkGoogleIdentity", () => {
  it("abre el navegador integrado con la URL de vinculación y guarda la sesión nueva", async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "losresis://auth/callback#access_token=at&refresh_token=rt",
    });
    supabase.auth.getUser.mockResolvedValue(userWith(["email", "google"]));

    const result = await linkGoogleIdentity();

    expect(supabase.auth.linkIdentity).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "losresis://auth/callback",
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      AUTH_URL,
      "losresis://auth/callback"
    );
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: "at",
      refresh_token: "rt",
    });
    expect(result).toEqual({ success: true, error: null });
  });

  it("vinculación manual desactivada: mensaje amable y sin abrir el navegador", async () => {
    supabase.auth.linkIdentity.mockResolvedValue({
      data: { provider: "google", url: null },
      error: { code: "manual_linking_disabled", message: "Manual linking is disabled" },
    });

    const result = await linkGoogleIdentity();

    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no se puede vincular Google/);
  });

  it("la cuenta de Google ya es de otro usuario", async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "losresis://auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user",
    });

    const result = await linkGoogleIdentity();

    expect(supabase.auth.setSession).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "Esa cuenta de Google ya está en uso" });
  });

  it("si cierra el navegador sin vincular, se considera cancelado (sin error)", async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: "cancel" });
    supabase.auth.getUser.mockResolvedValue(userWith(["email"]));

    expect(await linkGoogleIdentity()).toEqual({
      success: false,
      cancelled: true,
      error: null,
    });
  });

  it("Android: vuelve como «dismiss» pero la vinculación se hizo", async () => {
    WebBrowser.openAuthSessionAsync.mockResolvedValue({ type: "dismiss" });
    supabase.auth.getUser.mockResolvedValue(userWith(["email", "google"]));

    expect(await linkGoogleIdentity()).toEqual({ success: true, error: null });
  });

  it("si algo lanza, devuelve el error genérico", async () => {
    supabase.auth.linkIdentity.mockRejectedValue(new Error("Network request failed"));
    const result = await linkGoogleIdentity();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Inténtalo de nuevo/);
  });
});

describe("markGoogleLinkOffered", () => {
  it("guarda google_link_offered en user_metadata", async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    expect(await markGoogleLinkOffered()).toEqual({ success: true, error: null });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { google_link_offered: true },
    });
  });

  it("si falla no lanza", async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await markGoogleLinkOffered()).toEqual({ success: false, error: "boom" });
  });
});
