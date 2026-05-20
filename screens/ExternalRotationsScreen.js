import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Country, City } from "country-state-city";
import { COLORS } from "../constants/colors";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { SelectorModal } from "../components/SelectorModal";
import { SelectFilter, ConfirmationModal, DirectChatButton } from "../components";
import { usePersistedFilters } from "../hooks/usePersistedFilters";
import {
  createRotation,
  deleteRotation,
  getAllRotations,
  getUserRotations,
  updateRotation,
  updateUserPhone,
} from "../services/externalRotationService";
import {
  createRotationReview,
  deleteRotationReview,
  getFavoriteExternalRotationReviews,
  getAllExternalRotationReviews,
  getRotationReviewQuestions,
  updateRotationReview,
} from "../services/externalRotationReviewService";
import { openDirectChat } from "../services/directChatsService";
import { getSpecialties } from "../services/hospitalService";
import RotationReviewDetailScreen from "./RotationReviewDetailScreen";
import posthogLogger from "../services/posthogService";

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
  difficulty: "medium",
  difficultyNotes: "",
  rotationKind: "observational",
  highlightSummary: "",
  beforeYouGo: "",
  tutorName: "",
  tutorEmail: "",
  preferredContactMethod: "app_chat",
  answers: {},
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

const findCountryByName = (countryName) => {
  if (!countryName) return null;

  return (
    Country.getAllCountries().find(
      (country) =>
        country.name.toLowerCase() === String(countryName).trim().toLowerCase()
    ) || null
  );
};

const difficultyOptions = [
  { id: "easy", label: "Fácil" },
  { id: "medium", label: "Media" },
  { id: "hard", label: "Difícil" },
];

const rotationKindOptions = [
  { id: "observational", label: "Observacional" },
  { id: "hands_on", label: "Participativa" },
];

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

