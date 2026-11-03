/**
 * «Crear pregunta» (ClickUp 124b4z9w5nh): la respuesta está en la mitad baja
 * de la hoja, justo donde sale el teclado. Al enfocarla con el teclado
 * abierto, la hoja tiene que desplazarse para dejarla a la vista. Además, la
 * respuesta llega rellena con el texto seleccionado y las dos son obligatorias.
 */
import React from "react";
import { Keyboard, Platform, ScrollView } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("../../components/Icon", () => ({ Icon: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const { CardEditorSheet } = require("../../components/resinotes/flashcards/FlashcardParts");

const SCREEN_HEIGHT = 800;
const KEYBOARD_HEIGHT = 340;

let scrollTo;
const createNodeMock = (element) =>
  element.props.testID === "flashcard-editor-answer"
    ? { measureInWindow: (cb) => cb(16, 620, 360, 110), focus: jest.fn() }
    : null;

const flush = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {});
};

describe("CardEditorSheet · «Crear pregunta»", () => {
  let keyboardListeners;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(ScrollView.prototype, "measureInWindow").mockImplementation((cb) => cb(0, 0, 400, SCREEN_HEIGHT));
    scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => {});
    keyboardListeners = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation((event, handler) => {
      keyboardListeners[event] = handler;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const render = (props = {}) => {
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <CardEditorSheet
          visible
          title="Crear pregunta"
          initial={{ question: "", answer: "Vitamina E, ácido hialurónico y caléndula" }}
          onSubmit={jest.fn()}
          onClose={jest.fn()}
          {...props}
        />,
        { createNodeMock }
      );
    });
    return renderer;
  };

  const answerInput = (renderer) =>
    renderer.root.findAll((n) => n.props.testID === "flashcard-editor-answer" && n.props.onFocus).at(0);

  it("la respuesta vive en un ScrollView que se ajusta al teclado", () => {
    const renderer = render();
    let node = answerInput(renderer).parent;
    while (node && node.type !== ScrollView) node = node.parent;
    expect(node).toBeTruthy();
    if (Platform.OS === "ios") expect(node.props.automaticallyAdjustKeyboardInsets).toBe(true);
  });

  it("al enfocarla con el teclado abierto desplaza la hoja para que se vea", async () => {
    const renderer = render();
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    await act(async () => {
      keyboardListeners[showEvent]({ endCoordinates: { height: KEYBOARD_HEIGHT } });
    });
    await act(async () => {
      answerInput(renderer).props.onFocus({});
    });
    await flush(400);
    expect(scrollTo).toHaveBeenCalled();
    const { y } = scrollTo.mock.calls.at(-1)[0];
    expect(y).toBeGreaterThanOrEqual(730 - (SCREEN_HEIGHT - KEYBOARD_HEIGHT));
  });

  it("la respuesta llega con el texto seleccionado y no se guarda sin pregunta", async () => {
    const onSubmit = jest.fn();
    const renderer = render({ onSubmit });
    expect(answerInput(renderer).props.value).toBe("Vitamina E, ácido hialurónico y caléndula");
    const save = renderer.root.findAll((n) => n.props.testID === "flashcard-editor-save" && n.props.onPress).at(0);
    expect(save.props.disabled).toBe(true);
    await act(async () => {
      save.props.onPress();
    });
    expect(onSubmit).not.toHaveBeenCalled();

    const question = renderer.root.findAll((n) => n.props.testID === "flashcard-editor-question" && n.props.onChangeText).at(0);
    await act(async () => {
      question.props.onChangeText("¿Qué contiene Gixoderm?");
    });
    const saveNow = renderer.root.findAll((n) => n.props.testID === "flashcard-editor-save" && n.props.onPress).at(0);
    await act(async () => {
      saveNow.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith({
      question: "¿Qué contiene Gixoderm?",
      answer: "Vitamina E, ácido hialurónico y caléndula",
    });
  });

  it("si falla el guardado, enseña el error y conserva lo escrito", async () => {
    const onSubmit = jest.fn(() => Promise.reject(Object.assign(new Error("x"), { userMessage: "Sin conexión." })));
    const renderer = render({ onSubmit, initial: { question: "¿Dosis?", answer: "10 UI" } });
    const save = renderer.root.findAll((n) => n.props.testID === "flashcard-editor-save" && n.props.onPress).at(0);
    await act(async () => {
      save.props.onPress();
    });
    expect(renderer.root.findAll((n) => n.props.children === "Sin conexión.").length).toBeGreaterThan(0);
    expect(answerInput(renderer).props.value).toBe("10 UI");
  });
});
