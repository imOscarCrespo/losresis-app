import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MOONSHOT_API_KEY = Deno.env.get("MOONSHOT_API_KEY");
const MOONSHOT_BASE_URL =
  Deno.env.get("MOONSHOT_BASE_URL") || "https://api.moonshot.ai/v1";
const MOONSHOT_MODEL = Deno.env.get("MOONSHOT_MODEL") || "kimi-k2.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_ASSISTANT_MODE = "guardia";
const CLINICAL_SYSTEM_PROMPTS = {
  guardia: `Eres un asistente clínico de apoyo para médicos residentes en España durante guardias hospitalarias. Tu función es dar respuestas rápidas, estructuradas y seguras. El residente tiene poco tiempo y alta presión. Nunca puedes omitir información crítica de seguridad.

## ROL
Actúas como un médico adjunto experimentado que da una respuesta directa y sin relleno. No eres un chatbot genérico: conoces el sistema sanitario español, los protocolos habituales de hospitales españoles, la nomenclatura MIR y el contexto de guardia.

## FORMATO DE RESPUESTA OBLIGATORIO
Responde SIEMPRE con esta estructura, sin excepciones:

### ⚠️ RED FLAGS — Descartar YA
- [Lista de signos/síntomas que requieren acción inmediata o cambio de manejo]

### 🔍 CHECKLIST DIAGNÓSTICO
- [ ] [Paso 1]
- [ ] [Paso 2]
- [ ] [...]
(Ordenado por prioridad clínica, no alfabéticamente)

### 💊 MANEJO INMEDIATO
- [Acción 1]
- [Acción 2]
(Solo lo que se puede/debe hacer ahora mismo)

### 🔄 NO OLVIDAR
- [Detalle que los residentes suelen pasar por alto]
- [Interacción farmacológica, contraindicación o condición especial relevante]

### 📞 ESCALAR SI...
- [Condición 1 que requiere avisar al adjunto o especialista]

---

## REGLAS ESTRICTAS
1. **Brevedad sin sacrificar seguridad**: cada punto debe ser accionable, no decorativo.
2. **Sin disclaimers genéricos** del tipo "consulta con un profesional" — el usuario ES el profesional.
3. Si hay incertidumbre real sobre el caso, indícala con 🟡 y da la opción más conservadora.
4. Usa terminología clínica española (no traduzcas literalmente del inglés).
5. Si la pregunta es ambigua, haz UNA sola pregunta clarificadora antes de responder.
6. Nunca inventes dosis, protocolos o guías. Si no estás seguro de una dosis específica, indica la fuente a consultar (ej: "verificar en ficha técnica / Vademécum").
7. Máximo 250 palabras en la respuesta completa.`,
  consulta: `Eres un asistente clínico avanzado para médicos residentes MIR en España. Tu objetivo es dar respuestas completas, razonadas y basadas en evidencia, como lo haría un adjunto senior o un tutor de residencia con tiempo para explicar.

## ROL
Combinas el rol de tutor clínico y consultor: no solo das la respuesta, sino que construyes el razonamiento clínico detrás. Conoces el contexto del sistema MIR, las guías clínicas españolas y europeas vigentes, y la realidad asistencial de un hospital español.

### 🧠 RAZONAMIENTO CLÍNICO
Explica brevemente el marco conceptual del problema: fisiopatología relevante, por qué se presentan estos síntomas, qué mecanismos hay que tener en cuenta.

### 🔍 DIAGNÓSTICO DIFERENCIAL
Lista los diagnósticos ordenados por probabilidad según el contexto clínico presentado. Para cada uno indica:
- Por qué entra en el diferencial
- Qué lo apoya / qué lo descarta
- Cómo distinguirlo de los demás

### 📋 PLAN DE ESTUDIO / MANEJO
Paso a paso del abordaje diagnóstico y terapéutico. Incluye:
- Pruebas complementarias justificadas (no "pedir todo")
- Umbrales de decisión relevantes
- Opciones terapéuticas con evidencia

### ⚠️ ERRORES FRECUENTES EN ESTE CASO
- [Pitfall 1 que comete un residente sin experiencia]
- [Pitfall 2]

### 📚 EVIDENCIA Y GUÍAS
- Guía o sociedad de referencia (española/europea preferentemente)
- Nivel de evidencia si es relevante
- Año de la guía (indicar si puede estar desactualizada)

### 💡 PERLA CLÍNICA
Un dato práctico, mnemotécnico o matiz que marca la diferencia en el manejo real.

---

## REGLAS
1. **Razona, no recites**: no hagas listas de Wikipedia. Conecta los conceptos.
2. **Contextualiza al sistema español**: nombra protocolos, especialidades de guardia, recursos disponibles en un hospital español estándar.
3. **Sé honesto con la incertidumbre**: si hay controversia en la literatura, preséntala como tal.
4. Sin disclaimers genéricos — el usuario es médico residente en ejercicio.
5. Nunca inventes referencias, dosis exactas o datos de estudios. Si no estás seguro, indícalo explícitamente.
6. Si la pregunta es clínicamente incompleta, pide los datos que cambiarían el manejo antes de responder (edad, comorbilidades, contexto agudo vs crónico).
7. Longitud ideal: 400–700 palabras. Extensión mayor solo si la complejidad lo justifica.`,
} as const;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning_content?: string;
};

type AssistantMode = keyof typeof CLINICAL_SYSTEM_PROMPTS;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const streamResponse = (body: ReadableStream<Uint8Array>) =>
  new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });

const normalizeMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((message) => {
      if (
        !message ||
        typeof message !== "object" ||
        !("role" in message) ||
        !("content" in message)
      ) {
        return null;
      }

      const role = (message as { role?: unknown }).role;
      const content = (message as { content?: unknown }).content;

      if (
        (role !== "user" && role !== "assistant") ||
        typeof content !== "string"
      ) {
        return null;
      }

      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return null;
      }

      const reasoningContent =
        typeof (message as { reasoning_content?: unknown }).reasoning_content ===
        "string"
          ? ((message as { reasoning_content?: string }).reasoning_content || "")
              .trim()
              .slice(0, 12000)
          : "";

      return {
        role,
        content: trimmedContent.slice(0, 12000),
        ...(role === "assistant" && reasoningContent
          ? { reasoning_content: reasoningContent }
          : {}),
      };
    })
    .filter((message): message is ChatMessage => Boolean(message))
    .slice(-24);
};

const normalizeAssistantMode = (value: unknown): AssistantMode =>
  value === "consulta" ? "consulta" : DEFAULT_ASSISTANT_MODE;

const createAssistantStream = (kimiBody: ReadableStream<Uint8Array>) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = kimiBody.getReader();
      let buffer = "";

      const enqueueContent = (content: string) => {
        if (!content) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
        );
      };
      const enqueueReasoning = (reasoning: string) => {
        if (!reasoning) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ reasoning })}\n\n`)
        );
      };

      let loggedChunkShape = false;

      const getDeltaText = (payload: unknown, key: string) => {
        if (!payload || typeof payload !== "object") return "";

        const directValue = (payload as Record<string, unknown>)[key];
        if (typeof directValue === "string") return directValue;

        const choices = (payload as { choices?: unknown }).choices;
        if (!Array.isArray(choices)) return "";

        const firstChoice = choices[0] as
          | {
              delta?: Record<string, unknown>;
              message?: Record<string, unknown>;
            }
          | undefined;
        const deltaValue = firstChoice?.delta?.[key];
        if (typeof deltaValue === "string") return deltaValue;

        const messageValue = firstChoice?.message?.[key];
        if (typeof messageValue === "string") return messageValue;

        return "";
      };

      const processLine = (line: string) => {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith("data:")) return;

        const data = trimmedLine.replace(/^data:\s?/, "");
        if (!data || data === "[DONE]") return;

        try {
          const payload = JSON.parse(data);
          const reasoning = getDeltaText(payload, "reasoning_content");
          const content = getDeltaText(payload, "content");

          if (!loggedChunkShape && !reasoning && !content) {
            loggedChunkShape = true;
            const choice = payload?.choices?.[0];
            console.warn("Kimi stream chunk without text fields:", {
              topLevelKeys: Object.keys(payload || {}),
              deltaKeys: Object.keys(choice?.delta || {}),
              messageKeys: Object.keys(choice?.message || {}),
            });
          }

          if (reasoning) {
            enqueueReasoning(reasoning);
          }
          if (content) {
            enqueueContent(content);
          }
        } catch (error) {
          console.error("Invalid Kimi stream chunk:", error);
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          lines.forEach(processLine);
        }

        buffer += decoder.decode();
        buffer.split(/\r?\n/).forEach(processLine);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        console.error("Kimi stream read error:", error);
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              error: "No se pudo completar la respuesta del asistente clínico.",
            })}\n\n`
          )
        );
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MOONSHOT_API_KEY) {
  throw new Error(
    "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or MOONSHOT_API_KEY"
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, is_resident")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return jsonResponse({ error: "No se pudo validar el perfil." }, 500);
    }

    if (!profile?.is_resident) {
      return jsonResponse({ error: "Acceso disponible solo para residentes." }, 403);
    }

    const payload = await req.json().catch(() => null);
    const messages = normalizeMessages(payload?.messages);
    const assistantMode = normalizeAssistantMode(payload?.mode);
    const shouldStream = payload?.stream === true;

    if (!messages.length || messages[messages.length - 1]?.role !== "user") {
      return jsonResponse({ error: "Mensaje clínico requerido." }, 400);
    }

    const kimiResponse = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOONSHOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MOONSHOT_MODEL,
        messages: [
          { role: "system", content: CLINICAL_SYSTEM_PROMPTS[assistantMode] },
          ...messages,
        ],
        thinking: { type: "enabled" },
        max_tokens: 16000,
        temperature: 1.0,
        top_p: 0.95,
        stream: shouldStream,
      }),
    });

    if (!kimiResponse.ok) {
      const kimiPayload = await kimiResponse.json().catch(() => null);
      console.error("Kimi API error:", kimiPayload);
      return jsonResponse(
        { error: "No se pudo obtener respuesta del asistente clínico." },
        502
      );
    }

    if (shouldStream) {
      if (!kimiResponse.body) {
        return jsonResponse(
          { error: "El asistente no devolvió una respuesta válida." },
          502
        );
      }

      return streamResponse(createAssistantStream(kimiResponse.body));
    }

    const kimiPayload = await kimiResponse.json().catch(() => null);
    const content = kimiPayload?.choices?.[0]?.message?.content;
    const reasoning = kimiPayload?.choices?.[0]?.message?.reasoning_content;

    if (typeof content !== "string" || !content.trim()) {
      console.error("Invalid Kimi response:", kimiPayload);
      return jsonResponse(
        { error: "El asistente no devolvió una respuesta válida." },
        502
      );
    }

    return jsonResponse({
      content: content.trim(),
      reasoning: typeof reasoning === "string" ? reasoning.trim() : "",
    });
  } catch (error) {
    console.error("losresis-llm internal error:", error);
    return jsonResponse({ error: "Internal Error" }, 500);
  }
});
