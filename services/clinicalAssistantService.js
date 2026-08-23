import { fetch } from "expo/fetch";
import { supabase } from "../config/supabase";

const MAX_REMOTE_MESSAGES = 24;
const FUNCTION_SLUG = "losresis-llm";
const FALLBACK_ERROR = "No se pudo contactar con el asistente clínico.";
const TRUNCATED_ERROR =
  "La respuesta se cortó antes de terminar. Vuelve a preguntar.";
const EMPTY_RESPONSE_ERROR = "El asistente no devolvió una respuesta válida.";
const DEFAULT_ASSISTANT_MODE = "guardia";

const normalizeRole = (role) => {
  if (role === "assistant" || role === "user") {
    return role;
  }
  return null;
};

const normalizeContent = (content) =>
  typeof content === "string" ? content.trim() : "";

export const getFunctionUrl = () => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || supabase?.supabaseUrl;
  if (!supabaseUrl) {
    throw new Error("No se encontró la URL de Supabase.");
  }

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${FUNCTION_SLUG}`;
};

const getContentFromPayload = (payload) => {
  if (typeof payload?.content === "string") {
    return payload.content;
  }

  if (typeof payload?.delta === "string") {
    return payload.delta;
  }

  const kimiDelta = payload?.choices?.[0]?.delta?.content;
  if (typeof kimiDelta === "string") {
    return kimiDelta;
  }

  const kimiMessage = payload?.choices?.[0]?.message?.content;
  if (typeof kimiMessage === "string") {
    return kimiMessage;
  }

  return "";
};

const getReasoningFromPayload = (payload) => {
  if (typeof payload?.reasoning === "string") {
    return payload.reasoning;
  }

  if (typeof payload?.reasoning_content === "string") {
    return payload.reasoning_content;
  }

  const kimiDelta = payload?.choices?.[0]?.delta?.reasoning_content;
  if (typeof kimiDelta === "string") {
    return kimiDelta;
  }

  const kimiMessage = payload?.choices?.[0]?.message?.reasoning_content;
  if (typeof kimiMessage === "string") {
    return kimiMessage;
  }

  return "";
};

const getErrorFromPayload = (payload) => {
  if (typeof payload?.error === "string") {
    return payload.error;
  }

  if (typeof payload?.error?.message === "string") {
    return payload.error.message;
  }

  return "";
};

const EMPTY_CHUNK = { content: "", reasoning: "", error: "", done: false };

const parseSseLine = (line) => {
  if (!line.startsWith("data:")) {
    return EMPTY_CHUNK;
  }

  const data = line.replace(/^data:\s?/, "");
  if (!data) {
    return EMPTY_CHUNK;
  }

  // El "[DONE]" es la única prueba de que la respuesta llegó entera: la función
  // solo lo emite tras vaciar el stream de Kimi, y en su catch manda un
  // `event: error` en su lugar. Sin él, lo que hay en pantalla está a medias.
  if (data === "[DONE]") {
    return { ...EMPTY_CHUNK, done: true };
  }

  try {
    const payload = JSON.parse(data);
    return {
      content: getContentFromPayload(payload),
      reasoning: getReasoningFromPayload(payload),
      error: getErrorFromPayload(payload),
      done: false,
    };
  } catch {
    return { ...EMPTY_CHUNK, content: data };
  }
};

export const readStreamingResponse = async (response, onChunk) => {
  const reader = response.body?.getReader?.();
  if (!reader || typeof TextDecoder === "undefined") {
    return null;
  }

  const decoder = new TextDecoder();
  let content = "";
  let reasoning = "";
  let buffer = "";
  let error = "";
  let completed = false;

  const consumeLine = (line) => {
    const chunk = parseSseLine(line.trim());

    if (chunk.error) {
      // El servidor avisa de que abortó a mitad (`event: error`). Se queda el
      // primer error: lo que venga después ya no es una respuesta.
      error = error || chunk.error;
      return;
    }

    if (chunk.done) {
      completed = true;
      return;
    }

    if (chunk.reasoning) {
      reasoning += chunk.reasoning;
    }
    if (chunk.content) {
      content += chunk.content;
    }
    if (chunk.content || chunk.reasoning) {
      onChunk?.(chunk.content, content, reasoning);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    lines.forEach(consumeLine);
  }

  buffer += decoder.decode();
  buffer.split(/\r?\n/).forEach(consumeLine);

  return { content, reasoning, error, completed };
};

export const readFallbackResponse = async (response) => {
  const text = await response.text();

  if (text.includes("data:")) {
    const chunks = text
      .split(/\r?\n/)
      .map((line) => parseSseLine(line.trim()))
      .filter((chunk) => chunk.content || chunk.reasoning);
    const content = chunks.map((chunk) => chunk.content).join("");
    const reasoning = chunks.map((chunk) => chunk.reasoning).join("");

    if (content || reasoning) {
      return {
        content: normalizeContent(content),
        reasoning: normalizeContent(reasoning),
        error: "",
      };
    }
  }

  try {
    const payload = JSON.parse(text);
    return {
      content: normalizeContent(getContentFromPayload(payload)),
      reasoning: normalizeContent(getReasoningFromPayload(payload)),
      error: payload?.error,
    };
  } catch {
    return {
      content: normalizeContent(text),
      reasoning: "",
      error: "",
    };
  }
};

export const askClinicalAssistant = async (messages = [], options = {}) => {
  const { onChunk, mode } = options;
  const normalizedMode = mode === "consulta" ? "consulta" : DEFAULT_ASSISTANT_MODE;
  const normalizedMessages = messages
    .map((message) => ({
      role: normalizeRole(message?.role),
      content: normalizeContent(message?.content),
      ...(message?.role === "assistant" && normalizeContent(message?.reasoning)
        ? { reasoning_content: normalizeContent(message.reasoning) }
        : {}),
    }))
    .filter((message) => message.role && message.content)
    .slice(-MAX_REMOTE_MESSAGES);

  if (!normalizedMessages.length) {
    return {
      success: false,
      content: "",
      error: "Escribe una pregunta clínica para continuar.",
    };
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
        error: "Inicia sesión para usar el asistente clínico.",
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
        mode: normalizedMode,
        messages: normalizedMessages,
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

    if (streamedResult) {
      const content = normalizeContent(streamedResult.content);
      const reasoning = normalizeContent(streamedResult.reasoning);

      // Un stream que se corta (error del servidor o cierre sin "[DONE]") deja
      // media respuesta. En guardia eso es peor que no tener nada si se lee como
      // completa, así que se devuelve como fallo y marcado `truncated` para que
      // la pantalla lo enseñe con su aviso en vez de darlo por bueno.
      if (streamedResult.error || !streamedResult.completed) {
        return {
          success: false,
          content,
          reasoning,
          truncated: Boolean(content),
          error: streamedResult.error || TRUNCATED_ERROR,
        };
      }

      if (!content) {
        return {
          success: false,
          content: "",
          error: EMPTY_RESPONSE_ERROR,
        };
      }

      onChunk?.("", content, reasoning);

      return {
        success: true,
        content,
        reasoning,
        error: null,
      };
    }

    const fallbackResult = await readFallbackResponse(response);
    const content = fallbackResult.content;
    const reasoning = fallbackResult.reasoning || "";

    if (!content) {
      return {
        success: false,
        content: "",
        error: fallbackResult.error || EMPTY_RESPONSE_ERROR,
      };
    }

    onChunk?.("", content, reasoning);

    return {
      success: true,
      content,
      reasoning,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      content: "",
      error: error.message || FALLBACK_ERROR,
    };
  }
};
