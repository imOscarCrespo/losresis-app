import React, { useRef, useState } from "react";
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
import { signInWithHospitalAccess } from "../services/authService";
import { validateHospitalAccessForm } from "../utils/passwordAccess";

// Login con email + contraseña para residentes cuya cuenta ha creado su
// hospital desde el panel (Trello #100). No hay autoalta ni "he olvidado mi
// contraseña": la regenera el hospital.
export default function HospitalAccessLoginModal({ visible, onClose, onSignedIn }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  const handleClose = () => {
    if (loading) return;
    setPassword("");
    setError(null);
    onClose?.();
  };

  const handleSubmit = async () => {
    if (loading) return;
    const validationError = validateHospitalAccessForm(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await signInWithHospitalAccess(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setPassword("");
    onSignedIn?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Acceso de tu hospital</Text>
            <TouchableOpacity
              testID="hospital-access-close"
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Cerrar"
            >
              <Icon name="close" size={22} color={COLORS.GRAY} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Entra con el email corporativo y la contraseña que te ha dado tu
            hospital.
          </Text>

          <Text style={styles.label}>Email corporativo</Text>
          <TextInput
            testID="hospital-access-email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="nombre.apellido@hospital.es"
            placeholderTextColor={COLORS.GRAY_MEDIUM}
            style={styles.input}
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordRow}>
            <TextInput
              testID="hospital-access-password"
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
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
            <Text testID="hospital-access-error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            title="Entrar"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submit}
          />

          <Text style={styles.hint}>
            ¿Has olvidado la contraseña? Pide a tu hospital que te genere una
            nueva.
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
  },
  title: {
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
