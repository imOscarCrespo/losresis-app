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
  useEditorBridge,
} from "@10play/tentap-editor";
import { HeroScreenLayout } from "../HeroScreenLayout";
import { Icon } from "../Icon";
import { COLORS } from "../../constants/colors";
import { ResiNotesSheet, SheetOption } from "./ResiNotesSheet";
import { pickImagesFromLibrary, takePhoto } from "./pickers";
import {
  getItem,
  getSignedUrls,
  markItemOpened,
  saveNote,
  uploadNoteImage,
} from "../../services/resinotesService";
import { MAX_ITEM_TITLE, storedImageKeys, toEditorHtml, toStoredHtml } from "../../utils/resinotes";

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
`;
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
const EditorBody = ({ userId, item, initialHtml, initialTitle, recovered, onBack, onSaved }) => {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(recovered ? "dirty" : "idle");
  const [imageSheet, setImageSheet] = useState(false);
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
    bridgeExtensions: [...TenTapStartKit, CoreBridge.configureCSS(EDITOR_CSS)],
    onChange: () => scheduleSave(),
    theme: {
      webview: { backgroundColor: COLORS.WHITE },
    },
  });

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

  const insertImages = async (source) => {
    setImageSheet(false);
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
      }
      overlay={
        <ResiNotesSheet visible={imageSheet} title="Insertar imagen" onClose={() => setImageSheet(false)}>
          <SheetOption icon="camera-outline" label="Hacer una foto" onPress={() => insertImages("camera")} />
          <SheetOption icon="images-outline" label="Elegir de la galería" onPress={() => insertImages("library")} />
        </ResiNotesSheet>
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
export const NoteEditor = ({ userId, itemId, onBack, onSaved }) => {
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
    />
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toolbarRow: { flexDirection: "row" },
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
