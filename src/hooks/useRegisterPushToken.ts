import { useEffect } from "react";
import { registerPushToken } from "../services/push/registerPushToken";

/**
 * Registers the device push token with Supabase when the user is authenticated.
 * Runs once when userId becomes available.
 */
export function useRegisterPushToken(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId) return;
    registerPushToken(userId);
  }, [userId]);
}
