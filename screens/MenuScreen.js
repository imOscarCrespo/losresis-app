import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Icon } from "../components/Icon";
import { MenuGrid } from "../components/MenuGrid";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { NAVIGATION_ITEMS } from "../constants/navigationItems";
import { getFooterConfig } from "../constants/footerConfig";
import posthogLogger from "../services/posthogService";
import { useUnreadNotificationBuckets } from "../src/hooks/useUnreadNotificationBuckets";
import { COLORS } from "../constants/colors";

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
  residentReviewGateStatus = "soft",
  residentReviewGateBypassed = false,
}) {
  // Obtener items del footer para excluirlos
  const footerItems = getFooterConfig(userProfile);
  const { hasOtherUnread } = useUnreadNotificationBuckets(userProfile?.id);

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
    <HeroScreenLayout
      title="Menú"
      onBack={onBack}
      rightSlot={
        <View style={styles.headerIconCircle}>
          <Icon name="grid-outline" size={20} color="#670CF5" />
        </View>
      }
      contentStyle={styles.contentSurface}
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
          residentReviewGateStatus={residentReviewGateStatus}
          residentReviewGateBypassed={residentReviewGateBypassed}
          showNotificationsBadge={hasOtherUnread}
        />
      </ScrollView>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentSurface: {
    backgroundColor: COLORS.BACKGROUND,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 16,
  },
});
