import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { estimateMinutes, formatPending } from "../../../utils/flashcards";

/**
 * «Tu repaso de hoy» en la portada de ResiNotes (ClickUp 124b4z9w0z0).
 * Tres estados: pendientes, todo al día y aún sin tarjetas. Si no se ha podido
 * cargar, no se enseña (la biblioteca sigue funcionando).
 */
export const ReviewTodayCard = ({ summary, onStart, onMore, onCreate }) => {
  if (!summary || summary.error) return null;

  let title;
  let text;
  let action;
  let onPress;
  let testID;
  if (summary.loading) {
    title = "Tu repaso de hoy";
    text = "Cargando…";
  } else if (!summary.totalCards) {
    title = "Tus apuntes también pueden ayudarte a repasar";
    text = "Crea tus primeras tarjetas automáticamente.";
    action = "Crear tarjetas";
    onPress = onCreate;
    testID = "resinotes-review-create";
  } else if (summary.pending > 0) {
    title = "Tu repaso de hoy";
    text = `${formatPending(summary.pending)} · ${estimateMinutes(summary.pending)} min aprox.`;
    action = "Empezar repaso";
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
        <Text style={styles.title} testID="resinotes-review-title">
          {title}
        </Text>
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
