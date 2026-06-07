// Lógica pura de presentación para la cabecera de "Mi perfil" (vista tipo
// LinkedIn). No toca Supabase ni catálogos: recibe el perfil y los nombres ya
// resueltos, y devuelve copy/estado listos para pintar. Así es trivial de
// testear y sobrevive a refactors de la UI.
import {
  RESIDENT_STATE,
  RESIDENT_EMAIL_VALIDATION_STATE,
  getProfileDraftType,
  getResidentState,
  getResidentEmailValidationState,
} from "./residentAccess";

// Indica si la línea "{x} conexiones" debe mostrarse para este perfil.
// Las conexiones son exclusivas de residentes (ver CONTEXT.md → Conexión).
export const shouldShowConnectionsLine = (profile) =>
  Boolean(profile?.is_resident);

const residentYearLabel = (residentYear) => {
  const n = parseInt(residentYear, 10);
  return Number.isFinite(n) && n > 0 ? `R${n}` : null;
};

// Construye la frase clínica/profesional bajo el nombre. Omite las piezas que
// falten en vez de mostrar conectores colgando o "R undefined".
//
// resolved: { specialityName, hospitalName, academyName } (cualquiera puede ser
// null/undefined si el dato no está informado).
export const getProfileRoleLine = (profile, resolved = {}) => {
  const { specialityName, hospitalName, academyName } = resolved;
  const type = getProfileDraftType(profile);

  if (type === "student") {
    const academy = academyName?.trim();
    return academy ? `Estudiante MIR en ${academy}` : "Estudiante MIR";
  }

  if (type === "host") {
    return "Agente inmobiliario";
  }

  if (type === "resident" || type === "doctor") {
    const spec = specialityName?.trim();
    const hosp = hospitalName?.trim();

    let base;
    if (type === "resident") {
      base = residentYearLabel(profile?.resident_year) || "Residente";
    } else {
      base = "Médico";
    }

    if (spec) base += ` de ${spec}`;
    if (hosp) base += ` en ${hosp}`;
    return base;
  }

  return "";
};

// Resuelve el chip de estado del perfil que se muestra bajo el nombre.
// Solo aplica a residentes; el resto de roles no tienen estado que resolver.
// Devuelve null cuando todo está OK (residente verificado/activo): la vista
// queda limpia. Cuando hay algo que resolver devuelve:
//   { key, tone, icon, label, actionable }
// - actionable=true => al pulsar se navega a la pantalla de edición.
//
// Prioridad: revisión manual pendiente > rechazo > acceso temporal > bloqueado.
export const getProfileStatusChip = (
  profile,
  emailReviewRequest,
  { now = new Date(), deadlineLabel = "" } = {}
) => {
  if (!profile?.is_resident) return null;

  const emailState = getResidentEmailValidationState(profile, emailReviewRequest);

  if (emailState === RESIDENT_EMAIL_VALIDATION_STATE.REVIEW_PENDING) {
    return {
      key: "review_pending",
      tone: "pending",
      icon: "time",
      label: "Validando tu correo corporativo",
      actionable: false,
    };
  }

  if (emailState === RESIDENT_EMAIL_VALIDATION_STATE.REVIEW_REJECTED) {
    return {
      key: "review_rejected",
      tone: "danger",
      icon: "alert-circle",
      label: "Correo rechazado · reinténtalo",
      actionable: true,
    };
  }

  const residentState = getResidentState(profile, now);

  if (residentState === RESIDENT_STATE.PENDING_CORPORATE_EMAIL_SEASONAL) {
    return {
      key: "seasonal",
      tone: "info",
      icon: "time",
      label: deadlineLabel
        ? `Acceso temporal · añade tu correo antes del ${deadlineLabel}`
        : "Acceso temporal · añade tu correo corporativo",
      actionable: true,
    };
  }

  if (residentState === RESIDENT_STATE.LOCKED_MISSING_CORPORATE_EMAIL) {
    return {
      key: "locked",
      tone: "warning",
      icon: "mail-open",
      label: "Correo corporativo requerido",
      actionable: true,
    };
  }

  return null;
};

export default {
  shouldShowConnectionsLine,
  getProfileRoleLine,
  getProfileStatusChip,
};
