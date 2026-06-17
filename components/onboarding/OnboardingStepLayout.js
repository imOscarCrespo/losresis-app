import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon } from "../Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/colors";
import { OnboardingProgressBar } from "./OnboardingProgressBar";

export const OnboardingStepLayout = ({
  currentStep,
  totalSteps,
  stepLabel,
  onBack,
  title,
  subtitle,
  children,
  ctaLabel = "Siguiente",
  onCtaPress,
  ctaDisabled = false,
  ctaLoading = false,
  ctaHidden = false,
  secondaryLabel,
  onSecondaryPress,
  footerHint,
  errorText,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <OnboardingProgressBar
          currentStep={currentStep}
          totalSteps={totalSteps}
        />
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.backButton}
            accessibilityLabel="Volver"
          >
            <Icon name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {stepLabel ? <Text style={styles.eyebrow}>{stepLabel}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {footerHint ? (
            <Text style={styles.footerHint}>{footerHint}</Text>
          ) : null}
          {secondaryLabel ? (
            <Pressable
              onPress={onSecondaryPress}
              style={styles.secondaryButton}
              disabled={ctaLoading}
            >
              <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
          {!ctaHidden ? (
            <Pressable
              onPress={onCtaPress}
              disabled={ctaDisabled || ctaLoading}
              style={[
                styles.ctaButton,
                (ctaDisabled || ctaLoading) && styles.ctaButtonDisabled,
              ]}
            >
              {ctaLoading ? (
                <ActivityIndicator color={COLORS.PRIMARY} />
              ) : (
                <Text style={styles.ctaLabel}>{ctaLabel}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
  },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 10,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 24,
  },
  body: {
    flex: 1,
  },
  errorText: {
    marginTop: 12,
    color: "#FECACA",
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
  },
  footerHint: {
    textAlign: "center",
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginBottom: 4,
  },
  ctaButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },
});
