import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { MenuGrid } from "../components/MenuGrid";
import { ScreenHeader } from "../components/ScreenHeader";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { NAVIGATION_ITEMS } from "../constants/navigationItems";
import { getFooterConfig } from "../constants/footerConfig";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla de Menú con grid de opciones
 * Muestra todas las opciones de navegación excluyendo las del footer
 */
export default function MenuScreen({
  onSectionChange,
  onBack,
  currentSection,
  userProfile,
  residentHasReview = true,
}) {
  // Obtener items del footer para excluirlos
  const footerItems = getFooterConfig(userProfile);

  const handleItemPress = (item) => {
    if (onSectionChange) {
      // Usar screenId si está disponible (mapeado), sino usar el id original
      const sectionId = item.screenId || item.id;
      onSectionChange(sectionId);
    }
  };

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("MenuScreen");
  }, []);

  return (
    <ScreenScaffold
      header={
        <ScreenHeader
          title="Menú"
          onBack={onBack}
          iconName="grid-outline"
          compact
        />
      }
      contentSurfaceStyle={styles.contentSurface}
    >
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <MenuGrid
          navigationItems={NAVIGATION_ITEMS}
          footerItems={footerItems}
          userProfile={userProfile}
          onItemPress={handleItemPress}
          residentHasReview={residentHasReview}
        />
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  contentSurface: {
    backgroundColor: "#F5F5F5",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 16,
  },
});
