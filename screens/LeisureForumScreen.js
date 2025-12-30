import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { FloatingActionButton } from "../components/FloatingActionButton";
import { formatShortDate } from "../utils/dateUtils";
import {
  getOrCreateForum,
  getForumThreads,
  createThread,
  deleteThread,
} from "../services/forumService";
import { getCurrentUser } from "../services/authService";
import posthogLogger from "../services/posthogService";

/**
 * Helper para obtener el roleScope del usuario
 */
const getUserRoleScope = (userProfile) => {
  if (userProfile?.is_doctor) return "doctor";
  if (userProfile?.is_resident) return "resident";
  if (userProfile?.is_student) return "student";
  return "student"; // Por defecto
};

/**
 * Card de thread
 */
const ThreadCard = ({ thread, onPress, onDelete, currentUserId, deleting }) => {
  const isMyThread = thread.user_id === currentUserId;

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation(); // Evitar que se active el onPress del card
      if (onDelete) {
        onDelete(thread.id);
      }
    },
    [thread.id, onDelete]
  );

  return (
    <TouchableOpacity
      style={styles.threadCard}
      onPress={() => onPress(thread)}
      activeOpacity={0.7}
    >
      <View style={styles.threadHeader}>
        <View style={styles.authorInfo}>
          <Ionicons name="person-circle" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.authorName} numberOfLines={1}>
            {thread.user?.name} {thread.user?.surname}
          </Text>
        </View>
        <View style={styles.threadHeaderRight}>
          <Text style={styles.threadDate}>
            {formatShortDate(thread.created_at)}
          </Text>
          {isMyThread && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={deleting === thread.id}
              activeOpacity={0.7}
            >
              {deleting === thread.id ? (
                <ActivityIndicator size="small" color={COLORS.ERROR} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={COLORS.ERROR} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.threadTitle} numberOfLines={2}>
        {thread.title}
      </Text>

      {thread.body && (
        <Text style={styles.threadBody} numberOfLines={3}>
          {thread.body}
        </Text>
      )}
    </TouchableOpacity>
  );
};

/**
 * Pantalla del foro de ocio (Fiesta o Deporte)
 */
