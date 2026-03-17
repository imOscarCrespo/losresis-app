import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
  group_id?: string;
  group_name?: string;
};

type NotificationsScreenProps = {
  userId: string | undefined;
  onBack: () => void;
  onNavigateToEntity: (entityType: string, entityId: string | { groupId: string; groupName?: string }) => void;
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

      if (data.destination_section === "groupChat" && groupId) {
        onNavigateToEntity("groupChat", { groupId, groupName });
        return;
      }

      if (entityType && entityId) {
        if (entityType === "review") {
          onNavigateToEntity("reviewDetail", entityId);
        } else if (entityType === "comment") {
          onNavigateToEntity("threadDetail", entityId);
        } else if (entityType === "roommate_match") {
          onNavigateToEntity("roomies", entityId);
        } else if (entityType === "group") {
          onNavigateToEntity("groupChat", { groupId: entityId, groupName });
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

  const renderHeader = useCallback(
    () => (
      <View style={styles.backHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#1B0977" />
          <Text style={styles.backBtnText}>Atrás</Text>
        </TouchableOpacity>
      </View>
    ),
    [onBack]
  );

  const renderListHeader = useCallback(
    () => (
      <View style={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Notificaciones</Text>
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
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.headerShell}>{renderHeader()}</View>
        <View style={styles.contentSurface}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#670CF5" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.headerShell}>{renderHeader()}</View>
      <View style={styles.contentSurface}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerShell: {
    backgroundColor: "#FFFFFF",
  },
  contentSurface: {
    flex: 1,
    backgroundColor: "#F8F9FE",
  },
  backHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAF3",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignSelf: "flex-start",
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1B0977",
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
  screenTitle: {
    flex: 1,
    fontSize: 26,
    fontWeight: "700",
    color: "#1B0977",
    letterSpacing: -0.3,
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
