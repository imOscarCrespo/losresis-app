import { supabase } from "../config/supabase";

/**
 * Los adjuntos del Libro del Residente.
 *
 * Son la PRUEBA de lo que el residente declara: la presentación de la sesión clínica
 * que dio, el PDF del artículo que publicó. El tutor activa la casilla «Documento
 * adjunto» desde el panel precisamente para poder abrirlos, así que subir sin que él
 * pueda leerlos no serviría de nada.
 *
 * El bucket es PRIVADO. Eso tiene dos consecuencias que conviene no olvidar:
 *
 *  1. Para verlo hace falta una URL firmada (createSignedUrl), no getPublicUrl como
 *     en feed o housing, que van a buckets públicos.
 *  2. En el PDF del libro el adjunto solo puede aparecer listado por su nombre: no se
 *     puede incrustar un fichero al que hay que autenticarse para llegar.
 *
 * La ruta es `{user_id}/{apartado}/{fichero}`. El apartado no lo usa ninguna política
 * hoy; está para poder estrechar el acceso por apartado más adelante sin mover
 * ficheros ya subidos.
 */

const BUCKET = "libro-attachments";

// Lo que el bucket acepta. Está declarado también en la migración que lo crea; si
// cambia allí, cambia aquí.
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_BYTES = 10 * 1024 * 1024;

const extensionFor = (mime, fallbackName = "") => {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";

  const guess = String(fallbackName).split(".").pop();
  return guess && guess.length <= 5 ? guess.toLowerCase() : "bin";
};

/**
 * Sube un adjunto y devuelve lo que se guarda en libro_entry.payload.
 *
 * El payload lleva un OBJETO, no el nombre a secas: sin la ruta no hay forma de
 * volver a encontrar el fichero, y sin el nombre original no hay nada legible que
 * enseñar. Quien lo pinte usa `name`; quien lo abra, `path`.
 *
 * @param {{userId: string, section: string, file: {uri: string, name?: string, mimeType?: string, size?: number}}} params
 * @returns {Promise<{path: string, name: string, mime: string, size: number|null}>}
 */
export const uploadLibroAttachment = async ({ userId, section, file }) => {
  if (!userId || !section || !file?.uri) {
    throw new Error("userId, section y file son obligatorios");
  }

  const mime = file.mimeType || "image/jpeg";

  if (!ALLOWED_MIME.includes(mime)) {
    throw new Error("Solo se admiten PDF, JPG, PNG o WebP");
  }

  if (file.size && file.size > MAX_BYTES) {
    throw new Error("El fichero no puede pasar de 10 MB");
  }

  const name = file.name || `adjunto.${extensionFor(mime)}`;
  // El nombre en storage no es el del usuario: dos ficheros con el mismo nombre se
  // pisarían, y un nombre con acentos o espacios da problemas en la ruta.
  const storageName = `${Date.now()}.${extensionFor(mime, name)}`;
  const path = `${userId}/${section}/${storageName}`;

  const formData = new FormData();
  formData.append("file", { uri: file.uri, name: storageName, type: mime });

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, formData, { contentType: mime, upsert: false });

  if (error) {
    console.error("Error uploading libro attachment:", error);
    throw error;
  }

  return {
    path: data.path,
    name,
    mime,
    size: file.size ?? null,
  };
};

/**
 * URL temporal para abrir un adjunto. El bucket es privado, así que sin firmar no hay
 * forma de verlo.
 */
export const getLibroAttachmentUrl = async (path, expiresInSeconds = 300) => {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("Error signing libro attachment:", error);
    return null;
  }

  return data?.signedUrl || null;
};

export const removeLibroAttachment = async (path) => {
  if (!path) return;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    // No se propaga: si el fichero ya no está, quitarlo del registro sigue siendo lo
    // correcto. Quedaría un huérfano en el bucket, que es menos malo que dejar al
    // residente con un adjunto que no puede quitar.
    console.error("Error removing libro attachment:", error);
  }
};

/** Lo que se enseña de un adjunto guardado, sea objeto nuevo o texto antiguo. */
export const describeLibroAttachment = (value) => {
  if (!value) return null;
  if (typeof value === "string") return { name: value, path: null };

  return { name: value.name || "Documento", path: value.path || null };
};

export default {
  uploadLibroAttachment,
  getLibroAttachmentUrl,
  removeLibroAttachment,
  describeLibroAttachment,
};
