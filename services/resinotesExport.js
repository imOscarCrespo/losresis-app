import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";
import { getSignedUrls, loadExportData } from "./resinotesService";
import {
  buildExportPlan,
  descendantIds,
  exportFileName,
  linkToExportHtml,
  noteAssetsDir,
  noteToExportHtml,
  sanitizeFileName,
  storedImageKeys,
  uniqueName,
} from "../utils/resinotes";

/**
 * ResiNotes (ClickUp 124b4z9w0qg, pasada B): exportar una nota, una carpeta o
 * toda la biblioteca.
 *
 *   * Una nota: un .html autónomo (las imágenes van dentro como data: URI).
 *   * Una carpeta o la biblioteca: un ZIP con la misma estructura de carpetas,
 *     cada nota en .html con sus imágenes en «<nota>_archivos/», las fotos y los
 *     PDFs con su fichero original y cada enlace en un .html que lleva a él.
 *
 * HTML y no Markdown: conserva tablas, bloques especiales, resaltado y casillas,
 * y lo abre cualquier navegador, Word o Pages.
 *
 * El ZIP se escribe por trozos (fflate en streaming + FileHandle), así que un
 * PDF de 20 MB no se carga entero en memoria. Las fotos y los PDFs no se
 * comprimen (ya lo están). La E/S llega por `io` para poder probarlo sin móvil.
 */

const READ_CHUNK = 512 * 1024;
const URL_TTL = 60 * 60;

/** Los ficheros de un elemento, para poner nombre a las imágenes de una nota. */
const attachmentByKey = (item) =>
  new Map((item?.resinotes_attachments || []).map((a) => [a.storage_key, a]));

const relativeSrc = (dir, name) =>
  `${encodeURIComponent(dir.replace(/\/$/, ""))}/${encodeURIComponent(name)}`;

const signAll = async (keys) => {
  const unique = Array.from(new Set(keys.filter(Boolean)));
  const urls = {};
  for (let i = 0; i < unique.length; i += 100) {
    Object.assign(urls, await getSignedUrls(unique.slice(i, i + 100), URL_TTL));
  }
  return urls;
};

/** Claves de storage que necesita un plan (ficheros e imágenes de notas). */
export const planStorageKeys = (entries) =>
  entries.flatMap((e) => {
    if (e.kind === "file") return [e.attachment.storage_key];
    if (e.kind === "note") return storedImageKeys(e.item.content);
    return [];
  });

/**
 * Escribe el ZIP de un plan. Si un fichero no se puede descargar, sigue con el
 * resto y lo devuelve en `failed`.
 *
 * @param {{entries: object[], urlsByKey: Record<string,string>, io: object, onProgress?: Function}} args
 *   io.createOutput() → { write(bytes), close() }
 *   io.download(url) → Promise<{ read(n): Uint8Array, cleanup(): void }> (read devuelve vacío al acabar)
 */
export const writeExportZip = async ({ entries, urlsByKey, io, onProgress }) => {
  const out = io.createOutput();
  const failed = [];
  const total = entries.filter((e) => e.kind !== "dir").length;
  let done = 0;

  try {
    await new Promise((resolve, reject) => {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          out.write(chunk);
        } catch (writeError) {
          reject(writeError);
          return;
        }
        if (final) resolve();
      });

      const addText = (path, text) => {
        const file = new ZipDeflate(path, { level: 6 });
        zip.add(file);
        file.push(strToU8(text), true);
      };

      // La descarga va antes de abrir la entrada del ZIP: si falla, se salta el
      // fichero y el ZIP sigue bien. Si algo falla ya escribiendo, se aborta
      // todo (una entrada a medias rompería el ZIP).
      const tryStream = async (path, key, label) => {
        const url = urlsByKey[key];
        let source = null;
        try {
          if (!url) throw new Error("NO_URL");
          source = await io.download(url);
        } catch {
          failed.push(label);
          return false;
        }
        try {
          const file = new ZipPassThrough(path);
          zip.add(file);
          let chunk = source.read(READ_CHUNK);
          if (!chunk || !chunk.length) {
            file.push(new Uint8Array(0), true);
            return true;
          }
          for (;;) {
            const next = source.read(READ_CHUNK);
            const last = !(next && next.length);
            file.push(chunk, last);
            if (last) break;
            chunk = next;
          }
          return true;
        } finally {
          source.cleanup();
        }
      };

      (async () => {
        try {
          for (const entry of entries) {
            if (entry.kind === "dir") {
              const dir = new ZipPassThrough(entry.path);
              zip.add(dir);
              dir.push(new Uint8Array(0), true);
              continue;
            }

            if (entry.kind === "note") {
              const keys = storedImageKeys(entry.item.content);
              const assetsDir = noteAssetsDir(entry.path);
              const assetsName = assetsDir.split("/").filter(Boolean).pop();
              const byKey = attachmentByKey(entry.item);
              const used = new Set();
              const srcByKey = {};
              for (const key of keys) {
                const name = uniqueName(
                  used,
                  sanitizeFileName((byKey.get(key)?.filename || key.split("/").pop()).replace(/\.[a-z0-9]{1,5}$/i, ""), "imagen"),
                  `.${(byKey.get(key)?.filename || key).split(".").pop().toLowerCase()}`
                );
                if (await tryStream(`${assetsDir}${name}`, key, `${entry.item.title} · ${name}`)) {
                  srcByKey[key] = relativeSrc(assetsName, name);
                }
              }
              addText(
                entry.path,
                noteToExportHtml({
                  title: entry.item.title,
                  html: entry.item.content,
                  updatedAt: entry.item.updated_at,
                  imageSrcByKey: srcByKey,
                })
              );
            } else if (entry.kind === "link") {
              addText(entry.path, linkToExportHtml({ title: entry.item.title, url: entry.item.url }));
            } else if (entry.kind === "file") {
              await tryStream(entry.path, entry.attachment.storage_key, entry.item.title);
            }

            done += 1;
            onProgress?.(done, total);
          }
          zip.end();
        } catch (error) {
          reject(error);
        }
      })();
    });
  } finally {
    out.close();
  }
  return { failed };
};

