import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { estimateMinutes, formatDay, formatPendingReview } from "../../../utils/flashcards";

/**
 * Repasos pendientes en la portada de ResiNotes (ClickUp 124b4z9w0z0,
 * simplificado en 124b4z9w5nh: «Tienes N tarjetas para repasar · Repasar
 * ahora», que empieza el repaso directamente, o «Todo al día · Repasar otras
 * tarjetas», que practica sin cambiar la programación).
 * Estados: pendientes, todo al día, aún sin tarjetas y en pausa. Con el repaso
 * diario desactivado (configuración de repaso) o si no se ha podido cargar, no
 * se enseña (la biblioteca sigue funcionando; la configuración sigue en Mis
 * tarjetas).
 */
export const ReviewTodayCard = ({ summary, onStart, onMore, onSettings, onResume }) => {
  if (!summary || summary.error || summary.disabled) return null;

  let title;
  let text;
  let action;
  let onPress;
  let testID;
  if (summary.loading) {
    title = "Tu repaso de hoy";
    text = "Cargando…";
  } else if (summary.paused) {
    title = "Repasos en pausa";
    text = `Vuelves el ${formatDay(summary.pausedUntil)}. Tus tarjetas te esperan.`;
    action = "Reanudar";
    onPress = onResume;
    testID = "resinotes-review-resume";
  } else if (!summary.totalCards) {
    title = "Repasa tus apuntes en segundos";
    text = "Abre una nota y pulsa «Repasar ahora» o «Crear pregunta».";
  } else if (summary.pending > 0) {
    title = formatPendingReview(summary.pending);
    text = `Unos ${estimateMinutes(summary.pending)} min aprox.`;
    action = "Repasar ahora";
    onPress = onStart;
    testID = "resinotes-review-start";
  } else {
    title = "Todo al día";
    text = "No tienes repasos pendientes por ahora.";
    action = "Repasar otras tarjetas";
    onPress = onMore;
    testID = "resinotes-review-more";
  }

  return (
    <View style={styles.card} testID="resinotes-review-card">
      <View style={styles.icon}>
        <Icon name="brain-outline" size={26} color={COLORS.PRIMARY} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, styles.flex]} testID="resinotes-review-title">
            {title}
          </Text>
          {onSettings && summary.totalCards ? (
            <TouchableOpacity
              onPress={onSettings}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Configuración de repaso"
              testID="resinotes-review-settings"
            >
              <Icon name="settings-outline" size={20} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.text} testID="resinotes-review-text">
          {text}
        </Text>
      </View>
      {action ? (
        <TouchableOpacity style={styles.button} onPress={onPress} accessibilityRole="button" accessibilityLabel={action} testID={testID}>
          <Text style={styles.buttonText}>{action}</Text>
          <Icon name="arrow-forward" size={14} color={COLORS.WHITE} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E9DDFF",
    padding: 14,
    marginBottom: 16,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 150 },
  flex: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  text: { fontSize: 13, color: COLORS.TEXT_LIGHT, marginTop: 2, lineHeight: 18 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 18,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  buttonText: { color: COLORS.WHITE, fontWeight: "700", fontSize: 14 },
});

export default ReviewTodayCard;
