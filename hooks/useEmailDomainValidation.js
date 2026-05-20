import { useState, useCallback } from "react";
import { getHospitalByIdFromCatalog } from "../services/staticCatalogService";

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
   * @returns {Promise<{ isValid: boolean; error?: string }>}
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

    setLoading(true);
    try {
      // Obtener datos del hospital incluyendo email_domain desde catálogo local
      const hospitalData = getHospitalByIdFromCatalog(hospitalId);

      if (!hospitalData) {
        return {
          isValid: false,
          error: "Hospital no encontrado",
        };
      }

      // Si el hospital no tiene email_domain configurado, permitir cualquier email
      if (
        !hospitalData.email_domain ||
        hospitalData.email_domain.length === 0
      ) {
        console.log(
          `Hospital ${hospitalData.name} doesn't have email domain configured, allowing any email`
        );
        return { isValid: true };
      }

      // Normalizar array de dominios y verificar inclusión
      const allowedDomains = (() => {
        if (Array.isArray(hospitalData.email_domain)) {
          return hospitalData.email_domain;
        }
        if (
          typeof hospitalData.email_domain === "string" &&
          hospitalData.email_domain
        ) {
          try {
            // Intentar parsear como JSON primero (para casos como "[\"chv.cat\"]")
            const parsed = JSON.parse(hospitalData.email_domain);
            return Array.isArray(parsed) ? parsed : [hospitalData.email_domain];
          } catch {
            // Si falla el parseo, tratar como dominio único
            return [hospitalData.email_domain];
          }
        }
        return [];
      })();

      const normalizedAllowed = allowedDomains
        .filter(Boolean)
        .map((d) => d.toLowerCase().trim());

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
