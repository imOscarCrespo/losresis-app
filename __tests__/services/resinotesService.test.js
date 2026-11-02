// Supabase se mockea en la frontera: cada llamada encadenada devuelve el mismo
// builder; las respuestas salen en orden de una cola que decide cada test.
jest.mock("../../config/supabase", () => {
  const builder = { queue: [], calls: [] };
  const next = () => Promise.resolve(builder.queue.length ? builder.queue.shift() : { data: null, error: null });
  ["from", "select", "eq", "is", "not", "in", "order", "limit", "insert", "update", "delete"].forEach((m) => {
    builder[m] = jest.fn((...args) => {
      builder.calls.push([m, ...args]);
      return builder;
    });
  });
  builder.then = (resolve, reject) => next().then(resolve, reject);
  builder.single = jest.fn(next);
  builder.maybeSingle = jest.fn(next);
  builder.rpc = jest.fn((...args) => {
    builder.calls.push(["rpc", ...args]);
    return next();
  });
  const bucket = {
    upload: jest.fn((...args) => {
      builder.calls.push(["upload", ...args]);
      return next();
    }),
    remove: jest.fn((...args) => {
      builder.calls.push(["remove", ...args]);
      return next();
    }),
    createSignedUrl: jest.fn(() => next()),
    createSignedUrls: jest.fn(() => next()),
  };
  builder.storage = { from: jest.fn(() => bucket) };
  return { supabase: builder };
});

const { supabase: mock } = jest.requireMock("../../config/supabase");

import {
  deleteFolderForever,
  friendlyError,
  getSignedUrls,
  saveNote,
  searchLibrary,
  trashFolder,
  uploadFileItem,
  createLink,
  moveItems,
  setItemsFavorite,
  trashItems,
  trashFolders,
  reorder,
  saveLastPage,
  loadExportData,
} from "../../services/resinotesService";

const queue = (...responses) => mock.queue.push(...responses);
const callsOf = (name) => mock.calls.filter((c) => c[0] === name);

beforeEach(() => {
  jest.clearAllMocks();
  mock.queue = [];
  mock.calls = [];
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveNote", () => {
  it("guarda las imágenes como referencia estable y el texto buscable", async () => {
    queue({ data: { id: "n1" }, error: null });
    await saveNote("n1", {
      title: "",
      html: '<h1>Preeclampsia</h1><img src="https://x.supabase.co/storage/v1/object/sign/resinotes/u1/n1/a.jpg?token=t">',
    });
    const payload = callsOf("update")[0][1];
    expect(payload.content).toBe('<h1>Preeclampsia</h1><img src="resinotes://u1/n1/a.jpg">');
    expect(payload.content_text).toBe("Preeclampsia");
    expect(payload.title).toBe("Preeclampsia");
  });

  it("propaga el error para que el editor enseñe «Error al guardar»", async () => {
    queue({ data: null, error: { message: "boom" } });
    await expect(saveNote("n1", { title: "a", html: "<p>b</p>" })).rejects.toThrow("boom");
  });
});

describe("uploadFileItem", () => {
  const pdf = { uri: "file:///guia.pdf", name: "Guía SEGO.pdf", mimeType: "application/pdf", size: 1000 };

  it("crea el elemento, sube el fichero a <user>/<item>/ y apunta el adjunto", async () => {
    queue(
      { data: { id: "i1", type: "pdf" }, error: null },
      { data: { path: "u1/i1/x.pdf" }, error: null },
      { data: { id: "a1" }, error: null }
    );
    const item = await uploadFileItem("u1", { folderId: "f1", file: pdf });
    expect(item.id).toBe("i1");
    expect(callsOf("insert")[0][1]).toMatchObject({ user_id: "u1", folder_id: "f1", type: "pdf", title: "Guía SEGO" });
    expect(callsOf("upload")[0][1]).toMatch(/^u1\/i1\/.+\.pdf$/);
    expect(callsOf("insert")[1][1]).toMatchObject({ storage_key: "u1/i1/x.pdf", filename: "Guía SEGO.pdf" });
  });

  it("si falla la subida borra el elemento vacío", async () => {
    queue(
      { data: { id: "i1", type: "pdf" }, error: null },
      { data: null, error: { message: "upload failed" } },
      { data: null, error: null }
    );
    await expect(uploadFileItem("u1", { file: pdf })).rejects.toThrow("upload failed");
    expect(callsOf("delete")).toHaveLength(1);
  });

  it("rechaza sin red un fichero incompatible o demasiado grande", async () => {
    await expect(
      uploadFileItem("u1", { file: { uri: "x", mimeType: "application/zip", size: 1 } })
    ).rejects.toThrow(/incompatible/);
    await expect(
      uploadFileItem("u1", { file: { ...pdf, size: 21 * 1024 * 1024 } })
    ).rejects.toThrow(/20 MB/);
    expect(mock.calls).toHaveLength(0);
  });
});

describe("createLink", () => {
  it("normaliza la URL y usa el dominio de título", async () => {
    queue({ data: { id: "l1" }, error: null });
    await createLink("u1", { url: "www.sego.es/guias" });
    expect(callsOf("insert")[0][1]).toMatchObject({ type: "link", url: "https://www.sego.es/guias", title: "sego.es" });
  });

  it("no guarda algo que no es un enlace web", async () => {
    await expect(createLink("u1", { url: "javascript:alert(1)" })).rejects.toThrow("INVALID_URL");
  });
});

