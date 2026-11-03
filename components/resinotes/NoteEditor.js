import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EditorKeyboardAvoidingView,
  CoreBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useBridgeState,
  useEditorBridge,
} from "@10play/tentap-editor";
import { editorHtml } from "./editor/editorHtml";
import { CalloutBridge, SelectionBridge, TableBridge } from "./editor/bridges";
import { HeroScreenLayout } from "../HeroScreenLayout";
import { Icon } from "../Icon";
import { COLORS } from "../../constants/colors";
import { ResiNotesSheet, SheetOption, useRunAfterSheetClose } from "./ResiNotesSheet";
import { pickImagesFromLibrary, takePhoto } from "./pickers";
import {
  getItem,
  getSignedUrls,
  markItemOpened,
  saveNote,
  uploadNoteImage,
} from "../../services/resinotesService";
import {
  CALLOUT_KINDS,
  CALLOUT_KIND_KEYS,
  MAX_ITEM_TITLE,
  NOTE_BLOCKS_CSS,
  storedImageKeys,
  toEditorHtml,
  toStoredHtml,
} from "../../utils/resinotes";

const AUTOSAVE_MS = 1200;
// El borrador local se apunta antes que el guardado: si se sale de golpe (otra pestaña,
// la app al fondo) solo se pierde como mucho este intervalo.
const DRAFT_MS = 300;

// La tipografía y los colores de la app dentro del WebView del editor.
const EDITOR_CSS = `
  * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { color: #0F172A; font-size: 16px; line-height: 1.5; }
  h1, h2, h3 { color: #1B0977; }
  blockquote { border-left: 3px solid #C4B5FD; margin-left: 0; padding-left: 12px; color: #334155; }
  img { max-width: 100%; height: auto; border-radius: 12px; }
  a { color: #670CF5; }
${NOTE_BLOCKS_CSS}
`;

// Tablas: lo que se puede hacer con el cursor dentro de una.
const TABLE_OPTIONS = [
  { action: "addRowAfter", icon: "add", label: "Añadir fila debajo" },
  { action: "deleteRow", icon: "remove", label: "Quitar esta fila" },
  { action: "addColumnAfter", icon: "add", label: "Añadir columna a la derecha" },
  { action: "deleteColumn", icon: "remove", label: "Quitar esta columna" },
  { action: "toggleHeaderRow", icon: "list-outline", label: "Poner o quitar la fila de títulos" },
];
const draftKey = (itemId) => `@losresis:resinotes:draft:${itemId}`;

const STATUS_LABEL = {
  idle: "",
  dirty: "Cambios sin guardar",
  saving: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
};

/*
 * El borrador local: cada cambio se apunta en el móvil antes de mandarlo, y se
 * borra cuando la BD lo confirma. Si falla la red o se cierra la app a mitad,
 * al volver a abrir la nota se recupera el borrador (más nuevo que lo guardado).
 */
const writeDraft = async (itemId, draft) => {
  try {
    // Con referencias estables: las URLs firmadas de las imágenes caducan.
    const stored = { title: draft.title, html: toStoredHtml(draft.html), at: Date.now() };
    await AsyncStorage.setItem(draftKey(itemId), JSON.stringify(stored));
  } catch {
    // Sin borrador local se sigue guardando en la BD.
  }
};

