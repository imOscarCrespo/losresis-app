import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGroupMessages,
  sendMessage,
  subscribeToGroupMessages,
  unsubscribeFromGroupMessages,
} from "../services/groupMessagesService";
import { leaveGroup } from "../services/groupService";
import { getCurrentUser } from "../services/authService";
import posthogLogger from "../services/posthogService";

// ── Paleta ───────────────────────────────────────────────────────────
const PRIMARY = "#6D28D9";
const ACCENT = "#2E1065";
const GREEN = "#10B981";
const BG = "#F5F3FF";
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const ERROR = "#EF4444";
const MY_BUBBLE = "#6D28D9";
const OTHER_BUBBLE = "#FFFFFF";

// ── Helpers ──────────────────────────────────────────────────────────
const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateDivider = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

const getInitials = (name, surname) => {
  const first = name ? name[0].toUpperCase() : "";
  const last = surname ? surname[0].toUpperCase() : "";
  return first + last || "?";
};

// ── Insertar divisores de fecha entre mensajes ────────────────────────
const injectDateDividers = (messages) => {
  const result = [];
  let lastDate = null;

  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== lastDate) {
      lastDate = msgDate;
      result.push({ id: `divider-${msg.created_at}`, isDivider: true, dateStr: msg.created_at });
    }
    result.push(msg);
  });

  return result;
};

// ── MessageBubble ─────────────────────────────────────────────────────
function MessageBubble({ message, isOwn, showSenderName }) {
  const initials = getInitials(message.user?.name, message.user?.surname);
  const senderName = message.user
    ? `${message.user.name || ""} ${message.user.surname || ""}`.trim()
    : "Usuario";

  const avatarEl = (
    <View style={styles.avatarWrap}>
      <View style={[styles.avatar, isOwn && styles.avatarOwn]}>
        <Text style={[styles.avatarText, isOwn && styles.avatarTextOwn]}>
          {initials}
        </Text>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.messageRow,
        isOwn ? styles.messageRowOwn : styles.messageRowOther,
      ]}
    >
      {!isOwn && avatarEl}

      <View
        style={[
          styles.bubbleWrap,
          isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther,
        ]}
      >
        {!isOwn && showSenderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        <View
          style={[
            styles.bubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
          ]}
        >
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
            {message.content}
          </Text>
          <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
            {formatTime(message.created_at)}
          </Text>
        </View>
      </View>

      {isOwn && avatarEl}
    </View>
  );
}

// ── DateDivider ───────────────────────────────────────────────────────
function DateDivider({ dateStr }) {
  return (
    <View style={styles.dateDivider}>
      <View style={styles.dateDividerLine} />
      <Text style={styles.dateDividerText}>{formatDateDivider(dateStr)}</Text>
      <View style={styles.dateDividerLine} />
    </View>
  );
}

