import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { HeroScreenLayout } from "../../HeroScreenLayout";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { getItem } from "../../../services/resinotesService";
import { flashcardErrorMessage, listFlashcards, saveProposals } from "../../../services/flashcardService";
import {
  formatCardCount,
  generateFlashcards,
  generateFromSelection,
  markDuplicates,
  markSimilar,
  normalizeText,
} from "../../../utils/flashcards";
import { descendantIds, htmlToPlainText, recentItems, sortFolderItems } from "../../../utils/resinotes";
import { ResiNotesSheet } from "../ResiNotesSheet";
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
 *
 * Pasada B:
 *   * `selectionHtml`: solo el fragmento seleccionado en el editor. Pasa por las
 *     mismas reglas y se queda solo lo que está tal cual en el texto guardado
 *     del apunte (la BD lo vuelve a comprobar).
 *   * `folderId`: «Generar tarjetas de esta carpeta». Antes de generar enseña
 *     exactamente qué notas se procesan (con o sin subcarpetas). Las
 *     propuestas van agrupadas por nota y se guardan nota a nota: nunca se
 *     mezclan notas en una tarjeta.
 *   * Tarjetas parecidas a una que ya tiene: «Ya tienes una tarjeta parecida»,
 *     desmarcadas, con Ver existente / Mantener ambas / Descartar nueva.
 *   * El atrás de Android lo gestiona esta vista (en «Revisar una a una» vuelve
 *     a la lista sin perder nada).
 */

export const MAX_FOLDER_NOTES = 30;
const LOAD_BATCH = 5;

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

/** Notas de una carpeta (y, si se pide, de sus subcarpetas), en el orden de la carpeta. */
export const folderNotes = (library, folderId, includeSubfolders) => {
  const ids = new Set([folderId]);
  if (includeSubfolders) descendantIds(library.folders.filter((f) => !f.deleted_at), folderId).forEach((id) => ids.add(id));
  return sortFolderItems(library.items.filter((i) => i.type === "note" && !i.deleted_at && ids.has(i.folder_id)));
};

