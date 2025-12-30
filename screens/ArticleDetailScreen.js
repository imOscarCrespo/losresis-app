import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useArticles } from "../hooks/useArticles";
import { formatLongDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

/**
 * Componente para renderizar contenido JSONB de TipTap
 * Maneja la estructura JSON de TipTap/ProseMirror
 */

/**
 * Renderiza un nodo de texto con sus marcas (bold, italic, etc.)
 * Retorna un objeto con el texto y los estilos para poder anidarlo
 */
const renderTextNode = (node) => {
  if (!node || node.type !== "text") return null;

  const marks = node.marks || [];
  const text = node.text || "";

  // Determinar estilos según las marcas
  const textStyles = [styles.textDefault];
  if (marks.some((mark) => mark.type === "bold")) {
    textStyles.push(styles.textBold);
  }
  if (marks.some((mark) => mark.type === "italic")) {
    textStyles.push(styles.textItalic);
  }

  return { text, styles: textStyles };
};

/**
 * Renderiza un nodo recursivamente
 */
const renderNode = (node, index = 0) => {
  if (!node || !node.type) return null;

  const { type, content, attrs } = node;

  switch (type) {
    case "doc":
      // Documento raíz, renderizar su contenido
      return (
        <View key={index} style={styles.contentContainer}>
          {content && content.map((child, i) => renderNode(child, i))}
        </View>
      );

    case "paragraph":
      // Párrafo con texto que puede tener marcas
      // Determinar si está dentro de un bloque especial (lista, blockquote, etc.)
      const isInSpecialBlock = attrs?.isInList || attrs?.isInBlockquote;
      const paragraphStyle = isInSpecialBlock
        ? styles.paragraphInBlock
        : styles.paragraphContainer;

      return (
        <View key={index} style={paragraphStyle}>
          {content && content.length > 0 ? (
            <Text style={styles.paragraph}>
              {content.map((child, i) => {
                if (child.type === "text") {
                  const textNode = renderTextNode(child);
                  if (textNode) {
                    return (
                      <Text key={i} style={textNode.styles}>
                        {textNode.text}
                      </Text>
                    );
                  }
                }
                if (child.type === "hardBreak") {
                  return "\n";
                }
                if (child.type === "emoji") {
                  return (
                    <Text key={i} style={styles.emoji}>
                      {child.attrs?.emoji || child.text || ""}
                    </Text>
                  );
                }
                return null;
              })}
            </Text>
          ) : (
            <Text style={styles.paragraph}> </Text>
          )}
        </View>
      );

    case "heading":
      // Título con nivel
      const level = attrs?.level || 1;
      const headingStyle =
        level === 1
          ? styles.heading1
          : level === 2
          ? styles.heading2
          : level === 3
          ? styles.heading3
          : styles.heading4;

      return (
        <Text key={index} style={headingStyle}>
          {content &&
            content.map((child, i) => {
              if (child.type === "text") {
                const textNode = renderTextNode(child);
                if (textNode) {
                  return (
                    <Text key={i} style={textNode.styles}>
                      {textNode.text}
                    </Text>
                  );
                }
              }
              return null;
            })}
        </Text>
      );

    case "text":
      // Texto directo (puede ocurrir en algunos casos)
      return renderTextNode(node, index);

    case "hardBreak":
      // Salto de línea
      return "\n";

    case "bulletList":
    case "orderedList":
      // Lista (con o sin numeración)
      return (
        <View key={index} style={styles.listContainer}>
          {content && content.map((child, i) => renderNode(child, i))}
        </View>
      );

    case "listItem":
      // Item de lista
      return (
        <View key={index} style={styles.listItemContainer}>
          <View style={styles.listItemBullet}>
            <Text style={styles.listItemBulletText}>•</Text>
          </View>
          <View style={styles.listItemContent}>
            {content &&
              content.map((child, i) => {
                // Marcar párrafos dentro de listas para aplicar estilos diferentes
                if (child.type === "paragraph") {
                  return renderNode(
                    { ...child, attrs: { ...child.attrs, isInList: true } },
                    i
                  );
                }
                return renderNode(child, i);
              })}
          </View>
        </View>
      );

    case "blockquote":
      // Cita o bloque destacado
      return (
        <View key={index} style={styles.blockquoteContainer}>
          {content &&
            content.map((child, i) => {
              // Marcar párrafos dentro de blockquotes para aplicar estilos diferentes
              if (child.type === "paragraph") {
                return renderNode(
                  { ...child, attrs: { ...child.attrs, isInBlockquote: true } },
                  i
                );
              }
              return renderNode(child, i);
            })}
        </View>
      );

    case "emoji":
      // Emoji
      const emojiText = attrs?.emoji || node.text || "";
      return (
        <Text key={index} style={styles.emoji}>
          {emojiText}
        </Text>
      );

    default:
      // Para otros tipos de nodos, intentar renderizar su contenido
      // Esto incluye extensiones personalizadas como callouts, highlights, etc.
      if (content && Array.isArray(content)) {
        // Si tiene atributos que sugieren un bloque destacado o callout
        if (attrs?.class || attrs?.dataType || attrs?.type) {
          // Verificar si tiene un icono
          const hasIcon = attrs?.icon || attrs?.emoji;
          const iconName = attrs?.icon;
          const emojiIcon = attrs?.emoji;

          return (
            <View key={index} style={styles.customBlockContainer}>
              {hasIcon && (
                <View style={styles.customBlockIcon}>
                  {emojiIcon ? (
                    <Text style={styles.customBlockEmoji}>{emojiIcon}</Text>
                  ) : iconName ? (
                    <Ionicons name={iconName} size={20} color={COLORS.ERROR} />
                  ) : null}
                </View>
              )}
              <View style={styles.customBlockContent}>
                {content.map((child, i) => {
                  // Marcar párrafos dentro de bloques personalizados
                  if (child.type === "paragraph") {
                    return renderNode(
                      {
                        ...child,
                        attrs: { ...child.attrs, isInBlockquote: true },
                      },
                      i
                    );
                  }
                  return renderNode(child, i);
                })}
              </View>
            </View>
          );
        }
        return (
          <View key={index}>
            {content.map((child, i) => renderNode(child, i))}
          </View>
        );
      }
      return null;
  }
};

/**
 * Componente principal para renderizar contenido JSONB
 */
const ArticleContent = ({ content }) => {
  // Si no hay contenido
  if (!content) {
    return (
      <View style={styles.emptyContentContainer}>
        <Text style={styles.emptyContentText}>No hay contenido disponible</Text>
      </View>
    );
  }

  // Si el contenido es un string, intentar parsearlo como JSON
  let parsedContent = content;
  if (typeof content === "string") {
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      // Si no es JSON válido, mostrar como texto plano
      return (
        <View style={styles.contentContainer}>
          <Text style={styles.paragraph}>{content}</Text>
        </View>
      );
    }
  }

  // Si es un objeto pero no tiene la estructura esperada
  if (typeof parsedContent !== "object" || !parsedContent.type) {
    return (
      <View style={styles.emptyContentContainer}>
        <Text style={styles.emptyContentText}>
          Formato de contenido no válido
        </Text>
      </View>
    );
  }

  // Renderizar el contenido JSON
  return renderNode(parsedContent);
};

