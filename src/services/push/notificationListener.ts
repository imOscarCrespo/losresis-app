import * as Notifications from "expo-notifications";

/**
 * Sets up a listener for when the user taps a push notification.
 * Payload is logged for debugging; navigation will be implemented later.
 */
export function addNotificationResponseListener(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      console.log("[Push] Notification tapped, payload:", data);
    }
  );

  return () => subscription.remove();
}
