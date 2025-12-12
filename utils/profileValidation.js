/**
 * Utilidades para validación del perfil de usuario
 */

/**
 * Valida los campos requeridos del formulario de perfil
 * @param {object} formData - Datos del formulario
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validateProfileForm = (formData) => {
  // Validar que se haya seleccionado un tipo de usuario
  if (!formData.is_student && !formData.is_resident && !formData.is_doctor) {
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

  return { isValid: true };
};

/**
 * Valida si el email de trabajo requiere revisión manual
 * @param {object} formData - Datos del formulario
 * @param {object} emailValidation - Resultado de la validación de email
 * @returns {boolean}
 */
export const shouldShowEmailReview = (formData, emailValidation) => {
  return (
    formData.is_resident &&
    !emailValidation.isValid &&
    formData.work_email &&
    formData.hospital_id
  );
};
