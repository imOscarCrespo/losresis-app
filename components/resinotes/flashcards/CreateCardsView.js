import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { HeroScreenLayout } from "../../HeroScreenLayout";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { getItem } from "../../../services/resinotesService";
import { flashcardErrorMessage, listFlashcards, saveProposals } from "../../../services/flashcardService";
import { formatCardCount, generateFlashcards, markDuplicates, normalizeText } from "../../../utils/flashcards";
import { recentItems } from "../../../utils/resinotes";
import {
  AnswerBody,
  CardEditorSheet,
  InfoNotice,
  PrimaryButton,
  SecondaryButton,
  flashcardStyles as fs,
} from "./FlashcardParts";

/**
 * «Crear tarjetas» (ClickUp 124b4z9w0z0): de un apunte a «Revisa tus
 * tarjetas» y, al aprobar, a «Tus tarjetas están listas».
 *
 * Las propuestas salen de utils/flashcards (reglas fijas, sin IA). Nada entra
 * en el repaso sin que el residente lo apruebe. Las que ya tiene salen
 * desmarcadas y no entran en «Aprobar todas».
 *
 * Sin `itemId` empieza eligiendo el apunte (acceso desde la portada).
 */

const SOURCE_NOTICE = "Solo se generan tarjetas con información que está en tu apunte, copiada tal cual.";

