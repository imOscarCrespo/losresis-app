import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json().catch(() => null);
    const userId = payload?.user_id;

    if (!userId || typeof userId !== "string") {
      return new Response("Missing user_id", { status: 400 });
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error("Failed to delete auth user:", error);
      return new Response(error.message, { status: 500 });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Internal Error:", error);
    return new Response("Internal Error", { status: 500 });
  }
});
