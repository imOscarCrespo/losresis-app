import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const payload = await req.json().catch(() => ({}));
    const record = payload.record ?? payload.new ?? null;

    if (!record) {
      return new Response("No record", { status: 200 });
    }

    const notification = record;

    console.log("Processing notification:", notification.id);

    const { data: pref } = await supabase
      .from("user_notification_preferences")
      .select("push_enabled")
      .eq("user_id", notification.user_id)
      .eq("notification_type", notification.type)
      .maybeSingle();

    if (pref && pref.push_enabled === false) {
      console.log("Push disabled by user");
      return new Response("Push disabled", { status: 200 });
    }

    const { data: tokens, error } = await supabase
      .from("push_tokens")
      .select("id, token")
      .eq("user_id", notification.user_id)
      .eq("is_valid", true);

    if (error) {
      console.error("Token fetch error:", error);
      return new Response("DB error", { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      console.log("No tokens for user");
      return new Response("No tokens", { status: 200 });
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {
        entity_type: notification.entity_type,
        entity_id: notification.entity_id,
      },
    }));

    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Expo API error:", text);
      return new Response("Expo API error", { status: 500 });
    }

    const response = await res.json();

    console.log("Expo response:", response);

    if (response?.data) {
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const ticket = response.data?.[i];

        await supabase.from("notification_deliveries").insert({
          notification_id: notification.id,
          push_token_id: token.id,
          status: ticket?.status === "ok" ? "sent" : "failed",
          provider_response: ticket,
          sent_at: ticket?.status === "ok" ? new Date().toISOString() : null,
        });

        if (ticket?.details?.error === "DeviceNotRegistered") {
          console.log("Invalid token detected:", token.id);

          await supabase
            .from("push_tokens")
            .update({ is_valid: false })
            .eq("id", token.id);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Internal Error:", err);

    return new Response("Internal Error", { status: 500 });
  }
});
