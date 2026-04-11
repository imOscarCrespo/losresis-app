import { useState, useEffect, useCallback } from "react";
import { getGroupUnreadCounts } from "../../services/groupService";

const REFRESH_INTERVAL_MS = 30000;

export function useUnreadChatsCount(userId) {
  const [chatCount, setChatCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setChatCount(0);
      return;
    }

    const result = await getGroupUnreadCounts();

    if (!result.success) {
      setChatCount(0);
      return;
    }

    const totalUnread = Object.values(result.unreadByGroupId || {}).reduce(
      (sum, entry) => sum + Number(entry?.unreadCount || 0),
      0
    );

    setChatCount(totalUnread);
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
    hasChatUnread: chatCount > 0,
    refresh,
  };
}
