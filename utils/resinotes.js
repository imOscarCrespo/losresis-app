/**
 * ResiNotes (ClickUp 124b4z9w0qg): la lógica pura de la biblioteca de apuntes.
 *
 * Todo lo que se puede decidir sin red vive aquí (árbol de carpetas, ciclos,
 * contadores, orden, texto buscable de una nota, validación de ficheros y
 * enlaces) para poder probarlo con Jest. El servicio y las pantallas solo lo usan.
 */

/** Los colores pastel de las carpetas. La clave es la que guarda la BD. */
export const FOLDER_COLORS = {
  blue: { label: "Azul pastel", bg: "#E0F2FE", fg: "#0284C7" },
  pink: { label: "Rosa pastel", bg: "#FCE7F3", fg: "#DB2777" },
  lavender: { label: "Lavanda", bg: "#EDE9FE", fg: "#7C3AED" },
  mint: { label: "Verde menta", bg: "#D1FAE5", fg: "#059669" },
  yellow: { label: "Amarillo pastel", bg: "#FEF9C3", fg: "#CA8A04" },
  orange: { label: "Naranja suave", bg: "#FFEDD5", fg: "#EA580C" },
  gray: { label: "Gris", bg: "#F1F5F9", fg: "#64748B" },
};

export const FOLDER_COLOR_KEYS = Object.keys(FOLDER_COLORS);
export const DEFAULT_FOLDER_COLOR = "lavender";

export const folderColor = (key) => FOLDER_COLORS[key] || FOLDER_COLORS[DEFAULT_FOLDER_COLOR];

export const ITEM_TYPE_LABELS = {
  note: "Nota",
  image: "Imagen",
  pdf: "PDF",
  link: "Enlace",
  folder: "Carpeta",
};

export const ITEM_TYPE_ICONS = {
  note: "document-text-outline",
  image: "image-outline",
  pdf: "document-attach-outline",
  link: "link-outline",
  folder: "folder-outline",
};

export const MAX_FOLDER_NAME = 80;
export const MAX_ITEM_TITLE = 200;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const ALLOWED_UPLOAD_MIME = ["application/pdf", ...ALLOWED_IMAGE_MIME];

const byOrderThenName = (a, b) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
  String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });

/** Carpetas vivas que cuelgan directamente de parentId (null = raíz). */
export const childFolders = (folders = [], parentId = null) =>
  folders
    .filter((f) => !f.deleted_at && (f.parent_id ?? null) === (parentId ?? null))
    .sort(byOrderThenName);

/** Ids de todas las descendientes de una carpeta (sin incluirla). */
export const descendantIds = (folders = [], folderId) => {
  const byParent = new Map();
  folders.forEach((f) => {
    const key = f.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(f.id);
  });

  const result = new Set();
  const stack = [...(byParent.get(folderId) || [])];
  while (stack.length) {
    const id = stack.pop();
    if (result.has(id)) continue;
    result.add(id);
    stack.push(...(byParent.get(id) || []));
  }
  return result;
};

/**
 * Se puede mover `folderId` dentro de `targetParentId` (null = raíz) si no es
 * ella misma ni una de sus descendientes. La BD lo vuelve a comprobar.
 */
export const canMoveFolder = (folders, folderId, targetParentId) => {
  if (!folderId) return false;
  if (targetParentId == null) return true;
  if (targetParentId === folderId) return false;
  return !descendantIds(folders, folderId).has(targetParentId);
};

/** Ruta desde la raíz hasta la carpeta: [{id, name}, ...]. */
export const folderPath = (folders = [], folderId) => {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path = [];
  const seen = new Set();
  let cursor = byId.get(folderId);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.unshift(cursor);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : null;
  }
  return path;
};

/**
 * Elementos (notas, fotos, PDFs, enlaces) de una carpeta contando sus
 * subcarpetas. Es el «42 elementos» de la tarjeta.
 */
export const countItemsByFolder = (folders = [], items = []) => {
  const direct = new Map();
  items.forEach((i) => {
    if (i.deleted_at || !i.folder_id) return;
    direct.set(i.folder_id, (direct.get(i.folder_id) || 0) + 1);
  });

  const counts = {};
  folders.forEach((f) => {
    if (f.deleted_at) return;
    let total = direct.get(f.id) || 0;
    descendantIds(folders, f.id).forEach((id) => {
      total += direct.get(id) || 0;
    });
    counts[f.id] = total;
  });
  return counts;
};

