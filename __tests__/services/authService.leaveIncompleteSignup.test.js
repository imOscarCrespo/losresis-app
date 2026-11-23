// Salida del onboarding (Althaia, 2026-11-23): el servidor borra la cuenta
// vacía y la app cierra sesión pase lo que pase.
jest.mock("../../config/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
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
  clearStoredTokens: jest.fn(() => Promise.resolve()),
}));
jest.mock("../../services/filterStorageService", () => ({ clearAllFilters: jest.fn() }));
jest.mock("../../services/userProfileCacheService", () => ({
  cacheUserProfile: jest.fn(),
  clearActiveUserProfileCache: jest.fn(() => Promise.resolve()),
  getCachedUserProfile: jest.fn(),
  syncActiveProfileCacheUser: jest.fn(() => Promise.resolve()),
}));

import { supabase } from "../../config/supabase";
import { clearStoredTokens } from "../../services/biometricService";
import { leaveIncompleteSignup, signOut } from "../../services/authService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("leaveIncompleteSignup", () => {
  it("si el servidor borra la cuenta, cierra solo la sesión local y limpia los tokens", async () => {
    supabase.rpc.mockResolvedValue({ data: "discarded", error: null });

    const result = await leaveIncompleteSignup();

    expect(supabase.rpc).toHaveBeenCalledWith("discard_incomplete_signup");
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(clearStoredTokens).toHaveBeenCalled();
    expect(result).toEqual({ success: true, outcome: "discarded", error: null });
  });

  it("si la cuenta tiene datos, no se borra pero se cierra sesión igual", async () => {
    supabase.rpc.mockResolvedValue({ data: "kept_data", error: null });

    const result = await leaveIncompleteSignup();

    expect(supabase.auth.signOut).toHaveBeenCalledWith(undefined);
    expect(result.outcome).toBe("kept_data");
    expect(result.success).toBe(true);
  });

  it("si la función falla, cierra sesión igual", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await leaveIncompleteSignup();

    expect(supabase.auth.signOut).toHaveBeenCalledWith(undefined);
    expect(result).toEqual({ success: true, outcome: null, error: null });
  });

  it("si la llamada lanza, cierra sesión igual", async () => {
    supabase.rpc.mockRejectedValue(new Error("network"));

    const result = await leaveIncompleteSignup();

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(result.outcome).toBeNull();
  });
});

describe("signOut", () => {
  it("sin opciones mantiene el cierre de sesión por defecto de Supabase", async () => {
    await signOut();
    expect(supabase.auth.signOut).toHaveBeenCalledWith(undefined);
  });
});
