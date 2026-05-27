import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchUserQuota,
  getCustomerInfo,
  hasUnlimitedEntitlement,
  SUBSCRIPTION_ENTITLEMENT_ID,
} from "../services/subscriptionService";
import {
  getPurchases,
  isRevenueCatReady,
} from "../src/services/subscription/revenuecatClient";

/**
 * Reads quota + RC entitlement and exposes a single object for the host UI.
 * Subscribes to RC customerInfo updates to react to renewals/cancellations
 * while the app is open.
 */
export function useSubscription(userId) {
  const [quota, setQuota] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const listenerRef = useRef(null);

  const load = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      setQuota(null);
      setCustomerInfo(null);
      return;
    }
    setIsLoading(true);
    const [q, ci] = await Promise.all([
      fetchUserQuota(userId),
      getCustomerInfo(),
    ]);
    setQuota(q);
    setCustomerInfo(ci);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const P = getPurchases();
    if (!P || !isRevenueCatReady() || !userId) return undefined;
    try {
      const sub = P.addCustomerInfoUpdateListener?.((info) => {
        setCustomerInfo(info);
        fetchUserQuota(userId).then((q) => q && setQuota(q));
      });
      listenerRef.current = sub;
    } catch (err) {
      // Older SDKs return void; ignore.
    }
    return () => {
      try {
        if (typeof listenerRef.current === "function") listenerRef.current();
        else if (listenerRef.current?.remove) listenerRef.current.remove();
      } catch (e) {
        /* noop */
      }
    };
  }, [userId]);

  const hasUnlimited =
    quota?.planSlug === "unlimited" ||
    quota?.planSlug === "legacy_unlimited" ||
    hasUnlimitedEntitlement(customerInfo);

  // If RC says entitlement is active but Supabase still says free, trust the
  // entitlement so the UI doesn't block the user while the webhook reconciles.
  const canCreateListing = hasUnlimited
    ? true
    : Boolean(quota?.canCreate);

  return {
    planSlug: quota?.planSlug ?? "free",
    status: quota?.status ?? "none",
    maxListings: quota?.maxListings ?? 1,
    activeListingCount: quota?.currentActiveCount ?? 0,
    canCreateListing,
    hasUnlimited,
    isLoading,
    refresh: load,
    customerInfo,
    entitlementId: SUBSCRIPTION_ENTITLEMENT_ID,
  };
}
