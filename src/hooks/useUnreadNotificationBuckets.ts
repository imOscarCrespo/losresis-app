import { useState, useEffect, useCallback } from "react";
import { getUnreadNotificationBuckets } from "../services/notificationsService";

const REFRESH_INTERVAL_MS = 30000;

export function useUnreadNotificationBuckets(
  userId: string | undefined
): {
  chatCount: number;
  otherCount: number;
  hasChatUnread: boolean;
  hasOtherUnread: boolean;
  refresh: () => Promise<void>;
} {
  const [chatCount, setChatCount] = useState(0);
  const [otherCount, setOtherCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setChatCount(0);
      setOtherCount(0);
      return;
    }

    const buckets = await getUnreadNotificationBuckets(userId);
    setChatCount(buckets.chatCount);
    setOtherCount(buckets.otherCount);
  }, [userId]);

  useEffect(() => {
    refresh();

    const intervalId = setInterval(() => {
      refresh();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [refresh]);

  return {
    chatCount,
    otherCount,
    hasChatUnread: chatCount > 0,
    hasOtherUnread: otherCount > 0,
    refresh,
  };
}
