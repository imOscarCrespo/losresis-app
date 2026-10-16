// Piezas de la reseña rápida de rotaciones externas (Trello #110): progreso, preguntas de
// selección, etiquetas, consejo con detalles opcionales y el resumen que muestran las fichas.
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../Icon";
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  HIGHLIGHT_TAGS,
  HIGHLIGHT_TAG_LABELS,
  QUICK_REVIEW_STEPS,
  RECOMMENDATION_LABELS,
  RECOMMENDATION_OPTIONS,
  ROTATION_KIND_LABELS,
  ROTATION_KIND_OPTIONS,
  sanitizeHighlightTags,
  toggleHighlightTag,
} from "../../utils/externalRotationQuickReview";

const PRIMARY = "#670CF5";
const PRIMARY_SOFT = "#F2EBFF";
const SURFACE_CARD = "#FFFFFF";
const SURFACE_ALT = "#EEF1F6";
const TEXT = "#111827";
const TEXT_MUTED = "#667085";
const BORDER = "#E6E8EC";
const SUCCESS = "#0F9D7A";
const SUCCESS_SOFT = "#E7FBF4";
const WARNING = "#C2410C";
const WARNING_SOFT = "#FFF0E7";
const DANGER = "#B42318";
const DANGER_SOFT = "#FEECEC";

const RECOMMENDATION_TONES = {
  yes: { color: SUCCESS, backgroundColor: SUCCESS_SOFT, icon: "thumbs-up-outline" },
  depends: { color: WARNING, backgroundColor: WARNING_SOFT, icon: "help-circle-outline" },
  no: { color: DANGER, backgroundColor: DANGER_SOFT, icon: "close-circle" },
};

