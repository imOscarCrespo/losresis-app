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
          <View style={styles.titleWrap}>
            <View style={[styles.typeBadge, isUnread && styles.typeBadgeUnread]}>
              <Text style={[styles.typeBadgeText, isUnread && styles.typeBadgeTextUnread]}>
                {isUnread ? "Nueva" : "Leida"}
              </Text>
            </View>
            <Text style={styles.timestamp}>
              {formatRelativeTime(notification.created_at)}
            </Text>
          </View>
        </View>
        <View style={styles.bodyWrap}>
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
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    shadowColor: "#1B0977",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: "#FCFAFF",
    borderColor: "#DCCFFF",
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bodyWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
  },
  typeBadgeUnread: {
    backgroundColor: "#F1EAFE",
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  typeBadgeTextUnread: {
    color: "#670CF5",
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#1B0977",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#670CF5",
    marginLeft: 10,
    marginTop: 5,
  },
  body: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 21,
  },
  timestamp: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
  },
});
