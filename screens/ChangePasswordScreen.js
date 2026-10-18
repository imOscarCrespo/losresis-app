import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { COLORS } from "../constants/colors";
import { signOut, updatePassword } from "../services/authService";
import posthogLogger from "../services/posthogService";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "../utils/passwordAccess";

// Cambio de contraseña de las cuentas que crea el hospital (Trello #100).
// mode="required": puerta en App.js mientras la contraseña sea la provisional.
// mode="profile": desde Perfil, con botón volver.
export default function ChangePasswordScreen({
  mode = "profile",
  onPasswordChanged,
  onBack,
  onSignOut,
}) {
  const required = mode === "required";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const confirmationRef = useRef(null);

  useEffect(() => {
    posthogLogger.logScreen("ChangePasswordScreen");
  }, []);

  const handleSubmit = async () => {
    if (saving) return;
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updatePassword(password);
    setSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    posthogLogger.capture("Password Changed", { mode });
    setPassword("");
    setConfirmation("");
    if (!required) {
      Alert.alert("Contraseña cambiada", "Ya puedes entrar con tu nueva contraseña.");
    }
    onPasswordChanged?.();
  };

  const handleSignOut = async () => {
    await signOut();
    onSignOut?.();
  };

  const content = (
    <HeroScreenLayout
      title={required ? "Elige tu contraseña" : "Cambiar contraseña"}
      onBack={required ? null : onBack}
      keyboardAvoiding
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {required ? (
          <Text style={styles.intro}>
            Antes de empezar, cambia la contraseña provisional por una que solo
            sepas tú.
          </Text>
        ) : null}

        <Text style={styles.label}>Nueva contraseña</Text>
        <View style={styles.passwordRow}>
          <TextInput
            testID="new-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmationRef.current?.focus()}
            placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            placeholderTextColor={COLORS.GRAY_MEDIUM}
            style={[styles.input, styles.passwordInput]}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            <Icon
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={COLORS.GRAY}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Repite la contraseña</Text>
        <TextInput
          testID="new-password-confirmation"
          ref={confirmationRef}
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          placeholder="Repite la contraseña"
          placeholderTextColor={COLORS.GRAY_MEDIUM}
          style={styles.input}
        />

        {error ? (
          <Text testID="change-password-error" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button
          title="Guardar contraseña"
          onPress={handleSubmit}
          loading={saving}
          style={styles.submit}
        />

        {required ? (
          <TouchableOpacity style={styles.signOut} onPress={handleSignOut} disabled={saving}>
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </HeroScreenLayout>
  );

  // Como puerta en App.js se pinta sin ScreenLayout: hace falta el inset top
  // (igual que ProfileEditScreen en la puerta del email rechazado).
  if (required) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        {content}
      </SafeAreaView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  intro: {
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.GRAY_DARK,
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    backgroundColor: COLORS.WHITE,
    fontSize: 15,
    color: COLORS.GRAY_DARK,
  },
  passwordRow: {
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 14,
    padding: 2,
  },
  error: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.ERROR,
  },
  submit: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    marginTop: 4,
  },
  signOut: {
    marginTop: 18,
    alignSelf: "center",
    padding: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY,
  },
});
