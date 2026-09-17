import React from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { COLORS } from "../constants/colors";

/**
 * Pantalla de arranque mientras se resuelven sesión y puertas de acceso.
 *
 * Antes App devolvía `null` durante esta fase: con la red fría el usuario veía
 * una pantalla en blanco varios segundos y la app parecía haberse colgado.
 * Reproducimos el splash nativo (mismo fondo e icono) para que la transición
 * splash → app sea continua.
 */
export const AppLoadingScreen = () => (
  <View style={styles.container}>
    <Image
      source={require("../assets/splash-icon.png")}
      style={styles.logo}
      resizeMode="contain"
    />
    <ActivityIndicator
      size="small"
      color={COLORS.PRIMARY}
      style={styles.spinner}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: 160,
    height: 160,
  },
  spinner: {
    marginTop: 24,
  },
});

export default AppLoadingScreen;
