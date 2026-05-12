import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MOONSHOT_API_KEY = Deno.env.get("MOONSHOT_API_KEY");
const MOONSHOT_BASE_URL =
  Deno.env.get("MOONSHOT_BASE_URL") || "https://api.moonshot.ai/v1";
const MOONSHOT_MODEL = Deno.env.get("MOONSHOT_MODEL") || "kimi-k2.5";
const WEEKLY_COURSES_BOT_SECRET = Deno.env.get("WEEKLY_COURSES_BOT_SECRET");

const SOURCE = "kimi";
// Kimi/Moonshot org limit is 20 RPM. 3500ms keeps us safely under (~17 RPM).
const REQUEST_DELAY_MS = 3500;
const MAX_TOKENS = 8000;
const MAX_RETRIES_429 = 4;
const MAX_TOOL_ROUNDS = 6;
// One HTTP invocation processes this many specialities, then chains to itself
// with the next offset. Keeps each invocation well within the Edge Runtime
// wall-clock budget (~150–400s) even with the slowest Kimi tool loops.
const BATCH_SIZE = 2;
// Re-use the same fallback employer_org that lectureService.js uses for
// resident-published courses (losresis-app/services/lectureService.js:16).
const FALLBACK_ORG_NAME = "losresis_app";

const IS_LOCAL_RUN = Deno.env.get("RUN_LOCAL") === "1";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !MOONSHOT_API_KEY ||
  (!IS_LOCAL_RUN && !WEEKLY_COURSES_BOT_SECRET)
) {
  throw new Error(
    "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MOONSHOT_API_KEY or WEEKLY_COURSES_BOT_SECRET"
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Speciality = { id: string; name: string };

type RawCourse = {
  title?: unknown;
  event_dates?: unknown;
  teaching_hours?: unknown;
  price_text?: unknown;
  course_directors?: unknown;
  organization?: unknown;
  venue_name?: unknown;
  venue_address?: unknown;
  seats_available?: unknown;
  course_code?: unknown;
  more_info?: unknown;
  objectives?: unknown;
  registration_url?: unknown;
};

type ParsedCourse = {
  title: string;
  event_dates: string[];
  teaching_hours: string | null;
  price_text: string | null;
  course_directors: string | null;
  organization: string | null;
  venue_name: string | null;
  venue_address: string | null;
  seats_available: number | null;
  course_code: string | null;
  more_info: string | null;
  objectives: string | null;
  registration_url: string | null;
};

const SYSTEM_PROMPT = `Eres un asistente que recopila cursos presenciales u online para médicos y residentes MIR en España.

Devuelve EXCLUSIVAMENTE un objeto JSON con la forma:
{
  "courses": [
    {
      "title": string,
      "event_dates": ["YYYY-MM-DD", ...],
      "teaching_hours": string | null,
      "price_text": string | null,
      "course_directors": string | null,
      "organization": string | null,
      "venue_name": string | null,
      "venue_address": string | null,
      "seats_available": integer | null,
      "course_code": string | null,
      "more_info": string | null,
      "objectives": string | null,
      "registration_url": string | null
    }
  ]
}

Reglas estrictas:
- Solo cursos en España.
- Solo cursos cuya primera fecha sea hoy o futura.
- Si no conoces un campo con seguridad, ponlo como null. NO inventes datos.
- Las fechas deben estar en formato ISO YYYY-MM-DD.
- "title" y "event_dates" son obligatorios. Si no puedes garantizarlos, no incluyas el curso.
- Devuelve únicamente el JSON, sin texto adicional, sin markdown, sin comentarios.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const normalize = (s: string) =>
  s.trim().toLowerCase().normalize("NFKD").replace(/\s+/g, " ");

const sha256Hex = async (input: string) => {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const isValidIsoDate = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const asStringOrNull = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
};

const asIntOrNull = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0)
    return Math.trunc(v);
  if (typeof v === "string" && /^\d+$/.test(v.trim()))
    return parseInt(v.trim(), 10);
  return null;
};

const validateCourse = (raw: RawCourse): ParsedCourse | null => {
  const title = asStringOrNull(raw.title);
  if (!title) return null;

  if (!Array.isArray(raw.event_dates)) return null;
  const today = todayIso();
  const dates = raw.event_dates
    .map((d) => (typeof d === "string" ? d.trim() : ""))
    .filter((d) => isValidIsoDate(d) && d >= today);
  if (!dates.length) return null;

  return {
    title,
    event_dates: dates,
    teaching_hours: asStringOrNull(raw.teaching_hours),
    price_text: asStringOrNull(raw.price_text),
    course_directors: asStringOrNull(raw.course_directors),
    organization: asStringOrNull(raw.organization),
    venue_name: asStringOrNull(raw.venue_name),
    venue_address: asStringOrNull(raw.venue_address),
    seats_available: asIntOrNull(raw.seats_available),
    course_code: asStringOrNull(raw.course_code),
    more_info: asStringOrNull(raw.more_info),
    objectives: asStringOrNull(raw.objectives),
    registration_url: asStringOrNull(raw.registration_url),
  };
};

const stripCodeFences = (s: string): string => {
  const t = s.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  reasoning_content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

const callKimi = async (
  speciality: Speciality,
  messages: ChatMessage[]
): Promise<Response | null> => {
  for (let attempt = 0; attempt <= MAX_RETRIES_429; attempt++) {
    const res = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MOONSHOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MOONSHOT_MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        // $web_search requires thinking to be disabled (Moonshot docs).
        thinking: { type: "disabled" },
        tools: [
          {
            type: "builtin_function",
            function: { name: "$web_search" },
          },
        ],
        stream: false,
      }),
    });

    if (res.status !== 429) return res;

    const backoffMs = Math.min(30000, 2000 * Math.pow(2, attempt));
    console.warn(
      `Kimi 429 for speciality ${speciality.name}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES_429})`
    );
    await sleep(backoffMs);
  }
  return null;
};

const askKimiForSpeciality = async (
  speciality: Speciality
): Promise<RawCourse[]> => {
  const userPrompt = `me puedes decir los proximos cursos que hay en españa para medicos y residentes de medicina de la especialidad ${speciality.name}`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  let finalContent: string | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await callKimi(speciality, messages);
    if (!res || !res.ok) {
      const errBody = res ? await res.text().catch(() => "") : "";
      console.error(
        `Kimi API error for speciality ${speciality.name}:`,
        res?.status,
        errBody
      );
      return [];
    }

    const payload = await res.json().catch(() => null);
    const choice = payload?.choices?.[0];
    const message = choice?.message as ChatMessage | undefined;
    const finishReason = choice?.finish_reason as string | undefined;

    if (!message) {
      console.error(
        `No message in Kimi response for speciality ${speciality.name}`,
        payload
      );
      return [];
    }

    if (finishReason === "tool_calls" && message.tool_calls?.length) {
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: message.content ?? "",
        tool_calls: message.tool_calls,
      };
      // Kimi requires reasoning_content to be echoed back when thinking is on.
      // Forward whatever the model returned, only when present and non-empty.
      const rc = (message as { reasoning_content?: unknown }).reasoning_content;
      if (typeof rc === "string" && rc.length > 0) {
        assistantMsg.reasoning_content = rc;
      }
      messages.push(assistantMsg);
      for (const call of message.tool_calls) {
        // For Moonshot builtin functions ($web_search etc.), the client echoes
        // the arguments back as the tool result; the server then executes the
        // builtin and returns results in the next round.
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: call.function.arguments,
        });
      }
      continue;
    }

    if (typeof message.content === "string" && message.content.trim()) {
      finalContent = message.content;
      break;
    }

    console.error(
      `Empty Kimi content for speciality ${speciality.name} (finish=${finishReason})`,
      payload
    );
    return [];
  }

  if (!finalContent) {
    console.error(
      `Kimi tool loop exhausted for speciality ${speciality.name} after ${MAX_TOOL_ROUNDS} rounds`
    );
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(finalContent));
  } catch (e) {
    console.error(
      `Invalid JSON for speciality ${speciality.name}:`,
      e,
      finalContent.slice(0, 500)
    );
    return [];
  }

  const courses = (parsed as { courses?: unknown })?.courses;
  if (!Array.isArray(courses)) {
    console.warn(
      `No "courses" array for speciality ${speciality.name}; raw:`,
      finalContent.slice(0, 800)
    );
    return [];
  }

  if (courses.length === 0) {
    console.warn(
      `Empty courses array for speciality ${speciality.name}; raw:`,
      finalContent.slice(0, 400)
    );
  }

  return courses as RawCourse[];
};

const resolveFallbackOrgId = async (): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from("employer_org")
    .select("id")
    .eq("name", FALLBACK_ORG_NAME)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Failed to resolve fallback employer_org:", error);
    return null;
  }
  return data?.id ?? null;
};

const ingestForSpeciality = async (
  speciality: Speciality,
  orgId: string
): Promise<{ inserted: number; skipped: number; errors: number }> => {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  const rawCourses = await askKimiForSpeciality(speciality);

  for (const raw of rawCourses) {
    const course = validateCourse(raw);
    if (!course) {
      skipped++;
      continue;
    }

    const externalId = (
      await sha256Hex(
        [
          normalize(course.title),
          normalize(course.organization || ""),
          course.event_dates[0],
        ].join("|")
      )
    ).slice(0, 32);

    const { data: existing, error: existsError } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("source", SOURCE)
      .eq("external_id", externalId)
      .limit(1);

    if (existsError) {
      console.error(
        `Lookup error for speciality ${speciality.name} / "${course.title}":`,
        existsError
      );
      errors++;
      continue;
    }

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    const { error: insertError } = await supabaseAdmin
      .from("courses")
      .insert({
        title: course.title,
        event_dates: course.event_dates,
        teaching_hours: course.teaching_hours,
        price_text: course.price_text,
        course_directors: course.course_directors,
        organization: course.organization,
        venue_name: course.venue_name,
        venue_address: course.venue_address,
        seats_available: course.seats_available,
        course_code: course.course_code,
        more_info: course.more_info,
        objectives: course.objectives,
        registration_url: course.registration_url,
        speciality_id: speciality.id,
        hospital_id: null,
        created_by_id: null,
        org_id: orgId,
        status: "published",
        published_at: new Date().toISOString(),
        source: SOURCE,
        external_id: externalId,
      });

    if (insertError) {
      // Race condition fallback: if a duplicate slipped through between the
      // SELECT and INSERT, treat as skipped instead of erroring.
      const msg = (insertError.message || "").toLowerCase();
      if (msg.includes("duplicate") || (insertError as { code?: string }).code === "23505") {
        skipped++;
      } else {
        console.error(
          `Insert error for speciality ${speciality.name} / "${course.title}":`,
          insertError
        );
        errors++;
      }
      continue;
    }

    inserted++;
  }

  return { inserted, skipped, errors };
};

declare const EdgeRuntime:
  | { waitUntil(promise: Promise<unknown>): void }
  | undefined;

const fetchSpecialitiesBatch = async (
  offset: number,
  limit: number
): Promise<Speciality[]> => {
  const { data, error } = await supabaseAdmin
    .from("specialities")
    .select("id, name")
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) {
    console.error(`Failed to load specialities batch offset=${offset}:`, error);
    return [];
  }
  return (data || []) as Speciality[];
};

const triggerNextBatch = async (
  nextOffset: number,
  limit: number
): Promise<void> => {
  const url = `${SUPABASE_URL}/functions/v1/weekly-courses-bot`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WEEKLY_COURSES_BOT_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ offset: nextOffset, limit }),
    });
    console.log(
      `Triggered next batch offset=${nextOffset} limit=${limit} status=${res.status}`
    );
  } catch (e) {
    console.error(
      `Failed to trigger next batch offset=${nextOffset}:`,
      e
    );
  }
};

const runBatch = async (
  offset: number,
  limit: number,
  autoChain: boolean
): Promise<void> => {
  try {
    const orgId = await resolveFallbackOrgId();
    if (!orgId) {
      console.error(
        `Cannot run bot: employer_org with name="${FALLBACK_ORG_NAME}" not found`
      );
      return;
    }

    const specialities = await fetchSpecialitiesBatch(offset, limit);
    if (specialities.length === 0) {
      console.log(
        `weekly-courses-bot batch offset=${offset} limit=${limit}: no specialities. Done.`
      );
      return;
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const speciality of specialities) {
      try {
        const r = await ingestForSpeciality(speciality, orgId);
        inserted += r.inserted;
        skipped += r.skipped;
        errors += r.errors;
        console.log(
          `[${speciality.name}] inserted=${r.inserted} skipped=${r.skipped} errors=${r.errors}`
        );
      } catch (e) {
        errors++;
        console.error(`Unhandled error for speciality ${speciality.name}:`, e);
      }
      await sleep(REQUEST_DELAY_MS);
    }

    console.log(
      `weekly-courses-bot batch offset=${offset} limit=${limit} processed=${specialities.length} inserted=${inserted} skipped=${skipped} errors=${errors}`
    );

    // Auto-chain: if we got a full batch there may be more specialities.
    if (autoChain && specialities.length === limit) {
      await triggerNextBatch(offset + limit, limit);
    } else if (autoChain) {
      console.log("weekly-courses-bot reached end of specialities. Done.");
    }
  } catch (e) {
    console.error(
      `weekly-courses-bot batch error offset=${offset} limit=${limit}:`,
      e
    );
  }
};

if (IS_LOCAL_RUN) {
  // Direct execution from a developer machine; no Edge Runtime wall-clock limit
  // so we process every speciality in a single pass without chaining.
  await runBatch(0, Number.MAX_SAFE_INTEGER, false);
} else {
  serve(async (req) => {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token !== WEEKLY_COURSES_BOT_SECRET) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const parsed = await req.json().catch(() => ({} as Record<string, unknown>));
    const offsetRaw = (parsed as { offset?: unknown }).offset;
    const limitRaw = (parsed as { limit?: unknown }).limit;
    const offset =
      typeof offsetRaw === "number" && Number.isFinite(offsetRaw) && offsetRaw >= 0
        ? Math.trunc(offsetRaw)
        : 0;
    const limit =
      typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.trunc(limitRaw)
        : BATCH_SIZE;

    const work = runBatch(offset, limit, true);
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(work);
    }

    return jsonResponse({ ok: true, accepted: true, offset, limit }, 202);
  });
}
