import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
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
import { signOut, getCurrentUser } from "../services/authService";
import {
  isProfileComplete,
  updateUserProfile,
  deleteUserAccount,
} from "../services/userService";
import {
  getActiveRaffle,
  checkReferralAlreadyApplied,
  applyReferralCode,
} from "../services/referralService";
import {
  isBiometricEnabled,
  setBiometricEnabled,
  checkBiometricAvailability,
} from "../services/biometricService";
import { RESIDENT_YEAR_OPTIONS } from "../constants/profileConstants";
import { COLORS } from "../constants/colors";
import {
  prepareHospitalOptions,
  prepareSpecialtyOptions,
  prepareCityOptions,
} from "../utils/profileOptions";
import posthogLogger from "../services/posthogService";
import Constants from "expo-constants";

export default function ProfileScreen({
  onBack,
  onSignOut,
  onProfileUpdated,
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

  // Estado para controlar el loading durante el proceso completo (en modo onboarding)
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);

  // Wrapper para handleSubmit que maneja el modo onboarding
  const handleSubmit = async () => {
    if (isOnboarding) {
      // En modo onboarding, mantener loading hasta que se complete todo
      setIsCompletingOnboarding(true);
      setMessage(null); // Limpiar mensajes previos
    }

    try {
      // En modo onboarding, omitir mensaje de éxito
      const result = await originalHandleSubmit(
        validateEmailDomain,
        isOnboarding
      );

      if (result?.success && onProfileUpdated) {
        await onProfileUpdated();
      }

      if (result?.success && isOnboarding) {
        // En modo onboarding, redirigir inmediatamente
        // Pequeño delay mínimo para asegurar que el estado se actualiza
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Redirigir directamente
        if (onProfileComplete) {
          onProfileComplete();
        }
      } else if (!result?.success && isOnboarding) {
        // Si falla, resetear el estado de loading
        setIsCompletingOnboarding(false);
      }
    } catch (error) {
      console.error("Error en handleSubmit:", error);
      if (isOnboarding) {
        setIsCompletingOnboarding(false);
      }
      // Asegurar que el loading del hook también se detiene en caso de error
      // El hook ya manejará esto, pero por si acaso
    }

    // Nota: No resetear isCompletingOnboarding aquí si fue exitoso
    // porque la redirección ocurrirá inmediatamente
  };

  const {
    submitting: emailReviewSubmitting,
    submitted: emailReviewSubmitted,
    submitReview: submitEmailReview,
    reset: resetEmailReview,
  } = useEmailReview();

  // Estado para biometría
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [loadingBiometric, setLoadingBiometric] = useState(false);

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

  // Cargar estado de biometría al montar
  useEffect(() => {
    const loadBiometricState = async () => {
      const enabled = await isBiometricEnabled();
      setBiometricEnabledState(enabled);

      const availability = await checkBiometricAvailability();
      setBiometricAvailable(availability.available);
      setBiometricType(availability.type);
    };
    loadBiometricState();
  }, []);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    const screenName = isOnboarding
      ? "ProfileScreen_Onboarding"
      : "ProfileScreen";
    posthogLogger.logScreen(screenName, { isOnboarding });
  }, [isOnboarding]);

  // Manejar cambio de estado de biometría
  const handleBiometricToggle = async () => {
    if (!biometricAvailable) {
      Alert.alert(
        "Biometría no disponible",
        "Tu dispositivo no soporta autenticación biométrica o no está configurada."
      );
      return;
    }

    setLoadingBiometric(true);
    try {
      const newValue = !biometricEnabled;
      const result = await setBiometricEnabled(newValue);

      if (result.success) {
        setBiometricEnabledState(newValue);
        Alert.alert(
          newValue ? "Biometría activada" : "Biometría desactivada",
          newValue
            ? "Ahora podrás usar Face ID/Touch ID para iniciar sesión rápidamente."
            : "Ya no se usará biometría para iniciar sesión."
        );
      } else {
        Alert.alert(
          "Error",
          result.error || "No se pudo cambiar el estado de la biometría."
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error.message || "Ocurrió un error al cambiar la configuración."
      );
    } finally {
      setLoadingBiometric(false);
    }
  };

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
      await loadUserProfile();
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

  const handleShareReferralCode = async () => {
    const code = userProfile?.referral_code;
    if (!code) return;
    try {
      await Share.share({
        message: code,
        title: "Mi código de referido",
      });
    } catch (err) {
      if (err.message !== "User did not share") {
        console.error("Error sharing referral code:", err);
      }
    }
  };

  const handleApplyReferralCode = async () => {
    const normalized = referralCodeInput.trim().toUpperCase();
    const formatOk = /^[A-Z]{5}$/.test(normalized);
    if (!formatOk) {
      setReferralApplyMessage({
        type: "error",
        text: "El código debe tener exactamente 5 letras mayúsculas.",
      });
      return;
    }

    if (!user?.id) return;

    if (!activeRaffle) {
      setReferralApplyMessage({
        type: "error",
        text: "No hay ninguna promoción activa en este momento.",
      });
      return;
    }

    setApplyingReferralCode(true);
    setReferralApplyMessage(null);

    try {
      const { success, error } = await applyReferralCode(
        user.id,
        normalized,
        activeRaffle
      );

      if (!success) {
        setReferralApplyMessage({
          type: "error",
          text: error || "Error al aplicar el código. Inténtalo de nuevo.",
        });
        setApplyingReferralCode(false);
        return;
      }

      setReferralApplyMessage({
        type: "success",
        text: "¡Código aplicado correctamente! Ya participas en la promoción.",
      });
      setReferralCodeInput("");
      setReferralAlreadyApplied(true);
    } catch (err) {
      console.error("Error applying referral code:", err);
      setReferralApplyMessage({
        type: "error",
        text: "Error inesperado. Inténtalo de nuevo.",
      });
    } finally {
      setApplyingReferralCode(false);
    }
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

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Eliminar Cuenta",
      "¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer y se eliminarán todos tus datos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Obtener el usuario actual
              const { success: userSuccess, user: currentUser } =
                await getCurrentUser();

              if (!userSuccess || !currentUser?.id) {
                Alert.alert(
                  "Error",
                  "No se pudo obtener la información del usuario."
                );
                return;
              }

              // Eliminar la cuenta
              const { success, error } = await deleteUserAccount(
                currentUser.id
              );

              if (!success) {
                Alert.alert(
                  "Error",
                  error || "No se pudo eliminar la cuenta. Inténtalo de nuevo."
                );
                return;
              }

              // Cerrar sesión después de eliminar la cuenta
              const { success: signOutSuccess, error: signOutError } =
                await signOut();

              if (!signOutSuccess) {
                console.error(
                  "Error al cerrar sesión después de eliminar:",
                  signOutError
                );
              }

              // Notificar a App.js para que actualice el estado y redirija
              if (onSignOut) {
                await onSignOut();
              }
            } catch (error) {
              console.error("Error al eliminar cuenta:", error);
              Alert.alert(
                "Error",
                "Error al eliminar la cuenta. Inténtalo de nuevo."
              );
            }
          },
        },
      ]
    );
  };

  // Validar email para determinar si el perfil está completo
  const [isEmailValid, setIsEmailValid] = useState(true);

  // Referral / sorteo: solo mostrar si el usuario se creó hace menos de 5 minutos
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const userCreatedAtRaw = user?.created_at ?? userProfile?.created_at;
  const userCreatedAtMs = userCreatedAtRaw
    ? new Date(userCreatedAtRaw).getTime()
    : NaN;
  const showReferralApplySection =
    !Number.isNaN(userCreatedAtMs) &&
    Date.now() - userCreatedAtMs < FIVE_MINUTES_MS;

  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [applyingReferralCode, setApplyingReferralCode] = useState(false);
  const [referralApplyMessage, setReferralApplyMessage] = useState(null);
  const [activeRaffle, setActiveRaffle] = useState(null);
  const [loadingActiveRaffle, setLoadingActiveRaffle] = useState(false);
  const [referralAlreadyApplied, setReferralAlreadyApplied] = useState(false);

  // Refs para inputs y scroll
  const scrollViewRef = useRef(null);
  const nameInputRef = useRef(null);
  const surnameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const workEmailInputRef = useRef(null);
  const referralCodeInputRef = useRef(null);

  // Función helper para hacer scroll a un input cuando recibe foco
  const scrollToInput = (inputRef, offset = 100) => {
    if (!inputRef.current || !scrollViewRef.current) return;

    setTimeout(
      () => {
        inputRef.current?.measureLayout(
          scrollViewRef.current,
          (x, y, width, height) => {
            // Scroll para que el input quede visible con un padding adicional
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, y - offset),
              animated: true,
            });
          },
          () => {
            // Fallback: si measureLayout falla, hacer scroll incremental
            scrollViewRef.current?.scrollTo({
              y: offset,
              animated: true,
            });
          }
        );
      },
      Platform.OS === "ios" ? 250 : 100
    );
  };

  // Cargar raffle activo y comprobar si ya aplicó código (solo si sección visible)
  useEffect(() => {
    if (!showReferralApplySection || !user?.id) return;

    const run = async () => {
      setLoadingActiveRaffle(true);
      try {
        const { success, raffle, error: raffleError } = await getActiveRaffle();
        if (raffleError || !success) {
          setActiveRaffle(null);
          setLoadingActiveRaffle(false);
          return;
        }
        setActiveRaffle(raffle ?? null);

        if (raffle) {
          const { alreadyApplied } = await checkReferralAlreadyApplied(
            raffle.id,
            user.id
          );
          setReferralAlreadyApplied(alreadyApplied);
        }
      } finally {
        setLoadingActiveRaffle(false);
      }
    };

    run();
  }, [showReferralApplySection, user?.id]);

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

  // Determinar si el perfil está completo basándose en los datos guardados (userProfile)
  // Solo mostrar "completo" cuando los datos realmente están guardados en la BD
  const profileComplete = useMemo(() => {
    // Si no hay userProfile, el perfil no puede estar completo (no hay datos guardados)
    if (!userProfile) return false;

    // Verificar si hay cambios sin guardar comparando formData con userProfile
    const hasUnsavedChanges =
      formData.name !== (userProfile.name || "") ||
      formData.surname !== (userProfile.surname || "") ||
      formData.phone !== (userProfile.phone || "") ||
      formData.city !== (userProfile.city || "") ||
      formData.is_student !== (userProfile.is_student || false) ||
      formData.is_resident !== (userProfile.is_resident || false) ||
      formData.is_doctor !== (userProfile.is_doctor || false) ||
      formData.work_email !== (userProfile.work_email || "") ||
      formData.hospital_id !== (userProfile.hospital_id || "") ||
      formData.speciality_id !== (userProfile.speciality_id || "") ||
      formData.resident_year?.toString() !==
        (userProfile.resident_year?.toString() || "");

    // Si hay cambios sin guardar, el perfil no está completo (los cambios no están en BD)
    if (hasUnsavedChanges) return false;

    // Usar userProfile (datos guardados) para determinar si está completo
    return isProfileComplete(userProfile, {
      hasActiveEmailReview,
      isEmailValid,
    });
  }, [userProfile, formData, hasActiveEmailReview, isEmailValid]);

  // Redirigir automáticamente cuando el perfil se completa en modo onboarding
  // Solo si NO estamos en medio de un submit (evita redirección doble)
  useEffect(() => {
    if (
      isOnboarding &&
      profileComplete &&
      userProfile &&
      onProfileComplete &&
      !loading &&
      !loadingProfile &&
      !validatingEmail &&
      !isCompletingOnboarding
    ) {
      console.log("✅ Perfil completo en onboarding, redirigiendo...");
      // Solo redirigir automáticamente si no acabamos de hacer submit
      // Esto previene redirecciones dobles
    }
  }, [
    isOnboarding,
    profileComplete,
    userProfile,
    onProfileComplete,
    loading,
    loadingProfile,
    validatingEmail,
    isCompletingOnboarding,
  ]);

  const isEmailInputDisabled = !formData.hospital_id || !formData.speciality_id;

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
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.headerShell}>
        <View style={styles.header}>
          {!isOnboarding ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <Text style={styles.headerTitle}>
            {isOnboarding ? "Completa tu perfil" : "Mi perfil"}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <View style={styles.contentSurface}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.contentInner}>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>
                {isOnboarding
                  ? "Activa tu perfil en 2 minutos"
                  : "Mantén tu perfil al día"}
              </Text>
              <Text style={styles.heroText}>
                Completa tus datos personales y profesionales para desbloquear
                todas las funciones de la plataforma.
              </Text>
            </View>

            <ProfileStatusCard isComplete={profileComplete} />

            {showReferralApplySection && (loadingActiveRaffle || activeRaffle) && (
              <View style={styles.referralSection}>
                <Text style={styles.referralSectionTitle}>
                  ¿Tienes un código de quien te invitó?
                </Text>
                <Text style={styles.referralSectionHint}>
                  Introduce el código de 5 letras para participar en la promoción
                  actual.
                </Text>
                {loadingActiveRaffle ? (
                  <View style={styles.referralLoadingRow}>
                    <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                    <Text style={styles.referralLoadingText}>
                      Cargando promociones...
                    </Text>
                  </View>
                ) : referralAlreadyApplied ? (
                  <View style={styles.referralSuccessRow}>
                    <Ionicons name="checkmark-circle" size={22} color="#047857" />
                    <Text style={styles.referralSuccessText}>
                      Ya has aplicado un código para esta promoción.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.referralInputRow}>
                    <View style={styles.referralInputContainer}>
                      <TextInput
                        ref={referralCodeInputRef}
                        style={styles.referralCodeInput}
                        placeholder="ABCDE"
                        placeholderTextColor="#94A3B8"
                        value={referralCodeInput}
                        onChangeText={(text) =>
                          setReferralCodeInput(
                            text
                              .replace(/[^A-Za-z]/g, "")
                              .toUpperCase()
                              .slice(0, 5)
                          )
                        }
                        maxLength={5}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        editable={!applyingReferralCode}
                        onFocus={() => scrollToInput(referralCodeInputRef, 150)}
                      />
                    </View>
                    <Button
                      title={
                        applyingReferralCode ? "Aplicando..." : "Aplicar código"
                      }
                      onPress={handleApplyReferralCode}
                      loading={applyingReferralCode}
                      disabled={
                        applyingReferralCode ||
                        referralCodeInput.trim().length !== 5
                      }
                      variant="primary"
                      style={styles.referralApplyButton}
                    />
                  </View>
                )}
                {referralApplyMessage && (
                  <View
                    style={[
                      styles.messageContainer,
                      referralApplyMessage.type === "success"
                        ? styles.messageSuccess
                        : styles.messageError,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        referralApplyMessage.type === "success"
                          ? styles.messageTextSuccess
                          : styles.messageTextError,
                      ]}
                    >
                      {referralApplyMessage.text}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {!isOnboarding && (
              <View style={styles.myReferralSection}>
                <Text style={styles.referralSectionTitle}>
                  Tu código de referido
                </Text>
                {userProfile?.referral_code ? (
                  <TouchableOpacity
                    style={styles.myReferralCodeTouchable}
                    onPress={handleShareReferralCode}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.myReferralCodeText}>
                      {userProfile.referral_code}
                    </Text>
                    <Ionicons
                      name="share-outline"
                      size={22}
                      color={COLORS.PRIMARY}
                    />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.referralMutedText}>
                    Tu código de referido se mostrará aquí cuando esté disponible.
                  </Text>
                )}
              </View>
            )}

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
                    ref={nameInputRef}
                    style={styles.input}
                    placeholder="Tu nombre"
                    value={formData.name}
                    onChangeText={(text) => updateField("name", text)}
                    onFocus={() => scrollToInput(nameInputRef, 120)}
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
                  <TextInput
                    ref={surnameInputRef}
                    style={styles.input}
                    placeholder="Tus apellidos"
                    value={formData.surname}
                    onChangeText={(text) => updateField("surname", text)}
                    onFocus={() => scrollToInput(surnameInputRef, 120)}
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
                    ref={phoneInputRef}
                    style={styles.input}
                    placeholder="+34 600 000 000"
                    value={formData.phone}
                    onChangeText={(text) => updateField("phone", text)}
                    keyboardType="phone-pad"
                    onFocus={() => scrollToInput(phoneInputRef, 120)}
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
                    ref={workEmailInputRef}
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
                    onFocus={() => scrollToInput(workEmailInputRef, 150)}
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

          {/* Security Section */}
          {!isOnboarding && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seguridad</Text>
              <View style={styles.securityOption}>
                <View style={styles.securityOptionContent}>
                  <Ionicons
                    name={
                      biometricType === "Face ID"
                        ? "lock-closed"
                        : "finger-print"
                    }
                    size={24}
                    color={
                      biometricAvailable ? COLORS.PRIMARY : COLORS.TEXT_LIGHT
                    }
                    style={styles.securityIcon}
                  />
                  <View style={styles.securityTextContainer}>
                    <Text style={styles.securityTitle}>
                      {biometricType || "Autenticación biométrica"}
                    </Text>
                    <Text style={styles.securityDescription}>
                      {biometricAvailable
                        ? "Inicia sesión rápidamente usando tu " +
                          (biometricType || "biometría") +
                          " sin necesidad de ingresar tus credenciales cada vez."
                        : "Tu dispositivo no soporta autenticación biométrica o no está configurada."}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleBiometricToggle}
                  disabled={!biometricAvailable || loadingBiometric}
                  style={[
                    styles.toggleSwitch,
                    biometricEnabled && styles.toggleSwitchActive,
                    (!biometricAvailable || loadingBiometric) &&
                      styles.toggleSwitchDisabled,
                  ]}
                >
                  {loadingBiometric ? (
                    <ActivityIndicator size="small" color={COLORS.WHITE} />
                  ) : (
                    <View
                      style={[
                        styles.toggleCircle,
                        biometricEnabled && styles.toggleCircleActive,
                      ]}
                    />
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => onSectionChange("notificationSettings")}
                activeOpacity={0.7}
              >
                <View style={styles.settingsRowContent}>
                  <Ionicons
                    name="notifications-outline"
                    size={24}
                    color={COLORS.PRIMARY}
                    style={styles.securityIcon}
                  />
                  <Text style={styles.settingsRowTitle}>Notificaciones</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.TEXT_LIGHT}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsRow, styles.settingsRowSecond]}
                onPress={() => onSectionChange("notifications")}
                activeOpacity={0.7}
              >
                <View style={styles.settingsRowContent}>
                  <Ionicons
                    name="list-outline"
                    size={24}
                    color={COLORS.PRIMARY}
                    style={styles.securityIcon}
                  />
                  <Text style={styles.settingsRowTitle}>Ver notificaciones</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.TEXT_LIGHT}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsRow, styles.settingsRowSecond]}
                onPress={() => onSectionChange("contacto")}
                activeOpacity={0.7}
              >
                <View style={styles.settingsRowContent}>
                  <Ionicons
                    name="mail-outline"
                    size={24}
                    color={COLORS.PRIMARY}
                    style={styles.securityIcon}
                  />
                  <Text style={styles.settingsRowTitle}>Contacto</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.TEXT_LIGHT}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <Button
                title={
                  loading || validatingEmail || isCompletingOnboarding
                    ? "Guardando..."
                    : isOnboarding
                    ? "Continuar"
                    : "Guardar cambios"
                }
                onPress={handleSubmit}
                loading={loading || validatingEmail || isCompletingOnboarding}
                disabled={loading || validatingEmail || isCompletingOnboarding}
                variant="primary"
                style={styles.saveButton}
              />
              {isOnboarding && (
                <Button
                  title="Eliminar cuenta"
                  onPress={handleDeleteAccount}
                  variant="secondary"
                  style={styles.deleteAccountButton}
                  textStyle={styles.deleteAccountButtonText}
                />
              )}
              {!isOnboarding && (
                <>
                  <Button
                    title="Cerrar sesión"
                    onPress={handleSignOut}
                    variant="secondary"
                    style={styles.signOutButton}
                  />
                  <Button
                    title="Eliminar cuenta"
                    onPress={handleDeleteAccount}
                    variant="secondary"
                    style={styles.deleteAccountButton}
                    textStyle={styles.deleteAccountButtonText}
                  />
                </>
              )}
            </View>

            <View style={styles.versionContainer}>
              <Text style={styles.versionText}>
                Versión {Constants.expoConfig?.version || "N/A"}
              </Text>
            </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentSurface: {
    flex: 1,
    backgroundColor: "#F8F9FE",
  },
  headerShell: {
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#1B0977",
    letterSpacing: -0.2,
    marginHorizontal: 8,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 6,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
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
  signOutButton: {
    flex: 1,
  },
  deleteAccountButton: {
    flex: 1,
    marginTop: 12,
    backgroundColor: "#DC2626",
  },
  deleteAccountButtonText: {
    color: "#FFFFFF",
  },
  securityOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    marginTop: 12,
  },
  settingsRowSecond: {
    marginTop: 12,
  },
  settingsRowContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B0977",
  },
  securityOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  securityIcon: {
    marginRight: 12,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B0977",
    marginBottom: 4,
  },
  securityDescription: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  toggleSwitchDisabled: {
    opacity: 0.5,
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  toggleCircleActive: {
    transform: [{ translateX: 20 }],
  },
  referralSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  referralSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 8,
  },
  referralSectionHint: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 20,
  },
  referralLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  referralLoadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  referralMutedText: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  referralSuccessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  referralSuccessText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#047857",
  },
  referralInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  referralInputContainer: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  referralCodeInput: {
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "700",
    color: "#1B0977",
    letterSpacing: 4,
  },
  referralApplyButton: {
    minWidth: 140,
  },
  myReferralSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  myReferralCodeTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D8C7FF",
    backgroundColor: "#F8F5FF",
  },
  myReferralCodeText: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 4,
    color: "#1B0977",
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 20,
    marginTop: 8,
  },
  versionText: {
    fontSize: 11,
    color: "#8E8E93",
    fontWeight: "400",
  },
});
