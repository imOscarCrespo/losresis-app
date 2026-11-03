/**
 * «Crear procedimiento personalizado»: el campo está al final de la lista del
 * modal y el teclado lo tapaba mientras se escribía. Al enfocarlo con el
 * teclado abierto, la lista tiene que desplazarse para dejarlo a la vista.
 */
import React from "react";
import { Keyboard, Platform, ScrollView } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("../../components/Icon", () => ({ Icon: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const { ProcedurePickerModal } = require("../../components/shiftDebrief/ProcedurePickerModal");

const SCREEN_HEIGHT = 800;
const KEYBOARD_HEIGHT = 340;

const CATALOG = Array.from({ length: 12 }, (_, i) => ({
  node_id: `n${i}`,
  name: `Procedimiento ${i}`,
  area_name: "Sala de partos",
}));
const AREAS = [
  { id: "a1", name: "Sala de partos" },
  { id: "a2", name: "Quirófano" },
];

// El ScrollView ocupa toda la pantalla; el campo del personalizado queda abajo,
// justo donde aparece el teclado (como en la captura del usuario). El mock de
// ScrollView de jest nunca responde a measureInWindow: se parchea su prototipo.
let scrollTo;
const createNodeMock = (element) =>
  element.props.testID === "procedure-custom-name"
    ? { measureInWindow: (cb) => cb(16, 600, 360, 46), focus: jest.fn() }
    : null;

const flush = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {});
};

describe("ProcedurePickerModal · teclado sobre el campo personalizado", () => {
  let keyboardListeners;

  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(ScrollView.prototype, "measureInWindow")
      .mockImplementation((cb) => cb(0, 0, 400, SCREEN_HEIGHT));
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

  const render = () => {
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <ProcedurePickerModal
          visible
          catalog={CATALOG}
          areas={AREAS}
          canAddToLibro
          onPick={jest.fn()}
          onCreate={jest.fn()}
          onClose={jest.fn()}
        />,
        { createNodeMock },
      );
    });
    return renderer;
  };

  it("el campo vive en un ScrollView que se ajusta al teclado", () => {
    const renderer = render();
    const input = renderer.root.findByProps({ testID: "procedure-custom-name" });
    let node = input.parent;
    while (node && node.type !== ScrollView) node = node.parent;
    expect(node).toBeTruthy();
    if (Platform.OS === "ios") {
      expect(node.props.automaticallyAdjustKeyboardInsets).toBe(true);
    }
  });

  it("al enfocarlo con el teclado abierto desplaza la lista para que se vea", async () => {
    const renderer = render();
    const input = renderer.root
      .findAll((n) => n.props.testID === "procedure-custom-name" && n.props.onFocus)
      .at(0);

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    await act(async () => {
      keyboardListeners[showEvent]({ endCoordinates: { height: KEYBOARD_HEIGHT } });
    });
    await act(async () => {
      input.props.onFocus({});
    });
    await flush(400);

    expect(scrollTo).toHaveBeenCalled();
    // Campo en y=600..646; zona visible hasta 800-340=460. Hay que subir al
    // menos 646 + margen - 460 px.
    const { y } = scrollTo.mock.calls.at(-1)[0];
    expect(y).toBeGreaterThanOrEqual(646 - (SCREEN_HEIGHT - KEYBOARD_HEIGHT));
  });
});