export const QuickReviewProgress = ({ stepIndex }) => {
  const total = QUICK_REVIEW_STEPS.length;
  return (
    <View style={styles.progress} testID="quick-review-progress">
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>
          Paso {stepIndex + 1} de {total}
        </Text>
        <Text style={styles.progressHint}>Unos 60 segundos</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${((stepIndex + 1) / total) * 100}%` }]}
        />
      </View>
      <Text style={styles.stepTitle}>{QUICK_REVIEW_STEPS[stepIndex].title}</Text>
    </View>
  );
};

const ChoiceQuestion = ({ label, options, value, onChange, testID }) => (
  <View style={styles.question} testID={testID}>
    <Text style={styles.questionLabel}>{label}</Text>
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.choice, active && styles.choiceActive]}
            onPress={() => onChange(option.id)}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export const QuickReviewHowStep = ({ form, onChange }) => (
  <View style={styles.card}>
    <ChoiceQuestion
      label="¿Recomendarías esta rotación?"
      options={RECOMMENDATION_OPTIONS}
      value={form.recommendation}
      onChange={(value) => onChange({ recommendation: value })}
      testID="quick-review-recommendation"
    />
    <ChoiceQuestion
      label="¿Fue fácil conseguirla?"
      options={DIFFICULTY_OPTIONS}
      value={form.difficulty}
      onChange={(value) => onChange({ difficulty: value })}
      testID="quick-review-difficulty"
    />
    <ChoiceQuestion
      label="¿Qué tipo de rotación fue?"
      options={ROTATION_KIND_OPTIONS}
      value={form.rotationKind}
      onChange={(value) => onChange({ rotationKind: value })}
      testID="quick-review-kind"
    />
  </View>
);

export const QuickReviewHighlightsStep = ({ form, onChange }) => {
  const selected = sanitizeHighlightTags(form.highlightTags);
  return (
    <View style={styles.card}>
      <Text style={styles.helperText}>
        Elige todas las que encajen con tu experiencia. Es opcional.
      </Text>
      <View style={styles.tagGrid}>
        {HIGHLIGHT_TAGS.map((tag) => {
          const active = selected.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.tagOption, active && styles.tagOptionActive]}
              onPress={() =>
                onChange({ highlightTags: toggleHighlightTag(selected, tag.id) })
              }
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <Icon
                name={active ? "checkmark-circle" : "add-circle-outline"}
                size={16}
                color={active ? PRIMARY : TEXT_MUTED}
              />
              <Text style={[styles.tagOptionText, active && styles.tagOptionTextActive]}>
                {tag.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const DetailInput = ({ label, value, onChangeText, placeholder, multiline = true, ...rest }) => (
  <>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={[styles.textInput, multiline && styles.textAreaSmall]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#98A2B3"
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
      {...rest}
    />
  </>
);

export const QuickReviewAdviceStep = ({ form, onChange, detailsOpen, onToggleDetails }) => (
  <>
    <View style={styles.card}>
      <Text style={styles.inputLabel}>¿Qué te habría gustado saber antes de ir? (opcional)</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={form.beforeYouGo}
        onChangeText={(value) => onChange({ beforeYouGo: value })}
        placeholder="Un consejo práctico para el siguiente residente"
        placeholderTextColor="#98A2B3"
        multiline
        textAlignVertical="top"
        testID="quick-review-advice"
      />
      <Text style={styles.helperText}>
        Puedes publicar sin escribir nada: tus respuestas ya ayudan.
      </Text>
    </View>

    <View style={styles.card}>
      <TouchableOpacity
        style={styles.detailsToggle}
        onPress={onToggleDetails}
        activeOpacity={0.8}
        testID="quick-review-details-toggle"
      >
        <View style={styles.detailsToggleText}>
          <Text style={styles.detailsTitle}>Añadir más detalles (opcional)</Text>
          <Text style={styles.helperText}>
            Burocracia, alojamiento, costes, contactos y qué destacarías.
          </Text>
        </View>
        <Icon name={detailsOpen ? "chevron-up" : "chevron-down"} size={20} color={PRIMARY} />
      </TouchableOpacity>

      {detailsOpen ? (
        <View style={styles.detailsBody}>
          <DetailInput
            label="Burocracia y documentación"
            value={form.difficultyNotes}
            onChangeText={(value) => onChange({ difficultyNotes: value })}
            placeholder="Requisitos, plazos, cartas, seguros, visado..."
          />
          <DetailInput
            label="Alojamiento"
            value={form.accommodationNotes}
            onChangeText={(value) => onChange({ accommodationNotes: value })}
            placeholder="Dónde te alojaste, cómo lo encontraste..."
          />
          <DetailInput
            label="Costes"
            value={form.costNotes}
            onChangeText={(value) => onChange({ costNotes: value })}
            placeholder="Tasas, alquiler, transporte, ayudas..."
          />
          <DetailInput
            label="¿Qué destacarías?"
            value={form.highlightSummary}
            onChangeText={(value) => onChange({ highlightSummary: value })}
            placeholder="Puntos fuertes, técnicas aprendidas, volumen, sesiones..."
          />
          <DetailInput
            label="Contacto del servicio"
            value={form.tutorName}
            onChangeText={(value) => onChange({ tutorName: value })}
            placeholder="Nombre del tutor o contacto"
            multiline={false}
          />
          <TextInput
            style={styles.textInput}
            value={form.tutorEmail}
            onChangeText={(value) => onChange({ tutorEmail: value })}
            placeholder="Email del contacto"
            placeholderTextColor="#98A2B3"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      ) : null}
    </View>

    <View style={styles.privacyNote} testID="quick-review-privacy">
      <Icon name="shield-checkmark-outline" size={18} color={PRIMARY} />
      <Text style={styles.privacyText}>
        La verán los residentes de LosResis con tu nombre y la inicial de tu apellido, tu
        especialidad, tu año de residencia y tu hospital. Es tu experiencia personal, no
        información oficial del hospital, y podrás editarla o borrarla cuando quieras.
      </Text>
    </View>
  </>
);

export const QuickReviewNav = ({ stepIndex, onPrevious, onNext, saving, submitLabel }) => {
  const isLast = stepIndex === QUICK_REVIEW_STEPS.length - 1;
  return (
    <View style={styles.nav}>
      {stepIndex > 0 ? (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonSecondary]}
          onPress={onPrevious}
          disabled={saving}
          testID="quick-review-previous"
        >
          <Text style={[styles.navButtonText, styles.navButtonTextSecondary]}>Anterior</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={[styles.navButton, saving && styles.navButtonDisabled]}
        onPress={onNext}
        disabled={saving}
        testID={isLast ? "quick-review-submit" : "quick-review-next"}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.navButtonText}>{isLast ? submitLabel : "Siguiente"}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

/**
 * Resumen escaneable de una reseña: recomendación, dificultad, tipo y etiquetas. Solo pinta
 * respuestas reales; una reseña antigua sin ellas no muestra nada.
 * `maxTags` limita las etiquetas en las fichas de la lista.
 */
export const ReviewHighlights = ({ review, maxTags = null }) => {
  const tags = sanitizeHighlightTags(review?.highlight_tags);
  const visibleTags = maxTags ? tags.slice(0, maxTags) : tags;
  const hiddenCount = tags.length - visibleTags.length;
  const tone = RECOMMENDATION_TONES[review?.recommendation];
  const facts = [
    review?.difficulty && DIFFICULTY_LABELS[review.difficulty]
      ? `Conseguirla: ${DIFFICULTY_LABELS[review.difficulty]}`
      : null,
    ROTATION_KIND_LABELS[review?.rotation_kind] || null,
  ].filter(Boolean);

  if (!tone && !facts.length && !tags.length) return null;

  return (
    <View style={styles.highlights}>
      <View style={styles.highlightsRow}>
        {tone ? (
          <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
            <Icon name={tone.icon} size={14} color={tone.color} />
            <Text style={[styles.badgeText, { color: tone.color }]}>
              ¿La recomienda? {RECOMMENDATION_LABELS[review.recommendation]}
            </Text>
          </View>
        ) : null}
        {facts.map((fact) => (
          <View key={fact} style={styles.badgeNeutral}>
            <Text style={styles.badgeNeutralText}>{fact}</Text>
          </View>
        ))}
      </View>
      {visibleTags.length ? (
        <View style={styles.highlightsRow}>
          {visibleTags.map((tagId) => (
            <View key={tagId} style={styles.tag}>
              <Text style={styles.tagText}>{HIGHLIGHT_TAG_LABELS[tagId]}</Text>
            </View>
          ))}
          {hiddenCount > 0 ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>+{hiddenCount}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  progress: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressHint: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: SURFACE_ALT,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  stepTitle: {
    marginTop: 6,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: TEXT,
  },
  card: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  question: {
    gap: 10,
  },
  questionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
  },
  choice: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_CARD,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  choiceActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY_SOFT,
  },
  choiceText: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
  },
  choiceTextActive: {
    color: PRIMARY,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  tagGrid: {
    gap: 8,
  },
  tagOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
  },
  tagOptionActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY_SOFT,
  },
  tagOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: TEXT,
  },
  tagOptionTextActive: {
    color: PRIMARY,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_MUTED,
  },
  textInput: {
    backgroundColor: SURFACE_ALT,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: TEXT,
  },
  textArea: {
    minHeight: 110,
  },
  textAreaSmall: {
    minHeight: 76,
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailsToggleText: {
    flex: 1,
    gap: 2,
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT,
  },
  detailsBody: {
    gap: 10,
  },
  privacyNote: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 16,
    padding: 14,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: TEXT,
  },
  nav: {
    flexDirection: "row",
    gap: 10,
  },
  navButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonSecondary: {
    backgroundColor: SURFACE_ALT,
  },
  navButtonDisabled: {
    opacity: 0.7,
  },
  navButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  navButtonTextSecondary: {
    color: PRIMARY,
  },
  highlights: {
    gap: 8,
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  badgeNeutral: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: SURFACE_ALT,
  },
  badgeNeutralText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_MUTED,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#DDD0FB",
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY,
  },
});
