/**
 * Servicio para gestionar el perfil de usuario
 */

import { supabase } from "../config/supabase";
import {
  cacheUserProfile,
  clearCachedUserProfile,
} from "./userProfileCacheService";
import {
  isSeasonalResidentPending,
  isResidentLockedMissingCorporateEmail,
} from "../utils/residentAccess";

/**
 * Actualizar el perfil de usuario
 * @param {string} userId - ID del usuario
 * @param {object} profileData - Datos del perfil a actualizar
 * @returns {Promise<{success: boolean, profile: object|null, error: string|null}>}
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    console.log("🔄 Updating user profile:", userId, profileData);

    const previousProfileResult = await supabase
      .from("users")
      .select("id, hospital_id, speciality_id, resident_year")
      .eq("id", userId)
      .maybeSingle();

    const previousProfile = previousProfileResult.data || null;

    const updateData = {
      id: userId,
      name: profileData.name?.trim() || null,
      surname: profileData.surname?.trim() || null,
      phone: profileData.phone?.trim() || null,
      city: profileData.city?.trim() || null,
      is_student: profileData.is_student || false,
      is_resident: profileData.is_resident || false,
      is_doctor: profileData.is_doctor || false,
      is_super_admin: profileData.is_super_admin || false,
      work_email: profileData.work_email?.trim() || null,
      hospital_id: profileData.hospital_id || null,
      speciality_id: profileData.speciality_id || null,
      resident_year: profileData.resident_year
        ? parseInt(profileData.resident_year)
        : null,
    };

    const { data, error } = await supabase
      .from("users")
      .upsert([updateData], { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating profile:", error);
      return {
        success: false,
        profile: null,
        error: error.message,
      };
    }

    console.log("✅ Profile updated successfully:", data);

    const hospitalChanged =
      previousProfile?.hospital_id !== (data?.hospital_id || null);
    const specialityChanged =
      previousProfile?.speciality_id !== (data?.speciality_id || null);
    const residentYearChanged =
      (previousProfile?.resident_year || null) !== (data?.resident_year || null);

    if (hospitalChanged || specialityChanged || residentYearChanged) {
      await clearCachedUserProfile(userId);
    } else {
      await cacheUserProfile(data);
    }

    return {
      success: true,
      profile: data,
      error: null,
    };
  } catch (error) {
    console.error("❌ Exception updating profile:", error);
    return {
      success: false,
      profile: null,
      error: error.message,
    };
  }
};

/**
 * Enviar solicitud de revisión manual de email
 * @param {string} userId - ID del usuario
 * @param {string} workEmail - Email de trabajo a revisar
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const submitEmailReviewRequest = async (userId, workEmail) => {
  try {
    console.log("🔄 Submitting email review request:", { userId, workEmail });

    const { data, error } = await supabase
      .from("user_email_review_requests")
      .insert([
        {
          user_id: userId,
          work_email: workEmail,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("❌ Error submitting email review request:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log("✅ Email review request submitted successfully:", data);
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("❌ Exception submitting email review request:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verificar si el perfil está completo
 * @param {object} profile - Perfil del usuario
 * @param {object} options - Opciones adicionales
 * @param {boolean} options.hasActiveEmailReview - Si tiene una solicitud de revisión de email activa (pendiente o aprobada)
 * @param {boolean} options.isEmailValid - Si el email de trabajo es válido (opcional, por defecto true si no se proporciona)
 * @returns {boolean}
 */
