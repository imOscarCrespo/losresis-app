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
  applyOrder,
  buildExportPlan,
  canMoveFoldersTo,
  daysUntilPurge,
  formatPurgeCountdown,
  formatSelectionCount,
  linkToExportHtml,
  moveInOrder,
  noteAssetsDir,
  noteToExportHtml,
  normalizeCalloutKind,
  NOTE_BLOCKS_CSS,
  orderIds,
  sanitizeFileName,
  selectionKey,
  splitSelection,
  toggleSelection,
  uniqueName,
  exportFileName,
  TRASH_RETENTION_DAYS,
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

// ---------------------------------------------------------------------------
// Pasada B
// ---------------------------------------------------------------------------

describe("orden manual", () => {
  const list = [
    { id: "p1", is_pinned: true, sort_order: 0, updated_at: "2026-11-01T00:00:00Z" },
    { id: "a", sort_order: 2, updated_at: "2026-11-02T00:00:00Z" },
    { id: "b", sort_order: 1, updated_at: "2026-10-01T00:00:00Z" },
    { id: "new", sort_order: 0, updated_at: "2026-09-01T00:00:00Z" },
  ];

  it("fijados arriba, después sort_order y a igualdad lo último editado", () => {
    expect(sortFolderItems(list).map((i) => i.id)).toEqual(["p1", "new", "b", "a"]);
  });

  it("sin orden manual (todo 0) sigue siendo lo más reciente primero", () => {
    const plain = [
      { id: "old", updated_at: "2026-10-01T00:00:00Z" },
      { id: "recent", updated_at: "2026-11-01T00:00:00Z" },
    ];
    expect(sortFolderItems(plain).map((i) => i.id)).toEqual(["recent", "old"]);
  });

  it("sube y baja dentro de su grupo, sin cruzar fijados", () => {
    const ordered = sortFolderItems(list);
    expect(moveInOrder(ordered, "a", -1).map((i) => i.id)).toEqual(["p1", "new", "a", "b"]);
    expect(moveInOrder(ordered, "new", -1)).toBeNull(); // encima está un fijado
    expect(moveInOrder(ordered, "p1", 1)).toBeNull();
    expect(moveInOrder(ordered, "a", 1)).toBeNull(); // ya es el último
    expect(moveInOrder(ordered, "nope", 1)).toBeNull();
  });

  it("las carpetas se mueven todas juntas con su propio criterio de grupo", () => {
    const fs = [{ id: "x" }, { id: "y" }];
    expect(moveInOrder(fs, "y", -1, () => true).map((f) => f.id)).toEqual(["y", "x"]);
  });

  it("guardar el orden pone sort_order = posición desde 1", () => {
    const ordered = moveInOrder(sortFolderItems(list), "a", -1);
    const ids = orderIds(ordered);
    expect(ids).toEqual(["p1", "new", "a", "b"]);
    const saved = applyOrder(list, ids);
    expect(saved.find((i) => i.id === "a").sort_order).toBe(3);
    expect(sortFolderItems(saved).map((i) => i.id)).toEqual(["p1", "new", "a", "b"]);
  });
});

describe("papelera: purga a los 30 días", () => {
  const now = new Date("2026-11-30T10:00:00Z");

  it("el plazo es 30 días", () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
  });

  it("cuenta los días que quedan", () => {
    expect(daysUntilPurge("2026-11-30T09:00:00Z", now)).toBe(30);
    expect(daysUntilPurge("2026-11-20T10:00:00Z", now)).toBe(20);
    expect(daysUntilPurge("2026-11-01T09:00:00Z", now)).toBe(1);
    expect(daysUntilPurge("2026-10-01T00:00:00Z", now)).toBe(0);
  });

  it("lo dice en español", () => {
    expect(formatPurgeCountdown(0)).toBe("se elimina hoy");
    expect(formatPurgeCountdown(1)).toBe("se elimina mañana");
    expect(formatPurgeCountdown(12)).toBe("se elimina en 12 días");
  });
});

