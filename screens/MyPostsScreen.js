import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import FeedComposer from "../components/feed/FeedComposer";
import FeedItemCard from "../components/feed/FeedItemCard";
import { getMyPosts, deleteFeedPost } from "../services/feedService";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

const MUTED_LIGHT = "#94A3B8";
const PAGE_SIZE = 20;

// "Mis publicaciones": el Residente ve, publica y elimina sus propios Posts.
// El Feed solo muestra lo de las Conexiones, así que esta es la única vista del
// propio contenido. Ver CONTEXT.md → Mis publicaciones.
export default function MyPostsScreen({ userProfile, onBack }) {
  const userId = userProfile?.id || null;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    posthogLogger.logScreen("MyPostsScreen");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { success, items: rows } = await getMyPosts({ limit: PAGE_SIZE });
    if (success) {
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } else {
      setItems([]);
      setHasMore(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    const before = items[items.length - 1]?.activityAt || null;
    const { success, items: rows } = await getMyPosts({
      limit: PAGE_SIZE,
      before,
    });
    if (success) {
      setItems((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, items]);

  const handleDelete = useCallback((item) => {
    Alert.alert(
      "Borrar publicación",
      "¿Seguro que quieres borrar esta publicación? Se perderán sus Chapós.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            setItems((prev) => prev.filter((it) => it.id !== item.id));
            const res = await deleteFeedPost(item.id);
            if (!res.success) {
              Alert.alert(
                "No se pudo borrar",
                res.error || "Inténtalo de nuevo."
              );
              load();
            }
          },
        },
      ]
    );
  }, [load]);

  const renderItem = useCallback(
    ({ item }) => (
      <FeedItemCard item={item} isOwn readOnlyChapo onDelete={handleDelete} />
    ),
    [handleDelete]
  );

  return (
    <HeroScreenLayout title="Mis publicaciones" onBack={onBack}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.composerWrap}>
              <FeedComposer userId={userId} onPosted={load} />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="document-text-outline" size={48} color={MUTED_LIGHT} />
              <Text style={styles.emptyTitle}>Aún no has publicado nada</Text>
              <Text style={styles.emptyText}>
                Comparte una reflexión, una victoria o una pregunta con tus
                conexiones. Tus publicaciones aparecerán aquí.
              </Text>
            </View>
          }
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY} />
              </View>
            ) : null
          }
        />
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  composerWrap: {
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B0977",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  footerLoading: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
