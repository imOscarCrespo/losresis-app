import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { HeroScreenLayout } from "../../HeroScreenLayout";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { ResiNotesSheet } from "../ResiNotesSheet";
import { restoreItem } from "../../../services/resinotesService";
import {
  deleteFlashcard,
  flashcardErrorMessage,
  getFlashcard,
  keepFlashcard,
  setFlashcardStatus,
  updateFlashcard,
} from "../../../services/flashcardService";
import { ORIGIN_LABELS, cardDisplayState, formatNextReview, localDateString } from "../../../utils/flashcards";
import {
  AnswerBody,
  CardEditorSheet,
  InfoNotice,
  SecondaryButton,
  SourceMeta,
  StateChip,
  flashcardStyles as fs,
} from "./FlashcardParts";

/**
 * «Detalle de la tarjeta» (ClickUp 124b4z9w0z0): pregunta, respuesta, fuente y
 * programación, con Editar, Suspender/Reactivar y Eliminar.
 *
 * Si el apunte ha cambiado («Fuente modificada») o ya no está («Fuente no
 * disponible»), la tarjeta no entra en los repasos hasta que el residente
 * decide qué hacer. Nada se cambia solo.
 */

const ActionRow = ({ icon, label, onPress, testID, danger }) => (
  <TouchableOpacity style={styles.actionRow} onPress={onPress} accessibilityRole="button" testID={testID}>
    <Icon name={icon} size={20} color={danger ? COLORS.ERROR : COLORS.PRIMARY_DARK} />
    <Text style={[styles.actionLabel, danger && { color: COLORS.ERROR }]}>{label}</Text>
    <Icon name="chevron-forward" size={18} color={COLORS.TEXT_LIGHT} />
  </TouchableOpacity>
);

