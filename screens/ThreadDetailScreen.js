import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { formatShortDate, formatLongDate } from "../utils/dateUtils";
import {
  getThreadById,
  getThreadPosts,
  createPost,
} from "../services/forumService";
import { getCurrentUser } from "../services/authService";
import { FloatingActionButton } from "../components/FloatingActionButton";
import posthogLogger from "../services/posthogService";

/**
 * Componente para renderizar un post y sus respuestas de forma anidada
 */
const PostItem = ({ post, level = 0, onReply, currentUserId }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const handleReply = useCallback(async () => {
    const trimmedReply = replyText.trim();
    if (!trimmedReply) {
      Alert.alert("Error", "El mensaje no puede estar vacío");
      return;
    }

    if (trimmedReply.length > 5000) {
      Alert.alert("Error", "El mensaje no puede exceder 5000 caracteres");
      return;
    }

    setReplying(true);
    try {
      const result = await onReply(post.id, trimmedReply);
      if (result) {
        setReplyText("");
        setShowReplyInput(false);
      }
    } finally {
      setReplying(false);
    }
  }, [replyText, post.id, onReply]);

  const isNested = level > 0;
  const marginLeft = level * 16;

  return (
    <View style={[styles.postContainer, { marginLeft }]}>
      <View style={[styles.postCard, isNested && styles.nestedPostCard]}>
        {/* Header del post */}
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <Ionicons name="person-circle" size={20} color={COLORS.PRIMARY} />
            <Text style={styles.authorName} numberOfLines={1}>
              {post.user?.name} {post.user?.surname}
            </Text>
            {isNested && (
              <Ionicons
                name="arrow-undo"
                size={14}
                color={COLORS.GRAY}
                style={styles.replyIcon}
              />
            )}
          </View>
          <Text style={styles.postDate}>
            {formatShortDate(post.created_at)}
          </Text>
        </View>

        {/* Cuerpo del post */}
        <Text style={styles.postBody}>{post.body}</Text>

        {/* Botón de responder (solo si no es anidado más de 2 niveles) */}
        {level < 2 && (
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => setShowReplyInput(!showReplyInput)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chatbubble-outline"
              size={16}
              color={COLORS.PRIMARY}
            />
            <Text style={styles.replyButtonText}>Responder</Text>
          </TouchableOpacity>
        )}

        {/* Input de respuesta */}
        {showReplyInput && (
          <View style={styles.replyInputContainer}>
            <TextInput
              style={styles.replyInput}
              placeholder="Escribe tu respuesta..."
              value={replyText}
              onChangeText={setReplyText}
              multiline
              placeholderTextColor={COLORS.GRAY}
              textAlignVertical="top"
            />
            <View style={styles.replyActions}>
              <TouchableOpacity
                style={styles.cancelReplyButton}
                onPress={() => {
                  setShowReplyInput(false);
                  setReplyText("");
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelReplyText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitReplyButton,
                  (!replyText.trim() || replying) &&
                    styles.submitReplyButtonDisabled,
                ]}
                onPress={handleReply}
                disabled={!replyText.trim() || replying}
                activeOpacity={0.7}
              >
                {replying ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitReplyText}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Respuestas anidadas */}
      {post.replies && post.replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {post.replies.map((reply) => (
            <PostItem
              key={reply.id}
              post={reply}
              level={level + 1}
              onReply={onReply}
              currentUserId={currentUserId}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * Pantalla de detalle del thread con sus posts
 */
export default function ThreadDetailScreen({
  threadId,
  onBack,
  userProfile,
  onSectionChange,
}) {
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostBody, setNewPostBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("ThreadDetailScreen", { threadId });
  }, [threadId]);

  // Cargar usuario actual
  useEffect(() => {
    const loadUser = async () => {
      const { success, user } = await getCurrentUser();
      if (success && user) {
        setCurrentUserId(user.id);
      }
    };
    loadUser();
  }, []);

  // Cargar thread y posts
  const loadThreadAndPosts = useCallback(async () => {
    if (!threadId) {
      setError("ID de thread no válido");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Cargar thread
      const {
        success: threadSuccess,
        thread: threadData,
        error: threadError,
      } = await getThreadById(threadId);

      if (!threadSuccess) {
        setError(threadError || "Error al cargar el thread");
        setLoading(false);
        return;
      }

      setThread(threadData);

      // Cargar posts
      const {
        success: postsSuccess,
        posts: postsData,
        error: postsError,
      } = await getThreadPosts(threadId);

      if (!postsSuccess) {
        setError(postsError || "Error al cargar los posts");
      } else {
        setPosts(postsData || []);
      }
    } catch (err) {
      console.error("Error loading thread:", err);
      setError("Error inesperado al cargar el thread");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadThreadAndPosts();
  }, [loadThreadAndPosts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadThreadAndPosts();
    setRefreshing(false);
  }, [loadThreadAndPosts]);

  const handleCreatePost = useCallback(async () => {
    const trimmedBody = newPostBody.trim();
    if (!trimmedBody) {
      Alert.alert("Error", "El mensaje no puede estar vacío");
      return;
    }

    if (trimmedBody.length > 5000) {
      Alert.alert("Error", "El mensaje no puede exceder 5000 caracteres");
      return;
    }

    if (!threadId || !currentUserId) {
      Alert.alert("Error", "No se pudo obtener la información necesaria");
      return;
    }

    setCreating(true);

    try {
      const {
        success,
        post,
        error: createError,
      } = await createPost(threadId, currentUserId, trimmedBody);

      if (success) {
        setNewPostBody("");
        setShowCreateModal(false);
        // Recargar posts
        await loadThreadAndPosts();
      } else {
        Alert.alert("Error", createError || "No se pudo crear el post");
      }
    } catch (err) {
      console.error("Error creating post:", err);
      Alert.alert("Error", "Error inesperado al crear el post");
    } finally {
      setCreating(false);
    }
  }, [newPostBody, threadId, currentUserId, loadThreadAndPosts]);

  const handleReply = useCallback(
    async (parentPostId, body) => {
      if (!threadId || !currentUserId) {
        Alert.alert("Error", "No se pudo obtener la información necesaria");
        return false;
      }

      const trimmedBody = body.trim();
      if (!trimmedBody) {
        Alert.alert("Error", "El mensaje no puede estar vacío");
        return false;
      }

      if (trimmedBody.length > 5000) {
        Alert.alert("Error", "El mensaje no puede exceder 5000 caracteres");
        return false;
      }

      try {
        const { success, error: createError } = await createPost(
          threadId,
          currentUserId,
          trimmedBody,
          parentPostId
        );

        if (success) {
          // Recargar posts
          await loadThreadAndPosts();
          return true;
        } else {
          Alert.alert("Error", createError || "No se pudo crear la respuesta");
          return false;
        }
      } catch (err) {
        console.error("Error creating reply:", err);
        Alert.alert("Error", "Error inesperado al crear la respuesta");
        return false;
      }
    },
    [threadId, currentUserId, loadThreadAndPosts]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {thread?.title || "Thread"}
          </Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.ERROR} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadThreadAndPosts}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Thread Info */}
          {thread && (
            <View style={styles.threadCard}>
              <View style={styles.threadHeader}>
                <View style={styles.authorInfo}>
                  <Ionicons
                    name="person-circle"
                    size={24}
                    color={COLORS.PRIMARY}
                  />
                  <Text style={styles.authorName} numberOfLines={1}>
                    {thread.user?.name} {thread.user?.surname}
                  </Text>
                </View>
                <Text style={styles.threadDate}>
                  {formatLongDate(thread.created_at)}
                </Text>
              </View>
              <Text style={styles.threadTitle}>{thread.title}</Text>
              {thread.body && (
                <Text style={styles.threadBody}>{thread.body}</Text>
              )}
            </View>
          )}

          {/* Posts Section */}
          <View style={styles.postsSection}>
            <Text style={styles.postsSectionTitle}>
              {posts.length} {posts.length === 1 ? "respuesta" : "respuestas"}
            </Text>

            {posts.length === 0 ? (
              <View style={styles.emptyPostsContainer}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={48}
                  color={COLORS.GRAY}
                />
                <Text style={styles.emptyPostsText}>Aún no hay respuestas</Text>
                <Text style={styles.emptyPostsSubtext}>
                  Sé el primero en responder
                </Text>
              </View>
            ) : (
              <View style={styles.postsList}>
                {posts.map((post) => (
                  <PostItem
                    key={post.id}
                    post={post}
                    level={0}
                    onReply={handleReply}
                    currentUserId={currentUserId}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Create Post Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva respuesta</Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={COLORS.TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Escribe tu respuesta..."
              value={newPostBody}
              onChangeText={setNewPostBody}
              multiline
              numberOfLines={6}
              placeholderTextColor={COLORS.GRAY}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!newPostBody.trim() || creating) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleCreatePost}
                disabled={!newPostBody.trim() || creating}
                activeOpacity={0.7}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Publicar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <FloatingActionButton
        onPress={() => setShowCreateModal(true)}
        icon="add"
        backgroundColor={COLORS.PRIMARY}
        bottom={20}
        right={20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.GRAY,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  threadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  authorName: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  threadDate: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  threadTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  threadBody: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 24,
  },
  postsSection: {
    marginTop: 8,
  },
  postsSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 16,
  },
  emptyPostsContainer: {
    alignItems: "center",
    padding: 32,
  },
  emptyPostsText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginTop: 16,
  },
  emptyPostsSubtext: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 8,
  },
  postsList: {
    gap: 12,
  },
  postContainer: {
    marginBottom: 12,
  },
  postCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  nestedPostCard: {
    backgroundColor: "#F9FAFB",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.PRIMARY,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  postDate: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  postBody: {
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
    marginBottom: 8,
  },
  replyIcon: {
    marginLeft: 6,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 4,
  },
  replyButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: "500",
  },
  replyInputContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  replyInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  replyActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cancelReplyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  cancelReplyText: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  submitReplyButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  submitReplyButtonDisabled: {
    backgroundColor: COLORS.GRAY,
    opacity: 0.5,
  },
  submitReplyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  repliesContainer: {
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
    minHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.TEXT_PRIMARY,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.GRAY,
  },
  submitButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.GRAY,
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
