import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

/**
 * Frontera de error de toda la app.
 *
 * En una build de producción cualquier excepción durante el render es un crash
 * fatal: React desmonta el árbol entero y iOS mata el proceso, así que el
 * usuario pierde la sesión y Apple lo contabiliza como crash. La app no tenía
 * ninguna frontera, de modo que un solo `undefined.map()` en una pantalla
 * tiraba todo.
 *
 * Aquí lo convertimos en una pantalla recuperable y lo reportamos a PostHog,
 * que es donde ya miramos el comportamiento de los usuarios.
 *
 * Ojo con el alcance: esto solo captura errores de render, de los métodos de
 * ciclo de vida y de los constructores de sus hijos. NO captura crashes
 * nativos, ni errores dentro de callbacks asíncronos, ni los de manejadores de
 * eventos.
 */
export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // El componentStack es lo único que identifica la pantalla culpable una vez
    // el bundle está minificado, así que va en el evento sí o sí.
    console.error("💥 [AppErrorBoundary] Error no controlado en render:", error);

    posthogLogger.capture("App Render Error", {
      message: String(error?.message || error),
      stack: String(error?.stack || "").slice(0, 4000),
      component_stack: String(errorInfo?.componentStack || "").slice(0, 4000),
    });
  }

  handleRetry = () => {
    // Remontar el árbol basta para el caso habitual: un dato que llegó mal y ya
    // se ha vuelto a pedir. Si el error es determinista volverá a caer aquí, que
    // sigue siendo mejor que cerrarse.
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrapper}>
              <Icon name="alert-circle-outline" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Algo ha ido mal</Text>
            <Text style={styles.message}>
              Ha ocurrido un error inesperado. Puedes reintentar; si vuelve a
              pasar, cierra la app y ábrela de nuevo.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleRetry}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  card: {
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.PRIMARY_SOFT,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.GRAY,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AppErrorBoundary;
