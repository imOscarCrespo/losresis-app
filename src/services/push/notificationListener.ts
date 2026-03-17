import * as Notifications from "expo-notifications";
import { routeNotificationPayload } from "./notificationRouter";

/**
 * Sets up a listener for when the user taps a push notification.
 * Routes notification payloads into the app navigation layer.
 */
export function addNotificationResponseListener(): () => void {
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const data = response?.notification.request.content.data;
      if (data) {
        routeNotificationPayload(data);
      }
    })
    .catch((error) => {
      console.error("[Push] Error reading initial notification response:", error);
    });

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      routeNotificationPayload(data);
    }
  );

  return () => subscription.remove();
}
