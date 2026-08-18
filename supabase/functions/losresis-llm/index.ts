import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.177.0/encoding/base64.ts";
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
const CLINICAL_ASSISTANT_FEATURE_KEY = "clinical_assistant_chat";
const PHOTO_STUDY_FEATURE_KEY = "photo_study_analysis";
const STUDY_PHOTO_BUCKET = "study-photo-uploads";

const STUDY_SYSTEM_PROMPT = `Eres un tutor para estudiantes de medicina que preparan el examen MIR en España. El estudiante te envía la foto de una pregunta de examen (o de un apunte) que no entiende. Tu trabajo es explicárselo de forma tan sencilla que no le quede ninguna duda.

## FORMATO DE RESPUESTA OBLIGATORIO

### 🏷️ Resumen
[Una sola frase con el tipo de contenido y el tema, p. ej. "Pregunta tipo test sobre farmacología de los betabloqueantes" o "Apunte sobre el ciclo de Krebs". Sin transcribir la pregunta.]

### 🧒 Explicación sencilla
[Explica el concepto como si el estudiante tuviera 12 años: usa analogías cotidianas y cero jerga sin explicar. Primero la intuición, después el matiz técnico.]

### ✅ Respuesta razonada
[Si es una pregunta tipo test: cuál es la opción correcta y por qué, y por qué las demás opciones son incorrectas. Si no es tipo test: los 2-3 puntos clave del tema.]

### 🧠 Para que no se te olvide
[Una regla mnemotécnica, perla o truco para fijar el concepto de cara al MIR.]

## REGLAS
1. Escribe siempre en español.
2. Sencillez radical primero, precisión después. No sacrifiques la corrección clínica por simplificar.
3. Si la imagen no se lee bien o está incompleta, dilo claramente y explica solo lo que sí puedas leer.
4. Si la imagen no contiene material de estudio, responde únicamente: "No veo una pregunta o apunte en esta imagen. Sube una foto de la pregunta que quieras entender."
5. Nunca inventes datos: si no estás seguro de la respuesta correcta, preséntala como tu mejor razonamiento e indica la duda.
6. Máximo 450 palabras.`;

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

type AssistantMode = keyof typeof CLINICAL_SYSTEM_PROMPTS | "estudio";

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
  value === "consulta" || value === "estudio"
    ? value
    : DEFAULT_ASSISTANT_MODE;

// Construye los mensajes multimodales del modo "estudio": descarga la foto del
// bucket con service role (validando que pertenece al usuario) y la envía a
// Kimi como data URI base64 junto al pre-prompt de estudio.
const buildStudyMessages = async (
  userId: string,
  imagePathValue: unknown
): Promise<{
  messages: Array<Record<string, unknown>> | null;
  error: string | null;
  status: number;
}> => {
  const imagePath =
    typeof imagePathValue === "string" ? imagePathValue.trim() : "";

  if (
    !imagePath ||
    imagePath.includes("..") ||
    !imagePath.startsWith(`${userId}/`)
  ) {
    return { messages: null, error: "Imagen requerida.", status: 400 };
  }

  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from(STUDY_PHOTO_BUCKET)
    .download(imagePath);

  if (downloadError || !file) {
    console.error("Study photo download error:", downloadError);
    return {
      messages: null,
      error: "No se pudo leer la imagen. Vuelve a subirla.",
      status: 400,
    };
  }

  const mimeType =
    typeof file.type === "string" && file.type.startsWith("image/")
      ? file.type
      : "image/jpeg";
  const base64 = encodeBase64(await file.arrayBuffer());

  return {
    error: null,
    status: 200,
    messages: [
      { role: "system", content: STUDY_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
          {
            type: "text",
            text: "Explícame como a un niño la pregunta o el tema que aparece en esta imagen, siguiendo el formato obligatorio.",
          },
        ],
      },
    ],
  };
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

    const payload = await req.json().catch(() => null);
    const assistantMode = normalizeAssistantMode(payload?.mode);
    const shouldStream = payload?.stream === true;

    const featureKey =
      assistantMode === "estudio"
        ? PHOTO_STUDY_FEATURE_KEY
        : CLINICAL_ASSISTANT_FEATURE_KEY;

    const { data: canUseFeature, error: featureAccessError } =
      await supabaseAdmin.rpc("can_use_feature", {
        p_feature_key: featureKey,
        p_user_id: user.id,
      });

    if (featureAccessError) {
      console.error("Feature access validation error:", featureAccessError);
      return jsonResponse(
        { error: "No se pudo validar el acceso a esta funcionalidad." },
        500
      );
    }

    if (!canUseFeature) {
      return jsonResponse(
        { error: "No tienes acceso a esta funcionalidad." },
        403
      );
    }

    let requestMessages: Array<Record<string, unknown>>;

    if (assistantMode === "estudio") {
      const study = await buildStudyMessages(user.id, payload?.imagePath);
      if (!study.messages) {
        return jsonResponse(
          { error: study.error || "Imagen requerida." },
          study.status
        );
      }
      requestMessages = study.messages;
    } else {
      const messages = normalizeMessages(payload?.messages);

      if (!messages.length || messages[messages.length - 1]?.role !== "user") {
        return jsonResponse({ error: "Mensaje clínico requerido." }, 400);
      }

      requestMessages = [
        { role: "system", content: CLINICAL_SYSTEM_PROMPTS[assistantMode] },
        ...messages,
      ];
    }

    const kimiResponse = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOONSHOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MOONSHOT_MODEL,
        messages: requestMessages,
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
