import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS } from "../constants/colors";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { SwipeBackWrapper } from "../components/SwipeBackWrapper";
import { SelectorModal } from "../components/SelectorModal";
import { SelectFilter, ConfirmationModal, DirectChatButton } from "../components";
import { usePersistedFilters } from "../hooks/usePersistedFilters";
import {
  createRotation,
  deleteRotation,
  getAllRotations,
  getUserRotations,
  respondToReviewInvite,
  updateRotation,
  updateUserPhone,
} from "../services/externalRotationService";
import {
  createRotationReview,
  deleteRotationReview,
  getFavoriteExternalRotationReviews,
  getAllExternalRotationReviews,
  DUPLICATE_REVIEW_ERROR,
  setExternalRotationReviewFavorite,
  updateRotationReview,
} from "../services/externalRotationReviewService";
import { openDirectChat } from "../services/directChatsService";
import { getSpecialitiesCatalog } from "../services/staticCatalogService";
import { normalizeSearchText } from "../utils/filterUtils";
import {
  findCountryOption,
  formatLocation,
  getCityLabel,
  getCountryLabel,
} from "../utils/geoSearch";
import {
  LocationPickerModal,
  LocationSelectField,
} from "../components/externalRotations/LocationPicker";
import {
  QUICK_REVIEW_STEPS,
  getPendingReviewInvites,
  hasExtendedDetails,
  isSameCenterName,
  quickReviewFieldsFromPlan,
  validateQuickReview,
  validateQuickReviewStep,
} from "../utils/externalRotationQuickReview";
import {
  QuickReviewAdviceStep,
  QuickReviewHighlightsStep,
  QuickReviewHowStep,
  QuickReviewNav,
  QuickReviewProgress,
  ReviewHighlights,
} from "../components/externalRotations/QuickReview";
import RotationReviewDetailScreen from "./RotationReviewDetailScreen";
import posthogLogger from "../services/posthogService";
import { useEmailReviewStatus } from "../hooks/useEmailReviewStatus";
import {
  canResidentCreateExternalRotation,
  canResidentUseSeasonalGrace,
  formatResidentTransitionDeadline,
} from "../utils/residentAccess";
import { getResidentTransitionConfig } from "../services/residentTransitionConfigService";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const PRIMARY_SOFT = "#F2EBFF";
const PRIMARY_LIGHT = "#EEE8FF";
const SURFACE = "#F5F7FA";
const SURFACE_CARD = "#FFFFFF";
const SURFACE_ALT = "#EEF1F6";
const TEXT = "#111827";
const TEXT_MUTED = "#667085";
const BORDER = "#E6E8EC";
const CARD_BORDER = "#F1F5F9";
const MUTED_LIGHT = "#94A3B8";
const SUCCESS = "#0F9D7A";
const SUCCESS_SOFT = "#E7FBF4";
const WARNING = "#F97316";
const WARNING_SOFT = "#FFF0E7";

const DEFAULT_PUBLISH_FORM = {
  rotationId: "",
  specialityId: "",
  hospitalName: "",
  serviceName: "",
  country: "",
  city: "",
  startDate: "",
  endDate: "",
  // Sin respuestas por defecto: la reseña solo recoge lo que el residente elige.
  recommendation: "",
  difficulty: "",
  rotationKind: "",
  highlightTags: [],
  difficultyNotes: "",
  highlightSummary: "",
  beforeYouGo: "",
  accommodationNotes: "",
  costNotes: "",
  tutorName: "",
  tutorEmail: "",
  preferredContactMethod: "app_chat",
  answers: {},
};

const EXPLORE_DEFAULT_FILTERS = {
  specialtyId: "",
  country: "",
  city: "",
  query: "",
};

const DEFAULT_ROTATION_FORM = {
  hospitalName: "",
  serviceName: "",
  specialityId: "",
  country: "",
  city: "",
  startDate: "",
  endDate: "",
  latitude: 40.4168,
  longitude: -3.7038,
  notes: "",
  phone: "",
};

const publishFormFromReview = (review) => ({
  rotationId: review.rotation_id || "",
  specialityId: review.speciality_id || "",
  hospitalName: review.external_hospital_name || "",
  serviceName: review.service_name || "",
  country: review.country || "",
  city: review.city || "",
  startDate: review.start_date || "",
  endDate: review.end_date || "",
  recommendation: review.recommendation || "",
  difficulty: review.difficulty || "",
  rotationKind: review.rotation_kind || "",
  highlightTags: review.highlight_tags || [],
  difficultyNotes: review.difficulty_notes || "",
  highlightSummary: review.highlight_summary || "",
  beforeYouGo: review.before_you_go || "",
  accommodationNotes: review.accommodation_notes || "",
  costNotes: review.cost_notes || "",
  tutorName: review.tutor_name || "",
  tutorEmail: review.tutor_email || "",
  preferredContactMethod: "app_chat",
  // Las valoraciones de reseñas antiguas se conservan: el formulario nuevo no las pide,
  // pero al guardar se reenvían para que no se pierdan.
  answers: (review.external_rotation_review_answer || []).reduce(
    (acc, answer) => {
      acc[answer.question_id] = {
        rating: answer.rating_value,
        textValue: answer.text_value || "",
      };
      return acc;
    },
    {}
  ),
});

// Referencia estable: una lista nueva en cada render recalcularía la búsqueda del selector.
const NO_CITIES = [];

// Coordenadas de una opción del catálogo; si no trae, se conservan las que había.
const coordinatesOf = (option, fallback) => {
  const latitude = parseFloat(option?.latitude);
  const longitude = parseFloat(option?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : { latitude: fallback.latitude, longitude: fallback.longitude };
};

const overlaps = (rotationA, rotationB) => {
  const startA = new Date(rotationA.start_date);
  const endA = new Date(rotationA.end_date || rotationA.start_date);
  const startB = new Date(rotationB.start_date);
  const endB = new Date(rotationB.end_date || rotationB.start_date);
  return startA <= endB && startB <= endA;
};

const normalizeLocationValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isSameCountryCity = (left, right) =>
  normalizeLocationValue(left?.country) === normalizeLocationValue(right?.country) &&
  normalizeLocationValue(left?.city) === normalizeLocationValue(right?.city);

const isSameService = (left, right) => {
  const a = normalizeSearchText(left);
  const b = normalizeSearchText(right);
  return Boolean(a) && a === b;
};

// Coincidencia real entre planes: mismo centro (en la misma ciudad y país) y fechas que se solapan.
// Compartir solo país o ciudad no es una coincidencia.
const isSameDestination = (left, right) =>
  isSameCountryCity(left, right) &&
  isSameCenterName(left?.hospital_name, right?.hospital_name);

const getOverlapRange = (rotationA, rotationB) => {
  const startA = new Date(rotationA.start_date);
  const endA = new Date(rotationA.end_date || rotationA.start_date);
  const startB = new Date(rotationB.start_date);
  const endB = new Date(rotationB.end_date || rotationB.start_date);
  return {
    start: startA > startB ? startA : startB,
    end: endA < endB ? endA : endB,
  };
};

const formatShortDate = (value) =>
  new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

const isNetworkError = (error) =>
  /network|fetch|timeout|timed out|offline|internet/i.test(
    String(error?.message || error || "")
  );

const settle = (promise) =>
  promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error })
  );