describe("selección múltiple", () => {
  it("añade, quita y separa carpetas de elementos", () => {
    let sel = new Set();
    sel = toggleSelection(sel, selectionKey("item", "n1"));
    sel = toggleSelection(sel, selectionKey("folder", "obs"));
    sel = toggleSelection(sel, selectionKey("item", "n2"));
    sel = toggleSelection(sel, selectionKey("item", "n1"));
    expect(splitSelection(sel)).toEqual({ folderIds: ["obs"], itemIds: ["n2"] });
    expect(formatSelectionCount(sel.size)).toBe("2 seleccionados");
    expect(formatSelectionCount(1)).toBe("1 seleccionado");
  });

  it("no deja mover un lote de carpetas dentro de una de ellas o de sus hijas", () => {
    expect(canMoveFoldersTo(folders, ["par", "gin"], "obs")).toBe(true);
    expect(canMoveFoldersTo(folders, ["obs", "gin"], "mon")).toBe(false);
    expect(canMoveFoldersTo(folders, ["gin"], "gin")).toBe(false);
    expect(canMoveFoldersTo(folders, ["obs", "gin"], null)).toBe(true);
  });
});

describe("bloques especiales y tablas", () => {
  it("el CSS pinta las cinco etiquetas", () => {
    ["💡 Perla clínica", "⚠️ Importante", "🧠 Recordar", "❓ Duda pendiente", "📚 Bibliografía"].forEach((label) =>
      expect(NOTE_BLOCKS_CSS).toContain(label)
    );
    expect(normalizeCalloutKind("doubt")).toBe("doubt");
    expect(normalizeCalloutKind("<script>")).toBe("pearl");
  });

  it("el texto buscable separa celdas, filas y bloques", () => {
    const html =
      '<div data-callout="pearl"><p>Sulfato de magnesio</p></div>' +
      "<table><tbody><tr><th><p>Fármaco</p></th><th><p>Dosis</p></th></tr><tr><td><p>Labetalol</p></td><td><p>20 mg</p></td></tr></tbody></table>";
    const text = htmlToPlainText(html);
    expect(text).toContain("Sulfato de magnesio");
    expect(text).toContain("Fármaco");
    expect(text).toContain("Labetalol");
    expect(text).not.toMatch(/FármacoDosis|Labetalol20/);
  });
});

