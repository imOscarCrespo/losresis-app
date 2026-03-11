import { useState, useEffect, useCallback } from "react";
import { getUnreadNotificationsCount } from "../services/notificationsService";

/**
 * Returns the number of unread notifications for the given user.
 * Refreshes on mount and when userId changes.
 */
export function useUnreadNotificationsCount(
  userId: string | undefined
): { count: number; refresh: () => Promise<void> } {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    const n = await getUnreadNotificationsCount(userId);
    setCount(n);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { count, refresh };
}
