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

/** Dentro de una carpeta: fijados arriba y después lo último editado. */
export const sortFolderItems = (items = []) =>
  [...items].sort(
    (a, b) =>
      Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) ||
      time(b.updated_at) - time(a.updated_at)
  );

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
