import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { Icon } from "../components/Icon";
import { COLORS } from "../constants/colors";
import { ResiNotesSheet, SheetOption } from "../components/resinotes/ResiNotesSheet";
import { FolderRow, ItemRow, ResiNotesEmpty } from "../components/resinotes/ResiNotesRows";
import {
  FolderFormSheet,
  FolderPickerSheet,
  LinkFormSheet,
  RenameSheet,
} from "../components/resinotes/FolderForms";
import { NoteEditor } from "../components/resinotes/NoteEditor";
import { PdfViewer } from "../components/resinotes/PdfViewer";
import { pickDocuments, pickImagesFromLibrary, takePhoto } from "../components/resinotes/pickers";
import {
  createFolder,
  createLink,
  createNote,
  deleteFolderForever,
  deleteItemForever,
  friendlyError,
  getItem,
  getSignedUrl,
  loadLibrary,
  loadTrash,
  markItemOpened,
  moveFolder,
  moveFolders,
  moveItem,
  moveItems,
  reorder,
  restoreFolder,
  restoreItem,
  searchLibrary,
  setItemsFavorite,
  trashFolder,
  trashFolders,
  trashItem,
  trashItems,
  updateFolder,
  updateItem,
  uploadFileItem,
} from "../services/resinotesService";
import { exportFolderZip, exportNoteHtml } from "../services/resinotesExport";
import { getReviewPreferences, loadReviewData, saveReviewPreferences } from "../services/flashcardService";
import { ReviewTodayCard } from "../components/resinotes/flashcards/ReviewTodayCard";
import { CreateCardsView } from "../components/resinotes/flashcards/CreateCardsView";
import { ReviewSessionView } from "../components/resinotes/flashcards/ReviewSessionView";
import { MyCardsView } from "../components/resinotes/flashcards/MyCardsView";
import { CardDetailView } from "../components/resinotes/flashcards/CardDetailView";
import { ReviewSettingsView } from "../components/resinotes/flashcards/ReviewSettingsView";
import { buildTodayQueue, includedFolderSet, isPaused, localDateString } from "../utils/flashcards";
import {
  ITEM_TYPE_ICONS,
  ITEM_TYPE_LABELS,
  TRASH_RETENTION_DAYS,
  applyOrder,
  childFolders,
  countItemsByFolder,
  favoriteItems,
  folderColor,
  folderPath,
  formatElementCount,
  daysUntilPurge,
  formatPurgeCountdown,
  formatSelectionCount,
  formatShortDate,
  moveInOrder,
  orderIds,
  recentItems,
  selectionKey,
  sortFolderItems,
  splitSelection,
  toggleSelection,
  unclassifiedItems,
} from "../utils/resinotes";

/**
 * ResiNotes (ClickUp 124b4z9w0qg): la biblioteca personal de apuntes del residente.
 *
 * Es una única sección del Dashboard con su propia pila de vistas (inicio,
 * carpeta, listas rápidas, búsqueda, papelera y editor), para no tocar la
 * navegación global. «Volver» (botón o gesto de Android) recorre esa pila y,
 * al llegar al inicio, sale de ResiNotes.
 */

const QUICK_CARDS = [
  { key: "favorites", label: "Favoritos", icon: "star-outline", bg: "#FFF1E6", fg: "#F59E0B" },
  { key: "recents", label: "Recientes", icon: "time-outline", bg: "#F1EAFE", fg: "#7C3AED" },
  { key: "unclassified", label: "Sin clasificar", icon: "file-tray-outline", bg: "#E6F0FE", fg: "#2563EB" },
  { key: "trash", label: "Papelera", icon: "trash-outline", bg: "#E6F7F4", fg: "#0D9488" },
  // Tarjetas de repaso (ClickUp 124b4z9w0z0).
  { key: "cards", label: "Mis tarjetas", icon: "cards-outline", bg: "#FDECF4", fg: "#DB2777" },
];

const LIST_TITLES = {
  favorites: { title: "Favoritos", emoji: "⭐", empty: "Marca cualquier apunte con ⭐ para tenerlo aquí." },
  recents: { title: "Recientes", emoji: "🕒", empty: "Aquí verás lo último que hayas abierto o editado." },
  unclassified: {
    title: "Sin clasificar",
    emoji: "📥",
    empty: "Lo que guardes desde el inicio sin elegir carpeta aparecerá aquí.",
  },
};

const SEARCH_FILTERS = [
  { key: null, label: "Todo" },
  { key: "note", label: "Notas" },
  { key: "pdf", label: "PDFs" },
  { key: "image", label: "Imágenes" },
  { key: "link", label: "Enlaces" },
  { key: "folder", label: "Carpetas" },
];

const PATIENT_NOTICE = "Tus apuntes son privados. No guardes datos identificables de pacientes.";

// Pila con la que se abre ResiNotes. 'review-today' viene del recordatorio push
// del repaso (ClickUp 124b4z9w0z0): abre el repaso y «Volver» lleva a la portada.
const initialStack = (initialRoute) =>
  initialRoute === "review-today" ? [{ name: "home" }, { name: "review", mode: "today", fromPush: true }] : [{ name: "home" }];

