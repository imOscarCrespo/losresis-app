import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { COLORS } from "../constants/colors";
import {
  CBI_OPTIONS,
  CBI_QUESTIONS,
  CBI_TOTAL_QUESTIONS,
} from "../constants/cbiQuestionnaire";

/**
 * Cuestionario de la Evaluación de bienestar (CBI). Una pregunta a la vez.
 * No clasifica ni alarma: solo recoge respuestas y las entrega vía onSubmit.
 *
 * @param {(answers: Object) => Promise<any>} onSubmit
 * @param {() => void} onCancel
 * @param {boolean} saving
 */
export default function MentalHealthQuestionnaireScreen({
  onSubmit,
  onCancel,
  saving = false,
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const question = CBI_QUESTIONS[index];
  const isLast = index === CBI_TOTAL_QUESTIONS - 1;
  const selectedValue = answers[question.id];
  const progress = useMemo(
    () => (index + 1) / CBI_TOTAL_QUESTIONS,
    [index]
  );

  const handleSelect = (value) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const handleNext = () => {
    if (selectedValue === undefined) return;
    if (isLast) {
      onSubmit?.(answers);
      return;
    }
    setIndex((prev) => Math.min(prev + 1, CBI_TOTAL_QUESTIONS - 1));
  };

  const handlePrev = () => {
    if (index === 0) {
      onCancel?.();
      return;
    }
    setIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <HeroScreenLayout
      title="Evaluación de bienestar"
      subtitle="Responde con sinceridad. Solo tú ves tus respuestas."
      onBack={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {index + 1} / {CBI_TOTAL_QUESTIONS}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.question}>{question.text}</Text>

          <View style={styles.options}>
            {CBI_OPTIONS.map((option) => {
              const active = selectedValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, active && styles.optionActive]}
                  activeOpacity={0.85}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      active && styles.optionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {active ? (
                    <Icon
                      name="checkmark-circle"
                      size={22}
                      color={COLORS.PRIMARY}
                    />
                  ) : (
                    <View style={styles.optionDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.ghostButton}
            onPress={handlePrev}
            activeOpacity={0.85}
          >
            <Icon name="chevron-back" size={18} color={COLORS.PRIMARY} />
            <Text style={styles.ghostButtonText}>
              {index === 0 ? "Salir" : "Anterior"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (selectedValue === undefined || saving) &&
                styles.primaryButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={selectedValue === undefined || saving}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>
              {isLast ? (saving ? "Guardando..." : "Ver resultado") : "Siguiente"}
            </Text>
            {!isLast && (
              <Icon name="chevron-forward" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.GRAY_LIGHT,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.PRIMARY,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.PRIMARY_DARK,
    minWidth: 44,
    textAlign: "right",
  },
  scrollContent: {
    paddingBottom: 16,
  },
  question: {
    fontSize: 21,
    fontWeight: "800",
    color: COLORS.PRIMARY_DARK,
    lineHeight: 29,
    marginBottom: 22,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
  },
  optionActive: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY_SOFT,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.TEXT_MEDIUM,
  },
  optionLabelActive: {
    color: COLORS.PRIMARY_DARK,
    fontWeight: "800",
  },
  optionDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.GRAY_MEDIUM,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    gap: 12,
  },
  ghostButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.PRIMARY,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
