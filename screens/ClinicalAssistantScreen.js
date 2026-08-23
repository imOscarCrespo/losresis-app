import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon } from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SelectorModal } from "../components/SelectorModal";
import { askClinicalAssistant } from "../services/clinicalAssistantService";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SURFACE = "#FFFFFF";
const BORDER = "#E5E7EB";
const TEXT_DARK = "#0F172A";
const TEXT_MEDIUM = "#334155";
const TEXT_LIGHT = "#64748B";
const ERROR = "#EF4444";

const STORAGE_KEY_PREFIX = "@losresis:clinicalAssistantChat:";
const DEFAULT_ASSISTANT_MODE = "guardia";
const ASSISTANT_MODE_OPTIONS = [
  { id: "guardia", label: "Guardia" },
  { id: "consulta", label: "Consulta" },
];

const CONVERSATION_WARN_THRESHOLD = 40;
const CONVERSATION_HARD_LIMIT = 60;
const CONVERSATION_TRIM_KEEP = 40;
const AUTO_SCROLL_BOTTOM_THRESHOLD = 120;
const STREAM_BASE_REVEAL_MS = 26;
const STREAM_MIN_REVEAL_MS = 14;
const STREAM_MAX_REVEAL_MS = 68;

const STARTER_PROMPTS = [
  "Dolor torácico opresivo de 2 horas en urgencias",
  "Disnea aguda con fiebre y saturación baja",
  "Cefalea brusca intensa en paciente joven",
];

const createMessage = (role, content) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: new Date().toISOString(),
});

const createMessageWithId = (role, content, id) => ({
  id,
  role,
  content,
  createdAt: new Date().toISOString(),
});

const getStorageKey = (userId) => `${STORAGE_KEY_PREFIX}${userId || "anonymous"}`;
const getModeLabel = (mode) =>
  ASSISTANT_MODE_OPTIONS.find((option) => option.id === mode)?.label || "Guardia";
const getTrailingPause = (text) => {
  if (!text) {
    return 0;
  }

  if (/\n\s*$/.test(text)) {
    return 26;
  }

  if (/[.!?…:]\s*$/.test(text)) {
    return 34;
  }

  if (/[,;)]\s*$/.test(text)) {
    return 18;
  }

  return 0;
};

const getNextRevealLength = (remainingText) => {
  if (!remainingText) {
    return 0;
  }

  const punctuationBoundary = remainingText.match(/^.{1,120}?(?:\n|[.!?…:](?=\s|$))/);
  if (punctuationBoundary?.[0]) {
    return punctuationBoundary[0].length;
  }

  const wordBoundary = remainingText.match(/^(?:\S+\s*){1,4}/);
  if (wordBoundary?.[0]) {
    return wordBoundary[0].length;
  }

  return Math.min(remainingText.length, 12);
};

const splitBoldSegments = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((segment, index) => {
    const isBold = segment.startsWith("**") && segment.endsWith("**");
    return {
      key: `${index}-${segment}`,
      text: isBold ? segment.slice(2, -2) : segment,
      isBold,
    };
  });

const InlineFormattedText = ({ text, style }) => (
  <Text style={style}>
    {splitBoldSegments(text).map((segment) => (
      <Text key={segment.key} style={segment.isBold ? styles.boldText : null}>
        {segment.text}
      </Text>
    ))}
  </Text>
);

const ReasoningSection = ({ reasoning, loading }) => {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef(null);
  const hasReasoning = Boolean(reasoning?.trim());

  useEffect(() => {
    if (!expanded && hasReasoning) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      });
    }
  }, [reasoning, expanded, hasReasoning]);

  if (!loading) {
    return null;
  }

  return (
    <View style={styles.reasoningBox}>
      <TouchableOpacity
        style={styles.reasoningHeader}
        onPress={() => setExpanded((current) => !current)}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel="Mostrar u ocultar razonamiento"
      >
        <View style={styles.reasoningTitleRow}>
          {!hasReasoning ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : null}
          <Text style={styles.reasoningLabel}>Razonamiento</Text>
        </View>
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={PRIMARY}
        />
      </TouchableOpacity>

      {hasReasoning ? (
        expanded ? (
          <Text style={styles.reasoningText}>{reasoning}</Text>
        ) : (
          <View style={styles.reasoningPreviewWrap}>
            <ScrollView
              ref={scrollRef}
              style={styles.reasoningPreviewScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text style={styles.reasoningText}>{reasoning}</Text>
            </ScrollView>
            <View style={styles.reasoningFade} pointerEvents="none" />
          </View>
        )
      ) : (
        <Text style={styles.reasoningText}>
          Esperando el razonamiento del modelo...
        </Text>
      )}
    </View>
  );
};

