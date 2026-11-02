import {
  canMoveFolder,
  childFolders,
  countItemsByFolder,
  deriveNoteTitle,
  descendantIds,
  favoriteItems,
  folderPath,
  formatElementCount,
  formatShortDate,
  htmlToPlainText,
  linkTitleFromUrl,
  normalizeLinkUrl,
  recentItems,
  sortFolderItems,
  storedImageKeys,
  toEditorHtml,
  toStoredHtml,
  unclassifiedItems,
  validateUpload,
} from "../../utils/resinotes";

// Obstetricia > Paritorio > Monitorización fetal, y Ginecología aparte.
const folders = [
  { id: "obs", parent_id: null, name: "Obstetricia", sort_order: 0 },
  { id: "par", parent_id: "obs", name: "Paritorio", sort_order: 0 },
  { id: "mon", parent_id: "par", name: "Monitorización fetal", sort_order: 0 },
  { id: "gin", parent_id: null, name: "Ginecología", sort_order: 0 },
  { id: "old", parent_id: null, name: "Borrada", deleted_at: "2026-11-01T00:00:00Z" },
];

describe("árbol de carpetas", () => {
  it("lista las carpetas raíz vivas en orden alfabético", () => {
    expect(childFolders(folders, null).map((f) => f.id)).toEqual(["gin", "obs"]);
    expect(childFolders(folders, "obs").map((f) => f.id)).toEqual(["par"]);
  });

  it("encuentra todas las descendientes", () => {
    expect([...descendantIds(folders, "obs")].sort()).toEqual(["mon", "par"]);
    expect(descendantIds(folders, "mon").size).toBe(0);
  });

  it("no deja mover una carpeta dentro de sí misma ni de una descendiente", () => {
    expect(canMoveFolder(folders, "obs", "obs")).toBe(false);
    expect(canMoveFolder(folders, "obs", "mon")).toBe(false);
    expect(canMoveFolder(folders, "mon", "gin")).toBe(true);
    expect(canMoveFolder(folders, "mon", null)).toBe(true);
  });

  it("construye la ruta Obstetricia > Paritorio > Monitorización fetal", () => {
    expect(folderPath(folders, "mon").map((f) => f.name)).toEqual([
      "Obstetricia",
      "Paritorio",
      "Monitorización fetal",
    ]);
  });

  it("no se cuelga con un ciclo en los datos", () => {
    const loop = [
      { id: "a", parent_id: "b", name: "A" },
      { id: "b", parent_id: "a", name: "B" },
    ];
    expect(folderPath(loop, "a")).toHaveLength(2);
    expect(descendantIds(loop, "a").size).toBe(2);
  });
});

describe("contadores", () => {
  it("cuenta los elementos de la carpeta y de sus subcarpetas, sin los de la papelera", () => {
    const items = [
      { id: "1", folder_id: "obs" },
      { id: "2", folder_id: "mon" },
      { id: "3", folder_id: "mon", deleted_at: "2026-11-01" },
      { id: "4", folder_id: null },
    ];
    const counts = countItemsByFolder(folders, items);
    expect(counts.obs).toBe(2);
    expect(counts.par).toBe(1);
    expect(counts.gin).toBe(0);
    expect(counts.old).toBeUndefined();
  });

  it("habla de elementos en singular y plural", () => {
    expect(formatElementCount(1)).toBe("1 elemento");
    expect(formatElementCount(42)).toBe("42 elementos");
  });
});

