import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getRotationReviewWithAnswers,
  isExternalRotationReviewFavorite,
  setExternalRotationReviewFavorite,
} from "../services/externalRotationReviewService";
import { formatLongDate, formatShortDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const PRIMARY_SOFT = "#F2EBFF";
const SURFACE = "#F5F7FA";
const SURFACE_CARD = "#FFFFFF";
const SURFACE_ALT = "#EEF1F6";
const TEXT = "#111827";
const TEXT_MUTED = "#667085";
const BORDER = "#E6E8EC";
const SUCCESS = "#0F9D7A";
const WARNING = "#F97316";

const difficultyLabels = {
  easy: "Fácil",
  medium: "Media",
  hard: "Alta",
};

const rotationKindLabels = {
  observational: "Observacional",
  hands_on: "Participativa",
};

const ratingLabels = {
  "Calidad Docente": "Calidad docente",
  "Actividad Práctica": "Nivel práctico",
  "Ambiente de Trabajo": "Ambiente",
  "Recomendación General": "Recomendación",
};

const scoreIconByLabel = {
  "Calidad docente": "school-outline",
  "Nivel práctico": "medkit-outline",
  Ambiente: "people-outline",
  Recomendación: "thumbs-up-outline",
};

const ScoreCard = ({ label, value }) => {
  const isPrimary = label === "Recomendación";

  return (
    <View style={[styles.scoreCard, isPrimary && styles.scoreCardPrimary]}>
      <Text style={[styles.scoreLabel, isPrimary && styles.scoreLabelPrimary]}>
        {label}
      </Text>
      <View style={styles.scoreValueRow}>
        <Text style={[styles.scoreValue, isPrimary && styles.scoreValuePrimary]}>
          {value.toFixed(1)}
        </Text>
        <Ionicons
          name={scoreIconByLabel[label] || "star"}
          size={18}
          color={isPrimary ? "#FFFFFF" : PRIMARY}
        />
      </View>
    </View>
  );
};

const InfoChip = ({ icon, label, tone = "primary" }) => {
  const toneStyles = {
    primary: {
      backgroundColor: PRIMARY_SOFT,
      color: PRIMARY,
    },
    success: {
      backgroundColor: "#E7FBF4",
      color: SUCCESS,
    },
    warning: {
      backgroundColor: "#FFF0E7",
      color: WARNING,
    },
  };

  return (
    <View style={[styles.infoChip, { backgroundColor: toneStyles[tone].backgroundColor }]}>
      <Ionicons name={icon} size={16} color={toneStyles[tone].color} />
      <Text style={[styles.infoChipText, { color: toneStyles[tone].color }]}>
        {label}
      </Text>
    </View>
  );
};

const AnswerCard = ({ title, body, tone = "primary" }) => {
  const toneMap = {
    primary: PRIMARY,
    success: SUCCESS,
  };

  if (!body) {
    return null;
  }

  return (
    <View style={[styles.answerCard, { borderLeftColor: toneMap[tone] || PRIMARY }]}>
      <Text style={[styles.answerTitle, { color: toneMap[tone] || PRIMARY }]}>
        {title}
      </Text>
      <Text style={styles.answerBody}>{body}</Text>
    </View>
  );
};

export default function RotationReviewDetailScreen({
  reviewId,
  userId,
  onBack,
  onContact,
  onFavoriteChanged,
}) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    posthogLogger.logScreen("RotationReviewDetailScreen", { reviewId });
  }, [reviewId]);

  useEffect(() => {
    const loadReview = async () => {
      if (!reviewId) {
        setError("ID de reseña requerido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getRotationReviewWithAnswers(reviewId);
        setReview(data);
      } catch (err) {
        setError(err.message || "Error al cargar la experiencia");
      } finally {
        setLoading(false);
      }
    };

    loadReview();
  }, [reviewId]);

  useEffect(() => {
    const loadFavoriteState = async () => {
      if (!userId || !reviewId) {
        setIsFavorite(false);
        return;
      }

      try {
        const favorite = await isExternalRotationReviewFavorite(userId, reviewId);
        setIsFavorite(favorite);
      } catch (err) {
        console.error("Error loading favorite state:", err);
      }
    };

    loadFavoriteState();
  }, [reviewId, userId]);

  const ratingCards = useMemo(() => {
    const answers = review?.external_rotation_review_answer || [];
    return answers
      .filter(
        (answer) =>
          answer.external_rotation_question?.type === "rating" &&
          typeof answer.rating_value === "number"
      )
      .map((answer) => ({
        label:
          ratingLabels[answer.external_rotation_question?.text] ||
          answer.external_rotation_question?.text ||
          "Valoración",
        value: answer.rating_value,
      }))
      .slice(0, 4);
  }, [review]);

  const reviewerName = useMemo(() => {
    if (!review?.users) {
      return "Residente";
    }

    const firstName = review.users.name || "";
    const lastNameInitial = review.users.surname
      ? `${review.users.surname[0]}.`
      : "";
    return `${firstName} ${lastNameInitial}`.trim() || "Residente";
  }, [review]);

  const durationLabel = useMemo(() => {
    if (!review?.start_date) {
      return null;
    }

    if (!review?.end_date) {
      return formatShortDate(review.start_date);
    }

    return `${formatShortDate(review.start_date)} - ${formatShortDate(
      review.end_date
    )}`;
  }, [review]);

  const canFavorite = Boolean(userId && review?.user_id && review.user_id !== userId);

  const handleToggleFavorite = async () => {
    if (!canFavorite || favoriteLoading) {
      return;
    }

    try {
      setFavoriteLoading(true);
      const nextValue = !isFavorite;
      await setExternalRotationReviewFavorite(userId, reviewId, nextValue);
      setIsFavorite(nextValue);
      onFavoriteChanged?.();
    } catch (err) {
      console.error("Error toggling favorite review:", err);
    } finally {
      setFavoriteLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.stateText}>Cargando experiencia...</Text>
      </View>
    );
  }

  if (error || !review) {
    return (
      <View style={styles.stateContainer}>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.ERROR} />
        <Text style={styles.stateTitle}>No se pudo cargar la experiencia</Text>
        <Text style={styles.stateText}>
          {error || "La experiencia ya no está disponible."}
        </Text>
        <TouchableOpacity style={styles.secondaryAction} onPress={onBack}>
          <Text style={styles.secondaryActionText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle</Text>
        {canFavorite ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleToggleFavorite}
            disabled={favoriteLoading}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={22}
              color={isFavorite ? COLORS.ERROR : PRIMARY}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Experiencia real</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{review.external_hospital_name}</Text>
          <Text style={styles.heroSubtitle}>
            {[review.service_name, review.city, review.country]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileCopy}>
              <View style={styles.profileTitleRow}>
                <Text style={styles.profileName}>{reviewerName}</Text>
                <View style={styles.responseBadge}>
                  <Text style={styles.responseBadgeText}>Responde dudas</Text>
                </View>
              </View>
              <Text style={styles.profileMeta}>
                {review.specialities?.name ||
                  review.users?.specialities?.name ||
                  "Especialidad"}
                {review.users?.resident_year
                  ? ` · R${review.users.resident_year}`
                  : ""}
              </Text>
              {review.users?.hospitals?.name ? (
                <Text style={styles.profileMeta}>
                  {review.users.hospitals.name}
                </Text>
              ) : null}
              <Text style={styles.profileMeta}>
                Publicada el {formatLongDate(review.created_at)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => onContact?.(review)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionText}>Contactar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chipsRow}>
          {review.difficulty ? (
            <InfoChip
              icon="flash-outline"
              label={`Dificultad: ${difficultyLabels[review.difficulty]}`}
              tone="warning"
            />
          ) : null}
          {review.rotation_kind ? (
            <InfoChip
              icon="flask-outline"
              label={`Tipo: ${rotationKindLabels[review.rotation_kind]}`}
              tone="success"
            />
          ) : null}
          {durationLabel ? (
            <InfoChip
              icon="time-outline"
              label={`Duración: ${durationLabel}`}
              tone="primary"
            />
          ) : null}
        </View>

        {ratingCards.length > 0 ? (
          <View style={styles.scoresGrid}>
            {ratingCards.map((rating) => (
              <ScoreCard
                key={rating.label}
                label={rating.label}
                value={rating.value}
              />
            ))}
          </View>
        ) : null}

        <AnswerCard
          title="¿Qué es lo que más destacas?"
          body={review.highlight_summary}
          tone="primary"
        />
        <AnswerCard
          title="¿Qué debería saber antes de ir?"
          body={review.before_you_go}
          tone="success"
        />

        {(review.tutor_name || review.tutor_email) && (
          <View style={styles.contactCard}>
            <View style={styles.contactTitleRow}>
              <Ionicons name="mail-outline" size={18} color={PRIMARY} />
              <Text style={styles.contactTitle}>
                Contacto para acceder a la rotación
              </Text>
            </View>
            <View style={styles.contactInnerCard}>
              <View>
                <Text style={styles.contactLabel}>Tutor responsable</Text>
                <Text style={styles.contactName}>
                  {review.tutor_name || "No especificado"}
                </Text>
              </View>
              {review.tutor_email ? (
                <Text style={styles.contactEmail}>{review.tutor_email}</Text>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => onContact?.(review)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryActionText}>Contactar con este residente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ghostAction}
          onPress={onBack}
          activeOpacity={0.85}
        >
          <Text style={styles.ghostActionText}>Ver otras experiencias</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: SURFACE,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  heroCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: 20,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  badge: {
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
    fontWeight: "500",
  },
  profileCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: 20,
    gap: 18,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  profileCopy: {
    flex: 1,
  },
  profileTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT,
  },
  responseBadge: {
    backgroundColor: "#E7FBF4",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  responseBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: SUCCESS,
    textTransform: "uppercase",
  },
  profileMeta: {
    fontSize: 14,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  primaryAction: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  ghostAction: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostActionText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "800",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scoresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  scoreCard: {
    width: "47%",
    backgroundColor: SURFACE_ALT,
    borderRadius: 20,
    padding: 16,
    minHeight: 100,
    justifyContent: "space-between",
  },
  scoreCardPrimary: {
    backgroundColor: PRIMARY,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: TEXT_MUTED,
    textTransform: "uppercase",
  },
  scoreLabelPrimary: {
    color: "rgba(255,255,255,0.8)",
  },
  scoreValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: "800",
    color: TEXT,
  },
  scoreValuePrimary: {
    color: "#FFFFFF",
  },
  answerCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 20,
    padding: 18,
    borderLeftWidth: 4,
  },
  answerTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  answerBody: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_MUTED,
  },
  contactCard: {
    backgroundColor: "#EEF2F6",
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  contactTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
  },
  contactInnerCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  contactLabel: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  contactName: {
    fontSize: 17,
    fontWeight: "800",
    color: TEXT,
  },
  contactEmail: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: "600",
  },
  bottomActions: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    gap: 10,
  },
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: SURFACE,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
    marginTop: 12,
    marginBottom: 6,
  },
  stateText: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 12,
  },
  secondaryAction: {
    marginTop: 18,
    backgroundColor: SURFACE_CARD,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: PRIMARY,
    fontWeight: "700",
  },
});
