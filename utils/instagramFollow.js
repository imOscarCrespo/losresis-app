// «Síguenos en Instagram» como último paso del primer acceso de un residente
// creado por el hospital (2026-11-19). El onboarding normal ya acaba con este
// paso, pero esas cuentas se lo saltan porque el hospital rellena el perfil.

export const INSTAGRAM_URL = "https://www.instagram.com/losresis/";

// Marca en user_metadata: ya se le enseñó (siguiera o no). No se vuelve a enseñar,
// tampoco cuando el hospital le regenera la contraseña.
export const INSTAGRAM_FOLLOW_OFFERED_KEY = "instagram_follow_offered";

export const shouldOfferInstagramFollow = (user) =>
  Boolean(user?.id) && user?.user_metadata?.[INSTAGRAM_FOLLOW_OFFERED_KEY] !== true;
