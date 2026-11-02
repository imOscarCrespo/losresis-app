import { Node, mergeAttributes } from "@tiptap/core";
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

/** Los dos bridges, creados con la BridgeExtension de cada lado. */
export const createResiNotesBridges = (BridgeExtension) => {
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

  return { TableBridge, CalloutBridge };
};
