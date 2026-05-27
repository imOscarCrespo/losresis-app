/**
 * Wrapper around RevenueCat and the user_subscriptions table.
 * Source of truth for entitlement state is Supabase (updated by the
 * revenuecat-webhook edge function); RC is consulted only at purchase time
 * and as an optimistic-write source.
 */

import { supabase } from "../config/supabase";
import {
  getPurchases,
  isRevenueCatReady,
} from "../src/services/subscription/revenuecatClient";
import posthogLogger from "./posthogService";

const ENTITLEMENT_ID = "unlimited_listings";

export async function getOfferings() {
  const P = getPurchases();
  if (!P || !isRevenueCatReady()) return null;
  try {
    return await P.getOfferings();
  } catch (err) {
    console.warn("[subscription] getOfferings failed:", err?.message);
    return null;
  }
}

export async function getCustomerInfo() {
  const P = getPurchases();
  if (!P || !isRevenueCatReady()) return null;
  try {
    return await P.getCustomerInfo();
  } catch (err) {
    console.warn("[subscription] getCustomerInfo failed:", err?.message);
    return null;
  }
}

export function hasUnlimitedEntitlement(customerInfo) {
  if (!customerInfo) return false;
  const entitlements = customerInfo?.entitlements?.active ?? {};
  return Boolean(entitlements[ENTITLEMENT_ID]);
}

export async function purchasePackage(pkg, userId) {
  const P = getPurchases();
  if (!P || !isRevenueCatReady()) {
    return { success: false, error: "rc_not_ready" };
  }
  const packageId = pkg?.identifier ?? null;
  posthogLogger.capture("purchase_started", { package_id: packageId });
  try {
    const result = await P.purchasePackage(pkg);
    const active = hasUnlimitedEntitlement(result?.customerInfo);
    if (active && userId) {
      // Optimistic write — webhook will reconcile with last_event_id.
      await optimisticActivateUnlimited(userId, result?.customerInfo);
    }
    posthogLogger.capture("purchase_completed", {
      package_id: packageId,
      plan: "unlimited",
    });
    return { success: true, customerInfo: result?.customerInfo, active };
  } catch (err) {
    if (err?.userCancelled) {
      return { success: false, cancelled: true };
    }
    posthogLogger.capture("purchase_failed", {
      package_id: packageId,
      code: err?.code ?? null,
      message: err?.message ?? null,
    });
    return { success: false, error: err?.message ?? "unknown" };
  }
}

export async function restorePurchases(userId) {
  const P = getPurchases();
  if (!P || !isRevenueCatReady()) return { success: false };
  posthogLogger.capture("restore_purchases_triggered");
  try {
    const customerInfo = await P.restorePurchases();
    const active = hasUnlimitedEntitlement(customerInfo);
    if (active && userId) {
      await optimisticActivateUnlimited(userId, customerInfo);
    }
    posthogLogger.capture("restore_purchases_completed", { active });
    return { success: true, active, customerInfo };
  } catch (err) {
    console.warn("[subscription] restore failed:", err?.message);
    return { success: false, error: err?.message ?? "unknown" };
  }
}

async function optimisticActivateUnlimited(userId, customerInfo) {
  try {
    // Don't overwrite a legacy_unlimited grandfathered user.
    const { data: current } = await supabase
      .from("user_subscriptions")
      .select("plan_slug")
      .eq("user_id", userId)
      .maybeSingle();
    if (current?.plan_slug === "legacy_unlimited") return;

    const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
    const expiresAt = entitlement?.expirationDate
      ? new Date(entitlement.expirationDate).toISOString()
      : null;

    await supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_slug: "unlimited",
          status: "active",
          rc_entitlement_id: ENTITLEMENT_ID,
          rc_product_id: entitlement?.productIdentifier ?? null,
          current_period_end: expiresAt,
          will_renew: Boolean(entitlement?.willRenew),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
  } catch (err) {
    console.warn("[subscription] optimistic activate failed:", err?.message);
  }
}

export async function fetchUserQuota(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.rpc("get_user_listing_quota", {
    p_user: userId,
  });
  if (error) {
    console.warn("[subscription] fetchUserQuota failed:", error.message);
    return null;
  }
  // RPC returns a set; take the first row.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    planSlug: row.plan_slug,
    status: row.status,
    maxListings: row.max_listings,
    currentActiveCount: row.current_active_count,
    canCreate: row.can_create,
  };
}

export async function fetchUserSubscription(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[subscription] fetchUserSubscription failed:", error.message);
    return null;
  }
  return data;
}

export const SUBSCRIPTION_ENTITLEMENT_ID = ENTITLEMENT_ID;
