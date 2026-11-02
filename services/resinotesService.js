import { supabase } from "../config/supabase";
import {
  ALLOWED_IMAGE_MIME,
  MAX_FOLDER_NAME,
  MAX_ITEM_TITLE,
  deriveNoteTitle,
  extensionForMime,
  htmlToPlainText,
  normalizeLinkUrl,
  linkTitleFromUrl,
  titleFromFilename,
  toStoredHtml,
  validateUpload,
} from "../utils/resinotes";

/**
 * ResiNotes (ClickUp 124b4z9w0qg): biblioteca personal de apuntes.
 *
 * Tablas resinotes_folders / resinotes_items / resinotes_attachments y bucket
 * privado `resinotes` (migración losresis-db 20261110120000_resinotes.sql).
 * Todo es del dueño por RLS; aquí no hace falta filtrar por usuario para que
 * sea seguro, pero se filtra igual para no depender solo de eso.
 *
 * Los ficheros van a `<user_id>/<item_id>/<timestamp>.<ext>` y se abren con
 * URL firmada. Borrar definitivamente quita primero los ficheros (desde SQL no
 * se puede) y después las filas.
 */

export const BUCKET = "resinotes";
const LIST_LIMIT = 2000;

const ITEM_LIST_COLUMNS =
  "id, folder_id, type, title, url, is_favorite, is_pinned, last_opened_at, created_at, updated_at, deleted_at";
const FOLDER_COLUMNS = "id, parent_id, name, emoji, color, sort_order, created_at, updated_at, deleted_at";

const raise = (error, context) => {
  console.error(`ResiNotes · ${context}:`, error);
  const err = new Error(error?.message || "Error en ResiNotes");
  err.code = error?.code;
  err.cause = error;
  throw err;
};

/** Mensaje para el usuario a partir de un error de la BD. */
export const friendlyError = (error, fallback = "No se ha podido guardar. Inténtalo de nuevo.") => {
  const message = String(error?.message || "");
  if (message.includes("resinotes_folder_cycle")) {
    return "No puedes mover una carpeta dentro de sí misma ni de una de sus subcarpetas.";
  }
  if (message.includes("not_found")) return "Este elemento ya no existe.";
  if (/network|fetch/i.test(message)) return "Sin conexión. Revisa tu conexión e inténtalo de nuevo.";
  return fallback;
};

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------

/** Carpetas y elementos vivos (sin el contenido de las notas). */
export const loadLibrary = async (userId) => {
  const [folders, items] = await Promise.all([
    supabase
      .from("resinotes_folders")
      .select(FOLDER_COLUMNS)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(LIST_LIMIT),
    supabase
      .from("resinotes_items")
      .select(ITEM_LIST_COLUMNS)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(LIST_LIMIT),
  ]);

  if (folders.error) raise(folders.error, "loadLibrary folders");
  if (items.error) raise(items.error, "loadLibrary items");
  return { folders: folders.data || [], items: items.data || [] };
};

// ---------------------------------------------------------------------------
// Carpetas
// ---------------------------------------------------------------------------

const cleanFolder = ({ name, emoji, color, parentId }) => {
  const payload = {};
  if (name !== undefined) payload.name = String(name).trim().slice(0, MAX_FOLDER_NAME);
  if (emoji !== undefined) payload.emoji = String(emoji || "").trim().slice(0, 16) || null;
  if (color !== undefined) payload.color = color;
  if (parentId !== undefined) payload.parent_id = parentId || null;
  return payload;
};

export const createFolder = async (userId, values) => {
  const { data, error } = await supabase
    .from("resinotes_folders")
    .insert({ user_id: userId, ...cleanFolder(values) })
    .select(FOLDER_COLUMNS)
    .single();
  if (error) raise(error, "createFolder");
  return data;
};

export const updateFolder = async (folderId, values) => {
  const { data, error } = await supabase
    .from("resinotes_folders")
    .update(cleanFolder(values))
    .eq("id", folderId)
    .select(FOLDER_COLUMNS)
    .single();
  if (error) raise(error, "updateFolder");
  return data;
};

export const moveFolder = (folderId, parentId) => updateFolder(folderId, { parentId });

export const trashFolder = async (folderId) => {
  const { error } = await supabase.rpc("resinotes_trash_folder", { p_folder_id: folderId });
  if (error) raise(error, "trashFolder");
};

export const restoreFolder = async (folderId) => {
  const { error } = await supabase.rpc("resinotes_restore_folder", { p_folder_id: folderId });
  if (error) raise(error, "restoreFolder");
};

const removeStorageKeys = async (keys) => {
  const unique = Array.from(new Set((keys || []).filter(Boolean)));
  for (let i = 0; i < unique.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(unique.slice(i, i + 100));
    if (error) raise(error, "removeStorageKeys");
  }
};

