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
};

type NotificationsScreenProps = {
  userId: string | undefined;
  onBack: () => void;
  onNavigateToEntity: (entityType: string, entityId: string) => void;
};

export default function NotificationsScreen({
  userId,
  onBack,
  onNavigateToEntity,
}: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      if (entityType && entityId) {
        if (entityType === "review") {
          onNavigateToEntity("reviewDetail", entityId);
        } else if (entityType === "comment") {
          onNavigateToEntity("threadDetail", entityId);
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
          color="#C7C7CC"
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyText}>
          No tienes notificaciones todavía
        </Text>
      </View>
    ),
    []
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
      </View>
    ),
    [onBack]
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {renderHeader()}
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
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
            colors={["#007AFF"]}
            tintColor="#007AFF"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  listContent: {
    paddingVertical: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
    paddingVertical: 16,
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
    padding: 16,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
  },
});
