import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { COLORS } from "../../constants/colors";
import { getItem, getSignedUrls } from "../../services/resinotesService";
import { NOTE_BLOCKS_CSS, storedImageKeys, toEditorHtml } from "../../utils/resinotes";
import { ImageViewer } from "./ImageViewer";

/*
 * Contenido de una nota en solo lectura (ClickUp 124b4z9w5nh): lo que se ve al
 * pulsar «Ver apunte» en «Repasar ahora» y en una tarjeta de apunte completo.
 *
 * Es el HTML guardado de la nota tal cual (negritas, listas, casillas, tablas,
 * bloques especiales e imágenes), con el mismo CSS que el editor, sin resumir
 * ni cambiar nada. Siempre se lee la versión actual de la nota. Las imágenes
 * se abren a pantalla completa al tocarlas. El WebView mide su contenido y
 * crece con él, así que la pantalla que lo contiene hace el scroll.
 */

const CONTENT_CSS = `
  * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { color: #0F172A; font-size: 16px; line-height: 1.5; overflow-wrap: break-word; -webkit-text-size-adjust: 100%; }
  #content > :first-child { margin-top: 0; }
  #content > :last-child { margin-bottom: 0; }
  h1, h2, h3 { color: #1B0977; }
  blockquote { border-left: 3px solid #C4B5FD; margin-left: 0; padding-left: 12px; color: #334155; }
  img { max-width: 100%; height: auto; border-radius: 12px; display: block; margin: 8px 0; }
  a { color: #670CF5; }
  ul[data-type="taskList"] li > label > input { pointer-events: none; }
`;

const SCRIPT = `
(function () {
  var post = function (msg) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
  var last = 0;
  var report = function () {
    var h = Math.ceil(document.getElementById("content").getBoundingClientRect().height);
    if (h !== last) { last = h; post({ type: "height", value: h }); }
  };
  if (window.ResizeObserver) new ResizeObserver(report).observe(document.getElementById("content"));
  Array.prototype.forEach.call(document.images, function (img) { img.addEventListener("load", report); img.addEventListener("error", report); });
  document.querySelectorAll('input[type="checkbox"]').forEach(function (i) { i.setAttribute("disabled", "disabled"); i.setAttribute("tabindex", "-1"); });
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG") { e.preventDefault(); post({ type: "image", src: t.currentSrc || t.src }); }
  }, true);
  window.addEventListener("load", report);
  report();
})();
`;

/** HTML de la página: el de la nota sin scripts, con el CSS de las notas. Exportado para los tests. */
export const noteContentPage = (html) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>${CONTENT_CSS}
${NOTE_BLOCKS_CSS}</style>
</head>
<body>
<div id="content">${String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "")}</div>
<script>${SCRIPT}</script>
</body>
</html>`;

/**
 * Carga una nota para leerla: la nota y su HTML con las imágenes firmadas.
 * state: { loading, error, item, html }.
 */
export const useNoteForReading = (itemId) => {
  const [state, setState] = useState({ loading: true, error: null, item: null, html: "" });

  const load = useCallback(async () => {
    if (!itemId) {
      setState({ loading: false, error: "missing", item: null, html: "" });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const item = await getItem(itemId);
      if (!item || item.deleted_at) {
        setState({ loading: false, error: "missing", item: null, html: "" });
        return;
      }
      const stored = item.content || "";
      const urls = await getSignedUrls(storedImageKeys(stored));
      setState({ loading: false, error: null, item, html: toEditorHtml(stored, urls) });
    } catch {
      setState({ loading: false, error: "network", item: null, html: "" });
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
};

/** El contenido de la nota (`html` ya con las URLs firmadas). */
export const NoteContent = ({ html, testID = "resinotes-note-content" }) => {
  const [height, setHeight] = useState(0);
  const [viewerSrc, setViewerSrc] = useState(null);
  const page = useMemo(() => noteContentPage(html), [html]);

  const onMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message?.type === "height" && message.value > 0) setHeight(message.value);
      if (message?.type === "image" && message.src) setViewerSrc(message.src);
    } catch {
      // nada
    }
  };

  // Un enlace de la nota se abre fuera, no dentro del recuadro.
  // La página se carga desde un string (about:blank); cualquier otra navegación es un enlace.
  const onShouldStart = (request) => {
    const url = request?.url || "";
    if (!/^(https?|mailto|tel):/i.test(url)) return true;
    Linking.openURL(url).catch(() => {});
    return false;
  };

  return (
    <View style={styles.wrap} testID={testID}>
      {!height ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      ) : null}
      <WebView
        source={{ html: page }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStart}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={[styles.webview, { height: Math.max(height, 1) }]}
        containerStyle={styles.webviewContainer}
        setBuiltInZoomControls={false}
        testID={`${testID}-web`}
      />
      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { minHeight: 40 },
  loading: { paddingVertical: 16, alignItems: "center" },
  webview: { backgroundColor: "transparent" },
  webviewContainer: { backgroundColor: "transparent", flex: 0 },
});

export default NoteContent;