export default function LeisureForumScreen({
  onSectionChange,
  userProfile,
  forumType,
}) {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState([]);
  const [forum, setForum] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadBody, setNewThreadBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showMyThreads, setShowMyThreads] = useState(false); // Filtro para mostrar solo mis threads
  const [deletingThreadId, setDeletingThreadId] = useState(null);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("LeisureForumScreen", { forumType });
  }, [forumType]);

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

  // Cargar foro y threads
  const loadForumAndThreads = useCallback(async () => {
    if (!userProfile?.city || !forumType) {
      setError("Información del usuario incompleta");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const roleScope = getUserRoleScope(userProfile);
      if (!roleScope) {
        setError("No se pudo determinar el rol del usuario");
        setLoading(false);
        return;
      }

      // Obtener o crear el foro
      const { success: forumSuccess, forum: forumData, error: forumError } =
        await getOrCreateForum(userProfile.city, forumType, roleScope);

      if (!forumSuccess) {
        setError(forumError || "Error al cargar el foro");
        setLoading(false);
        return;
      }

      setForum(forumData);

      // Cargar threads
      const {
        success: threadsSuccess,
        threads: threadsData,
        error: threadsError,
      } = await getForumThreads(forumData.id, 0, 50);

      if (!threadsSuccess) {
        setError(threadsError || "Error al cargar los threads");
      } else {
        setThreads(threadsData || []);
      }
    } catch (err) {
      console.error("Error loading forum:", err);
      setError("Error inesperado al cargar el foro");
    } finally {
      setLoading(false);
    }
  }, [userProfile, forumType]);

  useEffect(() => {
    loadForumAndThreads();
  }, [loadForumAndThreads]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadForumAndThreads();
    setRefreshing(false);
  }, [loadForumAndThreads]);

  const handleCreateThread = useCallback(async () => {
    const trimmedTitle = newThreadTitle.trim();
    if (!trimmedTitle) {
      Alert.alert("Error", "El título es obligatorio");
      return;
    }

    if (trimmedTitle.length > 200) {
      Alert.alert("Error", "El título no puede exceder 200 caracteres");
      return;
    }

    const trimmedBody = newThreadBody.trim();
    if (trimmedBody && trimmedBody.length > 5000) {
      Alert.alert("Error", "La descripción no puede exceder 5000 caracteres");
      return;
    }

    if (!forum || !currentUserId) {
      Alert.alert("Error", "No se pudo obtener la información necesaria");
      return;
    }

    setCreating(true);

    try {
      const { success, thread, error: createError } = await createThread(
        forum.id,
        currentUserId,
        trimmedTitle,
        trimmedBody || null
      );

      if (success) {
        setNewThreadTitle("");
        setNewThreadBody("");
        setShowCreateModal(false);
        // Recargar threads
        await loadForumAndThreads();
      } else {
        Alert.alert("Error", createError || "No se pudo crear el thread");
      }
    } catch (err) {
      console.error("Error creating thread:", err);
      Alert.alert("Error", "Error inesperado al crear el thread");
    } finally {
      setCreating(false);
    }
  }, [newThreadTitle, newThreadBody, forum, currentUserId, loadForumAndThreads]);

  const handleThreadPress = useCallback(
    (thread) => {
      if (onSectionChange) {
        onSectionChange("threadDetail", { threadId: thread.id });
      }
    },
    [onSectionChange]
  );

  const handleBack = useCallback(() => {
    if (onSectionChange) {
      onSectionChange("ocio");
    }
  }, [onSectionChange]);

  // Filtrar threads según el filtro
  const filteredThreads = useMemo(() => {
    if (showMyThreads && currentUserId) {
      return threads.filter((thread) => thread.user_id === currentUserId);
    }
    return threads;
  }, [threads, showMyThreads, currentUserId]);

  // Manejar eliminación de thread
  const handleDeleteThread = useCallback(
    async (threadId) => {
      Alert.alert(
        "Eliminar thread",
        "¿Estás seguro de que quieres eliminar este thread? Esta acción no se puede deshacer.",
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              setDeletingThreadId(threadId);
              try {
                const { success, error: deleteError } = await deleteThread(
                  threadId,
                  currentUserId
                );

                if (success) {
                  // Recargar threads
                  await loadForumAndThreads();
                } else {
                  Alert.alert("Error", deleteError || "No se pudo eliminar el thread");
                }
              } catch (err) {
                console.error("Error deleting thread:", err);
                Alert.alert("Error", "Error inesperado al eliminar el thread");
              } finally {
                setDeletingThreadId(null);
              }
            },
          },
        ]
      );
    },
    [currentUserId, loadForumAndThreads]
  );

  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>{forumType}</Text>
            <Text style={styles.subtitle}>
              {userProfile?.city || "Tu ciudad"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowMyThreads(!showMyThreads)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showMyThreads ? "filter" : "filter-outline"}
              size={24}
              color={showMyThreads ? COLORS.PRIMARY : COLORS.GRAY}
            />
          </TouchableOpacity>
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
              onPress={loadForumAndThreads}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : filteredThreads.length === 0 ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.emptyContentContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={COLORS.GRAY}
              />
              <Text style={styles.emptyTitle}>
                {showMyThreads
                  ? "No has creado ningún thread"
                  : "Aún no hay publicaciones"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {showMyThreads
                  ? "Crea tu primer thread para comenzar"
                  : "Sé el primero en compartir algo en este foro"}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {filteredThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                onPress={handleThreadPress}
                onDelete={handleDeleteThread}
                currentUserId={currentUserId}
                deleting={deletingThreadId}
              />
            ))}
          </ScrollView>
        )}

        {/* Create Thread Modal */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nueva publicación</Text>
                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Título *"
                value={newThreadTitle}
                onChangeText={setNewThreadTitle}
                placeholderTextColor={COLORS.GRAY}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Descripción (opcional)"
                value={newThreadBody}
                onChangeText={setNewThreadBody}
                multiline
                numberOfLines={4}
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
                    (!newThreadTitle.trim() || creating) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleCreateThread}
                  disabled={!newThreadTitle.trim() || creating}
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 2,
  },
  filterButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  listContent: {
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
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 8,
    textAlign: "center",
  },
  threadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  threadHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
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
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  threadBody: {
    fontSize: 14,
    color: COLORS.GRAY,
    lineHeight: 20,
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
    height: 100,
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

