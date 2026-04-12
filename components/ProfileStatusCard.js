import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

/**
 * Componente que muestra avisos accionables sobre el estado del perfil.
 */
export const ProfileStatusCard = ({ status, deadlineLabel = "" }) => {
  if (status === "hidden" || !status) {
    return null;
  }

  const content =
    status === "resident_activation_pending"
      ? {
          icon: "mail-unread",
          iconColor: "#D97706",
          title: "Activación de residente pendiente",
          titleColor: "#D97706",
          subtitle:
            "Estamos revisando tu email del hospital. Hasta que lo validemos no podrás acceder como residente. Te avisaremos por email en cuanto quede aprobado.",
          subtitleColor: "#B45309",
        }
      : status === "resident_activation_pending_student"
      ? {
          icon: "swap-horizontal",
          iconColor: "#2563EB",
          title: "Cambio a residente pendiente",
          titleColor: "#2563EB",
          subtitle:
            "Tu cambio desde estudiante a residente está en revisión. Mientras tanto seguirás entrando como estudiante y te avisaremos por email cuando activemos el perfil de residente.",
          subtitleColor: "#1D4ED8",
        }
      : status === "email_review_pending"
      ? {
          icon: "time",
          iconColor: "#D97706",
          title: "Validando tu email corporativo",
          titleColor: "#D97706",
          subtitle:
            "Tu perfil está pendiente de revisión manual. En cuanto validemos tu email del hospital, no tendrás que hacer nada más.",
          subtitleColor: "#B45309",
        }
      : status === "resident_transition_pending"
      ? {
          icon: "time",
          iconColor: "#2563EB",
          title: "Acceso temporal MIR activo",
          titleColor: "#2563EB",
          subtitle: deadlineLabel
            ? `Puedes usar el modo residente mientras llega tu correo corporativo. Completa el perfil antes del ${deadlineLabel}.`
            : "Puedes usar el modo residente mientras llega tu correo corporativo.",
          subtitleColor: "#1D4ED8",
        }
      : status === "resident_transition_locked"
      ? {
          icon: "mail-open",
          iconColor: "#D97706",
          title: "Correo corporativo requerido",
          titleColor: "#D97706",
          subtitle:
            "La ventana temporal MIR ya ha terminado. Añade y valida tu correo corporativo para recuperar el acceso completo.",
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
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
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
