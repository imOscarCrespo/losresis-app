import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Componente que muestra avisos accionables sobre el estado del perfil.
 */
export const ProfileStatusCard = ({ status }) => {
  if (status === "hidden" || !status) {
    return null;
  }

  const content =
    status === "email_review_pending"
      ? {
          icon: "time",
          iconColor: "#D97706",
          title: "Validando tu email corporativo",
          titleColor: "#D97706",
          subtitle:
            "Tu perfil está pendiente de revisión manual. En cuanto validemos tu email del hospital, no tendrás que hacer nada más.",
          subtitleColor: "#B45309",
        }
      : {
          icon: "alert-circle",
          iconColor: "#D97706",
          title: "Perfil incompleto",
          titleColor: "#D97706",
          subtitle:
            "Completa los datos obligatorios para personalizar tu experiencia y acceder a todas las funciones.",
          subtitleColor: "#B45309",
        };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons
          name={content.icon}
          size={24}
          color={content.iconColor}
        />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: content.titleColor }]}>
            {content.title}
          </Text>
          <Text style={[styles.subtitle, { color: content.subtitleColor }]}>
            {content.subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
