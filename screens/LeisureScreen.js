import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

/**
 * Item individual del grid con diseño moderno (reutilizado de MenuGrid)
 */
const LeisureGridItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
      accessibilityLabel={item.name}
      accessibilityRole="button"
    >
      <View style={[styles.gridItemContent, { backgroundColor: item.color }]}>
        {/* Overlay con gradiente sutil */}
        <View style={styles.gradientOverlay} />

        {/* Icono en círculo blanco en la esquina superior derecha */}
        <View style={styles.iconCircle}>
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>

        {/* Contenido principal */}
        <View style={styles.gridItemTextContainer}>
          <Text style={styles.gridItemTitle} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Información adicional opcional */}
          {item.description && (
            <Text style={styles.gridItemSubtitle} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Pantalla principal de Ocio
 * Muestra un menú con dos opciones: "Fiesta" y "Deporte"
 */
export default function LeisureScreen({ onSectionChange, userProfile }) {
  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("LeisureScreen");
  }, []);

  const handleOptionPress = (forumType) => {
    if (onSectionChange) {
      onSectionChange("leisureForum", { forumType, userProfile });
    }
  };

  const handleDeportePress = () => {
    if (onSectionChange) {
      onSectionChange("sportsSelection", { userProfile });
    }
  };

  const handleItemPress = (item) => {
    if (item.forumType) {
      handleOptionPress(item.forumType);
    } else if (item.action === "sportsSelection") {
      handleDeportePress();
    }
  };

  // Opciones de ocio
  const leisureOptions = [
    {
      id: "fiesta",
      name: "Fiesta",
      description: "Comparte planes de fiesta y eventos nocturnos en tu ciudad",
      icon: "wine",
      color: "#EC4899",
      forumType: "Fiesta",
    },
    {
      id: "deporte",
      name: "Deporte",
      description:
        "Organiza partidos, entrenamientos y actividades deportivas",
      icon: "football",
      color: "#3B82F6",
      action: "sportsSelection",
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ocio</Text>
      </View>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            {leisureOptions.map((item) => (
              <LeisureGridItem
                key={item.id}
                item={item}
                onPress={handleItemPress}
              />
            ))}
          </View>
        </View>
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
  gridContainer: {
    padding: 12,
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 12,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
  },
  gridItemContent: {
    flex: 1,
    borderRadius: 24,
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    // Sombra sutil
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 24,
  },
  iconCircle: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    // Sombra del círculo
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gridItemTextContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingRight: 8,
  },
  gridItemTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
    lineHeight: 24,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gridItemSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 16,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