const FolderNotesPicker = ({ library, folderId, folderName, onGenerate }) => {
  const [withSub, setWithSub] = useState(true);
  const notes = useMemo(() => folderNotes(library, folderId, withSub), [library, folderId, withSub]);
  const [excluded, setExcluded] = useState(new Set());
  const chosen = notes.filter((n) => !excluded.has(n.id));
  const tooMany = chosen.length > MAX_FOLDER_NOTES;
  const hasSubfolders = library.folders.some((f) => !f.deleted_at && f.parent_id === folderId);
  const folder = library.folders.find((f) => f.id === folderId);

  const toggle = (id) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <ScrollView contentContainerStyle={fs.content} testID="flashcards-folder-notes">
        <Text style={styles.intro}>
          Se crearán tarjetas a partir de estas notas de «{folder?.name || "la carpeta"}». Cada tarjeta sale de una sola nota.
        </Text>
        {hasSubfolders ? (
          <View style={[fs.card, styles.switchRow]}>
            <Text style={styles.switchLabel}>Incluir subcarpetas</Text>
            <Switch
              value={withSub}
              onValueChange={setWithSub}
              trackColor={{ true: COLORS.PRIMARY, false: COLORS.GRAY_MEDIUM }}
              thumbColor={COLORS.WHITE}
              accessibilityLabel="Incluir subcarpetas"
              testID="flashcards-folder-subfolders"
            />
          </View>
        ) : null}
        <Text style={styles.selectAllText} testID="flashcards-folder-count">
          {chosen.length === 1 ? "1 nota" : `${chosen.length} notas`} de {notes.length}
        </Text>
        {notes.map((note) => {
          const on = !excluded.has(note.id);
          return (
            <TouchableOpacity
              key={note.id}
              style={[fs.card, styles.noteRow]}
              onPress={() => toggle(note.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={note.title || "Sin título"}
              testID={`flashcards-folder-note-${note.id}`}
            >
              <Checkbox checked={on} />
              <View style={styles.flex}>
                <Text style={styles.noteTitle} numberOfLines={2}>
                  {note.title || "Sin título"}
                </Text>
                {note.folder_id !== folderId ? (
                  <Text style={fs.muted} numberOfLines={1}>
                    {folderName(note.folder_id)}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        {!notes.length ? (
          <View style={fs.center}>
            <Text style={fs.emptyTitle}>No hay notas</Text>
            <Text style={fs.emptyText}>
              {withSub ? "Esta carpeta no tiene notas de texto." : "Esta carpeta no tiene notas. Prueba a incluir las subcarpetas."}
            </Text>
          </View>
        ) : null}
        {tooMany ? (
          <InfoNotice icon="warning-outline" tone="warning">
            Puedes generar tarjetas de hasta {MAX_FOLDER_NOTES} notas a la vez. Desmarca algunas o elige una subcarpeta.
          </InfoNotice>
        ) : null}
      </ScrollView>
      <View style={fs.footerBar}>
        <PrimaryButton
          label={chosen.length ? `Generar tarjetas (${chosen.length === 1 ? "1 nota" : `${chosen.length} notas`})` : "Generar tarjetas"}
          onPress={() => onGenerate(chosen)}
          disabled={!chosen.length || tooMany}
          style={styles.flex}
          testID="flashcards-folder-generate"
        />
      </View>
    </>
  );
};

/** Prepara las propuestas de una nota (o de un fragmento suyo) y las marca contra lo que ya tiene. */
const proposalsForItem = (item, selectionHtml) => {
  if (selectionHtml) {
    return generateFromSelection({ selectionHtml, title: item.title, contentText: htmlToPlainText(item.content) });
  }
  return generateFlashcards({ html: item.content, title: item.title });
};

export const CreateCardsView = ({
  userId,
  itemId: initialItemId = null,
  selectionHtml = null,
  folderId = null,
  library,
  onBack,
  onStartReview,
  onCreated,
}) => {
  const [itemId, setItemId] = useState(initialItemId);
  const [state, setState] = useState({ step: folderId ? "folder" : initialItemId ? "loading" : "pick" });
  const [proposals, setProposals] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // índice
  const [oneByOne, setOneByOne] = useState(null); // índice actual
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null); // tarjeta parecida que se está viendo
  const savingRef = useRef(false);

  const folderName = useCallback(
    (fid) => (fid ? library.folders.find((f) => f.id === fid)?.name : null),
    [library.folders]
  );

  const loadProposals = useCallback(
    async (items, { selection = null } = {}) => {
      setExpanded(null);
      setOneByOne(null);
      const existing = await listFlashcards(userId);
      const all = [];
      const empty = [];
      items.forEach((item) => {
        const { proposals: generated } = proposalsForItem(item, selection);
        if (!generated.length) empty.push(item);
        generated.forEach((p) => all.push({ ...p, itemId: item.id, itemTitle: item.title || "Sin título" }));
      });
      const marked = markSimilar(markDuplicates(all, existing), existing).map((p, idx) => ({ ...p, key: `p${idx}` }));
      setProposals(marked);
      setSelected(new Set(marked.filter((p) => !p.duplicate && !p.similar).map((p) => p.key)));
      return { marked, empty };
    },
    [userId]
  );

  const prepare = useCallback(
    async (id) => {
      setState({ step: "loading" });
      try {
        const item = await getItem(id);
        if (!item || item.deleted_at || item.type !== "note") {
          setState({ step: "error", title: "Este apunte ya no está disponible", message: "Puede que esté en la papelera." });
          return;
        }
        const { reason } = proposalsForItem(item, selectionHtml);
        const { marked } = await loadProposals([item], { selection: selectionHtml });
        setState({ step: reason || (marked.length ? "review" : "no_structure"), item });
      } catch (error) {
        setState({ step: "error", title: "No hemos podido preparar las tarjetas", message: flashcardErrorMessage(error, "Revisa tu conexión e inténtalo de nuevo.") });
      }
    },
    [loadProposals, selectionHtml]
  );

  const prepareFolder = async (notes) => {
    setState({ step: "loading", fromFolder: true });
    try {
      const items = [];
      for (let i = 0; i < notes.length; i += LOAD_BATCH) {
        const batch = await Promise.all(notes.slice(i, i + LOAD_BATCH).map((n) => getItem(n.id)));
        batch.forEach((item) => {
          if (item && !item.deleted_at && item.type === "note") items.push(item);
        });
      }
      const { marked, empty } = await loadProposals(items);
      setState({
        step: marked.length ? "review" : "no_structure",
        fromFolder: true,
        notes: items.length,
        emptyNotes: empty.map((i) => i.title || "Sin título"),
      });
    } catch (error) {
      setState({ step: "error", fromFolder: true, title: "No hemos podido preparar las tarjetas", message: flashcardErrorMessage(error, "Revisa tu conexión e inténtalo de nuevo.") });
    }
  };

  useEffect(() => {
    if (initialItemId && !folderId) prepare(initialItemId);
  }, [initialItemId, folderId, prepare]);

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

  // En «Aprobar todas» no entran las repetidas ni las parecidas sin decidir.
  const bulkSelectable = (p) => !p.duplicate && (!p.similar || p.keepBoth);
  const allSelectable = proposals.filter(bulkSelectable);
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

  const keepBoth = (key) => {
    setProposals((prev) => prev.map((p) => (p.key === key ? { ...p, keepBoth: true } : p)));
    setSelected((prev) => new Set(prev).add(key));
  };

  const save = async (keys) => {
    if (savingRef.current) return;
    const chosen = proposals.filter((p) => keys.has(p.key));
    if (!chosen.length) {
      onBack();
      return;
    }
    // Una llamada por nota: si una nota ha cambiado, las demás se guardan igual.
    const groups = new Map();
    chosen.forEach((p) => {
      if (!groups.has(p.itemId)) groups.set(p.itemId, []);
      groups.get(p.itemId).push(p);
    });
    savingRef.current = true;
    setSaving(true);
    let saved = 0;
    const failed = [];
    let lastError = null;
    for (const [id, group] of groups) {
      try {
        await saveProposals(userId, id, group);
        saved += group.length;
        const savedKeys = new Set(group.map((p) => p.key));
        setProposals((prev) => prev.filter((p) => !savedKeys.has(p.key)));
      } catch (error) {
        lastError = error;
        failed.push(group[0].itemTitle);
      }
    }
    savingRef.current = false;
    setSaving(false);
    if (saved) onCreated?.();

    if (!failed.length) {
      setState((prev) => ({ ...prev, step: "done", saved }));
      return;
    }
    const message = flashcardErrorMessage(lastError);
    const changed = /source_changed|not_in_source/.test(String(lastError?.message || ""));
    if (groups.size === 1) {
      Alert.alert(
        "No se han guardado las tarjetas",
        message,
        changed && !state.fromFolder
          ? [
              { text: "Cancelar", style: "cancel" },
              { text: "Volver a preparar", onPress: () => prepare(itemId) },
            ]
          : [{ text: "Entendido" }]
      );
      return;
    }
    Alert.alert(
      saved ? `Se han guardado ${formatCardCount(saved)}` : "No se han guardado las tarjetas",
      `No se han podido guardar las de: ${failed.join(", ")}. ${message}`,
      [{ text: "Entendido" }]
    );
    if (saved) setState((prev) => ({ ...prev, partial: true }));
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
    if (approve && current.similar) {
      setProposals((prev) => prev.map((p) => (p.key === current.key ? { ...p, keepBoth: true } : p)));
    }
    if (oneByOne + 1 < proposals.length) {
      setOneByOne(oneByOne + 1);
    } else {
      setOneByOne(null);
      save(nextSelected);
    }
  };

  const title =
    state.step === "pick"
      ? "Crear tarjetas"
      : state.step === "folder"
        ? "Tarjetas de la carpeta"
        : state.step === "done"
          ? "Tarjetas listas"
          : "Revisa tus tarjetas";

  const goBack = () => {
    if (viewing) {
      setViewing(null);
      return;
    }
    if (oneByOne !== null) {
      setOneByOne(null);
      return;
    }
    if (folderId && state.step !== "folder" && state.step !== "done" && !saving) {
      setState({ step: "folder" });
      return;
    }
    if (!initialItemId && !folderId && state.step !== "pick" && state.step !== "done") {
      setState({ step: "pick" });
      return;
    }
    onBack();
  };

  // El atrás de Android hace lo mismo que «Volver» (ResiNotesScreen no lo gestiona en esta vista).
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const SimilarNotice = ({ proposal }) =>
    proposal.similar && !proposal.keepBoth ? (
      <View style={styles.similarBox} testID="flashcards-similar">
        <Text style={styles.similarTitle}>Ya tienes una tarjeta parecida.</Text>
        <View style={styles.similarActions}>
          <TouchableOpacity onPress={() => setViewing(proposal.similar)} accessibilityRole="button" testID="flashcards-similar-view">
            <Text style={styles.similarAction}>Ver existente</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => keepBoth(proposal.key)} accessibilityRole="button" testID="flashcards-similar-keep">
            <Text style={styles.similarAction}>Mantener ambas</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => discard(proposal.key)} accessibilityRole="button" testID="flashcards-similar-discard">
            <Text style={[styles.similarAction, { color: COLORS.ERROR }]}>Descartar nueva</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : null;

  const renderProposal = (p, idx) => {
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
            {p.similar && !p.keepBoth ? <Text style={styles.duplicate}>Ya tienes una tarjeta parecida</Text> : null}
            {p.edited ? <Text style={styles.edited}>Editada por ti</Text> : null}
          </TouchableOpacity>
          <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={COLORS.TEXT_LIGHT} />
        </View>
        {open ? (
          <View style={styles.proposalBody}>
            <AnswerBody answer={p.answer} size={15} />
            <SourceFragment proposal={p} />
            <SimilarNotice proposal={p} />
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
  };

  const renderBody = () => {
    if (state.step === "pick") {
      return <NotePicker items={library.items} folderName={folderName} onPick={pick} />;
    }
    if (state.step === "folder") {
      return <FolderNotesPicker library={library} folderId={folderId} folderName={folderName} onGenerate={prepareFolder} />;
    }
    if (state.step === "loading") {
      return (
        <View style={fs.center} testID="flashcards-preparing">
          <ActivityIndicator color={COLORS.PRIMARY} />
          <Text style={fs.muted}>Estamos preparando tus tarjetas…</Text>
        </View>
      );
    }
    if (["empty", "no_structure", "needs_context", "error"].includes(state.step)) {
      const copy =
        state.step === "empty"
          ? { title: "Este apunte está vacío", message: "Escribe algo en él y vuelve a intentarlo." }
          : state.step === "needs_context"
            ? { title: "Este fragmento necesita más contexto", message: "Selecciona un apartado más completo." }
            : state.step === "no_structure"
              ? {
                  title: "No se ha podido generar ninguna tarjeta",
                  message: `No hemos encontrado información suficientemente clara en ${state.fromFolder ? "estas notas" : "este apunte"}. Las tarjetas salen de los títulos con su contenido, las listas, las líneas «Término: definición» y las tablas.`,
                }
              : { title: state.title, message: state.message };
      return (
        <View style={[fs.center, styles.padded]} testID={`flashcards-${state.step}`}>
          <Icon name="cards-outline" size={40} color={COLORS.PRIMARY} />
          <Text style={fs.emptyTitle}>{copy.title}</Text>
          <Text style={fs.emptyText}>{copy.message}</Text>
          {state.step === "error" && itemId && !state.fromFolder ? (
            <SecondaryButton label="Reintentar" onPress={() => prepare(itemId)} />
          ) : null}
          {state.step === "needs_context" ? <SecondaryButton label="Volver al apunte" onPress={onBack} /> : null}
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
          {state.fromFolder ? <Text style={styles.groupLabel}>{current.itemTitle}</Text> : null}
          <View style={fs.card} testID="flashcards-one-by-one">
            <Text style={fs.sectionLabel}>Pregunta</Text>
            <Text style={fs.question}>{current.question}</Text>
            <Text style={[fs.sectionLabel, styles.spaced]}>Respuesta</Text>
            <AnswerBody answer={current.answer} />
            {current.duplicate ? <Text style={styles.duplicate}>Ya tienes una tarjeta igual.</Text> : null}
            {current.edited ? <Text style={styles.edited}>Editada por ti</Text> : null}
          </View>
          {current.similar && !current.keepBoth ? (
            <View style={styles.similarBox}>
              <Text style={styles.similarTitle}>Ya tienes una tarjeta parecida.</Text>
              <TouchableOpacity onPress={() => setViewing(current.similar)} accessibilityRole="button">
                <Text style={styles.similarAction}>Ver existente</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <SourceFragment proposal={current} />
          <View style={styles.oneActions}>
            <SecondaryButton label="Descartar" danger onPress={() => decideOne(false)} style={styles.flex} testID="flashcards-one-discard" />
            <SecondaryButton label="Editar" icon="pencil-outline" onPress={() => setEditing(oneByOne)} style={styles.flex} />
          </View>
          <PrimaryButton
            label={current.similar && !current.keepBoth ? "Mantener ambas" : "Aprobar"}
            onPress={() => decideOne(true)}
            loading={saving}
            testID="flashcards-one-approve"
          />
        </ScrollView>
      );
    }

    // Agrupadas por nota (desde una carpeta); desde un apunte, una sola lista.
    const groups = [];
    proposals.forEach((p, idx) => {
      const last = groups[groups.length - 1];
      if (last && last.itemId === p.itemId) last.rows.push([p, idx]);
      else groups.push({ itemId: p.itemId, title: p.itemTitle, rows: [[p, idx]] });
    });

    return (
      <ScrollView contentContainerStyle={fs.content}>
        <Text style={styles.intro}>
          {state.fromFolder
            ? `Hemos preparado ${formatCardCount(proposals.length)} a partir de ${groups.length === 1 ? "1 nota" : `${groups.length} notas`}. Revisa y selecciona las que quieras guardar.`
            : selectionHtml
              ? `Hemos preparado ${formatCardCount(proposals.length)} a partir del fragmento que has seleccionado. Revisa y selecciona las que quieras guardar.`
              : `Hemos preparado ${formatCardCount(proposals.length)} a partir de «${state.item?.title || "tu apunte"}». Revisa y selecciona las que quieras guardar.`}
        </Text>
        <InfoNotice>{SOURCE_NOTICE}</InfoNotice>
        {state.fromFolder && state.emptyNotes?.length ? (
          <Text style={fs.muted} testID="flashcards-folder-empty-notes">
            Sin tarjetas: {state.emptyNotes.join(", ")}.
          </Text>
        ) : null}
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
        {state.fromFolder
          ? groups.map((g) => (
              <View key={g.itemId}>
                <Text style={styles.groupLabel} testID={`flashcards-group-${g.itemId}`}>
                  {g.title}
                </Text>
                {g.rows.map(([p, idx]) => renderProposal(p, idx))}
              </View>
            ))
          : proposals.map((p, idx) => renderProposal(p, idx))}
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
          <ResiNotesSheet visible={Boolean(viewing)} title="Tu tarjeta parecida" onClose={() => setViewing(null)} testID="flashcards-similar-sheet">
            {viewing ? (
              <>
                <Text style={fs.sectionLabel}>Pregunta</Text>
                <Text style={[fs.question, styles.viewQuestion]}>{viewing.question}</Text>
                <Text style={fs.sectionLabel}>Respuesta</Text>
                <AnswerBody answer={viewing.answer} size={15} />
              </>
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
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.PRIMARY_DARK },
  groupLabel: { fontSize: 14, fontWeight: "700", color: COLORS.TEXT_MEDIUM, marginTop: 10, marginBottom: 8 },
  similarBox: { backgroundColor: "#FEF6DC", borderRadius: 12, padding: 12, gap: 8, marginBottom: 10 },
  similarTitle: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  similarActions: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  similarAction: { fontSize: 14, fontWeight: "700", color: COLORS.PRIMARY, paddingVertical: 4 },
  viewQuestion: { marginBottom: 14 },
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
