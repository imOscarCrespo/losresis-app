import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Footer } from "./Footer";
import { UpdateBanner } from "./UpdateBanner";
import { COLORS } from "../constants/colors";

/**
 * Componente Layout que envuelve las pantallas con Footer fijo de navegación
 * @param {object} props
 * @param {React.ReactNode} props.children - Contenido de la pantalla
 * @param {object} props.userProfile - Perfil del usuario
 * @param {string} props.activeSection - ID de la sección activa
 * @param {boolean} props.isProfileIncomplete - Si el perfil está incompleto
 * @param {function} props.onSectionChange - Callback cuando se cambia de sección
 * @param {object} props.style - Estilos adicionales para el contenedor
 */
export const ScreenLayout = ({
  children,
  userProfile,
  activeSection,
  isProfileIncomplete = false,
  onSectionChange,
  style,
  hideFooter = false,
  showUpdateBanner = false,
  updateUrl = null,
}) => {
  // Debug log
  if (__DEV__) {
    console.log("🎨 [ScreenLayout] Estado del banner:", {
      showUpdateBanner,
      updateUrl,
    });
  }

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, style]}>
      {/* La franja del notch siempre usa el background de la app; iconos oscuros */}
      <StatusBar style="dark" />
      <View style={{ height: insets.top, backgroundColor: COLORS.BACKGROUND }} />
      <View
        style={[
          styles.content,
          { paddingLeft: insets.left, paddingRight: insets.right },
        ]}
      >
        {children}
      </View>
      {!hideFooter ? (
        <View style={styles.footerWrapper}>
          {showUpdateBanner && (
            <View style={styles.bannerWrapper}>
              <UpdateBanner updateUrl={updateUrl} />
            </View>
          )}
          <Footer
            userProfile={userProfile}
            activeSection={activeSection}
            isProfileIncomplete={isProfileIncomplete}
            onSectionChange={onSectionChange}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  footerWrapper: {
    backgroundColor: COLORS.SURFACE,
    position: "relative",
  },
  bannerWrapper: {
    width: "100%",
  },
});
