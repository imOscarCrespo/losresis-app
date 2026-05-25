import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { useHospitals } from "../hooks/useHospitals";
import {
  getMyRoommateBundle,
  getRoommateQuestions,
  saveRoommateBundle,
} from "../services/roommateService";
import { SelectorModal } from "../components/SelectorModal";
import {
  ROOMMATE_FORM_DEFAULTS,
  ROOMMATE_OPTION_SETS,
  ROOMMATE_THEME,
  getAnswerInputValue,
  getRoommateAvatarUrl,
  normalizeBundle,
} from "../utils/roommateUtils";
import { prepareHospitalOptions } from "../utils/profileOptions";

const ChoiceRow = ({ options, value, onChange, multi = false }) => {
  const handlePress = (optionValue) => {
    if (multi) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter((item) => item !== optionValue));
      } else {
        onChange([...currentValues, optionValue]);
      }
      return;
    }

    onChange(optionValue);
  };

  return (
    <View style={styles.choiceWrap}>
      {options.map((option) => {
        const isActive = multi
          ? Array.isArray(value) && value.includes(option.value)
          : value === option.value;

        return (
          <TouchableOpacity
            key={String(option.value)}
            style={[styles.choicePill, isActive && styles.choicePillActive]}
            onPress={() => handlePress(option.value)}
          >
            <Text
              style={[styles.choiceText, isActive && styles.choiceTextActive]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const sanitizeSelectorOptions = (options = []) => {
  const seen = new Set();

  return options.filter((option) => {
    const id = String(option?.id ?? "").trim();
    const name = String(option?.name ?? "").trim();

    if (!id || !name) {
      return false;
    }

    const key = id.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getQuestionByCode = (questions = [], code) =>
  questions.find((question) => question.code === code);

const ALLOWED_ANSWER_CODES = ["weekday_vibe", "weekend_plan"];

const sanitizeEditorBundle = (bundle) => {
  const normalized = normalizeBundle(bundle);

  return {
    ...normalized,
    answers: Object.fromEntries(
      Object.entries(normalized.answers || {})
        .filter(([code]) => ALLOWED_ANSWER_CODES.includes(code))
        .map(([code, answer]) => [code, getAnswerInputValue(answer)])
    ),
  };
};

const validateBundleBeforeSave = (bundleToValidate) => {
  const city = bundleToValidate?.profile?.city?.trim();
  const hospitalId = bundleToValidate?.profile?.hospital_id?.trim();
  const age = bundleToValidate?.profile?.age;
  const budgetMin = bundleToValidate?.profile?.budget_min_eur;
  const budgetMax = bundleToValidate?.profile?.budget_max_eur;
  const homePlan = bundleToValidate?.profile?.home_plan;
  const preferredGender = bundleToValidate?.search?.preferred_gender;

  if (!hospitalId) {
    return "Selecciona el hospital más cercano para tu perfil.";
  }

  if (!city) {
    return "No se pudo determinar la ciudad desde el hospital seleccionado.";
  }

  if (!homePlan) {
    return "Selecciona tu plan de piso.";
  }

  if (!preferredGender) {
    return "Selecciona una preferencia de género.";
  }

  if (age && Number.isNaN(Number(age))) {
    return "La edad debe ser numérica.";
  }

  if (budgetMin && Number.isNaN(Number(budgetMin))) {
    return "El presupuesto mínimo debe ser numérico.";
  }

  if (budgetMax && Number.isNaN(Number(budgetMax))) {
    return "El presupuesto máximo debe ser numérico.";
  }

  if (
    budgetMin &&
    budgetMax &&
    !Number.isNaN(Number(budgetMin)) &&
    !Number.isNaN(Number(budgetMax)) &&
    Number(budgetMin) > Number(budgetMax)
  ) {
    return "El presupuesto mínimo no puede ser mayor que el máximo.";
  }

  return null;
};

const buildStepDefinitions = () => [
  {
    title: "Tu plan de piso",
    subtitle: "",
    render: ({
      bundle,
      updateProfile,
      cityLabel,
      hospitalLabel,
      onOpenHospitalModal,
      onPickAvatar,
    }) => (
      <>
        <View style={styles.avatarField}>
          <View style={styles.avatarPickerButton}>
            {bundle.profile.avatar_asset?.uri || bundle.profile.avatar_url ? (
              <Image
                source={{
                  uri:
                    bundle.profile.avatar_asset?.uri ||
                    getRoommateAvatarUrl(bundle.profile.avatar_url),
                }}
                style={styles.avatarPreview}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={ROOMMATE_THEME.PRIMARY}
                />
              </View>
            )}
          </View>
          <View style={styles.avatarFieldBody}>
            <Text style={styles.avatarFieldTitle}>Foto de perfil</Text>
            <Text style={styles.avatarFieldText}>
              Añade una imagen para que tu perfil roomie sea más reconocible.
            </Text>
            <TouchableOpacity
              style={styles.avatarCta}
              onPress={onPickAvatar}
              activeOpacity={0.85}
            >
              <Ionicons
                name="camera"
                size={16}
                color="#FFFFFF"
                style={styles.avatarCtaIcon}
              />
              <Text style={styles.avatarCtaText}>
                {bundle.profile.avatar_asset?.uri || bundle.profile.avatar_url
                  ? "Cambiar foto"
                  : "Añadir foto"}
              </Text>
            </TouchableOpacity>
            {bundle.profile.avatar_asset?.uri || bundle.profile.avatar_url ? (
              <Text style={styles.avatarHelperText}>
                Foto seleccionada. Se subirá al activar el perfil.
              </Text>
            ) : null}
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Titular breve. Ej: R2 tranquila buscando piso"
          placeholderTextColor="#94A3B8"
          value={bundle.profile.headline}
          onChangeText={(value) => updateProfile("headline", value)}
        />

        <View style={styles.doubleRow}>
          <TextInput
            style={[styles.input, styles.flexOne]}
            placeholder="Edad"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={bundle.profile.age ? String(bundle.profile.age) : ""}
            onChangeText={(value) => updateProfile("age", value)}
          />
          <TouchableOpacity
            style={[styles.selectorButton, styles.flexOne]}
            onPress={onOpenHospitalModal}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business"
              size={16}
              color={
                bundle.profile.hospital_id
                  ? ROOMMATE_THEME.PRIMARY
                  : ROOMMATE_THEME.ACCENT
              }
            />
            <Text
              style={[
                styles.selectorText,
                !bundle.profile.hospital_id && styles.selectorPlaceholder,
              ]}
              numberOfLines={1}
            >
              {hospitalLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={
                bundle.profile.hospital_id
                  ? ROOMMATE_THEME.PRIMARY
                  : ROOMMATE_THEME.ACCENT
              }
            />
          </TouchableOpacity>
        </View>

        <View style={styles.citySummaryCard}>
          <Text style={styles.citySummaryLabel}>Ciudad del perfil</Text>
          <Text style={styles.citySummaryValue}>{cityLabel}</Text>
          <Text style={styles.citySummaryHint}>
            Se rellena automáticamente a partir del hospital seleccionado.
          </Text>
        </View>

        <ChoiceRow
          options={ROOMMATE_OPTION_SETS.homePlan}
          value={bundle.profile.home_plan}
          onChange={(value) => updateProfile("home_plan", value)}
        />
      </>
    ),
  },
  {
    title: "Convivencia real",
    subtitle: "Solo lo esencial para detectar afinidad en casa.",
    render: ({ bundle, updateLifestyle, updateAnswer, weekdayQuestion }) => (
      <>
        <Text style={styles.questionLabel}>
          {weekdayQuestion?.prompt ||
            "Después del hospital o la facultad, ¿qué ambiente prefieres en casa?"}
        </Text>
        <ChoiceRow
          options={
            weekdayQuestion?.options || [
              { value: "quiet", label: "Tranquilo y silencioso" },
              { value: "balanced", label: "Algo de charla pero con calma" },
              { value: "social", label: "Con vida y planes" },
            ]
          }
          value={bundle.answers[weekdayQuestion?.code]}
          onChange={(value) => updateAnswer(weekdayQuestion?.code, value)}
        />
        <Text style={styles.fieldTitle}>Mascotas</Text>
        <ChoiceRow
          options={ROOMMATE_OPTION_SETS.pets}
          value={bundle.lifestyle.pets}
          onChange={(value) => updateLifestyle("pets", value)}
        />
        <Text style={styles.fieldTitle}>Tabaco</Text>
        <ChoiceRow
          options={ROOMMATE_OPTION_SETS.smoking}
          value={bundle.lifestyle.smoking_habit}
          onChange={(value) => updateLifestyle("smoking_habit", value)}
        />
      </>
    ),
  },
  {
    title: "Preferencias",
    subtitle: "Cerramos el match con presupuesto y plan ideal.",
    render: ({ bundle, updateProfile, updateSearch, updateAnswer, weekendQuestion }) => (
      <>
        <Text style={styles.fieldTitle}>Fin de semana ideal</Text>
        <ChoiceRow
          options={
            weekendQuestion?.options || [
              { value: "stay_in", label: "Casa, descanso y recados" },
              { value: "mixed", label: "Un poco de todo" },
              { value: "go_out", label: "Salir y hacer planes" },
            ]
          }
          value={bundle.answers[weekendQuestion?.code]}
          onChange={(value) => updateAnswer(weekendQuestion?.code, value)}
        />
        <Text style={styles.fieldTitle}>Presupuesto</Text>
        <View style={styles.doubleRow}>
          <TextInput
            style={[styles.input, styles.flexOne]}
            placeholder="Presupuesto min"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={
              bundle.profile.budget_min_eur
                ? String(bundle.profile.budget_min_eur)
                : ""
            }
            onChangeText={(value) => updateProfile("budget_min_eur", value)}
          />
          <TextInput
            style={[styles.input, styles.flexOne]}
            placeholder="Presupuesto max"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={
              bundle.profile.budget_max_eur
                ? String(bundle.profile.budget_max_eur)
                : ""
            }
            onChangeText={(value) => updateProfile("budget_max_eur", value)}
          />
        </View>
        <Text style={styles.fieldTitle}>Preferencia de género</Text>
        <ChoiceRow
          options={ROOMMATE_OPTION_SETS.gender}
          value={bundle.search.preferred_gender}
          onChange={(value) => updateSearch("preferred_gender", value)}
        />
      </>
    ),
  },
  {
    title: "Cuéntanos un poco más sobre ti",
    subtitle:
      "Este campo es opcional, pero te ayudará a encontrar compañeros más afines",
    render: ({ bundle, updateProfile }) => (
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Cuéntanos cómo eres, qué tipo de convivencia buscas o cualquier detalle importante (horarios, orden, hobbies, etc.)"
        placeholderTextColor="#94A3B8"
        multiline
        textAlignVertical="top"
        value={bundle.profile.bio || ""}
        onChangeText={(value) => updateProfile("bio", value)}
      />
    ),
  },
];

export default function CreateRoommateProfileScreen({
  userProfile,
  onBack,
  onSuccess,
}) {
  const { hospitals } = useHospitals();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [mode, setMode] = useState("create");
  const [hospitalModalVisible, setHospitalModalVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [bundle, setBundle] = useState(
    sanitizeEditorBundle(ROOMMATE_FORM_DEFAULTS)
  );

  const hospitalOptions = useMemo(
    () => prepareHospitalOptions(hospitals),
    [hospitals]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [questionsResponse, bundleResponse] = await Promise.all([
          getRoommateQuestions(),
          getMyRoommateBundle(userProfile.id),
        ]);

        if (!active) return;

        if (questionsResponse.success) {
          setQuestions(questionsResponse.questions || []);
        }

        if (
          bundleResponse.success &&
          bundleResponse.bundle?.profile?.user_id
        ) {
          setBundle(sanitizeEditorBundle(bundleResponse.bundle));
          setMode("edit");
        } else {
          setBundle(sanitizeEditorBundle(ROOMMATE_FORM_DEFAULTS));
          setMode("create");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userProfile.id]);

  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permisos necesarios",
          "Se necesitan permisos para acceder a la galería de fotos."
        );
      }
    })();
  }, []);

  const updateProfile = (field, value) => {
    setBundle((current) => ({
      ...current,
      profile: { ...current.profile, [field]: value },
    }));
  };

  const updateLifestyle = (field, value) => {
    setBundle((current) => ({
      ...current,
      lifestyle: { ...current.lifestyle, [field]: value },
    }));
  };

  const updateSearch = (field, value) => {
    setBundle((current) => ({
      ...current,
      search: { ...current.search, [field]: value },
    }));
  };

  const updateAnswer = (code, value) => {
    if (!code) return;
    setBundle((current) => ({
      ...current,
      answers: { ...current.answers, [code]: value },
    }));
  };

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        updateProfile("avatar_asset", result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Error", "No se pudo seleccionar la imagen");
    }
  };

  const handleSave = async () => {
    const isFirstTimeCreation = !bundle.profile.user_id;
    const bundleToSave = {
      ...bundle,
      profile: {
        ...bundle.profile,
        is_active: isFirstTimeCreation ? true : bundle.profile.is_active ?? true,
        is_visible: isFirstTimeCreation ? true : bundle.profile.is_visible ?? true,
      },
    };

    const validationError = validateBundleBeforeSave(bundleToSave);
    if (validationError) {
      Alert.alert("Error", validationError);
      return;
    }

    setSaving(true);
    try {
      const response = await saveRoommateBundle(userProfile.id, bundleToSave);

      if (!response.success) {
        Alert.alert(
          "Error",
          response.error || "No se pudo guardar tu perfil roomie."
        );
        return;
      }

      Alert.alert("Éxito", "Tu perfil roomie se ha guardado correctamente.");
      onSuccess?.();
    } catch (error) {
      Alert.alert(
        "Error",
        error?.message || "Se produjo un error inesperado al guardar el perfil."
      );
    } finally {
      setSaving(false);
    }
  };

  const hospitalsById = useMemo(
    () =>
      (hospitals || []).reduce((acc, hospital) => {
        acc[hospital.id] = hospital;
        return acc;
      }, {}),
    [hospitals]
  );

  const resolvedHospitalOptions = useMemo(() => {
    const cleanedOptions = sanitizeSelectorOptions(hospitalOptions);

    if (!bundle.profile.hospital_id) {
      return cleanedOptions;
    }

    const hospitalExists = cleanedOptions.some(
      (option) => (option.id || option.value) === bundle.profile.hospital_id
    );

    if (hospitalExists) {
      return cleanedOptions;
    }

    const selectedHospital = hospitalsById[bundle.profile.hospital_id];
    return [
      {
        id: bundle.profile.hospital_id,
        name: selectedHospital
          ? `${selectedHospital.name} - ${selectedHospital.city}`
          : bundle.profile.hospital_id,
      },
      ...cleanedOptions,
    ];
  }, [bundle.profile.hospital_id, hospitalOptions, hospitalsById]);

  const selectedHospital = bundle.profile.hospital_id
    ? hospitalsById[bundle.profile.hospital_id]
    : null;
  const hospitalLabel = selectedHospital
    ? `${selectedHospital.name} - ${selectedHospital.city}`
    : "Hospital más cercano";
  const cityLabel = bundle.profile.city || "Selecciona un hospital";

  const weekdayQuestion = useMemo(
    () => getQuestionByCode(questions, "weekday_vibe"),
    [questions]
  );
  const weekendQuestion = useMemo(
    () => getQuestionByCode(questions, "weekend_plan"),
    [questions]
  );

  const stepDefinitions = useMemo(
    () =>
      buildStepDefinitions().map((step) => ({
        ...step,
        render: (renderProps) =>
          step.render({
            ...renderProps,
            questions,
            cityLabel,
            hospitalLabel,
            onOpenHospitalModal: () => setHospitalModalVisible(true),
            onPickAvatar: handlePickAvatar,
            updateProfile,
            updateLifestyle,
            updateSearch,
            updateAnswer,
            weekdayQuestion,
            weekendQuestion,
          }),
      })),
    [
      bundle.profile.avatar_asset,
      bundle.profile.avatar_url,
      bundle.profile.city,
      bundle.profile.hospital_id,
      questions,
      cityLabel,
      hospitalLabel,
      weekdayQuestion,
      weekendQuestion,
    ]
  );

  const currentStep = stepDefinitions[stepIndex];
  const isLastStep = stepIndex === stepDefinitions.length - 1;
  const screenTitle =
    mode === "edit" ? "Editar perfil roomie" : "Crear perfil roomie";
  const screenSubtitle = `Paso ${stepIndex + 1} de ${stepDefinitions.length}`;

  if (loading) {
    return (
      <HeroScreenLayout title={screenTitle} onBack={onBack}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ROOMMATE_THEME.PRIMARY} />
        </View>
      </HeroScreenLayout>
    );
  }

  return (
    <HeroScreenLayout
      title={screenTitle}
      subtitle={screenSubtitle}
      onBack={onBack}
      keyboardAvoiding
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressWrap}>
          {stepDefinitions.map((step, index) => (
            <View
              key={step.title}
              style={[
                styles.progressStep,
                index <= stepIndex && styles.progressStepActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>{currentStep.title}</Text>
          {currentStep.subtitle ? (
            <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
          ) : null}
          <View style={styles.stepBody}>{currentStep.render({ bundle })}</View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, stepIndex === 0 && styles.buttonDisabled]}
            disabled={stepIndex === 0}
            onPress={() => setStepIndex((current) => Math.max(0, current - 1))}
          >
            <Text style={styles.secondaryButtonText}>Atrás</Text>
          </TouchableOpacity>

          {isLastStep ? (
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              disabled={saving}
              onPress={handleSave}
            >
              <Text style={styles.primaryButtonText}>
                {saving
                  ? "Guardando..."
                  : mode === "edit"
                    ? "Guardar"
                    : "Activar perfil"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                setStepIndex((current) =>
                  Math.min(stepDefinitions.length - 1, current + 1)
                )
              }
            >
              <Text style={styles.primaryButtonText}>Siguiente</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <SelectorModal
        visible={hospitalModalVisible}
        onClose={() => setHospitalModalVisible(false)}
        title="Hospital más cercano"
        options={resolvedHospitalOptions}
        value={bundle.profile.hospital_id}
        onSelect={(value) => {
          Keyboard.dismiss();
          const hospital = hospitalsById[value];
          updateProfile("hospital_id", value);
          updateProfile("city", hospital?.city || bundle.profile.city || "");
        }}
        placeholder="Selecciona el hospital más cercano"
        allowClear={false}
        enableSearch
        accentColor={ROOMMATE_THEME.ACCENT}
        primaryColor={ROOMMATE_THEME.PRIMARY}
      />
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressWrap: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  progressStep: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E4DCF8",
  },
  progressStepActive: {
    backgroundColor: ROOMMATE_THEME.PRIMARY,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
  },
  stepCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
  },
  stepTitle: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 26,
    fontWeight: "900",
  },
  stepSubtitle: {
    marginTop: 8,
    color: ROOMMATE_THEME.MUTED,
    fontSize: 15,
    lineHeight: 22,
  },
  stepBody: {
    marginTop: 24,
    gap: 14,
  },
  input: {
    borderRadius: 18,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: ROOMMATE_THEME.TEXT,
    fontSize: 15,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 180,
    paddingTop: 16,
    lineHeight: 22,
  },
  doubleRow: {
    flexDirection: "row",
    gap: 12,
  },
  flexOne: {
    flex: 1,
  },
  avatarField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: ROOMMATE_THEME.SURFACE,
  },
  avatarPickerButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPreview: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  avatarFieldBody: {
    flex: 1,
    gap: 8,
  },
  avatarFieldTitle: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 15,
    fontWeight: "900",
  },
  avatarFieldText: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 13,
    lineHeight: 20,
  },
  avatarCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
  },
  avatarCtaIcon: {
    marginRight: 6,
  },
  avatarCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  avatarHelperText: {
    marginTop: 10,
    color: ROOMMATE_THEME.MUTED,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  selectorButton: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9DFFB",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectorText: {
    flex: 1,
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 14,
    fontWeight: "700",
  },
  selectorPlaceholder: {
    color: ROOMMATE_THEME.ACCENT,
  },
  citySummaryCard: {
    borderRadius: 20,
    backgroundColor: "#F4F0FF",
    padding: 16,
    gap: 4,
  },
  citySummaryLabel: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  citySummaryValue: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 16,
    fontWeight: "800",
  },
  citySummaryHint: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  fieldTitle: {
    marginTop: 4,
    color: ROOMMATE_THEME.MUTED,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  questionLabel: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 16,
    fontWeight: "800",
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
  },
  choicePillActive: {
    backgroundColor: ROOMMATE_THEME.PRIMARY,
  },
  choiceText: {
    color: ROOMMATE_THEME.ACCENT,
    fontWeight: "700",
    fontSize: 13,
  },
  choiceTextActive: {
    color: "#FFFFFF",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 15,
    fontWeight: "900",
  },
  primaryButton: {
    flex: 1.3,
    borderRadius: 18,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
