import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { COLORS } from "../constants/colors";

/**
 * Componente que muestra avisos accionables sobre el estado del perfil.
 */
export const ProfileStatusCard = ({
  status,
  deadlineLabel = "",
  isOnboarding = false,
}) => {
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
            "Estamos revisando tu email del hospital. En menos de 1 hora te avisaremos por email si podemos validarlo y activar tu perfil de residente.",
          subtitleColor: "#B45309",
        }
      : status === "resident_activation_pending_student"
      ? {
          icon: "swap-horizontal",
          iconColor: "#2563EB",
          title: "Cambio a residente pendiente",
          titleColor: "#2563EB",
          subtitle:
            "Tu cambio desde estudiante a residente está en revisión. Mientras tanto seguirás entrando como estudiante y te avisaremos por email en cuanto lo validemos.",
          subtitleColor: "#1D4ED8",
        }
      : status === "email_review_pending"
      ? {
          icon: "time",
          iconColor: "#D97706",
          title: "Validando tu email corporativo",
          titleColor: "#D97706",
          subtitle:
            "Tu solicitud está en revisión manual. Te escribiremos por email en menos de 1 hora para confirmarte el resultado.",
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
            isOnboarding
              ? "Completa los datos obligatorios para terminar tu registro y entrar en la app con el perfil correcto."
              : "Completa los datos obligatorios para actualizar tu perfil y acceder a todas las funciones.",
          subtitleColor: "#B45309",
        };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Icon
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
