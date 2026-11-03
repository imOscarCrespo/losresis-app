import { File } from "expo-file-system";
import { supabase } from "../config/supabase";

/**
 * Sube un fichero local (file://, el que devuelven image-picker, la cámara y
 * document-picker) a un bucket de Supabase Storage.
 *
 * No usar FormData: desde @supabase/storage-js 2.8x, upload() llama a
 * FormData.has(), que el FormData de React Native no implementa. La subida
 * revienta con "body.has is not a function" antes de salir del móvil (en Jest
 * no se ve porque el FormData de Node sí lo tiene). Se leen los bytes del
 * fichero y se suben tal cual, con el content-type en la cabecera.
 *
 * Devuelve lo mismo que supabase.storage.from(bucket).upload(): { data, error }.
 */
export const uploadLocalFile = async (bucket, path, uri, { contentType, upsert = false, cacheControl } = {}) => {
  const body = await new File(uri).arrayBuffer();
  const options = { contentType, upsert };
  if (cacheControl) options.cacheControl = cacheControl;
  return supabase.storage.from(bucket).upload(path, body, options);
};
