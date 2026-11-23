// Fusión de una cuenta propia con el acceso del hospital (Althaia, 2026-11-23).
jest.mock("../../config/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock("../../services/authService", () => ({
  signInWithHospitalAccess: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = {};
  return {
    setItem: jest.fn((k, v) => {
      store[k] = v;
      return Promise.resolve();
    }),
    getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
    removeItem: jest.fn((k) => {
      delete store[k];
      return Promise.resolve();
    }),
  };
});

import { supabase } from "../../config/supabase";
import { signInWithHospitalAccess } from "../../services/authService";
import {
  MERGE_ERRORS,
  checkHospitalAccess,
  clearPendingHospitalMerge,
  getPendingHospitalMerge,
  mergeIntoHospitalAccess,
  setPendingHospitalMerge,
} from "../../services/accountMergeService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("checkHospitalAccess", () => {
  it("devuelve si existe el acceso y el nombre de la organización", async () => {
    supabase.rpc.mockResolvedValue({ data: { exists: true, org_name: "Althaia" }, error: null });
    await expect(checkHospitalAccess(" anisa@althaia.cat ")).resolves.toEqual({
      exists: true,
      orgName: "Althaia",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("hospital_access_for_email", {
      p_email: "anisa@althaia.cat",
    });
  });

  it("sin email no pregunta al servidor", async () => {
    await expect(checkHospitalAccess("  ")).resolves.toEqual({ exists: false, orgName: null });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("si el servidor falla no bloquea el guardado", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(checkHospitalAccess("a@b.es")).resolves.toEqual({ exists: false, orgName: null });
  });
});

describe("mergeIntoHospitalAccess", () => {
  it("si se unen, entra en el acceso del hospital con su email y contraseña", async () => {
    supabase.rpc.mockResolvedValue({ data: { status: "merged" }, error: null });
    signInWithHospitalAccess.mockResolvedValue({ success: true, error: null });

    const result = await mergeIntoHospitalAccess(" DKoumba@ICS.cat ", "Secreta-1");

    expect(supabase.rpc).toHaveBeenCalledWith("merge_into_hospital_access", {
      p_email: "dkoumba@ics.cat",
      p_password: "Secreta-1",
    });
    expect(signInWithHospitalAccess).toHaveBeenCalledWith("dkoumba@ics.cat", "Secreta-1");
    expect(result).toEqual({ success: true, status: "merged", error: null });
  });

  it.each(["invalid_password", "too_many_attempts", "conflict", "not_found"])(
    "%s: no entra y explica qué pasa",
    async (status) => {
      supabase.rpc.mockResolvedValue({ data: { status }, error: null });
      const result = await mergeIntoHospitalAccess("a@b.es", "x");
      expect(signInWithHospitalAccess).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, status, error: MERGE_ERRORS[status] });
    }
  );

  it("si la fusión sale pero el login falla, avisa de que ya están unidas", async () => {
    supabase.rpc.mockResolvedValue({ data: { status: "merged" }, error: null });
    signInWithHospitalAccess.mockResolvedValue({ success: false, error: "red" });
    const result = await mergeIntoHospitalAccess("a@b.es", "x");
    expect(result.status).toBe("merged_sign_in_failed");
    expect(result.error).toMatch(/ya están unidas/);
  });

  it("error del servidor: mensaje genérico", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await mergeIntoHospitalAccess("a@b.es", "x");
    expect(result).toEqual({ success: false, status: "error", error: MERGE_ERRORS.generic });
  });
});

describe("fusión pendiente (caso «Vincular Google»)", () => {
  it("guarda el email del hospital y lo devuelve normalizado", async () => {
    await setPendingHospitalMerge(" AperAzo@Althaia.cat ");
    await expect(getPendingHospitalMerge()).resolves.toMatchObject({ email: "aperazo@althaia.cat" });
    await clearPendingHospitalMerge();
    await expect(getPendingHospitalMerge()).resolves.toBeNull();
  });

  it("caduca al día", async () => {
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);
    await setPendingHospitalMerge("a@b.es");
    Date.now.mockReturnValue(now + 25 * 60 * 60 * 1000);
    await expect(getPendingHospitalMerge()).resolves.toBeNull();
    Date.now.mockRestore();
  });
});