export const formatElementCount = (n) => `${n} ${n === 1 ? "elemento" : "elementos"}`;

const time = (value) => (value ? new Date(value).getTime() : 0);

/**
 * Dentro de una carpeta: fijados arriba; después el orden manual (sort_order) y,
 * a igualdad, lo último editado. Mientras el residente no reordena, todo vale 0
 * y se ve lo más reciente primero; un elemento nuevo (0) entra arriba.
 */
export const sortFolderItems = (items = []) =>
  [...items].sort(
    (a, b) =>
      Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      time(b.updated_at) - time(a.updated_at)
  );

/**
 * Mueve un elemento una posición (delta -1 sube, +1 baja) dentro de una lista
 * ya ordenada, sin saltar entre fijados y no fijados. Devuelve la lista nueva o
 * null si no se puede mover. `sameGroup(a, b)` decide qué es «su grupo»; por
 * defecto, carpetas siempre (todas juntas) y elementos por is_pinned.
 */
export const moveInOrder = (ordered = [], id, delta, sameGroup = (a, b) => Boolean(a.is_pinned) === Boolean(b.is_pinned)) => {
  const from = ordered.findIndex((x) => x.id === id);
  const to = from + delta;
  if (from < 0 || !delta || to < 0 || to >= ordered.length) return null;
  if (!sameGroup(ordered[from], ordered[to])) return null;
  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

/** Ids en el orden en que hay que guardarlos (sort_order = posición, desde 1). */
export const orderIds = (ordered = []) => ordered.map((x) => x.id);

/** Lo que queda tras guardar un orden: cada uno con su sort_order nuevo. */
export const applyOrder = (list = [], ids = []) => {
  const position = new Map(ids.map((id, idx) => [id, idx + 1]));
  return list.map((x) => (position.has(x.id) ? { ...x, sort_order: position.get(x.id) } : x));
};

// ---------------------------------------------------------------------------
// Papelera
// ---------------------------------------------------------------------------

/**
 * Días que se queda algo en la papelera. Lo purga cada noche la edge function
 * resinotes-maintenance (losresis-db 20261111120000_resinotes_pass_b.sql), con
 * el mismo valor.
 */
export const TRASH_RETENTION_DAYS = 30;

/** Días que le quedan a algo de la papelera antes de borrarse para siempre (0 = hoy). */
export const daysUntilPurge = (deletedAt, now = new Date(), retentionDays = TRASH_RETENTION_DAYS) => {
  if (!deletedAt) return retentionDays;
  const purgeAt = new Date(deletedAt).getTime() + retentionDays * 86400000;
  return Math.max(0, Math.ceil((purgeAt - now.getTime()) / 86400000));
};

export const formatPurgeCountdown = (days) => {
  if (days <= 0) return "se elimina hoy";
  if (days === 1) return "se elimina mañana";
  return `se elimina en ${days} días`;
};

// ---------------------------------------------------------------------------
// Selección múltiple
// ---------------------------------------------------------------------------

/** Añade o quita una clave de la selección (un Set nuevo). */
export const toggleSelection = (selection, key) => {
  const next = new Set(selection);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};

export const selectionKey = (kind, id) => `${kind}:${id}`;

/** Separa la selección en ids de carpetas y de elementos. */
export const splitSelection = (selection) => {
  const folderIds = [];
  const itemIds = [];
  Array.from(selection || []).forEach((key) => {
    const [kind, id] = String(key).split(":");
    if (kind === "folder") folderIds.push(id);
    else if (kind === "item") itemIds.push(id);
  });
  return { folderIds, itemIds };
};

export const formatSelectionCount = (n) => (n === 1 ? "1 seleccionado" : `${n} seleccionados`);

/**
 * Carpetas seleccionadas a las que se puede mover el lote: no puede ser una de
 * ellas ni una descendiente (sería un ciclo).
 */
export const canMoveFoldersTo = (folders, folderIds = [], targetParentId) =>
  folderIds.every((id) => canMoveFolder(folders, id, targetParentId));

/** Recientes: lo último abierto o editado, lo que pasara después. */
export const recentItems = (items = [], limit = 30) =>
  items
    .filter((i) => !i.deleted_at)
    .map((i) => ({ item: i, at: Math.max(time(i.last_opened_at), time(i.updated_at)) }))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map(({ item }) => item);

export const favoriteItems = (items = []) =>
  items.filter((i) => !i.deleted_at && i.is_favorite).sort((a, b) => time(b.updated_at) - time(a.updated_at));

export const unclassifiedItems = (items = []) =>
  sortFolderItems(items.filter((i) => !i.deleted_at && !i.folder_id));

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/**
 * El texto de una nota que se guarda en content_text para buscar. Los bloques
 * (párrafos, títulos, elementos de lista) acaban en salto de línea para que dos
 * palabras de párrafos distintos no se peguen.
 */
export const htmlToPlainText = (html = "") =>
  String(html || "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|div|blockquote|tr|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
      const key = code.toLowerCase();
      if (ENTITIES[key] !== undefined) return ENTITIES[key];
      if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16));
      if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10));
      return match;
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

