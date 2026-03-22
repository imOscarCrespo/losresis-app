import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ROOMMATE_FORM_DEFAULTS,
  ROOMMATE_OPTION_SETS,
  ROOMMATE_THEME,
  getRoommateAvatarUrl,
  normalizeBundle,
} from "../../utils/roommateUtils";
import { SelectorModal } from "../SelectorModal";

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

const SCALE_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const sanitizeCityOptions = (options = []) => {
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

const buildStepDefinitions = (questions = []) => [
  {
    title: "Tu plan de piso",
    subtitle: "Lo básico para situarte y activar el matching.",
    render: ({
      bundle,
      updateProfile,
      updateLifestyle,
      updateAnswer,
      cityLabel,
      onOpenCityModal,
      onPickAvatar,
    }) => (
      <>
        <View style={styles.avatarField}>
          <TouchableOpacity
            style={styles.avatarPickerButton}
            onPress={onPickAvatar}
            activeOpacity={0.85}
          >
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
                <Ionicons name="camera-outline" size={24} color={ROOMMATE_THEME.PRIMARY} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.avatarFieldBody}>
            <Text style={styles.avatarFieldTitle}>Foto de perfil</Text>
            <Text style={styles.avatarFieldText}>
              Añade una imagen para que tu perfil roomie sea más reconocible.
            </Text>
            <TouchableOpacity style={styles.avatarCta} onPress={onPickAvatar}>
              <Text style={styles.avatarCtaText}>
                {bundle.profile.avatar_asset?.uri || bundle.profile.avatar_url
                  ? "Cambiar foto"
                  : "Añadir foto"}
              </Text>
            </TouchableOpacity>
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
            style={[styles.citySelectorButton, styles.flexOne]}
            onPress={onOpenCityModal}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business"
              size={16}
              color={bundle.profile.city ? ROOMMATE_THEME.PRIMARY : ROOMMATE_THEME.ACCENT}
            />
            <Text
              style={[
                styles.citySelectorText,
                !bundle.profile.city && styles.citySelectorPlaceholder,
              ]}
              numberOfLines={1}
            >
              {cityLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={bundle.profile.city ? ROOMMATE_THEME.PRIMARY : ROOMMATE_THEME.ACCENT}
            />
          </TouchableOpacity>
        </View>
        <ChoiceRow
          options={ROOMMATE_OPTION_SETS.homePlan}
          value={bundle.profile.home_plan}
          onChange={(value) => updateProfile("home_plan", value)}
        />
        {questions[0] ? (
          <>
            <Text style={styles.questionLabel}>{questions[0].prompt}</Text>
            <ChoiceRow
              options={SCALE_OPTIONS}
              value={bundle.answers[questions[0].code] ?? null}
              onChange={(value) => {
                updateLifestyle("cleanliness_level", value);
                updateAnswer(questions[0].code, value);
              }}
            />
          </>
        ) : null}
      </>
    ),
  },
  {
    title: "Rutina diaria",
    subtitle: "Buscamos afinidad real, no solo una bio bonita.",
    render: ({ bundle, updateLifestyle, updateAnswer, questions }) => (
      <>
        <Text style={styles.fieldTitle}>Tu ritmo</Text>
        <ChoiceRow
          options={ROOMMATE_OPTION_SETS.sleepSchedule}
          value={bundle.lifestyle.sleep_schedule}
          onChange={(value) => {
            updateLifestyle("sleep_schedule", value);
            updateAnswer(questions[1]?.code, value);
          }}
        />
        <Text style={styles.fieldTitle}>Trabajo o estudio desde casa</Text>
        <ChoiceRow
          options={[
            { value: "never", label: "Casi nunca" },
            { value: "sometimes", label: "Algunos días" },
            { value: "often", label: "Muy a menudo" },
          ]}
          value={bundle.lifestyle.work_from_home}
          onChange={(value) => updateLifestyle("work_from_home", value)}
        />
        <Text style={styles.fieldTitle}>Sociabilidad</Text>
        <ChoiceRow
          options={SCALE_OPTIONS}
          value={bundle.lifestyle.sociability_level}
          onChange={(value) => updateLifestyle("sociability_level", value)}
        />
      </>
    ),
  },
  {
    title: "Convivencia real",
    subtitle: "Lo que suele romper una convivencia se decide aquí.",
    render: ({ bundle, updateLifestyle, updateAnswer, questions }) => (
      <>
        <Text style={styles.fieldTitle}>Ambiente entre semana</Text>
        <ChoiceRow
          options={questions[2]?.options || []}
          value={bundle.answers[questions[2]?.code]}
          onChange={(value) => updateAnswer(questions[2]?.code, value)}
        />
        <Text style={styles.fieldTitle}>Visitas</Text>
        <ChoiceRow
          options={ROOMMATE_OPTION_SETS.guests}
          value={bundle.lifestyle.guests_frequency}
          onChange={(value) => updateLifestyle("guests_frequency", value)}
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
    title: "Qué te importa en casa",
    subtitle: "Selecciona las reglas implícitas que para ti no son negociables.",
    render: ({ bundle, updateProfile, updateAnswer, questions }) => (
      <>
        <Text style={styles.fieldTitle}>{questions[3]?.prompt}</Text>
        <ChoiceRow
          options={questions[3]?.options || []}
          value={bundle.answers[questions[3]?.code] || []}
          onChange={(value) => updateAnswer(questions[3]?.code, value)}
          multi
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="¿Cómo te gusta que sea la vida en casa?"
          placeholderTextColor="#94A3B8"
          value={bundle.profile.about_home}
          onChangeText={(value) => updateProfile("about_home", value)}
        />
      </>
    ),
  },
  {
    title: "Lo que buscas",
    subtitle: "Ahora definimos el matching que quieres ver en swipe.",
    render: ({ bundle, updateProfile, updateSearch, updateAnswer, questions }) => (
      <>
        <ChoiceRow
          options={ROOMMATE_OPTION_SETS.lookingFor}
          value={bundle.profile.looking_for}
          onChange={(value) => updateProfile("looking_for", value)}
        />
        <Text style={styles.fieldTitle}>Fin de semana ideal</Text>
        <ChoiceRow
          options={questions[4]?.options || []}
          value={bundle.answers[questions[4]?.code]}
          onChange={(value) => updateAnswer(questions[4]?.code, value)}
        />
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
    title: "Activa tu perfil",
    subtitle: "Un último paso para salir a swipear y aparecer en matches.",
    render: ({ bundle, updateProfile, updateAnswer, questions }) => (
      <>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="Cuéntate en 3-4 líneas. Guardias, hobbies, manías buenas..."
          placeholderTextColor="#94A3B8"
          value={bundle.profile.bio}
          onChangeText={(value) => updateProfile("bio", value)}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="¿Qué te gustaría encontrar en tu próximo compi?"
          placeholderTextColor="#94A3B8"
          value={bundle.answers[questions[5]?.code] || ""}
          onChangeText={(value) => updateAnswer(questions[5]?.code, value)}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="Límites o dealbreakers"
          placeholderTextColor="#94A3B8"
          value={bundle.profile.dealbreakers}
          onChangeText={(value) => updateProfile("dealbreakers", value)}
        />
        <View style={styles.switchCard}>
          <View style={styles.switchBody}>
            <Text style={styles.switchTitle}>Perfil visible</Text>
            <Text style={styles.switchText}>
              Si lo desactivas, podrás seguir editando sin salir en swipe.
            </Text>
          </View>
          <Switch
            value={Boolean(bundle.profile.is_visible)}
            onValueChange={(value) => updateProfile("is_visible", value)}
            trackColor={{ true: ROOMMATE_THEME.PRIMARY }}
          />
        </View>
        <View style={styles.switchCard}>
          <View style={styles.switchBody}>
            <Text style={styles.switchTitle}>Estoy buscando activamente</Text>
            <Text style={styles.switchText}>
              Esto controla si apareces o no en la cola de descubrimiento.
            </Text>
          </View>
          <Switch
            value={Boolean(bundle.profile.is_active)}
            onValueChange={(value) => updateProfile("is_active", value)}
            trackColor={{ true: ROOMMATE_THEME.SECONDARY }}
          />
        </View>
      </>
    ),
  },
];

export function RoommateProfileEditor({
  visible,
  mode = "create",
  questions = [],
  initialBundle,
  cityOptions = [],
  onClose,
  onSave,
  saving = false,
}) {
  const insets = useSafeAreaInsets();
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [bundle, setBundle] = useState(
    normalizeBundle(initialBundle || ROOMMATE_FORM_DEFAULTS)
  );

  React.useEffect(() => {
    if (visible) {
      setBundle(normalizeBundle(initialBundle || ROOMMATE_FORM_DEFAULTS));
      setStepIndex(0);
      setCityModalVisible(false);
    }
  }, [visible, initialBundle]);

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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permisos necesarios",
        "Se necesitan permisos para acceder a la galería de fotos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    updateProfile("avatar_asset", result.assets[0]);
  };

  const resolvedCityOptions = useMemo(() => {
    const cleanedOptions = sanitizeCityOptions(cityOptions);

    if (!bundle.profile.city) {
      return cleanedOptions;
    }

    const cityExists = cleanedOptions.some(
      (option) => (option.id || option.value) === bundle.profile.city
    );

    if (cityExists) {
      return cleanedOptions;
    }

    return [
      { id: bundle.profile.city, name: bundle.profile.city },
      ...cleanedOptions,
    ];
  }, [bundle.profile.city, cityOptions]);

  const stepDefinitions = useMemo(
    () =>
      buildStepDefinitions(questions).map((step) => ({
        ...step,
        render: (renderProps) =>
          step.render({
            ...renderProps,
            questions,
            cityLabel: bundle.profile.city || "Ciudad",
            onOpenCityModal: () => setCityModalVisible(true),
            onPickAvatar: handlePickAvatar,
            updateProfile,
            updateLifestyle,
            updateSearch,
            updateAnswer,
          }),
      })),
    [bundle.profile.avatar_asset, bundle.profile.avatar_url, bundle.profile.city, questions]
  );

  const currentStep = stepDefinitions[stepIndex];
  const isLastStep = stepIndex === stepDefinitions.length - 1;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 28) }]}>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={ROOMMATE_THEME.ACCENT} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {mode === "edit" ? "Editar perfil roomie" : "Crear perfil roomie"}
              </Text>
              <Text style={styles.headerSubtitle}>
                Paso {stepIndex + 1} de {stepDefinitions.length}
              </Text>
            </View>
            <View style={styles.iconPlaceholder} />
          </View>

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

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 104 + Math.max(insets.bottom, 12) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>{currentStep.title}</Text>
              <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
              <View style={styles.stepBody}>{currentStep.render({ bundle })}</View>
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
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
                onPress={() => onSave?.(bundle)}
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
        </KeyboardAvoidingView>

        <SelectorModal
          visible={cityModalVisible}
          onClose={() => setCityModalVisible(false)}
          title="Filtrar por ciudad"
          options={resolvedCityOptions}
          value={bundle.profile.city}
          onSelect={(value) => {
            Keyboard.dismiss();
            updateProfile("city", value);
          }}
          placeholder="Todas las ciudades"
          allowClear={false}
          accentColor={ROOMMATE_THEME.ACCENT}
          primaryColor={ROOMMATE_THEME.PRIMARY}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
  },
  header: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  iconPlaceholder: {
    width: 44,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: ROOMMATE_THEME.ACCENT,
  },
  headerSubtitle: {
    marginTop: 4,
    color: ROOMMATE_THEME.MUTED,
    fontSize: 13,
    fontWeight: "700",
  },
  progressWrap: {
    marginTop: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 8,
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
    minHeight: 110,
    textAlignVertical: "top",
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  avatarCtaText: {
    color: ROOMMATE_THEME.PRIMARY,
    fontSize: 13,
    fontWeight: "800",
  },
  citySelectorButton: {
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
  citySelectorText: {
    flex: 1,
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 14,
    fontWeight: "700",
  },
  citySelectorPlaceholder: {
    color: ROOMMATE_THEME.ACCENT,
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
  switchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderRadius: 18,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
    padding: 16,
  },
  switchBody: {
    flex: 1,
  },
  switchTitle: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 15,
    fontWeight: "900",
  },
  switchText: {
    marginTop: 6,
    color: ROOMMATE_THEME.MUTED,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: "rgba(247,245,251,0.98)",
    flexDirection: "row",
    gap: 12,
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
  pickerModalContainer: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  pickerBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: ROOMMATE_THEME.ACCENT,
  },
  pickerSearchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerSearchInner: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 15,
    color: ROOMMATE_THEME.TEXT,
  },
  pickerListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pickerOption: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerOptionSelected: {
    backgroundColor: "#F8FAFF",
  },
  pickerOptionClear: {
    marginBottom: 8,
    backgroundColor: "#FFF7ED",
  },
  pickerOptionBody: {
    flex: 1,
    paddingVertical: 14,
  },
  pickerOptionName: {
    fontSize: 16,
    fontWeight: "600",
    color: ROOMMATE_THEME.ACCENT,
  },
  pickerOptionNameSelected: {
    color: ROOMMATE_THEME.PRIMARY,
  },
  pickerOptionNameClear: {
    color: "#C2410C",
  },
  pickerEmpty: {
    paddingVertical: 40,
    alignItems: "center",
  },
  pickerEmptyText: {
    fontSize: 14,
    color: ROOMMATE_THEME.MUTED,
  },
  pickerFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFF",
  },
  pickerConfirmBtn: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerConfirmText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFF",
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSelected: {
    borderColor: ROOMMATE_THEME.PRIMARY,
  },
  radioDotUnselected: {
    borderColor: "#CBD5E1",
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ROOMMATE_THEME.PRIMARY,
  },
});
