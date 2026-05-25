import { canResidentUseSeasonalGrace } from "./residentAccess";

/**
 * Utilidades para validación del perfil de usuario
 */

/**
 * Valida los campos requeridos del formulario de perfil
 * @param {object} formData - Datos del formulario
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validateProfileForm = (
  formData,
  { residentTransitionConfig = null } = {}
) => {
  // Validar que se haya seleccionado un tipo de usuario
  if (
    !formData.is_student &&
    !formData.is_resident &&
    !formData.is_doctor &&
    !formData.is_host
  ) {
    return {
      isValid: false,
      error: "Por favor, selecciona un tipo de usuario.",
    };
  }

  if (!formData.city?.trim()) {
    return {
      isValid: false,
      error: "Por favor, selecciona tu ciudad.",
    };
  }

  if (formData.is_resident && !formData.resident_year) {
    return {
      isValid: false,
      error: "Por favor, selecciona tu año de residencia.",
    };
  }

  if (formData.is_resident && !formData.work_email?.trim()) {
    const canUseSeasonalGrace = canResidentUseSeasonalGrace(
      formData,
      residentTransitionConfig
    );

    if (!canUseSeasonalGrace) {
      return {
        isValid: false,
        error:
          "Necesitas tu correo corporativo para activar el perfil de residente fuera de la ventana temporal MIR.",
      };
    }
  }

  return { isValid: true };
};

/**
 * Valida si el email de trabajo requiere revisión manual
 * @param {object} formData - Datos del formulario
 * @param {object} emailValidation - Resultado de la validación de email
 * @returns {boolean}
 */
export const shouldShowEmailReview = (formData, emailValidation) => {
  // Si el email es un dominio personal (gmail, hotmail, etc.) no ofrecemos
  // revisión manual: lo vamos a rechazar siempre, así que es mejor pedir al
  // usuario que introduzca su correo corporativo del hospital directamente.
  if (emailValidation?.isPersonalDomain) return false;

  return (
    formData.is_resident &&
    !emailValidation.isValid &&
    formData.work_email &&
    formData.hospital_id
  );
};

/**
 * Determina si un residente R1 en periodo de gracia puede continuar aunque
 * el email corporativo no coincida con el hospital, descartando ese email.
 * @param {object} formData - Datos del formulario
 * @param {object} emailValidation - Resultado de la validación de email
 * @param {object|null} residentTransitionConfig - Configuración de transición MIR
 * @returns {boolean}
 */
export const shouldDiscardInvalidWorkEmailDuringGrace = (
  formData,
  emailValidation,
  residentTransitionConfig = null
) => {
  // Durante la gracia MIR R1 el correo corporativo es opcional: si el
  // residente no lo tiene aún (típico de R1 recién hecho), aceptamos que
  // continúe sin email. Por eso, cuando estamos en gracia, descartamos
  // SILENCIOSAMENTE cualquier email inválido — incluidos los dominios
  // personales (gmail/hotmail/...) — y guardamos work_email = null. El
  // chequeo de dominio personal solo bloquea fuera de la gracia.
  return Boolean(
    formData?.is_resident &&
      formData?.work_email?.trim() &&
      formData?.hospital_id &&
      emailValidation &&
      emailValidation.isValid === false &&
      canResidentUseSeasonalGrace(formData, residentTransitionConfig)
  );
};
