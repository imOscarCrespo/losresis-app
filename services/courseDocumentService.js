import { supabase } from "../config/supabase";
import { orderCourseDocuments } from "../utils/courseDocuments";

/**
 * PDFs del curso (información, programa, material para revisar).
 *
 * El bucket `course-documents` es PRIVADO: solo lo leen residentes, médicos y el
 * organizador del curso (RLS en la tabla y en storage). Para abrir un PDF se firma
 * una URL que caduca enseguida; no se guarda ni se reutiliza, así el residente abre
 * siempre la versión vigente.
 */

const BUCKET = "course-documents";
const SIGNED_URL_SECONDS = 300;

export const getCourseDocuments = async (courseId) => {
  if (!courseId) return { success: true, data: [] };

  const { data, error } = await supabase
    .from("course_document")
    .select("id, kind, storage_path, file_name, updated_at")
    .eq("course_id", courseId);

  if (error) {
    console.error("Error fetching course documents:", error);
    return { success: false, data: [] };
  }

  return { success: true, data: orderCourseDocuments(data) };
};

export const getCourseDocumentUrl = async (path) => {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error) {
    console.error("Error signing course document:", error);
    return null;
  }

  return data?.signedUrl || null;
};
