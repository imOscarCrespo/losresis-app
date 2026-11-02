import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { HeroScreenLayout } from "../HeroScreenLayout";
import { Icon } from "../Icon";
import { COLORS } from "../../constants/colors";
import { pdfViewerHtml } from "./pdf/pdfViewerHtml";
import { getItem, getSignedUrl, markItemOpened, saveLastPage } from "../../services/resinotesService";

/**
 * Visor de PDFs de ResiNotes (ClickUp 124b4z9w0qg, pasada B): abre el PDF
 * dentro de la app (pdf.js en un WebView, sin CDN), con zoom, indicador de
 * página y vuelta a la página en la que se quedó el residente (last_page).
 */

const SAVE_PAGE_MS = 800;
const URL_TTL = 60 * 60;

const ERROR_TEXT = {
  password: "Este PDF tiene contraseña y no se puede abrir aquí.",
  load: "No se ha podido abrir el PDF. Revisa tu conexión.",
  no_url: "El archivo no está disponible. Revisa tu conexión.",
};

export const PdfViewer = ({ itemId, onBack, onDownload }) => {
  const [state, setState] = useState({ loading: true, error: null, item: null, url: null });
  const [page, setPage] = useState({ current: null, total: null, ready: false, error: null });
  const [downloading, setDownloading] = useState(false);
  const pendingPageRef = useRef(null);
  const savedPageRef = useRef(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setState({ loading: true, error: null, item: null, url: null });
    setPage({ current: null, total: null, ready: false, error: null });
    try {
      const item = await getItem(itemId);
      if (!item || item.deleted_at) {
        setState({ loading: false, error: "Este PDF ya no existe o está en la papelera.", item: null, url: null });
        return;
      }
      const url = await getSignedUrl(item.resinotes_attachments?.[0]?.storage_key, URL_TTL);
      if (!url) throw new Error("NO_URL");
      savedPageRef.current = item.last_page || null;
      markItemOpened(itemId);
      setState({ loading: false, error: null, item, url });
    } catch {
      setState({ loading: false, error: ERROR_TEXT.no_url, item: null, url: null });
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const flushPage = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = pendingPageRef.current;
    if (next && next !== savedPageRef.current) {
      savedPageRef.current = next;
      saveLastPage(itemId, next);
    }
    pendingPageRef.current = null;
  }, [itemId]);

  // Se guarda la página al salir de cualquier forma (Volver, otra pestaña, atrás de Android).
  useEffect(() => () => flushPage(), [flushPage]);

  const handleBack = useCallback(() => {
    flushPage();
    onBack();
  }, [flushPage, onBack]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const onMessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message?.type === "loaded") {
      setPage({ current: message.page, total: message.total, ready: true, error: null });
    } else if (message?.type === "page") {
      setPage((p) => ({ ...p, current: message.page, total: message.total ?? p.total }));
      pendingPageRef.current = message.page;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushPage, SAVE_PAGE_MS);
    } else if (message?.type === "error") {
      setPage((p) => ({ ...p, ready: true, error: ERROR_TEXT[message.reason] || ERROR_TEXT.load }));
    }
  };

  const openInBrowser = async () => {
    const url = state.url || (await getSignedUrl(state.item?.resinotes_attachments?.[0]?.storage_key, 600));
    if (url) await WebBrowser.openBrowserAsync(url);
  };

  const title = state.item?.title || "PDF";
  const error = state.error || page.error;

  return (
    <HeroScreenLayout
      title={title}
      onBack={handleBack}
      rightSlot={
        state.item ? (
          <TouchableOpacity
            style={styles.headerButton}
            disabled={downloading}
            onPress={async () => {
              setDownloading(true);
              try {
                await onDownload?.(state.item);
              } finally {
                setDownloading(false);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Descargar o compartir"
            testID="resinotes-pdf-download"
          >
            {downloading ? (
              <ActivityIndicator color={COLORS.PRIMARY} />
            ) : (
              <Icon name="download-outline" size={22} color={COLORS.PRIMARY} />
            )}
          </TouchableOpacity>
        ) : null
      }
    >
      <View style={styles.flex} testID="resinotes-pdf-viewer">
        {state.url && !state.error ? (
          <WebView
            originWhitelist={["*"]}
            source={{ html: pdfViewerHtml, baseUrl: "https://localhost/" }}
            injectedJavaScriptBeforeContentLoaded={`window.RESINOTES_PDF = ${JSON.stringify({
              url: state.url,
              page: savedPageRef.current || 1,
            }).replace(/</g, "\\u003c")}; true;`}
            onMessage={onMessage}
            javaScriptEnabled
            setSupportMultipleWindows={false}
            allowsLinkPreview={false}
            // Los enlaces de dentro del PDF no navegan el visor.
            onShouldStartLoadWithRequest={(req) => req.url.startsWith("https://localhost") || req.url === "about:blank"}
            style={styles.web}
          />
        ) : null}

        {state.loading || (state.url && !page.ready && !error) ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color={COLORS.PRIMARY} />
            <Text style={styles.overlayText}>Abriendo el PDF…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.overlay}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load} accessibilityRole="button" style={styles.retryButton}>
              <Text style={styles.retry}>Reintentar</Text>
            </TouchableOpacity>
            {state.item ? (
              <TouchableOpacity onPress={openInBrowser} accessibilityRole="button">
                <Text style={styles.retry}>Abrir en el navegador</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {page.ready && !error && page.total ? (
          <View style={styles.pagePill} pointerEvents="none" accessibilityLiveRegion="polite">
            <Text style={styles.pageText} testID="resinotes-pdf-page">
              {`Página ${page.current || 1} de ${page.total}`}
            </Text>
          </View>
        ) : null}
      </View>
    </HeroScreenLayout>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  web: { flex: 1, backgroundColor: "#F1F5F9" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#F1F5F9",
  },
  overlayText: { color: COLORS.TEXT_MEDIUM, fontSize: 14 },
  errorText: { color: COLORS.TEXT_MEDIUM, fontSize: 15, textAlign: "center", lineHeight: 21 },
  retryButton: { paddingVertical: 4 },
  retry: { color: COLORS.PRIMARY, fontWeight: "700", fontSize: 15 },
  pagePill: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: "rgba(27, 9, 119, 0.85)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pageText: { color: COLORS.WHITE, fontWeight: "700", fontSize: 13 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default PdfViewer;
