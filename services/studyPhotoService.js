import { fetch } from "expo/fetch";
import { supabase } from "../config/supabase";
import {
  getFunctionUrl,
  readFallbackResponse,
  readStreamingResponse,
} from "./clinicalAssistantService";

const STUDY_PHOTO_BUCKET = "study-photo-uploads";
const FALLBACK_ERROR = "No se pudo analizar la imagen. Inténtalo de nuevo.";

// Resuelve la URL pública de una foto de estudio a partir de su path en storage.
export const getStudyPhotoUrl = (imagePath) => {
  if (!imagePath) return null;
  return (
    supabase.storage.from(STUDY_PHOTO_BUCKET).getPublicUrl(imagePath).data
      ?.publicUrl || null
  );
};

// Sube la foto al bucket study-photo-uploads y devuelve su path (no la URL:
// el path es lo que persiste la tarjeta y lo que consume el edge function).
export const uploadStudyPhoto = async (userId, imageUri) => {
  try {
    const fileExt = (imageUri.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      name: fileName,
      type: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
    });

    const { error } = await supabase.storage
      .from(STUDY_PHOTO_BUCKET)
      .upload(filePath, formData, { cacheControl: "3600", upsert: false });

    if (error) {
      return { success: false, path: null, error: error.message };
    }
    return { success: true, path: filePath, error: null };
  } catch (error) {
    return { success: false, path: null, error: error.message };
  }
};

// Borra una foto subida que no llegó a guardarse como tarjeta (o cuya tarjeta
// se eliminó), para no dejar huérfanos en el bucket.
export const removeStudyPhoto = async (imagePath) => {
  if (!imagePath) return { success: true, error: null };
  try {
    const { error } = await supabase.storage
      .from(STUDY_PHOTO_BUCKET)
      .remove([imagePath]);
    return { success: !error, error: error?.message || null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Pide al edge function losresis-llm (modo "estudio") que analice la foto ya
// subida. El servidor descarga la imagen del bucket y la envía a Kimi, así el
// cliente solo manda el path. Respuesta en streaming vía onChunk.
export const analyzeStudyPhoto = async ({ imagePath, onChunk } = {}) => {
  if (!imagePath) {
    return { success: false, content: "", error: "Sube primero una imagen." };
  }

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return {
        success: false,
        content: "",
        error: "Inicia sesión para usar esta funcionalidad.",
      };
    }

    const response = await fetch(getFunctionUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "estudio",
        imagePath,
        stream: true,
      }),
    });

    if (!response.ok) {
      const fallback = await readFallbackResponse(response);
      return {
        success: false,
        content: "",
        error: fallback.error || FALLBACK_ERROR,
      };
    }

    const contentType = response.headers?.get?.("content-type") || "";
    const streamedResult = contentType.includes("text/event-stream")
      ? await readStreamingResponse(response, onChunk)
      : null;

    const fallbackResult =
      streamedResult === null ? await readFallbackResponse(response) : null;
    const content = (
      streamedResult === null ? fallbackResult.content : streamedResult.content
    )?.trim();

    if (!content) {
      return {
        success: false,
        content: "",
        error: "El análisis no devolvió una respuesta válida.",
      };
    }

    onChunk?.("", content, "");

    return { success: true, content, error: null };
  } catch (error) {
    return { success: false, content: "", error: error.message || FALLBACK_ERROR };
  }
};

// Extrae la sección "Resumen" del markdown para usarla como preview de la
// tarjeta (acepta también el encabezado 📷 de respuestas antiguas). Si el
// formato no aparece, devuelve null.
export const extractCardSummary = (explanation) => {
  if (typeof explanation !== "string") return null;
  const match = explanation.match(
    /###\s*(?:🏷️|📷)[^\n]*\n+([\s\S]*?)(?=\n###|$)/
  );
  const extracted = match?.[1]?.trim();
  return extracted ? extracted.slice(0, 500) : null;
};

export const saveStudyCard = async ({
  userId,
  imagePath,
  explanation,
  extractedQuestion = null,
  speciality = null,
  topics = [],
} = {}) => {
  try {
    const { data, error } = await supabase
      .from("study_photo_cards")
      .insert({
        user_id: userId,
        image_path: imagePath,
        explanation,
        extracted_question: extractedQuestion,
        speciality,
        topics,
      })
      .select(
        "id, image_path, extracted_question, explanation, speciality, topics, created_at"
      )
      .single();

    if (error) {
      return { success: false, card: null, error: error.message };
    }
    return { success: true, card: data, error: null };
  } catch (error) {
    return { success: false, card: null, error: error.message };
  }
};

// Actualiza la clasificación (especialidad y temas) de una tarjeta existente.
export const updateStudyCardTags = async (
  userId,
  cardId,
  { speciality = null, topics = [] } = {}
) => {
  try {
    const { data, error } = await supabase
      .from("study_photo_cards")
      .update({ speciality, topics })
      .eq("id", cardId)
      .eq("user_id", userId)
      .select(
        "id, image_path, extracted_question, explanation, speciality, topics, created_at"
      )
      .single();

    if (error) {
      return { success: false, card: null, error: error.message };
    }
    return { success: true, card: data, error: null };
  } catch (error) {
    return { success: false, card: null, error: error.message };
  }
};

export const getStudyCards = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("study_photo_cards")
      .select(
        "id, image_path, extracted_question, explanation, speciality, topics, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, cards: [], error: error.message };
    }
    return { success: true, cards: data || [], error: null };
  } catch (error) {
    return { success: false, cards: [], error: error.message };
  }
};

export const deleteStudyCard = async (userId, card) => {
  try {
    const { error } = await supabase
      .from("study_photo_cards")
      .delete()
      .eq("id", card.id)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // La imagen solo la referencia esta tarjeta: la limpiamos del bucket.
    await removeStudyPhoto(card.image_path);

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
