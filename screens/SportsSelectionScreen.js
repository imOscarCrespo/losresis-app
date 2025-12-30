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
 * Pantalla de selección de deportes
 * Muestra las opciones de deportes disponibles
 */
export default function SportsSelectionScreen({ onSectionChange, userProfile }) {
  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("SportsSelectionScreen");
  }, []);

  const handleBack = () => {
    if (onSectionChange) {
      onSectionChange("ocio", { userProfile });
    }
  };

  const handleOptionPress = (forumType) => {
    if (onSectionChange) {
      onSectionChange("leisureForum", { forumType, userProfile });
    }
  };

  // Opciones de deportes disponibles
  const sportsOptions = [
    {
      id: "padel",
      title: "Pádel",
      description: "Busca compañeros para partidos de pádel",
      icon: "tennisball",
      iconColor: "#10B981",
      backgroundColor: "#D1FAE5",
      forumType: "padel",
    },
    {
      id: "tenis",
      title: "Tenis",
      description: "Organiza partidos y entrenamientos de tenis",
      icon: "tennisball-outline",
      iconColor: "#3B82F6",
      backgroundColor: "#DBEAFE",
      forumType: "tenis",
    },
    {
      id: "futbol",
      title: "Fútbol",
      description: "Encuentra partidos de fútbol y organiza equipos",
      icon: "football",
      iconColor: "#059669",
      backgroundColor: "#A7F3D0",
      forumType: "futbol",
    },
    {
      id: "deporte_otros",
      title: "Otros Deportes",
      description: "Comparte actividades de otros deportes",
      icon: "basketball",
      iconColor: "#6366F1",
      backgroundColor: "#E0E7FF",
      forumType: "deporte_otros",
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Deporte</Text>
          <Text style={styles.subtitle}>
            Selecciona el tipo de deporte en {userProfile?.city || "tu ciudad"}
          </Text>
        </View>
      </View>

      {/* Menu Options */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {sportsOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.optionCard}
            onPress={() => handleOptionPress(option.forumType)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: option.backgroundColor },
              ]}
            >
              <Ionicons name={option.icon} size={32} color={option.iconColor} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={COLORS.GRAY} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.GRAY,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 24,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.GRAY,
    lineHeight: 20,
  },
});