describe("papelera", () => {
  it("manda la carpeta a la papelera con la RPC", async () => {
    queue({ data: null, error: null });
    await trashFolder("f1");
    expect(callsOf("rpc")[0]).toEqual(["rpc", "resinotes_trash_folder", { p_folder_id: "f1" }]);
  });

  it("al borrar para siempre quita primero los ficheros y después la carpeta", async () => {
    queue({ data: ["u1/i1/a.pdf", "u1/i2/b.jpg"], error: null }, { data: [], error: null }, { data: null, error: null });
    await deleteFolderForever("f1");
    const order = mock.calls.map((c) => c[0]).filter((c) => ["rpc", "remove", "delete"].includes(c));
    expect(order).toEqual(["rpc", "remove", "delete"]);
    expect(callsOf("remove")[0][1]).toEqual(["u1/i1/a.pdf", "u1/i2/b.jpg"]);
  });

  it("si no se pueden borrar los ficheros no borra las filas", async () => {
    queue({ data: ["u1/i1/a.pdf"], error: null }, { data: null, error: { message: "denied" } });
    await expect(deleteFolderForever("f1")).rejects.toThrow("denied");
    expect(callsOf("delete")).toHaveLength(0);
  });
});

describe("búsqueda", () => {
  it("no busca con menos de 2 letras", async () => {
    expect(await searchLibrary("a")).toEqual([]);
    expect(callsOf("rpc")).toHaveLength(0);
  });

  it("pasa el filtro de tipo y favoritos", async () => {
    queue({ data: [{ id: "x" }], error: null });
    await searchLibrary(" rctg ", { type: "pdf", favoritesOnly: true });
    expect(callsOf("rpc")[0][2]).toEqual({ p_query: "rctg", p_type: "pdf", p_favorites_only: true, p_limit: 50 });
  });
});

describe("utilidades", () => {
  it("mapea URLs firmadas por clave e ignora errores", async () => {
    queue({ data: [{ path: "k1", signedUrl: "https://s/1" }, { path: "k2", error: "x" }], error: null });
    expect(await getSignedUrls(["k1", "k2", "k1"])).toEqual({ k1: "https://s/1" });
    queue({ data: null, error: { message: "x" } });
    expect(await getSignedUrls(["k1"])).toEqual({});
  });

  it("traduce el ciclo de carpetas a un mensaje claro", () => {
    expect(friendlyError(new Error("resinotes_folder_cycle"))).toMatch(/dentro de sí misma/);
    expect(friendlyError(new Error("Network request failed"))).toMatch(/Sin conexión/);
  });
});

describe("varios a la vez", () => {
  it("mueve, marca favoritos y manda a la papelera en una llamada", async () => {
    queue({ error: null }, { error: null }, { error: null });
    await moveItems(["a", "b", "a"], "obs");
    await setItemsFavorite(["a"], true);
    await trashItems(["b"]);
    const updates = callsOf("update").map((c) => c[1]);
    expect(updates[0]).toEqual({ folder_id: "obs" });
    expect(updates[1]).toEqual({ is_favorite: true });
    expect(updates[2].deleted_at).toEqual(expect.any(String));
    expect(callsOf("in")[0]).toEqual(["in", "id", ["a", "b"]]);
  });

  it("si falla, lanza el error", async () => {
    queue({ error: { message: "boom" } });
    await expect(moveItems(["a"], null)).rejects.toThrow("boom");
  });

  it("las carpetas van de una en una y un fallo no corta el lote", async () => {
    queue({ error: { message: "x" } }, { error: null });
    const result = await trashFolders(["f1", "f2"]);
    expect(callsOf("rpc").map((c) => c[2])).toEqual([{ p_folder_id: "f1" }, { p_folder_id: "f2" }]);
    expect(result.ok).toBe(1);
    expect(result.error.message).toBe("x");
  });
});

describe("orden manual y última página", () => {
  it("guarda el orden con su RPC", async () => {
    queue({ error: null });
    await reorder("item", ["a", "b"]);
    expect(callsOf("rpc")[0].slice(1)).toEqual(["resinotes_reorder", { p_kind: "item", p_ids: ["a", "b"] }]);
  });

  it("no llama sin ids y lanza si falla", async () => {
    await reorder("item", []);
    expect(callsOf("rpc")).toHaveLength(0);
    queue({ error: { message: "nope" } });
    await expect(reorder("folder", ["x"])).rejects.toThrow("nope");
  });

  it("la última página se guarda entera y un fallo no molesta", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    queue({ error: null });
    await saveLastPage("p1", 12.7);
    expect(callsOf("update")[0][1]).toEqual({ last_page: 12 });
    await saveLastPage("p1", 0);
    expect(callsOf("update")).toHaveLength(1);
    queue({ error: { message: "x" } });
    await expect(saveLastPage("p1", 3)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe("datos para exportar", () => {
  it("una carpeta pide sus elementos por trozos de 100 carpetas", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `f${i}`);
    queue({ data: [{ id: "f0" }], error: null }, { data: [{ id: "n1" }], error: null }, { data: [{ id: "n2" }], error: null });
    const data = await loadExportData("u1", { folderIds: ids });
    expect(data.items.map((i) => i.id)).toEqual(["n1", "n2"]);
    const ins = callsOf("in");
    expect(ins[0][2]).toHaveLength(100);
    expect(ins[1][2]).toHaveLength(50);
  });

  it("si falla, lanza el error", async () => {
    queue({ data: [], error: null }, { data: null, error: { message: "down" } });
    await expect(loadExportData("u1")).rejects.toThrow("down");
  });
});
