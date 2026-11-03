import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { HeroScreenLayout } from "../../HeroScreenLayout";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { flashcardErrorMessage, getNoteCard, saveNoteCard } from "../../../services/flashcardService";
import { noteHasStudyContent } from "../../../utils/flashcards";
import { NoteContent, useNoteForReading } from "../NoteContent";
import { PrimaryButton, SecondaryButton, flashcardStyles as fs } from "./FlashcardParts";

/**
 * «⚡ Repasar ahora» de una nota (ClickUp 124b4z9w5nh): repaso puntual.
 *
 * 1. Se ve el título completo y el contenido oculto: el residente intenta
 *    recordarlo.
 * 2. «Ver apunte» enseña la nota entera tal cual (formato, tablas, imágenes con
 *    zoom), en su versión actual.
 * 3. «Terminar» vuelve a la nota. No hace falta valorar nada.
 *
 * No crea ninguna tarjeta ni entra en los repasos pendientes. Guardarla para
 * los repasos programados («Guardar para repasos») es una acción aparte y
 * voluntaria: crea una tarjeta de apunte completo (sin duplicados).
 */
export const NoteStudyView = ({ userId, itemId, onBack }) => {
  const note = useNoteForReading(itemId);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(null); // null = aún no se sabe
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let alive = true;
    getNoteCard(userId, itemId)
      .then((card) => alive && setSaved(Boolean(card)))
      .catch(() => alive && setSaved(false));
    return () => {
      alive = false;
    };
  }, [userId, itemId]);

  const saveForReviews = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const res = await saveNoteCard(userId, note.item);
      setSaved(true);
      setNotice(res.alreadySaved ? "Ya estaba en tus repasos" : "Guardada en tus repasos");
    } catch (error) {
      Alert.alert("No se ha guardado", flashcardErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (note.loading) {
      return (
        <View style={fs.center}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      );
    }
    if (note.error) {
      return (
        <View style={[fs.center, styles.padded]}>
          <Text style={fs.emptyText}>
            {note.error === "missing"
              ? "Esta nota ya no existe o está en la papelera."
              : "No se ha podido abrir la nota. Revisa tu conexión."}
          </Text>
          {note.error === "missing" ? null : <SecondaryButton label="Reintentar" onPress={note.reload} />}
        </View>
      );
    }
    if (!noteHasStudyContent(note.item.content)) {
      return (
        <View style={[fs.center, styles.padded]} testID="note-study-empty">
          <Icon name="document-text-outline" size={40} color={COLORS.PRIMARY} />
          <Text style={fs.emptyTitle}>Esta nota está vacía</Text>
          <Text style={fs.emptyText}>Escribe algo en ella para poder repasarla.</Text>
          <SecondaryButton label="Volver a la nota" onPress={onBack} />
        </View>
      );
    }

    const title = note.item.title || "Nota sin título";
    return (
      <ScrollView contentContainerStyle={fs.content}>
        <View style={[fs.card, styles.titleCard]}>
          <View style={styles.kind}>
            <Icon name="flash-outline" size={14} color={COLORS.PRIMARY} weight="fill" />
            <Text style={styles.kindText}>Repaso rápido</Text>
          </View>
          <Text style={styles.title} testID="note-study-title">
            {title}
          </Text>
          {revealed ? null : (
            <>
              <Text style={styles.hint}>Intenta recordar lo que dice este apunte antes de verlo.</Text>
              <PrimaryButton label="Ver apunte" icon="eye-outline" onPress={() => setRevealed(true)} testID="note-study-reveal" />
            </>
          )}
        </View>

        {revealed ? (
          <>
            <View style={fs.card}>
              <NoteContent html={note.html} testID="note-study-content" />
            </View>
            <PrimaryButton label="Terminar" onPress={onBack} testID="note-study-finish" />
            <View style={styles.saveRow}>
              {saved ? (
                <View style={styles.savedBox} testID="note-study-saved">
                  <Icon name="checkmark-circle" size={18} color={COLORS.SUCCESS} />
                  <Text style={styles.savedText}>{notice || "Esta nota ya está en tus repasos"}</Text>
                </View>
              ) : (
                <SecondaryButton
                  label={saving ? "Guardando…" : "Guardar para repasos"}
                  icon="bookmark-outline"
                  onPress={saveForReviews}
                  disabled={saving || saved === null}
                  testID="note-study-save"
                />
              )}
              <Text style={styles.saveHint}>
                Opcional: la nota entrará en tus repasos programados como «Apunte completo».
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <HeroScreenLayout
      title="Repasar ahora"
      bottomContent={<Text style={fs.headerSubtitle}>Comprueba si lo recuerdas.</Text>}
      onBack={onBack}
    >
      {renderBody()}
    </HeroScreenLayout>
  );
};

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 24 },
  titleCard: { gap: 14, paddingVertical: 20 },
  kind: { flexDirection: "row", alignItems: "center", gap: 6 },
  kindText: { fontSize: 13, fontWeight: "700", color: COLORS.PRIMARY },
  title: { fontSize: 22, lineHeight: 29, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  hint: { fontSize: 15, color: COLORS.TEXT_LIGHT, lineHeight: 21 },
  saveRow: { marginTop: 12, gap: 8 },
  savedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#E3F6EA",
  },
  savedText: { fontSize: 15, fontWeight: "700", color: "#15803D" },
  saveHint: { fontSize: 13, color: COLORS.TEXT_LIGHT, textAlign: "center", lineHeight: 18 },
});

export default NoteStudyView;
