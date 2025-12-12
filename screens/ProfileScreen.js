import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SelectFilter } from "../components/SelectFilter";
import { Button } from "../components/Button";
import { EmailReviewSection } from "../components/EmailReviewSection";
import { ProfileStatusCard } from "../components/ProfileStatusCard";
import { UserTypeSelector } from "../components/UserTypeSelector";
import { useHospitals } from "../hooks/useHospitals";
import { useEmailDomainValidation } from "../hooks/useEmailDomainValidation";
import { useProfileForm } from "../hooks/useProfileForm";
import { useEmailReview } from "../hooks/useEmailReview";
import { useEmailReviewStatus } from "../hooks/useEmailReviewStatus";
import { signOut } from "../services/authService";
import { isProfileComplete, updateUserProfile } from "../services/userService";
import { RESIDENT_YEAR_OPTIONS } from "../constants/profileConstants";
import {
  prepareHospitalOptions,
  prepareSpecialtyOptions,
  prepareCityOptions,
} from "../utils/profileOptions";

export default function ProfileScreen({
  onBack,
  onSignOut,
  onSectionChange,
  currentSection,
  isOnboarding = false,
  onProfileComplete,
}) {
  const { hospitals, specialties, uniqueCities } = useHospitals();
  const { validateEmailDomain, loading: validatingEmail } =
    useEmailDomainValidation();

  const {
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
    handleSubmit: originalHandleSubmit,
  } = useProfileForm();

  // Wrapper para handleSubmit que maneja el modo onboarding
  const handleSubmit = async () => {
    await originalHandleSubmit(validateEmailDomain);
    // El useEffect manejará la redirección cuando el perfil esté completo
  };

  const {
    submitting: emailReviewSubmitting,
    submitted: emailReviewSubmitted,
    submitReview: submitEmailReview,
    reset: resetEmailReview,
  } = useEmailReview();

  // Obtener estado de la solicitud de revisión de email
  const {
    hasActiveRequest: hasActiveEmailReview,
    refresh: refreshEmailReviewStatus,
  } = useEmailReviewStatus(user?.id);

  // Preparar opciones para los selects
  const hospitalOptions = useMemo(
    () => prepareHospitalOptions(hospitals),
    [hospitals]
  );

  const specialtyOptions = useMemo(
    () => prepareSpecialtyOptions(specialties),
    [specialties]
  );

  const cityOptions = useMemo(
    () => prepareCityOptions(uniqueCities),
    [uniqueCities]
  );

  // Cargar perfil al montar
  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  // Manejar envío de revisión de email
  const handleSubmitEmailReview = async () => {
    if (!formData.work_email || !formData.hospital_id) {
      setMessage({
        type: "error",
        text: "Por favor, completa el email de trabajo y hospital antes de enviar la solicitud.",
      });
      return;
    }

    setMessage(null);

    try {
      if (!user?.id) {
        setMessage({ type: "error", text: "Usuario no identificado." });
        return;
      }

      // Primero actualizar el perfil con el email (aunque no sea válido)
      // Esto permite que el perfil se considere completo con la solicitud activa
      await updateUserProfile(user.id, formData);

      // Luego enviar la solicitud de revisión
      const { success, error } = await submitEmailReview(
        user.id,
        formData.work_email
      );

      if (!success) {
        setMessage({
          type: "error",
          text: error || "Error al enviar la solicitud. Inténtalo de nuevo.",
        });
        return;
      }

      setMessage({
        type: "success",
        text: "¡Solicitud enviada correctamente! Revisaremos tu email y te contactaremos pronto.",
      });

      // Actualizar el estado de la solicitud de revisión y recargar perfil
      await refreshEmailReviewStatus();
      loadUserProfile();

      setTimeout(() => {
        setShowEmailReviewSection(false);
      }, 3000);
    } catch (error) {
      console.error("Exception submitting email review request:", error);
      setMessage({
        type: "error",
        text: "Error al enviar la solicitud. Inténtalo de nuevo.",
      });
    }
  };

  const handleCancelEmailReview = () => {
    setShowEmailReviewSection(false);
    resetEmailReview();
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres cerrar sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar Sesión",
          style: "destructive",
          onPress: async () => {
            try {
              // Cerrar sesión en Supabase (esto limpia tokens y sesión)
              const { success, error } = await signOut();

              if (!success) {
                Alert.alert(
                  "Error",
                  error || "No se pudo cerrar sesión. Inténtalo de nuevo."
                );
                return;
              }

              // Notificar a App.js para que actualice el estado y redirija
              if (onSignOut) {
                await onSignOut();
              }
            } catch (error) {
              console.error("Error al cerrar sesión:", error);
              Alert.alert(
                "Error",
                "Error al cerrar sesión. Inténtalo de nuevo."
              );
            }
          },
        },
      ]
    );
  };

  // Validar email para determinar si el perfil está completo
  const [isEmailValid, setIsEmailValid] = useState(true);

  // Validar email cuando cambia (solo si es residente o doctor)
  useEffect(() => {
    const validateEmail = async () => {
      if (
        (formData.is_resident || formData.is_doctor) &&
        formData.work_email &&
        formData.hospital_id
      ) {
        try {
          const validation = await validateEmailDomain(
            formData.work_email,
            formData.hospital_id
          );
          setIsEmailValid(validation.isValid);
        } catch (error) {
          console.error("Error validating email:", error);
          setIsEmailValid(false);
        }
      } else {
        // Si no hay email o no es residente/doctor, consideramos válido (no aplica validación)
        setIsEmailValid(true);
      }
    };

    // Debounce para evitar validaciones excesivas
    const timeoutId = setTimeout(validateEmail, 500);
    return () => clearTimeout(timeoutId);
  }, [
    formData.work_email,
    formData.hospital_id,
    formData.is_resident,
    formData.is_doctor,
    validateEmailDomain,
  ]);

  const profileComplete = useMemo(
    () =>
      isProfileComplete(formData, {
        hasActiveEmailReview,
        isEmailValid,
      }),
    [formData, hasActiveEmailReview, isEmailValid]
  );

  // Redirigir automáticamente cuando el perfil se completa en modo onboarding
  useEffect(() => {
    if (
      isOnboarding &&
      profileComplete &&
      userProfile &&
      onProfileComplete &&
      !loading &&
      !loadingProfile &&
      !validatingEmail
    ) {
      console.log("✅ Perfil completo en onboarding, redirigiendo...");
      // Pequeño delay para que el usuario vea el mensaje de éxito
      const timeoutId = setTimeout(() => {
        onProfileComplete();
      }, 1500);

      return () => clearTimeout(timeoutId);
    }
  }, [
    isOnboarding,
    profileComplete,
    userProfile,
    onProfileComplete,
    loading,
    loadingProfile,
    validatingEmail,
  ]);

  const isEmailInputDisabled = !formData.hospital_id || !formData.speciality_id;

  if (loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {!isOnboarding && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
          )}
          <Text
            style={[
              styles.headerTitle,
              isOnboarding && styles.headerTitleCentered,
            ]}
          >
            {isOnboarding ? "Completa tu Perfil" : "Mi Perfil"}
          </Text>
        </View>

        {/* Profile Status */}
        <ProfileStatusCard isComplete={profileComplete} />

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* User Type Selection */}
          <UserTypeSelector
            selectedType={getCurrentUserType()}
            onTypeChange={handleUserTypeChange}
          />

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Personal</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="person"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Tu nombre"
                    value={formData.name}
                    onChangeText={(text) => updateField("name", text)}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Apellidos *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="person"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Tus apellidos"
                    value={formData.surname}
                    onChangeText={(text) => updateField("surname", text)}
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="call"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="+34 600 000 000"
                    value={formData.phone}
                    onChangeText={(text) => updateField("phone", text)}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, styles.inputGroupLast]}>
                <Text style={styles.inputLabel}>Ciudad *</Text>
                <SelectFilter
                  label=""
                  value={formData.city}
                  onSelect={(city) => updateField("city", city)}
                  options={cityOptions}
                  placeholder="Selecciona tu ciudad"
                  enableSearch={false}
                />
              </View>
            </View>
          </View>

          {/* Professional Information */}
          {(formData.is_resident || formData.is_doctor) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información Profesional</Text>

              {formData.is_resident && (
                <View style={styles.professionalInputGroup}>
                  <Text style={styles.inputLabel}>Año de residencia *</Text>
                  <SelectFilter
                    label=""
                    value={formData.resident_year}
                    onSelect={(year) => updateField("resident_year", year)}
                    options={RESIDENT_YEAR_OPTIONS}
                    placeholder="Selecciona el año"
                    enableSearch={false}
                  />
                </View>
              )}

              <View style={styles.professionalInputGroup}>
                <Text style={styles.inputLabel}>Hospital *</Text>
                <SelectFilter
                  label=""
                  value={formData.hospital_id}
                  onSelect={(hospitalId) =>
                    updateField("hospital_id", hospitalId)
                  }
                  options={hospitalOptions}
                  placeholder="Selecciona tu hospital"
                  enableSearch={false}
                />
              </View>

              <View style={styles.professionalInputGroup}>
                <Text style={styles.inputLabel}>Especialidad *</Text>
                <SelectFilter
                  label=""
                  value={formData.speciality_id}
                  onSelect={(specialtyId) =>
                    updateField("speciality_id", specialtyId)
                  }
                  options={specialtyOptions}
                  placeholder="Selecciona tu especialidad"
                  enableSearch={false}
                />
              </View>

              <View style={styles.professionalInputGroup}>
                <Text style={styles.inputLabel}>
                  Email de trabajo *
                  {isEmailInputDisabled && (
                    <Text style={styles.inputHint}>
                      {" "}
                      (Selecciona hospital y especialidad primero)
                    </Text>
                  )}
                </Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="mail"
                    size={20}
                    color={isEmailInputDisabled ? "#CCC" : "#999"}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      isEmailInputDisabled && styles.inputDisabled,
                    ]}
                    placeholder={
                      isEmailInputDisabled
                        ? "Selecciona hospital y especialidad primero"
                        : "tu.email@hospital.com"
                    }
                    value={formData.work_email}
                    onChangeText={handleWorkEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isEmailInputDisabled}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Email Review Request Section */}
          {showEmailReviewSection &&
            formData.is_resident &&
            formData.work_email &&
            formData.hospital_id && (
              <EmailReviewSection
                workEmail={formData.work_email}
                onSubmit={handleSubmitEmailReview}
                onCancel={handleCancelEmailReview}
                isSubmitting={emailReviewSubmitting}
                isSubmitted={emailReviewSubmitted}
              />
            )}

          {/* Message Display */}
          {message && (
            <View
              style={[
                styles.messageContainer,
                message.type === "success"
                  ? styles.messageSuccess
                  : styles.messageError,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.type === "success"
                    ? styles.messageTextSuccess
                    : styles.messageTextError,
                ]}
              >
                {message.text}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              title={
                loading || validatingEmail
                  ? "Guardando..."
                  : isOnboarding
                  ? "Continuar"
                  : "Guardar Cambios"
              }
              onPress={handleSubmit}
              loading={loading || validatingEmail}
              disabled={loading || validatingEmail}
              variant="primary"
              style={styles.saveButton}
            />
            {!isOnboarding && (
              <Button
                title="Cerrar Sesión"
                onPress={handleSignOut}
                variant="secondary"
                style={styles.signOutButton}
              />
            )}
          </View>
        </View>
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  headerTitleCentered: {
    flex: 1,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginRight: 12,
  },
  inputGroupLast: {
    marginRight: 0,
  },
  professionalInputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    fontWeight: "400",
    color: "#999",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1a1a1a",
  },
  inputDisabled: {
    backgroundColor: "#F9FAFB",
    color: "#999",
  },
  messageContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  messageSuccess: {
    backgroundColor: "#D1FAE5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  messageError: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextSuccess: {
    color: "#047857",
  },
  messageTextError: {
    color: "#DC2626",
  },
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  saveButton: {
    flex: 1,
  },
  signOutButton: {
    flex: 1,
  },
});
