import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { MenuGrid } from "../components/MenuGrid";
import { NAVIGATION_ITEMS } from "../constants/navigationItems";
import { getFooterConfig } from "../constants/footerConfig";

/**
 * Pantalla de Menú con grid de opciones
 * Muestra todas las opciones de navegación excluyendo las del footer
 */
export default function MenuScreen({
  onSectionChange,
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menú</Text>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 16,
  },
});