// ---------------------------------------------------------------------------
// E/S real (expo-file-system) y compartir
// ---------------------------------------------------------------------------

const loadFs = () => import("expo-file-system");

const createDeviceIo = async (zipName) => {
  const { File, Paths } = await loadFs();
  const target = new File(Paths.cache, `${zipName}.zip`);
  if (target.exists) target.delete();
  target.create();

  return {
    target,
    io: {
      createOutput: () => {
        const handle = target.open();
        return {
          write: (bytes) => handle.writeBytes(bytes),
          close: () => handle.close(),
        };
      },
      download: async (url) => {
        const tmp = new File(Paths.cache, `resinotes-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const file = await File.downloadFileAsync(url, tmp);
        const handle = file.open();
        return {
          read: (n) => handle.readBytes(n),
          cleanup: () => {
            try {
              handle.close();
            } catch {
              // nada
            }
            try {
              file.delete();
            } catch {
              // nada
            }
          },
        };
      },
    },
  };
};

const share = async (uri, { mimeType, uti, dialogTitle }) => {
  const Sharing = await import("expo-sharing");
  if (!(await Sharing.isAvailableAsync())) {
    const err = new Error("SHARING_UNAVAILABLE");
    err.userMessage = "Este dispositivo no permite compartir archivos.";
    throw err;
  }
  await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle });
};

/**
 * Exporta una carpeta (con todas sus subcarpetas) o, sin folderId, toda la
 * biblioteca, y abre el menú de compartir con el ZIP.
 */
export const exportFolderZip = async (userId, { folderId = null, folders = [], onProgress, beforeShare } = {}) => {
  const subtree = folderId ? [folderId, ...descendantIds(folders, folderId)] : null;
  const data = await loadExportData(userId, { folderIds: subtree });
  const entries = buildExportPlan({ folders: data.folders, items: data.items, rootFolderId: folderId });
  const root = folderId ? data.folders.find((f) => f.id === folderId) : null;
  if (folderId && !root) throw new Error("not_found");

  const urlsByKey = await signAll(planStorageKeys(entries));
  const zipName = exportFileName(root?.name || null);
  const { target, io } = await createDeviceIo(zipName);
  const { failed } = await writeExportZip({ entries, urlsByKey, io, onProgress });

  beforeShare?.();
  await share(target.uri, { mimeType: "application/zip", uti: "public.zip-archive", dialogTitle: zipName });
  return { failed, count: entries.filter((e) => e.kind !== "dir").length };
};

/** Exporta una nota como un .html autónomo y abre el menú de compartir. */
export const exportNoteHtml = async (userId, itemId, { beforeShare } = {}) => {
  const data = await loadExportData(userId, { itemIds: [itemId] });
  const item = data.items[0];
  if (!item || item.type !== "note") throw new Error("not_found");

  const keys = storedImageKeys(item.content);
  const urls = await signAll(keys);
  const byKey = attachmentByKey(item);
  const { File, Paths } = await loadFs();
  const srcByKey = {};
  const failed = [];
  for (const key of keys) {
    const tmp = new File(Paths.cache, `resinotes-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    try {
      if (!urls[key]) throw new Error("NO_URL");
      const file = await File.downloadFileAsync(urls[key], tmp);
      const mime = byKey.get(key)?.mime_type || "image/jpeg";
      srcByKey[key] = `data:${mime};base64,${await file.base64()}`;
      file.delete();
    } catch {
      failed.push(byKey.get(key)?.filename || "imagen");
      try {
        if (tmp.exists) tmp.delete();
      } catch {
        // nada
      }
    }
  }

  const name = sanitizeFileName(item.title, "Nota");
  const target = new File(Paths.cache, `${name}.html`);
  if (target.exists) target.delete();
  target.create();
  target.write(noteToExportHtml({ title: item.title, html: item.content, updatedAt: item.updated_at, imageSrcByKey: srcByKey }));

  beforeShare?.();
  await share(target.uri, { mimeType: "text/html", uti: "public.html", dialogTitle: name });
  return { failed };
};

export default { exportFolderZip, exportNoteHtml, writeExportZip, planStorageKeys };
