import React from "react";
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { GoogleLogo } from "./GoogleLogo";
import { AppleLogo } from "./AppleLogo";
import { MotionPressable } from "./MotionPressable";
import { COLORS } from "../constants/colors";

/**
 * Componente Button reutilizable
 * @param {object} props
 * @param {function} props.onPress - Función a ejecutar al presionar
 * @param {string} props.title - Texto del botón
 * @param {boolean} props.loading - Si está cargando
 * @param {boolean} props.disabled - Si está deshabilitado
 * @param {string} props.variant - Variante del botón: 'primary' | 'secondary' | 'google' | 'apple'
 * @param {object} props.style - Estilos adicionales
 * @param {object} props.textStyle - Estilos adicionales para el texto
 */
export const Button = ({
  onPress,
  title,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
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

  const textStyleCombined = [
    styles.text,
    styles[`${variant}Text`],
    (isDisabled || isLoading) && styles.disabledText,
    textStyle, // Estilos adicionales pasados como prop
  ];

  // Logos SVG para Google y Apple
  const GoogleIcon = () => <GoogleLogo width={20} height={20} />;
  const AppleIcon = () => <AppleLogo width={16} height={20} color="#ffffff" />;

  // Determinar el color del ActivityIndicator según la variante
  const getLoaderColor = () => {
    if (variant === "google") return "#4285F4";
    if (variant === "apple") return "#ffffff";
    return "#ffffff";
  };

  return (
    <MotionPressable
      style={buttonStyle}
      onPress={onPress}
      disabled={isDisabled || isLoading}
      scaleTo={0.985}
      pressedOpacity={0.96}
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
          <Text style={textStyleCombined}>{title}</Text>
        </View>
      )}
    </MotionPressable>
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
    backgroundColor: COLORS.PRIMARY,
  },
  secondary: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: "#D8B4FE",
  },
  google: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
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
    color: COLORS.WHITE,
  },
  secondaryText: {
    color: COLORS.PRIMARY,
  },
  googleText: {
    color: COLORS.TEXT_DARK,
  },
  appleText: {
    color: COLORS.WHITE,
  },
  disabledText: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
