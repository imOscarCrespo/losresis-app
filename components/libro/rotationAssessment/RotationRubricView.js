import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  buildRubricAnswer,
  computeBlockScore,
  findLevel,
  formatGrade,
  needsExactScore,
  scoreOptions,
} from "../../../utils/rotationAssessment";

/**
 * La rúbrica de una versión publicada. Cada bloque se pinta según quién lo
 * responde: los que Docencia ha habilitado para el residente (`selfAssessable`)
 * se valoran aquí; el resto es evaluación de Docencia y solo se consulta. Las
 * dos cosas no se mezclan: el residente nunca escribe la evaluación oficial.
 */

const ScaleLegend = ({ block }) => (
  <View style={styles.legend}>
    {block.scale.map((level) => (
      <View key={level.id} style={styles.legendRow}>
        <Text style={styles.legendCode}>{`${level.code} — ${level.name}`}</Text>
        {level.description ? (
          <Text style={styles.legendText}>{level.description}</Text>
        ) : null}
      </View>
    ))}
  </View>
);

const ResultLine = ({ block, blockAnswers }) => {
  if (block.kind !== "criteria") return null;
  const result = computeBlockScore(block, blockAnswers);
  if (result.reason === "ok") {
    return (
      <Text style={styles.result}>
        {`Resultado de mi autoevaluación: ${formatGrade(result.grade)}/${result.outOf}`}
      </Text>
    );
  }
  if (result.reason === "no_applicable") {
    return <Text style={styles.result}>Sin puntuación aplicable</Text>;
  }
  return null;
};

const ItemRating = ({ block, item, answer, editable, onChange, testPrefix }) => {
  const selected = findLevel(block, answer);
  return (
    <View style={styles.item}>
      <Text style={styles.itemTitle}>{item.title}</Text>
      {item.description ? <Text style={styles.itemText}>{item.description}</Text> : null}
      <Text style={styles.itemLabel}>{editable ? "Mi valoración" : "Valoración"}</Text>
      <View style={styles.chips}>
        {block.scale.map((level, levelIndex) => {
          const active = selected?.id === level.id;
          if (!editable && !active) return null;
          return (
            <TouchableOpacity
              key={level.id}
              style={[styles.chip, active && styles.chipActive]}
              disabled={!editable}
              // Como un radio: tocar el nivel ya elegido no lo quita (un doble
              // toque no borra la valoración); se cambia eligiendo otro.
              onPress={() => {
                if (active) return;
                onChange(buildRubricAnswer(block, level, null));
              }}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: !editable }}
              testID={`${testPrefix}-level-${levelIndex}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {level.code}
              </Text>
            </TouchableOpacity>
          );
        })}
        {!editable && !selected ? <Text style={styles.itemText}>Sin valorar</Text> : null}
      </View>
      {selected && needsExactScore(block, selected) ? (
        <View style={styles.scoreRow}>
          <Text style={styles.itemLabel}>Puntuación exacta</Text>
          <View style={styles.chips}>
            {scoreOptions(selected).map((value) => {
              const active = answer?.score === value;
              if (!editable && !active) return null;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  disabled={!editable}
                  onPress={() => onChange(buildRubricAnswer(block, selected, value))}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: !editable }}
                  testID={`${testPrefix}-score-${value}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {String(value)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
      {selected ? (
        <Text style={styles.levelMeaning}>
          {`${selected.name}${selected.description ? `: ${selected.description}` : ""}`}
        </Text>
      ) : null}
    </View>
  );
};

export const RotationRubricView = ({
  version,
  rubricAnswers = {},
  finalReflection = "",
  editable = false,
  showReflection = false,
  onChangeAnswer,
  onChangeReflection,
}) => {
  const [openLegends, setOpenLegends] = useState({});

  return (
    <View style={styles.wrapper}>
      {version.blocks.map((block, blockIndex) => {
        const blockAnswers = rubricAnswers?.[block.id] || {};
        const legendOpen = !!openLegends[block.id];
        return (
          <View key={block.id} style={styles.block}>
            <Text style={styles.blockTitle}>{block.title}</Text>
            <Text style={block.selfAssessable ? styles.badgeSelf : styles.badgeTeacher}>
              {block.selfAssessable ? "Tu autoevaluación" : "Evaluación de Docencia · solo consulta"}
            </Text>
            {block.description ? <Text style={styles.itemText}>{block.description}</Text> : null}

            <TouchableOpacity
              onPress={() =>
                setOpenLegends((current) => ({ ...current, [block.id]: !legendOpen }))
              }
              hitSlop={8}
            >
              <Text style={styles.legendToggle}>
                {legendOpen ? "Ocultar los niveles" : "Qué significa cada nivel"}
              </Text>
            </TouchableOpacity>
            {legendOpen ? <ScaleLegend block={block} /> : null}

            {block.selfAssessable
              ? block.items.map((item, itemIndex) => (
                  <ItemRating
                    testPrefix={`rubric-${blockIndex}-${itemIndex}`}
                    key={item.id}
                    block={block}
                    item={item}
                    answer={blockAnswers[item.id]}
                    editable={editable}
                    onChange={(answer) => onChangeAnswer?.(block.id, item.id, answer)}
                  />
                ))
              : block.items.map((item) => (
                  <View key={item.id} style={styles.item}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.description ? (
                      <Text style={styles.itemText}>{item.description}</Text>
                    ) : null}
                  </View>
                ))}

            {block.selfAssessable ? <ResultLine block={block} blockAnswers={blockAnswers} /> : null}
          </View>
        );
      })}

      {showReflection ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Reflexión final</Text>
          <Text style={styles.itemText}>Opcional</Text>
          {editable ? (
            <TextInput
              style={styles.input}
              value={finalReflection || ""}
              onChangeText={onChangeReflection}
              placeholder="¿Qué aspectos consideras que has desarrollado mejor durante esta rotación? ¿En cuáles crees que necesitas seguir mejorando?"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              testID="rubric-final-reflection"
            />
          ) : (
            <Text style={styles.answerText}>{finalReflection || "Sin reflexión final."}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
};

export default RotationRubricView;

const styles = StyleSheet.create({
  wrapper: { gap: 14 },
  block: {
    gap: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  blockTitle: { fontSize: 16, fontWeight: "800", color: "#1B0977" },
  badgeSelf: { fontSize: 12, fontWeight: "700", color: "#6D28D9" },
  badgeTeacher: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  legendToggle: { fontSize: 13, fontWeight: "700", color: "#670CF5" },
  legend: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: "#F8FAFC" },
  legendRow: { gap: 2 },
  legendCode: { fontSize: 13, fontWeight: "700", color: "#1B0977" },
  legendText: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  item: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  itemText: { fontSize: 13, color: "#64748B", lineHeight: 19 },
  itemLabel: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#F5F3FF",
    alignItems: "center",
  },
  chipActive: { backgroundColor: "#670CF5", borderColor: "#670CF5" },
  chipText: { fontSize: 13, fontWeight: "700", color: "#670CF5" },
  chipTextActive: { color: "#FFFFFF" },
  scoreRow: { gap: 6 },
  levelMeaning: { fontSize: 12, color: "#475569", lineHeight: 17 },
  result: { fontSize: 13, fontWeight: "800", color: "#047857", marginTop: 4 },
  input: {
    minHeight: 120,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    fontSize: 14,
    color: "#0F172A",
  },
  answerText: { fontSize: 14, color: "#0F172A", lineHeight: 20 },
});