export const CardDetailView = ({ cardId, folderName, onBack, onOpenNote, onRegenerate, onChanged }) => {
  const [state, setState] = useState({ loading: true, error: null, card: null });
  const [editing, setEditing] = useState(false);
  const [changes, setChanges] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const card = await getFlashcard(cardId);
      setState({ loading: false, error: card ? null : "Esta tarjeta ya no existe.", card });
    } catch {
      setState({ loading: false, error: "No se ha podido cargar la tarjeta. Revisa tu conexión.", card: null });
    }
  }, [cardId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onChanged?.();
      await load();
    } catch (error) {
      Alert.alert("Algo ha fallado", flashcardErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const card = state.card;

  const confirmDelete = () =>
    Alert.alert("¿Eliminar esta tarjeta?", "Dejará de aparecer en tus repasos. Tu apunte no cambia.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await deleteFlashcard(card.id);
            onChanged?.();
            onBack();
          } catch (error) {
            Alert.alert("Algo ha fallado", flashcardErrorMessage(error));
            setBusy(false);
          }
        },
      },
    ]);

  const submitEdit = async (values) => {
    try {
      await updateFlashcard(card.id, values);
      // «Actualizar a mano» tras un cambio del apunte: editarla es decidir qué hacer con ella.
      if (card.source_state === "modified") await keepFlashcard(card.id);
    } catch (error) {
      error.userMessage = flashcardErrorMessage(error);
      throw error;
    }
    setEditing(false);
    onChanged?.();
    load();
  };

  const renderBody = () => {
    if (state.loading && !card) {
      return (
        <View style={fs.center}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      );
    }
    if (!card) {
      return (
        <View style={fs.center}>
          <Text style={fs.emptyText}>{state.error}</Text>
          <SecondaryButton label="Reintentar" onPress={load} />
        </View>
      );
    }
    const display = cardDisplayState(card);
    const source = card.source;
    const today = localDateString();
    if (display === "modified") {
      return (
        <ScrollView contentContainerStyle={fs.content}>
          <InfoNotice icon="warning-outline" tone="warning" testID="flashcard-source-modified">
            Este apunte ha cambiado desde que creaste la tarjeta. No entrará en tus repasos hasta que decidas qué hacer.
          </InfoNotice>
          <View style={fs.card}>
            <Text style={fs.question} testID="flashcard-detail-question">
              {card.question}
            </Text>
            <SourceMeta card={card} folderName={folderName(source?.folder_id)} style={styles.metaSpaced} />
          </View>
          <Text style={styles.question}>¿Qué quieres hacer?</Text>
          <View style={fs.card}>
            <ActionRow icon="eye-outline" label="Ver cambios" onPress={() => setChanges(true)} testID="flashcard-see-changes" />
            <ActionRow icon="checkmark-circle-outline" label="Mantener tarjeta" onPress={() => run(() => keepFlashcard(card.id))} testID="flashcard-keep" />
            <ActionRow icon="refresh-outline" label="Regenerar propuesta" onPress={() => onRegenerate(source.id)} testID="flashcard-regenerate" />
            <ActionRow icon="pencil-outline" label="Actualizar a mano" onPress={() => setEditing(true)} testID="flashcard-update-manually" />
            <ActionRow icon="pause-circle-outline" label="Suspender tarjeta" onPress={() => run(() => setFlashcardStatus(card.id, "suspended"))} />
          </View>
        </ScrollView>
      );
    }
    return (
      <ScrollView contentContainerStyle={fs.content}>
        {display === "missing" ? (
          <InfoNotice icon="warning-outline" tone="warning" testID="flashcard-source-missing">
            {source?.deleted_at
              ? "El apunte original está en la papelera. La tarjeta no entrará en tus repasos mientras siga allí."
              : "El apunte original ya no está disponible. La tarjeta no entrará en tus repasos."}
          </InfoNotice>
        ) : null}

        <View style={[fs.card, styles.qa]}>
          <Text style={fs.sectionLabel}>Pregunta</Text>
          <Text style={fs.question} testID="flashcard-detail-question">
            {card.question}
          </Text>
        </View>
        <View style={[fs.card, styles.qa]}>
          <Text style={fs.sectionLabel}>Respuesta</Text>
          <AnswerBody answer={card.answer} testID="flashcard-detail-answer" />
        </View>

        <View style={fs.card}>
          <Text style={fs.sectionLabel}>Fuente</Text>
          {source ? (
            <TouchableOpacity
              style={styles.sourceRow}
              disabled={Boolean(source.deleted_at)}
              onPress={() => onOpenNote(source.id)}
              accessibilityRole="link"
              testID="flashcard-detail-source"
            >
              <Icon name="document-text-outline" size={22} color={COLORS.TEXT_MEDIUM} />
              <View style={styles.flex}>
                <Text style={styles.sourceTitle}>{source.title || "Sin título"}</Text>
                <Text style={fs.muted}>
                  {[folderName(source.folder_id) || "Sin clasificar", card.source_locator].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {source.deleted_at ? null : <Icon name="chevron-forward" size={18} color={COLORS.TEXT_LIGHT} />}
            </TouchableOpacity>
          ) : (
            <Text style={fs.muted}>{card.origin === "manual" ? "Creada a mano, sin apunte." : "El apunte se ha eliminado."}</Text>
          )}
          <Text style={styles.origin}>{ORIGIN_LABELS[card.origin]}</Text>
        </View>

        <View style={[fs.card, styles.schedule]}>
          <StateChip card={card} testID="flashcard-detail-state" />
          {display === "active" ? (
            <Text style={fs.muted}>
              Próximo repaso: {formatNextReview(card.due_on, today).toLowerCase()} ·{" "}
              {card.review_count === 1 ? "1 repaso" : `${card.review_count} repasos`}
            </Text>
          ) : null}
        </View>

        {display === "missing" ? (
          <>
            <Text style={styles.question}>¿Qué quieres hacer?</Text>
            <View style={fs.card}>
              {source?.deleted_at ? (
                <ActionRow
                  icon="arrow-undo"
                  label="Restaurar el apunte"
                  onPress={() => run(() => restoreItem(source.id))}
                  testID="flashcard-restore-note"
                />
              ) : null}
              <ActionRow icon="trash-outline" label="Eliminar la tarjeta" danger onPress={confirmDelete} />
            </View>
          </>
        ) : null}
      </ScrollView>
    );
  };

  const suspended = card?.status === "suspended";

  return (
    <HeroScreenLayout
      title={cardDisplayState(card || {}) === "modified" ? "Fuente modificada" : "Detalle de la tarjeta"}
      onBack={onBack}
      overlay={
        <>
          {card && cardDisplayState(card) !== "modified" ? (
            <View style={fs.footerBar}>
              <SecondaryButton label="Editar" icon="pencil-outline" onPress={() => setEditing(true)} style={styles.flex} testID="flashcard-edit" />
              <SecondaryButton
                label={suspended ? "Reactivar" : "Suspender"}
                icon={suspended ? "play-circle-outline" : "pause-circle-outline"}
                onPress={() => run(() => setFlashcardStatus(card.id, suspended ? "active" : "suspended"))}
                disabled={busy}
                style={styles.flex}
                testID="flashcard-toggle-suspend"
              />
              <SecondaryButton label="Eliminar" icon="trash-outline" danger onPress={confirmDelete} disabled={busy} style={styles.flex} testID="flashcard-delete" />
            </View>
          ) : null}
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={COLORS.PRIMARY} />
            </View>
          ) : null}
          <CardEditorSheet
            visible={editing}
            title="Editar tarjeta"
            initial={card}
            notice={card?.origin === "generated" ? "Al editarla, la tarjeta se marcará como revisada por ti en lugar de copiada del apunte." : null}
            onSubmit={submitEdit}
            onClose={() => setEditing(false)}
          />
          <ResiNotesSheet visible={changes} title="Lo que decía tu apunte" onClose={() => setChanges(false)}>
            <Text style={fs.muted}>Este es el fragmento del que salió la tarjeta. Ya no está igual en el apunte.</Text>
            <View style={styles.fragment}>
              <AnswerBody answer={card?.source_excerpt || ""} size={15} color={COLORS.TEXT_MEDIUM} />
            </View>
            {card?.source ? (
              <SecondaryButton
                label="Abrir el apunte"
                onPress={() => {
                  setChanges(false);
                  onOpenNote(card.source.id);
                }}
              />
            ) : null}
          </ResiNotesSheet>
        </>
      }
    >
      {renderBody()}
    </HeroScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  qa: { backgroundColor: COLORS.PRIMARY_LIGHT, borderColor: COLORS.PRIMARY_LIGHT },
  metaSpaced: { marginTop: 10 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sourceTitle: { fontSize: 15, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  origin: { fontSize: 13, color: COLORS.TEXT_LIGHT, marginTop: 10 },
  schedule: { gap: 8 },
  question: { fontSize: 17, fontWeight: "700", color: COLORS.PRIMARY_DARK, marginVertical: 10 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: 48 },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.PRIMARY_DARK },
  fragment: { backgroundColor: COLORS.BACKGROUND_LIGHT, borderRadius: 12, padding: 12, marginVertical: 12 },
  busy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CardDetailView;
