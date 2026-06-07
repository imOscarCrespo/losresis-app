import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AppState,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  findNodeHandle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "../components/KeyboardAwareScrollView";
import { KeyboardAwareTextInput } from "../components/KeyboardAwareTextInput";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
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
import { isProfileComplete, updateUserProfile } from "../services/userService";
import { getResidentTransitionConfig } from "../services/residentTransitionConfigService";
import { RESIDENT_YEAR_OPTIONS } from "../constants/profileConstants";
import { MOCK_SOURCES } from "../services/mirProjectionService";
import { COLORS } from "../constants/colors";
import {
  prepareHospitalOptions,
  prepareSpecialtyOptions,
  prepareCityOptions,
} from "../utils/profileOptions";
import posthogLogger from "../services/posthogService";
import {
  RESIDENT_STATE,
  canResidentUseSeasonalGrace,
  formatResidentTransitionDeadline,
  getResidentState,
  getProfileDraftType,
} from "../utils/residentAccess";

const hasBasicProfileInfo = (profile) =>
  !!(profile?.name?.trim() && profile?.city?.trim());

const hasRequiredFieldsForType = (profile, type) => {
  if (!type) return false;

  if (type === "student" || type === "host") {
    return hasBasicProfileInfo(profile);
  }

  if (type === "resident") {
    const hasResidentCoreFields = !!(
      hasBasicProfileInfo(profile) &&
      profile?.hospital_id &&
      profile?.speciality_id &&
      profile?.resident_year
    );

    if (!hasResidentCoreFields) {
      return false;
    }

    const residentState = getResidentState(profile);
    if (
      residentState === RESIDENT_STATE.PENDING_CORPORATE_EMAIL_SEASONAL ||
      residentState === RESIDENT_STATE.LOCKED_MISSING_CORPORATE_EMAIL
    ) {
      return true;
    }

    return !!profile?.work_email?.trim();
  }

  if (type === "doctor") {
    return !!(
      hasBasicProfileInfo(profile) &&
      profile?.work_email?.trim() &&
      profile?.hospital_id &&
      profile?.speciality_id
    );
  }

  return false;
};

