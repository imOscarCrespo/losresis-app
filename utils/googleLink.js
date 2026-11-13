// Vincular Google a una cuenta creada por el hospital (petición del Hospital
// de Manresa, 2026-11-13). Tras el primer login con la contraseña provisional
// y el cambio de contraseña, la app ofrece una sola vez «Vincular con Google»
// para que la próxima vez entre con Google. Lógica pura; la llamada a Supabase
// está en services/authService.js (`linkGoogleIdentity`).

// Marca en user_metadata: ya se le ofreció (vinculara o no). No se vuelve a enseñar.
export const GOOGLE_LINK_OFFERED_KEY = "google_link_offered";

export const hasGoogleIdentity = (user) => {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  if (identities.some((identity) => identity?.provider === "google")) return true;
  const providers = user?.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("google");
};

export const shouldOfferGoogleLink = (user) =>
  Boolean(user?.id) &&
  user?.user_metadata?.[GOOGLE_LINK_OFFERED_KEY] !== true &&
  !hasGoogleIdentity(user);

/**
 * Parámetros de la URL a la que vuelve Supabase (`losresis://auth/callback`):
 * los de la query y los del hash juntos (el flujo implícito deja los tokens en
 * el hash; los errores pueden venir en cualquiera de los dos).
 */
export const parseAuthCallbackUrl = (url) => {
  const params = {};
  const text = String(url || "");
  const read = (part) => {
    if (!part) return;
    part.split("&").forEach((pair) => {
      const index = pair.indexOf("=");
      if (index <= 0) return;
      const key = pair.slice(0, index);
      const raw = pair.slice(index + 1).replace(/\+/g, " ");
      try {
        params[key] = decodeURIComponent(raw);
      } catch {
        params[key] = raw;
      }
    });
  };
  const hashIndex = text.indexOf("#");
  const beforeHash = hashIndex === -1 ? text : text.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  if (queryIndex !== -1) read(beforeHash.slice(queryIndex + 1));
  if (hashIndex !== -1) read(text.slice(hashIndex + 1));
  return params;
};

export const GOOGLE_LINK_ERRORS = {
  alreadyInUse: "Esa cuenta de Google ya está en uso",
  disabled:
    "Ahora mismo no se puede vincular Google. Puedes seguir entrando con tu email y tu contraseña.",
  generic: "No se pudo vincular tu cuenta de Google. Inténtalo de nuevo.",
};

/**
 * Traduce el error de `linkIdentity` o de la vuelta del navegador. Acepta un
 * AuthError (`code`, `message`) o los parámetros del callback (`error_code`,
 * `error_description`).
 */
export const mapGoogleLinkError = (error) => {
  const code = String(error?.code || error?.error_code || "").toLowerCase();
  const message = String(
    error?.message || error?.error_description || error?.error || ""
  ).toLowerCase();

  if (
    code === "identity_already_exists" ||
    message.includes("already linked") ||
    message.includes("identity already exists")
  ) {
    return GOOGLE_LINK_ERRORS.alreadyInUse;
  }
  if (code === "manual_linking_disabled" || message.includes("manual linking")) {
    return GOOGLE_LINK_ERRORS.disabled;
  }
  return GOOGLE_LINK_ERRORS.generic;
};
