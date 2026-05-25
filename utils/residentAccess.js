export const RESIDENT_STATE = {
  ACTIVE: "active",
  PENDING_CORPORATE_EMAIL_SEASONAL: "pending_corporate_email_seasonal",
  LOCKED_MISSING_CORPORATE_EMAIL: "locked_missing_corporate_email",
};

// Estado derivado de la validación manual del email corporativo del residente,
// independiente del ciclo seasonal MIR (RESIDENT_STATE).
export const RESIDENT_EMAIL_VALIDATION_STATE = {
  VALIDATED: "validated",
  REVIEW_PENDING: "review_pending",
  REVIEW_REJECTED: "review_rejected",
};

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isResidentTransitionWindowActive = (
  transitionConfig,
  now = new Date()
) => {
  if (!transitionConfig?.enabled) {
    return false;
  }

  const startsAt = normalizeDate(transitionConfig.starts_at);
  const endsAt = normalizeDate(transitionConfig.ends_at);
  const nowDate = normalizeDate(now) || new Date();

  if (!startsAt || !endsAt) {
    return false;
  }

  return startsAt <= nowDate && nowDate <= endsAt;
};

export const canResidentUseSeasonalGrace = (
  profileLike,
  transitionConfig,
  now = new Date()
) => {
  if (!profileLike?.is_resident) {
    return false;
  }

  const targetResidentYear = Number(
    transitionConfig?.target_resident_year || 1
  );
  const residentYear = Number(profileLike?.resident_year || 0);

  return (
    residentYear === targetResidentYear &&
    isResidentTransitionWindowActive(transitionConfig, now)
  );
};

const hasResidentDraftFields = (profileLike) =>
  Boolean(
    profileLike?.hospital_id &&
      profileLike?.speciality_id &&
      profileLike?.resident_year &&
      profileLike?.work_email?.trim()
  );

export const getProfileDraftType = (profileLike) => {
  if (profileLike?.is_host) return "host";
  if (profileLike?.is_resident) return "resident";
  if (hasResidentDraftFields(profileLike)) return "resident";
  if (profileLike?.is_doctor) return "doctor";
  if (profileLike?.is_student) return "student";
  return "";
};

export const hasPendingEmailReviewRequest = (reviewRequest) =>
  reviewRequest?.status === "PENDING";

export const hasApprovedEmailReviewRequest = (reviewRequest) =>
  reviewRequest?.status === "APPROVED";

export const getResidentState = (profile, now = new Date()) => {
  if (!profile?.is_resident) {
    return null;
  }

  const expiresAt = normalizeDate(profile?.resident_transition_expires_at);
  const nowDate = normalizeDate(now) || new Date();
  const rawState = profile?.resident_state || null;

  if (
    rawState === RESIDENT_STATE.PENDING_CORPORATE_EMAIL_SEASONAL &&
    expiresAt &&
    expiresAt < nowDate
  ) {
    return RESIDENT_STATE.LOCKED_MISSING_CORPORATE_EMAIL;
  }

  if (rawState) {
    return rawState;
  }

  if (profile?.work_email?.trim()) {
    return RESIDENT_STATE.ACTIVE;
  }

  return RESIDENT_STATE.LOCKED_MISSING_CORPORATE_EMAIL;
};

export const isSeasonalResidentPending = (profile, now = new Date()) =>
  getResidentState(profile, now) ===
  RESIDENT_STATE.PENDING_CORPORATE_EMAIL_SEASONAL;

export const isResidentLockedMissingCorporateEmail = (
  profile,
  now = new Date()
) =>
  getResidentState(profile, now) ===
  RESIDENT_STATE.LOCKED_MISSING_CORPORATE_EMAIL;

export const hasResidentFeatureAccess = (profile, now = new Date()) =>
  Boolean(
    profile?.is_resident &&
      !isResidentLockedMissingCorporateEmail(profile, now)
  );

export const shouldBypassResidentReviewGate = (profile, now = new Date()) =>
  isSeasonalResidentPending(profile, now);

