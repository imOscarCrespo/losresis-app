import React from "react";
import { createRoot } from "react-dom/client";
import { EditorContent } from "@tiptap/react";
// Todo de las fuentes de TenTap (no de `@10play/tentap-editor/web`): mezclar las
// dos copias duplicaría el runtime del WebView.
import { boot } from "@10play/tentap-editor/src/web/runtime";
import { useTenTap } from "@10play/tentap-editor/src/web/useTenTap";
import { TenTapStartKit } from "@10play/tentap-editor/src/bridges/StarterKit";
import BridgeExtension from "@10play/tentap-editor/src/bridges/base";
import { createResiNotesBridges } from "../components/resinotes/editor/resinotesBridges";

/*
 * El editor de ResiNotes dentro del WebView: el de TenTap (como su
 * simpleWebEditor) más tablas, bloques especiales y la selección (para crear
 * tarjetas de un fragmento).
 * Compilar: `npm run editor:build` → components/resinotes/editor/editorHtml.js.
 */

const { TableBridge, CalloutBridge, SelectionBridge } = createResiNotesBridges(BridgeExtension);
const bridges = [...TenTapStartKit, TableBridge, CalloutBridge, SelectionBridge];

const Editor = () => {
  const editor = useTenTap({ bridges });
  const { dynamicHeight } = boot().requireConfig();
  return <EditorContent editor={editor} className={dynamicHeight ? "tentap-root dynamic-height" : "tentap-root"} />;
};

const runtime = boot();
runtime.whenConfigured(() => {
  try {
    createRoot(document.getElementById("root")).render(<Editor />);
  } catch (error) {
    runtime.reportBootError(error);
    throw error;
  }
});
