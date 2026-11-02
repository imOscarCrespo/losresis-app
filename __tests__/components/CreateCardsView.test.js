/**
 * «Crear tarjetas», pasada B (ClickUp 124b4z9w0z0): el atrás de Android en
 * «Revisar una a una», tarjetas parecidas, generar desde una carpeta (guardado
 * nota a nota) y un fragmento sin contexto.
 */
import React from "react";
import { BackHandler } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("../../components/HeroScreenLayout", () => {
  const { View } = require("react-native");
  return {
    HeroScreenLayout: ({ children, overlay, onBack }) => (
      <View testID="layout" onBack={onBack}>
        {children}
        {overlay}
      </View>
    ),
  };
});
jest.mock("../../components/Icon", () => ({ Icon: () => null }));
jest.mock("../../components/resinotes/ResiNotesSheet", () => {
  const { View } = require("react-native");
  return {
    ResiNotesSheet: ({ visible, children, testID }) => (visible ? <View testID={testID}>{children}</View> : null),
    SheetOption: () => null,
  };
});
jest.mock("../../services/resinotesService", () => ({ getItem: jest.fn() }));
jest.mock("../../services/flashcardService", () => ({
  listFlashcards: jest.fn(),
  saveProposals: jest.fn(),
  flashcardErrorMessage: () => "error",
}));

const { getItem } = jest.requireMock("../../services/resinotesService");
const { listFlashcards, saveProposals } = jest.requireMock("../../services/flashcardService");
const { CreateCardsView } = require("../../components/resinotes/flashcards/CreateCardsView");

const NOTE_A = {
  id: "a",
  type: "note",
  title: "Eclampsia",
  folder_id: "obs",
  content:
    "<h2>Manejo inicial</h2><ul><li><p>Estabilización materna (ABC).</p></li><li><p>Sulfato de magnesio.</p></li></ul><h2>Vía</h2><p>Dosis: 4 g en 15 min</p>",
};
const NOTE_B = { id: "b", type: "note", title: "Preeclampsia", folder_id: "pre", content: "<p>Umbral: 140/90 mmHg</p>" };
const LIBRARY = {
  folders: [
    { id: "obs", parent_id: null, name: "Obstetricia" },
    { id: "pre", parent_id: "obs", name: "Preeclampsia" },
  ],
  items: [
    { ...NOTE_A, updated_at: "2026-11-01" },
    { ...NOTE_B, updated_at: "2026-11-02" },
  ],
};

let backListener;
beforeEach(() => {
  jest.clearAllMocks();
  backListener = null;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, fn) => {
    backListener = fn;
    return { remove: jest.fn() };
  });
  getItem.mockImplementation(async (id) => ({ a: NOTE_A, b: NOTE_B })[id]);
  listFlashcards.mockResolvedValue([]);
  saveProposals.mockImplementation(async (_u, _i, rows) => rows.map((r, idx) => ({ id: `c${idx}` })));
});

const flush = () => act(async () => {});
const byId = (r, id) => r.root.findAll((n) => n.props.testID === id && typeof n.type !== "string");
const press = async (r, id) => {
  await act(async () => {
    byId(r, id)[0].props.onPress();
  });
};
const texts = (r) =>
  r.root
    .findAll((n) => n.type === "Text" || n.type?.displayName === "Text")
    .map((n) => [].concat(n.props.children).join(""))
    .join(" | ");

const render = async (props) => {
  let r;
  await act(async () => {
    r = TestRenderer.create(
      <CreateCardsView userId="u1" library={LIBRARY} onBack={jest.fn()} onStartReview={jest.fn()} onCreated={jest.fn()} {...props} />
    );
  });
  await flush();
  return r;
};

it("el atrás de Android en «Revisar una a una» vuelve a la lista sin perder las propuestas", async () => {
  const onBack = jest.fn();
  const r = await render({ itemId: "a", onBack });
  expect(texts(r)).toMatch(/Hemos preparado 3 tarjetas/);
  await press(r, "flashcards-one-by-one-start");
  expect(byId(r, "flashcards-one-by-one")).toHaveLength(1);
  let handled;
  await act(async () => {
    handled = backListener();
  });
  expect(handled).toBe(true);
  expect(onBack).not.toHaveBeenCalled();
  expect(byId(r, "flashcards-one-by-one")).toHaveLength(0);
  expect(texts(r)).toMatch(/3 de 3 seleccionadas/);
  // Otro atrás, ya en la lista: sale de la vista.
  await act(async () => backListener());
  expect(onBack).toHaveBeenCalledTimes(1);
});