/** Borra para siempre una carpeta, sus subcarpetas, sus elementos y sus ficheros. */
export const deleteFolderForever = async (folderId) => {
  const { data, error } = await supabase.rpc("resinotes_subtree_storage_keys", {
    p_folder_id: folderId,
  });
  if (error) raise(error, "deleteFolderForever keys");

  const keys = (data || []).map((row) => (typeof row === "string" ? row : row?.resinotes_subtree_storage_keys));
  await removeStorageKeys(keys);

  const { error: deleteError } = await supabase.from("resinotes_folders").delete().eq("id", folderId);
  if (deleteError) raise(deleteError, "deleteFolderForever");
};

// ---------------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------------

export const getItem = async (itemId) => {
  const { data, error } = await supabase
    .from("resinotes_items")
    .select(`${ITEM_LIST_COLUMNS}, content, resinotes_attachments(id, storage_key, filename, mime_type, size_bytes)`)
    .eq("id", itemId)
    .maybeSingle();
  if (error) raise(error, "getItem");
  return data;
};

export const createNote = async (userId, { folderId = null, title = "" } = {}) => {
  const { data, error } = await supabase
    .from("resinotes_items")
    .insert({
      user_id: userId,
      folder_id: folderId,
      type: "note",
      title: String(title).slice(0, MAX_ITEM_TITLE),
      content: "",
      content_text: "",
    })
    .select(ITEM_LIST_COLUMNS)
    .single();
  if (error) raise(error, "createNote");
  return data;
};

/**
 * Guarda una nota desde el editor. Las imágenes vienen con URL firmada y se
 * guardan como referencia estable (toStoredHtml); el texto buscable sale del HTML.
 */
export const saveNote = async (itemId, { title, html }) => {
  const content = toStoredHtml(html);
  const contentText = htmlToPlainText(content);
  const { data, error } = await supabase
    .from("resinotes_items")
    .update({
      title: deriveNoteTitle(title, contentText),
      content,
      content_text: contentText,
    })
    .eq("id", itemId)
    .select(ITEM_LIST_COLUMNS)
    .single();
  if (error) raise(error, "saveNote");
  return data;
};

export const createLink = async (userId, { folderId = null, url, title }) => {
  const normalized = normalizeLinkUrl(url);
  if (!normalized) throw new Error("INVALID_URL");

  const { data, error } = await supabase
    .from("resinotes_items")
    .insert({
      user_id: userId,
      folder_id: folderId,
      type: "link",
      url: normalized,
      title: (String(title || "").trim() || linkTitleFromUrl(normalized)).slice(0, MAX_ITEM_TITLE),
    })
    .select(ITEM_LIST_COLUMNS)
    .single();
  if (error) raise(error, "createLink");
  return data;
};

export const updateItem = async (itemId, values) => {
  const payload = {};
  if (values.title !== undefined) payload.title = String(values.title).trim().slice(0, MAX_ITEM_TITLE);
  if (values.folderId !== undefined) payload.folder_id = values.folderId || null;
  if (values.isFavorite !== undefined) payload.is_favorite = Boolean(values.isFavorite);
  if (values.isPinned !== undefined) payload.is_pinned = Boolean(values.isPinned);

  const { data, error } = await supabase
    .from("resinotes_items")
    .update(payload)
    .eq("id", itemId)
    .select(ITEM_LIST_COLUMNS)
    .single();
  if (error) raise(error, "updateItem");
  return data;
};

export const moveItem = (itemId, folderId) => updateItem(itemId, { folderId });

/** Para «Recientes». Si falla no molesta al usuario. */
export const markItemOpened = async (itemId) => {
  const { error } = await supabase
    .from("resinotes_items")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) console.warn("ResiNotes · markItemOpened:", error);
};

