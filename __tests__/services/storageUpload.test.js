// Regresión: el FormData de React Native no tiene has(), y storage-js 2.8x lo
// llama si el cuerpo es un FormData. Ninguna subida debe pasar un FormData.
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri) => ({
    arrayBuffer: jest.fn(() => Promise.resolve(new TextEncoder().encode(`bytes:${uri}`).buffer)),
  })),
}));

jest.mock("../../config/supabase", () => {
  const bucket = { upload: jest.fn(() => Promise.resolve({ data: { path: "p" }, error: null })) };
  return { supabase: { storage: { from: jest.fn(() => bucket) }, __bucket: bucket } };
});

const fs = require("fs");
const path = require("path");
const { supabase } = jest.requireMock("../../config/supabase");
import { uploadLocalFile } from "../../services/storageUpload";

beforeEach(() => jest.clearAllMocks());

describe("uploadLocalFile", () => {
  it("sube los bytes del fichero (no un FormData) con su content-type", async () => {
    const result = await uploadLocalFile("resinotes", "u1/i1/a.pdf", "file:///a.pdf", {
      contentType: "application/pdf",
    });
    expect(result).toEqual({ data: { path: "p" }, error: null });
    expect(supabase.storage.from).toHaveBeenCalledWith("resinotes");
    const [p, body, options] = supabase.__bucket.upload.mock.calls[0];
    expect(p).toBe("u1/i1/a.pdf");
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(body).not.toBeInstanceOf(FormData);
    expect(options).toEqual({ contentType: "application/pdf", upsert: false });
  });

  it("pasa upsert y cacheControl si se piden", async () => {
    await uploadLocalFile("roommate-avatar", "u1/a.jpg", "file:///a.jpg", {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });
    expect(supabase.__bucket.upload.mock.calls[0][2]).toEqual({
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });
  });
});

describe("ningún servicio sube un FormData a storage", () => {
  it("services/*.js no construyen FormData", () => {
    const dir = path.join(__dirname, "../../services");
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".js"))
      .filter((f) => /new FormData\(/.test(fs.readFileSync(path.join(dir, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
