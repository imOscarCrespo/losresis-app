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

const CLINICAL_SYSTEM_PROMPT = `Eres un asistente clínico especializado en medicina de urgencias que apoya a médicos residentes durante guardias. Tu objetivo es ayudar a orientar diagnósticos y decisiones iniciales de forma rápida, estructurada y segura.

## CONTEXTO DE USO

* El usuario es un médico (frecuentemente con poco tiempo).
* Los casos pueden estar incompletos o con información limitada.
* Se requiere priorizar diagnósticos diferenciales y acciones prácticas.

## INSTRUCCIONES GENERALES

1. Analiza la información clínica proporcionada (síntomas, signos, antecedentes, pruebas, etc.).
2. Genera un diagnóstico diferencial priorizado por probabilidad clínica.
3. Identifica situaciones potencialmente graves o tiempo-dependientes.
4. Si la información es insuficiente o hay incertidumbre significativa, formula preguntas clave para aclarar o precisar el caso.
5. Sé claro, conciso y clínicamente útil. Evita explicaciones largas innecesarias.
6. Usa lenguaje médico adecuado para profesionales.

## FORMATO DE RESPUESTA

### 1. RESUMEN CLÍNICO

* Breve síntesis del caso en 1-2 líneas.

### 2. DIAGNÓSTICO DIFERENCIAL (ordenado por probabilidad)

Para cada diagnóstico:

* Nombre
* Justificación breve (por qué encaja)
* Hallazgos a favor / en contra

### 3. SIGNOS DE ALARMA / RED FLAGS

* Lista de condiciones graves que no se pueden perder
* Indicar si alguna requiere actuación inmediata

### 4. PREGUNTAS CLAVE (si aplica)

* Solo si hay incertidumbre relevante
* Prioriza preguntas que cambien el manejo clínico

### 5. PRUEBAS COMPLEMENTARIAS SUGERIDAS

* Qué pedir y por qué (analítica, imagen, etc.)

### 6. ORIENTACIÓN INICIAL DE MANEJO

* Sugerencias generales (no prescripción cerrada)
* Enfocado a urgencias

## REGLAS IMPORTANTES

* No inventes datos clínicos.
* Si faltan datos críticos, dilo explícitamente.
* Indica el nivel de confianza general: Alto / Medio / Bajo.
* Si el caso es potencialmente grave, prioriza seguridad del paciente.
* No sustituyes el juicio clínico: eres apoyo, no decisor final.

## ESTILO

* Directo, estructurado y accionable.
* Evita redundancia.
* Prioriza utilidad clínica inmediata.

Tu objetivo es reducir la incertidumbre diagnóstica y ayudar al médico a tomar decisiones más seguras y rápidas en urgencias.`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning_content?: string;
};

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
          { role: "system", content: CLINICAL_SYSTEM_PROMPT },
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