describe("exportación", () => {
  it("nombres válidos en cualquier sistema", () => {
    expect(sanitizeFileName('Pre/eclampsia: "grave" <TA>')).toBe("Pre-eclampsia- -grave- -TA-");
    expect(sanitizeFileName("  ...  ")).toBe("Sin título");
    expect(sanitizeFileName("Notas.")).toBe("Notas");
    expect(sanitizeFileName("x".repeat(150))).toHaveLength(100);
  });

  it("no repite nombres (sin distinguir mayúsculas)", () => {
    const used = new Set();
    expect(uniqueName(used, "Nota", ".html")).toBe("Nota.html");
    expect(uniqueName(used, "nota", ".html")).toBe("nota (2).html");
    expect(uniqueName(used, "Nota", ".html")).toBe("Nota (3).html");
  });

  const exportFolders = [
    { id: "obs", parent_id: null, name: "Obstetricia", sort_order: 0 },
    { id: "par", parent_id: "obs", name: "Paritorio", sort_order: 0 },
    { id: "vac", parent_id: "obs", name: "Vacía", sort_order: 1 },
    { id: "gin", parent_id: null, name: "Ginecología", sort_order: 0 },
  ];
  const exportItems = [
    { id: "n1", folder_id: "par", type: "note", title: "RCTG", content: "<p>x</p>", updated_at: "2026-11-01T00:00:00Z" },
    { id: "n2", folder_id: "par", type: "note", title: "RCTG", content: "<p>y</p>", updated_at: "2026-10-01T00:00:00Z" },
    {
      id: "p1",
      folder_id: "obs",
      type: "pdf",
      title: "Guía SEGO",
      resinotes_attachments: [{ storage_key: "u/p1/1.pdf", filename: "guia.PDF", mime_type: "application/pdf" }],
    },
    { id: "l1", folder_id: "gin", type: "link", title: "UpToDate", url: "https://uptodate.com" },
    {
      id: "i1",
      folder_id: null,
      type: "image",
      title: "Esquema",
      resinotes_attachments: [{ storage_key: "u/i1/1.heic", filename: "IMG_1.heic", mime_type: "image/heic" }],
    },
    { id: "gone", folder_id: "obs", type: "note", title: "Borrada", deleted_at: "2026-11-01T00:00:00Z" },
    { id: "broken", folder_id: "obs", type: "pdf", title: "Sin fichero", resinotes_attachments: [] },
  ];

  it("una carpeta conserva su árbol, las carpetas vacías y los nombres", () => {
    const plan = buildExportPlan({ folders: exportFolders, items: exportItems, rootFolderId: "obs" });
    expect(plan.map((e) => `${e.kind} ${e.path}`)).toEqual([
      "dir Obstetricia/",
      "dir Obstetricia/Paritorio/",
      "note Obstetricia/Paritorio/RCTG.html",
      "note Obstetricia/Paritorio/RCTG (2).html",
      "dir Obstetricia/Vacía/",
      "file Obstetricia/Guía SEGO.pdf",
    ]);
  });

  it("toda la biblioteca: lo suelto va en «Sin clasificar»", () => {
    const plan = buildExportPlan({ folders: exportFolders, items: exportItems });
    const paths = plan.map((e) => e.path);
    expect(paths[0]).toBe("ResiNotes/");
    expect(paths).toContain("ResiNotes/Ginecología/UpToDate (enlace).html");
    expect(paths).toContain("ResiNotes/Sin clasificar/");
    expect(paths).toContain("ResiNotes/Sin clasificar/Esquema.heic");
    expect(paths).toContain("ResiNotes/Obstetricia/Paritorio/RCTG.html");
    expect(paths.some((p) => p.includes("Borrada"))).toBe(false);
  });

  it("una carpeta que ya no existe no exporta nada", () => {
    expect(buildExportPlan({ folders: exportFolders, items: exportItems, rootFolderId: "zzz" })).toEqual([]);
  });

  it("la nota exportada lleva sus imágenes, sus bloques y escapa el título", () => {
    const html = noteToExportHtml({
      title: "Pre <eclampsia>",
      html: '<p>a</p><img src="resinotes://u/n1/1.jpg"><img src="resinotes://u/n1/2.jpg"><div data-callout="pearl"><p>b</p></div>',
      imageSrcByKey: { "u/n1/1.jpg": "RCTG_archivos/foto.jpg" },
    });
    expect(html).toContain("<title>Pre &lt;eclampsia&gt;</title>");
    expect(html).toContain('<img src="RCTG_archivos/foto.jpg">');
    expect(html).not.toContain("resinotes://");
    expect(html).toContain("💡 Perla clínica");
    expect(noteAssetsDir("A/B/RCTG.html")).toBe("A/B/RCTG_archivos/");
  });

  it("un enlace exportado lleva a su URL, escapada", () => {
    const html = linkToExportHtml({ title: "UpToDate", url: 'https://x.com/?a=1&b="2"' });
    expect(html).toContain('href="https://x.com/?a=1&amp;b=&quot;2&quot;"');
  });

  it("nombre del fichero exportado", () => {
    const now = new Date(2026, 10, 2);
    expect(exportFileName(null, now)).toBe("ResiNotes - 2026-11-02");
    expect(exportFileName("Urgencias / guardia", now)).toBe("ResiNotes - Urgencias - guardia - 2026-11-02");
  });
});