const readDraft = async (itemId) => {
  try {
    const raw = await AsyncStorage.getItem(draftKey(itemId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearDraft = async (itemId) => {
  try {
    await AsyncStorage.removeItem(draftKey(itemId));
  } catch {
    // nada
  }
};

/** El editor ya montado con el contenido inicial. */
const EditorBody = ({ userId, item, initialHtml, initialTitle, recovered, onBack, onSaved, onCreateCards }) => {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(recovered ? "dirty" : "idle");
  const [imageSheet, setImageSheet] = useState(false);
  const { runAfterSheetClose, onSheetDismiss } = useRunAfterSheetClose();
  const [tableSheet, setTableSheet] = useState(false);
  const [calloutSheet, setCalloutSheet] = useState(false);
  const [uploading, setUploading] = useState(false);
  const titleRef = useRef(initialTitle);
  const timerRef = useRef(null);
  const savingRef = useRef(null);
  const pendingRef = useRef(Boolean(recovered));
  const mountedRef = useRef(true);
  const draftTimerRef = useRef(null);
  const lastHtmlRef = useRef(null);

  const editor = useEditorBridge({
    // Una nota nueva empieza por el título (con autoFocus): si el editor cogiera el foco,
    // el WebView no lo soltaría al tocar el título y lo escrito acabaría en el cuerpo.
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: initialHtml || "",
    // Editor propio (editor-web/): el de TenTap más tablas y bloques especiales.
    customSource: editorHtml,
    bridgeExtensions: [...TenTapStartKit, TableBridge, CalloutBridge, SelectionBridge, CoreBridge.configureCSS(EDITOR_CSS)],
    onChange: () => scheduleSave(),
    theme: {
      webview: { backgroundColor: COLORS.WHITE },
    },
  });

  const editorState = useBridgeState(editor);

  const runTable = (action) => {
    setTableSheet(false);
    editor.tableCommand(action);
  };

  const runCallout = (action, kind) => {
    setCalloutSheet(false);
    editor.calloutCommand(action, kind);
  };

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (savingRef.current) await savingRef.current.catch(() => {});
    if (!pendingRef.current) return true;

    pendingRef.current = false;
    const run = (async () => {
      let html;
      try {
        html = await editor.getHTML();
      } catch {
        pendingRef.current = true;
        throw new Error("EDITOR_UNAVAILABLE");
      }
      lastHtmlRef.current = html;
      const draft = { title: titleRef.current, html };
      await writeDraft(item.id, draft);
      if (mountedRef.current) setStatus("saving");
      try {
        const saved = await saveNote(item.id, draft);
        await clearDraft(item.id);
        if (mountedRef.current && !pendingRef.current) setStatus("saved");
        onSaved?.(saved);
      } catch (error) {
        pendingRef.current = true;
        if (mountedRef.current) setStatus("error");
        throw error;
      }
    })();
    savingRef.current = run;
    try {
      await run;
      return true;
    } catch {
      return false;
    } finally {
      if (savingRef.current === run) savingRef.current = null;
    }
  }, [editor, item.id, onSaved]);

  const captureDraft = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      draftTimerRef.current = null;
      try {
        const html = await editor.getHTML();
        lastHtmlRef.current = html;
        await writeDraft(item.id, { title: titleRef.current, html });
      } catch {
        // El guardado normal lo volverá a intentar.
      }
    }, DRAFT_MS);
  }, [editor, item.id]);

  const scheduleSave = useCallback(() => {
    pendingRef.current = true;
    captureDraft();
    setStatus((s) => (s === "saving" ? s : "dirty"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, AUTOSAVE_MS);
  }, [flush, captureDraft]);

  useEffect(() => {
    if (recovered) scheduleSave();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      // Se sale sin «Volver» (otra pestaña de la barra inferior): se guarda lo último
      // conocido sin esperar. Si falla, el borrador local lo recupera al reabrir la nota.
      if (pendingRef.current && lastHtmlRef.current !== null) {
        saveNote(item.id, { title: titleRef.current, html: lastHtmlRef.current })
          .then(() => clearDraft(item.id))
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTitle = (value) => {
    setTitle(value);
    titleRef.current = value;
    scheduleSave();
  };

  const handleBack = async () => {
    const ok = await flush();
    if (ok) {
      onBack();
      return;
    }
    // El borrador queda en el móvil: al volver a abrir la nota se recupera.
    Alert.alert(
      "No se ha podido guardar",
      "Tus cambios están guardados en este móvil y se subirán la próxima vez que abras la nota.",
      [
        { text: "Seguir editando", style: "cancel" },
        { text: "Salir", onPress: onBack },
      ]
    );
  };

  // El «atrás» de Android pasa por el mismo camino que el botón Volver: guarda antes de salir.
  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Tarjetas de repaso (ClickUp 124b4z9w0z0): se generan desde lo guardado, así
  // que primero se guarda la nota. Con texto seleccionado, solo de ese
  // fragmento (pasada B): la BD comprueba que está tal cual en lo guardado.
  const [preparingCards, setPreparingCards] = useState(false);
  const createCards = async (selectionHtml = null) => {
    if (preparingCards) return;
    setPreparingCards(true);
    const ok = await flush();
    setPreparingCards(false);
    if (ok) {
      onCreateCards?.(item.id, selectionHtml);
      return;
    }
    Alert.alert("No se ha podido guardar", "Guarda la nota antes de crear tarjetas. Revisa tu conexión e inténtalo de nuevo.");
  };

  // El selector se abre cuando la hoja ya se ha cerrado (ver useRunAfterSheetClose).
  const insertImages = (source) => {
    setImageSheet(false);
    runAfterSheetClose(() => pickAndInsertImages(source));
  };

  const pickAndInsertImages = async (source) => {
    let files = [];
    try {
      files = source === "camera" ? await takePhoto() : await pickImagesFromLibrary();
    } catch (e) {
      Alert.alert("No se ha podido abrir", e?.userMessage || "Inténtalo de nuevo.");
      return;
    }
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { url } = await uploadNoteImage(userId, item.id, file);
        if (url) editor.setImage(url);
      }
      scheduleSave();
    } catch (e) {
      Alert.alert("Error de subida", e?.userMessage || "No se ha podido subir la imagen. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const statusColor = status === "error" ? COLORS.ERROR : status === "saved" ? COLORS.SUCCESS : COLORS.TEXT_LIGHT;

  return (
    <HeroScreenLayout
      title="Nota"
      onBack={handleBack}
      rightSlot={
        <View style={styles.headerActions}>
          {onCreateCards ? (
            <TouchableOpacity
              onPress={() => createCards()}
              disabled={preparingCards}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Crear tarjetas de estudio"
              testID="resinotes-note-create-cards"
            >
              {preparingCards ? (
                <ActivityIndicator color={COLORS.PRIMARY} />
              ) : (
                <Icon name="brain-outline" size={22} color={COLORS.PRIMARY} />
              )}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setImageSheet(true)}
            disabled={uploading}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Insertar imagen"
            testID="resinotes-note-insert-image"
          >
            {uploading ? (
              <ActivityIndicator color={COLORS.PRIMARY} />
            ) : (
              <Icon name="image-outline" size={22} color={COLORS.PRIMARY} />
            )}
          </TouchableOpacity>
        </View>
      }
      overlay={
        <>
          <ResiNotesSheet
            visible={imageSheet}
            title="Insertar imagen"
            onClose={() => setImageSheet(false)}
            onDismiss={onSheetDismiss}
          >
            <SheetOption icon="camera-outline" label="Hacer una foto" onPress={() => insertImages("camera")} />
            <SheetOption icon="images-outline" label="Elegir de la galería" onPress={() => insertImages("library")} />
          </ResiNotesSheet>

          <ResiNotesSheet
            visible={tableSheet}
            title={editorState.isTableActive ? "Tabla" : "Insertar tabla"}
            onClose={() => setTableSheet(false)}
            testID="resinotes-table-sheet"
          >
            {editorState.isTableActive ? (
              <>
                {TABLE_OPTIONS.map((o) => (
                  <SheetOption
                    key={o.action}
                    icon={o.icon}
                    label={o.label}
                    onPress={() => runTable(o.action)}
                    testID={`resinotes-table-${o.action}`}
                  />
                ))}
                <SheetOption
                  icon="trash-outline"
                  label="Eliminar la tabla"
                  danger
                  onPress={() => runTable("deleteTable")}
                  testID="resinotes-table-deleteTable"
                />
              </>
            ) : (
              <SheetOption
                icon="table-outline"
                label="Tabla de 3 × 3"
                description="Con fila de títulos. Luego puedes añadir o quitar filas y columnas."
                onPress={() => runTable("insert")}
                testID="resinotes-table-insert"
              />
            )}
          </ResiNotesSheet>

          <ResiNotesSheet
            visible={calloutSheet}
            title={editorState.activeCallout ? "Cambiar el bloque" : "Insertar bloque"}
            onClose={() => setCalloutSheet(false)}
            testID="resinotes-callout-sheet"
          >
            {CALLOUT_KIND_KEYS.map((kind) => (
              <SheetOption
                key={kind}
                emoji={CALLOUT_KINDS[kind].emoji}
                label={CALLOUT_KINDS[kind].label}
                description={editorState.activeCallout === kind ? "Este es el bloque actual" : undefined}
                onPress={() => runCallout("set", kind)}
                testID={`resinotes-callout-${kind}`}
              />
            ))}
            {editorState.activeCallout ? (
              <>
                <SheetOption
                  icon="remove"
                  label="Quitar el bloque y conservar el texto"
                  onPress={() => runCallout("unset")}
                  testID="resinotes-callout-unset"
                />
                <SheetOption
                  icon="trash-outline"
                  label="Eliminar el bloque con su texto"
                  danger
                  onPress={() => runCallout("delete")}
                  testID="resinotes-callout-delete"
                />
              </>
            ) : null}
          </ResiNotesSheet>
        </>
      }
    >
      <EditorKeyboardAvoidingView style={styles.flex}>
        <View style={styles.paper}>
          <View style={styles.statusRow} testID="resinotes-note-status">
            <Text style={[styles.status, { color: statusColor }]}>{STATUS_LABEL[status]}</Text>
            {status === "error" ? (
              <TouchableOpacity onPress={() => flush()} accessibilityRole="button">
                <Text style={styles.retry}>Reintentar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TextInput
            value={title}
            onChangeText={handleTitle}
            placeholder="Título"
            placeholderTextColor={COLORS.GRAY_MEDIUM}
            maxLength={MAX_ITEM_TITLE}
            style={styles.title}
            autoFocus={!initialHtml && !initialTitle}
            accessibilityLabel="Título de la nota"
            testID="resinotes-note-title"
          />
          <View style={styles.flex} testID="resinotes-note-editor">
            <RichText editor={editor} />
          </View>
        </View>
        <View style={styles.blocksRow}>
          <TouchableOpacity
            style={[styles.blockButton, editorState.isTableActive && styles.blockButtonActive]}
            onPress={() => setTableSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={editorState.isTableActive ? "Opciones de la tabla" : "Insertar tabla"}
            testID="resinotes-note-table"
          >
            <Icon name="table-outline" size={18} color={COLORS.PRIMARY} />
            <Text style={styles.blockButtonText}>Tabla</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.blockButton, editorState.activeCallout && styles.blockButtonActive]}
            onPress={() => setCalloutSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={editorState.activeCallout ? "Cambiar el bloque" : "Insertar bloque especial"}
            testID="resinotes-note-callout"
          >
            <Text style={styles.blockEmoji}>
              {editorState.activeCallout ? CALLOUT_KINDS[editorState.activeCallout].emoji : "💡"}
            </Text>
            <Text style={styles.blockButtonText}>Bloque</Text>
          </TouchableOpacity>
          {onCreateCards && editorState.selectionHtml ? (
            <TouchableOpacity
              style={styles.blockButton}
              onPress={() => createCards(editorState.selectionHtml)}
              disabled={preparingCards}
              accessibilityRole="button"
              accessibilityLabel="Crear tarjetas de la selección"
              testID="resinotes-note-selection-cards"
            >
              <Icon name="brain-outline" size={18} color={COLORS.PRIMARY} />
              <Text style={styles.blockButtonText}>Crear tarjetas</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.toolbarRow}>
          <Toolbar editor={editor} />
        </View>
      </EditorKeyboardAvoidingView>
    </HeroScreenLayout>
  );
};

/**
 * Editor de una nota de ResiNotes. Carga la nota, firma las URLs de sus
 * imágenes, recupera un borrador local si lo hay y monta el editor.
 */
export const NoteEditor = ({ userId, itemId, onBack, onSaved, onCreateCards }) => {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const item = await getItem(itemId);
      if (!item || item.deleted_at) {
        setState({ loading: false, error: "Esta nota ya no existe o está en la papelera.", data: null });
        return;
      }
      const draft = await readDraft(itemId);
      const draftIsNewer = draft && draft.at > new Date(item.updated_at).getTime();
      const storedHtml = draftIsNewer ? draft.html : item.content || "";
      const urls = await getSignedUrls(storedImageKeys(storedHtml));
      markItemOpened(itemId);
      setState({
        loading: false,
        error: null,
        data: {
          item,
          html: toEditorHtml(storedHtml, urls),
          title: draftIsNewer ? draft.title ?? item.title : item.title,
          recovered: Boolean(draftIsNewer),
        },
      });
    } catch {
      setState({ loading: false, error: "No se ha podido abrir la nota. Revisa tu conexión.", data: null });
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!state.data) {
    return (
      <HeroScreenLayout title="Nota" onBack={onBack}>
        <View style={styles.center}>
          {state.loading ? (
            <ActivityIndicator color={COLORS.PRIMARY} />
          ) : (
            <>
              <Text style={styles.errorText}>{state.error}</Text>
              <TouchableOpacity onPress={load} accessibilityRole="button">
                <Text style={styles.retry}>Reintentar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </HeroScreenLayout>
    );
  }

  return (
    <EditorBody
      userId={userId}
      item={state.data.item}
      initialHtml={state.data.html}
      initialTitle={state.data.title}
      recovered={state.data.recovered}
      onBack={onBack}
      onSaved={onSaved}
      onCreateCards={onCreateCards}
    />
  );
};

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  toolbarRow: { flexDirection: "row" },
  blocksRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  blockButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  blockButtonActive: { borderWidth: 1, borderColor: COLORS.PRIMARY },
  blockEmoji: { fontSize: 15 },
  blockButtonText: { color: COLORS.PRIMARY, fontWeight: "700", fontSize: 13 },
  paper: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    overflow: "hidden",
  },
  statusRow: { flexDirection: "row", justifyContent: "space-between", minHeight: 18 },
  status: { fontSize: 12, fontWeight: "600" },
  retry: { color: COLORS.PRIMARY, fontWeight: "700", fontSize: 14 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.PRIMARY_DARK,
    paddingVertical: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorText: { color: COLORS.TEXT_MEDIUM, fontSize: 15, textAlign: "center" },
});

export default NoteEditor;
