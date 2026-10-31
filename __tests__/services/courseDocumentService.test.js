// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder y la respuesta final ({ data, error }) la decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { response: { data: null, error: null } };
  ["from", "select"].forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.eq = jest.fn(() => Promise.resolve(builder.response));
  builder.createSignedUrl = jest.fn(() => Promise.resolve(builder.response));
  builder.storage = { from: jest.fn(() => builder) };
  return { supabase: builder };
});

const { supabase: mockBuilder } = jest.requireMock("../../config/supabase");

import { getCourseDocumentUrl, getCourseDocuments } from "../../services/courseDocumentService";

beforeEach(() => {
  jest.clearAllMocks();
  mockBuilder.response = { data: null, error: null };
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("getCourseDocuments", () => {
  it("lee los PDFs del curso y los ordena por hueco", async () => {
    mockBuilder.response = {
      data: [
        { id: "2", kind: "program", storage_path: "c1/program/b.pdf", file_name: "b.pdf" },
        { id: "1", kind: "info", storage_path: "c1/info/a.pdf", file_name: "a.pdf" },
      ],
      error: null,
    };
    const result = await getCourseDocuments("c1");
    expect(mockBuilder.from).toHaveBeenCalledWith("course_document");
    expect(mockBuilder.eq).toHaveBeenCalledWith("course_id", "c1");
    expect(result.success).toBe(true);
    expect(result.data.map((d) => d.label)).toEqual(["Información del curso", "Programa"]);
  });

  it("si la consulta falla (sin conexión) no da ningún PDF por disponible", async () => {
    mockBuilder.response = { data: null, error: { message: "Network request failed" } };
    expect(await getCourseDocuments("c1")).toEqual({ success: false, data: [] });
  });

  it("sin curso no consulta", async () => {
    expect(await getCourseDocuments(null)).toEqual({ success: true, data: [] });
    expect(mockBuilder.from).not.toHaveBeenCalled();
  });
});

describe("getCourseDocumentUrl", () => {
  it("firma una URL temporal del bucket privado", async () => {
    mockBuilder.response = { data: { signedUrl: "https://x/signed" }, error: null };
    expect(await getCourseDocumentUrl("c1/info/a.pdf")).toBe("https://x/signed");
    expect(mockBuilder.storage.from).toHaveBeenCalledWith("course-documents");
    expect(mockBuilder.createSignedUrl).toHaveBeenCalledWith("c1/info/a.pdf", 300);
  });

  it("si se deniega (sin acceso) devuelve null", async () => {
    mockBuilder.response = { data: null, error: { message: "Object not found" } };
    expect(await getCourseDocumentUrl("c1/info/a.pdf")).toBeNull();
  });
});
