import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../Icon";
import { COLORS } from "../../constants/colors";
import { imageViewerHtml } from "./imageViewerHtml";

// Si la imagen no ha cargado en este tiempo (sin conexión, URL caducada), se avisa.
const LOAD_TIMEOUT_MS = 20000;

/**
 * Imagen de una nota a pantalla completa (ClickUp 124b4z9w5nh): fondo oscuro,
 * entera y centrada, con zoom (ver imageViewerHtml.js) y un botón de cerrar
 * siempre visible. Es un Modal encima de la nota: al cerrarlo, la nota sigue
 * en el mismo sitio. Si no carga, lo dice y se puede cerrar igual.
 *
 * `src`: la URL que ya muestra la nota (firmada). null = cerrado.
 */
export const ImageViewer = ({ src, onClose }) => {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!src) return undefined;
    setStatus("loading");
    const timer = setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [src]);

  const onMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message?.type === "loaded") setStatus("loaded");
      if (message?.type === "error") setStatus("error");
    } catch {
      // Mensaje que no es del visor.
    }
  };

  return (
    <Modal visible={Boolean(src)} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.root} testID="resinotes-image-viewer">
        {src ? (
          <WebView
            source={{ html: imageViewerHtml(src) }}
            originWhitelist={["*"]}
            onMessage={onMessage}
            onError={() => setStatus("error")}
            style={styles.webview}
            containerStyle={styles.webview}
            scrollEnabled={false}
            bounces={false}
            setBuiltInZoomControls={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            testID="resinotes-image-viewer-web"
          />
        ) : null}
        {status === "loading" ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color={COLORS.WHITE} size="large" />
          </View>
        ) : null}
        {status === "error" ? (
          <View style={styles.overlay} testID="resinotes-image-viewer-error">
            <Icon name="image-outline" size={40} color="#CBD5E1" />
            <Text style={styles.errorTitle}>No se ha podido cargar la imagen</Text>
            <Text style={styles.errorText}>Revisa tu conexión e inténtalo de nuevo.</Text>
          </View>
        ) : null}
        <TouchableOpacity
          onPress={onClose}
          style={[styles.close, { top: insets.top + 10 }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar imagen"
          testID="resinotes-image-viewer-close"
        >
          <Icon name="close" size={26} color={COLORS.WHITE} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
  },
  errorTitle: { color: COLORS.WHITE, fontSize: 17, fontWeight: "700", textAlign: "center" },
  errorText: { color: "#CBD5E1", fontSize: 14, textAlign: "center" },
  close: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15,23,42,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ImageViewer;
