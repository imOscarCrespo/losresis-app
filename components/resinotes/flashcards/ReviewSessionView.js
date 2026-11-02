import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { HeroScreenLayout } from "../../HeroScreenLayout";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { flashcardErrorMessage, loadReviewData, reviewFlashcard } from "../../../services/flashcardService";
import {
  DAILY_CARD_LIMIT,
  RATINGS,
  RATING_KEYS,
  buildMoreQueue,
  buildTodayQueue,
  localDateString,
  newClientReviewId,
  summarizeReviews,
} from "../../../utils/flashcards";
import { AnswerBody, PrimaryButton, SecondaryButton, SourceMeta, flashcardStyles as fs } from "./FlashcardParts";

/**
 * «Repasar» (ClickUp 124b4z9w0z0): una tarjeta a pantalla completa, tocar para
 * darle la vuelta y autoevaluarse con «No lo sabía», «Me costó» o «Lo sabía».
 *
 * Cada respuesta se guarda en la BD antes de pasar a la siguiente, con una
 * clave de idempotencia por tarjeta mostrada: un doble toque o un reintento no
 * cuentan dos veces, y salir a mitad no pierde nada (al volver, la cola se
 * monta otra vez sin lo ya repasado hoy). Una tarjeta fallada reaparece una
 * sola vez al final.
 *
 * mode = 'today' (el repaso del día) | 'more' («Repasar más»).
 */

const SUMMARY_COPY = {
  good: (n) => (n === 1 ? "1 la sabías" : `${n} las sabías`),
  hard: (n) => (n === 1 ? "1 te ha costado" : `${n} te han costado`),
  again: (n) => `${n} necesitas reforzar`,
};

const Completed = ({ summary, onExit, onMore }) => (
  <ScrollView contentContainerStyle={[fs.content, styles.completed]} testID="review-completed">
    <View style={styles.doneIcon}>
      <Icon name="checkmark" size={44} color={COLORS.PRIMARY} weight="bold" />
    </View>
    <Text style={styles.doneTitle}>¡Repaso completado!</Text>
    <Text style={styles.doneText} testID="review-completed-count">
      Hoy has repasado {summary.total} {summary.total === 1 ? "tarjeta" : "tarjetas"}.
    </Text>
    {summary.total ? (
      <View style={[fs.card, styles.summaryCard]}>
        {["good", "hard", "again"].map((key) =>
          summary[key] ? (
            <View key={key} style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: RATINGS[key].bg }]}>
                <Icon name={RATINGS[key].icon} size={18} color={RATINGS[key].fg} weight="bold" />
              </View>
              <Text style={styles.summaryText} testID={`review-summary-${key}`}>
                {SUMMARY_COPY[key](summary[key])}
              </Text>
            </View>
          ) : null
        )}
      </View>
    ) : null}
    <PrimaryButton label="Volver a ResiNotes" onPress={onExit} style={styles.fullWidth} testID="review-back-home" />
    <SecondaryButton label="Repasar más" onPress={onMore} style={styles.fullWidth} testID="review-more" />
  </ScrollView>
);

