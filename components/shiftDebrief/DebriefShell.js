import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { HeroScreenLayout } from "../HeroScreenLayout";

/**
 * El marco de cada pantalla de la postguardia: cabecera, barra de progreso
 * opcional, contenido con scroll y un botón principal abajo, grande y fácil de
 * pulsar (el residente viene de una guardia larga).
 */
export const DebriefShell = ({
  title,
  subtitle = null,
  onBack,
  rightSlot = null,
  step = null,
  totalSteps = 4,
  primaryLabel = null,
  onPrimary = null,
  primaryDisabled = false,
  saving = false,
  secondaryLabel = null,
  onSecondary = null,
  children,
  overlay = null,
  testID,
}) => (
  <HeroScreenLayout
    title={title}
    subtitle={subtitle}
    onBack={onBack}
    rightSlot={rightSlot}
    overlay={overlay}
    keyboardAvoiding
  >
    <View style={styles.surface} testID={testID}>
      {step ? (
        <View style={styles.progress}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(step / totalSteps) * 100}%` },
              ]}
            />
          </View>
          <Text
            style={styles.progressText}
          >{`Paso ${step} de ${totalSteps}`}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {primaryLabel ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (primaryDisabled || saving) && styles.primaryButtonDisabled,
            ]}
            onPress={onPrimary}
            disabled={primaryDisabled || saving}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            )}
          </TouchableOpacity>
          {secondaryLabel && onSecondary ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSecondary}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  </HeroScreenLayout>
);

export default DebriefShell;

export const debriefStyles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: "#1B0977", lineHeight: 28 },
  lead: { fontSize: 14, color: "#64748B", lineHeight: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1B0977",
    marginTop: 4,
  },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
    gap: 10,
  },
  ghostButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#F1EBFF",
  },
  ghostButtonText: { fontSize: 14, fontWeight: "700", color: "#670CF5" },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
  },
  privacy: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  privacyText: { flex: 1, fontSize: 12, color: "#0369A1", lineHeight: 17 },
});

const styles = StyleSheet.create({
  surface: { flex: 1, backgroundColor: "#F8F9FE" },
  progress: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4, gap: 6 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E9E3FB",
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: "#670CF5" },
  progressText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textAlign: "center",
  },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "#E8EAF3",
    backgroundColor: "#FFFFFF",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 14, fontWeight: "700", color: "#670CF5" },
});
