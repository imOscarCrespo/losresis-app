import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";

/**
 * Componente Button reutilizable
 * @param {object} props
 * @param {function} props.onPress - Función a ejecutar al presionar
 * @param {string} props.title - Texto del botón
 * @param {boolean} props.loading - Si está cargando
 * @param {boolean} props.disabled - Si está deshabilitado
 * @param {string} props.variant - Variante del botón: 'primary' | 'secondary' | 'google' | 'apple'
 * @param {object} props.style - Estilos adicionales
 */
export const Button = ({
  onPress,
  title,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
}) => {
  // Asegurar que loading y disabled sean booleanos explícitamente
  const isLoading = Boolean(loading);
  const isDisabled = Boolean(disabled);

  const buttonStyle = [
    styles.button,
    styles[variant],
    (isDisabled || isLoading) && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`${variant}Text`],
    (isDisabled || isLoading) && styles.disabledText,
  ];

  // Ícono de Google simple (G en un círculo)
  const GoogleIcon = () => (
    <View style={styles.googleIcon}>
      <Text style={styles.googleIconText}>G</Text>
    </View>
  );

  // Ícono de Apple (símbolo de Apple)
  const AppleIcon = () => (
    <View style={styles.appleIcon}>
      <Text style={styles.appleIconText}></Text>
    </View>
  );

  // Determinar el color del ActivityIndicator según la variante
  const getLoaderColor = () => {
    if (variant === "google") return "#4285F4";
    if (variant === "apple") return "#ffffff";
    return "#ffffff";
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={isDisabled || isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color={getLoaderColor()} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {variant === "google" && (
            <>
              <GoogleIcon />
              <View style={{ width: 12 }} />
            </>
          )}
          {variant === "apple" && (
            <>
              <AppleIcon />
              <View style={{ width: 12 }} />
            </>
          )}
          <Text style={textStyle}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primary: {
    backgroundColor: "#007AFF",
  },
  secondary: {
    backgroundColor: "#6c757d",
  },
  google: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  apple: {
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryText: {
    color: "#ffffff",
  },
  secondaryText: {
    color: "#ffffff",
  },
  googleText: {
    color: "#1a1a1a",
  },
  appleText: {
    color: "#ffffff",
  },
  disabledText: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4285F4",
  },
  appleIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  appleIconText: {
    fontSize: 18,
    fontWeight: "400",
    color: "#ffffff",
  },
});
