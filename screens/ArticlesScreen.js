import React, { memo, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useArticles } from "../hooks/useArticles";
import { formatShortDate, formatLongDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Card de artículo
 * Memoizado para evitar re-renders innecesarios
 */
const ArticleCard = memo(({ article, onPress, onLike, currentUserId }) => {
  const handleLike = useCallback(
    (e) => {
      e.stopPropagation();
      if (onLike && currentUserId) {
        onLike(article.id);
      }
    },
    [article.id, onLike, currentUserId]
  );

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(article);
    }
  }, [article, onPress]);

  // Extraer texto plano del HTML para el resumen
  const getPlainText = (html) => {
    if (!html || typeof html !== "string") return "";
    // Remover tags HTML básicos
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim()
      .substring(0, 150);
  };

  const summaryText = article.summary || getPlainText(article.body || "");

  return (
    <TouchableOpacity
      style={styles.articleCard}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Cover Image */}
      {article.cover_image_url && (
        <Image
          source={{ uri: article.cover_image_url }}
          style={styles.coverImage}
          resizeMode="cover"
        />
      )}

      <View style={styles.cardContent}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.authorInfo}>
            <Ionicons name="person-circle" size={20} color={COLORS.PRIMARY} />
            <Text style={styles.authorName} numberOfLines={1}>
              {article.user?.name} {article.user?.surname}
            </Text>
          </View>
          <Text style={styles.articleDate}>
            {formatShortDate(article.published_at || article.created_at)}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.articleTitle} numberOfLines={2}>
          {article.title}
        </Text>

        {/* Summary */}
        {summaryText && (
          <Text style={styles.articleSummary} numberOfLines={3}>
            {summaryText}
            {summaryText.length >= 150 && "..."}
          </Text>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={handleLike}
            disabled={!currentUserId}
            activeOpacity={0.7}
          >
            <Ionicons
              name={article.is_liked ? "heart" : "heart-outline"}
              size={18}
              color={article.is_liked ? COLORS.ERROR : COLORS.GRAY}
            />
            <Text
              style={[
                styles.likeCount,
                article.is_liked && styles.likeCountActive,
              ]}
            >
              {article.like_count || 0}
            </Text>
          </TouchableOpacity>

          <View style={styles.readMoreContainer}>
            <Text style={styles.readMoreText}>Leer más</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.PRIMARY} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

ArticleCard.displayName = "ArticleCard";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Pantalla de listado de artículos
 */
export default function ArticlesScreen({ onSectionChange, userProfile }) {
  const {
    articles,
    loading,
    error,
    hasMore,
    totalCount,
    currentUserId,
    fetchArticles,
    loadMoreArticles,
    refreshArticles,
    toggleLike,
  } = useArticles();

  const [refreshing, setRefreshing] = useState(false);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("ArticlesScreen");
  }, []);

  // Cargar artículos al montar
  useEffect(() => {
    fetchArticles(true);
  }, [fetchArticles]);

  // Manejar refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshArticles();
    setRefreshing(false);
  }, [refreshArticles]);

  // Manejar like
  const handleLike = useCallback(
    async (articleId) => {
      await toggleLike(articleId);
    },
    [toggleLike]
  );

  // Manejar navegación al detalle
  const handleArticlePress = useCallback(
    (article) => {
      if (onSectionChange) {
        onSectionChange("articleDetail", { articleId: article.id });
      }
    },
    [onSectionChange]
  );

  // Manejar carga de más artículos
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadMoreArticles();
    }
  }, [hasMore, loading, loadMoreArticles]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Artículos</Text>
        <Text style={styles.resultsText}>
          Mostrando <Text style={styles.resultsNumber}>{articles.length}</Text>{" "}
          de {totalCount} artículos
        </Text>
      </View>

      {/* Content */}
      {loading && articles.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando artículos...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.ERROR} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchArticles(true)}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : articles.length === 0 ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.emptyContentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={64}
              color={COLORS.GRAY}
            />
            <Text style={styles.emptyTitle}>
              Aún no hay artículos disponibles
            </Text>
            <Text style={styles.emptySubtitle}>
              Los artículos de la comunidad aparecerán aquí cuando estén
              publicados.
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
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } =
              nativeEvent;
            const paddingToBottom = 20;
            if (
              layoutMeasurement.height + contentOffset.y >=
              contentSize.height - paddingToBottom
            ) {
              handleLoadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onPress={handleArticlePress}
              onLike={handleLike}
              currentUserId={currentUserId}
            />
          ))}

          {/* Loading more indicator */}
          {loading && articles.length > 0 && (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color={COLORS.PRIMARY} />
              <Text style={styles.loadingMoreText}>
                Cargando más artículos...
              </Text>
            </View>
          )}

          {/* End of list */}
          {!hasMore && articles.length > 0 && (
            <View style={styles.endOfListContainer}>
              <Text style={styles.endOfListText}>
                No hay más artículos para mostrar
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: "#666",
  },
  resultsNumber: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  articleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  coverImage: {
    width: "100%",
    height: 200,
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  articleDate: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  articleTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
    lineHeight: 28,
  },
  articleSummary: {
    fontSize: 14,
    color: COLORS.GRAY,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_LIGHT,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 4,
  },
  likeCount: {
    fontSize: 14,
    color: COLORS.GRAY,
    fontWeight: "500",
  },
  likeCountActive: {
    color: COLORS.ERROR,
    fontWeight: "600",
  },
  readMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  readMoreText: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
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
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.GRAY,
  },
  endOfListContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  endOfListText: {
    fontSize: 14,
    color: COLORS.GRAY,
    fontStyle: "italic",
  },
});
