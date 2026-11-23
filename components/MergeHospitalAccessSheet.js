import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { COLORS } from "../constants/colors";
import { mergeIntoHospitalAccess } from "../services/accountMergeService";
import posthogLogger from "../services/posthogService";

// Unir la cuenta propia con el acceso que creó el hospital (Althaia,
// 2026-11-23). Sale cuando el residente escribe un email corporativo que ya es
// de un acceso de su hospital, o tras entrar con Google desde «Vincular
// Google» si ese Google ya tenía otra cuenta. Con la contraseña del acceso del
// hospital el servidor lo junta todo; App.js recarga al entrar en la cuenta
// unida.
export default function MergeHospitalAccessSheet({
  visible,
  email,
  orgName,
  source,
  onClose,
  onMerged,
}) {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword("");
      setError(null);
      posthogLogger.capture("account_merge_offered", { source: source || null });
    }
  }, [visible, source]);

  const handleClose = () => {
    if (loading) return;
    setPassword("");
    setError(null);
    onClose?.();
  };

  const handleMerge = async () => {
    if (loading) return;
    if (!password) {
      setError("Escribe la contraseña del acceso de tu hospital.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await mergeIntoHospitalAccess(email, password);
    setLoading(false);
    if (!result.success) {
      posthogLogger.capture("account_merge_failed", {
        source: source || null,
        reason: result.status,
      });
      setError(result.error);
      return;
    }
    posthogLogger.capture("account_merge_completed", { source: source || null });
    setPassword("");
    onMerged?.();
  };

  const hospital = orgName || "Tu hospital";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
        <View testID="account-merge-sheet" style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Ya tienes un acceso de tu hospital</Text>
            <TouchableOpacity
              testID="account-merge-close"
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Cerrar"
            >
              <Icon name="close" size={22} color={COLORS.GRAY} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            {hospital} ya te dio un acceso a LosResis con {email}. Escribe su
            contraseña para unir tus dos cuentas: conservas todo lo tuyo y tus
            cursos, y podrás entrar con Google o con el acceso del hospital.
          </Text>

          <Text style={styles.label}>Contraseña del acceso de tu hospital</Text>
          <View style={styles.passwordRow}>
            <TextInput
              testID="account-merge-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleMerge}
              placeholder="Contraseña"
              placeholderTextColor={COLORS.GRAY_MEDIUM}
              style={[styles.input, styles.passwordInput]}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.GRAY} />
            </TouchableOpacity>
          </View>

          {error ? (
            <Text testID="account-merge-error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            title="Unir cuentas"
            onPress={handleMerge}
            loading={loading}
            style={styles.submit}
          />

          <Text style={styles.hint}>
            La contraseña te llegó por email cuando tu hospital te dio de alta.
            Si no la tienes, pide a tu hospital que te genere una nueva.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
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
    backgroundColor: COLORS.SURFACE_SUBTLE,
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
  },
  hint: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: "#6B7280",
  },
});
