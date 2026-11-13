/**
 * Encuesta dinámica (Hospital de Manresa, 2026-11-13): el modal pinta las
 * preguntas del curso por tipo y solo deja enviar con las obligatorias.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("../../components/Icon", () => ({ Icon: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../components/KeyboardAwareScrollView", () => {
  const { View } = require("react-native");
  return { KeyboardAwareScrollView: ({ children }) => <View>{children}</View> };
});
jest.mock("../../components/KeyboardAwareTextInput", () => {
  const { TextInput } = require("react-native");
  return { KeyboardAwareTextInput: (props) => <TextInput {...props} /> };
});

const { CourseSurveyModal } = require("../../components/courses/CourseSurveyModal");

const QUESTIONS = [
  { id: "docentes", type: "rating", label: "Docentes", required: true },
  { id: "repetirias", type: "yes_no", label: "¿Repetirías?", required: true },
  { id: "mejoras", type: "text", label: "¿Qué mejorarías?", required: false },
];

// El nodo interactivo con ese testID (el que lleva onPress u onChangeText).
const byTestId = (root, id) =>
  root.find(
    (node) =>
      node.props.testID === id &&
      (node.props.onPress !== undefined || node.props.onChangeText !== undefined)
  );
const texts = (root) =>
  root
    .findAll((node) => typeof node.children?.[0] === "string")
    .map((node) => node.children.join(""));

const render = (props) => {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <CourseSurveyModal visible courseTitle="Curso" onClose={jest.fn()} {...props} />
    );
  });
  return tree;
};

describe("CourseSurveyModal con preguntas del curso", () => {
  it("pinta cada pregunta según su tipo y marca las opcionales", () => {
    const tree = render({ questions: QUESTIONS, onSubmit: jest.fn() });
    const shown = texts(tree.root);
    expect(shown).toEqual(
      expect.arrayContaining(["Docentes", "¿Repetirías?", "¿Qué mejorarías? (opcional)"])
    );
    expect(byTestId(tree.root, "survey-docentes-5")).toBeTruthy();
    expect(byTestId(tree.root, "survey-repetirias-no")).toBeTruthy();
    expect(byTestId(tree.root, "survey-mejoras")).toBeTruthy();
  });

  it("no envía hasta responder las obligatorias y manda { id: valor }", async () => {
    const onSubmit = jest.fn(() => Promise.resolve({ ok: true }));
    const tree = render({ questions: QUESTIONS, onSubmit });
    const submit = () => byTestId(tree.root, "survey-submit");

    expect(submit().props.disabled).toBe(true);
    act(() => byTestId(tree.root, "survey-docentes-4").props.onPress());
    expect(submit().props.disabled).toBe(true);
    act(() => byTestId(tree.root, "survey-repetirias-yes").props.onPress());
    act(() => byTestId(tree.root, "survey-mejoras").props.onChangeText("Más prácticas"));
    expect(submit().props.disabled).toBe(false);

    await act(async () => {
      await submit().props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith({
      docentes: 4,
      repetirias: true,
      mejoras: "Más prácticas",
    });
  });

  it("sin preguntas (base anterior) pinta la encuesta fija de siempre", () => {
    const tree = render({ onSubmit: jest.fn() });
    expect(byTestId(tree.root, "survey-overall_rating-5")).toBeTruthy();
    expect(byTestId(tree.root, "survey-would_recommend-yes")).toBeTruthy();
    expect(byTestId(tree.root, "survey-comments")).toBeTruthy();
    expect(texts(tree.root)).toContain("Comentarios (opcional)");
  });
});
