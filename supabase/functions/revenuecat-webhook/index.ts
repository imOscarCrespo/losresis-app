import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RC_WEBHOOK_SECRET = Deno.env.get("RC_WEBHOOK_SECRET");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}
if (!RC_WEBHOOK_SECRET) {
  throw new Error("Missing RC_WEBHOOK_SECRET");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired";

interface MappedEvent {
  plan_slug: string;
  status: SubscriptionStatus;
  will_renew: boolean;
}

// Map RC event types to our plan/status state. CANCELLATION keeps the user on
// `unlimited` (with status=canceled, will_renew=false) until `current_period_end`;
// EXPIRATION/REFUND demotes to `free`.
function mapEvent(eventType: string): MappedEvent | null {
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
      return { plan_slug: "unlimited", status: "active", will_renew: true };
    case "TRIAL_STARTED":
      return { plan_slug: "unlimited", status: "trialing", will_renew: true };
    case "TRIAL_CONVERTED":
      return { plan_slug: "unlimited", status: "active", will_renew: true };
    case "TRIAL_CANCELLED":
    case "CANCELLATION":
      return { plan_slug: "unlimited", status: "canceled", will_renew: false };
    case "EXPIRATION":
    case "REFUND":
      return { plan_slug: "free", status: "expired", will_renew: false };
    case "BILLING_ISSUE":
      return { plan_slug: "unlimited", status: "past_due", will_renew: false };
    default:
      return null;
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Validate bearer
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${RC_WEBHOOK_SECRET}`;
  if (auth !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = payload?.event;
  if (!event || typeof event !== "object") {
    return new Response("Missing event", { status: 400 });
  }

  const eventId: string | undefined = event.id;
  const eventType: string | undefined = event.type;
  const appUserId: string | undefined = event.app_user_id;
  const originalAppUserId: string | undefined = event.original_app_user_id;
  const productId: string | undefined = event.product_id;
  const entitlementId: string | undefined =
    event.entitlement_id ??
    (Array.isArray(event.entitlement_ids) ? event.entitlement_ids[0] : undefined);
  const expirationAtMs: number | undefined = event.expiration_at_ms;

  if (!eventId || !eventType) {
    return new Response("Missing event id/type", { status: 400 });
  }

  // Resolve user_id: prefer app_user_id, fallback to original_app_user_id (after aliasing).
  const userId = isUuid(appUserId)
    ? appUserId
    : isUuid(originalAppUserId)
    ? originalAppUserId
    : null;

  if (!userId) {
    console.warn(`[rc-webhook] event ${eventId} (${eventType}) has no UUID app_user_id; skipping.`);
    return new Response("OK", { status: 200 });
  }

  // Idempotency: if we've already processed this event id, return early.
  const { data: existing, error: existingError } = await supabase
    .from("user_subscriptions")
    .select("user_id")
    .eq("last_event_id", eventId)
    .maybeSingle();

  if (existingError) {
    console.error("[rc-webhook] error checking idempotency:", existingError);
    return new Response("Internal Error", { status: 500 });
  }

  if (existing) {
    return new Response("OK (duplicate)", { status: 200 });
  }

  const mapped = mapEvent(eventType);
  if (!mapped) {
    // Unknown event type — log raw and 200 to prevent RC retries.
    console.warn(`[rc-webhook] unhandled event type ${eventType} for user ${userId}`);
    return new Response("OK (ignored)", { status: 200 });
  }

  const currentPeriodEnd = expirationAtMs
    ? new Date(expirationAtMs).toISOString()
    : null;

  // Don't downgrade a legacy_unlimited user via RC events — those are
  // grandfathered and not bound to a paid subscription.
  const { data: currentSub } = await supabase
    .from("user_subscriptions")
    .select("plan_slug")
    .eq("user_id", userId)
    .maybeSingle();

  if (currentSub?.plan_slug === "legacy_unlimited") {
    console.log(`[rc-webhook] user ${userId} is legacy_unlimited; ignoring RC state change.`);
    // Still record last_event_id to keep idempotency working.
    await supabase
      .from("user_subscriptions")
      .update({
        last_event_id: eventId,
        raw_event: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return new Response("OK (legacy)", { status: 200 });
  }

  const upsertRow = {
    user_id: userId,
    plan_slug: mapped.plan_slug,
    status: mapped.status,
    rc_app_user_id: appUserId ?? null,
    rc_entitlement_id: entitlementId ?? null,
    rc_product_id: productId ?? null,
    current_period_end: currentPeriodEnd,
    will_renew: mapped.will_renew,
    last_event_id: eventId,
    raw_event: payload,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("user_subscriptions")
    .upsert(upsertRow, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[rc-webhook] upsert failed:", upsertError);
    return new Response("Internal Error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
