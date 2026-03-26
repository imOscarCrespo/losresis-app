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
  Dimensions,
  Keyboard,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGroupMessages,
  sendMessage,
  subscribeToGroupMessages,
  unsubscribeFromGroupMessages,
} from "../services/groupMessagesService";
import {
  getGroupById,
  getGroupMembership,
  getGroupMembers,
  leaveGroup,
  markGroupAsRead,
  setGroupNotificationsMuted,
} from "../services/groupService";
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
const TEXT_DARK = "#0F172A";
const ERROR = "#EF4444";
const MY_BUBBLE = "#6D28D9";
const OTHER_BUBBLE = "#FFFFFF";
const SURFACE = "#F8FAFC";
const BORDER = "#E2E8F0";

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

const getDisplayName = (user) =>
  `${user?.name || ""} ${user?.surname || ""}`.trim() || "Usuario";

const getGroupInfoItems = (group, membersCount) => {
  if (!group) return [];

  const items = [
    { key: "members", icon: "people-outline", label: "Miembros", value: String(membersCount) },
  ];

  if (group.speciality?.name) {
    items.push({
      key: "speciality",
      icon: "medical-outline",
      label: "Especialidad",
      value: group.speciality.name,
    });
  }

  if (group.hospital?.name) {
    items.push({
      key: "hospital",
      icon: "business-outline",
      label: "Hospital",
      value: group.hospital.name,
    });
  } else if (group.city) {
    items.push({
      key: "city",
      icon: "location-outline",
      label: "Ciudad",
      value: group.city,
    });
  }

  if (group.cohort_year) {
    items.push({
      key: "cohort",
      icon: "calendar-outline",
      label: "Cohorte",
      value: String(group.cohort_year),
    });
  }

  return items;
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
const MessageBubble = React.memo(function MessageBubble({
  message,
  isOwn,
  showSenderName,
}) {
  const initials = getInitials(message.user?.name, message.user?.surname);
  const senderName = message.user
    ? `${message.user.name || ""} ${message.user.surname || ""}`.trim()
    : "Usuario";

  const avatarEl = (
    <View style={styles.avatarWrap}>
      <View style={styles.avatar}>
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
          <View style={styles.messageMetaRow}>
            <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
              {formatTime(message.created_at)}
            </Text>
            {isOwn ? (
              <Ionicons
                name="checkmark-done"
                size={12}
                color={WHITE + "B8"}
                style={styles.messageStatusIcon}
              />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
});

// ── DateDivider ───────────────────────────────────────────────────────
const DateDivider = React.memo(function DateDivider({ dateStr }) {
  return (
    <View style={styles.dateDivider}>
      <View style={styles.dateDividerLine} />
      <Text style={styles.dateDividerText}>{formatDateDivider(dateStr)}</Text>
      <View style={styles.dateDividerLine} />
    </View>
  );
});

const ChatComposer = React.memo(function ChatComposer({
  inputText,
  onChangeText,
  onFocus,
  onBlur,
  onSend,
  sending,
  bottomInset,
}) {
  return (
    <View
      style={[
        styles.inputBar,
        { paddingBottom: bottomInset },
      ]}
    >
      <View style={styles.inputShell}>
        <Ionicons
          name="chatbox-ellipses-outline"
          size={18}
          color={TEXT_LIGHT}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          onContentSizeChange={onFocus}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={TEXT_LIGHT}
          multiline
          maxLength={2000}
          returnKeyType="default"
          scrollEnabled
          textAlignVertical="top"
        />
      </View>
      <TouchableOpacity
        style={[
          styles.sendBtn,
          (!inputText.trim() || sending) && styles.sendBtnDisabled,
        ]}
        onPress={onSend}
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
  );
});

const MemberRow = React.memo(function MemberRow({ member, isCurrentUser }) {
  const initials = getInitials(member?.user?.name, member?.user?.surname);
  const displayName = getDisplayName(member?.user);

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>{initials}</Text>
      </View>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.memberSubtitle}>
          {isCurrentUser ? "Tú" : "Dentro del grupo"}
        </Text>
      </View>
    </View>
  );
});

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
  const [groupDetails, setGroupDetails] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersVisible, setMembersVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(72);
  const [isComposerFocused, setIsComposerFocused] = useState(false);

  const flatListRef = useRef(null);
  const channelRef = useRef(null);
  const chatTouchStartRef = useRef(null);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const syncReadState = useCallback(async () => {
    if (!groupId || !currentUserId) return;
    await markGroupAsRead(groupId, currentUserId);
  }, [groupId, currentUserId]);

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

  useEffect(() => {
    const loadMembership = async () => {
      if (!groupId || !currentUserId) return;

      const result = await getGroupMembership(groupId, currentUserId);
      if (result.success && result.membership) {
        setIsMuted(!!result.membership.notifications_muted);
      }
    };

    loadMembership();
  }, [groupId, currentUserId]);

  useEffect(() => {
    const loadGroupDetails = async () => {
      if (!groupId) return;

      const result = await getGroupById(groupId);
      if (result.success) {
        setGroupDetails(result.group);
      }
    };

    loadGroupDetails();
  }, [groupId]);

  useEffect(() => {
    const windowHeight = Dimensions.get("window").height;

    const getKeyboardHeight = (event) => {
      if (!event?.endCoordinates) return 0;

      if (Platform.OS === "ios") {
        const keyboardTop = event.endCoordinates.screenY ?? windowHeight;
        return Math.max(windowHeight - keyboardTop - insets.bottom, 0);
      }

      return Math.max(event.endCoordinates.height ?? 0, 0);
    };

    const handleKeyboardShow = (event) => {
      setKeyboardHeight(getKeyboardHeight(event));
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom]);

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
      await syncReadState();
    }
    setLoading(false);
  }, [groupId, syncReadState]);

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
        syncReadState();
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    });

    channelRef.current = channel;

    return () => {
      unsubscribeFromGroupMessages(channelRef.current);
    };
  }, [groupId, currentUserId, scrollToBottom, syncReadState]);

  // Scroll al fondo al cargar mensajes iniciales
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom(false);
      }, 100);
    }
  }, [loading, messages.length, scrollToBottom]);

  useEffect(() => {
    if (keyboardHeight > 0 && messages.length > 0 && isComposerFocused) {
      const timeoutId = setTimeout(() => {
        scrollToBottom(false);
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [keyboardHeight, composerHeight, isComposerFocused, messages.length, scrollToBottom]);

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
        scrollToBottom();
      }, 50);
    }

    setSending(false);
  }, [currentUserId, groupId, inputText, scrollToBottom, sending]);

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

  const handleToggleMute = useCallback(async () => {
    if (!groupId || !currentUserId || muteLoading) return;

    const nextMuted = !isMuted;
    setMuteLoading(true);

    const result = await setGroupNotificationsMuted(
      groupId,
      currentUserId,
      nextMuted
    );

    if (result.success) {
      setIsMuted(nextMuted);
    } else {
      Alert.alert(
        "Error",
        result.error || "No se pudo actualizar la configuracion del grupo"
      );
    }

    setMuteLoading(false);
  }, [groupId, currentUserId, isMuted, muteLoading]);

  const loadMembers = useCallback(async (options = {}) => {
    const { silent = false } = options;

    if (!groupId) return;

    setMembersLoading(true);
    const result = await getGroupMembers(groupId);

    if (result.success) {
      setMembers(result.members || []);
    } else if (!silent) {
      Alert.alert("Error", result.error || "No se pudieron cargar los miembros");
    }

    setMembersLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadMembers({ silent: true });
  }, [loadMembers]);

  const handleOpenMembers = useCallback(async () => {
    setMembersVisible(true);
    await loadMembers();
  }, [loadMembers]);

  const handleComposerFocus = useCallback(() => {
    setIsComposerFocused(true);
    scrollToBottom();
  }, [scrollToBottom]);

  const handleComposerBlur = useCallback(() => {
    setIsComposerFocused(false);
  }, []);

  const handleInputChange = useCallback((text) => {
    setInputText(text);

    if (keyboardHeight > 0) {
      scrollToBottom(false);
    }
  }, [keyboardHeight, scrollToBottom]);

  const composerBottomInset = 0;
  const TAP_SLOP = 8;
  const membersCount = members.length || groupDetails?.member_count || 0;
  const groupInfoItems = useMemo(
    () => getGroupInfoItems(groupDetails, membersCount),
    [groupDetails, membersCount]
  );

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={ACCENT} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerInfo}
            onPress={handleOpenMembers}
            activeOpacity={0.75}
          >
            <View style={styles.headerAvatar}>
              <Ionicons name="people" size={18} color={WHITE} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerEyebrow}>Grupo</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {groupName || "Grupo"}
              </Text>
              <View style={styles.headerStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    isMuted && styles.statusDotMuted,
                  ]}
                />
                <Text style={styles.headerStatus}>
                  {isMuted ? "Notificaciones silenciadas" : "Notificaciones activas"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleToggleMute}
              activeOpacity={0.7}
              disabled={muteLoading}
            >
              {muteLoading ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <Ionicons
                  name={
                    isMuted
                      ? "notifications-off-outline"
                      : "notifications-outline"
                  }
                  size={18}
                  color={PRIMARY}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, styles.leaveBtn]}
              onPress={handleLeaveGroup}
              activeOpacity={0.7}
            >
              <Ionicons name="exit-outline" size={18} color={ERROR} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.chatArea}>
        <View
          style={[
            styles.chatContent,
            { paddingBottom: keyboardHeight },
          ]}
        >
          <View style={styles.chatStage}>
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
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                style={styles.messagesList}
                contentContainerStyle={[
                  styles.messagesListContent,
                  displayData.length === 0 && styles.messagesListContentEmpty,
                ]}
                showsVerticalScrollIndicator={false}
                onTouchStart={(event) => {
                  const { pageX, pageY } = event.nativeEvent;
                  chatTouchStartRef.current = { pageX, pageY };
                }}
                onTouchEnd={(event) => {
                  if (keyboardHeight <= 0 || !chatTouchStartRef.current) {
                    chatTouchStartRef.current = null;
                    return;
                  }

                  const { pageX, pageY } = event.nativeEvent;
                  const deltaX = Math.abs(pageX - chatTouchStartRef.current.pageX);
                  const deltaY = Math.abs(pageY - chatTouchStartRef.current.pageY);

                  if (deltaX <= TAP_SLOP && deltaY <= TAP_SLOP) {
                    Keyboard.dismiss();
                  }

                  chatTouchStartRef.current = null;
                }}
                onTouchCancel={() => {
                  chatTouchStartRef.current = null;
                }}
                onScrollBeginDrag={() => {
                  chatTouchStartRef.current = null;
                }}
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
                    <View style={styles.emptyChatIconWrap}>
                      <Ionicons
                        name="chatbubbles-outline"
                        size={34}
                        color={PRIMARY}
                      />
                    </View>
                    <Text style={styles.emptyChatTitle}>
                      Empieza la conversación
                    </Text>
                    <Text style={styles.emptyChatSubtitle}>
                      Este grupo todavía no tiene mensajes. Rompe el hielo con una
                      primera pregunta o comparte algo util.
                    </Text>
                  </View>
                }
              />
            )}
          </View>

          <View
            style={styles.composerWrap}
            onTouchStart={() => {
              if (messages.length > 0) {
                scrollToBottom(false);
              }
            }}
            onLayout={(event) => {
              const nextHeight = Math.ceil(event.nativeEvent.layout.height);
              if (nextHeight > 0 && nextHeight !== composerHeight) {
                setComposerHeight(nextHeight);
                if (isComposerFocused && messages.length > 0) {
                  requestAnimationFrame(() => {
                    scrollToBottom(false);
                  });
                }
              }
            }}
          >
            <ChatComposer
              inputText={inputText}
              onChangeText={handleInputChange}
              onFocus={handleComposerFocus}
              onBlur={handleComposerBlur}
              onSend={handleSend}
              sending={sending}
              bottomInset={composerBottomInset}
            />
          </View>
        </View>
      </View>

      <Modal
        visible={membersVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMembersVisible(false)}
      >
        <View style={styles.membersModalOverlay}>
          <TouchableOpacity
            style={styles.membersModalBackdrop}
            activeOpacity={1}
            onPress={() => setMembersVisible(false)}
          />

          <View style={styles.membersModalCard}>
            <View style={styles.membersModalHeader}>
              <View>
                <Text style={styles.membersModalTitle}>
                  {groupDetails?.name || groupName || "Grupo"}
                </Text>
                <Text style={styles.membersModalSubtitle}>
                  Información y miembros del grupo
                </Text>
              </View>

              <TouchableOpacity
                style={styles.membersModalClose}
                onPress={() => setMembersVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={ACCENT} />
              </TouchableOpacity>
            </View>

            {membersLoading ? (
              <View style={styles.membersState}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={styles.membersStateText}>Cargando miembros...</Text>
              </View>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <MemberRow
                    member={item}
                    isCurrentUser={item.user_id === currentUserId}
                  />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.membersListContent}
                ListHeaderComponent={
                  <View style={styles.groupInfoCard}>
                    <Text style={styles.groupInfoTitle}>Información del grupo</Text>
                    {groupInfoItems.map((item) => (
                      <View key={item.key} style={styles.groupInfoRow}>
                        <View style={styles.groupInfoLabelWrap}>
                          <Ionicons name={item.icon} size={16} color={PRIMARY} />
                          <Text style={styles.groupInfoLabel}>{item.label}</Text>
                        </View>
                        <Text style={styles.groupInfoValue}>{item.value}</Text>
                      </View>
                    ))}

                    <Text style={styles.groupInfoMembersTitle}>Miembros dentro del grupo</Text>
                  </View>
                }
                ListEmptyComponent={
                  <View style={styles.membersState}>
                    <Text style={styles.membersStateText}>
                      No hay miembros para mostrar.
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  chatArea: {
    flex: 1,
    position: "relative",
  },
  chatContent: {
    flex: 1,
  },

  // Header
  headerWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: WHITE,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: PRIMARY + "12",
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 4,
  },
  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
    letterSpacing: -0.2,
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  statusDotMuted: {
    backgroundColor: TEXT_LIGHT,
  },
  headerStatus: {
    fontSize: 12,
    color: TEXT_MEDIUM,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: PRIMARY + "10",
  },
  leaveBtn: {
    backgroundColor: ERROR + "10",
  },

  // Members modal
  membersModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.32)",
  },
  membersModalBackdrop: {
    flex: 1,
  },
  membersModalCard: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    minHeight: "45%",
    maxHeight: "78%",
  },
  membersModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  membersModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  membersModalSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: TEXT_MEDIUM,
  },
  membersModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY + "10",
  },
  membersListContent: {
    paddingBottom: 12,
  },
  groupInfoCard: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  groupInfoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 10,
  },
  groupInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 7,
  },
  groupInfoLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  groupInfoLabel: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    fontWeight: "600",
  },
  groupInfoValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: TEXT_DARK,
    fontWeight: "600",
  },
  groupInfoMembersTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    color: ACCENT,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY + "12",
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  memberSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_MEDIUM,
  },
  membersState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
  },
  membersStateText: {
    fontSize: 14,
    color: TEXT_MEDIUM,
  },

  // Chat list
  chatStage: {
    flex: 1,
    marginHorizontal: 12,
    backgroundColor: SURFACE,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 4,
    flexGrow: 1,
  },
  messagesListContentEmpty: {
    justifyContent: "center",
    paddingVertical: 32,
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
    marginHorizontal: 20,
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: WHITE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyChatIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: PRIMARY + "12",
    alignItems: "center",
    justifyContent: "center",
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
    marginVertical: 5,
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
    marginBottom: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: PRIMARY + "14",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: PRIMARY + "18",
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
    maxWidth: "78%",
  },
  bubbleWrapOwn: {
    alignItems: "flex-end",
  },
  bubbleWrapOther: {
    alignItems: "flex-start",
  },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    color: PRIMARY,
    marginBottom: 5,
    marginLeft: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bubble: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  bubbleOwn: {
    backgroundColor: MY_BUBBLE,
    borderBottomRightRadius: 8,
  },
  bubbleOther: {
    backgroundColor: OTHER_BUBBLE,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: "#E9E2FF",
  },
  messageText: {
    fontSize: 15,
    color: TEXT_DARK,
    lineHeight: 22,
  },
  messageTextOwn: {
    color: WHITE,
  },
  messageMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 6,
  },
  messageTime: {
    fontSize: 11,
    color: TEXT_LIGHT,
  },
  messageTimeOwn: {
    color: WHITE + "99",
  },
  messageStatusIcon: {
    marginTop: 1,
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
    backgroundColor: "#D8E1EE",
  },
  dateDividerText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_MEDIUM,
    backgroundColor: WHITE,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  composerWrap: {
    backgroundColor: "transparent",
  },
  inputShell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 52,
    maxHeight: 132,
    backgroundColor: WHITE,
    borderRadius: 26,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  inputIcon: {
    marginBottom: 10,
    marginRight: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
    color: TEXT_DARK,
    lineHeight: 21,
    paddingTop: 9,
    paddingBottom: 9,
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: TEXT_LIGHT,
    shadowOpacity: 0,
    elevation: 0,
  },
});
