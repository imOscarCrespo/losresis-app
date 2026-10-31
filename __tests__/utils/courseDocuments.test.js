import { orderCourseDocuments } from "../../utils/courseDocuments";

const row = (kind) => ({ id: kind, kind, storage_path: `c1/${kind}/f.pdf`, file_name: `${kind}.pdf` });

describe("orderCourseDocuments", () => {
  it("con los tres PDFs los devuelve en orden y con su nombre", () => {
    const docs = orderCourseDocuments([row("review_material"), row("info"), row("program")]);
    expect(docs.map((d) => [d.kind, d.label])).toEqual([
      ["info", "Información del curso"],
      ["program", "Programa"],
      ["review_material", "Material para revisar"],
    ]);
  });

  it("con solo el programa, solo devuelve el programa", () => {
    expect(orderCourseDocuments([row("program")]).map((d) => d.label)).toEqual(["Programa"]);
  });

  it("sin PDFs no devuelve nada", () => {
    expect(orderCourseDocuments([])).toEqual([]);
    expect(orderCourseDocuments(null)).toEqual([]);
  });

  it("ignora tipos desconocidos y filas sin fichero", () => {
    expect(
      orderCourseDocuments([{ kind: "otro", storage_path: "x" }, { kind: "info", storage_path: null }])
    ).toEqual([]);
  });
});