/** Título de una nota sin título: su primera línea de texto. */
export const deriveNoteTitle = (title, plainText) => {
  const clean = String(title || "").trim();
  if (clean) return clean.slice(0, MAX_ITEM_TITLE);
  const firstLine = String(plainText || "").split("\n").find((l) => l.trim());
  return firstLine ? firstLine.trim().slice(0, 80) : "Nota sin título";
};

/*
 * Imágenes dentro de una nota. El bucket es privado, así que el editor solo
 * puede pintarlas con una URL firmada, que caduca. En la BD se guarda una
 * referencia estable (`resinotes://<storage_key>`) y al abrir la nota se cambia
 * por una URL firmada nueva.
 */
const STORED_IMAGE = /resinotes:\/\/([^"'\s)]+)/g;
const SIGNED_IMAGE = /https?:\/\/[^"'\s]+\/storage\/v1\/object\/sign\/resinotes\/([^"'?\s]+)\?[^"'\s]*/g;

export const toStoredHtml = (html = "") =>
  String(html || "").replace(SIGNED_IMAGE, (_, key) => `resinotes://${decodeURIComponent(key)}`);

export const storedImageKeys = (html = "") =>
  Array.from(new Set(Array.from(String(html || "").matchAll(STORED_IMAGE), (m) => m[1])));

export const toEditorHtml = (html = "", urlsByKey = {}) =>
  String(html || "").replace(STORED_IMAGE, (match, key) => urlsByKey[key] || match);

/** «uptodate.com/x» → «https://uptodate.com/x»; null si no es un enlace web. */
export const normalizeLinkUrl = (input) => {
  const raw = String(input || "").trim();
  if (!raw || /\s/.test(raw)) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : /^[a-z][a-z0-9+.-]*:/i.test(raw) ? null : `https://${raw}`;
  if (!withScheme) return null;
  const host = withScheme.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
  if (!host || !host.includes(".") || host.startsWith(".") || host.endsWith(".")) return null;
  return withScheme.length <= 2048 ? withScheme : null;
};

/** Título por defecto de un enlace: su dominio sin www. */
export const linkTitleFromUrl = (url) => {
  const host = String(url || "").replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
  return host.replace(/^www\./i, "") || "Enlace";
};

/** Mensaje de error para un fichero que no se puede subir, o null si vale. */
export const validateUpload = ({ mimeType, size } = {}, { allowed = ALLOWED_UPLOAD_MIME } = {}) => {
  if (!mimeType || !allowed.includes(mimeType)) {
    return allowed.includes("application/pdf")
      ? "Archivo incompatible: solo PDF, JPG, PNG, WebP o HEIC."
      : "Archivo incompatible: solo JPG, PNG, WebP o HEIC.";
  }
  if (size && size > MAX_UPLOAD_BYTES) {
    return "Archivo demasiado grande: el máximo son 20 MB.";
  }
  return null;
};

export const extensionForMime = (mime, fallbackName = "") => {
  const known = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (known[mime]) return known[mime];
  const guess = String(fallbackName).split(".").pop();
  return guess && guess.length <= 5 ? guess.toLowerCase() : "bin";
};

/** Quita la extensión de un nombre de fichero para usarlo de título. */
export const titleFromFilename = (name, fallback) => {
  const base = String(name || "").replace(/\.[a-z0-9]{1,5}$/i, "").trim();
  return (base || fallback).slice(0, MAX_ITEM_TITLE);
};

/** Fecha corta para las filas: «hoy», «ayer» o «3 nov». */
export const formatShortDate = (value, now = new Date()) => {
  if (!value) return "";
  const d = new Date(value);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const label = `${d.getDate()} ${months[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
};

// ---------------------------------------------------------------------------
// Bloques especiales y tablas del editor
// ---------------------------------------------------------------------------

/**
 * Bloques especiales de una nota. En el HTML van como
 * `<div data-callout="pearl">…</div>`; la etiqueta («💡 Perla clínica») la pinta
 * el CSS, así que no se puede borrar sin querer al escribir.
 */
export const CALLOUT_KINDS = {
  pearl: { emoji: "💡", label: "Perla clínica", bg: "#FEF9C3", border: "#FACC15" },
  important: { emoji: "⚠️", label: "Importante", bg: "#FFEDD5", border: "#FB923C" },
  remember: { emoji: "🧠", label: "Recordar", bg: "#EDE9FE", border: "#A78BFA" },
  doubt: { emoji: "❓", label: "Duda pendiente", bg: "#E0F2FE", border: "#38BDF8" },
  bibliography: { emoji: "📚", label: "Bibliografía", bg: "#F1F5F9", border: "#94A3B8" },
};
export const CALLOUT_KIND_KEYS = Object.keys(CALLOUT_KINDS);
export const DEFAULT_CALLOUT_KIND = "pearl";
export const normalizeCalloutKind = (kind) => (CALLOUT_KINDS[kind] ? kind : DEFAULT_CALLOUT_KIND);

/** CSS de bloques y tablas: el mismo en el editor y en la exportación. */
export const NOTE_BLOCKS_CSS = [
  `div[data-callout] { border-left: 4px solid #CBD5E1; border-radius: 12px; padding: 10px 14px; margin: 12px 0; }`,
  `div[data-callout]::before { display: block; font-weight: 700; margin-bottom: 4px; color: #1B0977; }`,
  `div[data-callout] > p:first-of-type { margin-top: 0; }`,
  `div[data-callout] > p:last-child { margin-bottom: 0; }`,
  ...CALLOUT_KIND_KEYS.map((key) => {
    const k = CALLOUT_KINDS[key];
    return `div[data-callout="${key}"] { background: ${k.bg}; border-left-color: ${k.border}; } div[data-callout="${key}"]::before { content: "${k.emoji} ${k.label}"; }`;
  }),
  `table { border-collapse: collapse; width: 100%; margin: 12px 0; table-layout: fixed; }`,
  `th, td { border: 1px solid #CBD5E1; padding: 6px 8px; vertical-align: top; word-break: break-word; }`,
  `th { background: #F1F5F9; font-weight: 700; text-align: left; }`,
  `td > p, th > p { margin: 0; }`,
  `.selectedCell { background: #EDE9FE; }`,
  `.tableWrapper { overflow-x: auto; }`,
].join("\n");

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

/**
 * Nombre válido de fichero o carpeta en cualquier sistema (Windows incluido):
 * sin / \ : * ? " < > | ni caracteres de control, sin puntos ni espacios al final.
 */
export const sanitizeFileName = (name, fallback = "Sin título") => {
  const clean = String(name || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 100)
    .trim();
  return clean || fallback;
};

/**
 * Reserva un nombre único (sin distinguir mayúsculas) en `used`:
 * «Nota.html», «Nota (2).html»…
 */
export const uniqueName = (used, base, ext = "") => {
  let n = 1;
  let candidate = `${base}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${base} (${n})${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const splitExtension = (filename) => {
  const match = String(filename || "").match(/^(.*?)(\.[a-z0-9]{1,5})$/i);
  return match ? { base: match[1], ext: match[2].toLowerCase() } : { base: String(filename || ""), ext: "" };
};

/**
 * Lo que va dentro del ZIP, sin tocar la red: una entrada por carpeta (para que
 * las vacías también salgan), nota, enlace, foto o PDF, con su ruta.
 *
 * @param {{folders: object[], items: object[], rootFolderId?: string|null, rootName?: string}} args
 *   items con `resinotes_attachments`; rootFolderId null = toda la biblioteca.
 * @returns {{kind:'dir'|'note'|'link'|'file', path:string, item?:object, attachment?:object}[]}
 */
export const buildExportPlan = ({ folders = [], items = [], rootFolderId = null, rootName = "ResiNotes" }) => {
  const live = folders.filter((f) => !f.deleted_at);
  const liveItems = items.filter((i) => !i.deleted_at);
  const entries = [];

  const addItems = (list, prefix, used) => {
    sortFolderItems(list).forEach((item) => {
      const title = sanitizeFileName(item.title);
      if (item.type === "note") {
        entries.push({ kind: "note", path: `${prefix}${uniqueName(used, title, ".html")}`, item });
      } else if (item.type === "link") {
        entries.push({ kind: "link", path: `${prefix}${uniqueName(used, `${title} (enlace)`, ".html")}`, item });
      } else {
        const attachment = (item.resinotes_attachments || [])[0];
        if (!attachment) return;
        const { ext } = splitExtension(attachment.filename);
        const finalExt = ext || `.${extensionForMime(attachment.mime_type)}`;
        entries.push({ kind: "file", path: `${prefix}${uniqueName(used, title, finalExt)}`, item, attachment });
      }
    });
  };

  // Subcarpetas y, si se pide, los elementos de una carpeta. Devuelve los nombres usados.
  const walk = (folderId, prefix, { withItems = true } = {}) => {
    const used = new Set();
    childFolders(live, folderId).forEach((f) => {
      const path = `${prefix}${uniqueName(used, sanitizeFileName(f.name, "Carpeta"))}/`;
      entries.push({ kind: "dir", path, folder: f });
      walk(f.id, path);
    });
    if (withItems) addItems(liveItems.filter((i) => (i.folder_id ?? null) === (folderId ?? null)), prefix, used);
    return used;
  };

  const rootFolder = rootFolderId ? live.find((f) => f.id === rootFolderId) : null;
  if (rootFolderId && !rootFolder) return entries;
  const top = `${sanitizeFileName(rootFolder ? rootFolder.name : rootName, "ResiNotes")}/`;
  entries.push({ kind: "dir", path: top, folder: rootFolder });

  if (rootFolderId) {
    walk(rootFolderId, top);
    return entries;
  }

  // Toda la biblioteca: lo que no tiene carpeta va en «Sin clasificar».
  const used = walk(null, top, { withItems: false });
  const loose = liveItems.filter((i) => !i.folder_id);
  if (loose.length) {
    const path = `${top}${uniqueName(used, "Sin clasificar")}/`;
    entries.push({ kind: "dir", path, folder: null });
    addItems(loose, path, new Set());
  }
  return entries;
};

/** Carpeta de imágenes de una nota exportada: «Nota.html» → «Nota_archivos/». */
export const noteAssetsDir = (notePath) => notePath.replace(/\.html$/i, "_archivos/");

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const EXPORT_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0F172A; font-size: 16px; line-height: 1.55; max-width: 780px; margin: 32px auto; padding: 0 20px; }
  h1, h2, h3 { color: #1B0977; }
  blockquote { border-left: 3px solid #C4B5FD; margin-left: 0; padding-left: 12px; color: #334155; }
  img { max-width: 100%; height: auto; border-radius: 12px; }
  a { color: #670CF5; }
  ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
  ul[data-type="taskList"] li { display: flex; gap: 8px; }
  .meta { color: #64748B; font-size: 13px; margin-bottom: 24px; }
`;

/**
 * Documento HTML completo de una nota exportada. Las imágenes guardadas como
 * `resinotes://<clave>` se cambian por `imageSrcByKey[clave]` (ruta relativa
 * dentro del ZIP o data: URI); si falta, se quita la imagen para no dejar una
 * referencia rota.
 */
export const noteToExportHtml = ({ title, html, updatedAt, imageSrcByKey = {} }) => {
  const body = String(html || "").replace(
    /<img\b[^>]*?src=(["'])resinotes:\/\/([^"']+)\1[^>]*>/gi,
    (tag, quote, key) => (imageSrcByKey[key] ? tag.replace(`resinotes://${key}`, imageSrcByKey[key]) : "")
  );
  const safeTitle = escapeHtml(title || "Nota sin título");
  const date = updatedAt ? new Date(updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>${EXPORT_CSS}
${NOTE_BLOCKS_CSS}</style>
</head>
<body>
<h1>${safeTitle}</h1>
${date ? `<p class="meta">Exportado de ResiNotes · última edición: ${escapeHtml(date)}</p>` : ""}
${body}
</body>
</html>
`;
};

/** Un enlace exportado: una página con el enlace y que redirige a él. */
export const linkToExportHtml = ({ title, url }) => {
  const safeUrl = escapeHtml(url);
  const safeTitle = escapeHtml(title || url);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${safeUrl}">
<title>${safeTitle}</title>
</head>
<body>
<p><a href="${safeUrl}">${safeTitle}</a></p>
<p>${safeUrl}</p>
</body>
</html>
`;
};

/** Nombre del ZIP: «ResiNotes - Urgencias - 2026-11-02.zip». */
export const exportFileName = (label, now = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const name = label ? `ResiNotes - ${sanitizeFileName(label)}` : "ResiNotes";
  return `${name} - ${day}`;
};