const PillGroup = ({ options, value, onChange }) => (
  <View style={styles.pillGroup}>
    {options.map((option) => (
      <TouchableOpacity
        key={option.id}
        style={[styles.pill, value === option.id && styles.pillActive]}
        onPress={() => onChange(option.id)}
        activeOpacity={0.85}
      >
        <Text style={[styles.pillText, value === option.id && styles.pillTextActive]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const SectionTitle = ({ eyebrow, title, description, actionLabel, onAction }) => (
  <View style={styles.sectionHeader}>
    {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? (
          <Text style={styles.sectionDescription}>{description}</Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  </View>
);

const HubActionCard = ({ title, description, buttonLabel, onPress, eyebrow }) => (
  <TouchableOpacity
    style={styles.hubActionCard}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View>
      {eyebrow ? <Text style={styles.homeSectionLabel}>{eyebrow}</Text> : null}
      <Text style={styles.hubActionTitle}>{title}</Text>
      <Text style={styles.hubActionDescription}>{description}</Text>
    </View>
    <View style={styles.hubActionButton}>
      <Text style={styles.hubActionButtonText}>{buttonLabel}</Text>
    </View>
  </TouchableOpacity>
);

const MiniDestinationCard = ({ review, onPress }) => (
  <TouchableOpacity style={styles.miniDestinationCard} onPress={onPress}>
    <View style={styles.miniDestinationCopy}>
      <Text style={styles.miniDestinationTitle}>{review.external_hospital_name}</Text>
      <Text style={styles.miniDestinationSubtitle}>
        {[review.city, review.country, review.service_name].filter(Boolean).join(" · ")}
      </Text>
    </View>
    <View style={styles.miniDestinationRating}>
      <View style={styles.miniRatingRow}>
        <Ionicons name="star" size={14} color="#F4B740" />
        <Text style={styles.miniDestinationRatingValue}>
          {averageRatingLabel(review)}
        </Text>
      </View>
      <Text style={styles.miniDestinationMeta}>
        {review.ratings_count || 0} valoraciones
      </Text>
    </View>
  </TouchableOpacity>
);

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
          <Ionicons name="calendar-outline" size={14} color={PRIMARY} />
          <Text style={styles.matchInfoText}>{item.dateLabel}</Text>
        </View>
      ) : null}
      <View style={styles.matchInfoRow}>
        <Ionicons name="location-outline" size={14} color={PRIMARY} />
        <Text style={styles.matchInfoText}>{item.location}</Text>
      </View>
    </View>
    <TouchableOpacity onPress={onContact} activeOpacity={0.8}>
      <Text style={styles.matchActionText}>{buttonLabel}</Text>
    </TouchableOpacity>
  </View>
);

const FilterChip = ({ label, active, icon, onPress, disabled = false }) => (
  <TouchableOpacity
    style={[
      styles.filterChip,
      active && styles.filterChipActive,
      disabled && styles.filterChipDisabled,
    ]}
    onPress={onPress}
    activeOpacity={disabled ? 1 : 0.75}
    disabled={disabled}
  >
    <Ionicons
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
    <Ionicons
      name="chevron-down"
      size={14}
      color={disabled ? TEXT_MUTED : active ? PRIMARY : TEXT_MUTED}
    />
  </TouchableOpacity>
);

const ReviewListCard = ({ review, onPress }) => (
  <TouchableOpacity
    style={styles.reviewCard}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={styles.reviewCardTop}>
      <View style={styles.reviewChip}>
        <Text style={styles.reviewChipText}>
          {review.specialty_name || "Rotación externa"}
        </Text>
      </View>
      <View style={styles.reviewRatingInline}>
        <Ionicons name="star" size={14} color="#F4B740" />
        <Text style={styles.reviewRatingInlineText}>
          {averageRatingLabel(review)}
        </Text>
      </View>
    </View>

    <Text style={styles.reviewCardTitle}>{review.external_hospital_name}</Text>
    <Text style={styles.reviewCardLocation}>
      {[review.service_name, review.city, review.country].filter(Boolean).join(" · ")}
    </Text>

    <TouchableOpacity style={styles.reviewCardButton} onPress={onPress}>
      <Text style={styles.reviewCardButtonText}>Ver reseña</Text>
    </TouchableOpacity>
  </TouchableOpacity>
);

const ContactOptionCard = ({ icon, color, backgroundColor, title, subtitle, onPress, primary = false }) => (
  <TouchableOpacity
    style={[styles.contactOptionCard, primary && styles.contactOptionCardPrimary]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.contactOptionIconWrap, { backgroundColor }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <View style={styles.contactOptionCopy}>
      <Text style={[styles.contactOptionTitle, primary && styles.contactOptionTitlePrimary]}>
        {title}
      </Text>
      <Text style={[styles.contactOptionSubtitle, primary && styles.contactOptionSubtitlePrimary]}>
        {subtitle}
      </Text>
    </View>
    <Ionicons
      name={primary ? "arrow-forward" : "chevron-forward"}
      size={18}
      color={primary ? "#FFFFFF" : TEXT_MUTED}
    />
  </TouchableOpacity>
);

const EmptyState = ({ icon, title, description, actionLabel, onAction }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyStateIcon}>
      <Ionicons name={icon} size={28} color={PRIMARY} />
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

  const [route, setRoute] = useState({ name: "home", payload: null });
  const [specialties, setSpecialties] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [userRotations, setUserRotations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [favoriteReviews, setFavoriteReviews] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
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
    {
      specialtyId: "",
      country: "",
      city: "",
    },
    { enableDebounce: true, debounceMs: 500 }
  );

  useEffect(() => {
    posthogLogger.logScreen("ExternalRotationsScreen");
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setLoading(true);

      const [
        specialtiesRes,
        rotationsData,
        userRotationsData,
        reviewsData,
        questionsData,
        favoriteReviewsData,
      ] =
        await Promise.all([
          getSpecialties(),
          getAllRotations({}),
          getUserRotations(userId),
          getAllExternalRotationReviews(userId, {}),
          getRotationReviewQuestions(),
          getFavoriteExternalRotationReviews(userId),
        ]);

      if (!specialtiesRes.success) {
        throw new Error(specialtiesRes.error || "Error loading specialties");
      }

      setSpecialties(specialtiesRes.specialties || []);
      setRotations(rotationsData || []);
      setUserRotations(userRotationsData || []);
      setReviews(reviewsData || []);
      setQuestions(questionsData || []);
      setFavoriteReviews(
        (favoriteReviewsData || []).filter((review) => review.user_id !== userId)
      );
    } catch (error) {
      console.error("Error loading external rotations data:", error);
      Alert.alert("Error", "No se pudo cargar la información de rotaciones.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const countryOptions = useMemo(() => {
    return Country.getAllCountries()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((country) => ({ value: country.name, label: country.name }));
  }, []);

  const cityOptions = useMemo(() => {
    if (!exploreFilters.country) {
      return [];
    }

    const selectedCountry = Country.getAllCountries().find(
      (country) => country.name === exploreFilters.country
    );

    if (!selectedCountry) {
      return [];
    }

    return (City.getCitiesOfCountry(selectedCountry.isoCode) || [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((city) => ({ value: city.name, label: city.name }));
  }, [exploreFilters.country]);

  const hasActiveExploreFilters = useMemo(
    () =>
      Boolean(
        exploreFilters.specialtyId ||
          exploreFilters.country ||
          exploreFilters.city
      ),
    [exploreFilters]
  );

  const publishCountryOptions = useMemo(() => {
    try {
      return [
        { value: "", label: "Selecciona un país" },
        ...Country.getAllCountries()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((country) => ({
            value: country.isoCode,
            label: country.name,
          })),
      ];
    } catch (error) {
      console.error("Error loading publish countries:", error);
      return [{ value: "", label: "Error cargando países" }];
    }
  }, []);

  const publishCityOptions = useMemo(() => {
    if (!publishCountryCode) {
      return [{ value: "", label: "Primero selecciona un país" }];
    }

    const cities = City.getCitiesOfCountry(publishCountryCode) || [];

    if (!cities.length) {
      return [{ value: "", label: "No hay ciudades disponibles" }];
    }

    return [
      { value: "", label: "Selecciona una ciudad" },
      ...cities
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((city) => ({
          value: city.name,
          label: city.name,
        })),
    ];
  }, [publishCountryCode]);

  const rotationCountryOptions = useMemo(() => {
    try {
      return [
        { value: "", label: "Selecciona un país" },
        ...Country.getAllCountries()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((country) => ({
            value: country.isoCode,
            label: country.name,
          })),
      ];
    } catch (error) {
      console.error("Error loading rotation countries:", error);
      return [{ value: "", label: "Error cargando países" }];
    }
  }, []);

  const rotationCityOptions = useMemo(() => {
    if (!rotationCountryCode) {
      return [{ value: "", label: "Primero selecciona un país" }];
    }

    const cities = City.getCitiesOfCountry(rotationCountryCode) || [];

    if (!cities.length) {
      return [{ value: "", label: "No hay ciudades disponibles" }];
    }

    return [
      { value: "", label: "Selecciona una ciudad" },
      ...cities
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((city) => ({
          value: city.name,
          label: city.name,
        })),
    ];
  }, [rotationCountryCode]);

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
      specialtyOptions.find((option) => option.value === exploreFilters.specialtyId)
        ?.label || "Especialidad",
    [exploreFilters.specialtyId, specialtyOptions]
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
    return publishedReviews.filter((review) => {
      if (
        exploreFilters.specialtyId &&
        review.speciality_id !== exploreFilters.specialtyId
      ) {
        return false;
      }

      if (
        exploreFilters.country &&
        review.country !== exploreFilters.country
      ) {
        return false;
      }

      if (exploreFilters.city && review.city !== exploreFilters.city) {
        return false;
      }

      return true;
    });
  }, [exploreFilters, publishedReviews]);

  const exploreVisibleReviews = useMemo(
    () => filteredReviews.filter((review) => review.user_id !== userId),
    [filteredReviews, userId]
  );

  const primaryUserRotation = userRotations[0] || null;
  const primaryUserReview = myReviews[0] || null;

  const upcomingMatches = useMemo(() => {
    if (!userRotations.length) {
      return [];
    }

    const ownRotationIds = new Set(userRotations.map((rotation) => rotation.id));

    return rotations
      .filter((rotation) => !ownRotationIds.has(rotation.id))
      .filter((rotation) =>
        userRotations.some(
          (mine) =>
            isSameCountryCity(mine, rotation) &&
            overlaps(mine, rotation)
        )
      )
      .slice(0, 4)
      .map((rotation) => ({
        id: rotation.id,
        userId: rotation.user_id,
        name: `${rotation.user_name} ${rotation.user_surname}`.trim(),
        meta: `${rotation.specialty_name || "Residente"}${
          rotation.user_resident_year ? ` · R${rotation.user_resident_year}` : ""
        }`,
        dateLabel: formatDateRange(rotation.start_date, rotation.end_date),
        location: [rotation.city, rotation.country].filter(Boolean).join(", "),
        phone: rotation.user_phone,
        email: rotation.user_email,
      }));
  }, [rotations, userRotations]);

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

  const resetPublishForm = useCallback(
    (review = null) => {
      if (!review) {
        setPublishCountryCode("");
        setPublishForm({
          ...DEFAULT_PUBLISH_FORM,
          specialityId: userProfile?.speciality_id || "",
          startDate: formatDateForInput(new Date()),
          endDate: formatDateForInput(addMonthsToDate(new Date())),
        });
        return;
      }

      const matchedCountry = findCountryByName(review.country);
      setPublishCountryCode(matchedCountry?.isoCode || "");

      setPublishForm({
        rotationId: review.rotation_id || "",
        specialityId: review.speciality_id || "",
        hospitalName: review.external_hospital_name || "",
        serviceName: review.service_name || "",
        country: review.country || "",
        city: review.city || "",
        startDate: review.start_date || "",
        endDate:
          review.end_date ||
          formatDateForInput(addMonthsToDate(review.start_date || new Date())),
        difficulty: review.difficulty || "medium",
        difficultyNotes: review.difficulty_notes || "",
        rotationKind: review.rotation_kind || "observational",
        highlightSummary: review.highlight_summary || "",
        beforeYouGo: review.before_you_go || "",
        tutorName: review.tutor_name || "",
        tutorEmail: review.tutor_email || "",
        preferredContactMethod: "app_chat",
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
    },
    [userProfile?.speciality_id]
  );

  const resetRotationForm = useCallback(
    (rotation = null) => {
      if (!rotation) {
        const startDate = formatDateForInput(new Date());
        setRotationCountryCode("");
        setRotationForm({
          ...DEFAULT_ROTATION_FORM,
          specialityId: userProfile?.speciality_id || "",
          startDate,
          endDate: formatDateForInput(addMonthsToDate(startDate)),
          phone: userProfile?.phone || "",
        });
        return;
      }

      const matchedCountry = findCountryByName(rotation.country);
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
    [userProfile?.phone, userProfile?.speciality_id]
  );

  const openRotationForm = useCallback(
    (rotation = null) => {
      resetRotationForm(rotation);
      setRoute({ name: "rotation", payload: { rotation } });
    },
    [resetRotationForm]
  );

  const openPublish = useCallback(
    (review = null) => {
      resetPublishForm(review);
      setRoute({ name: "publish", payload: { review } });
    },
    [resetPublishForm]
  );

  const handleOpenContact = useCallback((review) => {
    setRoute({ name: "contact", payload: { review } });
  }, []);

  const handlePublishCountryChange = useCallback((countryCode) => {
    const selectedCountry = countryCode
      ? Country.getCountryByCode(countryCode)
      : null;

    setPublishCountryCode(countryCode || "");
    setPublishForm((current) => ({
      ...current,
      country: selectedCountry?.name || "",
      city: "",
    }));
  }, []);

  const handlePublishCityChange = useCallback((cityName) => {
    setPublishForm((current) => ({
      ...current,
      city: cityName || "",
    }));
  }, []);

  const handleRotationCountryChange = useCallback((countryCode) => {
    const selectedCountry = countryCode
      ? Country.getCountryByCode(countryCode)
      : null;

    setRotationCountryCode(countryCode || "");
    setRotationForm((current) => ({
      ...current,
      country: selectedCountry?.name || "",
      city: "",
    }));
  }, []);

  const handleRotationCityChange = useCallback(
    (cityName) => {
      const cities = rotationCountryCode
        ? City.getCitiesOfCountry(rotationCountryCode) || []
        : [];
      const selectedCity = cities.find((city) => city.name === cityName);

      setRotationForm((current) => ({
        ...current,
        city: cityName || "",
        latitude: selectedCity?.latitude
          ? parseFloat(selectedCity.latitude)
          : current.latitude,
        longitude: selectedCity?.longitude
          ? parseFloat(selectedCity.longitude)
          : current.longitude,
      }));
    },
    [rotationCountryCode]
  );

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

      setPublishForm((current) => ({
        ...current,
        startDate: nextStartDate,
        endDate: formatDateForInput(addMonthsToDate(selectedDate)),
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

  const refreshAll = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const handleSubmitRotation = useCallback(
    async () => {
      const matchedCountry = rotationCountryCode
        ? Country.getCountryByCode(rotationCountryCode)
        : null;
      const cityRecord = rotationCountryCode
        ? (City.getCitiesOfCountry(rotationCountryCode) || []).find(
            (city) => city.name === rotationForm.city
          )
        : null;

      if (
        !rotationForm.hospitalName.trim() ||
        !rotationForm.specialityId ||
        !matchedCountry?.name ||
        !rotationForm.city ||
        !rotationForm.startDate ||
        !rotationForm.endDate
      ) {
        Alert.alert(
          "Campos obligatorios",
          "Completa hospital, especialidad, país, ciudad, fecha de inicio y fecha de fin."
        );
        return;
      }

      const rotationData = {
        latitude: cityRecord?.latitude
          ? parseFloat(cityRecord.latitude)
          : rotationForm.latitude,
        longitude: cityRecord?.longitude
          ? parseFloat(cityRecord.longitude)
          : rotationForm.longitude,
        start_date: rotationForm.startDate,
        end_date: rotationForm.endDate,
        country: matchedCountry.name,
        city: rotationForm.city,
        hospital_name: rotationForm.hospitalName,
        service_name: rotationForm.serviceName,
        speciality_id: rotationForm.specialityId,
        notes: rotationForm.notes,
        phone: rotationForm.phone,
      };

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
        Alert.alert("Error", "No se pudo guardar la futura rotación.");
      } finally {
        setSaving(false);
      }
    },
    [refreshAll, rotationCountryCode, rotationForm, route.payload?.rotation?.id, userId]
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
    const requiredTextFields = [
      publishForm.hospitalName,
      publishForm.country,
      publishForm.city,
      publishForm.startDate,
      publishForm.highlightSummary,
      publishForm.beforeYouGo,
    ];

    if (requiredTextFields.some((value) => !String(value || "").trim())) {
      Alert.alert(
        "Campos obligatorios",
        "Completa hospital, país, ciudad, fecha de inicio y los dos bloques de experiencia."
      );
      return;
    }

    const unansweredRequired = questions
      .filter((question) => question.type === "rating" && !question.is_optional)
      .filter((question) => {
        const answer = publishForm.answers[question.id];
        return !answer?.rating;
      });

    if (unansweredRequired.length > 0) {
      Alert.alert(
        "Valoraciones incompletas",
        "Responde las valoraciones obligatorias antes de publicar."
      );
      return;
    }

    const formattedAnswers = Object.entries(publishForm.answers)
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
      specialityId: publishForm.specialityId || null,
      city: publishForm.city,
      country: publishForm.country,
      startDate: publishForm.startDate,
      endDate: publishForm.endDate || null,
      difficulty: publishForm.difficulty,
      difficultyNotes: publishForm.difficultyNotes,
      rotationKind: publishForm.rotationKind,
      highlightSummary: publishForm.highlightSummary,
      beforeYouGo: publishForm.beforeYouGo,
      tutorName: publishForm.tutorName,
      tutorEmail: publishForm.tutorEmail,
      preferredContactMethod: "app_chat",
      answers: formattedAnswers,
    };

    try {
      setSaving(true);
      if (route.payload?.review?.id) {
        await updateRotationReview(route.payload.review.id, payload);
      } else {
        await createRotationReview(payload);
      }

      setRoute({ name: "home", payload: null });
      refreshAll();
    } catch (error) {
      console.error("Error publishing review:", error);
      Alert.alert("Error", "No se pudo publicar la experiencia.");
    } finally {
      setSaving(false);
    }
  }, [publishForm, questions, refreshAll, route.payload?.review?.id, userId]);

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
        return "Buscar destino";
      case "plan":
        return "Ya tengo destino";
      case "rotation":
        return "Publicar mi plan";
      case "publish":
        return "Publicar experiencia";
      case "contact":
        return "Contactar";
      default:
        return "Rotaciones Externas";
    }
  }, [route.name]);

  const renderHome = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.homeHeroCard}>
        <Text style={styles.homeHeroEyebrow}>Rotaciones externas</Text>
        <Text style={styles.homeHeroTitle}>Tres formas de sacar partido a tu rotación externa</Text>
      </View>

      <View style={styles.hubGrid}>
        <HubActionCard
          eyebrow="Buscar destino"
          title="Quiero decidir dónde ir"
          description="Lee reseñas, filtra por hospital o ciudad y guarda opciones para comparar"
          buttonLabel="Buscar destino"
          onPress={() => setRoute({ name: "explore", payload: null })}
        />
        {primaryUserRotation ? (
          <View style={styles.hubActionCard}>
            <Text style={styles.homeSectionLabel}>Tu plan activo</Text>
            <Text style={styles.hubActionTitle}>
              {primaryUserRotation.hospital_name || "Rotación futura"}
            </Text>
            <Text style={styles.hubActionDescription}>
              {[
                primaryUserRotation.service_name,
                primaryUserRotation.city,
                primaryUserRotation.country,
                formatDateRange(
                  primaryUserRotation.start_date,
                  primaryUserRotation.end_date
                ),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <View style={styles.inlineStatsRow}>
              <View style={styles.inlineStatPill}>
                <Text style={styles.inlineStatValue}>{upcomingMatches.length}</Text>
                <Text style={styles.inlineStatLabel}>coincidencias</Text>
              </View>
              <View style={styles.inlineStatPill}>
                <Text style={styles.inlineStatValue}>{historicalMatches.length}</Text>
                <Text style={styles.inlineStatLabel}>experiencias relacionadas</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.hubActionButton}
              onPress={() => setRoute({ name: "plan", payload: null })}
              activeOpacity={0.85}
            >
              <Text style={styles.hubActionButtonText}>Gestionar plan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <HubActionCard
            eyebrow="Publicar plan"
            title="Ya sé dónde voy"
            description="Comparte tu destino y fechas para encontrar otros residentes que coincidan contigo"
            buttonLabel="Publicar mi plan"
            onPress={() => setRoute({ name: "plan", payload: null })}
          />
        )}
        {primaryUserReview ? (
          <View style={styles.hubActionCard}>
            <Text style={styles.homeSectionLabel}>Tu experiencia publicada</Text>
            <Text style={styles.hubActionTitle}>
              {primaryUserReview.external_hospital_name || "Experiencia publicada"}
            </Text>
            <Text style={styles.hubActionDescription}>
              {[
                primaryUserReview.service_name,
                primaryUserReview.city,
                primaryUserReview.country,
                formatDateRange(
                  primaryUserReview.start_date,
                  primaryUserReview.end_date
                ),
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
                onPress={() => openPublish(primaryUserReview)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.hubActionButtonText,
                    styles.hubActionButtonTextAlt,
                  ]}
                >
                  Editar reseña
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hubDangerButton, styles.hubActionButtonSplit]}
                onPress={() => setReviewToDelete(primaryUserReview)}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.ERROR} />
                <Text style={styles.hubDangerButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <HubActionCard
            eyebrow="Compartir experiencia"
            title="Ya he vuelto de mi rotación"
            description="Ayuda a otros residentes contando cómo fue tu rotación: hospital, servicio y logística. Te llevará menos de 2 minutos."
            buttonLabel="Escribir reseña"
            onPress={() => openPublish()}
          />
        )}
      </View>
    </ScrollView>
  );

  const renderExplore = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle
        eyebrow="Buscar destino"
        title="Descubre dónde merece la pena rotar"
        description="Explora reseñas reales, filtra por especialidad o localización y guarda tus opciones favoritas."
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        <FilterChip
          label={selectedExploreSpecialtyLabel}
          active={!!exploreFilters.specialtyId}
          icon="medkit-outline"
          onPress={() => setOpenExploreFilter("specialty")}
        />
        <FilterChip
          label={exploreFilters.country || "País"}
          active={!!exploreFilters.country}
          icon="earth-outline"
          onPress={() => setOpenExploreFilter("country")}
        />
        <FilterChip
          label={exploreFilters.city || "Ciudad"}
          active={!!exploreFilters.city}
          icon="business-outline"
          disabled={!exploreFilters.country}
          onPress={() => setOpenExploreFilter("city")}
        />
      </ScrollView>

      <SectionTitle
        title="Tus favoritas"
        description="Guarda reseñas para compararlas después."
      />

      {favoriteReviews.length ? (
        <View style={styles.reviewGrid}>
          {favoriteReviews.map((review) => (
            <ReviewListCard
              key={review.id}
              review={review}
              onPress={() =>
                setRoute({ name: "detail", payload: { review, from: "explore" } })
              }
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="heart-outline"
          title="Aún no tienes favoritas"
          description="Marca reseñas desde el detalle y las tendrás aquí para revisarlas con calma."
        />
      )}

      <SectionTitle
        title="Reseñas disponibles"
        description="Experiencias publicadas por otros residentes para ayudarte a decidir."
      />

      <View style={styles.resultsRow}>
        <Text style={styles.resultsLabel}>
          {hasActiveExploreFilters
            ? `${exploreVisibleReviews.length} ${
                exploreVisibleReviews.length === 1 ? "resultado" : "resultados"
              }`
            : `${exploreVisibleReviews.length} ${
                exploreVisibleReviews.length === 1 ? "reseña" : "reseñas"
              }`}
        </Text>
        {hasActiveExploreFilters ? (
          <TouchableOpacity
            style={styles.resultsAction}
            onPress={() => clearPersistedExploreFilters()}
            activeOpacity={0.75}
          >
            <Text style={styles.resultsActionText}>Quitar filtros</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {exploreVisibleReviews.length ? (
        <View style={styles.reviewGrid}>
          {exploreVisibleReviews.map((review) => (
            <ReviewListCard
              key={review.id}
              review={review}
              onPress={() =>
                setRoute({ name: "detail", payload: { review, from: "explore" } })
              }
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="search-outline"
          title="No hay resultados"
          description="Prueba a quitar filtros o busca otra ciudad, servicio o especialidad."
        />
      )}

      <SelectorModal
        visible={openExploreFilter === "specialty"}
        onClose={() => setOpenExploreFilter(null)}
        title="Filtrar por especialidad"
        options={specialtyOptions.map((option) => ({
          id: option.value,
          name: option.label,
        }))}
        value={exploreFilters.specialtyId}
        onSelect={(value) => updateExploreFilters({ specialtyId: value })}
        placeholder="Todas las especialidades"
      />
      <SelectorModal
        visible={openExploreFilter === "country"}
        onClose={() => setOpenExploreFilter(null)}
        title="Filtrar por país"
        options={countryOptions.map((option) => ({
          id: option.value,
          name: option.label,
        }))}
        value={exploreFilters.country}
        onSelect={(value) => updateExploreFilters({ country: value, city: "" })}
        placeholder="Todos los países"
      />
      <SelectorModal
        visible={openExploreFilter === "city" && !!exploreFilters.country}
        onClose={() => setOpenExploreFilter(null)}
        title="Filtrar por ciudad"
        options={cityOptions.map((option) => ({
          id: option.value,
          name: option.label,
        }))}
        value={exploreFilters.city}
        onSelect={(value) => updateExploreFilters({ city: value })}
        placeholder="Todas las ciudades"
      />
    </ScrollView>
  );

  const renderPlan = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle
        eyebrow="Ya tengo destino"
        title="Publica tu plan y mira si alguien coincide contigo"
        description="Comparte hospital, ciudad y fechas. La app te enseñará residentes que van al mismo lugar y experiencias previas relacionadas."
      />

      {primaryUserRotation ? (
        <View style={styles.hubActionCard}>
          <Text style={styles.homeSectionLabel}>Tu plan activo</Text>
          <Text style={styles.hubActionTitle}>
            {primaryUserRotation.hospital_name || "Rotación futura"}
          </Text>
          <Text style={styles.hubActionDescription}>
            {[
              primaryUserRotation.service_name,
              primaryUserRotation.city,
              primaryUserRotation.country,
              formatDateRange(
                primaryUserRotation.start_date,
                primaryUserRotation.end_date
              ),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <View style={styles.hubActionRow}>
            <TouchableOpacity
              style={[styles.hubActionButton, styles.hubActionButtonAlt, styles.hubActionButtonSplit]}
              onPress={() => openRotationForm(primaryUserRotation)}
              activeOpacity={0.85}
            >
              <Text style={[styles.hubActionButtonText, styles.hubActionButtonTextAlt]}>
                Editar plan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.hubDangerButton, styles.hubActionButtonSplit]}
              onPress={() => setRotationToDelete(primaryUserRotation)}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.ERROR} />
              <Text style={styles.hubDangerButtonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <EmptyState
          icon="paper-plane-outline"
          title="Aún no has publicado tu plan futuro"
          description="Solo necesitas hospital, ciudad y fechas aproximadas para ver si otro residente coincide contigo."
          actionLabel="Crear mi plan"
          onAction={() => openRotationForm()}
        />
      )}

      {primaryUserRotation ? (
        <>
          <Text style={styles.subsectionLabel}>Coincidencias en mismas fechas</Text>
          {upcomingMatches.length ? (
            <View style={styles.matchesList}>
              {upcomingMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  item={match}
                  onChat={() => handleOpenResidentMatchChat(match)}
                  buttonLabel="Contactar"
                  onContact={() => handleOpenResidentMatchChat(match)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="people-outline"
              title="Aún no hay coincidencias"
              description="Cuando otro residente comparta un destino y fechas similares aparecerá aquí."
            />
          )}

          <Text style={styles.subsectionLabel}>Experiencias previas relacionadas</Text>
          {historicalMatches.length ? (
            <View style={styles.matchesList}>
              {historicalMatches.map((review) => (
                <MatchCard
                  key={review.id}
                  item={{
                    name: `${review.reviewer_name} ${review.reviewer_surname}`.trim(),
                    meta:
                      review.service_name ||
                      review.specialty_name ||
                      "Experiencia publicada",
                    location: [review.city, review.country].filter(Boolean).join(", "),
                    dateLabel: formatDateRange(review.start_date, review.end_date),
                  }}
                  onChat={() => handleOpenAppChat(review)}
                  buttonLabel="Leer reseña"
                  onContact={() =>
                    setRoute({ name: "detail", payload: { review, from: "plan" } })
                  }
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="time-outline"
              title="Todavía no hay experiencias relacionadas"
              description="Si otros residentes ya han pasado por ese destino, sus reseñas aparecerán aquí."
            />
          )}
        </>
      ) : null}

      {primaryUserReview ? (
        <View style={styles.hubActionCard}>
          <Text style={styles.homeSectionLabel}>Tu experiencia publicada</Text>
          <Text style={styles.hubActionTitle}>
            {primaryUserReview.external_hospital_name || "Experiencia publicada"}
          </Text>
          <Text style={styles.hubActionDescription}>
            {[
              primaryUserReview.service_name,
              primaryUserReview.city,
              primaryUserReview.country,
              formatDateRange(
                primaryUserReview.start_date,
                primaryUserReview.end_date
              ),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <TouchableOpacity
            style={styles.hubActionButton}
            onPress={() => openPublish(primaryUserReview)}
            activeOpacity={0.85}
          >
            <Text style={styles.hubActionButtonText}>Editar experiencia</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <HubActionCard
          title="Cuando vuelvas, publica la reseña"
          description="Tu experiencia ayudará a quienes aún están decidiendo dónde rotar."
          buttonLabel="Escribir reseña"
          onPress={() => openPublish()}
        />
      )}
    </ScrollView>
  );

  const renderPublish = () => {
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle
          eyebrow="Tu experiencia"
          title="Publicar experiencia"
          description="Estructura la información para que el resto de residentes pueda decidir mejor."
        />

        <View style={styles.formCard}>
          <SelectFilter
            label="Especialidad"
            value={publishForm.specialityId}
            onChange={(value) =>
              setPublishForm((current) => ({ ...current, specialityId: value }))
            }
            options={specialtyOptions}
            placeholder="Selecciona una especialidad"
          />

          <Text style={styles.inputLabel}>Hospital de destino</Text>
          <TextInput
            style={styles.textInput}
            value={publishForm.hospitalName}
            onChangeText={(value) =>
              setPublishForm((current) => ({ ...current, hospitalName: value }))
            }
            placeholder="Ej. Hospital Clínic"
          />

          <Text style={styles.inputLabel}>Servicio / unidad</Text>
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
              <SelectFilter
                label="País"
                value={publishCountryCode}
                onChange={handlePublishCountryChange}
                options={publishCountryOptions}
                placeholder="Selecciona un país"
              />
            </View>
            <View style={styles.formColumn}>
              <SelectFilter
                label="Ciudad"
                value={publishForm.city}
                onChange={handlePublishCityChange}
                options={publishCityOptions}
                placeholder={
                  publishCountryCode
                    ? "Selecciona una ciudad"
                    : "Primero selecciona un país"
                }
                disabled={!publishCountryCode}
              />
            </View>
          </View>

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
              <Ionicons name="calendar-outline" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>
          </View>

          <View style={styles.formColumn}>
            <Text style={styles.inputLabel}>Fecha de fin</Text>
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
              <Ionicons
                name="calendar-outline"
                size={20}
                color={TEXT_MUTED}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Dificultad para conseguirla</Text>
          <PillGroup
            options={difficultyOptions}
            value={publishForm.difficulty}
            onChange={(value) =>
              setPublishForm((current) => ({ ...current, difficulty: value }))
            }
          />

          <Text style={styles.inputLabel}>Notas sobre la dificultad</Text>
          <TextInput
            style={styles.textInput}
            value={publishForm.difficultyNotes}
            onChangeText={(value) =>
              setPublishForm((current) => ({
                ...current,
                difficultyNotes: value,
              }))
            }
            placeholder="Burocracia, timing, requisitos..."
          />

          <Text style={styles.inputLabel}>Tipo de rotación</Text>
          <PillGroup
            options={rotationKindOptions}
            value={publishForm.rotationKind}
            onChange={(value) =>
              setPublishForm((current) => ({ ...current, rotationKind: value }))
            }
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Valoración</Text>
          {questions
            .filter((question) => question.type === "rating")
            .map((question) => (
              <View key={question.id} style={styles.ratingQuestion}>
                <Text style={styles.ratingQuestionLabel}>{question.text}</Text>
                <View style={styles.ratingButtons}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.ratingButton,
                        publishForm.answers[question.id]?.rating === rating &&
                          styles.ratingButtonActive,
                      ]}
                      onPress={() =>
                        setPublishForm((current) => ({
                          ...current,
                          answers: {
                            ...current.answers,
                            [question.id]: {
                              ...current.answers[question.id],
                              rating,
                            },
                          },
                        }))
                      }
                    >
                      <Ionicons
                        name="star"
                        size={18}
                        color={
                          publishForm.answers[question.id]?.rating === rating
                            ? "#FFFFFF"
                            : PRIMARY
                        }
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Tu opinión</Text>
          <Text style={styles.inputLabel}>¿Qué destacas de esta rotación?</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={publishForm.highlightSummary}
            onChangeText={(value) =>
              setPublishForm((current) => ({
                ...current,
                highlightSummary: value,
              }))
            }
            multiline
            textAlignVertical="top"
            placeholder="Puntos fuertes, técnicas aprendidas, volumen, sesiones..."
          />

          <Text style={styles.inputLabel}>¿Qué saber antes de ir?</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={publishForm.beforeYouGo}
            onChangeText={(value) =>
              setPublishForm((current) => ({
                ...current,
                beforeYouGo: value,
              }))
            }
            multiline
            textAlignVertical="top"
            placeholder="Logística, burocracia, idioma, tiempos, alojamiento..."
          />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Contacto del servicio</Text>
          <TextInput
            style={styles.textInput}
            value={publishForm.tutorName}
            onChangeText={(value) =>
              setPublishForm((current) => ({ ...current, tutorName: value }))
            }
            placeholder="Nombre del tutor o contacto"
          />
          <TextInput
            style={styles.textInput}
            value={publishForm.tutorEmail}
            onChangeText={(value) =>
              setPublishForm((current) => ({ ...current, tutorEmail: value }))
            }
            placeholder="Email del contacto"
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={styles.fullPrimaryButton}
          onPress={handlePublishSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.fullPrimaryButtonText}>
              {route.payload?.review ? "Actualizar experiencia" : "Publicar experiencia"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderRotationForm = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle
        eyebrow="Tu futura rotación"
        title={route.payload?.rotation ? "Editar futura rotación" : "Añadir futura rotación"}
        description="Comparte tus fechas y destino para encontrar a otros residentes con un formato equivalente al de publicar experiencia."
      />

      <View style={styles.formCard}>
        <SelectFilter
          label="Especialidad"
          value={rotationForm.specialityId}
          onChange={(value) =>
            setRotationForm((current) => ({ ...current, specialityId: value }))
          }
          options={specialtyOptions}
          placeholder="Selecciona una especialidad"
        />

        <Text style={styles.inputLabel}>Hospital de destino</Text>
        <TextInput
          style={styles.textInput}
          value={rotationForm.hospitalName}
          onChangeText={(value) =>
            setRotationForm((current) => ({ ...current, hospitalName: value }))
          }
          placeholder="Ej. Hospital Clínic"
        />

        <Text style={styles.inputLabel}>Servicio / unidad</Text>
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
            <SelectFilter
              label="País"
              value={rotationCountryCode}
              onChange={handleRotationCountryChange}
              options={rotationCountryOptions}
              placeholder="Selecciona un país"
            />
          </View>
          <View style={styles.formColumn}>
            <SelectFilter
              label="Ciudad"
              value={rotationForm.city}
              onChange={handleRotationCityChange}
              options={rotationCityOptions}
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
            <Ionicons name="calendar-outline" size={20} color={TEXT_MUTED} />
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
            <Ionicons name="calendar-outline" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Contacto y notas</Text>
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
        onPress={handleSubmitRotation}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.fullPrimaryButtonText}>
            {route.payload?.rotation ? "Actualizar futura rotación" : "Guardar futura rotación"}
          </Text>
        )}
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
            <Ionicons name="person" size={42} color={PRIMARY} />
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
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.ORANGE} />
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

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.centeredStateDescription}>
          Cargando rotaciones externas...
        </Text>
      </View>
    );
  }

  if (route.name === "detail" && selectedReview?.id) {
    return (
      <RotationReviewDetailScreen
        reviewId={selectedReview.id}
        userId={userId}
        onBack={() =>
          setRoute({ name: route.payload?.from || "explore", payload: null })
        }
        onContact={handleOpenAppChat}
        onFavoriteChanged={refreshAll}
      />
    );
  }

  return (
    <HeroScreenLayout
      title={routeTitle}
      onBack={
        route.name === "home"
          ? onBack
          : () => setRoute({ name: "home", payload: null })
      }
    >
      {route.name === "home" && renderHome()}
      {route.name === "explore" && renderExplore()}
      {route.name === "plan" && renderPlan()}
      {route.name === "rotation" && renderRotationForm()}
      {route.name === "publish" && renderPublish()}
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
  homeHeroCard: {
    backgroundColor: PRIMARY,
    borderRadius: 28,
    padding: 22,
    gap: 10,
  },
  homeHeroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.78)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  homeHeroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  homeHeroDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.88)",
  },
  sectionHeader: {
    gap: 6,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionTitleCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: TEXT,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_MUTED,
    marginTop: 3,
  },
  sectionAction: {
    color: PRIMARY,
    fontWeight: "800",
    fontSize: 13,
  },
  hubGrid: {
    gap: 10,
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
  inlineStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  inlineStatPill: {
    flex: 1,
    backgroundColor: SURFACE_ALT,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT,
  },
  inlineStatLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  miniDestinationCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  miniDestinationCopy: {
    flex: 1,
    paddingRight: 12,
  },
  miniDestinationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
  },
  miniDestinationSubtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 3,
  },
  miniDestinationRating: {
    alignItems: "flex-end",
  },
  miniRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  miniDestinationRatingValue: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT,
  },
  miniDestinationMeta: {
    marginTop: 3,
    fontSize: 11,
    color: TEXT_MUTED,
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
  resultsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 6,
    marginBottom: 8,
    gap: 12,
  },
  resultsLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
  },
  resultsAction: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: PRIMARY + "10",
    borderWidth: 1,
    borderColor: PRIMARY + "20",
  },
  resultsActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
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
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    color: TEXT,
  },
  reviewCardLocation: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_MUTED,
  },
  reviewCardButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  reviewCardButtonText: {
    color: "#FFFFFF",
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