export const trashItem = async (itemId) => {
  const { error } = await supabase
    .from("resinotes_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) raise(error, "trashItem");
};

export const restoreItem = async (itemId) => {
  const { error } = await supabase.rpc("resinotes_restore_item", { p_item_id: itemId });
  if (error) raise(error, "restoreItem");
};

export const deleteItemForever = async (itemId) => {
  const { data, error } = await supabase
    .from("resinotes_attachments")
    .select("storage_key")
    .eq("item_id", itemId);
  if (error) raise(error, "deleteItemForever keys");

  await removeStorageKeys((data || []).map((a) => a.storage_key));

  const { error: deleteError } = await supabase.from("resinotes_items").delete().eq("id", itemId);
  if (deleteError) raise(deleteError, "deleteItemForever");
};

// ---------------------------------------------------------------------------
// Ficheros
// ---------------------------------------------------------------------------

const uploadToStorage = async ({ userId, itemId, file, mime }) => {
  const storageName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionForMime(mime, file.name)}`;
  const path = `${userId}/${itemId}/${storageName}`;

  const formData = new FormData();
  formData.append("file", { uri: file.uri, name: storageName, type: mime });

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, formData, { contentType: mime, upsert: false });
  if (error) raise(error, "upload");
  return data?.path || path;
};

const insertAttachment = async ({ userId, itemId, storageKey, file, mime }) => {
  const { data, error } = await supabase
    .from("resinotes_attachments")
    .insert({
      user_id: userId,
      item_id: itemId,
      storage_key: storageKey,
      filename: String(file.name || `archivo.${extensionForMime(mime)}`).slice(0, 255),
      mime_type: mime,
      size_bytes: file.size ?? null,
    })
    .select("id, storage_key, filename, mime_type, size_bytes")
    .single();
  if (error) raise(error, "insertAttachment");
  return data;
};

/**
 * Sube una foto o un PDF como elemento nuevo. Si falla la subida no deja un
 * elemento vacío: lo borra.
 *
 * @param {{uri: string, name?: string, mimeType?: string, size?: number}} file
 */
export const uploadFileItem = async (userId, { folderId = null, file }) => {
  const mime = file?.mimeType;
  const invalid = validateUpload({ mimeType: mime, size: file?.size });
  if (invalid) {
    const err = new Error(invalid);
    err.userMessage = invalid;
    throw err;
  }

  const type = mime === "application/pdf" ? "pdf" : "image";
  const { data: item, error } = await supabase
    .from("resinotes_items")
    .insert({
      user_id: userId,
      folder_id: folderId,
      type,
      title: titleFromFilename(file.name, type === "pdf" ? "Documento PDF" : "Imagen"),
    })
    .select(ITEM_LIST_COLUMNS)
    .single();
  if (error) raise(error, "uploadFileItem");

  try {
    const storageKey = await uploadToStorage({ userId, itemId: item.id, file, mime });
    await insertAttachment({ userId, itemId: item.id, storageKey, file, mime });
    return item;
  } catch (uploadError) {
    await supabase.from("resinotes_items").delete().eq("id", item.id);
    throw uploadError;
  }
};

/** Imagen insertada en una nota: se sube como adjunto de la nota. */
export const uploadNoteImage = async (userId, itemId, file) => {
  const mime = file?.mimeType;
  const invalid = validateUpload({ mimeType: mime, size: file?.size }, { allowed: ALLOWED_IMAGE_MIME });
  if (invalid) {
    const err = new Error(invalid);
    err.userMessage = invalid;
    throw err;
  }

  const storageKey = await uploadToStorage({ userId, itemId, file, mime });
  await insertAttachment({ userId, itemId, storageKey, file, mime });
  const url = await getSignedUrl(storageKey, 60 * 60 * 24);
  return { storageKey, url };
};

export const getSignedUrl = async (storageKey, expiresInSeconds = 600) => {
  if (!storageKey) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storageKey, expiresInSeconds);
  if (error) {
    console.error("ResiNotes · getSignedUrl:", error);
    return null;
  }
  return data?.signedUrl || null;
};

/** URLs firmadas de varias claves a la vez: { [key]: url }. */
export const getSignedUrls = async (keys, expiresInSeconds = 60 * 60 * 24) => {
  const unique = Array.from(new Set((keys || []).filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresInSeconds);
  if (error) {
    console.error("ResiNotes · getSignedUrls:", error);
    return {};
  }
  return (data || []).reduce((acc, row) => {
    if (row?.path && row?.signedUrl) acc[row.path] = row.signedUrl;
    return acc;
  }, {});
};

// ---------------------------------------------------------------------------
// Papelera y búsqueda
// ---------------------------------------------------------------------------

/** Lo que el residente ha mandado a la papelera (no lo que se fue con una carpeta). */
export const loadTrash = async (userId) => {
  const [folders, items] = await Promise.all([
    supabase
      .from("resinotes_folders")
      .select(FOLDER_COLUMNS)
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .is("trashed_by_folder_id", null)
      .order("deleted_at", { ascending: false })
      .limit(500),
    supabase
      .from("resinotes_items")
      .select(ITEM_LIST_COLUMNS)
      .eq("user_id", userId)
      .not("deleted_at", "is", null)
      .is("trashed_by_folder_id", null)
      .order("deleted_at", { ascending: false })
      .limit(500),
  ]);
  if (folders.error) raise(folders.error, "loadTrash folders");
  if (items.error) raise(items.error, "loadTrash items");
  return { folders: folders.data || [], items: items.data || [] };
};

/**
 * Búsqueda global sin acentos ni mayúsculas.
 * @param {'note'|'pdf'|'image'|'link'|'folder'|null} type
 */
export const searchLibrary = async (query, { type = null, favoritesOnly = false } = {}) => {
  const clean = String(query || "").trim();
  if (clean.length < 2) return [];
  const { data, error } = await supabase.rpc("resinotes_search", {
    p_query: clean,
    p_type: type,
    p_favorites_only: favoritesOnly,
    p_limit: 50,
  });
  if (error) raise(error, "searchLibrary");
  return data || [];
};

export default {
  loadLibrary,
  createFolder,
  updateFolder,
  moveFolder,
  trashFolder,
  restoreFolder,
  deleteFolderForever,
  getItem,
  createNote,
  saveNote,
  createLink,
  updateItem,
  moveItem,
  markItemOpened,
  trashItem,
  restoreItem,
  deleteItemForever,
  uploadFileItem,
  uploadNoteImage,
  getSignedUrl,
  getSignedUrls,
  loadTrash,
  searchLibrary,
  friendlyError,
};
