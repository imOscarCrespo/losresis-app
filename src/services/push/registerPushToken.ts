import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { supabase } from "../../../config/supabase";

/**
 * Registers the device push token with Supabase for the given user.
 * Skips registration on simulators/emulators.
 * Uses a dedicated RPC so the same device token can be reassigned across accounts.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!userId) {
      console.warn("[Push] registerPushToken: no userId provided, skipping");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.warn(
        "[Push] registerPushToken: could not verify public.users profile, skipping",
        profileError.message
      );
      return;
    }

    if (!profile) {
      console.warn(
        "[Push] registerPushToken: public.users row missing, skipping registration"
      );
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
    const appVersion =
      Application.nativeApplicationVersion ||
      Application.applicationVersion ||
      null;

    const { error } = await supabase.rpc("register_push_token", {
      p_token: token,
      p_provider: "expo",
      p_platform: platform,
      p_device_name: Device.deviceName ?? null,
      p_app_version: appVersion,
    });

    if (error) {
      console.error("[Push] register_push_token RPC error:", error.message);
      return;
    }

    console.log("[Push] Token registered/updated in Supabase successfully");
    console.log("[Push] Token linked to user:", userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Push] registerPushToken error:", message);
  }
}
