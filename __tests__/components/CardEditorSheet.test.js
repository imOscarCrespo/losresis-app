/**
 * «Crear pregunta» (ClickUp 124b4z9w5nh; bug del teclado en 1.0.97).
 *
 * La hoja sube con el teclado (KeyboardAvoidingView), así que su ScrollView ya
 * queda ENCIMA del teclado. El bug: el scroll volvía a descontar la altura del
 * teclado (y iOS añadía su inset), se pasaba de largo y el principio de la
 * pregunta quedaba escondido bajo la cabecera de la hoja. Además, la respuesta
 * llega rellena con el texto seleccionado y las dos son obligatorias.
 */
import React from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("../../components/Icon", () => ({ Icon: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const { CardEditorSheet } = require("../../components/resinotes/flashcards/FlashcardParts");

const SCREEN_HEIGHT = 800;
const KEYBOARD_HEIGHT = 340;
// La hoja ya subida: su zona con scroll va de y=100 a y=460 (= 800 - 340, justo encima del teclado).
const SCROLL_FRAME = { x: 0, y: 100, width: 400, height: SCREEN_HEIGHT - KEYBOARD_HEIGHT - 100 };
const SPACING = 24;

let scrollTo;
let frames;

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
    frames = {
      "flashcard-editor-question": { x: 16, y: 140, width: 360, height: 52 },
      "flashcard-editor-answer": { x: 16, y: 420, width: 360, height: 110 },
    };
    // En jest, TextInput y ScrollView comparten este measureInWindow: cada nodo responde
    // con su marco según su testID (los campos) o el de la zona con scroll de la hoja.
    jest.spyOn(ScrollView.prototype, "measureInWindow").mockImplementation(function measure(cb) {
      const frame = frames[this.props?.testID] || SCROLL_FRAME;
      cb(frame.x, frame.y, frame.width, frame.height);
    });
    jest.spyOn(TextInput.prototype, "isFocused").mockReturnValue(true);
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
        />
      );
    });
    return renderer;
  };

  const input = (renderer, testID) =>
    renderer.root.findAll((n) => n.props.testID === testID && n.props.onFocus).at(0);
  const answerInput = (renderer) => input(renderer, "flashcard-editor-answer");
  const questionInput = (renderer) => input(renderer, "flashcard-editor-question");
  const scrollViewOf = (node) => {
    let n = node.parent;
    while (n && n.type !== ScrollView) n = n.parent;
    return n;
  };
  const openKeyboard = async () => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    await act(async () => {
      keyboardListeners[showEvent]({ endCoordinates: { height: KEYBOARD_HEIGHT } });
    });
  };
  const flatStyle = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

  it("la hoja sube con el teclado y su scroll no lo vuelve a compensar", () => {
    const renderer = render();
    const kav = renderer.root.findByType(KeyboardAvoidingView);
    if (Platform.OS === "ios") expect(kav.props.behavior).toBe("padding");
    const scroll = scrollViewOf(answerInput(renderer));
    expect(scroll).toBeTruthy();
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(false);
    // El cuerpo encoge al hueco libre: «Guardar» sigue a la vista encima del teclado.
    expect(flatStyle(scroll.props.style).flexShrink).toBe(1);
  });

  it("al enfocar la respuesta con el teclado abierto desplaza lo justo, sin pasarse", async () => {
    const renderer = render();
    await openKeyboard();
    await act(async () => {
      answerInput(renderer).props.onFocus({});
    });
    await flush(400);
    expect(scrollTo).toHaveBeenCalled();
    const { y } = scrollTo.mock.calls.at(-1)[0];
    const answer = frames["flashcard-editor-answer"];
    // Justo lo necesario para que su borde inferior quede dentro de la hoja. Con el bug se
    // descontaba además el teclado (+340) y la pregunta desaparecía bajo la cabecera.
    expect(y).toBe(answer.y + answer.height + SPACING - (SCROLL_FRAME.y + SCROLL_FRAME.height));
  });

  it("al volver a la pregunta, su principio queda a la vista bajo la cabecera", async () => {
    const renderer = render();
    await openKeyboard();
    const scroll = scrollViewOf(questionInput(renderer));
    await act(async () => {
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } });
    });
    frames["flashcard-editor-question"] = { x: 16, y: 60, width: 360, height: 132 };
    await act(async () => {
      questionInput(renderer).props.onFocus({});
    });
    await flush(400);
    const { y } = scrollTo.mock.calls.at(-1)[0];
    expect(y).toBe(200 - (SCROLL_FRAME.y - (60 - SPACING)));
  });

  it("los campos tienen altura máxima: un texto largo se desplaza dentro del campo", () => {
    const renderer = render();
    expect(flatStyle(questionInput(renderer).props.style).maxHeight).toBeGreaterThan(0);
    expect(flatStyle(answerInput(renderer).props.style).maxHeight).toBeGreaterThan(0);
  });

  it("al crecer el campo mientras se escribe, se recoloca para que el cursor no quede bajo el teclado", async () => {
    const renderer = render();
    await openKeyboard();
    await act(async () => {
      answerInput(renderer).props.onFocus({});
    });
    await flush(400);
    scrollTo.mockClear();
    frames["flashcard-editor-answer"] = { x: 16, y: 420, width: 360, height: 200 };
    await act(async () => {
      answerInput(renderer).props.onContentSizeChange({ nativeEvent: { contentSize: { height: 200 } } });
    });
    await flush(50);
    expect(scrollTo).toHaveBeenCalled();
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