export const getResidentEmailValidationState = (
  profile,
  emailReviewRequest
) => {
  // No condicionamos por is_resident: el rechazo del email aplica a cualquier
  // usuario que haya pedido revisión, incluso si el código antiguo lo había
  // degradado a no-residente. Esos usuarios deben ser redirigidos a Perfil
  // para arreglar el email.
  const status = emailReviewRequest?.status;

  if (status === "PENDING") {
    return RESIDENT_EMAIL_VALIDATION_STATE.REVIEW_PENDING;
  }

  if (status === "REJECTED") {
    const rejectedEmail = normalizeEmail(emailReviewRequest?.work_email);
    const currentEmail = normalizeEmail(profile?.work_email);
    // Si el usuario ya cambió el email tras el rechazo, el rechazo deja de
    // aplicar: lo consideramos validado (o re-validable con nueva solicitud).
    if (rejectedEmail && currentEmail && rejectedEmail !== currentEmail) {
      return RESIDENT_EMAIL_VALIDATION_STATE.VALIDATED;
    }
    return RESIDENT_EMAIL_VALIDATION_STATE.REVIEW_REJECTED;
  }

  return RESIDENT_EMAIL_VALIDATION_STATE.VALIDATED;
};

export const isResidentEmailReviewPending = (profile, emailReviewRequest) =>
  getResidentEmailValidationState(profile, emailReviewRequest) ===
  RESIDENT_EMAIL_VALIDATION_STATE.REVIEW_PENDING;

export const isResidentEmailReviewRejected = (profile, emailReviewRequest) =>
  getResidentEmailValidationState(profile, emailReviewRequest) ===
  RESIDENT_EMAIL_VALIDATION_STATE.REVIEW_REJECTED;

const hasAnyActiveRoleInProfile = (profile) =>
  Boolean(
    profile?.is_resident ||
      profile?.is_student ||
      profile?.is_doctor ||
      profile?.is_host ||
      profile?.is_super_admin
  );

// Decisión de policy para forzar la redirección a ProfileScreen tras un
// rechazo de email. Aplicable a:
//   - Residentes activos: necesitan el email para crear reseñas/rotaciones.
//   - Usuarios sin rol activo (legacy del código antiguo que degradaba al
//     pedir revisión): están en limbo y deben arreglar el perfil.
// NO se aplica a estudiantes/doctores/hosts felices con su rol: el rechazo
// es histórico y no les bloquea ninguna funcionalidad de su rol actual.
export const shouldRedirectForEmailReviewRejection = (
  profile,
  emailReviewRequest
) => {
  if (!isResidentEmailReviewRejected(profile, emailReviewRequest)) return false;
  if (profile?.is_resident) return true;
  return !hasAnyActiveRoleInProfile(profile);
};

export const canWriteResidentHospitalReview = (
  profile,
  { emailReviewRequest = null, now = new Date() } = {}
) => {
  if (!profile?.is_resident || profile?.is_super_admin) {
    return Boolean(profile?.is_resident);
  }

  // Mientras la solicitud de revisión manual del email corporativo esté
  // pendiente o haya sido rechazada, no permitimos publicar reseña: aún no
  // hemos validado al residente contra el hospital.
  const validationState = getResidentEmailValidationState(
    profile,
    emailReviewRequest
  );
  if (
    validationState === RESIDENT_EMAIL_VALIDATION_STATE.REVIEW_PENDING ||
    validationState === RESIDENT_EMAIL_VALIDATION_STATE.REVIEW_REJECTED
  ) {
    return false;
  }

  return !isSeasonalResidentPending(profile, now) &&
    !isResidentLockedMissingCorporateEmail(profile, now);
};

// Gating de creación/publicación en Rotaciones Externas. Para residentes,
// misma política que reseña de hospital (cualquier estado distinto de
// VALIDATED lo bloquea). Para otros perfiles con acceso a la feature
// (doctores, super_admin), no aplica la validación de email del residente.
export const canResidentCreateExternalRotation = (
  profile,
  { emailReviewRequest = null, now = new Date() } = {}
) => {
  if (!profile) return false;
  if (profile.is_super_admin) return true;
  if (profile.is_resident) {
    return canWriteResidentHospitalReview(profile, { emailReviewRequest, now });
  }
  if (profile.is_doctor) return true;
  return false;
};

export const needsResidentCorporateEmail = (profile, now = new Date()) => {
  if (!profile?.is_resident) {
    return false;
  }

  return getResidentState(profile, now) !== RESIDENT_STATE.ACTIVE;
};

export const formatResidentTransitionDeadline = (value) => {
  const date = normalizeDate(value);
  if (!date) return "";

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};
