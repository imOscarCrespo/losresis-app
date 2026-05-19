import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { getCurrentUser, getUserProfile } from "../services/authService";
import { updateUserProfile } from "../services/userService";
import { getResidentTransitionConfig } from "../services/residentTransitionConfigService";
import {
  validateProfileForm,
  shouldShowEmailReview,
  shouldDiscardInvalidWorkEmailDuringGrace,
} from "../utils/profileValidation";
import {
  getProfileDraftType,
  getResidentState,
  RESIDENT_STATE,
} from "../utils/residentAccess";

const INITIAL_FORM_DATA = {
  name: "",
  surname: "",
  phone: "",
  city: "",
  work_email: "",
  hospital_id: "",
  speciality_id: "",
  resident_year: "",
  is_student: true, // Por defecto, estudiante
  is_resident: false,
  is_doctor: false,
  is_host: false,
};

/**
 * Hook personalizado para manejar el formulario de perfil
 */
export const useProfileForm = () => {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [message, setMessage] = useState(null);
  const [showEmailReviewSection, setShowEmailReviewSection] = useState(false);

  /**
   * Carga el perfil del usuario desde la base de datos
   */
  const loadUserProfile = useCallback(async ({ forceRefresh = false } = {}) => {
    setLoadingProfile(true);
    try {
      const { success: userSuccess, user: currentUser } =
        await getCurrentUser();
      if (!userSuccess || !currentUser) {
        Alert.alert("Error", "No se pudo obtener el usuario actual");
        return;
      }

      setUser(currentUser);

      const { success, profile } = await getUserProfile(currentUser.id, {
        forceRefresh,
      });
      if (success && profile) {
        setUserProfile(profile);
        const savedProfileType = getProfileDraftType(profile);

        // Si el nombre está vacío, intentar obtenerlo del display name o email de Supabase Auth
        let nameValue = profile.name || "";
        if (!nameValue || nameValue.trim() === "") {
          // Intentar primero con display name de user_metadata
          nameValue =
            currentUser.user_metadata?.display_name ||
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            "";

          // Si no hay display name, usar el email
          if (!nameValue || nameValue.trim() === "") {
            nameValue = currentUser.email || "";
          }
        }

        // Si ningún tipo está seleccionado, establecer estudiante por defecto
        const hasAnyType = Boolean(savedProfileType);
        const defaultToStudent = !hasAnyType;

        setFormData({
          name: nameValue,
          surname: profile.surname || "",
          phone: profile.phone || "",
          city: profile.city || "",
          work_email: profile.work_email || "",
          hospital_id: profile.hospital_id || "",
          speciality_id: profile.speciality_id || "",
          resident_year: profile.resident_year?.toString() || "",
          is_student: savedProfileType === "student" || defaultToStudent,
          is_resident: savedProfileType === "resident",
          is_doctor: savedProfileType === "doctor",
          is_host: savedProfileType === "host",
        });
      } else {
        // Si no hay perfil, verificar si viene de Apple para pre-llenar el nombre con el email
        let nameFromEmail = "";

        // Verificar si el usuario se autenticó con Apple
        const isAppleUser =
          currentUser.app_metadata?.provider === "apple" ||
          currentUser.identities?.some(
            (identity) => identity.provider === "apple"
          );

        // Si viene de Apple y tiene email, pre-llenar el nombre con el email
        if (isAppleUser && currentUser.email) {
          nameFromEmail = currentUser.email;
        }

        // Establecer estudiante por defecto y pre-llenar nombre si viene de Apple
        setFormData({
          ...INITIAL_FORM_DATA,
          name: nameFromEmail,
          is_student: true,
          is_resident: false,
          is_doctor: false,
          is_host: false,
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Error al cargar el perfil");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  /**
   * Actualiza un campo específico del formulario
   */
  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Maneja el cambio de tipo de usuario
   */
  const handleUserTypeChange = useCallback((type) => {
    setFormData((prev) => ({
      ...prev,
      is_student: type === "student",
      is_resident: type === "resident",
      is_doctor: type === "doctor",
      is_host: type === "host",
    }));

    if (type !== "resident") {
      setShowEmailReviewSection(false);
    }
  }, []);

  /**
   * Obtiene el tipo de usuario actual
   */
  const getCurrentUserType = useCallback(() => {
    if (formData.is_host) return "host";
    if (formData.is_student) return "student";
    if (formData.is_resident) return "resident";
    if (formData.is_doctor) return "doctor";
    return "";
  }, [formData]);

  /**
   * Maneja el cambio de email de trabajo
   */
  const handleWorkEmailChange = useCallback(
    (text) => {
      updateField("work_email", text);
      // Ocultar sección de revisión cuando el usuario cambia el email
      if (showEmailReviewSection) {
        setShowEmailReviewSection(false);
      }
    },
    [showEmailReviewSection, updateField]
  );

  /**
   * Valida y envía el formulario
   * @param {Function} validateEmailDomain - Función para validar el dominio del email
   * @param {boolean} skipSuccessMessage - Si es true, no muestra mensaje de éxito (útil en onboarding)
   */
  const handleSubmit = useCallback(
    async (validateEmailDomain, skipSuccessMessage = false) => {
      setLoading(true);
      setMessage(null);

      try {
        let normalizedFormData =
          formData.is_student || formData.is_host
            ? {
                ...formData,
                work_email: "",
                hospital_id: "",
                speciality_id: "",
                resident_year: "",
              }
            : formData;

        // Validación básica
        const { config: residentTransitionConfig } =
          await getResidentTransitionConfig();
        const validation = validateProfileForm(normalizedFormData, {
          residentTransitionConfig,
        });
        if (!validation.isValid) {
          setMessage({ type: "error", text: validation.error });
          setLoading(false);
          return;
        }

        // Validar email de trabajo para residentes y doctores
        let emailValidation = { isValid: true };
        if (
          (normalizedFormData.is_resident || normalizedFormData.is_doctor) &&
          normalizedFormData.work_email &&
          normalizedFormData.hospital_id
        ) {
          emailValidation = await validateEmailDomain(
            normalizedFormData.work_email,
            normalizedFormData.hospital_id
          );

          if (!emailValidation.isValid) {
            if (
              shouldDiscardInvalidWorkEmailDuringGrace(
                normalizedFormData,
                emailValidation,
                residentTransitionConfig
              )
            ) {
              normalizedFormData = {
                ...normalizedFormData,
                work_email: "",
              };
            } else if (shouldShowEmailReview(normalizedFormData, emailValidation)) {
              setShowEmailReviewSection(true);
              setMessage({
                type: "error",
                text: "El email de trabajo no coincide con el dominio del hospital. Puedes solicitar una revisión manual abajo.",
              });
              setLoading(false);
              return;
            } else {
              setMessage({
                type: "error",
                text:
                  emailValidation.error ||
                  "Error al validar el email de trabajo.",
              });
              setLoading(false);
              return;
            }
          }
        }

        if (
          !normalizedFormData.work_email &&
          showEmailReviewSection
        ) {
          setShowEmailReviewSection(false);
        }

        // Si un residente que estaba en periodo de gracia (PENDING) o ya bloqueado
        // (LOCKED) aporta ahora un email corporativo válido, limpiar el estado de
        // transición para que vuelva a ACTIVE.
        if (
          normalizedFormData.is_resident &&
          normalizedFormData.work_email &&
          emailValidation.isValid
        ) {
          const previousState = getResidentState(userProfile);
          if (
            previousState === RESIDENT_STATE.PENDING_CORPORATE_EMAIL_SEASONAL ||
            previousState === RESIDENT_STATE.LOCKED_MISSING_CORPORATE_EMAIL
          ) {
            normalizedFormData = {
              ...normalizedFormData,
              resident_state: null,
              resident_transition_expires_at: null,
            };
          }
        }

        if (!user?.id) {
          setMessage({ type: "error", text: "Usuario no identificado." });
          setLoading(false);
          return;
        }

        // Actualizar perfil
        const { success, profile, error } = await updateUserProfile(
          user.id,
          normalizedFormData
        );

        if (!success) {
          setMessage({
            type: "error",
            text: error || "Error al actualizar el perfil. Inténtalo de nuevo.",
          });
          setLoading(false);
          return;
        }

        setUserProfile(profile);

        // Solo mostrar mensaje de éxito si no se solicita omitirlo (modo onboarding)
        if (!skipSuccessMessage) {
          setMessage({
            type: "success",
            text: "Perfil actualizado correctamente.",
          });

          // Recargar perfil después de un breve delay solo en modo edición
          setTimeout(() => {
            loadUserProfile({ forceRefresh: true });
          }, 1000);
        }

        // Retornar éxito para que el componente padre pueda manejar la redirección
        return { success: true, profile };
      } catch (error) {
        console.error("Exception updating profile:", error);
        setMessage({
          type: "error",
          text: "Error al actualizar el perfil. Inténtalo de nuevo.",
        });
      } finally {
        // En modo onboarding (skipSuccessMessage = true), no detener el loading aquí
        // El componente padre lo manejará después de la redirección
        if (!skipSuccessMessage) {
          setLoading(false);
        }
      }
    },
    [formData, user, userProfile, showEmailReviewSection, loadUserProfile]
  );

  return {
    formData,
    loading,
    loadingProfile,
    user,
    userProfile,
    message,
    showEmailReviewSection,
    setMessage,
    setShowEmailReviewSection,
    loadUserProfile,
    updateField,
    handleUserTypeChange,
    getCurrentUserType,
    handleWorkEmailChange,
    handleSubmit,
  };
};