const AssistantMarkdown = ({ content, reasoning, loading }) => {
  const lines = content.split(/\r?\n/);
  const elements = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      elements.push(
        <InlineFormattedText
          key={`heading-${index}`}
          text={heading[1]}
          style={[
            styles.assistantHeading,
            elements.length > 0 && styles.assistantHeadingSpaced,
          ]}
        />
      );
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      elements.push(
        <View key={`bullet-${index}`} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>{"\u2022"}</Text>
          <InlineFormattedText text={bullet[1]} style={styles.messageText} />
        </View>
      );
      return;
    }

    elements.push(
      <InlineFormattedText
        key={`line-${index}`}
        text={line}
        style={styles.messageText}
      />
    );
  });

  if (!elements.length && loading && !reasoning) {
    return (
      <View style={styles.streamingPlaceholder}>
        <ActivityIndicator size="small" color={PRIMARY} />
        <Text style={styles.streamingPlaceholderText}>Pensando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.assistantMarkdown}>
      <ReasoningSection reasoning={reasoning} loading={loading} />
      {elements}
    </View>
  );
};

const MessageBubble = React.memo(({ message }) => {
  const isUser = message.role === "user";

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {isUser ? (
          <Text style={[styles.messageText, styles.userMessageText]}>
            {message.content}
          </Text>
        ) : (
          <>
            <AssistantMarkdown
              content={message.content || ""}
              reasoning={message.reasoning || ""}
              loading={message.isStreaming}
            />
            {/* La respuesta se quedó a medias. Va marcada dentro de la propia
                burbuja, no solo en el Alert que ya se cerró: quien vuelve al
                chat cinco minutos después tiene que seguir viendo que ese
                checklist está incompleto. */}
            {message.truncated ? (
              <View style={styles.truncatedNotice}>
                <Icon name="alert-circle-outline" size={14} color={ERROR} />
                <Text style={styles.truncatedNoticeText}>
                  Respuesta incompleta: se cortó antes de terminar. Vuelve a
                  preguntar.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
});

export default function ClinicalAssistantScreen({ userProfile, onBack }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const revealTimeoutRef = useRef(null);
  const streamTargetRef = useRef(null);
  const autoScrollEnabledRef = useRef(true);
  const [messages, setMessages] = useState([]);
  const [assistantMode, setAssistantMode] = useState(DEFAULT_ASSISTANT_MODE);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState(null);
  const [chatAreaBottomY, setChatAreaBottomY] = useState(0);
  const [composerHeight, setComposerHeight] = useState(74);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const chatAreaRef = useRef(null);
  const chatTouchStartRef = useRef(null);

  const storageKey = useMemo(
    () => getStorageKey(userProfile?.id),
    [userProfile?.id]
  );
  const assistantModeLabel = useMemo(
    () => getModeLabel(assistantMode),
    [assistantMode]
  );
  const canUseAssistant = Boolean(userProfile?.can_use_clinical_assistant);

  useEffect(() => {
    posthogLogger.logScreen("ClinicalAssistantScreen");
  }, []);

  useEffect(() => () => {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const storedValue = await AsyncStorage.getItem(storageKey);
        const parsed = storedValue ? JSON.parse(storedValue) : null;
        const storedMessages = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.messages)
            ? parsed.messages
            : [];
        const storedMode =
          parsed?.assistantMode === "consulta" || parsed?.assistantMode === "guardia"
            ? parsed.assistantMode
            : DEFAULT_ASSISTANT_MODE;
        if (!isCancelled) {
          setAssistantMode(storedMode);
          setMessages(
            storedMessages
              ? storedMessages.map((message) => ({ ...message, isStreaming: false }))
              : []
          );
        }
      } catch (loadError) {
        console.warn("Error loading clinical assistant history:", loadError);
        if (!isCancelled) {
          setAssistantMode(DEFAULT_ASSISTANT_MODE);
          setMessages([]);
        }
      } finally {
        if (!isCancelled) {
          setLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      isCancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (loadingHistory) {
      return;
    }

    // El efecto máquina de escribir hace un setMessages cada ~20 ms, así que
    // persistir en cada cambio serializaba la conversación entera decenas de
    // veces por segundo. Mientras llega la respuesta no se guarda: al terminar
    // (o al fallar) el mensaje deja de ser `isStreaming` y este efecto vuelve a
    // correr una sola vez con el texto definitivo.
    if (messages.some((message) => message.isStreaming)) {
      return;
    }

    const persistedMessages = messages.map(({ isStreaming, ...message }) => message);
    AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        assistantMode,
        messages: persistedMessages,
      })
    ).catch((saveError) => {
      console.warn("Error saving clinical assistant history:", saveError);
    });
  }, [assistantMode, loadingHistory, messages, storageKey]);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const scheduleReveal = useCallback((delay = STREAM_BASE_REVEAL_MS) => {
    if (revealTimeoutRef.current) {
      return;
    }

    revealTimeoutRef.current = setTimeout(() => {
      revealTimeoutRef.current = null;
      const streamTarget = streamTargetRef.current;
      if (!streamTarget) {
        return;
      }

      let shouldContinue = false;
      let appliedPause = 0;

      setMessages((currentMessages) =>
        currentMessages.map((message) => {
          if (message.id !== streamTarget.assistantId) {
            return message;
          }

          const nextMessage = { ...message, isStreaming: true };

          if (message.content !== streamTarget.content) {
            const remainingContent = streamTarget.content.slice(message.content.length);
            const contentLength = getNextRevealLength(remainingContent);
            nextMessage.content = message.content + remainingContent.slice(0, contentLength);
            appliedPause = Math.max(appliedPause, getTrailingPause(nextMessage.content));
          }

          if (message.reasoning !== streamTarget.reasoning) {
            const currentReasoning = message.reasoning || "";
            const remainingReasoning = streamTarget.reasoning.slice(currentReasoning.length);
            const reasoningLength = getNextRevealLength(remainingReasoning);
            nextMessage.reasoning =
              currentReasoning + remainingReasoning.slice(0, reasoningLength);
            appliedPause = Math.max(appliedPause, getTrailingPause(nextMessage.reasoning));
          }

          shouldContinue =
            nextMessage.content !== streamTarget.content ||
            (nextMessage.reasoning || "") !== streamTarget.reasoning;

          return nextMessage;
        })
      );

      if (autoScrollEnabledRef.current) {
        scrollToBottom(false);
      }

      if (shouldContinue) {
        const pendingContent = Math.max(
          (streamTarget.content?.length || 0) + (streamTarget.reasoning?.length || 0),
          0
        );
        const nextDelay = Math.max(
          STREAM_MIN_REVEAL_MS,
          Math.min(
            STREAM_MAX_REVEAL_MS,
            STREAM_BASE_REVEAL_MS - Math.min(Math.floor(pendingContent / 220), 10) + appliedPause
          )
        );
        scheduleReveal(nextDelay);
      }
    }, delay);
  }, [scrollToBottom]);

  const measureChatArea = useCallback(() => {
    requestAnimationFrame(() => {
      chatAreaRef.current?.measureInWindow?.((x, y, width, height) => {
        setChatAreaBottomY(y + height);
      });
    });
  }, []);

  useEffect(() => {
    const getKeyboardMetrics = (event) => {
      if (!event?.endCoordinates) {
        return { height: 0, top: null };
      }
      const windowHeight = Dimensions.get("window").height;
      const nextKeyboardTop = event.endCoordinates.screenY;
      if (typeof nextKeyboardTop === "number") {
        return {
          height: Math.max(windowHeight - nextKeyboardTop, 0),
          top: nextKeyboardTop,
        };
      }
      const height = Math.max(event.endCoordinates.height || 0, 0);
      return { height, top: Math.max(windowHeight - height, 0) };
    };

    const handleKeyboardShow = (event) => {
      measureChatArea();
      const metrics = getKeyboardMetrics(event);
      setKeyboardTop(metrics.top);
      setKeyboardHeight(metrics.height);
      setTimeout(() => {
        scrollToBottom(false);
      }, 80);
    };

    const handleKeyboardHide = () => {
      setKeyboardTop(null);
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
  }, [scrollToBottom, measureChatArea]);

  useEffect(() => {
    if (messages.length > 0) {
      autoScrollEnabledRef.current = true;
      scrollToBottom(false);
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (
      keyboardHeight > 0 &&
      messages.length > 0 &&
      isComposerFocused &&
      autoScrollEnabledRef.current
    ) {
      const timeoutId = setTimeout(() => {
        scrollToBottom(false);
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [keyboardHeight, composerHeight, isComposerFocused, messages.length, scrollToBottom]);

  const handleSend = async (overrideText = null) => {
    const content = (overrideText ?? inputText).trim();
    if (!content || sending || !canUseAssistant) {
      return;
    }

    const userMessage = createMessage("user", content);
    const assistantId = `assistant-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const assistantMessage = {
      ...createMessageWithId("assistant", "", assistantId),
      reasoning: "",
      isStreaming: true,
    };

    let baseMessages = messages;
    let didTrim = false;
    if (baseMessages.length + 1 > CONVERSATION_HARD_LIMIT) {
      baseMessages = baseMessages.slice(-(CONVERSATION_TRIM_KEEP - 1));
      didTrim = true;
    }
    const nextMessages = [...baseMessages, userMessage];

    if (didTrim) {
      Alert.alert(
        "Conversación resumida",
        `Hemos recortado el inicio del chat para mantener la calidad. Se conservan los últimos ${CONVERSATION_TRIM_KEEP} mensajes.`
      );
    }

    setMessages([...nextMessages, assistantMessage]);
    setInputText("");
    setError("");
    setSending(true);
    autoScrollEnabledRef.current = true;
    scrollToBottom();

    posthogLogger.capture("clinical_assistant_message_sent", {
      source: overrideText ? "starter_prompt" : "composer",
    });

    const response = await askClinicalAssistant(nextMessages, {
      mode: assistantMode,
      onChunk: (_chunk, accumulatedContent, accumulatedReasoning = "") => {
        streamTargetRef.current = {
          assistantId,
          content: accumulatedContent,
          reasoning: accumulatedReasoning,
        };
        scheduleReveal();
      },
    });

    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    streamTargetRef.current = null;

    if (response.success) {
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: response.content,
                reasoning: response.reasoning || message.reasoning || "",
                isStreaming: false,
                truncated: false,
              }
            : message
        )
      );
      posthogLogger.capture("clinical_assistant_response_received");
    } else {
      setMessages((currentMessages) =>
        currentMessages
          .map((message) => {
            if (message.id !== assistantId) {
              return message;
            }

            // Si el stream se cortó, lo que ya había llegado se queda en
            // pantalla con `truncated`: el residente puede leer lo que hay,
            // pero sabiendo que falta el final.
            const content = response.content || message.content || "";
            return {
              ...message,
              content,
              reasoning: response.reasoning || message.reasoning || "",
              isStreaming: false,
              truncated: Boolean(response.truncated && content),
            };
          })
          .filter((message) => message.id !== assistantId || message.content)
      );
      setError(response.error);
      Alert.alert(
        response.truncated ? "Respuesta incompleta" : "No se pudo responder",
        response.error || "Inténtalo de nuevo en unos segundos."
      );
      posthogLogger.capture("clinical_assistant_response_failed", {
        error: response.error,
      });
    }

    setSending(false);
  };

  const handleComposerFocus = useCallback(() => {
    setIsComposerFocused(true);
    autoScrollEnabledRef.current = true;
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

  const handleClear = () => {
    if (!messages.length || sending) {
      return;
    }

    Alert.alert(
      "Borrar conversación",
      "Se eliminará el historial local de este dispositivo.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: () => {
            setMessages([]);
            setError("");
            AsyncStorage.removeItem(storageKey).catch((clearError) => {
              console.warn("Error clearing clinical assistant history:", clearError);
            });
          },
        },
      ]
    );
  };

  const applyMode = useCallback((normalizedMode) => {
    setAssistantMode(normalizedMode);
    setMessages([]);
    setError("");
    setInputText("");
    AsyncStorage.removeItem(storageKey).catch((clearError) => {
      console.warn("Error clearing clinical assistant history after mode change:", clearError);
    });
    posthogLogger.capture("clinical_assistant_mode_changed", {
      mode: normalizedMode,
    });
  }, [storageKey]);

  const handleSelectMode = useCallback((nextMode) => {
    const normalizedMode = nextMode === "consulta" ? "consulta" : DEFAULT_ASSISTANT_MODE;

    // Cambiar de modo cambia el system prompt, así que la conversación anterior
    // no se puede arrastrar. Como el precio es perderla, se pide confirmación
    // igual que en la papelera: antes un toque en el selector la borraba sin
    // avisar. Mientras se está respondiendo ni siquiera se ofrece (ver el
    // `disabled` del botón de modo).
    if (sending || normalizedMode === assistantMode) {
      return;
    }

    if (!messages.length) {
      applyMode(normalizedMode);
      return;
    }

    Alert.alert(
      `Cambiar a modo ${getModeLabel(normalizedMode)}`,
      "Se borrará la conversación actual de este dispositivo.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cambiar y borrar",
          style: "destructive",
          onPress: () => applyMode(normalizedMode),
        },
      ]
    );
  }, [applyMode, assistantMode, messages.length, sending]);

  const renderMessage = useCallback(
    ({ item }) => <MessageBubble message={item} />,
    []
  );

  const composerBottomInset = keyboardHeight > 0 ? 0 : Math.max(insets.bottom - 8, 8);
  const TAP_SLOP = 8;

  const renderEmpty = () => {
    if (loadingHistory) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      );
    }

    if (!canUseAssistant) {
      return (
        <View style={styles.stateContainer}>
          <View style={styles.emptyIconWrap}>
            <Icon name="lock-closed-outline" size={30} color={PRIMARY} />
          </View>
          <Text style={styles.emptyTitle}>Acceso no disponible</Text>
          <Text style={styles.emptySubtitle}>
            No tienes acceso a esta funcionalidad en este momento.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <Icon name="medical-outline" size={30} color={PRIMARY} />
        </View>
        <Text style={styles.emptyTitle}>Pregunta sobre un caso de guardia</Text>
        <Text style={styles.emptySubtitle}>
          Describe sintomas, constantes, antecedentes y pruebas disponibles.
        </Text>
        <View style={styles.starterStack}>
          {STARTER_PROMPTS.map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={styles.starterButton}
              onPress={() => handleSend(prompt)}
              activeOpacity={0.78}
            >
              <Text style={styles.starterText}>{prompt}</Text>
              <Icon name="arrow-forward" size={15} color={PRIMARY} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Icon name="arrow-back" size={22} color={PRIMARY} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={styles.headerText}>
              <Text style={styles.headerEyebrow}>IA clínica</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                Asistente clínico
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.modeButton, sending && styles.disabled]}
              onPress={() => setShowModeSelector(true)}
              disabled={sending}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Seleccionar modo del asistente"
            >
              <Text style={styles.modeButtonText}>{assistantModeLabel}</Text>
              <Icon name="chevron-down" size={16} color={PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, (!messages.length || sending) && styles.disabled]}
              onPress={handleClear}
              disabled={!messages.length || sending}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Borrar conversacion"
            >
              <Icon name="trash-outline" size={18} color={PRIMARY} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <SelectorModal
        visible={showModeSelector}
        onClose={() => setShowModeSelector(false)}
        title="Seleccionar modo"
        options={ASSISTANT_MODE_OPTIONS}
        value={assistantMode}
        onSelect={handleSelectMode}
        placeholder="Sin modo"
        allowClear={false}
        confirmText="Confirmar modo"
        emptyText="No hay modos disponibles"
        enableSearch={false}
        accentColor={PRIMARY}
        primaryColor={PRIMARY}
      />

      <View
        ref={chatAreaRef}
        onLayout={measureChatArea}
        collapsable={false}
        style={[
          styles.chatArea,
          Platform.OS === "ios" &&
            keyboardHeight > 0 &&
            keyboardTop !== null &&
            chatAreaBottomY > 0 && {
              paddingBottom: Math.max(chatAreaBottomY - keyboardTop, 0),
            },
        ]}
      >
        <View style={styles.chatContent}>
          <View style={styles.chatStage}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              style={styles.messagesList}
              contentContainerStyle={[
                styles.messagesContent,
                messages.length === 0 && styles.messagesContentEmpty,
              ]}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmpty}
              onContentSizeChange={() => {
                if (autoScrollEnabledRef.current) {
                  scrollToBottom(false);
                }
              }}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                const distanceFromBottom =
                  contentSize.height - (contentOffset.y + layoutMeasurement.height);
                autoScrollEnabledRef.current =
                  distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
              }}
              scrollEventThrottle={16}
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
            />
          </View>

          {!!error && (
            <View style={styles.errorBar}>
              <Icon name="alert-circle-outline" size={16} color={ERROR} />
              <Text style={styles.errorBarText}>{error}</Text>
            </View>
          )}

          {!error &&
            messages.length >= CONVERSATION_WARN_THRESHOLD &&
            messages.length < CONVERSATION_HARD_LIMIT && (
              <View style={styles.warnBar}>
                <Icon name="information-circle-outline" size={16} color={PRIMARY} />
                <Text style={styles.warnBarText}>
                  Esta conversación es larga. Para mejor calidad, considera borrarla y empezar una nueva.
                </Text>
              </View>
            )}

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
            <View style={[styles.composerShell, { paddingBottom: composerBottomInset }]}>
              <TouchableOpacity
                style={styles.composerPlusButton}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Adjuntar"
              >
                <Icon name="add" size={32} color="#111111" />
              </TouchableOpacity>
              <View style={styles.composer}>
                <TextInput
                  value={inputText}
                  onChangeText={handleInputChange}
                  onFocus={handleComposerFocus}
                  onBlur={handleComposerBlur}
                  onContentSizeChange={handleComposerFocus}
                  placeholder="Describe el caso clinico..."
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  multiline
                  editable={!sending && canUseAssistant}
                  maxLength={5000}
                  returnKeyType="default"
                  scrollEnabled
                  textAlignVertical="top"
                />
                {!inputText.trim() && !sending ? (
                  <TouchableOpacity
                    style={styles.inlineMicButton}
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel="Dictar"
                  >
                    <Icon name="mic-outline" size={22} color="#666666" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || sending || !canUseAssistant) && styles.sendButtonDisabled,
                  ]}
                  onPress={() => handleSend()}
                  disabled={!inputText.trim() || sending || !canUseAssistant}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar"
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Icon
                      name={inputText.trim() ? "arrow-up" : "mic"}
                      size={inputText.trim() ? 24 : 25}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  chatArea: {
    flex: 1,
    position: "relative",
  },
  chatContent: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
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
  headerText: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: PRIMARY + "10",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: PRIMARY + "10",
  },
  disabled: {
    opacity: 0.36,
  },
  chatStage: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 14,
  },
  messagesList: {
    flex: 1,
  },
  messagesContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  messageRow: {
    flexDirection: "row",
    maxWidth: "100%",
  },
  messageRowAssistant: {
    alignSelf: "stretch",
    justifyContent: "flex-start",
    paddingRight: 6,
  },
  messageRowUser: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
    maxWidth: "86%",
  },
  messageBubble: {
    borderRadius: 21,
  },
  assistantBubble: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    alignSelf: "stretch",
    width: "100%",
  },
  userBubble: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 25,
    color: "#262626",
    flexShrink: 1,
  },
  userMessageText: {
    color: "#111111",
  },
  assistantMarkdown: {
    gap: 9,
    paddingRight: 8,
  },
  reasoningBox: {
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  reasoningHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reasoningTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reasoningLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: PRIMARY,
    textTransform: "uppercase",
  },
  reasoningText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_MEDIUM,
  },
  reasoningPreviewWrap: {
    marginTop: 7,
    height: 72,
    overflow: "hidden",
    position: "relative",
  },
  reasoningPreviewScroll: {
    flex: 1,
  },
  reasoningFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: "#F8FAFC",
    opacity: 0.9,
  },
  assistantHeading: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "900",
    color: "#111827",
  },
  assistantHeadingSpaced: {
    marginTop: 14,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    width: "100%",
  },
  bulletDot: {
    width: 15,
    fontSize: 16,
    lineHeight: 25,
    color: PRIMARY,
    fontWeight: "900",
  },
  boldText: {
    fontWeight: "800",
    color: TEXT_DARK,
  },
  streamingPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  streamingPlaceholderText: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_LIGHT,
    fontWeight: "700",
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4EEFF",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.12)",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: TEXT_DARK,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_LIGHT,
    textAlign: "center",
    marginBottom: 18,
  },
  starterStack: {
    width: "100%",
    gap: 10,
  },
  starterButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  starterText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: TEXT_MEDIUM,
  },
  truncatedNotice: {
    marginTop: 4,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  truncatedNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: "#991B1B",
    fontWeight: "600",
  },
  errorBar: {
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorBarText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: "#991B1B",
  },
  warnBar: {
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#F4EEFF",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warnBarText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_MEDIUM,
  },
  composerWrap: {
    backgroundColor: "transparent",
  },
  composerShell: {
    paddingHorizontal: 10,
    paddingTop: 0,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerPlusButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minHeight: 46,
    backgroundColor: "#FFFFFF",
    borderRadius: 23,
    borderWidth: 0,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 7,
  },
  input: {
    flex: 1,
    minHeight: 34,
    maxHeight: 128,
    paddingVertical: Platform.OS === "ios" ? 7 : 5,
    fontSize: 16,
    lineHeight: 21,
    color: "#111111",
  },
  inlineMicButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050505",
  },
  sendButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
});
