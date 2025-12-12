/**
 * Servicio para gestionar el perfil de usuario
 */

import { supabase } from "../config/supabase";

/**
 * Actualizar el perfil de usuario
 * @param {string} userId - ID del usuario
 * @param {object} profileData - Datos del perfil a actualizar
 * @returns {Promise<{success: boolean, profile: object|null, error: string|null}>}
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    console.log("🔄 Updating user profile:", userId, profileData);

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

  const hasRequiredBasicInfo = !!(
    profile.name &&
    profile.surname &&
    profile.city
  );

  if (profile.is_student) {
    return hasRequiredBasicInfo; // Estudiantes solo necesitan nombre, apellidos y ciudad
  }

  if (profile.is_resident) {
    // Para residentes, el perfil está completo si:
    // 1. Tiene toda la información básica requerida
    // 2. Tiene work_email definido
    // 3. Tiene hospital_id, speciality_id y resident_year
    // 4. Y (el email es válido O tiene una solicitud de revisión activa)
    const hasAllRequiredFields = !!(
      hasRequiredBasicInfo &&
      profile.work_email &&
      profile.hospital_id &&
      profile.speciality_id &&
      profile.resident_year
    );

    if (!hasAllRequiredFields) return false;

    // El perfil está completo si el email es válido O tiene solicitud activa
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
