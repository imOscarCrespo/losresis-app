import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../../Icon";
import {
  ASSESSMENT_STATUS_COPY,
  durationLabel,
  nodeForAssessment,
  objectivesLabel,
  periodLabel,
  templateNodeFor,
} from "../../../utils/rotationAssessment";

const shortDate = (value) => {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
};

const STATUS_TONE = {
  pending: { color: "#B45309", background: "#FEF3C7" },
  draft: { color: "#6D28D9", background: "#EDE9FE" },
  completed: { color: "#047857", background: "#D1FAE5" },
};

/**
 * El bloque de Autoevaluación de rotaciones dentro de Libro → Rotaciones: las
 * rotaciones que Docencia ha publicado para el año, con el estado de la
 * autoevaluación de cada una. No es otra lista de rotaciones del residente: sus
 * fichas siguen debajo, y aquí solo se dice a cuál corresponde cada rotación
 * publicada cuando hay una forma fiable de saberlo.
 *
 * Solo aparece si hay algo que enseñar (rotaciones publicadas para su hospital,
 * especialidad y año, o autoevaluaciones suyas de ese año).
 */
export const RotationAssessmentSection = ({
  cards = [],
  nodes = [],
  assessments = [],
  contextLabel = "",
  loading = false,
  error = null,
  onRetry,
  onOpen,
}) => {
  if (error) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorText}>
          No hemos podido cargar tus rotaciones. Inténtalo de nuevo.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !cards.length) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#670CF5" />
      </View>
    );
  }

  if (!cards.length) return null;

  return (
    <View style={styles.wrapper} testID="rotation-assessment-section">
      <View style={styles.header}>
        <Text style={styles.title}>Autoevaluación de rotaciones</Text>
        {contextLabel ? <Text style={styles.context}>{contextLabel}</Text> : null}
      </View>

      {cards.map((card) => {
        const copy = ASSESSMENT_STATUS_COPY[card.status];
        const tone = STATUS_TONE[card.status];
        const node =
          nodeForAssessment(card.assessment, nodes) ||
          (!card.assessment ? templateNodeFor(card.plan, nodes, assessments) : null);
        const meta = [
          card.version.rotation.durationMonths
            ? `Duración prevista: ${durationLabel(card.version.rotation.durationMonths)}`
            : null,
          objectivesLabel(card.version.objectives.length),
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <TouchableOpacity
            key={card.key}
            style={styles.card}
            onPress={() => onOpen?.(card)}
            activeOpacity={0.85}
            // Las generadas por Docencia llevan su periodo en el id; la del
            // residente, el nombre a secas.
            testID={`rotation-assessment-card-${card.version.rotation.name}${
              card.generated ? `-${card.assessment?.period_start || card.assessment?.id}` : ""
            }`}
          >
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{card.version.rotation.name}</Text>
              <Text style={styles.cardMeta}>{meta}</Text>
              {periodLabel(card.assessment, shortDate) ? (
                <Text style={styles.cardMeta}>
                  {`Periodo: ${periodLabel(card.assessment, shortDate)}`}
                </Text>
              ) : null}
              {node ? (
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {`En tu Libro: ${node.name}`}
                </Text>
              ) : null}
              {card.retired ? (
                <Text style={styles.cardMeta}>Ya no está publicada por Docencia</Text>
              ) : null}
              <View style={styles.cardFooter}>
                <View style={[styles.chip, { backgroundColor: tone.background }]}>
                  <Text style={[styles.chipText, { color: tone.color }]}>{copy.label}</Text>
                </View>
                <Text style={styles.action}>{copy.action}</Text>
              </View>
            </View>
            <Icon name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default RotationAssessmentSection;

const styles = StyleSheet.create({
  wrapper: { gap: 8, marginBottom: 18 },
  header: { gap: 2, marginBottom: 2 },
  title: { fontSize: 16, fontWeight: "800", color: "#1B0977" },
  context: { fontSize: 12, color: "#64748B" },
  loading: { paddingVertical: 18, alignItems: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  cardCopy: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  cardMeta: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: "700" },
  action: { fontSize: 13, fontWeight: "700", color: "#670CF5" },
  errorCard: {
    gap: 10,
    padding: 16,
    marginBottom: 18,
    borderRadius: 18,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  errorText: { fontSize: 13, color: "#9F1239", lineHeight: 19 },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  retryText: { fontSize: 13, fontWeight: "700", color: "#9F1239" },
});
