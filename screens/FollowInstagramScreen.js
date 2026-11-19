import React, { useEffect } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Icon } from "../components/Icon";
import { OnboardingStepLayout } from "../components/onboarding/OnboardingStepLayout";
import { INSTAGRAM_STEP } from "../constants/onboardingSteps";
import { markInstagramFollowOffered } from "../services/authService";
import posthogLogger from "../services/posthogService";
import { INSTAGRAM_URL } from "../utils/instagramFollow";

// Último paso del primer acceso de un residente creado por el hospital
// (2026-11-19): el mismo «Síguenos en Instagram» con el que acaba el onboarding
// normal, que estas cuentas se saltan. Puerta en App.js después de la oferta de
// vincular Google. Siga o no, se apunta `instagram_follow_offered` y no vuelve
// a salir.
export default function FollowInstagramScreen({ onDone }) {
  useEffect(() => {
    posthogLogger.logScreen("FollowInstagramScreen");
  }, []);

  // Sin esperar a guardar la marca: con la red colgada no debe atrapar al
  // usuario. Si no se guardara, da igual: solo sale tras el cambio de
  // contraseña provisional.
  const finish = (event) => {
    markInstagramFollowOffered().catch(() => {});
    posthogLogger.capture(event, { source: "hospital_access" });
    onDone?.();
  };

  const handleFollow = () => {
    Linking.openURL(INSTAGRAM_URL).catch((err) => {
      console.warn("No se pudo abrir Instagram:", err);
    });
    finish("instagram_follow_tapped");
  };

  return (
    <OnboardingStepLayout
      currentStep={0}
      totalSteps={0}
      title={INSTAGRAM_STEP.title}
      subtitle={INSTAGRAM_STEP.subtitle}
      ctaLabel={INSTAGRAM_STEP.cta}
      onCtaPress={handleFollow}
      secondaryLabel={INSTAGRAM_STEP.skipLabel}
      onSecondaryPress={() => finish("instagram_follow_skipped")}
    >
      <View style={styles.block}>
        <View style={styles.icon}>
          <Icon name="logo-instagram" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.body}>
          @losresis · novedades, recursos y vida residente.
        </Text>
      </View>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: "center",
    paddingTop: 20,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