export default function ProfileEditScreen({
  onBack,
  onProfileUpdated,
  rejectedEmailBanner = false,
  lockedSeasonalBanner = false,
  autoFocusWorkEmail = false,
  onAutoFocusWorkEmailHandled,
}) {
  const scrollViewRef = useRef(null);
  const workEmailSectionRef = useRef(null);
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
  const insets = useSafeAreaInsets();

  const [residentTransitionConfig, setResidentTransitionConfig] = useState(null);

  const handleSubmit = async () => {
    try {
      const result = await originalHandleSubmit(validateEmailDomain, false);
      if (result?.success && onProfileUpdated) {
        await onProfileUpdated();
      }
    } catch (error) {
      console.error("Error en handleSubmit:", error);
    }
  };

  const {
    submitting: emailReviewSubmitting,
    submitted: emailReviewSubmitted,
    submitReview: submitEmailReview,
    reset: resetEmailReview,
  } = useEmailReview();

  const { request: emailReviewRequest, refresh: refreshEmailReviewStatus } =
    useEmailReviewStatus(user?.id);

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

  useEffect(() => {
    loadUserProfile({ forceRefresh: true });
  }, [loadUserProfile]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadUserProfile({ forceRefresh: true }).catch((error) => {
          console.warn("Error revalidando perfil al reanudar:", error);
        });
      }
    });
    return () => subscription.remove();
  }, [loadUserProfile]);

  useEffect(() => {
    posthogLogger.logScreen("ProfileEditScreen");
  }, []);

  useEffect(() => {
    const loadTransitionConfig = async () => {
      const { config } = await getResidentTransitionConfig();
      setResidentTransitionConfig(config);
    };
    loadTransitionConfig();
  }, []);

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

      const { success: profileSaved, error: profileSaveError } =
        await updateUserProfile(user.id, formData);

      if (!profileSaved) {
        setMessage({
          type: "error",
          text:
            profileSaveError ||
            "No se pudo guardar tu solicitud. Inténtalo de nuevo.",
        });
        return;
      }

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
        text: "Solicitud enviada. Revisaremos tu email manualmente y en menos de 1 hora te escribiremos para confirmarte si podemos validarlo.",
      });

      await refreshEmailReviewStatus();
      await loadUserProfile({ forceRefresh: true });
      if (onProfileUpdated) {
        await onProfileUpdated();
      }

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

  const [isEmailValid, setIsEmailValid] = useState(true);

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
        setIsEmailValid(true);
      }
    };

    const timeoutId = setTimeout(validateEmail, 500);
    return () => clearTimeout(timeoutId);
  }, [
    formData.work_email,
    formData.hospital_id,
    formData.is_resident,
    formData.is_doctor,
    validateEmailDomain,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    const savedType = getProfileDraftType(userProfile);

    if (!userProfile) {
      return false;
    }

    return (
      formData.name !== (userProfile.name || "") ||
      formData.surname !== (userProfile.surname || "") ||
      formData.phone !== (userProfile.phone || "") ||
      formData.city !== (userProfile.city || "") ||
      getCurrentUserType() !== savedType ||
      formData.work_email !== (userProfile.work_email || "") ||
      formData.hospital_id !== (userProfile.hospital_id || "") ||
      formData.speciality_id !== (userProfile.speciality_id || "") ||
      formData.resident_year?.toString() !==
        (userProfile.resident_year?.toString() || "") ||
      formData.mir_academy !== (userProfile.mir_academy || "") ||
      formData.mir_expediente !==
        (userProfile.mir_expediente !== null &&
        userProfile.mir_expediente !== undefined
          ? String(userProfile.mir_expediente)
          : "")
    );
  }, [formData, getCurrentUserType, userProfile]);

  const shouldShowFloatingUnsavedChanges =
    hasUnsavedChanges && Boolean(userProfile?.id);
  const floatingUnsavedBottomOffset = Math.max(insets.bottom + 16, 24);
  const profileScrollBottomPadding = shouldShowFloatingUnsavedChanges
    ? floatingUnsavedBottomOffset + 120
    : 32;
  const showResidentTransitionHint = useMemo(
    () => canResidentUseSeasonalGrace(formData, residentTransitionConfig),
    [formData, residentTransitionConfig]
  );

  const profileUiState = useMemo(() => {
    const draftType = getProfileDraftType(formData);
    const draftHasRequiredFields = hasRequiredFieldsForType(formData, draftType);

    if (hasUnsavedChanges) {
      if (!draftType || !draftHasRequiredFields) {
        return "incomplete";
      }
      return "hidden";
    }

    if (!userProfile) {
      return "incomplete";
    }

    const savedType = getProfileDraftType(userProfile);
    if (!savedType || !hasRequiredFieldsForType(userProfile, savedType)) {
      return "incomplete";
    }

    const residentState = getResidentState(userProfile);

    if (
      savedType === "resident" &&
      residentState === RESIDENT_STATE.PENDING_CORPORATE_EMAIL_SEASONAL
    ) {
      return "resident_transition_pending";
    }

    if (
      savedType === "resident" &&
      residentState === RESIDENT_STATE.LOCKED_MISSING_CORPORATE_EMAIL
    ) {
      return "resident_transition_locked";
    }

    if (savedType === "resident" && emailReviewRequest?.status === "PENDING") {
      return "email_review_pending";
    }

    if (isProfileComplete(userProfile, { emailReviewRequest, isEmailValid })) {
      return "hidden";
    }

    return "incomplete";
  }, [
    emailReviewRequest?.status,
    formData,
    hasUnsavedChanges,
    isEmailValid,
    userProfile,
  ]);

  const isEmailInputDisabled = !formData.hospital_id || !formData.speciality_id;

  useEffect(() => {
    if (!autoFocusWorkEmail) return;
    if (loadingProfile) return;
    if (!formData.is_resident && !formData.is_doctor) {
      onAutoFocusWorkEmailHandled?.();
      return;
    }

    const timer = setTimeout(() => {
      const scrollNode = findNodeHandle(scrollViewRef.current);
      const target = workEmailSectionRef.current;
      if (!scrollNode || !target?.measureLayout) {
        onAutoFocusWorkEmailHandled?.();
        return;
      }
      target.measureLayout(
        scrollNode,
        (_x, y) => {
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, y - 24),
            animated: true,
          });
          onAutoFocusWorkEmailHandled?.();
        },
        () => {
          onAutoFocusWorkEmailHandled?.();
        }
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [
    autoFocusWorkEmail,
    loadingProfile,
    formData.is_resident,
    formData.is_doctor,
    onAutoFocusWorkEmailHandled,
  ]);

  if (loadingProfile) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </View>
    );
  }

  return (
    <HeroScreenLayout
      containerStyle={styles.safeArea}
      title="Editar perfil"
      onBack={onBack}
      contentStyle={styles.contentSurface}
      headerStyle={styles.heroHeader}
    >
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, styles.scrollViewWithHero]}
        contentContainerStyle={styles.scrollViewContent}
        bottomPadding={profileScrollBottomPadding}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentInner}>
          {rejectedEmailBanner ? (
            <View style={styles.rejectedEmailBanner}>
              <Ionicons
                name="alert-circle"
                size={22}
                color="#B91C1C"
                style={styles.rejectedEmailBannerIcon}
              />
              <Text style={styles.rejectedEmailBannerText}>
                Tu email corporativo no se ha podido validar. Introduce un email
                del dominio de tu hospital y guarda los cambios para recuperar el
                acceso al resto de la app.
              </Text>
            </View>
          ) : lockedSeasonalBanner ? (
            <View style={styles.rejectedEmailBanner}>
              <Ionicons
                name="time-outline"
                size={22}
                color="#B91C1C"
                style={styles.rejectedEmailBannerIcon}
              />
              <Text style={styles.rejectedEmailBannerText}>
                La ventana MIR temporal ha terminado. Añade tu correo corporativo
                y guarda los cambios para reactivar el acceso al resto de la app.
              </Text>
            </View>
          ) : null}

          {profileUiState !== "hidden" &&
          profileUiState !== "resident_transition_pending" ? (
            <ProfileStatusCard
              status={profileUiState}
              deadlineLabel={formatResidentTransitionDeadline(
                userProfile?.resident_transition_expires_at
              )}
            />
          ) : null}

          <View style={styles.formCard}>
            <UserTypeSelector
              selectedType={getCurrentUserType()}
              onTypeChange={handleUserTypeChange}
            />

            {/* Información Personal */}
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
                    <KeyboardAwareTextInput
                      style={styles.input}
                      placeholder="Tu nombre"
                      value={formData.name}
                      onChangeText={(text) => updateField("name", text)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Apellidos</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="person"
                      size={20}
                      color="#999"
                      style={styles.inputIcon}
                    />
                    <KeyboardAwareTextInput
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
                    <KeyboardAwareTextInput
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
                    onSelect={(city) => {
                      Keyboard.dismiss();
                      updateField("city", city);
                    }}
                    options={cityOptions}
                    placeholder="Selecciona tu ciudad"
                    enableSearch={true}
                  />
                </View>
              </View>

              {formData.is_student && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Academia MIR (opcional)</Text>
                    <SelectFilter
                      label=""
                      value={formData.mir_academy}
                      onSelect={(academy) => {
                        Keyboard.dismiss();
                        updateField("mir_academy", academy);
                      }}
                      options={MOCK_SOURCES}
                      placeholder="Selecciona tu academia"
                      enableSearch={false}
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.inputGroupLast]}>
                    <Text style={styles.inputLabel}>
                      Nota del expediente académico (5.00 – 10.00, opcional)
                    </Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="school"
                        size={20}
                        color="#999"
                        style={styles.inputIcon}
                      />
                      <KeyboardAwareTextInput
                        style={styles.input}
                        value={formData.mir_expediente}
                        onChangeText={(text) => {
                          const cleaned = text
                            .replace(",", ".")
                            .replace(/[^0-9.]/g, "")
                            .replace(/(\..*)\./g, "$1");
                          updateField("mir_expediente", cleaned);
                        }}
                        placeholder="Ej: 7.50"
                        keyboardType="decimal-pad"
                        maxLength={5}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Información Profesional */}
            {(formData.is_resident || formData.is_doctor) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Información Profesional</Text>

                {formData.is_resident && (
                  <View style={styles.professionalInputGroup}>
                    <Text style={styles.inputLabel}>Año de residencia *</Text>
                    <SelectFilter
                      label=""
                      value={formData.resident_year}
                      onSelect={(year) => {
                        Keyboard.dismiss();
                        updateField("resident_year", year);
                      }}
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
                    onSelect={(hospitalId) => {
                      Keyboard.dismiss();
                      updateField("hospital_id", hospitalId);
                    }}
                    options={hospitalOptions}
                    placeholder="Selecciona tu hospital"
                    enableSearch={true}
                  />
                </View>

                <View style={styles.professionalInputGroup}>
                  <Text style={styles.inputLabel}>Especialidad *</Text>
                  <SelectFilter
                    label=""
                    value={formData.speciality_id}
                    onSelect={(specialtyId) => {
                      Keyboard.dismiss();
                      updateField("speciality_id", specialtyId);
                    }}
                    options={specialtyOptions}
                    placeholder="Selecciona tu especialidad"
                    enableSearch={true}
                  />
                </View>

                <View
                  ref={workEmailSectionRef}
                  style={styles.professionalInputGroup}
                >
                  <Text style={styles.inputLabel}>
                    Email corporativo
                    {!showResidentTransitionHint ? " *" : ""}
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
                    <KeyboardAwareTextInput
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
                      keyboardAwareOptions={{ extraScrollSpace: 36 }}
                    />
                  </View>
                  {formData.is_resident ? (
                    showResidentTransitionHint ? (
                      <Text style={styles.fieldHelpText}>
                        Si todavía no te han dado el correo corporativo, puedes
                        terminar el alta ahora y añadirlo después dentro del
                        periodo de transición MIR.
                      </Text>
                    ) : (
                      <Text style={styles.fieldHelpText}>
                        Si ya dispones de correo corporativo, introdúcelo aquí
                        para validar tu perfil de residente.
                      </Text>
                    )
                  ) : null}
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
                  isOnboarding={false}
                />
              )}

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

            <View style={styles.actionsContainer}>
              <Button
                title={
                  loading || validatingEmail ? "Guardando..." : "Guardar cambios"
                }
                onPress={handleSubmit}
                loading={loading || validatingEmail}
                disabled={loading || validatingEmail}
                variant="primary"
                style={styles.saveButton}
              />
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
      {shouldShowFloatingUnsavedChanges ? (
        <View
          pointerEvents="none"
          style={[
            styles.unsavedChangesFloatingWrap,
            { bottom: floatingUnsavedBottomOffset },
          ]}
        >
          <View style={styles.unsavedChangesCard}>
            <Ionicons name="save-outline" size={20} color={COLORS.PRIMARY} />
            <View style={styles.unsavedChangesTextBlock}>
              <Text style={styles.unsavedChangesTitle}>
                Tienes cambios sin guardar
              </Text>
              <Text style={styles.unsavedChangesText}>
                Pulsa en guardar cambios para actualizar tu perfil.
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  heroHeader: {
    marginBottom: 0,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewWithHero: {
    marginTop: 0,
  },
  scrollViewContent: {
    paddingBottom: 32,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 16,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F8F9FE",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
  },
  rejectedEmailBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEE2E2",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 16,
  },
  rejectedEmailBannerIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  rejectedEmailBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#7F1D1D",
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  unsavedChangesCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  unsavedChangesFloatingWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 5,
  },
  unsavedChangesTextBlock: {
    flex: 1,
  },
  unsavedChangesTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E3A8A",
    marginBottom: 4,
  },
  unsavedChangesText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1D4ED8",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginRight: 0,
  },
  inputGroupLast: {
    marginRight: 0,
  },
  professionalInputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1B0977",
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
    color: "#94A3B8",
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  inputDisabled: {
    color: "#94A3B8",
  },
  fieldHelpText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },
  messageContainer: {
    padding: 16,
    borderRadius: 18,
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
    marginTop: 12,
    gap: 12,
  },
  saveButton: {
    flex: 1,
  },
});
