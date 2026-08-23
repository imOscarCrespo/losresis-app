import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../constants/colors";
import { getOnboardingSteps } from "../constants/onboardingSteps";
import {
  LANDLORD_PORTAL_LABEL,
  LANDLORD_PORTAL_URL,
} from "../constants/housing";
import { RESIDENT_YEAR_OPTIONS } from "../constants/profileConstants";
import { OnboardingStepLayout } from "../components/onboarding/OnboardingStepLayout";
import { OnboardingUserTypeCards } from "../components/onboarding/OnboardingUserTypeCards";
import { SelectFilter } from "../components/SelectFilter";
import { useHospitals } from "../hooks/useHospitals";
import { useEmailDomainValidation } from "../hooks/useEmailDomainValidation";
import { useEmailReview } from "../hooks/useEmailReview";
import { updateUserProfile } from "../services/userService";
import { uploadRoommateAvatar } from "../services/roommateService";
import { MOCK_SOURCES } from "../services/mirProjectionService";
import { getResidentTransitionConfig } from "../services/residentTransitionConfigService";
import { prepareCityOptions } from "../utils/profileOptions";
import {
  canResidentUseSeasonalGrace,
  RESIDENT_STATE,
} from "../utils/residentAccess";
import {
  shouldDiscardInvalidWorkEmailDuringGrace,
  shouldShowEmailReview,
} from "../utils/profileValidation";
import posthogLogger from "../services/posthogService";

const MIR_ACADEMY_NONE = "none";
const MIR_ACADEMY_OPTIONS = [
  { id: MIR_ACADEMY_NONE, name: "Aún no tengo academia" },
  ...MOCK_SOURCES,
];

const INITIAL_ANSWERS = {
  userType: "",
  name: "",
  surname: "",
  city: "",
  phone: "",
  mir_academy: "",
  hospital_id: "",
  speciality_id: "",
  resident_year: "",
  work_email: "",
  resident_state: null,
  resident_transition_expires_at: null,
  avatar_asset: null,
};

const buildProfilePayload = (answers) => {
  const isStudent = answers.userType === "student";
  const isResident = answers.userType === "resident";

  const payload = {
    name: answers.name,
    surname: answers.surname,
    city: answers.city,
    phone: answers.phone,
    is_student: isStudent,
    is_resident: isResident,
    is_doctor: false,
    // El alta de anunciantes se hace en el portal de propietarios, nunca desde
    // el onboarding de la app.
    is_host: false,
    mir_academy:
      isStudent && answers.mir_academy !== MIR_ACADEMY_NONE
        ? answers.mir_academy
        : "",
    hospital_id: isResident ? answers.hospital_id : "",
    speciality_id: isResident ? answers.speciality_id : "",
    resident_year: isResident ? answers.resident_year : "",
    work_email: isResident ? answers.work_email : "",
    onboarding_completed: true,
  };

  if (isResident) {
    payload.resident_state = answers.resident_state;
    payload.resident_transition_expires_at =
      answers.resident_transition_expires_at;
  }

  return payload;
};

