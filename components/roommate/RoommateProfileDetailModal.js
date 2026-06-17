import React from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import { FALLBACK_ROOMMATE_QUESTIONS } from "../../constants/roommateQuestions";
import {
  ROOMMATE_THEME,
  getBudgetLabel,
  getAnswerInputValue,
  getOptionLabel,
  getRoommateAvatarUrl,
  getRoommateDisplayName,
  getRoommateInitials,
} from "../../utils/roommateUtils";

const QUESTION_LABELS = {
  weekday_vibe: "Entre semana",
  weekend_plan: "Fin de semana",
};

const QUESTION_OPTIONS_BY_CODE = FALLBACK_ROOMMATE_QUESTIONS.reduce((acc, question) => {
  acc[question.code] = question.options || [];
  return acc;
}, {});

const getQuestionOptionLabel = (code, value) => {
  const options = QUESTION_OPTIONS_BY_CODE[code] || [];
  const selectedOption = options.find((option) => option.value === value);
  return selectedOption?.label || value || null;
};

const renderAnswerText = (code, answer) => {
  if (!answer) return null;

  const normalizedValue = getAnswerInputValue(answer);
  if (normalizedValue === null || normalizedValue === undefined || normalizedValue === "") {
    return null;
  }

  if (answer.answer_number !== null && answer.answer_number !== undefined) {
    return `${Math.round(Number(answer.answer_number))}/5`;
  }

  if (answer.answer_options?.length) {
    return answer.answer_options
      .map((value) => getQuestionOptionLabel(code, value))
      .filter(Boolean)
      .join(", ");
  }

  if (Array.isArray(normalizedValue)) {
    return normalizedValue
      .map((value) => getQuestionOptionLabel(code, value))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof normalizedValue === "number") {
    return `${Math.round(Number(normalizedValue))}/5`;
  }

  return getQuestionOptionLabel(code, normalizedValue);
};

const infoRows = (bundle) => {
  const profile = bundle?.profile || {};
  const lifestyle = bundle?.lifestyle || {};
  const search = bundle?.search || {};

  return [
    {
      icon: "briefcase-outline",
      label: "Trabajo",
      value: profile.speciality?.name || profile.occupation_label,
    },
    {
      icon: "people-circle-outline",
      label: "Preferencia de género",
      value: getOptionLabel("gender", search.preferred_gender),
    },
    {
      icon: "business-outline",
      label: "Plan de piso",
      value: getOptionLabel("homePlan", profile.home_plan),
    },
    {
      icon: "moon-outline",
      label: "Ritmo",
      value: getOptionLabel("sleepSchedule", lifestyle.sleep_schedule),
    },
    {
      icon: "people-outline",
      label: "Visitas",
      value: getOptionLabel("guests", lifestyle.guests_frequency),
    },
    {
      icon: "ban-outline",
      label: "Tabaco",
      value: getOptionLabel("smoking", lifestyle.smoking_habit),
    },
    {
      icon: "paw-outline",
      label: "Mascotas",
      value: getOptionLabel("pets", lifestyle.pets),
    },
    {
      icon: "restaurant-outline",
      label: "Cocina",
      value: getOptionLabel("cooking", lifestyle.cooking_habit),
    },
    {
      icon: "wallet-outline",
      label: "Presupuesto",
      value: getBudgetLabel(profile),
    },
  ].filter((item) => item.value);
};

export function RoommateProfileDetailModal({
  visible,
  onClose,
  bundle,
  compatibility,
  actions,
}) {
  if (!bundle) return null;

  const profile = bundle.profile || {};
  const questionEntries = Object.entries(bundle.answers || {}).filter(
    ([code, answer]) => answer && QUESTION_LABELS[code]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.avatar}>
              {getRoommateAvatarUrl(profile.avatar_url) ? (
                <Image
                  source={{ uri: getRoommateAvatarUrl(profile.avatar_url) }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>{getRoommateInitials(profile)}</Text>
              )}
            </View>

            <View style={styles.heroBottom}>
              <View style={styles.compatibilityPill}>
                <Text style={styles.compatibilityText}>
                  {compatibility || 0}% match
                </Text>
              </View>
              <Text style={styles.title}>{getRoommateDisplayName(profile)}</Text>
              <Text style={styles.subtitle}>
                {profile.speciality?.name || profile.occupation_label || "Perfil activo"}
              </Text>
              <Text style={styles.subtitleMuted}>
                {profile.hospital?.name || profile.city}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cómo vive</Text>
            <View style={styles.grid}>
              {infoRows(bundle).map((item) => (
                <View key={item.label} style={styles.infoCard}>
                  <Icon name={item.icon} size={18} color={ROOMMATE_THEME.PRIMARY} />
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {profile.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sobre mí</Text>
              <Text style={styles.bodyText}>{profile.bio}</Text>
            </View>
          ) : null}

          {profile.about_home ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mi casa ideal</Text>
              <Text style={styles.bodyText}>{profile.about_home}</Text>
            </View>
          ) : null}

          {profile.ideal_roommate ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Qué valoro en un roomie</Text>
              <Text style={styles.bodyText}>{profile.ideal_roommate}</Text>
            </View>
          ) : null}

          {profile.dealbreakers ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Límites y no negociables</Text>
              <Text style={styles.bodyText}>{profile.dealbreakers}</Text>
            </View>
          ) : null}

          {questionEntries.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuestionario de convivencia</Text>
              <View style={styles.answerList}>
                {questionEntries.map(([code, answer]) => (
                  <View key={code} style={styles.answerCard}>
                    <Text style={styles.answerLabel}>
                      {QUESTION_LABELS[code] || code}
                    </Text>
                    <Text style={styles.answerValue}>{renderAnswerText(code, answer)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {actions ? <View style={styles.footer}>{actions}</View> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 130,
  },
  hero: {
    minHeight: 340,
    padding: 24,
    justifyContent: "space-between",
    backgroundColor: ROOMMATE_THEME.PRIMARY,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },
  heroBottom: {
    gap: 6,
  },
  compatibilityPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 6,
  },
  compatibilityText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  subtitleMuted: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    color: ROOMMATE_THEME.ACCENT,
    fontSize: 18,
    fontWeight: "900",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoCard: {
    width: "47%",
    backgroundColor: ROOMMATE_THEME.SURFACE,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  infoLabel: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoValue: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  bodyText: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
  },
  answerList: {
    gap: 10,
  },
  answerCard: {
    borderRadius: 16,
    backgroundColor: ROOMMATE_THEME.BACKGROUND,
    padding: 14,
    gap: 6,
  },
  answerLabel: {
    color: ROOMMATE_THEME.MUTED,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  answerValue: {
    color: ROOMMATE_THEME.TEXT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    backgroundColor: "rgba(247,245,251,0.96)",
  },
});
