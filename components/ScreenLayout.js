import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Footer } from "./Footer";

/**
 * Componente Layout que envuelve las pantallas con Footer fijo de navegación
 * @param {object} props
 * @param {React.ReactNode} props.children - Contenido de la pantalla
 * @param {object} props.style - Estilos adicionales para el contenedor
 * @param {function} props.onHospitalPress - Callback cuando se presiona el icono de hospital
 * @param {function} props.onStudentPress - Callback cuando se presiona el icono de estudiante
 * @param {function} props.onReviewsPress - Callback cuando se presiona el icono de reseñas
 * @param {string} props.activeTab - Tab activo: 'hospital', 'student', 'reviews'
 */
export const ScreenLayout = ({
  children,
  style,
  onHospitalPress,
  onStudentPress,
  onReviewsPress,
  activeTab,
}) => {
  return (
    <SafeAreaView style={[styles.container, style]}>
      <StatusBar style="auto" />
      <View style={styles.content}>{children}</View>
      <View style={styles.footerWrapper}>
        <Footer
          onHospitalPress={onHospitalPress}
          onStudentPress={onStudentPress}
          onReviewsPress={onReviewsPress}
          activeTab={activeTab}
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
  },
});