describe("accesos rápidos", () => {
  const items = [
    { id: "a", folder_id: "obs", updated_at: "2026-11-01T10:00:00Z", is_favorite: true },
    { id: "b", folder_id: null, updated_at: "2026-10-01T10:00:00Z", last_opened_at: "2026-11-02T09:00:00Z" },
    { id: "c", folder_id: null, updated_at: "2026-11-02T08:00:00Z", is_pinned: true },
    { id: "d", folder_id: null, updated_at: "2026-11-02T11:00:00Z" },
  ];

  it("fija arriba y después ordena por última edición", () => {
    expect(sortFolderItems(items).map((i) => i.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("Recientes mezcla abiertos y editados", () => {
    expect(recentItems(items).map((i) => i.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("Favoritos y Sin clasificar", () => {
    expect(favoriteItems(items).map((i) => i.id)).toEqual(["a"]);
    expect(unclassifiedItems(items).map((i) => i.id)).toEqual(["c", "d", "b"]);
  });
});

describe("texto de las notas", () => {
  it("saca el texto buscable del HTML separando bloques", () => {
    const html =
      "<h1>Preeclampsia</h1><p>TA &gt; 140/90 &amp; proteinuria</p><ul><li>HELLP</li><li>Eclampsia</li></ul><script>alert(1)</script>";
    expect(htmlToPlainText(html)).toBe("Preeclampsia\nTA > 140/90 & proteinuria\nHELLP\nEclampsia");
  });

  it("titula una nota sin título con su primera línea", () => {
    expect(deriveNoteTitle("", "Preeclampsia\nDefinición")).toBe("Preeclampsia");
    expect(deriveNoteTitle("  ", "")).toBe("Nota sin título");
    expect(deriveNoteTitle("Mi título", "x")).toBe("Mi título");
  });
});

describe("imágenes dentro de una nota", () => {
  const signed =
    "https://abc.supabase.co/storage/v1/object/sign/resinotes/u1/n1/123-ab.jpg?token=eyJ.x-y";

  it("guarda una referencia estable en vez de la URL firmada", () => {
    const stored = toStoredHtml(`<p>a</p><img src="${signed}">`);
    expect(stored).toBe('<p>a</p><img src="resinotes://u1/n1/123-ab.jpg">');
    expect(storedImageKeys(stored)).toEqual(["u1/n1/123-ab.jpg"]);
  });

  it("al abrir la nota cambia la referencia por una URL firmada nueva", () => {
    const html = '<img src="resinotes://u1/n1/123-ab.jpg">';
    expect(toEditorHtml(html, { "u1/n1/123-ab.jpg": "https://signed" })).toBe('<img src="https://signed">');
    // Sin URL (fallo al firmar) se deja la referencia: no se pierde la imagen al guardar.
    expect(toEditorHtml(html, {})).toBe(html);
  });

  it("no toca imágenes de otros sitios", () => {
    const other = '<img src="https://example.com/a.png">';
    expect(toStoredHtml(other)).toBe(other);
  });
});

describe("enlaces", () => {
  it("añade https y rechaza lo que no es un enlace web", () => {
    expect(normalizeLinkUrl("uptodate.com/contents/x")).toBe("https://uptodate.com/contents/x");
    expect(normalizeLinkUrl("http://sego.es")).toBe("http://sego.es");
    expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkUrl("hola mundo")).toBeNull();
    expect(normalizeLinkUrl("localhost")).toBeNull();
    expect(normalizeLinkUrl("")).toBeNull();
  });

  it("usa el dominio como título", () => {
    expect(linkTitleFromUrl("https://www.sego.es/guias")).toBe("sego.es");
  });
});

describe("ficheros", () => {
  it("acepta PDF e imágenes de hasta 20 MB", () => {
    expect(validateUpload({ mimeType: "application/pdf", size: 20 * 1024 * 1024 })).toBeNull();
    expect(validateUpload({ mimeType: "image/heic", size: 1000 })).toBeNull();
  });

  it("rechaza tipos incompatibles y ficheros demasiado grandes", () => {
    expect(validateUpload({ mimeType: "application/zip", size: 10 })).toMatch(/incompatible/);
    expect(validateUpload({ mimeType: "application/pdf", size: 20 * 1024 * 1024 + 1 })).toMatch(/20 MB/);
    expect(validateUpload({ mimeType: "application/pdf" }, { allowed: ["image/png"] })).toMatch(/incompatible/);
  });
});

describe("fechas cortas", () => {
  const now = new Date(2026, 10, 2, 12);
  it("dice hoy, ayer o la fecha", () => {
    expect(formatShortDate(new Date(2026, 10, 2, 8), now)).toBe("hoy");
    expect(formatShortDate(new Date(2026, 10, 1, 23), now)).toBe("ayer");
    expect(formatShortDate(new Date(2026, 9, 15), now)).toBe("15 oct");
    expect(formatShortDate(new Date(2025, 9, 15), now)).toBe("15 oct 2025");
  });
});