export const ReviewSessionView = ({ userId, mode = "today", folderName, onBack, onExit, onMore, onOpenNote }) => {
  const [state, setState] = useState({ loading: true, error: null });
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [base, setBase] = useState(0); // ya repasadas hoy dentro del repaso del día
  const [planned, setPlanned] = useState(0); // tarjetas del repaso, sin las repetidas
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(null); // rating en curso
  const [summary, setSummary] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const requeued = useRef(new Set());
  const reviewIdRef = useRef(newClientReviewId());
  const savingRef = useRef(false);
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => setReduceMotion(Boolean(v)))
      .catch(() => {});
  }, []);

  const finish = useCallback(async () => {
    try {
      const data = await loadReviewData(userId, localDateString());
      setSummary(summarizeReviews(data.reviews));
    } catch {
      setSummary(null);
      setState({ loading: false, error: "No hemos podido cargar el resumen. Tus respuestas están guardadas." });
    }
  }, [userId]);

  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    setSummary(null);
    try {
      const today = localDateString();
      const data = await loadReviewData(userId, today);
      let next;
      let already = 0;
      if (mode === "more") {
        next = buildMoreQueue({ cards: data.cards, reviewedTodayIds: data.reviewedTodayIds, today });
      } else {
        const built = buildTodayQueue({ cards: data.cards, reviewedTodayIds: data.reviewedTodayIds, today, limit: DAILY_CARD_LIMIT });
        next = built.queue;
        already = Math.min(built.reviewedToday, DAILY_CARD_LIMIT);
      }
      requeued.current = new Set();
      reviewIdRef.current = newClientReviewId();
      setQueue(next);
      setIndex(0);
      setBase(next.length ? already : 0);
      setPlanned(next.length);
      setFlipped(false);
      flip.setValue(0);
      if (!next.length && data.reviewedTodayIds.length && mode === "today") {
        setSummary(summarizeReviews(data.reviews));
      }
      setState({ loading: false, error: null, totalCards: data.totalCards });
    } catch {
      setState({ loading: false, error: "No hemos podido cargar tu repaso. Revisa tu conexión." });
    }
  }, [userId, mode, flip]);

  useEffect(() => {
    load();
  }, [load]);

  const card = queue[index];

  const flippingRef = useRef(false);
  const showAnswer = () => {
    if (flipped || flippingRef.current) return;
    if (reduceMotion) {
      setFlipped(true);
      return;
    }
    // Media vuelta hasta el canto, cambia la cara y termina la vuelta.
    flippingRef.current = true;
    Animated.timing(flip, { toValue: 1, duration: 150, useNativeDriver: true }).start(() => {
      setFlipped(true);
      Animated.timing(flip, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        flippingRef.current = false;
      });
    });
  };

  const advance = (rating) => {
    const extra = rating === "again" && !requeued.current.has(card.id);
    if (extra) requeued.current.add(card.id);
    const nextQueue = extra ? [...queue, card] : queue;
    if (extra) setQueue(nextQueue);
    reviewIdRef.current = newClientReviewId();
    setFlipped(false);
    flip.setValue(0);
    if (index + 1 >= nextQueue.length) {
      setIndex(index + 1);
      finish();
    } else {
      setIndex(index + 1);
    }
  };

  const rate = async (rating) => {
    if (!card || savingRef.current) return;
    savingRef.current = true;
    setSaving(rating);
    try {
      await reviewFlashcard({
        cardId: card.id,
        rating,
        clientReviewId: reviewIdRef.current,
        localDate: localDateString(),
      });
      advance(rating);
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("resinotes_flashcard_not_found") || message.includes("resinotes_flashcard_suspended")) {
        // Borrada o suspendida desde otro dispositivo: se salta sin contarla.
        reviewIdRef.current = newClientReviewId();
        setFlipped(false);
        flip.setValue(0);
        if (index + 1 >= queue.length) {
          setIndex(index + 1);
          finish();
        } else {
          setIndex(index + 1);
        }
        return;
      }
      Alert.alert("Sin conexión", `${flashcardErrorMessage(error)}\n\nTu respuesta no se ha guardado.`, [
        { text: "Salir", style: "cancel", onPress: onBack },
        { text: "Reintentar", onPress: () => rate(rating) },
      ]);
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const header = (
    <HeroScreenLayout
      title="Repasar"
      bottomContent={<Text style={fs.headerSubtitle}>Unos minutos para recordar lo aprendido.</Text>}
      onBack={onBack}
    >
      {renderBody()}
    </HeroScreenLayout>
  );

  function renderBody() {
    if (state.loading) {
      return (
        <View style={fs.center}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      );
    }
    if (state.error) {
      return (
        <View style={fs.center}>
          <Text style={fs.emptyTitle}>Sin conexión</Text>
          <Text style={fs.emptyText}>{state.error}</Text>
          <SecondaryButton label="Reintentar" onPress={load} />
        </View>
      );
    }
    if (summary) {
      return <Completed summary={summary} onExit={onExit} onMore={onMore} />;
    }
    if (!queue.length) {
      const noCards = !state.totalCards;
      return (
        <View style={[fs.center, styles.padded]} testID="review-empty">
          <Icon name="cards-outline" size={40} color={COLORS.PRIMARY} />
          <Text style={fs.emptyTitle}>{noCards ? "Todavía no tienes tarjetas" : "Todo al día"}</Text>
          <Text style={fs.emptyText}>
            {noCards
              ? "Empieza creando tarjetas desde uno de tus apuntes."
              : mode === "more"
                ? "No tienes más tarjetas activas para repasar ahora."
                : "No tienes tarjetas pendientes de repaso."}
          </Text>
          <SecondaryButton label="Volver a ResiNotes" onPress={onExit} style={styles.fullWidth} />
        </View>
      );
    }
    if (!card) {
      return (
        <View style={fs.center}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      );
    }

    const isRepeat = index >= planned;
    const total = base + planned;
    const position = Math.min(base + index + 1, total);
    const progress = total ? (isRepeat ? 1 : position / total) : 0;
    const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });
    const folder = card.source?.folder_id ? folderName(card.source.folder_id) : null;
    const sourceAvailable = card.source && !card.source.deleted_at;

    return (
      <ScrollView contentContainerStyle={fs.content}>
        <Text style={styles.progressLabel} testID="review-progress">
          {isRepeat ? "Repaso de las que no sabías" : `Tarjeta ${position} de ${total}`}
        </Text>
        <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <Animated.View style={[styles.face, { transform: [{ perspective: 1200 }, { rotateY }] }]}>
          {flipped ? (
            <View style={styles.faceInner} testID="review-card-back">
              <SourceMeta card={card} folderName={folder} />
              <Text style={styles.backQuestion}>{card.question}</Text>
              <View style={styles.answerBox}>
                <AnswerBody answer={card.answer} size={16} color={COLORS.PRIMARY_DARK} testID="review-answer" />
              </View>
              {sourceAvailable ? (
                <TouchableOpacity
                  style={styles.sourceLink}
                  onPress={() => onOpenNote(card.source.id)}
                  accessibilityRole="link"
                  testID="review-open-source"
                >
                  <Icon name="document-text-outline" size={18} color={COLORS.TEXT_LIGHT} />
                  <Text style={styles.sourceLinkText}>Ver apunte original</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <Pressable
              style={[styles.faceInner, styles.front]}
              onPress={showAnswer}
              accessibilityRole="button"
              accessibilityHint="Toca para ver la respuesta"
              testID="review-card-front"
            >
              <SourceMeta card={card} folderName={folder} />
              <Text style={styles.questionText} testID="review-question">
                {card.question}
              </Text>
              <PrimaryButton label="Mostrar respuesta" onPress={showAnswer} testID="review-show-answer" style={styles.showButton} />
            </Pressable>
          )}
        </Animated.View>

        {flipped ? (
          <View style={styles.ratings}>
            {RATING_KEYS.map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.rating}
                onPress={() => rate(key)}
                disabled={Boolean(saving)}
                accessibilityRole="button"
                accessibilityLabel={RATINGS[key].label}
                accessibilityState={{ disabled: Boolean(saving), busy: saving === key }}
                testID={`review-rate-${key}`}
              >
                <View style={[styles.ratingCircle, { backgroundColor: RATINGS[key].bg }]}>
                  {saving === key ? (
                    <ActivityIndicator color={RATINGS[key].fg} />
                  ) : (
                    <Icon name={RATINGS[key].icon} size={26} color={RATINGS[key].fg} weight="bold" />
                  )}
                </View>
                <Text style={styles.ratingLabel}>{RATINGS[key].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TouchableOpacity style={styles.later} onPress={onBack} accessibilityRole="button" testID="review-later">
            <Icon name="time-outline" size={18} color={COLORS.PRIMARY} />
            <Text style={styles.laterText}>Ahora no</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  return header;
};

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 24 },
  fullWidth: { alignSelf: "stretch" },
  progressLabel: { fontSize: 14, fontWeight: "700", color: COLORS.PRIMARY_DARK, marginBottom: 8 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.PRIMARY_LIGHT, overflow: "hidden", marginBottom: 18 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.PRIMARY },
  face: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    shadowColor: "#1B0977",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  faceInner: { padding: 20, gap: 18 },
  front: { minHeight: 340 },
  questionText: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.PRIMARY_DARK,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 30,
    paddingTop: 24,
  },
  showButton: { alignSelf: "center", minWidth: 220 },
  backQuestion: { fontSize: 15, fontWeight: "600", color: COLORS.TEXT_MEDIUM, lineHeight: 21 },
  answerBox: { backgroundColor: COLORS.PRIMARY_LIGHT, borderRadius: 16, padding: 16 },
  sourceLink: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  sourceLinkText: { fontSize: 15, color: COLORS.TEXT_MEDIUM, textDecorationLine: "underline" },
  ratings: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, gap: 8 },
  rating: { flex: 1, alignItems: "center", gap: 8, minHeight: 88 },
  ratingCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  ratingLabel: { fontSize: 14, fontWeight: "600", color: COLORS.TEXT_DARK, textAlign: "center" },
  later: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, paddingVertical: 10, alignSelf: "flex-start" },
  laterText: { fontSize: 16, fontWeight: "600", color: COLORS.PRIMARY },
  completed: { alignItems: "center", paddingTop: 24, gap: 14 },
  doneIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { fontSize: 26, fontWeight: "800", color: COLORS.PRIMARY_DARK, textAlign: "center" },
  doneText: { fontSize: 17, color: COLORS.TEXT_LIGHT, textAlign: "center" },
  summaryCard: { alignSelf: "stretch", gap: 14, marginTop: 6 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  summaryText: { fontSize: 17, color: COLORS.PRIMARY_DARK, fontWeight: "600" },
});

export default ReviewSessionView;
