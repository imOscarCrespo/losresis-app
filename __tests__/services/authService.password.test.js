// Supabase y los servicios de caché/biometría se mockean en la frontera.
jest.mock("../../config/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
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
  isBiometricEnabled: jest.fn(() => Promise.resolve(true)),
  clearStoredTokens: jest.fn(),
}));
jest.mock("../../services/filterStorageService", () => ({ clearAllFilters: jest.fn() }));
jest.mock("../../services/userProfileCacheService", () => ({
  cacheUserProfile: jest.fn(),
  clearActiveUserProfileCache: jest.fn(),
  getCachedUserProfile: jest.fn(),
  syncActiveProfileCacheUser: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../config/supabase";
import { saveTokensSecurely } from "../../services/biometricService";
import { signInWithHospitalAccess, updatePassword } from "../../services/authService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("signInWithHospitalAccess", () => {
  it("normaliza el email y guarda la sesión como el login con Google/Apple", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        session: { user: { id: "u1" }, access_token: "a", refresh_token: "r" },
      },
      error: null,
    });

    const result = await signInWithHospitalAccess(" Laia@Hospital.CAT ", "secreta123");

    expect(result).toEqual({ success: true, error: null });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "laia@hospital.cat",
      password: "secreta123",
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("@losresis:userId", "u1");
    expect(saveTokensSecurely).toHaveBeenCalledWith("a", "r");
  });

  it("credenciales incorrectas: mensaje en español y no guarda nada", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await signInWithHospitalAccess("laia@hospital.cat", "mal");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/incorrectos/);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("si la red falla no revienta", async () => {
    supabase.auth.signInWithPassword.mockRejectedValue(new Error("fetch failed"));
    const result = await signInWithHospitalAccess("laia@hospital.cat", "x");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No se pudo iniciar sesión/);
  });
});

describe("updatePassword", () => {
  it("cambia la contraseña y quita la marca de provisional en la misma llamada", async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });

    const result = await updatePassword("nueva12345");

    expect(result).toEqual({ success: true, error: null });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "nueva12345",
      data: { must_change_password: false },
    });
  });

  it("repetir la provisional da un mensaje claro", async () => {
    supabase.auth.updateUser.mockResolvedValue({
      data: null,
      error: { message: "New password should be different from the old password." },
    });
    const result = await updatePassword("provisional");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/distinta de la provisional/);
  });

  it("cualquier otro error, mensaje genérico", async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await updatePassword("nueva12345");
    expect(result).toEqual({
      success: false,
      error: "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
    });
  });
});
