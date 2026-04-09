export const RESIDENT_STATE = {
  ACTIVE: "active",
  PENDING_CORPORATE_EMAIL_SEASONAL: "pending_corporate_email_seasonal",
  LOCKED_MISSING_CORPORATE_EMAIL: "locked_missing_corporate_email",
};

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

export const canWriteResidentHospitalReview = (profile, now = new Date()) => {
  if (!profile?.is_resident || profile?.is_super_admin) {
    return Boolean(profile?.is_resident);
  }

  return !isSeasonalResidentPending(profile, now) &&
    !isResidentLockedMissingCorporateEmail(profile, now);
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
