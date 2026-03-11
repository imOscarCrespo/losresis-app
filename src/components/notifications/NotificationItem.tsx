import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { NotificationRow } from "../../services/notificationsService";

function formatRelativeTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays === 1 ? "" : "s"}`;
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

type NotificationItemProps = {
  notification: NotificationRow;
  onPress: () => void;
};

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const isUnread = !notification.is_read;

  return (
    <TouchableOpacity
      style={[styles.card, isUnread && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        {notification.body ? (
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        ) : null}
        <Text style={styles.timestamp}>
          {formatRelativeTime(notification.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  cardUnread: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginLeft: 8,
  },
  body: {
    fontSize: 14,
    color: "#3C3C43",
    lineHeight: 20,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: "#8E8E93",
  },
});