/**
 * Pantalla de detalle de artículo
 */
export default function ArticleDetailScreen({
  articleId,
  onBack,
  userProfile,
}) {
  const { fetchArticleById, toggleLike, loading } = useArticles();
  const [article, setArticle] = useState(null);
  const [isLiking, setIsLiking] = useState(false);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("ArticleDetailScreen", { articleId });
  }, [articleId]);

  // Cargar artículo al montar
  useEffect(() => {
    const loadArticle = async () => {
      if (articleId) {
        const fetchedArticle = await fetchArticleById(articleId);
        setArticle(fetchedArticle);
      }
    };
    loadArticle();
  }, [articleId, fetchArticleById]);

  // Manejar like
  const handleLike = useCallback(async () => {
    if (!article || isLiking) return;

    setIsLiking(true);
    const liked = await toggleLike(article.id);

    if (liked !== false) {
      // Actualizar estado local
      setArticle((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          is_liked: liked,
          like_count: liked
            ? (prev.like_count || 0) + 1
            : Math.max(0, (prev.like_count || 0) - 1),
        };
      });
    }
    setIsLiking(false);
  }, [article, isLiking, toggleLike]);

  if (loading && !article) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="document-text" size={64} color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando artículo...</Text>
        </View>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Ionicons
            name="document-text-outline"
            size={64}
            color={COLORS.GRAY}
          />
          <Text style={styles.errorTitle}>Artículo no encontrado</Text>
          <Text style={styles.errorText}>
            El artículo que buscas no existe o ha sido eliminado.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Volver a Artículos</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header con botón de volver */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.GRAY_DARK} />
          <Text style={styles.backButtonText}>Volver a Artículos</Text>
        </TouchableOpacity>
      </View>

      {/* Card principal */}
      <View style={styles.card}>
        {/* Título */}
        <Text style={styles.title}>{article.title}</Text>

        {/* Resumen */}
        {article.summary && (
          <Text style={styles.summary}>{article.summary}</Text>
        )}

        {/* Meta información */}
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Ionicons name="person" size={16} color={COLORS.GRAY} />
            <Text style={styles.metaText}>
              {article.user?.name} {article.user?.surname}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="calendar" size={16} color={COLORS.GRAY} />
            <Text style={styles.metaText}>
              {formatLongDate(article.published_at || article.created_at)}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.likeButton,
              article.is_liked && styles.likeButtonActive,
              !userProfile && styles.likeButtonDisabled,
            ]}
            onPress={handleLike}
            disabled={isLiking || !userProfile}
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
        </View>

        {/* Imagen de portada */}
        {article.cover_image_url && (
          <View style={styles.coverImageContainer}>
            <Image
              source={{ uri: article.cover_image_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Contenido del artículo */}
        <View style={styles.contentWrapper}>
          <ArticleContent content={article.body} />
        </View>
      </View>
    </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingContent: {
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.GRAY,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  errorContent: {
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: "center",
    marginBottom: 24,
  },
  header: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButtonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
    lineHeight: 40,
  },
  summary: {
    fontSize: 18,
    color: COLORS.GRAY,
    lineHeight: 26,
    marginBottom: 20,
  },
  metaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_LIGHT,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  likeButtonActive: {
    backgroundColor: COLORS.RED_LIGHT,
  },
  likeButtonDisabled: {
    opacity: 0.5,
  },
  likeCount: {
    fontSize: 14,
    color: COLORS.GRAY,
    fontWeight: "600",
  },
  likeCountActive: {
    color: COLORS.ERROR,
  },
  coverImageContainer: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: 250,
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  contentWrapper: {
    marginTop: 8,
  },
  contentContainer: {
    gap: 0,
  },
  paragraphContainer: {
    marginBottom: 8,
  },
  paragraphInBlock: {
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    lineHeight: 24,
  },
  listContainer: {
    marginBottom: 12,
    marginTop: 4,
  },
  listItemContainer: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-start",
  },
  listItemBullet: {
    marginRight: 8,
    marginTop: 2,
  },
  listItemBulletText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    fontWeight: "600",
  },
  listItemContent: {
    flex: 1,
  },
  blockquoteContainer: {
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
    paddingLeft: 16,
    paddingVertical: 12,
    paddingRight: 12,
    marginBottom: 12,
    marginTop: 4,
    borderRadius: 4,
  },
  customBlockContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    padding: 12,
    marginBottom: 12,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "flex-start",
  },
  customBlockIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  customBlockEmoji: {
    fontSize: 20,
  },
  customBlockContent: {
    flex: 1,
  },
  emoji: {
    fontSize: 20,
  },
  heading1: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    marginTop: 24,
    marginBottom: 16,
    lineHeight: 36,
  },
  heading2: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    marginTop: 20,
    marginBottom: 12,
    lineHeight: 32,
  },
  heading3: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 10,
    lineHeight: 28,
  },
  heading4: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
    marginTop: 14,
    marginBottom: 8,
    lineHeight: 26,
  },
  textDefault: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
    lineHeight: 24,
  },
  textBold: {
    fontWeight: "700",
  },
  textItalic: {
    fontStyle: "italic",
  },
  emptyContentContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyContentText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
});
