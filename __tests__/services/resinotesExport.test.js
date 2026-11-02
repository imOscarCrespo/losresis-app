import { strFromU8, unzipSync } from "fflate";

jest.mock("../../services/resinotesService", () => ({
  getSignedUrls: jest.fn(),
  loadExportData: jest.fn(),
}));

import { planStorageKeys, writeExportZip } from "../../services/resinotesExport";
import { buildExportPlan } from "../../utils/resinotes";

// E/S en memoria: el ZIP se va escribiendo por trozos y las «descargas» salen
// de un diccionario url → bytes.
const memoryIo = (files) => {
  const chunks = [];
  let closed = false;
  return {
    io: {
      createOutput: () => ({ write: (b) => chunks.push(b), close: () => (closed = true) }),
      download: async (url) => {
        if (!files[url]) throw new Error("404");
        let offset = 0;
        const bytes = files[url];
        return {
          read: (n) => {
            const out = bytes.subarray(offset, offset + n);
            offset += out.length;
            return out;
          },
          cleanup: jest.fn(),
        };
      },
    },
    unzip: () => {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Uint8Array(total);
      let o = 0;
      chunks.forEach((c) => {
        all.set(c, o);
        o += c.length;
      });
      return unzipSync(all);
    },
    isClosed: () => closed,
  };
};

const bigPdf = new Uint8Array(1300 * 1024).map((_, i) => i % 251);

const folders = [
  { id: "obs", parent_id: null, name: "Obstetricia", sort_order: 0 },
  { id: "vac", parent_id: "obs", name: "Vacía", sort_order: 0 },
];
const items = [
  {
    id: "n1",
    folder_id: "obs",
    type: "note",
    title: "Preeclampsia",
    content: '<p>TA ≥ 160/110</p><img src="resinotes://u/n1/a.jpg"><img src="resinotes://u/n1/missing.jpg">',
    resinotes_attachments: [{ storage_key: "u/n1/a.jpg", filename: "Esquema HELLP.jpg", mime_type: "image/jpeg" }],
  },
  {
    id: "p1",
    folder_id: "obs",
    type: "pdf",
    title: "Guía",
    resinotes_attachments: [{ storage_key: "u/p1/g.pdf", filename: "guia.pdf", mime_type: "application/pdf" }],
  },
  {
    id: "p2",
    folder_id: "obs",
    type: "pdf",
    title: "Se perdió",
    resinotes_attachments: [{ storage_key: "u/p2/x.pdf", filename: "x.pdf", mime_type: "application/pdf" }],
  },
  { id: "l1", folder_id: "obs", type: "link", title: "UpToDate", url: "https://uptodate.com" },
];

describe("ZIP de una carpeta", () => {
  it("conserva estructura, ficheros originales y notas con sus imágenes", async () => {
    const entries = buildExportPlan({ folders, items, rootFolderId: "obs" });
    expect(planStorageKeys(entries).sort()).toEqual(["u/n1/a.jpg", "u/n1/missing.jpg", "u/p1/g.pdf", "u/p2/x.pdf"]);

    const mem = memoryIo({ "https://s/a": new Uint8Array([1, 2, 3]), "https://s/g": bigPdf });
    const progress = jest.fn();
    const { failed } = await writeExportZip({
      entries,
      urlsByKey: { "u/n1/a.jpg": "https://s/a", "u/p1/g.pdf": "https://s/g", "u/p2/x.pdf": "https://s/x" },
      io: mem.io,
      onProgress: progress,
    });

    const zip = mem.unzip();
    expect(Object.keys(zip).sort()).toEqual([
      "Obstetricia/",
      "Obstetricia/Guía.pdf",
      "Obstetricia/Preeclampsia.html",
      "Obstetricia/Preeclampsia_archivos/Esquema HELLP.jpg",
      "Obstetricia/UpToDate (enlace).html",
      "Obstetricia/Vacía/",
    ]);
    expect(zip["Obstetricia/Guía.pdf"]).toEqual(bigPdf);
    expect(Array.from(zip["Obstetricia/Preeclampsia_archivos/Esquema HELLP.jpg"])).toEqual([1, 2, 3]);

    const note = strFromU8(zip["Obstetricia/Preeclampsia.html"]);
    expect(note).toContain("TA ≥ 160/110");
    expect(note).toContain('src="Preeclampsia_archivos/Esquema%20HELLP.jpg"');
    expect(note).not.toContain("resinotes://");
    expect(strFromU8(zip["Obstetricia/UpToDate (enlace).html"])).toContain("https://uptodate.com");

    // Lo que no se pudo descargar se avisa y no rompe el ZIP.
    expect(failed).toEqual(["Preeclampsia · missing.jpg", "Se perdió"]);
    expect(progress).toHaveBeenLastCalledWith(4, 4);
    expect(mem.isClosed()).toBe(true);
  });

  it("un fichero vacío también entra", async () => {
    const entries = buildExportPlan({ folders, items: [items[1]], rootFolderId: "obs" });
    const mem = memoryIo({ "https://s/g": new Uint8Array(0) });
    await writeExportZip({ entries, urlsByKey: { "u/p1/g.pdf": "https://s/g" }, io: mem.io });
    expect(mem.unzip()["Obstetricia/Guía.pdf"]).toHaveLength(0);
  });

  it("si falla la escritura, cierra el fichero y lanza el error", async () => {
    const entries = buildExportPlan({ folders, items: [items[3]], rootFolderId: "obs" });
    let closed = false;
    const io = {
      createOutput: () => ({
        write: () => {
          throw new Error("disk full");
        },
        close: () => (closed = true),
      }),
      download: jest.fn(),
    };
    await expect(writeExportZip({ entries, urlsByKey: {}, io })).rejects.toThrow("disk full");
    expect(closed).toBe(true);
  });
});
