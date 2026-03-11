import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "../../../config/supabase";

/**
 * Registers the device push token with Supabase for the given user.
 * Skips registration on simulators/emulators.
 * Uses upsert to avoid duplicate tokens and updates last_seen_at when token exists.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!userId) {
      console.warn("[Push] registerPushToken: no userId provided, skipping");
      return;
    }

    if (!Device.isDevice) {
      console.log("[Push] Skipping registration: not a physical device (simulator/emulator)");
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log("[Push] Permission status (before request):", existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      finalStatus = status;
      console.log("[Push] Permission status (after request):", finalStatus);
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Notification permission denied, skipping token registration");
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("[Push] No EAS projectId in app config, cannot get Expo push token");
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;
    console.log("[Push] Token generated:", token);

    const platform = Platform.OS as "ios" | "android";
    const now = new Date().toISOString();

    const row = {
      user_id: userId,
      token,
      provider: "expo",
      platform,
      last_seen_at: now,
    };

    const { error } = await supabase.from("push_tokens").upsert(row, {
      onConflict: "token",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("[Push] Supabase upsert error:", error.message);
      return;
    }

    console.log("[Push] Token registered/updated in Supabase successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Push] registerPushToken error:", message);
  }
}
