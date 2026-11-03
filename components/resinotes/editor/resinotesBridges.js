import { Extension, Node, getHTMLFromFragment, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { CALLOUT_KIND_KEYS, normalizeCalloutKind } from "../../../utils/resinotes";

/*
 * ResiNotes (ClickUp 124b4z9w0qg, pasada B): tablas y bloques especiales en el
 * editor de notas.
 *
 * TenTap no trae tablas ni bloques en su bridge, así que van como bridges
 * propios. Un bridge vive a la vez en la app (manda órdenes) y dentro del
 * WebView (las ejecuta con TipTap), y los dos lados tienen que ser el mismo
 * objeto con el mismo nombre. Por eso aquí solo se describen, y cada lado los
 * crea con su propia clase BridgeExtension:
 *   * app:     components/resinotes/editor/bridges.js
 *   * WebView: editor-web/index.jsx (se compila con `npm run editor:build`
 *              en components/resinotes/editor/editorHtml.js).
 * Si cambias este fichero, vuelve a compilar el editor.
 */

export const TABLE_ACTIONS = [
  "insert",
  "addRowAfter",
  "deleteRow",
  "addColumnAfter",
  "deleteColumn",
  "toggleHeaderRow",
  "deleteTable",
];
export const CALLOUT_ACTIONS = ["set", "unset", "delete"];

const TABLE_MESSAGE = "resinotes-table";
const CALLOUT_MESSAGE = "resinotes-callout";

/**
 * Bloque especial: `<div data-callout="pearl">…párrafos…</div>`. La etiqueta
 * («💡 Perla clínica») la pinta el CSS (NOTE_BLOCKS_CSS), no es texto.
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "pearl",
        parseHTML: (element) => normalizeCalloutKind(element.getAttribute("data-callout")),
        renderHTML: (attributes) => ({ "data-callout": normalizeCalloutKind(attributes.kind) }),
      },
    };
  },

  parseHTML() {
    return CALLOUT_KIND_KEYS.map((kind) => ({ tag: `div[data-callout="${kind}"]` })).concat([
      { tag: "div[data-callout]" },
    ]);
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      // Envuelve los párrafos elegidos o, si el cursor ya está en un bloque, le cambia el tipo.
      setCallout:
        (kind) =>
        ({ editor, commands }) =>
          editor.isActive(this.name)
            ? commands.updateAttributes(this.name, { kind: normalizeCalloutKind(kind) })
            : commands.wrapIn(this.name, { kind: normalizeCalloutKind(kind) }),
      // Quita el bloque y deja su texto.
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
      // Borra el bloque con todo su texto.
      deleteCallout:
        () =>
        ({ commands }) =>
          commands.deleteNode(this.name),
    };
  },
});

const runTable = (editor, action) => {
  const chain = editor.chain().focus();
  switch (action) {
    case "insert":
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    case "addRowAfter":
      return chain.addRowAfter().run();
    case "deleteRow":
      return chain.deleteRow().run();
    case "addColumnAfter":
      return chain.addColumnAfter().run();
    case "deleteColumn":
      return chain.deleteColumn().run();
    case "toggleHeaderRow":
      return chain.toggleHeaderRow().run();
    case "deleteTable":
      return chain.deleteTable().run();
    default:
      return false;
  }
};

const runCallout = (editor, action, kind) => {
  const chain = editor.chain().focus();
  if (action === "set") return chain.setCallout(kind).run();
  if (action === "unset") return chain.unsetCallout().run();
  if (action === "delete") return chain.deleteCallout().run();
  return false;
};

// Tarjetas de repaso desde un fragmento (ClickUp 124b4z9w0z0, pasada B): el
// estado del editor lleva la selección como HTML, que la app pasa por las
// mismas reglas que un apunte entero. Una selección enorme no se manda.
export const MAX_SELECTION_HTML = 20000;

const selectionHtml = (editor) => {
  const { selection, schema, doc } = editor.state;
  if (selection.empty || typeof document === "undefined") return null;
  if (!doc.textBetween(selection.from, selection.to, " ").trim()) return null;
  const html = getHTMLFromFragment(selection.content().content, schema);
  return html.length > MAX_SELECTION_HTML ? null : html;
};

// ---------------------------------------------------------------------------
// Toques sin teclado (ClickUp 124b4z9w5nh): tocar una imagen la abre a
// pantalla completa y tocar la casilla de una tarea la marca o desmarca. En
// los dos casos sin enfocar el editor, para que no salga el teclado ni se
// seleccione la imagen (la casilla de TipTap llama a focus() al cambiar).
// Un toque es un dedo que se levanta casi donde bajó y enseguida: deslizar
// para leer la nota no cuenta.
// ---------------------------------------------------------------------------

export const IMAGE_TAP_MESSAGE = "resinotes-image-tap";
const TAP_SLOP_PX = 10;
// Tras un toque en una casilla o una imagen, si el editor coge el foco en este
// tiempo sin haberlo tenido antes, se le quita (iOS 26 enfoca la zona editable
// aunque se cancele el toque, y sacaría el teclado).
const FOCUS_GUARD_MS = 600;

/** Marca o desmarca la tarea de la casilla `label` sin enfocar el editor. */
const toggleTaskAt = (view, label) => {
  const item = label.parentElement;
  const content = item?.querySelector(":scope > div");
  if (!content) return false;
  let pos;
  try {
    pos = view.posAtDOM(content, 0);
  } catch {
    return false;
  }
  const $pos = view.state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name === "taskItem") {
      view.dispatch(view.state.tr.setNodeMarkup($pos.before(depth), undefined, { ...node.attrs, checked: !node.attrs.checked }));
      return true;
    }
  }
  return false;
};

