import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Configures global notification behavior: show alert, play sound, set badge.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldAnimate: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowCriticalAlert: false,
    }),
  });
}

/**
 * Creates the default Android notification channel (required for Android 8+).
 * No-op on iOS.
 */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
    });
    console.log("[Push] Android notification channel 'default' created");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Push] Error creating Android channel:", message);
  }
}