it("una propuesta parecida a una tarjeta existente sale desmarcada con sus acciones; Mantener ambas la marca", async () => {
  listFlashcards.mockResolvedValue([
    { id: "x", question: "¿Cuál es el manejo inicial?", answer: "Estabilización materna (ABC).\nSulfato de magnesio." },
  ]);
  const r = await render({ itemId: "a" });
  expect(texts(r)).toMatch(/Ya tienes una tarjeta parecida/);
  expect(texts(r)).toMatch(/2 de 3 seleccionadas/);
  await press(r, "flashcards-proposal-0");
  await press(r, "flashcards-similar-view");
  expect(byId(r, "flashcards-similar-sheet").length).toBeGreaterThan(0);
  await press(r, "flashcards-similar-keep");
  expect(texts(r)).toMatch(/3 de 3 seleccionadas/);
  expect(texts(r)).not.toMatch(/Ya tienes una tarjeta parecida/);
});

it("Descartar nueva quita la propuesta y no borra nada", async () => {
  listFlashcards.mockResolvedValue([
    { id: "x", question: "¿Cuál es el manejo inicial?", answer: "Estabilización materna (ABC).\nSulfato de magnesio." },
  ]);
  const r = await render({ itemId: "a" });
  await press(r, "flashcards-proposal-0");
  await press(r, "flashcards-similar-discard");
  expect(texts(r)).toMatch(/2 de 2 seleccionadas/);
  expect(saveProposals).not.toHaveBeenCalled();
});

it("desde una carpeta enseña las notas (con subcarpetas), agrupa por nota y guarda nota a nota", async () => {
  const r = await render({ folderId: "obs" });
  expect(texts(r)).toMatch(/2 notas de 2/);
  await act(async () => byId(r, "flashcards-folder-subfolders")[0].props.onValueChange(false));
  expect(texts(r)).toMatch(/1 nota de 1/);
  await act(async () => byId(r, "flashcards-folder-subfolders")[0].props.onValueChange(true));
  await press(r, "flashcards-folder-generate");
  await flush();
  expect(byId(r, "flashcards-group-a")).toHaveLength(1);
  expect(byId(r, "flashcards-group-b")).toHaveLength(1);
  await press(r, "flashcards-approve");
  await flush();
  expect(saveProposals).toHaveBeenCalledTimes(2);
  expect(saveProposals.mock.calls.map((c) => c[1]).sort()).toEqual(["a", "b"]);
  saveProposals.mock.calls.forEach(([, itemId, rows]) => rows.forEach((row) => expect(row.itemId).toBe(itemId)));
  expect(byId(r, "flashcards-done")).toHaveLength(1);
});

it("si falla una nota, las demás se guardan y se dice cuál", async () => {
  const alert = jest.spyOn(require("react-native").Alert, "alert").mockImplementation(() => {});
  saveProposals.mockImplementation(async (_u, itemId, rows) => {
    if (itemId === "b") throw new Error("resinotes_flashcard_source_changed");
    return rows;
  });
  const r = await render({ folderId: "obs" });
  await press(r, "flashcards-folder-generate");
  await flush();
  await press(r, "flashcards-approve");
  await flush();
  expect(alert).toHaveBeenCalledWith("Se han guardado 3 tarjetas", expect.stringContaining("Preeclampsia"), expect.any(Array));
  expect(texts(r)).toMatch(/1 de 1 seleccionadas/);
});

it("un fragmento sin estructura: «Este fragmento necesita más contexto»", async () => {
  const r = await render({ itemId: "a", selectionHtml: "<p>Sulfato</p>" });
  expect(byId(r, "flashcards-needs_context")).toHaveLength(1);
  expect(texts(r)).toMatch(/Este fragmento necesita más contexto/);
  expect(texts(r)).toMatch(/Selecciona un apartado más completo/);
});

it("un fragmento con estructura solo da sus tarjetas", async () => {
  const r = await render({ itemId: "a", selectionHtml: "<p>Dosis: 4 g en 15 min</p>" });
  expect(texts(r)).toMatch(/1 tarjeta a partir del fragmento/);
});