const tapTarget = (target) => {
  if (!target || typeof target.closest !== "function") return null;
  if (target.tagName === "IMG") return { kind: "image", el: target };
  // La vista de la tarea de TipTap no pone data-type en el <li>: se busca por su lista.
  const label = target.closest('ul[data-type="taskList"] > li > label');
  return label ? { kind: "task", el: label } : null;
};

const createTapsExtension = (onImageTap) =>
  Extension.create({
    name: "resinotesTaps",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          view: (view) => {
            // Un toque (no un deslizamiento) en una casilla o una imagen: activa el guardián de foco.
            let start = null;
            let guardUntil = 0;
            const onStart = (event) => {
              const touch = event.touches?.[0];
              const hit = event.touches?.length === 1 ? tapTarget(event.target) : null;
              start = hit ? { x: touch.clientX, y: touch.clientY } : null;
              guardUntil = hit && !view.hasFocus() ? Date.now() + FOCUS_GUARD_MS : 0;
            };
            const onMove = (event) => {
              const touch = event.touches?.[0];
              if (!start || !touch) return;
              if (Math.abs(touch.clientX - start.x) > TAP_SLOP_PX || Math.abs(touch.clientY - start.y) > TAP_SLOP_PX) {
                start = null;
                guardUntil = 0;
              }
            };
            const onFocus = () => {
              if (Date.now() >= guardUntil) return;
              guardUntil = 0;
              setTimeout(() => {
                view.dom.blur();
                window.getSelection?.()?.removeAllRanges();
              }, 0);
            };
            // El click llega antes aquí (captura) que al change de la casilla de TipTap, que
            // enfocaría el editor: se cancela y la tarea se marca sin foco.
            const onClick = (event) => {
              const hit = tapTarget(event.target);
              if (!hit) return;
              event.preventDefault();
              event.stopPropagation();
              if (hit.kind === "image") {
                const src = hit.el.currentSrc || hit.el.getAttribute("src");
                if (src) onImageTap?.(src);
              } else if (view.editable) {
                toggleTaskAt(view, hit.el);
              }
            };
            const options = { capture: true, passive: true };
            view.dom.addEventListener("touchstart", onStart, options);
            view.dom.addEventListener("touchmove", onMove, options);
            view.dom.addEventListener("click", onClick, true);
            view.dom.addEventListener("focus", onFocus);
            return {
              destroy: () => {
                view.dom.removeEventListener("touchstart", onStart, options);
                view.dom.removeEventListener("touchmove", onMove, options);
                view.dom.removeEventListener("click", onClick, true);
                view.dom.removeEventListener("focus", onFocus);
              },
            };
          },
        }),
      ];
    },
  });

/**
 * Los bridges, creados con la BridgeExtension de cada lado. `sendMessage` solo
 * lo pasa el WebView (para avisar a la app de que se ha tocado una imagen);
 * `onImageTap` solo la app.
 */
export const createResiNotesBridges = (BridgeExtension, { sendMessage = null, onImageTap = null } = {}) => {
  const TableBridge = new BridgeExtension({
    tiptapExtension: Table.configure({ resizable: false }),
    tiptapExtensionDeps: [TableRow, TableHeader, TableCell],
    onBridgeMessage: (editor, message) => {
      if (message?.type !== TABLE_MESSAGE) return false;
      runTable(editor, message.payload?.action);
      return false;
    },
    extendEditorInstance: (sendBridgeMessage) => ({
      tableCommand: (action) => sendBridgeMessage({ type: TABLE_MESSAGE, payload: { action } }),
    }),
    extendEditorState: (editor) => ({
      isTableActive: editor.isActive("table"),
    }),
  });

  const CalloutBridge = new BridgeExtension({
    tiptapExtension: Callout,
    onBridgeMessage: (editor, message) => {
      if (message?.type !== CALLOUT_MESSAGE) return false;
      runCallout(editor, message.payload?.action, message.payload?.kind);
      return false;
    },
    extendEditorInstance: (sendBridgeMessage) => ({
      calloutCommand: (action, kind) => sendBridgeMessage({ type: CALLOUT_MESSAGE, payload: { action, kind } }),
    }),
    extendEditorState: (editor) => ({
      activeCallout: editor.isActive("callout") ? normalizeCalloutKind(editor.getAttributes("callout").kind) : null,
    }),
  });

  const SelectionBridge = new BridgeExtension({
    forceName: "resinotesSelection",
    extendEditorState: (editor) => ({ selectionHtml: selectionHtml(editor) }),
  });

  const TapsBridge = new BridgeExtension({
    tiptapExtension: createTapsExtension((src) => sendMessage?.({ type: IMAGE_TAP_MESSAGE, payload: { src } })),
    onEditorMessage: (message) => {
      if (message?.type !== IMAGE_TAP_MESSAGE || !message.payload?.src) return false;
      onImageTap?.(message.payload.src);
      return true;
    },
  });

  return { TableBridge, CalloutBridge, SelectionBridge, TapsBridge };
};
