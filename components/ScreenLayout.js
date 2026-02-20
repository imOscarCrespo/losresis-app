import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Footer } from "./Footer";
import { UpdateBanner } from "./UpdateBanner";
import { useVersionCheck } from "../hooks/useVersionCheck";

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
}) => {
  const { needsUpdate, updateUrl, currentVersion, isLoading } =
    useVersionCheck();
  const showUpdateBanner = needsUpdate; // Mostrar en iOS y Android

  // Debug log
  if (__DEV__) {
    console.log("🎨 [ScreenLayout] Estado del banner:", {
      needsUpdate,
      showUpdateBanner,
      currentVersion,
      updateUrl,
      isLoading,
    });
  }

  return (
    <SafeAreaView style={[styles.container, style]}>
      <StatusBar style="auto" />
      <View style={styles.content}>{children}</View>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
  },
  footerWrapper: {
    backgroundColor: "#ffffff",
    position: "relative",
  },
  bannerWrapper: {
    width: "100%",
  },
});
