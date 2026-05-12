import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HeroScreenLayout } from "../../../components/HeroScreenLayout";
import { COLORS } from "../../../constants/colors";
import {
  fetchNotifications,
  markNotificationAsRead,
  type NotificationRow,
} from "../../services/notificationsService";
import { NotificationItem } from "../../components/notifications/NotificationItem";

export type NotificationDataPayload = {
  entity_type?: string;
  entity_id?: string;
  destination_section?: string;
  destination_tab?: string;
  course_id?: string;
  group_id?: string;
  group_name?: string;
  question_id?: string;
  focus?: string;
};

export type NotificationNavigationPayload =
  | string
  | {
      reviewId?: string;
      questionId?: string;
      groupId?: string;
      groupName?: string;
      focusQuestions?: boolean;
      initialTab?: string;
      matchId?: string;
      courseId?: string;
      threadId?: string;
    };

type NotificationsScreenProps = {
  userId: string | undefined;
  onBack?: () => void;
  onNavigateToEntity: (
    entityType: string,
    entityId: NotificationNavigationPayload
  ) => void;
};

export default function NotificationsScreen({
  userId,
  onBack,
  onNavigateToEntity,
}: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchNotifications(userId);
      setNotifications(data);
    } catch (err) {
      console.error("[NotificationsScreen] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  React.useEffect(() => {
    setLoading(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    async (notification: NotificationRow) => {
      if (!notification.is_read) {
        const ok = await markNotificationAsRead(notification.id);
        if (ok) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id
                ? { ...n, is_read: true, read_at: new Date().toISOString() }
                : n
            )
          );
        }
      }

      const data = (notification.data as NotificationDataPayload | null) ?? {};
      const entityType = data.entity_type;
      const entityId = data.entity_id;
      const groupId = data.group_id;
      const groupName = data.group_name;
      const questionId = data.question_id;

      if (data.destination_section === "myReview") {
        onNavigateToEntity("myReview", {
          questionId,
          focusQuestions: true,
        });
        return;
      }

      if (data.destination_section === "groupChat" && groupId) {
        onNavigateToEntity("groupChat", { groupId, groupName });
        return;
      }

      if (entityType && entityId) {
        if (entityType === "review") {
          onNavigateToEntity("reviewDetail", {
            reviewId: entityId,
            questionId,
          });
        } else if (entityType === "comment") {
          onNavigateToEntity("threadDetail", entityId);
        } else if (entityType === "roommate_match") {
          onNavigateToEntity("roomies", entityId);
        } else if (entityType === "group") {
          onNavigateToEntity("groupChat", { groupId: entityId, groupName });
        } else if (entityType === "course") {
          onNavigateToEntity("courseDetail", entityId);
        }
      }
    },
    [onNavigateToEntity]
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationRow }) => (
      <NotificationItem
        notification={item}
        onPress={() => handleNotificationPress(item)}
      />
    ),
    [handleNotificationPress]
  );

  const keyExtractor = useCallback((item: NotificationRow) => item.id, []);

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="notifications-off-outline"
          size={64}
          color="#94A3B8"
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle}>Nada por aqui</Text>
        <Text style={styles.emptyText}>No tienes notificaciones todavia</Text>
      </View>
    ),
    []
  );

  const renderListHeader = useCallback(
    () => (
      <View style={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {unreadCount} {unreadCount === 1 ? "nueva" : "nuevas"}
            </Text>
          </View>
        </View>
      </View>
    ),
    [unreadCount]
  );

  if (loading && notifications.length === 0) {
    return (
      <HeroScreenLayout title="Notificaciones" onBack={onBack}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#670CF5" />
        </View>
      </HeroScreenLayout>
    );
  }

  return (
    <HeroScreenLayout title="Notificaciones" onBack={onBack}>
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={
            notifications.length === 0
              ? styles.listContentEmpty
              : styles.listContent
          }
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#670CF5"]}
              tintColor="#670CF5"
            />
          }
        />
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentSurface: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#1B0977",
  },
  countBadge: {
    backgroundColor: "rgba(103,12,245,0.07)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.15)",
  },
  countText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#670CF5",
    letterSpacing: 0.3,
  },
  listContent: {
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
  },
});
