import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { DirectChatButton } from "../components";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  getRotationReviewWithAnswers,
  isExternalRotationReviewFavorite,
  setExternalRotationReviewFavorite,
} from "../services/externalRotationReviewService";
import { formatLongDate, formatShortDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";
import { ReviewHighlights } from "../components/externalRotations/QuickReview";
import { hasReviewContact, normalizeContactUrl } from "../utils/externalRotationQuickReview";
import { getCityLabel, getCountryLabel } from "../utils/geoSearch";

const PRIMARY = "#670CF5";
const PRIMARY_SOFT = "#F2EBFF";
const SURFACE = "#F5F7FA";
const SURFACE_CARD = "#FFFFFF";
const SURFACE_ALT = "#EEF1F6";
const TEXT = "#111827";
const TEXT_MUTED = "#667085";
const SUCCESS = "#0F9D7A";
const WARNING = "#F97316";

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

const normalizeReviewResidentData = (review) => {
  const firstName = review?.users?.name || review?.reviewer_name || "";
  const surname = review?.users?.surname || review?.reviewer_surname || "";

  return {
    residentName:
      [firstName, surname ? `${surname[0]}.` : ""].filter(Boolean).join(" ").trim() ||
      "Residente",
    specialtyName:
      review?.specialities?.name ||
      review?.users?.specialities?.name ||
      review?.reviewer_specialty_name ||
      "Especialidad",
    hospitalName: review?.users?.hospitals?.name || review?.reviewer_hospital_name || "",
  };
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
        <Icon
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
      <Icon name={icon} size={16} color={toneStyles[tone].color} />
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
  onAddDetails,
  onShareExperience,
}) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

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
    return normalizeReviewResidentData(review).residentName;
  }, [review]);

  const reviewerMeta = useMemo(() => {
    const resident = normalizeReviewResidentData(review);

    return {
      specialtyLine: [
        resident.specialtyName,
        review?.users?.resident_year ? `R${review.users.resident_year}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      hospitalLine: resident.hospitalName,
    };
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
  const canContact = Boolean(userId && review?.user_id && review.user_id !== userId);
  const isOwnReview = Boolean(userId && review?.user_id === userId);

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

  const handleOpenChat = useCallback(async () => {
    if (!canContact || chatLoading) {
      return;
    }

    try {
      setChatLoading(true);
      await onContact?.(review);
    } finally {
      setChatLoading(false);
    }
  }, [canContact, chatLoading, onContact, review]);

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
        <Icon name="alert-circle-outline" size={40} color={COLORS.ERROR} />
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
    <HeroScreenLayout
      title="Rotaciones"
      onBack={onBack}
      contentStyle={styles.container}
      rightSlot={
        canFavorite ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleToggleFavorite}
            disabled={favoriteLoading}
            activeOpacity={0.8}
          >
            <Icon
              name={isFavorite ? "heart" : "heart-outline"}
              size={22}
              color={isFavorite ? COLORS.ERROR : "#670CF5"}
            />
          </TouchableOpacity>
        ) : null
      }
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Experiencia personal de un residente</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{review.external_hospital_name}</Text>
          <Text style={styles.heroSubtitle}>
            {[
              review.service_name,
              getCityLabel(review.country, review.city),
              getCountryLabel(review.country),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileCopy}>
              <View style={styles.profileTitleRow}>
                <Text style={styles.profileName}>{reviewerName}</Text>
                {canContact ? (
                  <View style={styles.responseBadge}>
                    <Text style={styles.responseBadgeText}>Responde dudas</Text>
                  </View>
                ) : null}
              </View>
              {reviewerMeta.specialtyLine ? (
                <Text style={styles.profileMeta}>{reviewerMeta.specialtyLine}</Text>
              ) : null}
              {reviewerMeta.hospitalLine ? (
                <Text style={styles.profileMeta}>{reviewerMeta.hospitalLine}</Text>
              ) : null}
              <Text style={styles.profileMeta}>
                Publicada el {formatLongDate(review.created_at)}
              </Text>
            </View>
          </View>

          {canContact ? (
            <DirectChatButton
              style={styles.primaryAction}
              onPress={handleOpenChat}
              loading={chatLoading}
              label="Abrir chat"
              loadingLabel="Abriendo chat..."
            />
          ) : null}
        </View>

        <ReviewHighlights review={review} />

        <RotationContactCard review={review} />

        <View style={styles.chipsRow}>
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
          title="Lo que le habría gustado saber antes de ir"
          body={review.before_you_go}
          tone="success"
        />
        <AnswerCard
          title="¿Qué destacaría?"
          body={review.highlight_summary}
          tone="primary"
        />
        <AnswerCard
          title="Burocracia y documentación"
          body={review.difficulty_notes}
        />
        <AnswerCard title="Alojamiento" body={review.accommodation_notes} />
        <AnswerCard title="Costes" body={review.cost_notes} />

        {isOwnReview && onAddDetails ? (
          <TouchableOpacity
            style={styles.inviteCard}
            onPress={() => onAddDetails(review)}
            activeOpacity={0.85}
            testID="review-detail-add-details"
          >
            <Text style={styles.inviteTitle}>Añade más detalles</Text>
            <Text style={styles.inviteText}>
              Burocracia, alojamiento, costes o contactos: lo que quieras ampliar o corregir.
            </Text>
            <Text style={styles.inviteLink}>Editar mi experiencia</Text>
          </TouchableOpacity>
        ) : null}

        {!isOwnReview && onShareExperience ? (
          <TouchableOpacity
            style={styles.inviteCard}
            onPress={onShareExperience}
            activeOpacity={0.85}
            testID="review-detail-share-invite"
          >
            <Text style={styles.inviteTitle}>¿Ya has hecho una rotación externa?</Text>
            <Text style={styles.inviteText}>
              Comparte tu experiencia para ayudar a quienes están buscando destino. Te llevará
              1 minuto.
            </Text>
            <Text style={styles.inviteLink}>Compartir mi experiencia</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </HeroScreenLayout>
  );
}

const openContact = (channel, url) => {
  posthogLogger.capture("external_rotation_review_contact_opened", { channel });
  Linking.openURL(url).catch((error) => {
    console.warn("⚠️ Could not open rotation contact:", error);
    Alert.alert("No se pudo abrir", "Prueba a copiar el dato y abrirlo tú mismo.");
  });
};

const ContactRow = ({ icon, value, onPress, testID }) => (
  <TouchableOpacity
    style={styles.contactRow}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="link"
    testID={testID}
  >
    <Icon name={icon} size={18} color={PRIMARY} />
    <Text style={styles.contactValue} numberOfLines={2}>
      {value}
    </Text>
    <Icon name="open-outline" size={16} color={TEXT_MUTED} />
  </TouchableOpacity>
);

// Contacto para solicitar la rotación (ClickUp 86cbm0fbc). Las reseñas antiguas pueden no
// tenerlo, o tener solo el nombre del tutor: se pinta lo que haya.
const RotationContactCard = ({ review }) => {
  const name = review.tutor_name?.trim();
  if (!name && !hasReviewContact(review)) return null;

  const email = review.tutor_email?.trim();
  const phone = review.contact_phone?.trim();
  const url = normalizeContactUrl(review.contact_url);

  return (
    <View style={styles.contactCard} testID="review-detail-contact">
      <View style={styles.contactTitleRow}>
        <Icon name="mail-outline" size={18} color={PRIMARY} />
        <Text style={styles.contactTitle}>Contacto para solicitar esta rotación</Text>
      </View>
      <View style={styles.contactInnerCard}>
        {name ? (
          <View>
            <Text style={styles.contactLabel}>Persona o departamento</Text>
            <Text style={styles.contactName}>{name}</Text>
          </View>
        ) : null}
        {email ? (
          <ContactRow
            icon="mail-outline"
            value={email}
            onPress={() => openContact("email", `mailto:${email}`)}
            testID="review-detail-contact-email"
          />
        ) : null}
        {phone ? (
          <ContactRow
            icon="call-outline"
            value={phone}
            onPress={() => openContact("phone", `tel:${phone.replace(/[^0-9+]/g, "")}`)}
            testID="review-detail-contact-phone"
          />
        ) : null}
        {url ? (
          <ContactRow
            icon="open-outline"
            value={url.replace(/^https?:\/\//i, "")}
            onPress={() => openContact("url", url)}
            testID="review-detail-contact-url"
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(103,12,245,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
    width: "100%",
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
    flex: 1,
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
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
  },
  contactValue: {
    flex: 1,
    fontSize: 14,
    color: PRIMARY,
    fontWeight: "600",
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
  inviteCard: {
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT,
  },
  inviteText: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  inviteLink: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "800",
    color: PRIMARY,
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
