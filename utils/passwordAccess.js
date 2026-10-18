// Acceso con email + contraseña para residentes cuya cuenta crea su hospital
// desde el panel (Trello #100, panel ADR 0037). Google/Apple sigue siendo la
// vía normal; esta solo existe para esas cuentas.

// Mismo mínimo que el panel en sus cuatro formularios de contraseña.
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El panel pone la marca al crear el acceso y al regenerar la contraseña; la
// app la limpia cuando el residente elige la suya.
export const mustChangePassword = (user) =>
  user?.user_metadata?.must_change_password === true;

export const isHospitalCreatedResident = (profile) =>
  Boolean(profile?.is_resident && profile?.created_by_org_id);

export const validateHospitalAccessForm = (email, password) => {
  if (!EMAIL_PATTERN.test(String(email || "").trim())) {
    return "Escribe el email corporativo que te ha dado tu hospital.";
  }
  if (!password) {
    return "Escribe tu contraseña.";
  }
  return null;
};

export const validateNewPassword = (password, confirmation) => {
  if (String(password || "").trim().length < MIN_PASSWORD_LENGTH) {
    return `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== confirmation) {
    return "Las contraseñas no coinciden.";
  }
  return null;
};

export const mapPasswordSignInError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos. Si no la recuerdas, pide a tu hospital que la regenere.";
  }
  if (message.includes("banned")) {
    return "Tu acceso está desactivado. Habla con tu hospital.";
  }
  return "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.";
};
