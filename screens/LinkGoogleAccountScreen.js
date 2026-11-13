import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { COLORS } from "../constants/colors";
import { linkGoogleIdentity, markGoogleLinkOffered } from "../services/authService";
import posthogLogger from "../services/posthogService";

// Oferta única de vincular Google (petición del Hospital de Manresa,
// 2026-11-13). Puerta en App.js justo después de que un residente creado por el
// hospital cambie su contraseña provisional. Tanto si vincula como si dice
// «Ahora no» se apunta `google_link_offered` y no se vuelve a enseñar.
export default function LinkGoogleAccountScreen({ onDone }) {
  const [linking, setLinking] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState(null);
  const busy = linking || skipping;

  useEffect(() => {
    posthogLogger.logScreen("LinkGoogleAccountScreen");
  }, []);

  const handleLink = async () => {
    if (busy) return;
    setLinking(true);
    setError(null);
    const result = await linkGoogleIdentity();
    if (result.success) {
      markGoogleLinkOffered().catch(() => {});
      posthogLogger.capture("google_link_completed");
      setLinked(true);
    } else if (!result.cancelled) {
      posthogLogger.capture("google_link_failed", { error: result.error });
      setError(result.error);
    }
    setLinking(false);
  };

  const handleSkip = async () => {
    if (busy) return;
    setSkipping(true);
    // Sin esperar a guardar la marca: con la red colgada no debe atrapar al
    // usuario. Si no se guardara, da igual: la oferta solo sale tras el cambio
    // de contraseña provisional.
    markGoogleLinkOffered().catch(() => {});
    posthogLogger.capture("google_link_skipped");
    onDone?.();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <HeroScreenLayout title={linked ? "Cuenta vinculada" : "Entra más rápido"}>
        <ScrollView contentContainerStyle={styles.content}>
          {linked ? (
            <>
              <View style={[styles.badge, styles.badgeSuccess]}>
                <Icon name="checkmark" size={28} color={COLORS.SUCCESS} />
              </View>
              <Text style={styles.title}>Tu cuenta de Google está vinculada</Text>
              <Text style={styles.body}>
                La próxima vez puedes entrar con «Continuar con Google». Tu email y tu
                contraseña siguen funcionando.
              </Text>
              <Button
                title="Continuar"
                onPress={onDone}
                style={styles.primary}
              />
            </>
          ) : (
            <>
              <View style={styles.badge}>
                <Icon name="link-outline" size={28} color={COLORS.PRIMARY} />
              </View>
              <Text style={styles.title}>
                Vincula tu cuenta de Google para entrar más rápido la próxima vez
              </Text>
              <Text style={styles.body}>
                Así no tendrás que escribir tu email y tu contraseña. Podrás seguir
                usándolos si lo prefieres.
              </Text>

              {error ? (
                <Text testID="link-google-error" style={styles.error}>
                  {error}
                </Text>
              ) : null}

              <Button
                title="Vincular con Google"
                variant="google"
                onPress={handleLink}
                loading={linking}
                disabled={skipping}
                style={styles.primary}
              />
              <TouchableOpacity
                testID="link-google-skip"
                style={styles.skip}
                onPress={handleSkip}
                disabled={busy}
              >
                <Text style={[styles.skipText, busy && styles.skipDisabled]}>Ahora no</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </HeroScreenLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PRIMARY_LIGHT,
    marginBottom: 18,
  },
  badgeSuccess: {
    backgroundColor: COLORS.SUCCESS_LIGHT,
  },
  title: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
    color: COLORS.PRIMARY_DARK,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.GRAY,
    marginBottom: 24,
  },
  error: {
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.ERROR,
  },
  primary: {
    width: "100%",
    height: 56,
    borderRadius: 16,
  },
  skip: {
    marginTop: 14,
    alignSelf: "center",
    padding: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.GRAY,
  },
  skipDisabled: {
    opacity: 0.5,
  },
});
