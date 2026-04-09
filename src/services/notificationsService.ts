import { supabase } from "../../config/supabase";

export const CHAT_NOTIFICATION_TYPES = ["group_message"] as const;

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  actor_user_id: string | null;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

const NOTIFICATIONS_LIMIT = 50;

/**
 * Fetches notifications for the current user, ordered by created_at DESC.
 */
export async function fetchNotifications(
  userId: string
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_LIMIT);

  if (error) {
    console.error("[Notifications] fetchNotifications error:", error.message);
    return [];
  }
  return (data as NotificationRow[]) ?? [];
}

/**
 * Marks a notification as read (is_read = true, read_at = now()).
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId);

  if (error) {
    console.error("[Notifications] markAsRead error:", error.message);
    return false;
  }
  return true;
}

/**
 * Returns the count of unread notifications for the user.
 * Used for badges.
 */
export async function getUnreadNotificationsCount(
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("[Notifications] getUnreadCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}

export type UnreadNotificationBuckets = {
  chatCount: number;
  otherCount: number;
};

/**
 * Splits unread notifications between chat notifications and everything else.
 */
export async function getUnreadNotificationBuckets(
  userId: string
): Promise<UnreadNotificationBuckets> {
  const { data, error } = await supabase
    .from("notifications")
    .select("type")
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("[Notifications] getUnreadBuckets error:", error.message);
    return { chatCount: 0, otherCount: 0 };
  }

  return (data ?? []).reduce<UnreadNotificationBuckets>(
    (acc, notification) => {
      if (
        notification?.type &&
        CHAT_NOTIFICATION_TYPES.includes(
          notification.type as (typeof CHAT_NOTIFICATION_TYPES)[number]
        )
      ) {
        acc.chatCount += 1;
      } else {
        acc.otherCount += 1;
      }

      return acc;
    },
    { chatCount: 0, otherCount: 0 }
  );
}
