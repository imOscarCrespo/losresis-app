import {
  MIN_PASSWORD_LENGTH,
  isHospitalCreatedResident,
  mapPasswordSignInError,
  mustChangePassword,
  validateHospitalAccessForm,
  validateNewPassword,
} from "../../utils/passwordAccess";

describe("mustChangePassword", () => {
  it("solo con la marca que pone el panel", () => {
    expect(mustChangePassword({ user_metadata: { must_change_password: true } })).toBe(true);
    expect(mustChangePassword({ user_metadata: { must_change_password: false } })).toBe(false);
    expect(mustChangePassword({ user_metadata: {} })).toBe(false);
    expect(mustChangePassword(null)).toBe(false);
  });

  it("un usuario de Google/Apple nunca tiene que cambiarla", () => {
    expect(
      mustChangePassword({ app_metadata: { provider: "google" }, user_metadata: { name: "Ana" } })
    ).toBe(false);
  });
});

describe("validateNewPassword", () => {
  it("exige el mínimo del panel (8)", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(validateNewPassword("1234567", "1234567")).toMatch(/8 caracteres/);
    expect(validateNewPassword("12345678", "12345678")).toBeNull();
  });

  it("las dos contraseñas tienen que coincidir", () => {
    expect(validateNewPassword("12345678", "12345679")).toMatch(/no coinciden/);
  });

  it("no cuenta los espacios de los extremos como caracteres", () => {
    expect(validateNewPassword("   1234   ", "   1234   ")).toMatch(/8 caracteres/);
  });
});

describe("validateHospitalAccessForm", () => {
  it("pide email válido y contraseña", () => {
    expect(validateHospitalAccessForm("", "x")).toMatch(/email/);
    expect(validateHospitalAccessForm("laia@", "x")).toMatch(/email/);
    expect(validateHospitalAccessForm("laia@hospital.cat", "")).toMatch(/contraseña/);
    expect(validateHospitalAccessForm(" laia@hospital.cat ", "abc")).toBeNull();
  });
});

describe("mapPasswordSignInError", () => {
  it("credenciales incorrectas en español y sin pistas de qué falló", () => {
    expect(mapPasswordSignInError({ message: "Invalid login credentials" })).toBe(
      "Email o contraseña incorrectos. Si no la recuerdas, pide a tu hospital que la regenere."
    );
  });

  it("cuenta desactivada", () => {
    expect(mapPasswordSignInError({ message: "User is banned" })).toMatch(/desactivado/);
  });

  it("cualquier otro error, mensaje genérico", () => {
    expect(mapPasswordSignInError({ message: "fetch failed" })).toMatch(/No se pudo iniciar sesión/);
    expect(mapPasswordSignInError(null)).toMatch(/No se pudo iniciar sesión/);
  });
});

describe("isHospitalCreatedResident", () => {
  it("solo residentes marcados por el panel", () => {
    expect(isHospitalCreatedResident({ is_resident: true, created_by_org_id: "org-1" })).toBe(true);
    expect(isHospitalCreatedResident({ is_resident: true, created_by_org_id: null })).toBe(false);
    expect(isHospitalCreatedResident({ is_resident: false, created_by_org_id: "org-1" })).toBe(false);
    expect(isHospitalCreatedResident(null)).toBe(false);
  });
});