const ResiNotesScreen = ({ userProfile, onBack, initialRoute = null }) => {
  const userId = userProfile?.id;
  const [stack, setStack] = useState(() => initialStack(initialRoute));
  const route = stack[stack.length - 1];

  const [library, setLibrary] = useState({ folders: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(null);

  // Hojas
  const [createMenu, setCreateMenu] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [linkForm, setLinkForm] = useState(false);
  const [folderForm, setFolderForm] = useState(null); // {folder?, parentId?}
  const [itemActions, setItemActions] = useState(null);
  const [folderActions, setFolderActions] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null); // {kind:'item'|'folder', entity}
  const [renameTarget, setRenameTarget] = useState(null);

  // Pasada B: selección múltiple (Set de «kind:id», null = apagada), modo ordenar
  // y el selector de carpeta del lote.
  const [selection, setSelection] = useState(null);
  const [ordering, setOrdering] = useState(false);
  const [bulkMove, setBulkMove] = useState(false);
  // Los cambios de orden se mandan de uno en uno, en el orden en que se tocan.
  const orderQueueRef = useRef(Promise.resolve());

  const push = useCallback((next) => setStack((prev) => [...prev, next]), []);
  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const goBack = useCallback(() => {
    if (selection) {
      setSelection(null);
      return;
    }
    if (ordering) {
      setOrdering(false);
      return;
    }
    if (stack.length > 1) pop();
    else onBack?.();
  }, [selection, ordering, stack.length, pop, onBack]);

  // Al cambiar de vista se sale de la selección y del modo ordenar.
  const routeKey = `${route.name}:${route.id || route.kind || ""}`;
  useEffect(() => {
    setSelection(null);
    setOrdering(false);
  }, [routeKey]);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId) return;
      if (!silent) setLoading(true);
      try {
        const data = await loadLibrary(userId);
        setLibrary(data);
        setLoadError(null);
      } catch {
        setLoadError("No se ha podido cargar tu biblioteca. Revisa tu conexión.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // «Tu repaso de hoy» (ClickUp 124b4z9w0z0): se recalcula cada vez que se vuelve
  // a la portada, con la configuración de repaso (límites, carpetas, pausa). Si
  // falla, la tarjeta no se enseña y la biblioteca sigue igual.
  const [reviewRaw, setReviewRaw] = useState({ loading: true });
  const refreshReview = useCallback(async () => {
    if (!userId) return;
    try {
      const today = localDateString();
      const [prefs, data] = await Promise.all([getReviewPreferences(userId), loadReviewData(userId, today)]);
      setReviewRaw({ loading: false, today, prefs, data });
    } catch {
      setReviewRaw({ loading: false, error: true });
    }
  }, [userId]);

  const reviewSummary = useMemo(() => {
    if (reviewRaw.loading || reviewRaw.error) return reviewRaw;
    const { prefs, data, today } = reviewRaw;
    if (!prefs.review_enabled) return { loading: false, disabled: true };
    if (isPaused(prefs, today)) {
      return { loading: false, paused: true, pausedUntil: prefs.paused_until, totalCards: data.totalCards };
    }
    const { queue } = buildTodayQueue({
      cards: data.cards,
      reviewedTodayIds: data.reviewedTodayIds,
      newReviewedToday: data.newReviewedToday,
      today,
      limit: prefs.daily_card_limit,
      newLimit: prefs.new_card_limit,
      folderSet: includedFolderSet(library.folders, prefs.included_folder_ids),
    });
    return { loading: false, pending: queue.length, totalCards: data.totalCards };
  }, [reviewRaw, library.folders]);

  const resumeReviews = async () => {
    try {
      await saveReviewPreferences(userId, { paused_until: null });
    } catch {
      Alert.alert("No se ha podido reanudar", "Revisa tu conexión e inténtalo de nuevo.");
    }
    refreshReview();
  };

  useEffect(() => {
    if (route.name === "home") refreshReview();
  }, [route.name, refreshReview]);

  // El editor gestiona su propio «volver» (guarda antes de salir), y «Crear
  // tarjetas» también (en «Revisar una a una» vuelve a la lista sin perder las
  // propuestas).
  useEffect(() => {
    if (route.name === "note" || route.name === "cards-create") return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack, route.name]);

  const counts = useMemo(() => countItemsByFolder(library.folders, library.items), [library]);
  const folderById = useMemo(() => new Map(library.folders.map((f) => [f.id, f])), [library.folders]);
  const currentFolderId = route.name === "folder" ? route.id : null;

  const patchItem = (updated) => {
    if (!updated) return;
    setLibrary((prev) => ({
      ...prev,
      items: prev.items.some((i) => i.id === updated.id)
        ? prev.items.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
        : [updated, ...prev.items],
    }));
  };

  const run = async (label, fn, { reload = true } = {}) => {
    setBusy(label);
    try {
      const result = await fn();
      if (reload) await refresh({ silent: true });
      return result;
    } catch (error) {
      Alert.alert("Algo ha fallado", error?.userMessage || friendlyError(error));
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  // -------------------------------------------------------------------------
  // Abrir
  // -------------------------------------------------------------------------

  const openItem = async (item) => {
    if (item.type === "note") {
      push({ name: "note", id: item.id });
      return;
    }
    if (item.type === "pdf") {
      push({ name: "pdf", id: item.id });
      return;
    }
    if (item.type === "link") {
      try {
        // Los resultados de búsqueda no traen la URL.
        const url = item.url || (await getItem(item.id))?.url;
        if (!url) throw new Error("NO_URL");
        markItemOpened(item.id);
        await WebBrowser.openBrowserAsync(url);
      } catch {
        Alert.alert("No se ha podido abrir", "Revisa el enlace e inténtalo de nuevo.");
      }
      return;
    }
    setBusy("Abriendo…");
    try {
      const full = await getItem(item.id);
      const attachment = full?.resinotes_attachments?.[0];
      const url = await getSignedUrl(attachment?.storage_key, 600);
      if (!url) throw new Error("NO_URL");
      markItemOpened(item.id);
      setBusy(null);
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("No se ha podido abrir", "El archivo no está disponible. Revisa tu conexión.");
    } finally {
      setBusy(null);
    }
  };

  const downloadItem = async (item, { silent = false } = {}) => {
    setItemActions(null);
    if (!silent) setBusy("Preparando descarga…");
    try {
      const full = await getItem(item.id);
      const attachment = full?.resinotes_attachments?.[0];
      const url = await getSignedUrl(attachment?.storage_key, 600);
      if (!url) throw new Error("NO_URL");
      const [{ File, Paths }, Sharing] = await Promise.all([import("expo-file-system"), import("expo-sharing")]);
      const safeName = String(attachment.filename || "archivo").replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, "_");
      const target = new File(Paths.cache, `${Date.now()}-${safeName}`);
      const file = await File.downloadFileAsync(url, target);
      await Sharing.shareAsync(file.uri, { mimeType: attachment.mime_type, dialogTitle: item.title });
    } catch {
      Alert.alert("No se ha podido descargar", "Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  // -------------------------------------------------------------------------
  // Crear
  // -------------------------------------------------------------------------

  const newNote = async () => {
    setCreateMenu(false);
    const note = await run("Creando nota…", () => createNote(userId, { folderId: currentFolderId }), {
      reload: false,
    });
    if (note) {
      patchItem(note);
      push({ name: "note", id: note.id });
    }
  };

  const uploadFiles = async (picker) => {
    setCreateMenu(false);
    setPhotoMenu(false);
    let files = [];
    try {
      files = await picker();
    } catch (e) {
      Alert.alert("No se ha podido abrir", e?.userMessage || "Inténtalo de nuevo.");
      return;
    }
    if (!files.length) return;

    const failures = [];
    setBusy(files.length > 1 ? `Subiendo ${files.length} archivos…` : "Subiendo…");
    for (const file of files) {
      try {
        await uploadFileItem(userId, { folderId: currentFolderId, file });
      } catch (e) {
        failures.push(`${file.name || "Archivo"}: ${e?.userMessage || "error de subida"}`);
      }
    }
    await refresh({ silent: true });
    setBusy(null);
    if (failures.length) {
      Alert.alert(
        failures.length === files.length ? "Error de subida" : "Algunos archivos no se han subido",
        failures.join("\n")
      );
    }
  };

  const submitLink = async ({ url, title }) => {
    const link = await createLink(userId, { folderId: currentFolderId, url, title });
    setLinkForm(false);
    patchItem(link);
  };

  const submitFolder = async (values) => {
    if (folderForm?.folder) {
      await updateFolder(folderForm.folder.id, values).catch((e) => {
        e.userMessage = friendlyError(e);
        throw e;
      });
    } else {
      await createFolder(userId, values);
    }
    setFolderForm(null);
    await refresh({ silent: true });
  };

  // -------------------------------------------------------------------------
  // Acciones sobre un elemento o carpeta
  // -------------------------------------------------------------------------

  const toggleItem = async (item, field) => {
    setItemActions(null);
    const values = field === "favorite" ? { isFavorite: !item.is_favorite } : { isPinned: !item.is_pinned };
    const updated = await run("Guardando…", () => updateItem(item.id, values), { reload: false });
    patchItem(updated);
  };

  const sendItemToTrash = async (item) => {
    setItemActions(null);
    await run("Enviando a la papelera…", () => trashItem(item.id));
  };

  const sendFolderToTrash = (folder) => {
    setFolderActions(null);
    const total = counts[folder.id] || 0;
    Alert.alert(
      `¿Enviar «${folder.name}» a la papelera?`,
      total
        ? `Se irá con sus subcarpetas y sus ${total} elementos. Podrás restaurarla desde la papelera.`
        : "Podrás restaurarla desde la papelera.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar a la papelera",
          style: "destructive",
          onPress: async () => {
            await run("Enviando a la papelera…", () => trashFolder(folder.id));
            // Si estábamos dentro de esa carpeta (o de una hija), salimos de ella.
            setStack((prev) => {
              const idx = prev.findIndex((r) => r.name === "folder" && r.id === folder.id);
              return idx > 0 ? prev.slice(0, idx) : prev;
            });
          },
        },
      ]
    );
  };

  const confirmMove = async (targetId) => {
    const target = moveTarget;
    setMoveTarget(null);
    if (!target) return;
    if (target.kind === "item") {
      const updated = await run("Moviendo…", () => moveItem(target.entity.id, targetId), { reload: false });
      patchItem(updated);
    } else {
      await run("Moviendo…", () => moveFolder(target.entity.id, targetId));
    }
  };

  const submitRename = async (title) => {
    const updated = await updateItem(renameTarget.id, { title });
    setRenameTarget(null);
    patchItem(updated);
  };

  // -------------------------------------------------------------------------
  // Selección múltiple
  // -------------------------------------------------------------------------

  const selectable = route.name === "folder" || (route.name === "list" && route.kind === "unclassified");
  const selected = selection ? splitSelection(selection) : { folderIds: [], itemIds: [] };
  const selectedCount = selection ? selection.size : 0;

  const startSelection = (key) => {
    setOrdering(false);
    setSelection(new Set(key ? [key] : []));
  };
  const toggleSelected = (key) => setSelection((prev) => toggleSelection(prev || new Set(), key));

  /** Lo que se ve en la vista actual (para «Seleccionar todo»). */
  const visibleKeys = () => {
    if (route.name === "folder") {
      return [
        ...childFolders(library.folders, route.id).map((f) => selectionKey("folder", f.id)),
        ...library.items.filter((i) => i.folder_id === route.id).map((i) => selectionKey("item", i.id)),
      ];
    }
    return unclassifiedItems(library.items).map((i) => selectionKey("item", i.id));
  };

  const partialAlert = (title, error, ok, total) =>
    Alert.alert(title, `${ok} de ${total} hechos. ${friendlyError(error, "Inténtalo de nuevo.")}`);

  const bulkFavorite = async () => {
    const items = library.items.filter((i) => selected.itemIds.includes(i.id));
    if (!items.length) return;
    const value = !items.every((i) => i.is_favorite);
    const done = await run(value ? "Añadiendo a favoritos…" : "Quitando de favoritos…", async () => {
      await setItemsFavorite(selected.itemIds, value);
      return true;
    });
    if (done) setSelection(null);
  };

  const bulkTrash = () => {
    const { folderIds, itemIds } = selected;
    const total = folderIds.length + itemIds.length;
    if (!total) return;
    const inside = folderIds.reduce((n, id) => n + (counts[id] || 0), 0);
    Alert.alert(
      total === 1 ? "¿Enviar 1 elemento a la papelera?" : `¿Enviar ${total} elementos a la papelera?`,
      `${folderIds.length ? `Las carpetas se irán con todo lo que tienen dentro${inside ? ` (${formatElementCount(inside)})` : ""}. ` : ""}Podrás restaurarlos desde la papelera durante ${TRASH_RETENTION_DAYS} días.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar a la papelera",
          style: "destructive",
          onPress: async () => {
            const result = await run("Enviando a la papelera…", async () => {
              await trashItems(itemIds);
              return trashFolders(folderIds);
            });
            if (!result) return;
            setSelection(null);
            if (result.error) partialAlert("Algunas carpetas no se han enviado", result.error, itemIds.length + result.ok, total);
          },
        },
      ]
    );
  };

  const bulkMoveTo = async (targetId) => {
    setBulkMove(false);
    const { folderIds, itemIds } = selected;
    const total = folderIds.length + itemIds.length;
    const result = await run("Moviendo…", async () => {
      await moveItems(itemIds, targetId);
      return moveFolders(folderIds, targetId);
    });
    if (!result) return;
    setSelection(null);
    if (result.error) partialAlert("Algunas carpetas no se han movido", result.error, itemIds.length + result.ok, total);
  };

  // -------------------------------------------------------------------------
  // Orden manual
  // -------------------------------------------------------------------------

  const anyGroup = () => true;

  const moveEntity = (kind, ordered, id, delta) => {
    const next = moveInOrder(ordered, id, delta, kind === "folder" ? anyGroup : undefined);
    if (!next) return;
    const ids = orderIds(next);
    const key = kind === "folder" ? "folders" : "items";
    setLibrary((prev) => ({ ...prev, [key]: applyOrder(prev[key], ids) }));
    orderQueueRef.current = orderQueueRef.current
      .then(() => reorder(kind, ids))
      .catch(() => {
        Alert.alert("No se ha podido guardar el orden", "Revisa tu conexión e inténtalo de nuevo.");
        refresh({ silent: true });
      });
  };

  const orderFor = (kind, ordered, id) =>
    ordering
      ? {
          onUp: moveInOrder(ordered, id, -1, kind === "folder" ? anyGroup : undefined)
            ? () => moveEntity(kind, ordered, id, -1)
            : null,
          onDown: moveInOrder(ordered, id, 1, kind === "folder" ? anyGroup : undefined)
            ? () => moveEntity(kind, ordered, id, 1)
            : null,
        }
      : undefined;

  // -------------------------------------------------------------------------
  // Exportar
  // -------------------------------------------------------------------------

  const reportExport = (failed) => {
    if (failed?.length) {
      Alert.alert(
        "Exportado con avisos",
        `No se han podido incluir ${failed.length === 1 ? "este archivo" : "estos archivos"}:\n${failed.slice(0, 8).join("\n")}${failed.length > 8 ? "\n…" : ""}`
      );
    }
  };

  const exportFailed = (error) =>
    Alert.alert("No se ha podido exportar", error?.userMessage || "Revisa tu conexión e inténtalo de nuevo.");

  const exportFolder = async (folder) => {
    setFolderActions(null);
    setBusy("Preparando la exportación…");
    try {
      const { failed } = await exportFolderZip(userId, {
        folderId: folder?.id || null,
        folders: library.folders,
        onProgress: (done, total) => setBusy(`Exportando ${done} de ${total}…`),
        beforeShare: () => setBusy(null),
      });
      reportExport(failed);
    } catch (error) {
      exportFailed(error);
    } finally {
      setBusy(null);
    }
  };

  const exportNote = async (item) => {
    setItemActions(null);
    setBusy("Preparando la exportación…");
    try {
      const { failed } = await exportNoteHtml(userId, item.id, { beforeShare: () => setBusy(null) });
      reportExport(failed);
    } catch (error) {
      exportFailed(error);
    } finally {
      setBusy(null);
    }
  };

  // -------------------------------------------------------------------------
  // Vistas
  // -------------------------------------------------------------------------

  const renderItems = (items, { showFolder = false, testPrefix = "resinotes-item", orderable = false } = {}) =>
    items.map((item) => {
      const key = selectionKey("item", item.id);
      return (
        <ItemRow
          key={item.id}
          item={item}
          showFolder={showFolder}
          folderName={item.folder_id ? folderById.get(item.folder_id)?.name : null}
          selected={selection ? selection.has(key) : undefined}
          order={orderable ? orderFor("item", items, item.id) : undefined}
          onPress={() => (selection ? toggleSelected(key) : openItem(item))}
          onLongPress={() => (selection ? toggleSelected(key) : selectable ? startSelection(key) : setItemActions(item))}
          onMore={selection || ordering ? undefined : () => setItemActions(item)}
          testID={`${testPrefix}-${item.id}`}
        />
      );
    });

  const renderFolders = (folders, { orderable = false } = {}) =>
    folders.map((folder) => {
      const key = selectionKey("folder", folder.id);
      return (
        <FolderRow
          key={folder.id}
          folder={folder}
          count={counts[folder.id] || 0}
          selected={selection ? selection.has(key) : undefined}
          order={orderable ? orderFor("folder", folders, folder.id) : undefined}
          onPress={() => (selection ? toggleSelected(key) : push({ name: "folder", id: folder.id }))}
          onLongPress={() => (selection ? toggleSelected(key) : selectable ? startSelection(key) : setFolderActions(folder))}
          testID={`resinotes-folder-${folder.name}`}
        />
      );
    });

  /** «Seleccionar» y «Ordenar» encima de la lista. */
  const renderModeBar = (count) =>
    selection || ordering || !count ? null : (
      <View style={styles.modeBar}>
        <TouchableOpacity
          style={styles.modeChip}
          onPress={() => startSelection(null)}
          accessibilityRole="button"
          testID="resinotes-select-mode"
        >
          <Icon name="checkbox-outline" size={16} color={COLORS.PRIMARY} />
          <Text style={styles.modeChipText}>Seleccionar</Text>
        </TouchableOpacity>
        {count > 1 ? (
          <TouchableOpacity
            style={styles.modeChip}
            onPress={() => setOrdering(true)}
            accessibilityRole="button"
            testID="resinotes-order-mode"
          >
            <Icon name="swap-vertical" size={16} color={COLORS.PRIMARY} />
            <Text style={styles.modeChipText}>Ordenar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );

  const orderingHint = ordering ? (
    <Text style={styles.hint}>Usa ↑ y ↓ para ordenar. Los fijados siempre van arriba.</Text>
  ) : null;

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        refresh({ silent: true });
      }}
      tintColor={COLORS.PRIMARY}
    />
  );

  const renderLoadState = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      );
    }
    if (loadError) {
      return (
        <ResiNotesEmpty
          emoji="📡"
          title="Sin conexión"
          message={loadError}
          actionLabel="Reintentar"
          onAction={() => refresh()}
        />
      );
    }
    return null;
  };

  const renderHome = () => {
    const roots = childFolders(library.folders, null);
    const isEmpty = !library.folders.length && !library.items.length;
    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <TouchableOpacity
          style={styles.searchBox}
          onPress={() => push({ name: "search" })}
          accessibilityRole="search"
          accessibilityLabel="Buscar en mis apuntes"
          testID="resinotes-search-open"
        >
          <Icon name="search" size={22} color={COLORS.TEXT_LIGHT} />
          <Text style={styles.searchPlaceholder}>Buscar en mis apuntes…</Text>
        </TouchableOpacity>

        <ReviewTodayCard
          summary={reviewSummary}
          onStart={() => push({ name: "review", mode: "today" })}
          onMore={() => push({ name: "review", mode: "more" })}
          onCreate={() => push({ name: "cards-create" })}
          onSettings={() => push({ name: "review-settings" })}
          onResume={resumeReviews}
        />

        <View style={styles.quickRow}>
          {QUICK_CARDS.map((card) => (
            <TouchableOpacity
              key={card.key}
              style={[styles.quickCard, { backgroundColor: card.bg }]}
              onPress={() =>
                push(
                  card.key === "trash" || card.key === "cards" ? { name: card.key } : { name: "list", kind: card.key }
                )
              }
              accessibilityRole="button"
              accessibilityLabel={card.label}
              testID={`resinotes-quick-${card.key}`}
            >
              <Icon name={card.icon} size={28} color={card.fg} />
              <Text style={styles.quickLabel} numberOfLines={1} adjustsFontSizeToFit>
                {card.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mis carpetas</Text>
          <View style={styles.sectionActions}>
            {roots.length > 1 ? (
              <TouchableOpacity
                style={[styles.roundButton, ordering && styles.roundButtonActive]}
                onPress={() => setOrdering((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={ordering ? "Terminar de ordenar" : "Ordenar carpetas"}
                testID="resinotes-order-folders"
              >
                <Icon name={ordering ? "checkmark" : "swap-vertical"} size={20} color={ordering ? COLORS.WHITE : COLORS.PRIMARY} />
              </TouchableOpacity>
            ) : null}
            {ordering ? null : (
              <TouchableOpacity
                style={styles.roundButton}
                onPress={() => setFolderForm({ parentId: null })}
                accessibilityRole="button"
                accessibilityLabel="Nueva carpeta"
                testID="resinotes-new-folder"
              >
                <Icon name="add" size={22} color={COLORS.PRIMARY} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {orderingHint}

        {renderLoadState() ||
          (isEmpty ? (
            <ResiNotesEmpty
              emoji="📚"
              title="Tu biblioteca está vacía"
              message={`Crea tu primera carpeta o guarda una nota, una foto o un PDF con el botón +.\n\n${PATIENT_NOTICE}`}
              actionLabel="Crear carpeta"
              onAction={() => setFolderForm({ parentId: null })}
            />
          ) : roots.length ? (
            renderFolders(roots, { orderable: true })
          ) : (
            <Text style={styles.hint}>Aún no tienes carpetas. Pulsa + para crear la primera.</Text>
          ))}

        {!loading && !loadError && !ordering && library.items.some((i) => i.type === "note") ? (
          <TouchableOpacity
            style={styles.createCards}
            onPress={() => push({ name: "cards-create" })}
            accessibilityRole="button"
            testID="resinotes-create-cards"
          >
            <View style={styles.createCardsIcon}>
              <Icon name="sparkles-outline" size={22} color={COLORS.PRIMARY} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.createCardsTitle}>Crear tarjetas</Text>
              <Text style={styles.createCardsText}>Tarjetas de repaso a partir de tus apuntes.</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={COLORS.TEXT_LIGHT} />
          </TouchableOpacity>
        ) : null}

        {!loading && !loadError && !isEmpty && !ordering ? (
          <TouchableOpacity
            style={styles.exportLink}
            onPress={() => exportFolder(null)}
            accessibilityRole="button"
            testID="resinotes-export-library"
          >
            <Icon name="share-outline" size={18} color={COLORS.PRIMARY} />
            <Text style={styles.exportLinkText}>Exportar toda mi biblioteca</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  };

  const renderFolder = () => {
    const folder = folderById.get(route.id);
    if (!folder) {
      return renderLoadState() || <ResiNotesEmpty emoji="🗂️" title="Esta carpeta ya no existe" />;
    }
    const path = folderPath(library.folders, folder.id);
    const subfolders = childFolders(library.folders, folder.id);
    const items = sortFolderItems(library.items.filter((i) => i.folder_id === folder.id));
    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breadcrumbs}>
          <TouchableOpacity onPress={() => setStack([{ name: "home" }])} accessibilityRole="link">
            <Text style={styles.crumb}>ResiNotes</Text>
          </TouchableOpacity>
          {path.map((f, idx) => (
            <View key={f.id} style={styles.crumbRow}>
              <Icon name="chevron-forward" size={14} color={COLORS.TEXT_LIGHT} />
              <TouchableOpacity
                disabled={idx === path.length - 1}
                onPress={() =>
                  setStack([{ name: "home" }, ...path.slice(0, idx + 1).map((p) => ({ name: "folder", id: p.id }))])
                }
                accessibilityRole="link"
              >
                <Text style={[styles.crumb, idx === path.length - 1 && styles.crumbCurrent]}>{f.name}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {renderModeBar(subfolders.length + items.length)}
        {orderingHint}

        {subfolders.length ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitleSmall}>Subcarpetas</Text>
              {selection || ordering ? null : (
                <TouchableOpacity
                  style={styles.roundButton}
                  onPress={() => setFolderForm({ parentId: folder.id })}
                  accessibilityRole="button"
                  accessibilityLabel="Nueva subcarpeta"
                >
                  <Icon name="add" size={20} color={COLORS.PRIMARY} />
                </TouchableOpacity>
              )}
            </View>
            {renderFolders(subfolders, { orderable: true })}
          </>
        ) : null}

        {items.length ? (
          <>
            {subfolders.length ? <Text style={styles.sectionTitleSmall}>Apuntes</Text> : null}
            {renderItems(items, { orderable: true })}
          </>
        ) : null}

        {!subfolders.length && !items.length ? (
          <ResiNotesEmpty
            emoji={folder.emoji || "📁"}
            title="Carpeta vacía"
            message="Guarda aquí notas, fotos, PDFs, enlaces o subcarpetas con el botón +."
            actionLabel="Añadir"
            onAction={() => setCreateMenu(true)}
          />
        ) : null}
      </ScrollView>
    );
  };

  const renderList = () => {
    const meta = LIST_TITLES[route.kind];
    const items =
      route.kind === "favorites"
        ? favoriteItems(library.items)
        : route.kind === "recents"
          ? recentItems(library.items)
          : unclassifiedItems(library.items);
    return (
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {route.kind === "unclassified" ? renderModeBar(items.length) : null}
        {route.kind === "unclassified" ? orderingHint : null}
        {renderLoadState() ||
          (items.length ? (
            renderItems(items, { showFolder: route.kind !== "unclassified", orderable: route.kind === "unclassified" })
          ) : (
            <ResiNotesEmpty emoji={meta.emoji} title={`Nada en ${meta.title}`} message={meta.empty} />
          ))}
      </ScrollView>
    );
  };

  const headerFor = () => {
    if (selection) {
      const keys = visibleKeys();
      const all = keys.length > 0 && keys.every((k) => selection.has(k));
      return {
        title: selectedCount ? formatSelectionCount(selectedCount) : "Selecciona",
        subtitle: "Toca para elegir. «Volver» sale de la selección.",
        rightSlot: (
          <TouchableOpacity
            style={styles.headerTextButton}
            onPress={() => setSelection(all ? new Set() : new Set(keys))}
            accessibilityRole="button"
            testID="resinotes-select-all"
          >
            <Text style={styles.headerTextButtonLabel}>{all ? "Ninguno" : "Todos"}</Text>
          </TouchableOpacity>
        ),
      };
    }
    if (ordering && route.name !== "home") {
      return {
        title: "Ordenar",
        subtitle: null,
        rightSlot: (
          <TouchableOpacity
            style={styles.headerTextButton}
            onPress={() => setOrdering(false)}
            accessibilityRole="button"
            testID="resinotes-order-done"
          >
            <Text style={styles.headerTextButtonLabel}>Hecho</Text>
          </TouchableOpacity>
        ),
      };
    }
    switch (route.name) {
      case "folder": {
        const folder = folderById.get(route.id);
        return {
          title: folder ? `${folder.emoji ? `${folder.emoji} ` : ""}${folder.name}` : "Carpeta",
          subtitle: folder ? formatElementCount(counts[folder.id] || 0) : null,
          rightSlot: folder ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setFolderActions(folder)}
              accessibilityRole="button"
              accessibilityLabel="Opciones de la carpeta"
              testID="resinotes-folder-options"
            >
              <Icon name="ellipsis-horizontal" size={22} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          ) : null,
        };
      }
      case "list":
        return { title: LIST_TITLES[route.kind].title, subtitle: null };
      default:
        return {
          title: "ResiNotes",
          subtitle: "Tu biblioteca personal de apuntes.",
          rightSlot: (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setCreateMenu(true)}
              accessibilityRole="button"
              accessibilityLabel="Nueva nota o archivo"
            >
              <Icon name="create-outline" size={22} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          ),
        };
    }
  };

  // ---- Editor, búsqueda y papelera tienen su propia pantalla ----

  if (route.name === "note") {
    return (
      <NoteEditor
        key={route.id}
        userId={userId}
        itemId={route.id}
        onBack={() => {
          pop();
          refresh({ silent: true });
        }}
        onSaved={patchItem}
        onCreateCards={(id, selectionHtml = null) => {
          refresh({ silent: true });
          push({ name: "cards-create", id, selectionHtml });
        }}
      />
    );
  }

  // ---- Tarjetas de repaso (ClickUp 124b4z9w0z0) ----

  const folderName = (id) => (id ? folderById.get(id)?.name || null : null);
  const toHome = () => setStack([{ name: "home" }]);
  const replaceTop = (next) => setStack((prev) => [...prev.slice(0, -1), next]);

  if (route.name === "cards-create") {
    return (
      <CreateCardsView
        key={route.id || route.folderId || "pick"}
        userId={userId}
        itemId={route.id || null}
        selectionHtml={route.selectionHtml || null}
        folderId={route.folderId || null}
        library={library}
        onBack={pop}
        onStartReview={() => replaceTop({ name: "review", mode: "today" })}
        onCreated={refreshReview}
      />
    );
  }

  if (route.name === "review") {
    return (
      <ReviewSessionView
        key={route.mode}
        userId={userId}
        mode={route.mode}
        fromPush={Boolean(route.fromPush)}
        folders={loading && !library.folders.length ? null : library.folders}
        folderName={folderName}
        onBack={pop}
        onExit={toHome}
        onMore={() => replaceTop({ name: "review", mode: "more" })}
        onOpenNote={(id) => push({ name: "note", id })}
      />
    );
  }

  if (route.name === "review-settings") {
    return <ReviewSettingsView userId={userId} folders={library.folders} onBack={pop} onChanged={refreshReview} />;
  }

  if (route.name === "cards") {
    return (
      <MyCardsView
        userId={userId}
        library={library}
        onBack={pop}
        onSettings={() => push({ name: "review-settings" })}
        onOpenCard={(id) => push({ name: "card", id })}
        onCreateFromNotes={() => push({ name: "cards-create" })}
      />
    );
  }

  if (route.name === "card") {
    return (
      <CardDetailView
        key={route.id}
        cardId={route.id}
        folderName={folderName}
        onBack={pop}
        onOpenNote={(id) => push({ name: "note", id })}
        onRegenerate={(id) => push({ name: "cards-create", id })}
        onChanged={() => refresh({ silent: true })}
      />
    );
  }

  if (route.name === "pdf") {
    return (
      <PdfViewer
        key={route.id}
        itemId={route.id}
        onBack={() => {
          pop();
          refresh({ silent: true });
        }}
        onDownload={(item) => downloadItem(item, { silent: true })}
      />
    );
  }

  if (route.name === "search") {
    return <SearchView onBack={pop} onOpenFolder={(id) => push({ name: "folder", id })} onOpenItem={openItem} />;
  }

  if (route.name === "trash") {
    return <TrashView userId={userId} onBack={pop} onChanged={() => refresh({ silent: true })} />;
  }

  const header = headerFor();
  const createTitle =
    route.name === "folder" && folderById.get(route.id)
      ? `Guardar en ${folderById.get(route.id).name}`
      : "¿Qué quieres guardar?";

  return (
    <HeroScreenLayout
      title={header.title}
      // BottomMenuHeroHeader no pinta `subtitle`: va como contenido bajo el título.
      bottomContent={header.subtitle ? <Text style={styles.headerSubtitle}>{header.subtitle}</Text> : null}
      onBack={goBack}
      rightSlot={header.rightSlot}
      overlay={
        <>
          {!selection && !ordering && (route.name !== "list" || route.kind === "unclassified") ? (
            <FloatingActionButton
              onPress={() => setCreateMenu(true)}
              style={styles.fab}
              testID="resinotes-fab"
              accessibilityLabel="Añadir a ResiNotes"
            />
          ) : null}

          {selection ? (
            <View style={styles.bulkBar} testID="resinotes-bulk-bar">
              <TouchableOpacity
                style={[styles.bulkButton, !selectedCount && styles.bulkButtonDisabled]}
                disabled={!selectedCount}
                onPress={() => setBulkMove(true)}
                accessibilityRole="button"
                testID="resinotes-bulk-move"
              >
                <Icon name="move-outline" size={22} color={COLORS.PRIMARY} />
                <Text style={styles.bulkLabel}>Mover</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkButton, !selected.itemIds.length && styles.bulkButtonDisabled]}
                disabled={!selected.itemIds.length}
                onPress={bulkFavorite}
                accessibilityRole="button"
                accessibilityHint="Las carpetas no se marcan como favoritas"
                testID="resinotes-bulk-favorite"
              >
                <Icon name="star-outline" size={22} color={COLORS.PRIMARY} />
                <Text style={styles.bulkLabel}>Favorito</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkButton, !selectedCount && styles.bulkButtonDisabled]}
                disabled={!selectedCount}
                onPress={bulkTrash}
                accessibilityRole="button"
                testID="resinotes-bulk-trash"
              >
                <Icon name="trash-outline" size={22} color={COLORS.ERROR} />
                <Text style={[styles.bulkLabel, { color: COLORS.ERROR }]}>Papelera</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {busy ? (
            <View style={styles.busy} pointerEvents="auto">
              <View style={styles.busyCard}>
                <ActivityIndicator color={COLORS.PRIMARY} />
                <Text style={styles.busyText}>{busy}</Text>
              </View>
            </View>
          ) : null}

          <ResiNotesSheet visible={createMenu} title={createTitle} onClose={() => setCreateMenu(false)} testID="resinotes-create-menu">
            <SheetOption emoji="📝" label="Nueva nota" onPress={newNote} testID="resinotes-create-note" />
            <SheetOption
              emoji="📸"
              label="Fotografía o imagen"
              description="Cámara o galería, una o varias"
              onPress={() => {
                setCreateMenu(false);
                setPhotoMenu(true);
              }}
            />
            <SheetOption
              emoji="📄"
              label="PDF o documento"
              description="PDF o imagen, hasta 20 MB"
              onPress={() => uploadFiles(pickDocuments)}
            />
            <SheetOption
              emoji="🔗"
              label="Enlace web"
              onPress={() => {
                setCreateMenu(false);
                setLinkForm(true);
              }}
              testID="resinotes-create-link"
            />
            <SheetOption
              emoji="📁"
              label={route.name === "folder" ? "Nueva subcarpeta" : "Nueva carpeta"}
              onPress={() => {
                setCreateMenu(false);
                setFolderForm({ parentId: currentFolderId });
              }}
              testID="resinotes-create-folder"
            />
            <Text style={styles.notice}>🔒 {PATIENT_NOTICE}</Text>
          </ResiNotesSheet>

          <ResiNotesSheet visible={photoMenu} title="Fotografía o imagen" onClose={() => setPhotoMenu(false)}>
            <SheetOption icon="camera-outline" label="Hacer una foto" onPress={() => uploadFiles(takePhoto)} />
            <SheetOption
              icon="images-outline"
              label="Elegir de la galería"
              description="Puedes elegir varias"
              onPress={() => uploadFiles(pickImagesFromLibrary)}
            />
          </ResiNotesSheet>

          <LinkFormSheet visible={linkForm} onSubmit={submitLink} onClose={() => setLinkForm(false)} />

          <FolderFormSheet
            visible={Boolean(folderForm)}
            folders={library.folders}
            folder={folderForm?.folder || null}
            defaultParentId={folderForm?.parentId ?? null}
            onSubmit={submitFolder}
            onClose={() => setFolderForm(null)}
          />

          <ResiNotesSheet
            visible={Boolean(itemActions)}
            title={itemActions?.title || ""}
            onClose={() => setItemActions(null)}
            testID="resinotes-item-actions"
          >
            {itemActions ? (
              <>
                {itemActions.type === "note" ? (
                  <SheetOption
                    icon="brain-outline"
                    label="Crear tarjetas de estudio"
                    onPress={() => {
                      const id = itemActions.id;
                      setItemActions(null);
                      push({ name: "cards-create", id });
                    }}
                    testID="resinotes-action-cards"
                  />
                ) : null}
                <SheetOption
                  icon={itemActions.is_favorite ? "star" : "star-outline"}
                  label={itemActions.is_favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                  onPress={() => toggleItem(itemActions, "favorite")}
                  testID="resinotes-action-favorite"
                />
                <SheetOption
                  icon="pin-outline"
                  label={itemActions.is_pinned ? "Desfijar" : "Fijar arriba en su carpeta"}
                  onPress={() => toggleItem(itemActions, "pin")}
                  testID="resinotes-action-pin"
                />
                <SheetOption
                  icon="pencil-outline"
                  label="Renombrar"
                  onPress={() => {
                    setRenameTarget(itemActions);
                    setItemActions(null);
                  }}
                />
                <SheetOption
                  icon="move-outline"
                  label="Mover a otra carpeta"
                  onPress={() => {
                    setMoveTarget({ kind: "item", entity: itemActions });
                    setItemActions(null);
                  }}
                  testID="resinotes-action-move"
                />
                {itemActions.type === "image" || itemActions.type === "pdf" ? (
                  <SheetOption icon="download-outline" label="Descargar o compartir" onPress={() => downloadItem(itemActions)} />
                ) : null}
                {itemActions.type === "note" ? (
                  <SheetOption
                    icon="share-outline"
                    label="Exportar nota"
                    description="Un archivo HTML con el texto y las imágenes"
                    onPress={() => exportNote(itemActions)}
                    testID="resinotes-action-export"
                  />
                ) : null}
                <SheetOption
                  icon="trash-outline"
                  label="Enviar a la papelera"
                  danger
                  onPress={() => sendItemToTrash(itemActions)}
                  testID="resinotes-action-trash"
                />
              </>
            ) : null}
          </ResiNotesSheet>

          <ResiNotesSheet
            visible={Boolean(folderActions)}
            title={folderActions ? `${folderActions.emoji || "📁"} ${folderActions.name}` : ""}
            onClose={() => setFolderActions(null)}
          >
            {folderActions ? (
              <>
                <SheetOption
                  icon="pencil-outline"
                  label="Editar nombre, emoji y color"
                  onPress={() => {
                    setFolderForm({ folder: folderActions });
                    setFolderActions(null);
                  }}
                  testID="resinotes-folder-edit"
                />
                <SheetOption
                  icon="add-circle-outline"
                  label="Nueva subcarpeta"
                  onPress={() => {
                    setFolderForm({ parentId: folderActions.id });
                    setFolderActions(null);
                  }}
                />
                <SheetOption
                  icon="move-outline"
                  label="Mover"
                  onPress={() => {
                    setMoveTarget({ kind: "folder", entity: folderActions });
                    setFolderActions(null);
                  }}
                />
                <SheetOption
                  icon="brain-outline"
                  label="Generar tarjetas de esta carpeta"
                  description="Tarjetas de repaso a partir de sus notas"
                  onPress={() => {
                    const folderId = folderActions.id;
                    setFolderActions(null);
                    push({ name: "cards-create", folderId });
                  }}
                  testID="resinotes-folder-cards"
                />
                <SheetOption
                  icon="share-outline"
                  label="Exportar carpeta"
                  description="Un ZIP con sus subcarpetas, notas y archivos"
                  onPress={() => exportFolder(folderActions)}
                  testID="resinotes-folder-export"
                />
                <SheetOption
                  icon="trash-outline"
                  label="Enviar a la papelera"
                  danger
                  onPress={() => sendFolderToTrash(folderActions)}
                  testID="resinotes-folder-trash"
                />
              </>
            ) : null}
          </ResiNotesSheet>

          <FolderPickerSheet
            visible={Boolean(moveTarget)}
            title={moveTarget ? `Mover «${moveTarget.entity.title || moveTarget.entity.name}»` : ""}
            folders={library.folders}
            currentId={moveTarget ? (moveTarget.kind === "item" ? moveTarget.entity.folder_id : moveTarget.entity.parent_id) : null}
            movingFolderId={moveTarget?.kind === "folder" ? moveTarget.entity.id : null}
            rootLabel={moveTarget?.kind === "item" ? "Sin clasificar" : "Mis carpetas (principal)"}
            onSelect={confirmMove}
            onClose={() => setMoveTarget(null)}
          />

          <FolderPickerSheet
            visible={bulkMove}
            title={`Mover ${selectedCount} ${selectedCount === 1 ? "elemento" : "elementos"}`}
            folders={library.folders}
            currentId={currentFolderId}
            movingFolderIds={selected.folderIds}
            rootLabel={
              selected.folderIds.length && selected.itemIds.length
                ? "Fuera de carpetas (principal / Sin clasificar)"
                : selected.folderIds.length
                  ? "Mis carpetas (principal)"
                  : "Sin clasificar"
            }
            onSelect={bulkMoveTo}
            onClose={() => setBulkMove(false)}
          />

          <RenameSheet
            visible={Boolean(renameTarget)}
            initialValue={renameTarget?.title || ""}
            onSubmit={submitRename}
            onClose={() => setRenameTarget(null)}
          />
        </>
      }
    >
      {route.name === "folder" ? renderFolder() : route.name === "list" ? renderList() : renderHome()}
    </HeroScreenLayout>
  );
};

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

const SearchView = ({ onBack, onOpenFolder, onOpenItem }) => {
  const [query, setQuery] = useState("");
  const [type, setType] = useState(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [state, setState] = useState({ loading: false, error: null, results: [] });
  const requestRef = useRef(0);

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setState({ loading: false, error: null, results: [] });
      return undefined;
    }
    const requestId = ++requestRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(async () => {
      try {
        const results = await searchLibrary(clean, { type, favoritesOnly });
        if (requestId === requestRef.current) setState({ loading: false, error: null, results });
      } catch {
        if (requestId === requestRef.current) {
          setState({ loading: false, error: "No se ha podido buscar. Revisa tu conexión.", results: [] });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type, favoritesOnly]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const typing = query.trim().length >= 2;

  return (
    <HeroScreenLayout
      title="Buscar"
      subtitle="En títulos, notas, carpetas y archivos"
      onBack={onBack}
      bottomContent={
        <View style={[styles.searchBox, styles.searchBoxActive]}>
          <Icon name="search" size={22} color={COLORS.TEXT_LIGHT} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar en mis apuntes…"
            placeholderTextColor={COLORS.TEXT_LIGHT}
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Buscar en mis apuntes"
            testID="resinotes-search-input"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Borrar búsqueda">
              <Icon name="close-circle" size={20} color={COLORS.TEXT_LIGHT} />
            </TouchableOpacity>
          ) : null}
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {SEARCH_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.label}
              style={[styles.chip, type === f.key && styles.chipActive]}
              onPress={() => setType(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: type === f.key }}
              testID={`resinotes-filter-${f.key || "all"}`}
            >
              <Text style={[styles.chipText, type === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, favoritesOnly && styles.chipActive]}
            onPress={() => setFavoritesOnly((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: favoritesOnly }}
          >
            <Text style={[styles.chipText, favoritesOnly && styles.chipTextActive]}>⭐ Favoritos</Text>
          </TouchableOpacity>
        </ScrollView>

        {!typing ? (
          <Text style={styles.hint}>Escribe al menos 2 letras. No importan los acentos ni las mayúsculas.</Text>
        ) : state.loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.PRIMARY} />
          </View>
        ) : state.error ? (
          <ResiNotesEmpty emoji="📡" title="Sin conexión" message={state.error} />
        ) : !state.results.length ? (
          <ResiNotesEmpty emoji="🔎" title="Sin resultados" message={`No hay nada que coincida con «${query.trim()}».`} />
        ) : (
          state.results.map((r) => (
            <TouchableOpacity
              key={`${r.result_kind}-${r.id}`}
              style={styles.resultCard}
              onPress={() => (r.result_kind === "folder" ? onOpenFolder(r.id) : onOpenItem(r))}
              accessibilityRole="button"
              testID={`resinotes-result-${r.title}`}
            >
              <View
                style={[
                  styles.resultIcon,
                  r.result_kind === "folder" && { backgroundColor: folderColor(r.color).bg },
                ]}
              >
                <Icon
                  name={ITEM_TYPE_ICONS[r.type] || "document-text-outline"}
                  size={20}
                  color={r.result_kind === "folder" ? folderColor(r.color).fg : COLORS.PRIMARY}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {r.title || "Sin título"}
                </Text>
                <Text style={styles.resultMeta} numberOfLines={1}>
                  {[
                    ITEM_TYPE_LABELS[r.type],
                    r.result_kind === "folder" ? (r.folder_name ? `en ${r.folder_name}` : null) : r.folder_name || "Sin clasificar",
                    formatShortDate(r.updated_at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {r.snippet ? (
                  <Text style={styles.snippet} numberOfLines={2}>
                    …{r.snippet.replace(/\s+/g, " ").trim()}…
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </HeroScreenLayout>
  );
};

// ---------------------------------------------------------------------------
// Papelera
// ---------------------------------------------------------------------------

const TrashView = ({ userId, onBack, onChanged }) => {
  const [state, setState] = useState({ loading: true, error: null, folders: [], items: [] });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadTrash(userId);
      setState({ loading: false, error: null, ...data });
    } catch {
      setState({ loading: false, error: "No se ha podido cargar la papelera.", folders: [], items: [] });
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const act = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged?.();
      if (okMessage) Alert.alert(okMessage);
    } catch (error) {
      Alert.alert("Algo ha fallado", friendlyError(error, "Inténtalo de nuevo."));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (label, fn) =>
    Alert.alert(`¿Eliminar «${label}» definitivamente?`, "No se podrá recuperar.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => act(fn, "Eliminado definitivamente") },
    ]);

  const row = (key, icon, color, title, meta, onRestore, onDelete) => (
    <View key={key} style={styles.trashRow} testID={`resinotes-trash-${title}`}>
      <View style={[styles.resultIcon, color && { backgroundColor: color.bg }]}>
        <Icon name={icon} size={20} color={color ? color.fg : COLORS.PRIMARY} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.resultMeta}>{meta}</Text>
      </View>
      <TouchableOpacity
        onPress={onRestore}
        disabled={busy}
        style={styles.trashButton}
        accessibilityRole="button"
        accessibilityLabel={`Restaurar ${title}`}
        testID={`resinotes-restore-${title}`}
      >
        <Icon name="arrow-undo" size={20} color={COLORS.PRIMARY} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDelete}
        disabled={busy}
        style={styles.trashButton}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar definitivamente ${title}`}
      >
        <Icon name="trash-outline" size={20} color={COLORS.ERROR} />
      </TouchableOpacity>
    </View>
  );

  const empty = !state.folders.length && !state.items.length;

  return (
    <HeroScreenLayout
      title="Papelera"
      bottomContent={<Text style={styles.headerSubtitle}>Restaura o elimina para siempre</Text>}
      onBack={onBack}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {state.loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.PRIMARY} />
          </View>
        ) : state.error ? (
          <ResiNotesEmpty emoji="📡" title="Sin conexión" message={state.error} actionLabel="Reintentar" onAction={load} />
        ) : empty ? (
          <ResiNotesEmpty
            emoji="🗑️"
            title="La papelera está vacía"
            message={`Lo que borres se queda aquí ${TRASH_RETENTION_DAYS} días. Después se elimina para siempre.`}
          />
        ) : (
          <>
            <View style={styles.retentionNotice} testID="resinotes-trash-retention">
              <Icon name="time-outline" size={18} color={COLORS.PRIMARY} />
              <Text style={styles.retentionText}>
                {`Lo que está en la papelera se elimina para siempre a los ${TRASH_RETENTION_DAYS} días. Hasta entonces puedes restaurarlo.`}
              </Text>
            </View>
            {state.folders.map((f) =>
              row(
                `f-${f.id}`,
                "folder-outline",
                folderColor(f.color),
                `${f.emoji ? `${f.emoji} ` : ""}${f.name}`,
                `Carpeta · borrada ${formatShortDate(f.deleted_at)} · ${formatPurgeCountdown(daysUntilPurge(f.deleted_at))}`,
                () => act(() => restoreFolder(f.id), "Carpeta restaurada"),
                () => confirmDelete(f.name, () => deleteFolderForever(f.id))
              )
            )}
            {state.items.map((i) =>
              row(
                `i-${i.id}`,
                ITEM_TYPE_ICONS[i.type],
                null,
                i.title || "Sin título",
                `${ITEM_TYPE_LABELS[i.type]} · borrado ${formatShortDate(i.deleted_at)} · ${formatPurgeCountdown(daysUntilPurge(i.deleted_at))}`,
                () => act(() => restoreItem(i.id), "Elemento restaurado"),
                () => confirmDelete(i.title || "Sin título", () => deleteItemForever(i.id))
              )
            )}
          </>
        )}
      </ScrollView>
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      ) : null}
    </HeroScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  center: { paddingVertical: 40, alignItems: "center" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.WHITE,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  searchBoxActive: { marginHorizontal: 0, marginBottom: 4 },
  searchPlaceholder: { fontSize: 16, color: COLORS.TEXT_LIGHT },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.TEXT_DARK, paddingVertical: 0 },
  quickRow: { flexDirection: "row", gap: 8, marginBottom: 22 },
  quickCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 8,
    minHeight: 84,
    justifyContent: "center",
  },
  quickLabel: { fontSize: 13, fontWeight: "600", color: COLORS.PRIMARY_DARK },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  sectionActions: { flexDirection: "row", gap: 8 },
  roundButtonActive: { backgroundColor: COLORS.PRIMARY },
  modeBar: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  modeChipText: { color: COLORS.PRIMARY, fontWeight: "700", fontSize: 13 },
  headerTextButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextButtonLabel: { color: COLORS.PRIMARY, fontWeight: "700", fontSize: 15 },
  bulkBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: "row",
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingVertical: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bulkButton: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 6, minHeight: 48 },
  bulkButtonDisabled: { opacity: 0.4 },
  bulkLabel: { fontSize: 13, fontWeight: "700", color: COLORS.PRIMARY },
  exportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    paddingVertical: 12,
  },
  exportLinkText: { color: COLORS.PRIMARY, fontWeight: "700", fontSize: 15 },
  retentionNotice: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 14,
    padding: 12,
    marginVertical: 12,
  },
  retentionText: { flex: 1, color: COLORS.PRIMARY_DARK, fontSize: 14, lineHeight: 20 },
  sectionTitleSmall: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_MEDIUM,
    marginBottom: 10,
    marginTop: 6,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSubtitle: { fontSize: 16, color: COLORS.TEXT_LIGHT, marginTop: -6 },
  hint: { color: COLORS.TEXT_LIGHT, fontSize: 14, marginVertical: 12, lineHeight: 20 },
  breadcrumbs: { marginBottom: 14, flexGrow: 0 },
  crumbRow: { flexDirection: "row", alignItems: "center" },
  crumb: { color: COLORS.PRIMARY, fontSize: 14, fontWeight: "600", paddingHorizontal: 4 },
  crumbCurrent: { color: COLORS.TEXT_MEDIUM },
  fab: { bottom: 28 },
  notice: { fontSize: 13, color: COLORS.TEXT_LIGHT, marginTop: 10, lineHeight: 18 },
  busy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  busyCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
  },
  busyText: { color: COLORS.TEXT_MEDIUM, fontSize: 14, fontWeight: "600" },
  chips: { gap: 8, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  chipActive: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
  chipText: { fontSize: 14, color: COLORS.TEXT_MEDIUM, fontWeight: "600" },
  chipTextActive: { color: COLORS.WHITE },
  resultCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 12,
    marginBottom: 10,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: { fontSize: 15, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  resultMeta: { fontSize: 12, color: COLORS.TEXT_LIGHT, marginTop: 2 },
  snippet: { fontSize: 13, color: COLORS.TEXT_MEDIUM, marginTop: 4, lineHeight: 18 },
  trashRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 12,
    marginBottom: 10,
  },
  trashButton: { padding: 8 },
  createCards: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 14,
    marginTop: 14,
  },
  createCardsIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  createCardsTitle: { fontSize: 15, fontWeight: "700", color: COLORS.PRIMARY_DARK },
  createCardsText: { fontSize: 13, color: COLORS.TEXT_LIGHT, marginTop: 2 },
});

export default ResiNotesScreen;