const NotePicker = ({ items, folderName, onPick }) => {
  const [query, setQuery] = useState("");
  const notes = useMemo(() => {
    const q = normalizeText(query).toLowerCase();
    return recentItems(
      items.filter((i) => i.type === "note"),
      500
    ).filter((n) => !q || normalizeText(n.title).toLowerCase().includes(q));
  }, [items, query]);

  return (
    <ScrollView contentContainerStyle={fs.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>Elige el apunte del que quieres crear tarjetas.</Text>
      <View style={styles.search}>
        <Icon name="search" size={20} color={COLORS.TEXT_LIGHT} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar apunte…"
          placeholderTextColor={COLORS.TEXT_LIGHT}
          style={styles.searchInput}
          accessibilityLabel="Buscar apunte"
        />
      </View>
      {notes.length ? (
        notes.map((note) => (
          <TouchableOpacity
            key={note.id}
            style={[fs.card, styles.noteRow]}
            onPress={() => onPick(note.id)}
            accessibilityRole="button"
            testID={`flashcards-pick-${note.id}`}
          >
            <View style={styles.noteIcon}>
              <Icon name="document-text-outline" size={20} color={COLORS.PRIMARY} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.noteTitle} numberOfLines={2}>
                {note.title || "Sin título"}
              </Text>
              <Text style={fs.muted} numberOfLines={1}>
                {folderName(note.folder_id) || "Sin clasificar"}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color={COLORS.TEXT_LIGHT} />
          </TouchableOpacity>
        ))
      ) : (
        <View style={fs.center}>
          <Text style={fs.emptyTitle}>{query ? "Ningún apunte coincide" : "Aún no tienes notas"}</Text>
          <Text style={fs.emptyText}>
            {query ? "Prueba con otras palabras." : "Escribe una nota en ResiNotes y crea tarjetas a partir de ella."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const Checkbox = ({ checked }) => (
  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
    {checked ? <Icon name="checkmark" size={16} color={COLORS.WHITE} weight="bold" /> : null}
  </View>
);

const SourceFragment = ({ proposal }) => {
  // Si la respuesta es el fragmento entero, no hace falta repetirlo.
  if (normalizeText(proposal.excerpt) === normalizeText(proposal.answer) && !proposal.edited) {
    return proposal.locator ? <Text style={styles.locator}>De «{proposal.locator}»</Text> : null;
  }
  return (
    <View style={styles.fragment}>
      <Text style={styles.fragmentLabel}>
        Fragmento de tu apunte{proposal.locator ? ` · ${proposal.locator}` : ""}
      </Text>
      <AnswerBody answer={proposal.excerpt} size={14} color={COLORS.TEXT_MEDIUM} />
    </View>
  );
};

export const CreateCardsView = ({ userId, itemId: initialItemId = null, library, onBack, onStartReview, onCreated }) => {
  const [itemId, setItemId] = useState(initialItemId);
  const [state, setState] = useState({ step: initialItemId ? "loading" : "pick" });
  const [proposals, setProposals] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // índice
  const [oneByOne, setOneByOne] = useState(null); // índice actual
  const [saving, setSaving] = useState(false);

  const folderName = useCallback(
    (folderId) => (folderId ? library.folders.find((f) => f.id === folderId)?.name : null),
    [library.folders]
  );

  const prepare = useCallback(
    async (id) => {
      setState({ step: "loading" });
      setExpanded(null);
      setOneByOne(null);
      try {
        const [item, existing] = await Promise.all([getItem(id), listFlashcards(userId, { sourceItemId: id })]);
        if (!item || item.deleted_at || item.type !== "note") {
          setState({ step: "error", title: "Este apunte ya no está disponible", message: "Puede que esté en la papelera." });
          return;
        }
        const { proposals: generated, reason } = generateFlashcards({ html: item.content, title: item.title });
        const marked = markDuplicates(generated, existing).map((p, idx) => ({ ...p, key: `p${idx}` }));
        setProposals(marked);
        setSelected(new Set(marked.filter((p) => !p.duplicate).map((p) => p.key)));
        setState({ step: reason ? reason : "review", item });
      } catch (error) {
        setState({ step: "error", title: "No hemos podido preparar las tarjetas", message: flashcardErrorMessage(error, "Revisa tu conexión e inténtalo de nuevo.") });
      }
    },
    [userId]
  );

  useEffect(() => {
    if (initialItemId) prepare(initialItemId);
  }, [initialItemId, prepare]);

  const pick = (id) => {
    setItemId(id);
    prepare(id);
  };

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allSelectable = proposals.filter((p) => !p.duplicate);
  const allOn = allSelectable.length > 0 && allSelectable.every((p) => selected.has(p.key));
  const selectedCount = proposals.filter((p) => selected.has(p.key)).length;

  const discard = (key) => {
    setProposals((prev) => prev.filter((p) => p.key !== key));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setExpanded(null);
  };

  const save = async (keys) => {
    const chosen = proposals.filter((p) => keys.has(p.key));
    if (!chosen.length) {
      onBack();
      return;
    }
    setSaving(true);
    try {
      await saveProposals(userId, itemId, chosen);
      onCreated?.();
      setState((prev) => ({ ...prev, step: "done", saved: chosen.length }));
    } catch (error) {
      const message = flashcardErrorMessage(error);
      const changed = String(error?.message || "").includes("source_changed") || String(error?.message || "").includes("not_in_source");
      Alert.alert(
        "No se han guardado las tarjetas",
        message,
        changed
          ? [
              { text: "Cancelar", style: "cancel" },
              { text: "Volver a preparar", onPress: () => prepare(itemId) },
            ]
          : [{ text: "Entendido" }]
      );
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async ({ question, answer }) => {
    const key = proposals[editing]?.key;
    setProposals((prev) =>
      prev.map((p) =>
        p.key === key
          ? {
              ...p,
              question,
              answer,
              edited: p.edited || normalizeText(question) !== normalizeText(p.question) || normalizeText(answer) !== normalizeText(p.answer),
            }
          : p
      )
    );
    if (key) setSelected((prev) => new Set(prev).add(key));
    setEditing(null);
  };

  // ---- Una a una ----
  const decideOne = (approve) => {
    const current = proposals[oneByOne];
    if (!current) return;
    const nextSelected = new Set(selected);
    if (approve) nextSelected.add(current.key);
    else nextSelected.delete(current.key);
    setSelected(nextSelected);
    if (oneByOne + 1 < proposals.length) {
      setOneByOne(oneByOne + 1);
    } else {
      setOneByOne(null);
      save(nextSelected);
    }
  };

  const title = state.step === "pick" ? "Crear tarjetas" : state.step === "done" ? "Tarjetas listas" : "Revisa tus tarjetas";
  const goBack = () => {
    if (oneByOne !== null) {
      setOneByOne(null);
      return;
    }
    if (!initialItemId && state.step !== "pick" && state.step !== "done") {
      setState({ step: "pick" });
      return;
    }
    onBack();
  };

  const renderBody = () => {
    if (state.step === "pick") {
      return <NotePicker items={library.items} folderName={folderName} onPick={pick} />;
    }
    if (state.step === "loading") {
      return (
        <View style={fs.center} testID="flashcards-preparing">
          <ActivityIndicator color={COLORS.PRIMARY} />
          <Text style={fs.muted}>Estamos preparando tus tarjetas…</Text>
        </View>
      );
    }
    if (state.step === "empty" || state.step === "no_structure" || state.step === "error") {
      const copy =
        state.step === "empty"
          ? { title: "Este apunte está vacío", message: "Escribe algo en él y vuelve a intentarlo." }
          : state.step === "no_structure"
            ? {
                title: "No se ha podido generar ninguna tarjeta",
                message:
                  "No hemos encontrado información suficientemente clara en este apunte. Las tarjetas salen de los títulos con su contenido, las listas, las líneas «Término: definición» y las tablas.",
              }
            : { title: state.title, message: state.message };
      return (
        <View style={[fs.center, styles.padded]} testID={`flashcards-${state.step}`}>
          <Icon name="cards-outline" size={40} color={COLORS.PRIMARY} />
          <Text style={fs.emptyTitle}>{copy.title}</Text>
          <Text style={fs.emptyText}>{copy.message}</Text>
          {state.step === "error" && itemId ? (
            <SecondaryButton label="Reintentar" onPress={() => prepare(itemId)} />
          ) : null}
        </View>
      );
    }
    if (state.step === "done") {
      return (
        <View style={[fs.center, styles.padded]} testID="flashcards-done">
          <View style={styles.doneIcon}>
            <Icon name="checkmark" size={36} color={COLORS.PRIMARY} weight="bold" />
          </View>
          <Text style={fs.emptyTitle}>Tus tarjetas están listas</Text>
          <Text style={fs.emptyText}>
            Has guardado {formatCardCount(state.saved)}. Aparecerán en tu repaso de hoy.
          </Text>
          <PrimaryButton label="Empezar repaso" icon="arrow-forward" onPress={onStartReview} style={styles.fullWidth} testID="flashcards-done-start" />
          <SecondaryButton label="Volver" onPress={onBack} style={styles.fullWidth} testID="flashcards-done-back" />
        </View>
      );
    }

    // review
    if (oneByOne !== null) {
      const current = proposals[oneByOne];
      return (
        <ScrollView contentContainerStyle={fs.content}>
          <Text style={styles.progress}>
            Tarjeta {oneByOne + 1} de {proposals.length}
          </Text>
          <View style={fs.card} testID="flashcards-one-by-one">
            <Text style={fs.sectionLabel}>Pregunta</Text>
            <Text style={fs.question}>{current.question}</Text>
            <Text style={[fs.sectionLabel, styles.spaced]}>Respuesta</Text>
            <AnswerBody answer={current.answer} />
            {current.duplicate ? <Text style={styles.duplicate}>Ya tienes una tarjeta igual.</Text> : null}
            {current.edited ? <Text style={styles.edited}>Editada por ti</Text> : null}
          </View>
          <SourceFragment proposal={current} />
          <View style={styles.oneActions}>
            <SecondaryButton label="Descartar" danger onPress={() => decideOne(false)} style={styles.flex} testID="flashcards-one-discard" />
            <SecondaryButton label="Editar" icon="pencil-outline" onPress={() => setEditing(oneByOne)} style={styles.flex} />
          </View>
          <PrimaryButton label="Aprobar" onPress={() => decideOne(true)} loading={saving} testID="flashcards-one-approve" />
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={fs.content}>
        <Text style={styles.intro}>
          Hemos preparado {formatCardCount(proposals.length)} a partir de «{state.item?.title || "tu apunte"}». Revisa y selecciona las que
          quieras guardar.
        </Text>
        <InfoNotice>{SOURCE_NOTICE}</InfoNotice>
        <TouchableOpacity
          style={styles.selectAll}
          onPress={() => setSelected(allOn ? new Set() : new Set(allSelectable.map((p) => p.key)))}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allOn }}
          testID="flashcards-select-all"
        >
          <Text style={styles.selectAllText}>
            {selectedCount} de {proposals.length} seleccionadas
          </Text>
          <Checkbox checked={allOn} />
        </TouchableOpacity>
        {proposals.map((p, idx) => {
          const open = expanded === p.key;
          return (
            <View key={p.key} style={[fs.card, styles.proposal]}>
              <View style={styles.proposalRow}>
                <TouchableOpacity
                  onPress={() => toggle(p.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected.has(p.key) }}
                  accessibilityLabel={p.question}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  testID={`flashcards-proposal-check-${idx}`}
                >
                  <Checkbox checked={selected.has(p.key)} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.flex}
                  onPress={() => setExpanded(open ? null : p.key)}
                  accessibilityRole="button"
                  accessibilityHint={open ? "Oculta la respuesta" : "Muestra la respuesta y su fuente"}
                  testID={`flashcards-proposal-${idx}`}
                >
                  <Text style={styles.proposalQuestion}>{p.question}</Text>
                  {p.duplicate ? <Text style={styles.duplicate}>Ya tienes una tarjeta igual</Text> : null}
                  {p.edited ? <Text style={styles.edited}>Editada por ti</Text> : null}
                </TouchableOpacity>
                <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={COLORS.TEXT_LIGHT} />
              </View>
              {open ? (
                <View style={styles.proposalBody}>
                  <AnswerBody answer={p.answer} size={15} />
                  <SourceFragment proposal={p} />
                  <View style={styles.inlineActions}>
                    <TouchableOpacity onPress={() => setEditing(idx)} accessibilityRole="button" style={styles.inlineAction}>
                      <Icon name="pencil-outline" size={16} color={COLORS.PRIMARY} />
                      <Text style={styles.inlineActionText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => discard(p.key)} accessibilityRole="button" style={styles.inlineAction}>
                      <Icon name="trash-outline" size={16} color={COLORS.ERROR} />
                      <Text style={[styles.inlineActionText, { color: COLORS.ERROR }]}>Descartar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const showFooter = state.step === "review" && oneByOne === null && proposals.length > 0;

  return (
    <HeroScreenLayout
      title={title}
      bottomContent={state.step === "pick" ? <Text style={fs.headerSubtitle}>A partir de tus apuntes.</Text> : null}
      onBack={goBack}
      overlay={
        <>
          {showFooter ? (
            <View style={fs.footerBar}>
              <SecondaryButton label="Revisar una a una" onPress={() => setOneByOne(0)} style={styles.flex} testID="flashcards-one-by-one-start" />
              <PrimaryButton
                label={selectedCount ? `Aprobar ${formatCardCount(selectedCount)}` : "Aprobar"}
                onPress={() => save(selected)}
                disabled={!selectedCount}
                loading={saving}
                style={styles.flex}
                testID="flashcards-approve"
              />
            </View>
          ) : null}
          <CardEditorSheet
            visible={editing !== null}
            title="Editar tarjeta"
            initial={editing !== null ? proposals[editing] : null}
            notice="Al editarla, la tarjeta se marcará como revisada por ti en lugar de copiada del apunte."
            onSubmit={submitEdit}
            onClose={() => setEditing(null)}
          />
        </>
      }
    >
      {renderBody()}
    </HeroScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: 24 },
  fullWidth: { alignSelf: "stretch" },
  intro: { fontSize: 15, color: COLORS.TEXT_MEDIUM, lineHeight: 21, marginBottom: 8 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.WHITE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.TEXT_DARK, paddingVertical: 0 },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  noteTitle: { fontSize: 15, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  selectAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 10,
  },
  selectAllText: { fontSize: 15, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.GRAY_MEDIUM,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.WHITE,
  },
  checkboxOn: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
  proposal: { paddingVertical: 14 },
  proposalRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  proposalQuestion: { fontSize: 15, fontWeight: "600", color: COLORS.PRIMARY_DARK, lineHeight: 21 },
  proposalBody: { marginTop: 12, marginLeft: 36, gap: 10 },
  duplicate: { fontSize: 13, color: "#B45309", marginTop: 4, fontWeight: "600" },
  edited: { fontSize: 13, color: COLORS.PRIMARY, marginTop: 4, fontWeight: "600" },
  locator: { fontSize: 13, color: COLORS.TEXT_LIGHT },
  fragment: { backgroundColor: COLORS.BACKGROUND_LIGHT, borderRadius: 12, padding: 12, gap: 6 },
  fragmentLabel: { fontSize: 12, fontWeight: "700", color: COLORS.TEXT_LIGHT },
  inlineActions: { flexDirection: "row", gap: 18 },
  inlineAction: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  inlineActionText: { fontSize: 14, fontWeight: "700", color: COLORS.PRIMARY },
  progress: { fontSize: 14, fontWeight: "700", color: COLORS.PRIMARY_DARK, marginBottom: 10 },
  spaced: { marginTop: 14 },
  oneActions: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 10 },
  doneIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CreateCardsView;