export const isProfileComplete = (
  profile,
  { hasActiveEmailReview = false, isEmailValid = true } = {}
) => {
  if (!profile) return false;

  const hasRequiredBasicInfo = !!(profile.name && profile.city);

  if (profile.is_student) {
    return hasRequiredBasicInfo; // Estudiantes solo necesitan nombre y ciudad (apellidos es opcional)
  }

  if (profile.is_resident) {
    const hasResidentCoreFields = !!(
      hasRequiredBasicInfo &&
      profile.hospital_id &&
      profile.speciality_id &&
      profile.resident_year
    );

    if (!hasResidentCoreFields) return false;

    if (isSeasonalResidentPending(profile)) {
      return true;
    }

    if (isResidentLockedMissingCorporateEmail(profile)) {
      return false;
    }

    const hasCorporateEmail = !!profile.work_email;
    if (!hasCorporateEmail) return false;

    return isEmailValid || hasActiveEmailReview;
  }

  if (profile.is_doctor) {
    // Para doctores, similar pero sin resident_year
    const hasAllRequiredFields = !!(
      hasRequiredBasicInfo &&
      profile.work_email &&
      profile.hospital_id &&
      profile.speciality_id
    );

    if (!hasAllRequiredFields) return false;

    // El perfil está completo si el email es válido O tiene solicitud activa
    return isEmailValid || hasActiveEmailReview;
  }

  return false;
};

/**
 * Eliminar la cuenta del usuario (elimina de la tabla users)
 * Nota: La eliminación de auth.users requiere permisos de admin y debería hacerse
 * desde el backend mediante un trigger o función Edge.
 * @param {string} userId - ID del usuario
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteUserAccount = async (userId) => {
  try {
    console.log("🗑️ Eliminando cuenta de usuario:", userId);

    // Intentar eliminar el registro de la tabla users
    // Nota: Si hay un trigger mal configurado, esto puede fallar
    const { error: deleteProfileError, data } = await supabase
      .from("users")
      .delete()
      .eq("id", userId)
      .select();

    // El error 42883 indica que hay un problema con una función en un trigger
    // Esto típicamente ocurre cuando hay un trigger que intenta llamar a una función Edge
    // que no existe o está mal configurada (como supabase_functions.http_request)
    if (deleteProfileError) {
      console.warn(
        "⚠️ Error al eliminar (probablemente del trigger):",
        deleteProfileError.code,
        deleteProfileError.message
      );
      console.warn("⚠️ Detalle completo del error al eliminar usuario:", {
        code: deleteProfileError.code,
        message: deleteProfileError.message,
        details: deleteProfileError.details,
        hint: deleteProfileError.hint,
        userId,
      });

      // Verificar si el registro todavía existe
      // Si el error es del trigger pero el DELETE se ejecutó, el registro no debería existir
      const { data: checkData, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      // PGRST116 = "no rows returned" - significa que el registro NO existe (se eliminó)
      if (checkError && checkError.code === "PGRST116") {
        console.log(
          "✅ El usuario fue eliminado correctamente (aunque el trigger falló)"
        );
        return {
          success: true,
          error: null,
        };
      }

      // Si el registro todavía existe, el DELETE falló completamente
      if (checkData) {
        console.error(
          "❌ El usuario NO fue eliminado. El trigger está bloqueando la transacción."
        );
        return {
          success: false,
          error: (() => {
            if (deleteProfileError.code === "23503") {
              return (
                "No se pudo eliminar el usuario porque sigue referenciado por otros registros en la base de datos. " +
                `Detalle: ${deleteProfileError.message}`
              );
            }

            return (
              "No se pudo eliminar el usuario debido a un error en la base de datos. " +
              `Detalle: ${deleteProfileError.message}`
            );
          })(),
        };
      }
    }

    // Verificar una vez más que el registro se eliminó
    const { data: verifyData, error: verifyError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (verifyData) {
      console.error(
        "❌ El usuario todavía existe después de intentar eliminarlo"
      );
      return {
        success: false,
        error: "No se pudo eliminar el usuario. El registro todavía existe.",
      };
    }

    // Si verifyError es PGRST116, significa que el registro no existe (se eliminó correctamente)
    if (verifyError && verifyError.code !== "PGRST116") {
      console.warn("⚠️ Error al verificar eliminación:", verifyError);
      // Continuar de todas formas si no es un error crítico
    }

    console.log("✅ Perfil de usuario eliminado de la tabla users");
    console.log(
      "ℹ️ Nota: Si hay un error en el trigger, puede ser necesario " +
        "configurarlo correctamente en Supabase para eliminar también de auth.users."
    );

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("❌ Exception eliminando cuenta:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
