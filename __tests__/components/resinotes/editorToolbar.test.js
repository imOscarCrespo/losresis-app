// Barra de formato de ResiNotes (ClickUp 124b4z9w5nh).
jest.mock("@10play/tentap-editor", () => ({
  DEFAULT_TOOLBAR_ITEMS: [
    "Bold", "Italic", "Link", "Task list", "Heading", "Code", "Underline", "Strikethrough",
    "Quote", "Ordered list", "Bullet list", "Indent", "Outdent", "Undo", "Redo",
  ].map((label) => ({ label, onPress: () => () => {}, active: () => false, disabled: () => false, image: () => null })),
}));

const { DEFAULT_TOOLBAR_ITEMS } = require("@10play/tentap-editor");
const { orderToolbarItems, RESINOTES_TOOLBAR_ITEMS, RESINOTES_TOOLBAR_THEME } = require("../../../components/resinotes/editor/toolbar");

describe("barra de formato", () => {
  it("pone primero negrita, cursiva, subrayado, tachado y las tres listas", () => {
    expect(RESINOTES_TOOLBAR_ITEMS.slice(0, 7).map((i) => i.label)).toEqual([
      "Negrita", "Cursiva", "Subrayado", "Tachado", "Lista con viñetas", "Lista numerada", "Lista de tareas",
    ]);
  });

  it("no quita ninguna herramienta existente", () => {
    expect(RESINOTES_TOOLBAR_ITEMS).toHaveLength(DEFAULT_TOOLBAR_ITEMS.length);
    expect(RESINOTES_TOOLBAR_ITEMS.map((i) => i.label)).toEqual(
      expect.arrayContaining(["Enlace", "Encabezado", "Cita", "Código", "Deshacer", "Rehacer"])
    );
  });

  it("deja al final, sin perderla, una herramienta que no conoce", () => {
    const extra = { label: "Highlight" };
    const items = orderToolbarItems([...DEFAULT_TOOLBAR_ITEMS, extra]);
    expect(items[items.length - 1]).toBe(extra);
    expect(items).toHaveLength(DEFAULT_TOOLBAR_ITEMS.length + 1);
  });

  it("disponible oscuro, activo morado sobre lavanda y deshabilitado gris claro", () => {
    expect(RESINOTES_TOOLBAR_THEME.icon.tintColor).toBe("#1B0977");
    expect(RESINOTES_TOOLBAR_THEME.iconActive.tintColor).toBe("#670CF5");
    expect(RESINOTES_TOOLBAR_THEME.iconWrapperActive.backgroundColor).toBeTruthy();
    expect(RESINOTES_TOOLBAR_THEME.iconDisabled.tintColor).toBe("#CBD5E1");
    // El deshabilitado no depende solo del color.
    expect(RESINOTES_TOOLBAR_THEME.iconWrapperDisabled.opacity).toBeLessThan(1);
  });
});
