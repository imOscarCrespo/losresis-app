import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Icon } from "../../../components/Icon";
import { HeroScreenLayout } from "../../../components/HeroScreenLayout";
import { COLORS } from "../../../constants/colors";
import {
  fetchNotifications,
  markNotificationAsRead,
  type NotificationRow,
} from "../../services/notificationsService";
import { NotificationItem } from "../../components/notifications/NotificationItem";
// connectionsService es JS sin tipos; lo tratamos como any.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import {
  CONNECTION_STATUS,
  getConnectionStatuses,
  acceptConnectionRequest,
  rejectConnectionRequest,
} from "../../../services/connectionsService";

type ConnectionStatusEntry = {
  status: string;
  connectionId?: string;
  direction?: string;
};

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
  other_user_id?: string;
  requester_id?: string;
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
      otherUserId?: string;
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
  const [connectionStatuses, setConnectionStatuses] = useState<
    Record<string, ConnectionStatusEntry>
  >({});
  const [actionNotifId, setActionNotifId] = useState<string | null>(null);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchNotifications(userId);
      setNotifications(data);

      // Estado actual de las solicitudes de conexión recibidas, para decidir
      // qué notificaciones muestran botones aceptar/rechazar.
      const requesterIds = Array.from(
        new Set(
          data
            .filter((n) => n.type === "connection_request" && n.actor_user_id)
            .map((n) => n.actor_user_id as string)
        )
      );
      if (requesterIds.length > 0) {
        const { success, statuses } = await getConnectionStatuses(requesterIds);
        if (success) {
          setConnectionStatuses(statuses as Record<string, ConnectionStatusEntry>);
        }
      } else {
        setConnectionStatuses({});
      }
    } catch (err) {
      console.error("[NotificationsScreen] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const resolveConnection = useCallback(
    async (notification: NotificationRow, accept: boolean) => {
      const actorId = notification.actor_user_id || "";
      const entry = connectionStatuses[actorId];
      const data = (notification.data as NotificationDataPayload | null) ?? {};
      const connectionId = entry?.connectionId || data.entity_id;
      if (!connectionId) return;

      setActionNotifId(notification.id);
      const response = accept
        ? await acceptConnectionRequest(connectionId)
        : await rejectConnectionRequest(connectionId);
      setActionNotifId(null);

      if (!response?.success) {
        console.error("[NotificationsScreen] connection action error:", response?.error);
        return;
      }

      // Ocultar las acciones reflejando el estado REAL devuelto por el RPC
      // (puede ser 'gone' si se canceló, o el estado previo si ya se resolvió).
      const nextStatus =
        response.status === "accepted"
          ? CONNECTION_STATUS.CONNECTED
          : CONNECTION_STATUS.NONE;
      setConnectionStatuses((prev) => ({
        ...prev,
        [actorId]: {
          ...(prev[actorId] || {}),
          status: nextStatus,
        },
      }));
      if (!notification.is_read) {
        markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
      }
    },
    [connectionStatuses]
  );

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

      // Solicitud de conexión: las acciones son inline; al pulsar la tarjeta no
      // navegamos a ningún sitio (solo marca leída, ya hecho arriba).
      if (notification.type === "connection_request") {
        return;
      }

      // Conexión aceptada: abrir el chat con el otro residente.
      if (
        notification.type === "connection_accepted" &&
        (data as { other_user_id?: string }).other_user_id
      ) {
        onNavigateToEntity("directChat", {
          otherUserId: (data as { other_user_id?: string }).other_user_id,
        } as NotificationNavigationPayload);
        return;
      }

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

      // Chapó del feed: el feed vive en el inicio.
      if (data.destination_section === "inicio") {
        onNavigateToEntity("inicio", {});
        return;
      }

      // Eventos del servicio y recordatorios de agenda: abrir la Agenda.
      if (data.destination_section === "agenda") {
        onNavigateToEntity("agenda", {});
        return;
      }

      // Recordatorio del servicio asignado: abrir el tablón del residente.
      if (data.destination_section === "recordatoriosServicio") {
        onNavigateToEntity("recordatoriosServicio", {});
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
    ({ item }: { item: NotificationRow }) => {
      const entry = item.actor_user_id
        ? connectionStatuses[item.actor_user_id]
        : undefined;
      const showConnectionActions =
        item.type === "connection_request" &&
        entry?.status === CONNECTION_STATUS.PENDING_INCOMING;

      return (
        <NotificationItem
          notification={item}
          onPress={() => handleNotificationPress(item)}
          showConnectionActions={showConnectionActions}
          isActionInFlight={actionNotifId === item.id}
          onAcceptConnection={() => resolveConnection(item, true)}
          onRejectConnection={() => resolveConnection(item, false)}
        />
      );
    },
    [handleNotificationPress, connectionStatuses, actionNotifId, resolveConnection]
  );

  const keyExtractor = useCallback((item: NotificationRow) => item.id, []);

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Icon
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
