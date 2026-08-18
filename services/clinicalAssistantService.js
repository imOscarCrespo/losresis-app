import { fetch } from "expo/fetch";
import { supabase } from "../config/supabase";

const MAX_REMOTE_MESSAGES = 24;
const FUNCTION_SLUG = "losresis-llm";
const FALLBACK_ERROR = "No se pudo contactar con el asistente clínico.";
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

const parseSseLine = (line) => {
  if (!line.startsWith("data:")) {
    return { content: "", reasoning: "" };
  }

  const data = line.replace(/^data:\s?/, "");
  if (!data || data === "[DONE]") {
    return { content: "", reasoning: "" };
  }

  try {
    const payload = JSON.parse(data);
    return {
      content: getContentFromPayload(payload),
      reasoning: getReasoningFromPayload(payload),
    };
  } catch {
    return { content: data, reasoning: "" };
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

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    lines.forEach((line) => {
      const chunk = parseSseLine(line.trim());
      if (chunk.reasoning) {
        reasoning += chunk.reasoning;
      }
      if (chunk.content) {
        content += chunk.content;
      }
      if (chunk.content || chunk.reasoning) {
        onChunk?.(chunk.content, content, reasoning);
      }
    });
  }

  buffer += decoder.decode();
  buffer
    .split(/\r?\n/)
    .map((line) => parseSseLine(line.trim()))
    .filter((chunk) => chunk.content || chunk.reasoning)
    .forEach((chunk) => {
      if (chunk.reasoning) {
        reasoning += chunk.reasoning;
      }
      if (chunk.content) {
        content += chunk.content;
      }
      onChunk?.(chunk.content, content, reasoning);
    });

  return { content, reasoning };
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

    const fallbackResult =
      streamedResult === null ? await readFallbackResponse(response) : null;
    const content =
      streamedResult === null
        ? fallbackResult.content
        : normalizeContent(streamedResult.content);
    const reasoning =
      streamedResult === null
        ? fallbackResult.reasoning || ""
        : normalizeContent(streamedResult.reasoning);

    if (!content) {
      return {
        success: false,
        content: "",
        error: "El asistente no devolvió una respuesta válida.",
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
