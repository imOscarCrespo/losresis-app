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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ocio</Text>
        <Text style={styles.subtitle}>
          Comparte actividades de ocio en {userProfile?.city || "tu ciudad"}
        </Text>
      </View>

      {/* Menu Options */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Fiesta Option */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleOptionPress("Fiesta")}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: "#FCE7F3" }]}>
            <Ionicons name="wine" size={32} color="#EC4899" />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Fiesta</Text>
            <Text style={styles.optionDescription}>
              Comparte planes de fiesta y eventos nocturnos en tu ciudad
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.GRAY} />
        </TouchableOpacity>

        {/* Deporte Option */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => handleOptionPress("Deporte")}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: "#DBEAFE" }]}>
            <Ionicons name="football" size={32} color="#3B82F6" />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Deporte</Text>
            <Text style={styles.optionDescription}>
              Organiza partidos, entrenamientos y actividades deportivas
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.GRAY} />
        </TouchableOpacity>
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
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
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
