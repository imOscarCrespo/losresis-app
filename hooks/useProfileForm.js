import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { getCurrentUser, getUserProfile } from "../services/authService";
import { updateUserProfile } from "../services/userService";
import { validateProfileForm, shouldShowEmailReview } from "../utils/profileValidation";

const INITIAL_FORM_DATA = {
  name: "",
  surname: "",
  phone: "",
  city: "",
  work_email: "",
  hospital_id: "",
  speciality_id: "",
  resident_year: "",
  is_student: false,
  is_resident: false,
  is_doctor: false,
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
  const loadUserProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const { success: userSuccess, user: currentUser } = await getCurrentUser();
      if (!userSuccess || !currentUser) {
        Alert.alert("Error", "No se pudo obtener el usuario actual");
        return;
      }

      setUser(currentUser);

      const { success, profile } = await getUserProfile(currentUser.id);
      if (success && profile) {
        setUserProfile(profile);
        setFormData({
          name: profile.name || "",
          surname: profile.surname || "",
          phone: profile.phone || "",
          city: profile.city || "",
          work_email: profile.work_email || "",
          hospital_id: profile.hospital_id || "",
          speciality_id: profile.speciality_id || "",
          resident_year: profile.resident_year?.toString() || "",
          is_student: profile.is_student || false,
          is_resident: profile.is_resident || false,
          is_doctor: profile.is_doctor || false,
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
      // Limpiar campos profesionales si cambia a estudiante
      ...(type === "student" && {
        work_email: "",
        hospital_id: "",
        speciality_id: "",
        resident_year: "",
      }),
    }));
  }, []);

  /**
   * Obtiene el tipo de usuario actual
   */
  const getCurrentUserType = useCallback(() => {
    if (formData.is_student) return "student";
    if (formData.is_resident) return "resident";
    if (formData.is_doctor) return "doctor";
    return "";
  }, [formData]);

  /**
   * Maneja el cambio de email de trabajo
   */
  const handleWorkEmailChange = useCallback((text) => {
    updateField("work_email", text);
    // Ocultar sección de revisión cuando el usuario cambia el email
    if (showEmailReviewSection) {
      setShowEmailReviewSection(false);
    }
  }, [showEmailReviewSection, updateField]);

  /**
   * Valida y envía el formulario
   */
  const handleSubmit = useCallback(
    async (validateEmailDomain) => {
      setLoading(true);
      setMessage(null);

      try {
        // Validación básica
        const validation = validateProfileForm(formData);
        if (!validation.isValid) {
          setMessage({ type: "error", text: validation.error });
          setLoading(false);
          return;
        }

        // Validar email de trabajo para residentes y doctores
        let emailValidation = { isValid: true };
        if (
          (formData.is_resident || formData.is_doctor) &&
          formData.work_email &&
          formData.hospital_id
        ) {
          emailValidation = await validateEmailDomain(
            formData.work_email,
            formData.hospital_id
          );

          if (!emailValidation.isValid) {
            if (shouldShowEmailReview(formData, emailValidation)) {
              setShowEmailReviewSection(true);
              setMessage({
                type: "error",
                text: "El email de trabajo no coincide con el dominio del hospital. Puedes solicitar una revisión manual abajo.",
              });
            } else {
              setMessage({
                type: "error",
                text: emailValidation.error || "Error al validar el email de trabajo.",
              });
            }
            setLoading(false);
            return;
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
          formData
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
        setMessage({
          type: "success",
          text: "Perfil actualizado correctamente.",
        });

        // Recargar perfil después de un breve delay
        setTimeout(() => {
          loadUserProfile();
        }, 1000);
      } catch (error) {
        console.error("Exception updating profile:", error);
        setMessage({
          type: "error",
          text: "Error al actualizar el perfil. Inténtalo de nuevo.",
        });
      } finally {
        setLoading(false);
      }
    },
    [formData, user, loadUserProfile]
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

