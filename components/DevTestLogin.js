import React, { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../config/supabase";

// Acceso con email + contraseña para las pruebas automáticas (Maestro).
// Solo se renderiza con DEV_E2E (builds de desarrollo con EXPO_PUBLIC_E2E=1):
// las credenciales las teclea el propio flujo de Maestro, no viven en el bundle.
export default function DevTestLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    onSuccess?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Acceso de pruebas (solo desarrollo)</Text>
      <TextInput
        testID="e2e-email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="next"
        // Maestro no consigue enfocar el campo seguro con un toque en iOS: se llega con Intro.
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="email"
        style={styles.input}
      />
      <TextInput
        testID="e2e-password"
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        placeholder="contraseña"
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        testID="e2e-login"
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "Entrando..." : "Entrar como test"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
  },
  error: {
    fontSize: 12,
    color: "#B91C1C",
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#92400E",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