export default function OnboardingScreen({ userId, onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showEmailReviewSection, setShowEmailReviewSection] = useState(false);
  const [transitionConfig, setTransitionConfig] = useState(null);

  const { hospitals, specialties, uniqueCities } = useHospitals();
  const cityOptions = useMemo(
    () => prepareCityOptions(uniqueCities),
    [uniqueCities]
  );
  const { validateEmailDomain, loading: validatingEmail } =
    useEmailDomainValidation();
  const {
    submitting: submittingReview,
    submitted: reviewSubmitted,
    submitReview,
    reset: resetReview,
  } = useEmailReview();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { config } = await getResidentTransitionConfig();
      if (!cancelled) setTransitionConfig(config || null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const steps = useMemo(
    () => getOnboardingSteps(answers.userType),
    [answers.userType]
  );

  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const currentStep = steps[safeIndex];
  const totalSteps = steps.length;

  const setAnswer = useCallback((field, value) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleBack = useCallback(() => {
    setSubmitError(null);
    setShowEmailReviewSection(false);
    resetReview();
    setStepIndex((idx) => Math.max(0, idx - 1));
  }, [resetReview]);

  const finishOnboarding = useCallback(async () => {
    if (!userId) {
      Alert.alert("Error", "No se ha podido identificar al usuario.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildProfilePayload(answers);

      if (answers.avatar_asset?.uri) {
        const uploadResult = await uploadRoommateAvatar(
          userId,
          answers.avatar_asset
        );
        if (uploadResult.success) {
          payload.avatar_url = uploadResult.path;
        } else {
          console.warn("Error subiendo avatar:", uploadResult.error);
        }
      }

      const { success, error } = await updateUserProfile(userId, payload);
      if (!success) {
        setSubmitError(error || "No se ha podido guardar tu perfil.");
        setSubmitting(false);
        return;
      }
      posthogLogger.capture("Onboarding Completed", {
        user_type: answers.userType,
        completed_at: new Date().toISOString(),
      });
      onComplete?.();
    } catch (err) {
      console.error("Error completing onboarding:", err);
      setSubmitError("No se ha podido guardar tu perfil. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  }, [answers, onComplete, userId]);

  const advance = useCallback(() => {
    setSubmitError(null);
    setShowEmailReviewSection(false);
    resetReview();
    setStepIndex((idx) => Math.min(idx + 1, steps.length - 1));
  }, [resetReview, steps.length]);

  // Aplica al avanzar el paso workEmail: replica la lógica de useProfileForm.handleSubmit
  // (gracia → descartar email + PENDING; sin gracia → bloquear o mostrar revisión manual).
  const handleWorkEmailNext = useCallback(
    async ({ skip = false } = {}) => {
      const profileLike = {
        is_resident: true,
        resident_year: answers.resident_year,
        hospital_id: answers.hospital_id,
        work_email: skip ? "" : answers.work_email,
      };
      const inGrace = canResidentUseSeasonalGrace(profileLike, transitionConfig);
      const email = skip ? "" : answers.work_email?.trim() || "";

      if (!email) {
        if (!inGrace) {
          setSubmitError(
            "Necesitas tu correo corporativo para activar el perfil de residente fuera de la ventana temporal MIR."
          );
          return;
        }
        setAnswers((prev) => ({
          ...prev,
          work_email: "",
          resident_state: RESIDENT_STATE.PENDING_CORPORATE_EMAIL_SEASONAL,
          resident_transition_expires_at:
            transitionConfig?.ends_at || null,
        }));
        advance();
        return;
      }

      const emailValidation = await validateEmailDomain(
        email,
        answers.hospital_id
      );
      if (emailValidation.isValid) {
        setAnswers((prev) => ({
          ...prev,
          work_email: email,
          resident_state: null,
          resident_transition_expires_at: null,
        }));
        advance();
        return;
      }

      const formLike = {
        is_resident: true,
        resident_year: answers.resident_year,
        hospital_id: answers.hospital_id,
        work_email: email,
      };

      if (
        shouldDiscardInvalidWorkEmailDuringGrace(
          formLike,
          emailValidation,
          transitionConfig
        )
      ) {
        setAnswers((prev) => ({
          ...prev,
          work_email: "",
          resident_state: RESIDENT_STATE.PENDING_CORPORATE_EMAIL_SEASONAL,
          resident_transition_expires_at:
            transitionConfig?.ends_at || null,
        }));
        advance();
        return;
      }

      if (shouldShowEmailReview(formLike, emailValidation)) {
        setShowEmailReviewSection(true);
        setSubmitError(null);
        return;
      }

      setSubmitError(
        emailValidation.error || "Error al validar el email de trabajo."
      );
    },
    [
      advance,
      answers.hospital_id,
      answers.resident_year,
      answers.work_email,
      transitionConfig,
      validateEmailDomain,
    ]
  );

  const handleFollowInstagram = useCallback(async () => {
    try {
      await Linking.openURL("https://www.instagram.com/losresis/");
    } catch (err) {
      console.warn("No se pudo abrir Instagram:", err);
    }
    finishOnboarding();
  }, [finishOnboarding]);

  const handleNext = useCallback(async () => {
    if (!currentStep) return;
    setSubmitError(null);
    if (currentStep.kind === "instagram") {
      await handleFollowInstagram();
      return;
    }
    if (
      currentStep.id === "workEmail" &&
      answers.userType === "resident"
    ) {
      await handleWorkEmailNext();
      return;
    }
    advance();
  }, [
    advance,
    answers.userType,
    currentStep,
    handleFollowInstagram,
    handleWorkEmailNext,
  ]);

  const handleSkip = useCallback(() => {
    if (currentStep?.kind === "instagram") {
      finishOnboarding();
      return;
    }
    if (
      currentStep?.id === "workEmail" &&
      answers.userType === "resident"
    ) {
      handleWorkEmailNext({ skip: true });
      return;
    }
    if (currentStep?.field) setAnswer(currentStep.field, "");
    advance();
  }, [
    advance,
    answers.userType,
    currentStep,
    finishOnboarding,
    handleWorkEmailNext,
    setAnswer,
  ]);

  const handleUserTypePick = useCallback(
    (type) => {
      // Los anunciantes de vivienda ya no se registran en la app: se les manda
      // al portal de propietarios y el onboarding se queda donde está.
      if (type === "host") {
        posthogLogger.capture("housing_landlord_portal_opened", {
          from: "onboarding_user_type",
        });
        Linking.openURL(LANDLORD_PORTAL_URL).catch(() => {
          Alert.alert(
            "No se pudo abrir el portal",
            `Entra en ${LANDLORD_PORTAL_LABEL} desde tu navegador para publicar tu vivienda.`
          );
        });
        return;
      }
      setAnswers((prev) => ({ ...prev, userType: type }));
      // Auto-advance al siguiente paso una vez elegido el tipo.
      setStepIndex((idx) => idx + 1);
    },
    []
  );

  const handlePickAvatar = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permisos necesarios",
          "Se necesitan permisos para acceder a la galería de fotos."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setAnswer("avatar_asset", result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Error", "No se pudo seleccionar la imagen");
    }
  }, [setAnswer]);

  const handleSubmitReviewRequest = useCallback(async () => {
    const email = answers.work_email?.trim();
    if (!email || !userId) return;
    const { success, error } = await submitReview(userId, email);
    if (!success) {
      setSubmitError(error || "No se pudo enviar la solicitud de revisión.");
      return;
    }
    // Quedamos en PENDING manual hasta que el admin resuelva la review. El
    // estado deriva de la fila en user_email_review_requests, no de
    // resident_state (que sólo modela la ventana de gracia MIR).
    setAnswers((prev) => ({
      ...prev,
      work_email: email,
      resident_state: null,
      resident_transition_expires_at: null,
    }));
    setSubmitError(null);
    // Pequeño delay para que el usuario vea el "Solicitud enviada ✓" antes de avanzar.
    setTimeout(() => {
      setShowEmailReviewSection(false);
      advance();
    }, 700);
  }, [advance, answers.work_email, submitReview, userId]);

  const handleCancelReview = useCallback(() => {
    setShowEmailReviewSection(false);
    setSubmitError(null);
    resetReview();
  }, [resetReview]);

  // El email corporativo solo es opcional si el residente está dentro del periodo
  // de gracia MIR. Fuera de la ventana, lo tratamos como obligatorio para no
  // ofrecer un "Saltar" que de todas formas terminaría en error al avanzar.
  const isWorkEmailStep =
    currentStep?.id === "workEmail" && answers.userType === "resident";
  const workEmailInGrace = isWorkEmailStep
    ? canResidentUseSeasonalGrace(
        { is_resident: true, resident_year: answers.resident_year },
        transitionConfig
      )
    : false;
  const stepOptional = isWorkEmailStep
    ? workEmailInGrace
    : Boolean(currentStep?.optional);

  const currentValue = currentStep?.field ? answers[currentStep.field] : null;
  let validationError = currentStep?.validate
    ? currentStep.validate(currentValue)
    : null;
  if (isWorkEmailStep && !workEmailInGrace && !answers.work_email?.trim()) {
    validationError = "Introduce tu email corporativo para continuar.";
  }
  const ctaDisabled = Boolean(validationError) && !stepOptional;

  if (!currentStep) return null;

  const renderBody = () => {
    switch (currentStep.kind) {
      case "userType":
        return (
          <OnboardingUserTypeCards
            selectedType={answers.userType}
            onSelect={handleUserTypePick}
          />
        );
      case "text": {
        if (currentStep.id === "workEmail") {
          return (
            <View style={styles.workEmailBlock}>
              <TextInput
                value={answers.work_email || ""}
                onChangeText={(text) => {
                  setAnswer("work_email", text);
                  if (showEmailReviewSection) {
                    setShowEmailReviewSection(false);
                    resetReview();
                  }
                }}
                placeholder={currentStep.placeholder}
                placeholderTextColor="rgba(255,255,255,0.45)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.textInput}
                returnKeyType="done"
                editable={!showEmailReviewSection}
              />
              {showEmailReviewSection ? (
                <View style={styles.reviewHint}>
                  <Icon
                    name="time-outline"
                    size={18}
                    color="rgba(255,255,255,0.85)"
                    style={styles.reviewHintIcon}
                  />
                  <Text style={styles.reviewHintText}>
                    {reviewSubmitted
                      ? "Solicitud enviada. Te avisaremos por email en cuanto la validemos."
                      : "Revisaremos este correo manualmente. Te avisaremos por email en menos de 1 hora."}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }
        return (
          <TextInput
            value={answers[currentStep.field] || ""}
            onChangeText={(text) => setAnswer(currentStep.field, text)}
            placeholder={currentStep.placeholder}
            placeholderTextColor="rgba(255,255,255,0.45)"
            keyboardType={currentStep.keyboardType || "default"}
            autoCapitalize={currentStep.autoCapitalize || "sentences"}
            autoCorrect={false}
            style={styles.textInput}
            returnKeyType={
              currentStep.keyboardType === "phone-pad" ||
              currentStep.keyboardType === "number-pad" ||
              currentStep.keyboardType === "numeric"
                ? "none"
                : "done"
            }
          />
        );
      }
      case "city":
        return (
          <View style={styles.selectWrap}>
            <SelectFilter
              label="Ciudad"
              value={answers.city}
              onSelect={(value) => setAnswer("city", value)}
              options={cityOptions}
              placeholder="Selecciona tu ciudad"
              required
            />
          </View>
        );
      case "mirAcademy":
        return (
          <View style={styles.selectWrap}>
            <SelectFilter
              label="Academia"
              value={answers.mir_academy}
              onSelect={(value) => setAnswer("mir_academy", value)}
              options={MIR_ACADEMY_OPTIONS}
              placeholder="Selecciona tu academia"
              enableSearch={false}
            />
          </View>
        );
      case "hospital":
        return (
          <View style={styles.selectWrap}>
            <SelectFilter
              label="Hospital"
              value={answers.hospital_id}
              onSelect={(value) => setAnswer("hospital_id", value)}
              options={hospitals}
              placeholder="Buscar hospital..."
              required
            />
          </View>
        );
      case "speciality":
        return (
          <View style={styles.selectWrap}>
            <SelectFilter
              label="Especialidad"
              value={answers.speciality_id}
              onSelect={(value) => setAnswer("speciality_id", value)}
              options={specialties}
              placeholder="Selecciona especialidad"
              required
            />
          </View>
        );
      case "residentYear":
        return (
          <View style={styles.selectWrap}>
            <SelectFilter
              label="Año de residencia"
              value={answers.resident_year}
              onSelect={(value) => setAnswer("resident_year", value)}
              options={RESIDENT_YEAR_OPTIONS}
              placeholder="Selecciona año"
              enableSearch={false}
              required
            />
          </View>
        );
      case "avatar": {
        const asset = answers.avatar_asset;
        return (
          <View style={styles.avatarBlock}>
            <View style={styles.avatarPreviewWrap}>
              {asset?.uri ? (
                <Image source={{ uri: asset.uri }} style={styles.avatarPreview} />
              ) : (
                <Icon name="camera-outline" size={36} color="#FFFFFF" />
              )}
            </View>
            <Pressable
              onPress={handlePickAvatar}
              style={({ pressed }) => [
                styles.avatarCta,
                pressed && styles.avatarCtaPressed,
              ]}
            >
              <Icon
                name="camera"
                size={16}
                color={COLORS.PRIMARY}
                style={styles.avatarCtaIcon}
              />
              <Text style={styles.avatarCtaText}>
                {asset?.uri ? "Cambiar foto" : "Añadir foto"}
              </Text>
            </Pressable>
            {asset?.uri ? (
              <Text style={styles.avatarHelper}>
                Foto seleccionada. Se subirá al finalizar el onboarding.
              </Text>
            ) : null}
          </View>
        );
      }
      case "done":
        return (
          <View style={styles.doneBlock}>
            <View style={styles.doneIcon}>
              <Icon name="checkmark" size={42} color="#FFFFFF" />
            </View>
            <Text style={styles.doneBody}>
              Hemos guardado tu información. Ya puedes empezar a usar la app.
            </Text>
          </View>
        );
      case "instagram":
        return (
          <View style={styles.doneBlock}>
            <View style={styles.instagramIcon}>
              <Icon name="logo-instagram" size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.doneBody}>
              @losresis · novedades, recursos y vida residente.
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  const showCta = currentStep.kind !== "userType";
  const showSkip =
    showEmailReviewSection ||
    (stepOptional &&
      currentStep.kind !== "userType" &&
      currentStep.kind !== "done");

  const ctaLabelOverride = showEmailReviewSection
    ? reviewSubmitted
      ? "Solicitud enviada ✓"
      : "Solicitar revisión manual"
    : null;
  const secondaryLabelOverride = showEmailReviewSection ? "Editar email" : null;
  const ctaDisabledOverride = showEmailReviewSection
    ? submittingReview || reviewSubmitted
    : ctaDisabled;
  const ctaLoadingOverride = showEmailReviewSection
    ? submittingReview
    : submitting || validatingEmail;
  const onCtaPressOverride = showEmailReviewSection
    ? handleSubmitReviewRequest
    : handleNext;
  const onSecondaryPressOverride = showEmailReviewSection
    ? handleCancelReview
    : handleSkip;
  const isTerminal =
    currentStep.kind === "done" || currentStep.kind === "instagram";

  return (
    <OnboardingStepLayout
      currentStep={safeIndex}
      totalSteps={totalSteps}
      stepLabel={`PASO ${safeIndex + 1} DE ${totalSteps}`}
      onBack={safeIndex > 0 && !isTerminal ? handleBack : null}
      title={currentStep.title}
      subtitle={currentStep.subtitle}
      ctaLabel={
        ctaLabelOverride ||
        currentStep.cta ||
        (stepOptional ? "Continuar" : "Siguiente")
      }
      ctaDisabled={ctaDisabledOverride}
      ctaLoading={ctaLoadingOverride}
      ctaHidden={!showCta}
      onCtaPress={onCtaPressOverride}
      secondaryLabel={
        showSkip
          ? secondaryLabelOverride || currentStep.skipLabel || "Saltar"
          : null
      }
      onSecondaryPress={onSecondaryPressOverride}
      footerHint={currentStep.footerHint}
      errorText={submitError}
    >
      {renderBody()}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  textInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
  },
  workEmailBlock: {
    gap: 12,
  },
  reviewHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewHintIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  reviewHintText: {
    flex: 1,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 18,
  },
  selectWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
  },
  doneBlock: {
    alignItems: "center",
    paddingTop: 20,
  },
  avatarBlock: {
    alignItems: "center",
    paddingTop: 8,
  },
  avatarPreviewWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 20,
  },
  avatarPreview: {
    width: "100%",
    height: "100%",
  },
  avatarCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  avatarCtaPressed: {
    opacity: 0.85,
  },
  avatarCtaIcon: {
    marginRight: 8,
  },
  avatarCtaText: {
    color: COLORS.PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
  avatarHelper: {
    marginTop: 14,
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textAlign: "center",
  },
  doneIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  instagramIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  doneBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