const parseStoredDate = (value) => {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const addMonthsToDate = (value, months = 2) => {
  const date = parseStoredDate(value);
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};

const formatDateForInput = (value) => {
  if (!value) return "";
  const date = parseStoredDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (value) => {
  if (!value) return "Seleccionar fecha";
  return parseStoredDate(value).toLocaleDateString("es-ES");
};

const formatDateRange = (startDate, endDate) => {
  if (!startDate) {
    return "";
  }

  const start = new Date(startDate).toLocaleDateString("es-ES", {
    month: "short",
    year: "numeric",
  });

  if (!endDate) {
    return start;
  }

  const end = new Date(endDate).toLocaleDateString("es-ES", {
    month: "short",
    year: "numeric",
  });

  return `${start} - ${end}`;
};

const averageRatingLabel = (review) =>
  typeof review.average_rating === "number"
    ? review.average_rating.toFixed(1)
    : "N/A";

const normalizeReviewResidentData = (review) => {
  const firstName = review?.users?.name || review?.reviewer_name || "";
  const surname = review?.users?.surname || review?.reviewer_surname || "";
  const residentName = [firstName, surname ? `${surname[0]}.` : ""]
    .filter(Boolean)
    .join(" ")
    .trim() || "Residente";

  return {
    residentName,
    specialtyName:
      review?.specialities?.name ||
      review?.users?.specialities?.name ||
      review?.reviewer_specialty_name ||
      review?.specialty_name ||
      "Residente",
    hospitalName:
      review?.users?.hospitals?.name ||
      review?.reviewer_hospital_name ||
      "",
    email: review?.users?.work_email || review?.reviewer_email || "",
    phone: review?.users?.phone || review?.reviewer_phone || "",
    userId: review?.user_id || review?.users?.id || null,
  };
};

const MatchCard = ({
  item,
  onChat,
  onContact,
  buttonLabel = "Ver contacto",
  chatLoading = false,
}) => (
  <View style={styles.matchCard}>
    <View style={styles.matchCardHeader}>
      <View style={styles.matchHeaderCopy}>
        <Text style={styles.matchName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.matchMeta} numberOfLines={2}>
          {item.meta}
        </Text>
      </View>
      {onChat ? (
        <DirectChatButton
          onPress={onChat}
          loading={chatLoading}
          size="sm"
          style={styles.matchChatButton}
        />
      ) : null}
    </View>
    <View style={styles.matchBody}>
      {item.dateLabel ? (
        <View style={styles.matchInfoRow}>
          <Icon name="calendar-outline" size={14} color={PRIMARY} />
          <Text style={styles.matchInfoText}>{item.dateLabel}</Text>
        </View>
      ) : null}
      {item.center ? (
        <View style={styles.matchInfoRow}>
          <Icon name="business-outline" size={14} color={PRIMARY} />
          <Text style={styles.matchInfoText}>{item.center}</Text>
        </View>
      ) : null}
      {item.location ? (
        <View style={styles.matchInfoRow}>
          <Icon name="location-outline" size={14} color={PRIMARY} />
          <Text style={styles.matchInfoText}>{item.location}</Text>
        </View>
      ) : null}
    </View>
    {item.reasons?.length ? (
      <View style={styles.matchReasons}>
        {item.reasons.map((reason) => (
          <View key={reason} style={styles.matchReasonChip}>
            <Icon name="checkmark-circle" size={13} color={SUCCESS} />
            <Text style={styles.matchReasonText}>{reason}</Text>
          </View>
        ))}
      </View>
    ) : null}
    <TouchableOpacity onPress={onContact} activeOpacity={0.8}>
      <Text style={styles.matchActionText}>{buttonLabel}</Text>
    </TouchableOpacity>
  </View>
);

const FilterChip = ({ label, active, icon, onPress, disabled = false, testID }) => (
  <TouchableOpacity
    testID={testID}
    style={[
      styles.filterChip,
      active && styles.filterChipActive,
      disabled && styles.filterChipDisabled,
    ]}
    onPress={onPress}
    activeOpacity={disabled ? 1 : 0.75}
    disabled={disabled}
  >
    <Icon
      name={icon}
      size={14}
      color={disabled ? TEXT_MUTED : active ? PRIMARY : TEXT}
    />
    <Text
      style={[
        styles.filterChipText,
        active && styles.filterChipTextActive,
        disabled && styles.filterChipTextDisabled,
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
    <Icon
      name="chevron-down"
      size={14}
      color={disabled ? TEXT_MUTED : active ? PRIMARY : TEXT_MUTED}
    />
  </TouchableOpacity>
);

const ReviewListCard = ({
  review,
  onPress,
  isFavorite = false,
  onToggleFavorite,
  favoriteDisabled = false,
}) => {
  const location = formatLocation(review.city, review.country);
  const dateLabel = formatDateRange(review.start_date, review.end_date);
  const hasRatings = review.ratings_count > 0 && typeof review.average_rating === "number";

  return (
    <TouchableOpacity
      style={styles.reviewCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.reviewCardTop}>
        <View style={styles.reviewChipsRow}>
          {review.specialty_name ? (
            <View style={styles.reviewChip}>
              <Text style={styles.reviewChipText} numberOfLines={1}>
                {review.specialty_name}
              </Text>
            </View>
          ) : null}
        </View>
        {onToggleFavorite ? (
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={onToggleFavorite}
            disabled={favoriteDisabled}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={
              isFavorite ? "Quitar de favoritas" : "Guardar en favoritas"
            }
          >
            <Icon
              name={isFavorite ? "heart" : "heart-outline"}
              size={22}
              color={isFavorite ? "#E11D48" : TEXT_MUTED}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.reviewCardBody}>
        <Text style={styles.reviewCardTitle} numberOfLines={2}>
          {review.external_hospital_name}
        </Text>
        {location ? (
          <View style={styles.reviewMetaRow}>
            <Icon name="location-outline" size={14} color={TEXT_MUTED} />
            <Text style={styles.reviewCardLocation} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}
        {review.service_name ? (
          <View style={styles.reviewMetaRow}>
            <Icon name="medkit-outline" size={14} color={TEXT_MUTED} />
            <Text style={styles.reviewCardLocation} numberOfLines={1}>
              {review.service_name}
            </Text>
          </View>
        ) : null}
        {dateLabel ? (
          <View style={styles.reviewMetaRow}>
            <Icon name="calendar-outline" size={14} color={TEXT_MUTED} />
            <Text style={styles.reviewCardLocation}>{dateLabel}</Text>
          </View>
        ) : null}
      </View>

      <ReviewHighlights review={review} maxTags={3} />

      {review.before_you_go || review.highlight_summary ? (
        <Text style={styles.reviewCardSummary} numberOfLines={2}>
          {review.before_you_go
            ? `Consejo: ${review.before_you_go}`
            : review.highlight_summary}
        </Text>
      ) : null}

      <View style={styles.reviewCardFooter}>
        {hasRatings ? (
          <View style={styles.reviewRatingInline}>
            <Icon name="star" size={14} color="#F4B740" />
            <Text style={styles.reviewRatingInlineText}>
              {averageRatingLabel(review)}
            </Text>
            <Text style={styles.reviewRatingCount}>
              · {review.ratings_count}{" "}
              {review.ratings_count === 1 ? "valoración" : "valoraciones"}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.reviewCardLink}>
          <Text style={styles.reviewCardLinkText}>Ver experiencia</Text>
          <Icon name="chevron-forward" size={14} color={PRIMARY} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const InlineNotice = ({ message, actionLabel, onAction }) => (
  <View style={styles.inlineNotice}>
    <Icon name="warning-outline" size={18} color={WARNING} />
    <Text style={styles.inlineNoticeText}>{message}</Text>
    {actionLabel && onAction ? (
      <TouchableOpacity onPress={onAction} activeOpacity={0.8}>
        <Text style={styles.inlineNoticeAction}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const ContactOptionCard = ({ icon, color, backgroundColor, title, subtitle, onPress, primary = false }) => (
  <TouchableOpacity
    style={[styles.contactOptionCard, primary && styles.contactOptionCardPrimary]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.contactOptionIconWrap, { backgroundColor }]}>
      <Icon name={icon} size={22} color={color} />
    </View>
    <View style={styles.contactOptionCopy}>
      <Text style={[styles.contactOptionTitle, primary && styles.contactOptionTitlePrimary]}>
        {title}
      </Text>
      <Text style={[styles.contactOptionSubtitle, primary && styles.contactOptionSubtitlePrimary]}>
        {subtitle}
      </Text>
    </View>
    <Icon
      name={primary ? "arrow-forward" : "chevron-forward"}
      size={18}
      color={primary ? "#FFFFFF" : TEXT_MUTED}
    />
  </TouchableOpacity>
);

const EmptyState = ({ icon, title, description, actionLabel, onAction }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyStateIcon}>
      <Icon name={icon} size={28} color={PRIMARY} />
    </View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    <Text style={styles.emptyStateDescription}>{description}</Text>
    {actionLabel && onAction ? (
      <TouchableOpacity style={styles.emptyStateButton} onPress={onAction}>
        <Text style={styles.emptyStateButtonText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const ExternalRotationsScreen = ({ userProfile, navigation, onBack }) => {
  const userId = userProfile?.id;
  const isResident = userProfile?.is_resident;
  const { request: emailReviewRequest } = useEmailReviewStatus(userId);
  const [transitionConfig, setTransitionConfig] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { config } = await getResidentTransitionConfig();
      if (!cancelled) setTransitionConfig(config || null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const canCreateExternalRotation = canResidentCreateExternalRotation(
    userProfile,
    { emailReviewRequest, transitionConfig }
  );
  const emailReviewStatus = emailReviewRequest?.status || null;
  const isInMirGrace = canResidentUseSeasonalGrace(userProfile, transitionConfig);
  const creationBlockedReason = !canCreateExternalRotation
    ? emailReviewStatus === "PENDING"
      ? {
          title: "Estamos validando tu email",
          message:
            "Tu correo corporativo está en revisión manual. Podrás crear y publicar rotaciones externas en cuanto lo validemos (normalmente en menos de 1 hora).",
        }
      : emailReviewStatus === "REJECTED"
      ? {
          title: "Email corporativo no validado",
          message:
            "Tu solicitud anterior fue rechazada. Actualiza tu email en el perfil y solicita una nueva revisión para poder publicar rotaciones externas.",
        }
      : isInMirGrace
      ? {
          title: "Disponible al terminar el periodo de gracia MIR",
          message: `Acabas de empezar tu residencia. Podrás crear y publicar rotaciones externas a partir del ${
            formatResidentTransitionDeadline(transitionConfig?.ends_at) ||
            "fin de la ventana MIR"
          }.`,
        }
      : {
          title: "Acción no disponible",
          message:
            "Aún no puedes publicar rotaciones externas con tu perfil actual.",
        }
    : null;

  const [route, setRoute] = useState({ name: "home", payload: null });
  const [specialties, setSpecialties] = useState([]);
  const [specialtiesError, setSpecialtiesError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [favoritePendingId, setFavoritePendingId] = useState(null);
  const [rotations, setRotations] = useState([]);
  const [userRotations, setUserRotations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [favoriteReviews, setFavoriteReviews] = useState([]);
  const [publishStep, setPublishStep] = useState(0);
  const [publishDetailsOpen, setPublishDetailsOpen] = useState(false);
  const [invitePendingId, setInvitePendingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rotationToDelete, setRotationToDelete] = useState(null);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [openExploreFilter, setOpenExploreFilter] = useState(null);
  const [rotationForm, setRotationForm] = useState(DEFAULT_ROTATION_FORM);
  const [rotationCountryCode, setRotationCountryCode] = useState("");
  const [publishForm, setPublishForm] = useState(DEFAULT_PUBLISH_FORM);
  const [publishCountryCode, setPublishCountryCode] = useState("");
  const [activeDateField, setActiveDateField] = useState(null);
  const [tempSelectedDate, setTempSelectedDate] = useState(null);
  const {
    filters: exploreFilters,
    updateFilters: updateExploreFilters,
    clearAllFilters: clearPersistedExploreFilters,
  } = usePersistedFilters(
    "external-rotations-explore",
    EXPLORE_DEFAULT_FILTERS,
    { enableDebounce: true, debounceMs: 500 }
  );

  useEffect(() => {
    posthogLogger.logScreen("ExternalRotationsScreen");
  }, []);

  // Las especialidades salen del catálogo estático empaquetado con la app: no dependen de la red,
  // así que un fallo al cargar reseñas o planes nunca deja el selector vacío.
  const loadSpecialties = useCallback(() => {
    try {
      const catalog = getSpecialitiesCatalog();
      setSpecialties(
        [...catalog]
          .filter((specialty) => specialty?.id && specialty?.name)
          .sort((a, b) => a.name.localeCompare(b.name, "es"))
      );
      setSpecialtiesError(null);
    } catch (error) {
      console.error("Error loading specialties catalog:", error);
      setSpecialtiesError("No pudimos cargar las especialidades.");
    }
  }, []);

  useEffect(() => {
    loadSpecialties();
  }, [loadSpecialties]);

  const loadData = useCallback(async () => {
    if (!userId) {
      return;
    }

    setLoading(true);

    const [
      rotationsRes,
      userRotationsRes,
      reviewsRes,
      favoriteReviewsRes,
    ] = await Promise.all([
      settle(getAllRotations({})),
      settle(getUserRotations(userId)),
      settle(getAllExternalRotationReviews(userId, {})),
      settle(getFavoriteExternalRotationReviews(userId)),
    ]);

    // Cada bloque se aplica por separado: si uno falla, el resto de la pantalla sigue funcionando.
    if (rotationsRes.ok) setRotations(rotationsRes.value || []);
    if (userRotationsRes.ok) setUserRotations(userRotationsRes.value || []);
    if (reviewsRes.ok) setReviews(reviewsRes.value || []);
    if (favoriteReviewsRes.ok) {
      setFavoriteReviews(
        (favoriteReviewsRes.value || []).filter(
          (review) => review.user_id !== userId
        )
      );
    }

    const failures = [
      rotationsRes,
      userRotationsRes,
      reviewsRes,
      favoriteReviewsRes,
    ].filter((result) => !result.ok);

    if (failures.length) {
      failures.forEach((result) =>
        console.error("Error loading external rotations data:", result.error)
      );
      setLoadError(
        failures.some((result) => isNetworkError(result.error))
          ? "Parece que no tienes conexión. Comprueba tu conexión e inténtalo de nuevo."
          : "No pudimos cargar toda la información de rotaciones externas."
      );
    } else {
      setLoadError(null);
    }

    setHasLoadedOnce(true);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Ciudades donde ya hay planes o reseñas, por país guardado: se ofrecen arriba en el
  // selector de ciudad y permiten encontrar las que se escribieron a mano.
  const knownCitiesByCountry = useMemo(() => {
    const byCountry = {};
    [...reviews, ...rotations, ...userRotations].forEach((item) => {
      const countryKey = normalizeSearchText(item?.country);
      if (!countryKey || !item?.city) return;
      if (!byCountry[countryKey]) byCountry[countryKey] = [];
      if (!byCountry[countryKey].includes(item.city)) byCountry[countryKey].push(item.city);
    });
    return byCountry;
  }, [reviews, rotations, userRotations]);

  const getKnownCities = useCallback(
    (countryName) => knownCitiesByCountry[normalizeSearchText(countryName)] || NO_CITIES,
    [knownCitiesByCountry]
  );

  const exploreCountryCode = findCountryOption(exploreFilters.country)?.isoCode || "";

  const specialtyIds = useMemo(
    () => new Set(specialties.map((specialty) => specialty.id)),
    [specialties]
  );

  // Un filtro guardado con una especialidad que ya no existe en el catálogo no debe filtrar nada.
  const activeExploreSpecialtyId = specialtyIds.has(exploreFilters.specialtyId)
    ? exploreFilters.specialtyId
    : "";

  // La especialidad del perfil solo se sugiere si existe en el catálogo disponible.
  const profileSpecialtyId = specialtyIds.has(userProfile?.speciality_id)
    ? userProfile.speciality_id
    : "";

  const hasActiveExploreFilters = Boolean(
    activeExploreSpecialtyId ||
      exploreFilters.country ||
      exploreFilters.city ||
      String(exploreFilters.query || "").trim()
  );

  const clearExploreFilters = useCallback(() => {
    clearPersistedExploreFilters();
  }, [clearPersistedExploreFilters]);

  const handleExploreCountryChange = useCallback(
    (country) => {
      // La ciudad depende del país: si el país cambia, la ciudad anterior deja de ser válida.
      updateExploreFilters(
        country === exploreFilters.country ? { country } : { country, city: "" }
      );
    },
    [exploreFilters.country, updateExploreFilters]
  );

  const specialtyOptions = useMemo(
    () =>
      specialties.map((specialty) => ({
        value: specialty.id,
        label: specialty.name,
      })),
    [specialties]
  );

  const selectedExploreSpecialtyLabel = useMemo(
    () =>
      specialtyOptions.find((option) => option.value === activeExploreSpecialtyId)
        ?.label || "Especialidad",
    [activeExploreSpecialtyId, specialtyOptions]
  );

  const profileSpecialtyLabel = useMemo(
    () =>
      specialtyOptions.find((option) => option.value === profileSpecialtyId)
        ?.label || "",
    [profileSpecialtyId, specialtyOptions]
  );

  const myReviews = useMemo(
    () => reviews.filter((review) => review.user_id === userId),
    [reviews, userId]
  );

  const publishedReviews = useMemo(
    () =>
      reviews.filter(
        (review) => review.is_approved || review.user_id === userId
      ),
    [reviews, userId]
  );

  const filteredReviews = useMemo(() => {
    const normalizedQuery = normalizeSearchText(exploreFilters.query);

    return publishedReviews.filter((review) => {
      if (
        activeExploreSpecialtyId &&
        review.speciality_id !== activeExploreSpecialtyId
      ) {
        return false;
      }

      if (
        normalizedQuery &&
        ![
          review.external_hospital_name,
          review.service_name,
          review.city,
          getCityLabel(review.country, review.city),
        ]
          .map(normalizeSearchText)
          .some((value) => value.includes(normalizedQuery))
      ) {
        return false;
      }

      // Mayúsculas y tildes no cuentan: la ciudad puede venir escrita a mano.
      if (
        exploreFilters.country &&
        normalizeSearchText(review.country) !==
          normalizeSearchText(exploreFilters.country)
      ) {
        return false;
      }

      if (
        exploreFilters.city &&
        normalizeSearchText(review.city) !== normalizeSearchText(exploreFilters.city)
      ) {
        return false;
      }

      return true;
    });
  }, [activeExploreSpecialtyId, exploreFilters, publishedReviews]);

  const exploreVisibleReviews = useMemo(
    () => filteredReviews.filter((review) => review.user_id !== userId),
    [filteredReviews, userId]
  );

  // Experiencias de otros residentes publicadas, sin aplicar filtros: distingue "todavía no hay
  // experiencias" de "ninguna coincide con tus filtros".
  const othersPublishedReviewsCount = useMemo(
    () =>
      publishedReviews.filter(
        (review) => review.is_approved && review.user_id !== userId
      ).length,
    [publishedReviews, userId]
  );

  const favoriteIds = useMemo(
    () => new Set(favoriteReviews.map((review) => review.id)),
    [favoriteReviews]
  );

  const primaryUserRotation = userRotations[0] || null;
  const primaryUserReview = myReviews[0] || null;

  const upcomingMatches = useMemo(() => {
    if (!userRotations.length) {
      return [];
    }

    const ownRotationIds = new Set(userRotations.map((rotation) => rotation.id));

    return rotations
      .filter(
        (rotation) =>
          !ownRotationIds.has(rotation.id) && rotation.user_id !== userId
      )
      .map((rotation) => {
        const mine = userRotations.find(
          (own) => isSameDestination(own, rotation) && overlaps(own, rotation)
        );
        return mine ? { rotation, mine } : null;
      })
      .filter(Boolean)
      .slice(0, 10)
      .map(({ rotation, mine }) => {
        const overlap = getOverlapRange(mine, rotation);
        const reasons = [
          "Mismo hospital o centro",
          `Coincidís del ${formatShortDate(overlap.start)} al ${formatShortDate(
            overlap.end
          )}`,
        ];

        if (isSameService(mine.service_name, rotation.service_name)) {
          reasons.push(`Mismo servicio: ${rotation.service_name}`);
        }

        return {
          id: rotation.id,
          userId: rotation.user_id,
          name:
            `${rotation.user_name} ${rotation.user_surname}`.trim() || "Residente",
          meta: `${rotation.specialty_name || "Residente"}${
            rotation.user_resident_year ? ` · R${rotation.user_resident_year}` : ""
          }`,
          dateLabel: formatDateRange(rotation.start_date, rotation.end_date),
          center: [rotation.hospital_name, rotation.service_name]
            .filter(Boolean)
            .join(" · "),
          location: formatLocation(rotation.city, rotation.country),
          reasons,
          phone: rotation.user_phone,
          email: rotation.user_email,
        };
      });
  }, [rotations, userId, userRotations]);

  const historicalMatches = useMemo(() => {
    const ownReviewIds = new Set(myReviews.map((review) => review.id));

    return publishedReviews
      .filter((review) => review.is_approved && !ownReviewIds.has(review.id))
      .filter((review) =>
        userRotations.length
          ? userRotations.some(
              (rotation) =>
                isSameCountryCity(rotation, review) &&
                !overlaps(rotation, review)
            )
          : true
      )
      .slice(0, 4);
  }, [publishedReviews, myReviews, userRotations]);

  const selectedReview = route.payload?.review || null;

  // Formulario tal y como se abrió, para avisar antes de salir con cambios sin guardar.
  const publishFormSnapshotRef = useRef(null);

  const applyPublishForm = useCallback((form) => {
    publishFormSnapshotRef.current = JSON.stringify(form);
    setPublishForm(form);
  }, []);

  const resetPublishForm = useCallback(
    (review = null, plan = null) => {
      if (!review) {
        const fromPlan = plan ? quickReviewFieldsFromPlan(plan) : {};
        setPublishCountryCode(findCountryOption(fromPlan.country)?.isoCode || "");
        // Sin fechas por defecto: es una rotación ya hecha y el residente elige cuándo fue.
        // Desde la invitación, el plan terminado rellena el paso 1.
        applyPublishForm({
          ...DEFAULT_PUBLISH_FORM,
          ...fromPlan,
          specialityId: fromPlan.specialityId || profileSpecialtyId,
        });
        return;
      }

      const matchedCountry = findCountryOption(review.country);
      setPublishCountryCode(matchedCountry?.isoCode || "");

      applyPublishForm(publishFormFromReview(review));
    },
    [applyPublishForm, profileSpecialtyId]
  );

  const resetRotationForm = useCallback(
    (rotation = null) => {
      if (!rotation) {
        const startDate = formatDateForInput(new Date());
        setRotationCountryCode("");
        setRotationForm({
          ...DEFAULT_ROTATION_FORM,
          specialityId: profileSpecialtyId,
          startDate,
          endDate: formatDateForInput(addMonthsToDate(startDate)),
          phone: userProfile?.phone || "",
        });
        return;
      }

      const matchedCountry = findCountryOption(rotation.country);
      const startDate = rotation.start_date || formatDateForInput(new Date());
      setRotationCountryCode(matchedCountry?.isoCode || "");
      setRotationForm({
        hospitalName: rotation.hospital_name || "",
        serviceName: rotation.service_name || "",
        specialityId: rotation.speciality_id || "",
        country: rotation.country || "",
        city: rotation.city || "",
        startDate,
        endDate:
          rotation.end_date || formatDateForInput(addMonthsToDate(startDate)),
        latitude: rotation.latitude || 40.4168,
        longitude: rotation.longitude || -3.7038,
        notes: rotation.notes || "",
        phone: userProfile?.phone || "",
      });
    },
    [profileSpecialtyId, userProfile?.phone]
  );

  const openRotationForm = useCallback(
    (rotation = null) => {
      if (creationBlockedReason && !rotation) {
        Alert.alert(creationBlockedReason.title, creationBlockedReason.message);
        return;
      }
      resetRotationForm(rotation);
      setRoute({ name: "rotation", payload: { rotation } });
    },
    [creationBlockedReason, resetRotationForm]
  );

  // Medición del recorrido (solo agregados en PostHog): origen, inicio y paso más avanzado.
  const publishSessionRef = useRef(null);

  /**
   * Abre la reseña rápida. `plan` la rellena desde un plan terminado (invitación);
   * `stepIndex` y `detailsOpen` permiten ir directo a ampliar una reseña propia.
   */
  const openPublish = useCallback(
    (review = null, { plan = null, source = "hub", stepIndex = 0, detailsOpen } = {}) => {
      if (creationBlockedReason && !review) {
        Alert.alert(creationBlockedReason.title, creationBlockedReason.message);
        return;
      }

      // Ya compartió la experiencia de este plan: editarla en vez de duplicarla.
      const existingForPlan =
        !review && plan ? myReviews.find((item) => item.rotation_id === plan.id) : null;
      const target = review || existingForPlan || null;
      const isEditing = Boolean(target);

      resetPublishForm(target, target ? null : plan);
      setPublishStep(stepIndex);
      setPublishDetailsOpen(
        detailsOpen ?? Boolean(target && hasExtendedDetails(publishFormFromReview(target)))
      );
      publishSessionRef.current = {
        source,
        isEditing,
        startedAt: Date.now(),
        maxStep: stepIndex,
      };
      posthogLogger.capture("external_rotation_review_started", {
        source,
        is_editing: isEditing,
        from_plan: Boolean(plan),
      });
      setRoute({ name: "publish", payload: { review: target } });
    },
    [creationBlockedReason, myReviews, resetPublishForm]
  );

  const goToPublishStep = useCallback((nextStep) => {
    setPublishStep(nextStep);
    const session = publishSessionRef.current;
    if (session && nextStep > session.maxStep) {
      session.maxStep = nextStep;
      posthogLogger.capture("external_rotation_review_step_viewed", {
        step: nextStep + 1,
        step_key: QUICK_REVIEW_STEPS[nextStep]?.key,
        source: session.source,
        is_editing: session.isEditing,
      });
    }
  }, []);

  const handlePublishNext = useCallback(() => {
    const problem = validateQuickReviewStep(
      QUICK_REVIEW_STEPS[publishStep].key,
      publishForm
    );
    if (problem) {
      Alert.alert(problem.title, problem.message);
      return;
    }
    goToPublishStep(Math.min(publishStep + 1, QUICK_REVIEW_STEPS.length - 1));
  }, [goToPublishStep, publishForm, publishStep]);

  const pendingReviewInvites = useMemo(
    () =>
      canCreateExternalRotation
        ? getPendingReviewInvites(userRotations, myReviews)
        : [],
    [canCreateExternalRotation, myReviews, userRotations]
  );

  const handleRespondToInvite = useCallback(
    async (plan, response) => {
      try {
        setInvitePendingId(plan.id);
        const updated = await respondToReviewInvite(plan.id, userId, response);
        setUserRotations((current) =>
          current.map((item) => (item.id === plan.id ? { ...item, ...updated } : item))
        );
        posthogLogger.capture("external_rotation_review_invite_dismissed", { response });
      } catch (error) {
        console.error("Error responding to review invite:", error);
        Alert.alert("Error", "No se pudo guardar tu respuesta. Inténtalo de nuevo.");
      } finally {
        setInvitePendingId(null);
      }
    },
    [userId]
  );

  const handleOpenContact = useCallback((review) => {
    setRoute({ name: "contact", payload: { review } });
  }, []);

  // El selector devuelve la opción elegida (`id` es lo que se guarda) o null al quitarla.
  // Si el país cambia, la ciudad anterior deja de ser válida.
  const handlePublishCountryChange = useCallback((option) => {
    setPublishCountryCode(option?.isoCode || "");
    setPublishForm((current) =>
      current.country === (option?.id || "")
        ? current
        : { ...current, country: option?.id || "", city: "" }
    );
  }, []);

  const handlePublishCityChange = useCallback((option) => {
    setPublishForm((current) => ({
      ...current,
      city: option?.id || "",
    }));
  }, []);

  const handleRotationCountryChange = useCallback((option) => {
    setRotationCountryCode(option?.isoCode || "");
    setRotationForm((current) =>
      current.country === (option?.id || "")
        ? current
        : {
            ...current,
            country: option?.id || "",
            city: "",
            ...coordinatesOf(option, current),
          }
    );
  }, []);

  const handleRotationCityChange = useCallback((option) => {
    // Una ciudad escrita a mano no está en el catálogo: se usan las coordenadas del
    // país, porque external_rotation.latitude/longitude no admiten vacío.
    setRotationForm((current) => ({
      ...current,
      city: option?.id || "",
      ...coordinatesOf(
        option?.latitude ? option : findCountryOption(current.country),
        current
      ),
    }));
  }, []);

  const resetDatePickerState = useCallback(() => {
    setActiveDateField(null);
    setTempSelectedDate(null);
  }, []);

  const openDatePicker = useCallback((field, value) => {
    setActiveDateField(field);
    setTempSelectedDate(parseStoredDate(value));
  }, []);

  const applySelectedDate = useCallback((field, selectedDate) => {
    if (!field || !selectedDate) {
      return;
    }

    if (field === "rotationStartDate") {
      const nextStartDate = formatDateForInput(selectedDate);

      setRotationForm((current) => ({
        ...current,
        startDate: nextStartDate,
        endDate: formatDateForInput(addMonthsToDate(selectedDate)),
      }));
      return;
    }

    if (field === "rotationEndDate") {
      setRotationForm((current) => ({
        ...current,
        endDate: formatDateForInput(selectedDate),
      }));
      return;
    }

    if (field === "publishStartDate") {
      const nextStartDate = formatDateForInput(selectedDate);

      // Solo se propone una fecha de fin si no había una válida: no pisar la que ya eligió.
      setPublishForm((current) => ({
        ...current,
        startDate: nextStartDate,
        endDate:
          current.endDate && current.endDate >= nextStartDate
            ? current.endDate
            : formatDateForInput(addMonthsToDate(selectedDate)),
      }));
      return;
    }

    if (field === "publishEndDate") {
      setPublishForm((current) => ({
        ...current,
        endDate: formatDateForInput(selectedDate),
      }));
    }
  }, []);

  const handleDateChange = useCallback(
    (event, selectedDate) => {
      if (Platform.OS === "android") {
        if (event.type === "set" && selectedDate) {
          applySelectedDate(activeDateField, selectedDate);
        }
        resetDatePickerState();
        return;
      }

      if (selectedDate) {
        setTempSelectedDate(selectedDate);
      }
    },
    [activeDateField, applySelectedDate, resetDatePickerState]
  );

  const handleConfirmDate = useCallback(() => {
    if (!activeDateField || !tempSelectedDate) {
      return;
    }

    applySelectedDate(activeDateField, tempSelectedDate);
    resetDatePickerState();
  }, [activeDateField, applySelectedDate, resetDatePickerState, tempSelectedDate]);

  const activeDateMinimum = useMemo(() => {
    if (activeDateField === "rotationStartDate") {
      return new Date();
    }

    if (activeDateField === "rotationEndDate") {
      return parseStoredDate(rotationForm.startDate);
    }

    if (activeDateField === "publishEndDate") {
      return parseStoredDate(publishForm.startDate);
    }

    return undefined;
  }, [activeDateField, publishForm.startDate, rotationForm.startDate]);

  // Una experiencia es de una rotación ya empezada: su inicio no puede ser futuro.
  const activeDateMaximum = useMemo(
    () => (activeDateField === "publishStartDate" ? new Date() : undefined),
    [activeDateField]
  );

  const refreshAll = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const buildRotationData = useCallback(() => {
    const matchedCountry = findCountryOption(rotationForm.country);

    if (
      !rotationForm.hospitalName.trim() ||
      !matchedCountry ||
      !rotationForm.city ||
      !rotationForm.startDate ||
      !rotationForm.endDate
    ) {
      return {
        error: {
          title: "Faltan datos",
          message: "Completa hospital o centro, país, ciudad y las fechas aproximadas.",
        },
      };
    }

    if (rotationForm.endDate < rotationForm.startDate) {
      return {
        error: {
          title: "Revisa las fechas",
          message: "La fecha de fin no puede ser anterior a la de inicio.",
        },
      };
    }

    return {
      data: {
        latitude: rotationForm.latitude,
        longitude: rotationForm.longitude,
        start_date: rotationForm.startDate,
        end_date: rotationForm.endDate,
        country: matchedCountry.id,
        city: rotationForm.city,
        hospital_name: rotationForm.hospitalName.trim(),
        service_name: rotationForm.serviceName.trim(),
        speciality_id: specialtyIds.has(rotationForm.specialityId)
          ? rotationForm.specialityId
          : null,
        notes: rotationForm.notes,
        phone: rotationForm.phone,
      },
    };
  }, [rotationCountryCode, rotationForm, specialtyIds]);

  const handleReviewRotation = useCallback(() => {
    const { error } = buildRotationData();
    if (error) {
      Alert.alert(error.title, error.message);
      return;
    }
    setRoute((current) => ({
      name: "rotation",
      payload: { ...(current.payload || {}), step: "review" },
    }));
  }, [buildRotationData]);

  const handleSubmitRotation = useCallback(
    async () => {
      if (creationBlockedReason) {
        Alert.alert(creationBlockedReason.title, creationBlockedReason.message);
        return;
      }

      const { data: rotationData, error: validationError } = buildRotationData();
      if (validationError) {
        Alert.alert(validationError.title, validationError.message);
        return;
      }

      try {
        setSaving(true);

        if (rotationData.phone?.trim()) {
          await updateUserPhone(userId, rotationData.phone.trim());
        }

        if (route.payload?.rotation?.id) {
          await updateRotation(route.payload.rotation.id, rotationData, userId);
        } else {
          await createRotation(rotationData, userId);
        }

        setRoute({ name: "plan", payload: null });
        refreshAll();
      } catch (error) {
        console.error("Error saving rotation:", error);
        Alert.alert(
          "Error",
          isNetworkError(error)
            ? "No hay conexión. Tu plan no se ha guardado; inténtalo de nuevo."
            : "No se pudo guardar tu plan de rotación."
        );
      } finally {
        setSaving(false);
      }
    },
    [
      buildRotationData,
      creationBlockedReason,
      refreshAll,
      route.payload?.rotation?.id,
      userId,
    ]
  );

  const handleToggleFavorite = useCallback(
    async (review) => {
      if (!userId || !review?.id || favoritePendingId) {
        return;
      }

      const shouldFavorite = !favoriteIds.has(review.id);
      const previousFavorites = favoriteReviews;
      setFavoritePendingId(review.id);
      setFavoriteReviews((current) =>
        shouldFavorite
          ? [review, ...current.filter((item) => item.id !== review.id)]
          : current.filter((item) => item.id !== review.id)
      );

      try {
        await setExternalRotationReviewFavorite(userId, review.id, shouldFavorite);
      } catch (error) {
        console.error("Error toggling rotation review favorite:", error);
        setFavoriteReviews(previousFavorites);
        Alert.alert(
          "Error",
          isNetworkError(error)
            ? "No hay conexión. No hemos podido actualizar tus favoritas."
            : "No se pudo actualizar tus favoritas."
        );
      } finally {
        setFavoritePendingId(null);
      }
    },
    [favoriteIds, favoritePendingId, favoriteReviews, userId]
  );

  const handleDeleteRotation = useCallback(async () => {
    if (!rotationToDelete) {
      return;
    }

    try {
      setSaving(true);
      await deleteRotation(rotationToDelete.id, userId);
      setRotationToDelete(null);
      refreshAll();
    } catch (error) {
      console.error("Error deleting rotation:", error);
      Alert.alert("Error", "No se pudo eliminar la rotación.");
    } finally {
      setSaving(false);
    }
  }, [refreshAll, rotationToDelete, userId]);

  const handleDeleteReview = useCallback(async () => {
    if (!reviewToDelete) {
      return;
    }

    try {
      setSaving(true);
      await deleteRotationReview(reviewToDelete.id, userId);
      setReviewToDelete(null);
      setRoute({ name: "home", payload: null });
      refreshAll();
    } catch (error) {
      console.error("Error deleting review:", error);
      Alert.alert("Error", "No se pudo eliminar la experiencia.");
    } finally {
      setSaving(false);
    }
  }, [refreshAll, reviewToDelete, userId]);

  const handlePublishSubmit = useCallback(async () => {
    const isEditing = Boolean(route.payload?.review?.id);
    if (creationBlockedReason) {
      Alert.alert(creationBlockedReason.title, creationBlockedReason.message);
      return;
    }

    const formProblem = validateQuickReview(publishForm);
    if (formProblem) {
      setPublishStep(formProblem.stepIndex);
      Alert.alert(formProblem.title, formProblem.message);
      return;
    }

    const formattedAnswers = Object.entries(publishForm.answers || {})
      .filter(([, answer]) => answer?.rating || answer?.textValue?.trim())
      .map(([questionId, answer]) => ({
        question_id: questionId,
        rating_value:
          answer.rating !== undefined && answer.rating !== null
            ? Number(answer.rating)
            : null,
        text_value: answer.textValue?.trim() || null,
      }));

    const payload = {
      userId,
      rotationId: publishForm.rotationId || null,
      externalHospitalName: publishForm.hospitalName,
      serviceName: publishForm.serviceName,
      specialityId: specialtyIds.has(publishForm.specialityId)
        ? publishForm.specialityId
        : null,
      city: publishForm.city,
      country: publishForm.country,
      startDate: publishForm.startDate,
      endDate: publishForm.endDate || null,
      recommendation: publishForm.recommendation,
      highlightTags: publishForm.highlightTags,
      difficulty: publishForm.difficulty,
      difficultyNotes: publishForm.difficultyNotes,
      rotationKind: publishForm.rotationKind,
      highlightSummary: publishForm.highlightSummary,
      beforeYouGo: publishForm.beforeYouGo,
      accommodationNotes: publishForm.accommodationNotes,
      costNotes: publishForm.costNotes,
      tutorName: publishForm.tutorName,
      tutorEmail: publishForm.tutorEmail,
      preferredContactMethod: "app_chat",
      answers: formattedAnswers,
    };

    const previousReview = route.payload?.review || null;
    const wasExtended = previousReview
      ? hasExtendedDetails(publishFormFromReview(previousReview))
      : false;
    const isExtended = hasExtendedDetails(publishForm);

    try {
      setSaving(true);
      if (isEditing) {
        await updateRotationReview(previousReview.id, payload);
      } else {
        await createRotationReview(payload);
      }

      const session = publishSessionRef.current;
      posthogLogger.capture("external_rotation_review_published", {
        source: session?.source || "hub",
        is_editing: isEditing,
        duration_seconds: session
          ? Math.round((Date.now() - session.startedAt) / 1000)
          : null,
        tags_count: (publishForm.highlightTags || []).length,
        has_advice: Boolean(publishForm.beforeYouGo?.trim()),
        has_details: isExtended,
        from_plan: Boolean(publishForm.rotationId),
      });
      if (isEditing && isExtended && !wasExtended) {
        posthogLogger.capture("external_rotation_review_expanded", {
          source: session?.source || "hub",
        });
      }
      publishSessionRef.current = null;
      publishFormSnapshotRef.current = null;

      setRoute({ name: "publishSuccess", payload: { isEditing } });
      refreshAll();
    } catch (error) {
      console.error("Error publishing review:", error);
      if (error?.code === DUPLICATE_REVIEW_ERROR) {
        Alert.alert(
          "Ya compartiste esta experiencia",
          "Ya tienes una experiencia publicada de este plan. Puedes editarla desde Rotaciones Externas."
        );
        return;
      }
      // El formulario se conserva tal cual para que pueda reintentar sin reescribir nada.
      Alert.alert(
        "No se pudo publicar la experiencia",
        "Revisa tu conexión y vuelve a intentarlo. No hemos borrado nada de lo que has escrito."
      );
    } finally {
      setSaving(false);
    }
  }, [
    creationBlockedReason,
    publishForm,
    refreshAll,
    route.payload?.review,
    specialtyIds,
    userId,
  ]);

  const handleOpenAppChat = useCallback(
    async (review) => {
      try {
        const resident = normalizeReviewResidentData(review);
        const response = await openDirectChat({
          otherUserId: resident.userId,
          otherUserName: resident.residentName,
          onSectionChange: navigation?.navigate,
        });

        if (!response.success || !response.chat?.group_id) {
          throw new Error(response.error || "No se pudo abrir el chat");
        }
      } catch (error) {
        console.error("Error opening app chat:", error);
        Alert.alert("Error", "No se pudo abrir el chat de la experiencia.");
      }
    },
    [navigation]
  );

  const handleOpenResidentMatchChat = useCallback(
    async (match) => {
      try {
        const response = await openDirectChat({
          otherUserId: match.userId,
          otherUserName: match.name,
          onSectionChange: navigation?.navigate,
        });

        if (!response.success || !response.chat?.group_id) {
          throw new Error(response.error || "No se pudo abrir el chat");
        }
      } catch (error) {
        console.error("Error opening resident match chat:", error);
        Alert.alert("Error", "No se pudo abrir el chat con este residente.");
      }
    },
    [navigation]
  );

  const routeTitle = useMemo(() => {
    switch (route.name) {
      case "home":
        return "Rotaciones Externas";
      case "explore":
        return "Explorar destinos";
      case "plan":
        return "Mi plan de rotación";
      case "rotation":
        if (route.payload?.step === "review") return "Revisa tu plan";
        return route.payload?.rotation ? "Editar mi plan" : "Crear mi plan";
      case "publish":
        return route.payload?.review ? "Editar mi experiencia" : "Compartir mi experiencia";
      case "publishSuccess":
        return "Experiencia publicada";
      case "contact":
        return "Contactar";
      default:
        return "Rotaciones Externas";
    }
  }, [route.name, route.payload?.rotation, route.payload?.step, route.payload?.review]);

  const hasUnsavedPublishChanges =
    route.name === "publish" &&
    publishFormSnapshotRef.current !== null &&
    JSON.stringify(publishForm) !== publishFormSnapshotRef.current;

  const exitPublish = useCallback(() => {
    const session = publishSessionRef.current;
    if (session) {
      posthogLogger.capture("external_rotation_review_abandoned", {
        step: publishStep + 1,
        max_step: session.maxStep + 1,
        source: session.source,
        is_editing: session.isEditing,
        duration_seconds: Math.round((Date.now() - session.startedAt) / 1000),
      });
      publishSessionRef.current = null;
    }
    setRoute({ name: "home", payload: null });
  }, [publishStep]);

  const handleRouteBack = useCallback(() => {
    // En la reseña rápida, «atrás» vuelve al paso anterior antes de salir.
    if (route.name === "publish" && publishStep > 0) {
      setPublishStep(publishStep - 1);
      return;
    }

    if (hasUnsavedPublishChanges) {
      Alert.alert(
        "Tienes cambios sin guardar",
        "Si sales ahora, perderás lo que has escrito de esta experiencia.",
        [
          { text: "Seguir editando", style: "cancel" },
          {
            text: "Salir sin guardar",
            style: "destructive",
            onPress: exitPublish,
          },
        ]
      );
      return;
    }

    if (route.name === "rotation") {
      if (route.payload?.step === "review") {
        setRoute({
          name: "rotation",
          payload: { ...(route.payload || {}), step: "form" },
        });
        return;
      }
      setRoute({ name: userRotations.length ? "plan" : "home", payload: null });
      return;
    }
    if (route.name === "publish") {
      exitPublish();
      return;
    }
    setRoute({ name: "home", payload: null });
  }, [exitPublish, hasUnsavedPublishChanges, publishStep, route, userRotations.length]);

  // En Android el botón físico de atrás también recorre los pasos y avisa de cambios sin guardar.
  useEffect(() => {
    if (Platform.OS !== "android" || route.name !== "publish") return undefined;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleRouteBack();
      return true;
    });

    return () => subscription.remove();
  }, [handleRouteBack, route.name]);

  const renderLoadErrorNotice = () =>
    loadError ? (
      <InlineNotice
        message={loadError}
        actionLabel={loading ? "Cargando…" : "Reintentar"}
        onAction={loading ? undefined : refreshAll}
      />
    ) : null;

  const renderPlanSummary = (rotation) => {
    const specialtyName = specialtyOptions.find(
      (option) => option.value === rotation.speciality_id
    )?.label;

    return (
      <View style={styles.planSummaryRows}>
        <View style={styles.matchInfoRow}>
          <Icon name="business-outline" size={14} color={PRIMARY} />
          <Text style={styles.matchInfoText}>
            {[rotation.hospital_name, rotation.service_name]
              .filter(Boolean)
              .join(" · ") || "Hospital sin indicar"}
          </Text>
        </View>
        <View style={styles.matchInfoRow}>
          <Icon name="location-outline" size={14} color={PRIMARY} />
          <Text style={styles.matchInfoText}>
            {formatLocation(rotation.city, rotation.country)}
          </Text>
        </View>
        <View style={styles.matchInfoRow}>
          <Icon name="calendar-outline" size={14} color={PRIMARY} />
          <Text style={styles.matchInfoText}>
            {[rotation.start_date, rotation.end_date]
              .filter(Boolean)
              .map(formatDateForDisplay)
              .join(" – ")}
          </Text>
        </View>
        {specialtyName ? (
          <View style={styles.matchInfoRow}>
            <Icon name="medkit-outline" size={14} color={PRIMARY} />
            <Text style={styles.matchInfoText}>{specialtyName}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  // Solo la del plan terminado más reciente: una invitación cada vez, no una lista.
  const renderReviewInvite = () => {
    const plan = pendingReviewInvites[0];
    if (!plan) return null;
    const isPending = invitePendingId === plan.id;

    return (
      <View style={styles.reviewInviteCard} testID="review-invite">
        <View style={styles.homeCardHeader}>
          <View style={styles.homeCardIcon}>
            <Icon name="sparkles-outline" size={18} color={PRIMARY} />
          </View>
          <Text style={styles.homeSectionLabel}>Tu rotación ha terminado</Text>
        </View>
        <Text style={styles.hubActionTitle}>
          ¿Qué tal fue tu rotación en {plan.hospital_name || "tu destino"}?
        </Text>
        <Text style={styles.hubActionDescription}>
          Cuéntaselo a otros residentes en 1 minuto.
        </Text>
        <TouchableOpacity
          style={[styles.hubActionButton, styles.reviewInvitePrimary]}
          onPress={() => openPublish(null, { plan, source: "invite" })}
          disabled={isPending}
          activeOpacity={0.85}
          testID="review-invite-share"
        >
          <Text style={styles.hubActionButtonText}>Compartir mi experiencia</Text>
        </TouchableOpacity>
        <View style={styles.hubActionRow}>
          <TouchableOpacity
            style={styles.reviewInviteSecondary}
            onPress={() => handleRespondToInvite(plan, "dismissed")}
            disabled={isPending}
            testID="review-invite-dismiss"
          >
            <Text style={styles.reviewInviteSecondaryText}>Ahora no</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reviewInviteSecondary}
            onPress={() => handleRespondToInvite(plan, "not_completed")}
            disabled={isPending}
            testID="review-invite-not-completed"
          >
            <Text style={styles.reviewInviteSecondaryText}>No llegué a hacerla</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHome = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.homeIntro}>
        Aprovecha la experiencia de otros residentes para elegir, organizar y
        contar tu rotación.
      </Text>

      {renderLoadErrorNotice()}

      {renderReviewInvite()}

      <TouchableOpacity
        style={styles.homePrimaryCard}
        onPress={() => setRoute({ name: "explore", payload: null })}
        activeOpacity={0.88}
      >
        <View style={styles.homeCardHeader}>
          <View style={[styles.homeCardIcon, styles.homeCardIconPrimary]}>
            <Icon name="compass-outline" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.homePrimaryEyebrow}>Estoy buscando dónde rotar</Text>
        </View>
        <Text style={styles.homePrimaryTitle}>Explorar destinos</Text>
        <Text style={styles.homePrimaryDescription}>
          Descubre hospitales, lee experiencias de otros residentes y guarda tus
          favoritos.
        </Text>
        <View style={styles.homePrimaryFooter}>
          {othersPublishedReviewsCount ? (
            <Text style={styles.homePrimaryMeta}>
              {othersPublishedReviewsCount}{" "}
              {othersPublishedReviewsCount === 1
                ? "experiencia publicada"
                : "experiencias publicadas"}
            </Text>
          ) : (
            <View />
          )}
          <View style={styles.homePrimaryButton}>
            <Text style={styles.homePrimaryButtonText}>Explorar destinos</Text>
            <Icon name="arrow-forward" size={14} color={PRIMARY} />
          </View>
        </View>
      </TouchableOpacity>

      {primaryUserRotation ? (
        <TouchableOpacity
          style={styles.hubActionCard}
          onPress={() => setRoute({ name: "plan", payload: null })}
          activeOpacity={0.85}
        >
          <View style={styles.homeCardHeader}>
            <View style={styles.homeCardIcon}>
              <Icon name="paper-plane-outline" size={18} color={PRIMARY} />
            </View>
            <Text style={styles.homeSectionLabel}>Tu plan publicado</Text>
          </View>
          <Text style={styles.hubActionTitle}>
            {primaryUserRotation.hospital_name || "Rotación futura"}
          </Text>
          <Text style={styles.hubActionDescription}>
            {[
              formatLocation(primaryUserRotation.city, primaryUserRotation.country),
              formatDateRange(
                primaryUserRotation.start_date,
                primaryUserRotation.end_date
              ),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <View style={styles.homeCardFooter}>
            <Text style={styles.homeCardMeta}>
              {upcomingMatches.length
                ? `${upcomingMatches.length} ${
                    upcomingMatches.length === 1
                      ? "residente coincide contigo"
                      : "residentes coinciden contigo"
                  }`
                : "Sin coincidencias por ahora"}
            </Text>
            <Text style={styles.homeCardLink}>Ver mi plan</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.hubActionCard}
          onPress={() => openRotationForm()}
          activeOpacity={0.85}
        >
          <View style={styles.homeCardHeader}>
            <View style={styles.homeCardIcon}>
              <Icon name="paper-plane-outline" size={18} color={PRIMARY} />
            </View>
            <Text style={styles.homeSectionLabel}>Ya sé dónde voy a rotar</Text>
          </View>
          <Text style={styles.hubActionTitle}>Publicar mi plan</Text>
          <Text style={styles.hubActionDescription}>
            Comparte tu destino y fechas para encontrar residentes que coincidan
            contigo.
          </Text>
          <View style={styles.homeCardFooter}>
            <View />
            <Text style={styles.homeCardLink}>Publicar mi plan</Text>
          </View>
        </TouchableOpacity>
      )}

      {primaryUserReview ? (
        <View style={styles.hubActionCard}>
          <View style={styles.homeCardHeader}>
            <View style={styles.homeCardIcon}>
              <Icon name="create-outline" size={18} color={PRIMARY} />
            </View>
            <Text style={styles.homeSectionLabel}>Tu experiencia publicada</Text>
          </View>
          <Text style={styles.hubActionTitle}>
            {primaryUserReview.external_hospital_name || "Experiencia publicada"}
          </Text>
          <Text style={styles.hubActionDescription}>
            {[
              formatLocation(primaryUserReview.city, primaryUserReview.country),
              formatDateRange(
                primaryUserReview.start_date,
                primaryUserReview.end_date
              ),
              primaryUserReview.is_approved ? null : "Pendiente de revisión",
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <View style={styles.hubActionRow}>
            <TouchableOpacity
              style={[
                styles.hubActionButton,
                styles.hubActionButtonAlt,
                styles.hubActionButtonSplit,
              ]}
              onPress={() => openPublish(primaryUserReview, { source: "edit" })}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.hubActionButtonText,
                  styles.hubActionButtonTextAlt,
                ]}
              >
                Editar experiencia
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.hubDangerButton, styles.hubActionButtonSplit]}
              onPress={() => setReviewToDelete(primaryUserReview)}
              activeOpacity={0.85}
            >
              <Icon name="trash-outline" size={16} color={COLORS.ERROR} />
              <Text style={styles.hubDangerButtonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.hubActionCard}
          onPress={() => openPublish()}
          activeOpacity={0.85}
        >
          <View style={styles.homeCardHeader}>
            <View style={styles.homeCardIcon}>
              <Icon name="create-outline" size={18} color={PRIMARY} />
            </View>
            <Text style={styles.homeSectionLabel}>Ya he realizado una rotación</Text>
          </View>
          <Text style={styles.hubActionTitle}>Compartir mi experiencia</Text>
          <Text style={styles.hubActionDescription}>
            Tu experiencia puede ayudar al próximo residente que quiera ir a ese
            hospital.
          </Text>
          <View style={styles.homeCardFooter}>
            <Text style={styles.homeCardMeta}>1 minuto · sin escribir textos</Text>
            <Text style={styles.homeCardLink}>Compartir mi experiencia</Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderExploreResults = () => {
    if (exploreVisibleReviews.length) {
      return (
        <>
          <Text style={styles.resultsCaption}>
            {exploreVisibleReviews.length}{" "}
            {exploreVisibleReviews.length === 1 ? "experiencia" : "experiencias"}
            {hasActiveExploreFilters ? " con estos filtros" : ""}
          </Text>
          <View style={styles.reviewGrid}>
            {exploreVisibleReviews.map((review) => (
              <ReviewListCard
                key={review.id}
                review={review}
                isFavorite={favoriteIds.has(review.id)}
                favoriteDisabled={favoritePendingId === review.id}
                onToggleFavorite={() => handleToggleFavorite(review)}
                onPress={() =>
                  setRoute({ name: "detail", payload: { review, from: "explore" } })
                }
              />
            ))}
          </View>
        </>
      );
    }

    // Sin datos por un fallo de carga: no presentarlo como si no hubiera experiencias.
    if (loadError && !reviews.length) {
      return (
        <EmptyState
          icon="warning-outline"
          title="No pudimos cargar las experiencias"
          description={loadError}
          actionLabel="Reintentar"
          onAction={refreshAll}
        />
      );
    }

    if (!othersPublishedReviewsCount) {
      return (
        <EmptyState
          icon="create-outline"
          title="Todavía no hay experiencias publicadas"
          description="¿Has hecho una rotación externa? Comparte la tuya para ayudar a otros residentes."
          actionLabel="Compartir experiencia"
          onAction={() => openPublish(null, { source: "explore_empty" })}
        />
      );
    }

    return (
      <EmptyState
        icon="search-outline"
        title="No encontramos experiencias con estos filtros"
        description="Prueba con otra especialidad, otro país o un nombre de hospital distinto."
        actionLabel="Limpiar filtros"
        onAction={clearExploreFilters}
      />
    );
  };

  const renderExplore = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.searchBox}>
        <Icon name="search" size={18} color={MUTED_LIGHT} />
        <TextInput
          style={styles.searchInput}
          value={exploreFilters.query}
          onChangeText={(value) => updateExploreFilters({ query: value })}
          placeholder="Hospital, servicio o ciudad"
          placeholderTextColor={MUTED_LIGHT}
          returnKeyType="search"
        />
        {exploreFilters.query ? (
          <TouchableOpacity
            onPress={() => updateExploreFilters({ query: "" })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Borrar búsqueda"
          >
            <Icon name="close-circle" size={18} color={MUTED_LIGHT} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        <FilterChip
          label={selectedExploreSpecialtyLabel}
          active={!!activeExploreSpecialtyId}
          icon="medkit-outline"
          onPress={() => setOpenExploreFilter("specialty")}
        />
        <FilterChip
          testID="explore-country-chip"
          label={getCountryLabel(exploreFilters.country) || "País"}
          active={!!exploreFilters.country}
          icon="earth-outline"
          onPress={() => setOpenExploreFilter("country")}
        />
        <FilterChip
          testID="explore-city-chip"
          label={getCityLabel(exploreFilters.country, exploreFilters.city) || "Ciudad"}
          active={!!exploreFilters.city}
          icon="business-outline"
          disabled={!exploreFilters.country}
          onPress={() => setOpenExploreFilter("city")}
        />
      </ScrollView>

      {(profileSpecialtyLabel && !activeExploreSpecialtyId) ||
      hasActiveExploreFilters ? (
        <View style={styles.filterHintsRow}>
          {profileSpecialtyLabel && !activeExploreSpecialtyId ? (
            <TouchableOpacity
              style={styles.suggestionChip}
              onPress={() =>
                updateExploreFilters({ specialtyId: profileSpecialtyId })
              }
              activeOpacity={0.8}
            >
              <Icon name="add" size={13} color={PRIMARY} />
              <Text style={styles.suggestionChipText} numberOfLines={1}>
                Mi especialidad: {profileSpecialtyLabel}
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {hasActiveExploreFilters ? (
            <TouchableOpacity onPress={clearExploreFilters} activeOpacity={0.75}>
              <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {loadError && reviews.length ? renderLoadErrorNotice() : null}

      {renderExploreResults()}

      <View style={styles.favoritesSection}>
        <View style={styles.favoritesHeader}>
          <Icon name="heart" size={16} color="#E11D48" />
          <Text style={styles.favoritesTitle}>
            Tus favoritas{favoriteReviews.length ? ` (${favoriteReviews.length})` : ""}
          </Text>
        </View>
        {favoriteReviews.length ? (
          <View style={styles.reviewGrid}>
            {favoriteReviews.map((review) => (
              <ReviewListCard
                key={`favorite-${review.id}`}
                review={review}
                isFavorite
                favoriteDisabled={favoritePendingId === review.id}
                onToggleFavorite={() => handleToggleFavorite(review)}
                onPress={() =>
                  setRoute({ name: "detail", payload: { review, from: "explore" } })
                }
              />
            ))}
          </View>
        ) : (
          <Text style={styles.favoritesEmptyText}>
            Pulsa el corazón de una experiencia para guardarla aquí y
            compararla después.
          </Text>
        )}
      </View>

      <SelectorModal
        visible={openExploreFilter === "specialty"}
        onClose={() => setOpenExploreFilter(null)}
        title="Especialidad"
        options={specialtyOptions.map((option) => ({
          id: option.value,
          name: option.label,
        }))}
        value={activeExploreSpecialtyId}
        onSelect={(value) => updateExploreFilters({ specialtyId: value })}
        placeholder="Todas las especialidades"
        clearLabel="Todas las especialidades"
        emptyText="No hay especialidades disponibles."
        noMatchesText="No encontramos especialidades con ese nombre"
        errorText={specialtiesError}
        onRetry={loadSpecialties}
      />
      <LocationPickerModal
        visible={openExploreFilter === "country"}
        onClose={() => setOpenExploreFilter(null)}
        kind="country"
        title="País"
        value={exploreFilters.country}
        onSelect={(option) => handleExploreCountryChange(option?.id || "")}
        allowClear
        clearLabel="Todos los países"
      />
      <LocationPickerModal
        visible={openExploreFilter === "city" && !!exploreFilters.country}
        onClose={() => setOpenExploreFilter(null)}
        kind="city"
        title="Ciudad"
        countryCode={exploreCountryCode}
        value={exploreFilters.city}
        onSelect={(option) => updateExploreFilters({ city: option?.id || "" })}
        allowClear
        clearLabel="Todas las ciudades"
        knownCities={getKnownCities(exploreFilters.country)}
      />
    </ScrollView>
  );

  const renderPlan = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {renderLoadErrorNotice()}

      {userRotations.length ? (
        userRotations.map((rotation) => (
          <View key={rotation.id} style={styles.hubActionCard}>
            <Text style={styles.homeSectionLabel}>Tu plan publicado</Text>
            {renderPlanSummary(rotation)}
            <View style={styles.hubActionRow}>
              <TouchableOpacity
                style={[
                  styles.hubActionButton,
                  styles.hubActionButtonAlt,
                  styles.hubActionButtonSplit,
                ]}
                onPress={() => openRotationForm(rotation)}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.hubActionButtonText, styles.hubActionButtonTextAlt]}
                >
                  Editar plan
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hubDangerButton, styles.hubActionButtonSplit]}
                onPress={() => setRotationToDelete(rotation)}
                activeOpacity={0.85}
              >
                <Icon name="trash-outline" size={16} color={COLORS.ERROR} />
                <Text style={styles.hubDangerButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.hubActionCard}>
          <Text style={styles.hubActionTitle}>Crea tu plan en un minuto</Text>
          <Text style={styles.hubActionDescription}>
            Comparte tu destino y fechas para encontrar residentes que vayan al
            mismo hospital en las mismas fechas. Solo necesitas:
          </Text>
          <View style={styles.planSummaryRows}>
            {[
              ["business-outline", "Hospital o centro de destino"],
              ["location-outline", "País y ciudad"],
              ["calendar-outline", "Fechas aproximadas de inicio y fin"],
            ].map(([icon, label]) => (
              <View key={label} style={styles.matchInfoRow}>
                <Icon name={icon} size={14} color={PRIMARY} />
                <Text style={styles.matchInfoText}>{label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.fullPrimaryButton}
            onPress={() => openRotationForm()}
            activeOpacity={0.85}
          >
            <Text style={styles.fullPrimaryButtonText}>Crear mi plan</Text>
          </TouchableOpacity>
        </View>
      )}

      {userRotations.length ? (
        <>
          <Text style={styles.subsectionLabel}>Residentes que coinciden contigo</Text>
          {upcomingMatches.length ? (
            <View style={styles.matchesList}>
              {upcomingMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  item={match}
                  onChat={() => handleOpenResidentMatchChat(match)}
                  buttonLabel="Escribir por chat"
                  onContact={() => handleOpenResidentMatchChat(match)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="people-outline"
              title="Sin coincidencias por ahora"
              description="Todavía no encontramos otros residentes que coincidan con tu destino y fechas."
            />
          )}

          {historicalMatches.length ? (
            <>
              <Text style={styles.subsectionLabel}>
                Experiencias en la misma ciudad
              </Text>
              <View style={styles.reviewGrid}>
                {historicalMatches.map((review) => (
                  <ReviewListCard
                    key={review.id}
                    review={review}
                    isFavorite={favoriteIds.has(review.id)}
                    favoriteDisabled={favoritePendingId === review.id}
                    onToggleFavorite={() => handleToggleFavorite(review)}
                    onPress={() =>
                      setRoute({ name: "detail", payload: { review, from: "plan" } })
                    }
                  />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );

  const updatePublishForm = useCallback(
    (changes) => setPublishForm((current) => ({ ...current, ...changes })),
    []
  );

  const renderPublishWhereStep = () => (
    <View style={styles.formCard} testID="publish-step-where">
      <Text style={styles.inputLabel}>Hospital o centro de destino</Text>
      <TextInput
        style={styles.textInput}
        value={publishForm.hospitalName}
        onChangeText={(value) =>
          setPublishForm((current) => ({ ...current, hospitalName: value }))
        }
        placeholder="Ej. Hospital Clínic o Boston Children's Hospital"
      />

      <Text style={styles.inputLabel}>Servicio o unidad (opcional)</Text>
      <TextInput
        style={styles.textInput}
        value={publishForm.serviceName}
        onChangeText={(value) =>
          setPublishForm((current) => ({ ...current, serviceName: value }))
        }
        placeholder="Ej. Cardiología Pediátrica"
      />

      <View style={styles.formRow}>
        <View style={styles.formColumn}>
          <LocationSelectField
            testID="publish-country"
            label="País"
            kind="country"
            value={publishForm.country}
            onSelect={handlePublishCountryChange}
            placeholder="Selecciona un país"
          />
        </View>
        <View style={styles.formColumn}>
          <LocationSelectField
            testID="publish-city"
            label="Ciudad"
            kind="city"
            countryCode={publishCountryCode}
            value={publishForm.city}
            onSelect={handlePublishCityChange}
            knownCities={getKnownCities(publishForm.country)}
            placeholder={
              publishCountryCode
                ? "Selecciona una ciudad"
                : "Primero selecciona un país"
            }
            disabled={!publishCountryCode}
          />
        </View>
      </View>

      <SelectFilter
        label="Especialidad (opcional)"
        value={publishForm.specialityId}
        onChange={(value) =>
          setPublishForm((current) => ({ ...current, specialityId: value }))
        }
        options={specialtyOptions}
        placeholder="Selecciona una especialidad"
        clearLabel="Sin especialidad"
        emptyText="No hay especialidades disponibles."
        noMatchesText="No encontramos especialidades con ese nombre"
        errorText={specialtiesError}
        onRetry={loadSpecialties}
      />
      <View style={styles.formRow}>
        <View style={styles.formColumn}>
          <Text style={styles.inputLabel}>Fecha de inicio</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() =>
              openDatePicker("publishStartDate", publishForm.startDate)
            }
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dateButtonText,
                !publishForm.startDate && styles.dateButtonPlaceholder,
              ]}
            >
              {formatDateForDisplay(publishForm.startDate)}
            </Text>
            <Icon name="calendar-outline" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        <View style={styles.formColumn}>
          <Text style={styles.inputLabel}>Fecha de fin (opcional)</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() =>
              openDatePicker(
                "publishEndDate",
                publishForm.endDate || publishForm.startDate
              )
            }
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dateButtonText,
                !publishForm.endDate && styles.dateButtonPlaceholder,
              ]}
            >
              {formatDateForDisplay(publishForm.endDate)}
            </Text>
            <Icon name="calendar-outline" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderPublish = () => {
    const stepKey = QUICK_REVIEW_STEPS[publishStep].key;
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {publishStep === 0 && !route.payload?.review ? (
          <Text style={styles.homeIntro}>
            Tu experiencia puede ayudar al próximo residente que quiera ir a ese
            hospital. Son 4 pasos cortos, casi todo con botones.
          </Text>
        ) : null}

        <QuickReviewProgress stepIndex={publishStep} />

        {stepKey === "where" && renderPublishWhereStep()}
        {stepKey === "how" && (
          <QuickReviewHowStep form={publishForm} onChange={updatePublishForm} />
        )}
        {stepKey === "highlights" && (
          <QuickReviewHighlightsStep form={publishForm} onChange={updatePublishForm} />
        )}
        {stepKey === "advice" && (
          <QuickReviewAdviceStep
            form={publishForm}
            onChange={updatePublishForm}
            detailsOpen={publishDetailsOpen}
            onToggleDetails={() => setPublishDetailsOpen((open) => !open)}
          />
        )}

        <QuickReviewNav
          stepIndex={publishStep}
          onPrevious={() => setPublishStep((step) => Math.max(step - 1, 0))}
          onNext={
            publishStep === QUICK_REVIEW_STEPS.length - 1
              ? handlePublishSubmit
              : handlePublishNext
          }
          saving={saving}
          submitLabel={route.payload?.review ? "Guardar cambios" : "Publicar experiencia"}
        />
      </ScrollView>
    );
  };

  const renderPublishSuccess = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.publishSuccessCard} testID="publish-success">
        <View style={styles.publishSuccessIcon}>
          <Icon name="checkmark-circle" size={36} color={SUCCESS} />
        </View>
        <Text style={styles.publishSuccessTitle}>
          {route.payload?.isEditing ? "¡Experiencia actualizada!" : "¡Gracias!"}
        </Text>
        <Text style={styles.publishSuccessText}>
          Tu experiencia ya puede ayudar a otros residentes a elegir dónde rotar.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.fullPrimaryButton}
        onPress={() => setRoute({ name: "home", payload: null })}
        testID="publish-success-done"
      >
        <Text style={styles.fullPrimaryButtonText}>Volver a Rotaciones Externas</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderRotationReview = () => {
    const { data } = buildRotationData();
    if (!data) {
      return null;
    }
    const isEditing = Boolean(route.payload?.rotation?.id);

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.homeIntro}>
          Así verán tu plan otros residentes. Te mostraremos quién va al mismo
          hospital o centro en fechas que se solapan con las tuyas.
        </Text>

        <View style={styles.hubActionCard}>
          <Text style={styles.homeSectionLabel}>Tu plan</Text>
          {renderPlanSummary(data)}
          {data.notes?.trim() ? (
            <Text style={styles.hubActionDescription}>{data.notes.trim()}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.fullPrimaryButton}
          onPress={handleSubmitRotation}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.fullPrimaryButtonText}>
              {isEditing ? "Guardar cambios" : "Publicar mi plan"}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleRouteBack}
          disabled={saving}
        >
          <Text style={styles.secondaryButtonText}>Volver a editar</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderRotationForm = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.homeIntro}>
        Indica dónde y cuándo vas a rotar. Las fechas pueden ser aproximadas y
        podrás cambiarlas cuando quieras.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Hospital o centro de destino</Text>
        <TextInput
          style={styles.textInput}
          value={rotationForm.hospitalName}
          onChangeText={(value) =>
            setRotationForm((current) => ({ ...current, hospitalName: value }))
          }
          placeholder="Ej. Hospital Clínic"
        />

        <Text style={styles.inputLabel}>Servicio o unidad (opcional)</Text>
        <TextInput
          style={styles.textInput}
          value={rotationForm.serviceName}
          onChangeText={(value) =>
            setRotationForm((current) => ({ ...current, serviceName: value }))
          }
          placeholder="Ej. Cardiología Pediátrica"
        />

        <View style={styles.formRow}>
          <View style={styles.formColumn}>
            <LocationSelectField
              testID="rotation-country"
              label="País"
              kind="country"
              value={rotationForm.country}
              onSelect={handleRotationCountryChange}
              placeholder="Selecciona un país"
            />
          </View>
          <View style={styles.formColumn}>
            <LocationSelectField
              testID="rotation-city"
              label="Ciudad"
              kind="city"
              countryCode={rotationCountryCode}
              value={rotationForm.city}
              onSelect={handleRotationCityChange}
              knownCities={getKnownCities(rotationForm.country)}
              placeholder={
                rotationCountryCode
                  ? "Selecciona una ciudad"
                  : "Primero selecciona un país"
              }
              disabled={!rotationCountryCode}
            />
          </View>
        </View>

        <View style={styles.formColumn}>
          <Text style={styles.inputLabel}>Fecha de inicio</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() =>
              openDatePicker("rotationStartDate", rotationForm.startDate)
            }
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dateButtonText,
                !rotationForm.startDate && styles.dateButtonPlaceholder,
              ]}
            >
              {formatDateForDisplay(rotationForm.startDate)}
            </Text>
            <Icon name="calendar-outline" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        <View style={styles.formColumn}>
          <Text style={styles.inputLabel}>Fecha de fin</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() =>
              openDatePicker(
                "rotationEndDate",
                rotationForm.endDate || rotationForm.startDate
              )
            }
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dateButtonText,
                !rotationForm.endDate && styles.dateButtonPlaceholder,
              ]}
            >
              {formatDateForDisplay(rotationForm.endDate)}
            </Text>
            <Icon name="calendar-outline" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formCard}>
        <SelectFilter
          label="Especialidad (opcional)"
          value={rotationForm.specialityId}
          onChange={(value) =>
            setRotationForm((current) => ({ ...current, specialityId: value }))
          }
          options={specialtyOptions}
          placeholder="Selecciona una especialidad"
          clearLabel="Sin especialidad"
          emptyText="No hay especialidades disponibles."
          noMatchesText="No encontramos especialidades con ese nombre"
          errorText={specialtiesError}
          onRetry={loadSpecialties}
        />
        <Text style={styles.cardTitle}>Contacto y notas (opcional)</Text>
        <TextInput
          style={styles.textInput}
          value={rotationForm.phone}
          onChangeText={(value) =>
            setRotationForm((current) => ({ ...current, phone: value }))
          }
          keyboardType="phone-pad"
          placeholder="Teléfono de contacto"
        />

        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={rotationForm.notes}
          onChangeText={(value) =>
            setRotationForm((current) => ({ ...current, notes: value }))
          }
          multiline
          textAlignVertical="top"
          placeholder="Información útil sobre tus planes de rotación"
        />
      </View>

      <TouchableOpacity
        style={styles.fullPrimaryButton}
        onPress={handleReviewRotation}
        disabled={saving}
      >
        <Text style={styles.fullPrimaryButtonText}>Revisar plan</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderContact = () => {
    const review = selectedReview;

    if (!review) {
      return null;
    }

    const resident = normalizeReviewResidentData(review);
    const residentMeta = [resident.specialtyName, resident.hospitalName]
      .filter(Boolean)
      .join(" · ");

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contactHero}>
          <View style={styles.contactAvatar}>
            <Icon name="person" size={42} color={PRIMARY} />
          </View>
          <Text style={styles.contactResidentName}>{resident.residentName}</Text>
          {residentMeta ? (
            <Text style={styles.contactResidentMeta}>{residentMeta}</Text>
          ) : null}
        </View>

        <View style={styles.contactCardShell}>
          <Text style={styles.contactCardTitle}>
            Contacta con {resident.residentName} por el chat de la app
          </Text>

          <View style={styles.contactOptionsList}>
            <ContactOptionCard
              icon="chatbubbles"
              color="#FFFFFF"
              backgroundColor="rgba(255,255,255,0.18)"
              title="Chat de la app"
              subtitle="Abrir conversación privada en la app"
              onPress={() => handleOpenAppChat(review)}
              primary
            />
          </View>
        </View>
      </ScrollView>
    );
  };

  if (!isResident) {
    return (
      <View style={styles.centeredState}>
        <Icon name="alert-circle-outline" size={40} color={COLORS.ORANGE} />
        <Text style={styles.centeredStateTitle}>
          Funcionalidad solo para residentes
        </Text>
        <Text style={styles.centeredStateDescription}>
          Las rotaciones externas están disponibles únicamente para perfiles de
          residente.
        </Text>
      </View>
    );
  }

  if (loading && !hasLoadedOnce) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.centeredStateDescription}>
          Cargando rotaciones externas...
        </Text>
      </View>
    );
  }

  // Reciprocidad sin bloquear la lectura: solo a quien puede publicar y aún no ha compartido nada.
  const canInviteToShare = canCreateExternalRotation && !myReviews.length;

  if (route.name === "detail" && selectedReview?.id) {
    const handleBackFromRotationDetail = () =>
      setRoute({ name: route.payload?.from || "explore", payload: null });
    return (
      <SwipeBackWrapper onSwipeBack={handleBackFromRotationDetail}>
        <RotationReviewDetailScreen
          reviewId={selectedReview.id}
          userId={userId}
          onBack={handleBackFromRotationDetail}
          onContact={handleOpenAppChat}
          onFavoriteChanged={refreshAll}
          onAddDetails={(review) =>
            openPublish(review, {
              source: "detail_add_details",
              stepIndex: QUICK_REVIEW_STEPS.length - 1,
              detailsOpen: true,
            })
          }
          onShareExperience={
            canInviteToShare
              ? () => openPublish(null, { source: "detail_reciprocity" })
              : undefined
          }
        />
      </SwipeBackWrapper>
    );
  }

  return (
    <HeroScreenLayout
      title={routeTitle}
      onBack={route.name === "home" ? onBack : handleRouteBack}
    >
      {route.name === "home" && renderHome()}
      {route.name === "explore" && renderExplore()}
      {route.name === "plan" && renderPlan()}
      {route.name === "rotation" &&
        (route.payload?.step === "review"
          ? renderRotationReview()
          : renderRotationForm())}
      {route.name === "publish" && renderPublish()}
      {route.name === "publishSuccess" && renderPublishSuccess()}
      {route.name === "contact" && renderContact()}

      <ConfirmationModal
        visible={!!rotationToDelete}
        title="Eliminar futura rotación"
        message="Esta acción eliminará tus planes de rotación guardados."
        onConfirm={handleDeleteRotation}
        onCancel={() => setRotationToDelete(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      <ConfirmationModal
        visible={!!reviewToDelete}
        title="Eliminar experiencia"
        message="Esta acción eliminará tu experiencia publicada."
        onConfirm={handleDeleteReview}
        onCancel={() => setReviewToDelete(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      {activeDateField ? (
        <View style={styles.dateOverlay}>
          <TouchableOpacity style={styles.dateOverlayTouch} onPress={resetDatePickerState} />
          <View style={styles.dateSheet}>
            {Platform.OS === "ios" ? (
              <>
                <View style={styles.dateSheetHeader}>
                  <TouchableOpacity onPress={resetDatePickerState}>
                    <Text style={styles.dateSheetCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleConfirmDate}>
                    <Text style={styles.dateSheetConfirm}>Seleccionar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempSelectedDate || new Date()}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  locale="es-ES"
                  minimumDate={activeDateMinimum}
                  maximumDate={activeDateMaximum}
                />
              </>
            ) : (
              <DateTimePicker
                value={tempSelectedDate || new Date()}
                mode="date"
                display="default"
                onChange={handleDateChange}
                locale="es-ES"
                minimumDate={activeDateMinimum}
                maximumDate={activeDateMaximum}
              />
            )}
          </View>
        </View>
      ) : null}
    </HeroScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 14,
  },
  hubActionCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  hubIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  hubIconWrapPrimary: {
    backgroundColor: PRIMARY_SOFT,
  },
  hubIconWrapAlt: {
    backgroundColor: SUCCESS_SOFT,
  },
  hubActionTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 4,
  },
  hubActionDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: TEXT_MUTED,
  },
  homeSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  hubActionButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    minHeight: 34,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  hubActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  hubActionButtonSplit: {
    flex: 1,
  },
  hubActionButtonAlt: {
    backgroundColor: SURFACE_ALT,
  },
  hubActionButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  hubActionButtonTextAlt: {
    color: PRIMARY,
  },
  hubDangerButton: {
    borderRadius: 999,
    minHeight: 34,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#FEECEC",
  },
  hubDangerButtonText: {
    color: COLORS.ERROR,
    fontWeight: "800",
    fontSize: 12,
  },
  myReviewCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  myReviewMain: {
    flex: 1,
    paddingRight: 12,
  },
  myReviewTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  myReviewSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  myReviewActions: {
    flexDirection: "row",
    gap: 8,
  },
  inlineAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 14,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 24,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: SURFACE_CARD,
    borderWidth: 1,
    borderColor: BORDER,
    maxWidth: 170,
  },
  filterChipActive: {
    backgroundColor: PRIMARY_SOFT,
    borderColor: PRIMARY + "33",
  },
  filterChipDisabled: {
    backgroundColor: SURFACE_ALT,
    borderColor: BORDER,
    opacity: 0.7,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
    flexShrink: 1,
  },
  filterChipTextActive: {
    color: PRIMARY,
  },
  filterChipTextDisabled: {
    color: TEXT_MUTED,
  },
  subsectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  matchesList: {
    gap: 12,
  },
  matchCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 20,
    padding: 16,
  },
  matchCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  matchHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  matchName: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },
  matchMeta: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  matchChatButton: {
    flexShrink: 0,
  },
  chatBadge: {
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chatBadgeText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  matchBody: {
    backgroundColor: SURFACE_ALT,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  matchInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  matchInfoText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "500",
  },
  matchActionText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "800",
  },
  reviewGrid: {
    gap: 14,
  },
  reviewCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  reviewCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  reviewChip: {
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewChipText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  reviewRatingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewRatingInlineText: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT,
  },
  reviewCardTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    color: TEXT,
  },
  reviewCardLocation: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  reviewChipsRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  reviewChipNeutral: {
    backgroundColor: SURFACE_ALT,
  },
  reviewChipTextNeutral: {
    color: TEXT_MUTED,
  },
  favoriteButton: {
    padding: 2,
  },
  reviewCardBody: {
    gap: 5,
  },
  reviewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewCardSummary: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT,
  },
  reviewCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  reviewRatingCount: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  reviewCardLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reviewCardLinkText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "800",
  },
  inlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: WARNING_SOFT,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT,
  },
  inlineNoticeAction: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY,
  },
  matchReasons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  matchReasonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SUCCESS_SOFT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  matchReasonText: {
    fontSize: 12,
    fontWeight: "700",
    color: SUCCESS,
  },
  homeIntro: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
  },
  homePrimaryCard: {
    backgroundColor: PRIMARY,
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  homeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  homeCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY_SOFT,
  },
  homeCardIconPrimary: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  homePrimaryEyebrow: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  homePrimaryTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  homePrimaryDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.9)",
  },
  homePrimaryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  homePrimaryMeta: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  homePrimaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  homePrimaryButtonText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "800",
  },
  homeCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  homeCardMeta: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_MUTED,
  },
  homeCardLink: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY,
  },
  resultsCaption: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_MUTED,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SURFACE_CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT,
    paddingVertical: 12,
  },
  filterHintsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: -4,
  },
  suggestionChip: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: PRIMARY + "55",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionChipText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY,
  },
  favoritesSection: {
    gap: 10,
    marginTop: 8,
  },
  favoritesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  favoritesTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT,
  },
  favoritesEmptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_MUTED,
  },
  planSummaryRows: {
    backgroundColor: SURFACE_ALT,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_ALT,
  },
  secondaryButtonText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyState: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  emptyStateIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
    textAlign: "center",
  },
  emptyStateButton: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  formCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
  },
  reviewInviteCard: {
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    borderWidth: 1,
    borderColor: "#DDD0FB",
  },
  reviewInvitePrimary: {
    alignSelf: "stretch",
    minHeight: 40,
  },
  reviewInviteSecondary: {
    flex: 1,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewInviteSecondaryText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
  publishSuccessCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  publishSuccessIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SUCCESS_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  publishSuccessTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT,
  },
  publishSuccessText: {
    fontSize: 15,
    lineHeight: 21,
    color: TEXT_MUTED,
    textAlign: "center",
  },
  publishBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  publishBlockNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  publishBlockNumberText: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_MUTED,
  },
  textInput: {
    backgroundColor: SURFACE_ALT,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: TEXT,
  },
  dateButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 15,
    color: ACCENT,
    fontWeight: "600",
  },
  dateButtonPlaceholder: {
    color: MUTED_LIGHT,
    fontWeight: "500",
  },
  dateOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
    justifyContent: "flex-end",
  },
  dateOverlayTouch: {
    flex: 1,
  },
  dateSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  dateSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  dateSheetCancel: {
    color: TEXT_MUTED,
    fontSize: 15,
    fontWeight: "600",
  },
  dateSheetConfirm: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 110,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  formColumn: {
    flex: 1,
    gap: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 24,
    marginTop: 4,
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
  },
  pillGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    backgroundColor: SURFACE_ALT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pillActive: {
    backgroundColor: PRIMARY,
  },
  pillText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "700",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  ratingQuestion: {
    gap: 10,
  },
  ratingQuestionLabel: {
    color: TEXT,
    fontWeight: "700",
  },
  ratingButtons: {
    flexDirection: "row",
    gap: 8,
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingButtonActive: {
    backgroundColor: PRIMARY,
  },
  fullPrimaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  fullPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  contactHero: {
    alignItems: "center",
    marginBottom: 8,
  },
  contactAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_CARD,
    marginBottom: 16,
  },
  contactResidentName: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    color: TEXT,
    textAlign: "center",
  },
  contactResidentMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
    textAlign: "center",
    marginTop: 6,
  },
  contactCardShell: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  contactCardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
  },
  contactOptionsList: {
    gap: 12,
  },
  contactOptionCard: {
    backgroundColor: SURFACE_ALT,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactOptionCardPrimary: {
    backgroundColor: PRIMARY,
  },
  contactOptionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  contactOptionCopy: {
    flex: 1,
  },
  contactOptionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT,
  },
  contactOptionTitlePrimary: {
    color: "#FFFFFF",
  },
  contactOptionSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  contactOptionSubtitlePrimary: {
    color: "rgba(255,255,255,0.8)",
  },
  centeredState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: SURFACE,
  },
  centeredStateTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
    textAlign: "center",
  },
  centeredStateDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
    textAlign: "center",
  },
});