// ── GroupChatScreen ───────────────────────────────────────────────────
export default function GroupChatScreen({
  groupId,
  groupName,
  userProfile,
  onBack,
}) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const flatListRef = useRef(null);
  const channelRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    posthogLogger.logScreen("GroupChatScreen", { groupId });
  }, [groupId]);

  // Cargar usuario actual
  useEffect(() => {
    const loadUser = async () => {
      const { success, user } = await getCurrentUser();
      if (success && user) setCurrentUserId(user.id);
    };
    loadUser();
  }, []);

  // Cargar mensajes iniciales
  const loadInitialMessages = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);

    const result = await getGroupMessages(groupId, 0);

    if (!result.success) {
      setError(result.error || "Error al cargar los mensajes");
    } else {
      setMessages(result.messages || []);
      setHasMore(result.hasMore);
      setPage(0);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadInitialMessages();
  }, [loadInitialMessages]);

  // Suscripción realtime
  useEffect(() => {
    if (!groupId) return;

    const channel = subscribeToGroupMessages(groupId, (newMessage) => {
      setMessages((prev) => {
        // Evitar duplicados
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      // Scroll al nuevo mensaje si no es propio (si es propio ya scrolleamos al enviar)
      if (newMessage.user_id !== currentUserId) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    channelRef.current = channel;

    return () => {
      unsubscribeFromGroupMessages(channelRef.current);
    };
  }, [groupId, currentUserId]);

  // Scroll al fondo al cargar mensajes iniciales
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [loading]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;
    const result = await getGroupMessages(groupId, nextPage);

    if (result.success) {
      setMessages((prev) => [...(result.messages || []), ...prev]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, groupId]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !currentUserId || sending) return;

    setInputText("");
    setSending(true);

    const result = await sendMessage(groupId, currentUserId, text);

    if (!result.success) {
      setInputText(text); // Restaurar si falla
      Alert.alert("Error", result.error || "No se pudo enviar el mensaje");
    } else {
      // Añadir el mensaje optimísticamente si no llegó ya por realtime
      setMessages((prev) => {
        if (prev.some((m) => m.id === result.message.id)) return prev;
        return [...prev, result.message];
      });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }

    setSending(false);
  }, [inputText, currentUserId, sending, groupId]);

  const handleLeaveGroup = useCallback(() => {
    Alert.alert(
      "Salir del grupo",
      "¿Estás seguro de que quieres salir de este grupo? Podrás volver a unirte cuando quieras.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: async () => {
            const { success, error: leaveError } = await leaveGroup(
              groupId,
              currentUserId
            );
            if (success) {
              onBack?.();
            } else {
              Alert.alert("Error", leaveError || "No se pudo salir del grupo");
            }
          },
        },
      ]
    );
  }, [groupId, currentUserId, onBack]);

  const displayData = useMemo(
    () => injectDateDividers(messages),
    [messages]
  );

  const renderItem = useCallback(
    ({ item, index }) => {
      if (item.isDivider) {
        return <DateDivider dateStr={item.dateStr} />;
      }

      const isOwn = item.user_id === currentUserId;
      // Mostrar nombre solo si el mensaje anterior es de otro usuario diferente
      const prevItem = displayData[index - 1];
      const showSenderName =
        !isOwn &&
        (!prevItem ||
          prevItem.isDivider ||
          prevItem.user_id !== item.user_id);

      return (
        <MessageBubble
          message={item}
          isOwn={isOwn}
          showSenderName={showSenderName}
        />
      );
    },
    [currentUserId, displayData]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={WHITE} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Ionicons name="people" size={18} color={WHITE} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {groupName || "Grupo"}
            </Text>
            <Text style={styles.headerStatus}>Chat del grupo</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={handleLeaveGroup}
          activeOpacity={0.7}
        >
          <Ionicons name="exit-outline" size={22} color={WHITE + "CC"} />
        </TouchableOpacity>
      </View>

      {/* Contenido del chat */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando mensajes...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={ERROR} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadInitialMessages}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.messagesList,
            displayData.length === 0 && styles.messagesListEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={
            loadingMore ? (
              <View style={styles.loadingMoreWrap}>
                <ActivityIndicator size="small" color={PRIMARY} />
              </View>
            ) : hasMore ? (
              <TouchableOpacity
                style={styles.loadOlderBtn}
                onPress={handleLoadMore}
                activeOpacity={0.7}
              >
                <Text style={styles.loadOlderBtnText}>
                  Cargar mensajes anteriores
                </Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons
                name="chatbubbles-outline"
                size={56}
                color={PRIMARY + "40"}
              />
              <Text style={styles.emptyChatTitle}>
                ¡Sé el primero en escribir!
              </Text>
              <Text style={styles.emptyChatSubtitle}>
                Empieza la conversación con tus compañeros
              </Text>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={TEXT_LIGHT}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() || sending) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color={WHITE} />
          ) : (
            <Ionicons name="send" size={18} color={WHITE} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 4,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 4,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: WHITE + "20",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: -0.2,
  },
  headerStatus: {
    fontSize: 12,
    color: WHITE + "AA",
    marginTop: 1,
  },
  leaveBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },

  // Chat list
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  messagesListEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: TEXT_MEDIUM,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: ERROR,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "600",
  },
  loadingMoreWrap: {
    paddingVertical: 16,
    alignItems: "center",
  },
  loadOlderBtn: {
    alignSelf: "center",
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: PRIMARY + "15",
    borderRadius: 20,
  },
  loadOlderBtnText: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: "600",
  },

  // Empty state
  emptyChat: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyChatTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: ACCENT,
  },
  emptyChatSubtitle: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    textAlign: "center",
  },

  // Message row
  messageRow: {
    flexDirection: "row",
    marginVertical: 3,
    alignItems: "flex-end",
    gap: 8,
  },
  messageRowOwn: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },

  // Avatar (for other users)
  avatarWrap: {
    width: 32,
    flexShrink: 0,
    alignSelf: "flex-end",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOwn: {
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: PRIMARY + "50",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
  },
  avatarTextOwn: {
    color: PRIMARY,
  },

  // Bubble
  bubbleWrap: {
    maxWidth: "72%",
  },
  bubbleWrapOwn: {
    alignItems: "flex-end",
  },
  bubbleWrapOther: {
    alignItems: "flex-start",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY,
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleOwn: {
    backgroundColor: MY_BUBBLE,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: OTHER_BUBBLE,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  messageText: {
    fontSize: 15,
    color: ACCENT,
    lineHeight: 21,
  },
  messageTextOwn: {
    color: WHITE,
  },
  messageTime: {
    fontSize: 11,
    color: TEXT_LIGHT,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  messageTimeOwn: {
    color: WHITE + "99",
  },

  // Date divider
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 10,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EDE9FE",
  },
  dateDividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_MEDIUM,
    backgroundColor: BG,
    paddingHorizontal: 8,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: "#EDE9FE",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: BG,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: ACCENT,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    lineHeight: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: TEXT_LIGHT,
    shadowOpacity: 0,
    elevation: 0,
  },
});
