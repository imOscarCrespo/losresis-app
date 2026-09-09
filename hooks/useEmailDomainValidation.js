import { useState, useCallback } from "react";
import { getHospitalEmailDomains } from "../services/hospitalService";

// Dominios personales/gratuitos que NUNCA pueden ser un correo corporativo
// de hospital. Se rechazan en cliente antes de cualquier otra validación
// para evitar que el usuario solicite revisión manual con un email que ya
// sabemos que vamos a rechazar.
// Se hace match por prefijo (`gmail.` cubre gmail.com, gmail.es, etc.).
const BLOCKED_PERSONAL_EMAIL_DOMAIN_ROOTS = [
  "aol",
  "gmail",
  "gmx",
  "hotmail",
  "icloud",
  "live",
  "mac",
  "me",
  "msn",
  "outlook",
  "proton",
  "protonmail",
  "yahoo",
];

export const isPersonalEmailDomain = (emailOrDomain) => {
  if (!emailOrDomain) return false;
  const value = String(emailOrDomain).toLowerCase().trim();
  const domain = value.includes("@") ? value.split("@")[1] : value;
  if (!domain) return false;
  return BLOCKED_PERSONAL_EMAIL_DOMAIN_ROOTS.some((root) =>
    domain.startsWith(`${root}.`)
  );
};

const PERSONAL_EMAIL_ERROR =
  "Este dominio (gmail, hotmail, yahoo, icloud…) es de uso personal. Necesitamos tu correo corporativo del hospital.";

/**
 * Hook para validar el dominio del email de trabajo contra el hospital seleccionado
 * @returns {Object} { validateEmailDomain, loading }
 */
export const useEmailDomainValidation = () => {
  const [loading, setLoading] = useState(false);

  /**
   * Valida si el dominio del email de trabajo coincide con los dominios permitidos del hospital
   * @param {string} workEmail - Email de trabajo a validar
   * @param {string} hospitalId - ID del hospital seleccionado
   * @returns {Promise<{ isValid: boolean; error?: string; isPersonalDomain?: boolean }>}
   */
  const validateEmailDomain = useCallback(async (workEmail, hospitalId) => {
    if (!workEmail || !hospitalId) {
      return { isValid: false, error: "Email y hospital son requeridos" };
    }

    // Extraer dominio del email
    const emailDomain = workEmail.split("@")[1]?.toLowerCase();
    if (!emailDomain) {
      return { isValid: false, error: "Formato de email inválido" };
    }

    // Rechazo temprano de dominios personales — NO se admite revisión manual
    // para estos.
    if (isPersonalEmailDomain(emailDomain)) {
      return {
        isValid: false,
        error: PERSONAL_EMAIL_ERROR,
        isPersonalDomain: true,
      };
    }

    setLoading(true);
    try {
      // Los dominios se leen de Supabase en cada validación: el catálogo
      // estático se regenera a mano y un dominio arreglado en BD no llegaría
      // a la app hasta el siguiente release.
      const { found, domains: normalizedAllowed } =
        await getHospitalEmailDomains(hospitalId);

      if (!found) {
        return {
          isValid: false,
          error: "Hospital no encontrado",
        };
      }

      // Si el hospital no tiene email_domain configurado, permitir cualquier email
      if (normalizedAllowed.length === 0) {
        console.log(
          `Hospital ${hospitalId} doesn't have email domain configured, allowing any email`
        );
        return { isValid: true };
      }

      const isValid = normalizedAllowed.includes(emailDomain);

      if (!isValid) {
        return {
          isValid: false,
          error:
            "¡Ups! Puede que no tengamos actualizada correctamente la lista de emails de tu hospital 🙈. ¿Podrías intentar primero con tu email institucional del trabajo? Y si este email que has puesto ya es el del trabajo, ¡nos encantaría que nos escribieras a contacto@losresis.com para poder solucionarlo! Estamos empezando y tu ayuda nos viene genial para mejorar la plataforma. ¡Mil gracias!",
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error("Exception validating email domain:", error);
      return {
        isValid: false,
        error: "Error al validar el email. Inténtalo de nuevo.",
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    validateEmailDomain,
    loading,
  };
};
