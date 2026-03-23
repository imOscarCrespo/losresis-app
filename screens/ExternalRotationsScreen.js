import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { supabase } from "../config/supabase";
import { COLORS } from "../constants/colors";
import { SelectorModal } from "../components/SelectorModal";
import { SelectFilter, ConfirmationModal } from "../components";
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
  ensureReviewContactThread,
  getAllExternalRotationReviews,
  getRotationReviewQuestions,
  updateRotationReview,
} from "../services/externalRotationReviewService";
import RotationReviewDetailScreen from "./RotationReviewDetailScreen";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const PRIMARY_SOFT = "#F2EBFF";
const PRIMARY_LIGHT = "#EEE8FF";
const SURFACE = "#F5F7FA";
const SURFACE_CARD = "#FFFFFF";
const SURFACE_ALT = "#EEF1F6";
const TEXT = "#111827";
const TEXT_MUTED = "#667085";
const BORDER = "#E6E8EC";
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

const contactMethodLabels = {
  app_chat: "Chat de la app",
  whatsapp: "WhatsApp",
  email: "Email",
  none: "No mostrar",
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

const contactOptions = [
  { id: "app_chat", label: "Chat app" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "none", label: "Ocultar" },
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

const FeatureTab = ({ active, icon, label, onPress }) => (
  <TouchableOpacity
    style={[styles.featureTab, active && styles.featureTabActive]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Ionicons
      name={icon}
      size={18}
      color={active ? PRIMARY : TEXT_MUTED}
      style={styles.featureTabIcon}
    />
    <Text style={[styles.featureTabText, active && styles.featureTabTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

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

const HubActionCard = ({ icon, title, description, primary = false, onPress, buttonLabel }) => (
  <View style={styles.hubActionCard}>
    <View>
      <View
        style={[
          styles.hubIconWrap,
          primary ? styles.hubIconWrapPrimary : styles.hubIconWrapAlt,
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={primary ? PRIMARY : SUCCESS}
        />
      </View>
      <Text style={styles.hubActionTitle}>{title}</Text>
      <Text style={styles.hubActionDescription}>{description}</Text>
    </View>
    <TouchableOpacity
      style={[styles.hubActionButton, !primary && styles.hubActionButtonAlt]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.hubActionButtonText,
          !primary && styles.hubActionButtonTextAlt,
        ]}
      >
        {buttonLabel}
      </Text>
    </TouchableOpacity>
  </View>
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

const MatchCard = ({ item, onChat, onContact, buttonLabel = "Ver contacto" }) => (
  <View style={styles.matchCard}>
    <View style={styles.matchCardHeader}>
      <View>
        <Text style={styles.matchName}>{item.name}</Text>
        <Text style={styles.matchMeta}>{item.meta}</Text>
      </View>
      {onChat ? (
        <TouchableOpacity style={styles.chatBadge} onPress={onChat}>
          <Text style={styles.chatBadgeText}>Hablar</Text>
        </TouchableOpacity>
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

const FilterChip = ({ label, active, icon, onPress }) => (
  <TouchableOpacity
    style={[styles.filterChip, active && styles.filterChipActive]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Ionicons name={icon} size={14} color={active ? PRIMARY : TEXT} />
    <Text
      style={[styles.filterChipText, active && styles.filterChipTextActive]}
      numberOfLines={1}
    >
      {label}
    </Text>
    <Ionicons
      name="chevron-down"
      size={14}
      color={active ? PRIMARY : TEXT_MUTED}
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

export const ExternalRotationsScreen = ({ userProfile, navigation }) => {
  const userId = userProfile?.id;
  const isResident = userProfile?.is_resident;

  const [route, setRoute] = useState({ name: "hub", payload: null });
  const [specialties, setSpecialties] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [userRotations, setUserRotations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rotationToDelete, setRotationToDelete] = useState(null);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [openExploreFilter, setOpenExploreFilter] = useState(null);
  const [exploreFilters, setExploreFilters] = useState({
    specialtyId: "",
    country: "",
    city: "",
    search: "",
  });
  const [rotationForm, setRotationForm] = useState(DEFAULT_ROTATION_FORM);
  const [rotationCountryCode, setRotationCountryCode] = useState("");
  const [showRotationStartDatePicker, setShowRotationStartDatePicker] =
    useState(false);
  const [showRotationEndDatePicker, setShowRotationEndDatePicker] =
    useState(false);
  const [publishForm, setPublishForm] = useState(DEFAULT_PUBLISH_FORM);
  const [publishCountryCode, setPublishCountryCode] = useState("");
  const [showPublishStartDatePicker, setShowPublishStartDatePicker] = useState(false);
  const [showPublishEndDatePicker, setShowPublishEndDatePicker] = useState(false);

  useEffect(() => {
    posthogLogger.logScreen("ExternalRotationsScreen");
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setLoading(true);

      const [specialtiesRes, rotationsData, userRotationsData, reviewsData, questionsData] =
        await Promise.all([
          supabase
            .from("specialities")
            .select("id, name")
            .order("name", { ascending: true }),
          getAllRotations({}),
          getUserRotations(userId),
          getAllExternalRotationReviews(userId, {}),
          getRotationReviewQuestions(),
        ]);

      if (specialtiesRes.error) {
        throw specialtiesRes.error;
      }

      setSpecialties(specialtiesRes.data || []);
      setRotations(rotationsData || []);
      setUserRotations(userRotationsData || []);
      setReviews(reviewsData || []);
      setQuestions(questionsData || []);
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
          exploreFilters.city ||
          exploreFilters.search.trim()
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
    const normalizedSearch = exploreFilters.search.trim().toLowerCase();

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

      if (!normalizedSearch) {
        return true;
      }

      return [
        review.external_hospital_name,
        review.service_name,
        review.specialty_name,
        review.city,
        review.country,
        review.highlight_summary,
        review.before_you_go,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch)
        );
    });
  }, [exploreFilters, publishedReviews]);

  const exploreVisibleReviews = useMemo(
    () => filteredReviews.filter((review) => review.user_id !== userId),
    [filteredReviews, userId]
  );

  const featuredReviews = useMemo(
    () =>
      publishedReviews
        .filter((review) => review.is_approved)
        .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
        .slice(0, 3),
    [publishedReviews]
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
        preferredContactMethod: review.preferred_contact_method || "app_chat",
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

  const handleRotationStartDateChange = useCallback((event, selectedDate) => {
    setShowRotationStartDatePicker(Platform.OS === "ios");

    if (!selectedDate) {
      return;
    }

    const nextStartDate = formatDateForInput(selectedDate);

    setRotationForm((current) => ({
      ...current,
      startDate: nextStartDate,
      endDate: formatDateForInput(addMonthsToDate(selectedDate)),
    }));
  }, []);

  const handleRotationEndDateChange = useCallback((event, selectedDate) => {
    setShowRotationEndDatePicker(Platform.OS === "ios");

    if (!selectedDate) {
      return;
    }

    setRotationForm((current) => ({
      ...current,
      endDate: formatDateForInput(selectedDate),
    }));
  }, []);

  const handlePublishStartDateChange = useCallback((event, selectedDate) => {
    setShowPublishStartDatePicker(Platform.OS === "ios");

    if (!selectedDate) {
      return;
    }

    const nextStartDate = formatDateForInput(selectedDate);

    setPublishForm((current) => ({
      ...current,
      startDate: nextStartDate,
      endDate: formatDateForInput(addMonthsToDate(selectedDate)),
    }));
  }, []);

  const handlePublishEndDateChange = useCallback((event, selectedDate) => {
    setShowPublishEndDatePicker(Platform.OS === "ios");

    if (!selectedDate) {
      return;
    }

    setPublishForm((current) => ({
      ...current,
      endDate: formatDateForInput(selectedDate),
    }));
  }, []);

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

        setRoute({ name: "hub", payload: null });
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
      setRoute({ name: "hub", payload: null });
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
      preferredContactMethod: publishForm.preferredContactMethod,
      answers: formattedAnswers,
    };

    try {
      setSaving(true);
      if (route.payload?.review?.id) {
        await updateRotationReview(route.payload.review.id, payload);
      } else {
        await createRotationReview(payload);
      }

      setRoute({ name: "hub", payload: null });
      refreshAll();
    } catch (error) {
      console.error("Error publishing review:", error);
      Alert.alert("Error", "No se pudo publicar la experiencia.");
    } finally {
      setSaving(false);
    }
  }, [publishForm, questions, refreshAll, route.payload?.review?.id, userId]);

  const handleOpenWhatsApp = useCallback(async (review) => {
    const phone = review.reviewer_phone?.replace(/\s+/g, "");

    if (!phone) {
      Alert.alert("No disponible", "Este residente no ha compartido WhatsApp.");
      return;
    }

    const url = `https://wa.me/${phone.replace(/[^\d+]/g, "")}`;
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert("Error", "No se pudo abrir WhatsApp en este dispositivo.");
      return;
    }

    await Linking.openURL(url);
  }, []);

  const handleOpenEmail = useCallback(async (review) => {
    const email = review.reviewer_email;

    if (!email) {
      Alert.alert("No disponible", "Este residente no ha compartido email.");
      return;
    }

    const url = `mailto:${email}`;
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert("Error", "No se pudo abrir el cliente de correo.");
      return;
    }

    await Linking.openURL(url);
  }, []);

  const handleOpenAppChat = useCallback(
    async (review) => {
      try {
        const threadId = await ensureReviewContactThread(review.id);
        navigation?.navigate("threadDetail", {
          threadId,
          fromSection: "rotaciones-externas",
        });
      } catch (error) {
        console.error("Error opening app chat:", error);
        Alert.alert("Error", "No se pudo abrir el chat de la experiencia.");
      }
    },
    [navigation]
  );

  const routeTitle = useMemo(() => {
    switch (route.name) {
      case "explore":
        return "Explorar";
      case "match":
        return "Conectar";
      case "rotation":
        return "Mi futura rotación";
      case "publish":
        return "Mi experiencia";
      case "contact":
        return "Contactar";
      default:
        return "Rotaciones Externas";
    }
  }, [route.name]);

  const renderHub = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hubGrid}>
        <HubActionCard
          icon="search"
          title="Explorar futura rotación"
          description="Investiga destinos, hospitales, ciudades y servicios."
          primary
          onPress={() => setRoute({ name: "explore", payload: null })}
          buttonLabel="Empezar a buscar"
        />
        {primaryUserRotation ? (
          <View style={styles.hubActionCard}>
            <View>
              <Text style={styles.hubActionTitle}>Mi futura rotación</Text>
              <Text style={styles.hubActionDescription}>
                {[
                  primaryUserRotation.hospital_name || "Rotación futura",
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
            </View>
            <View style={styles.hubActionRow}>
              <TouchableOpacity
                style={[styles.hubActionButton, styles.hubActionButtonAlt, styles.hubActionButtonSplit]}
                onPress={() => openRotationForm(primaryUserRotation)}
                activeOpacity={0.85}
              >
                <Text style={[styles.hubActionButtonText, styles.hubActionButtonTextAlt]}>
                  Editar
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
          <HubActionCard
            icon="location"
            title="Añadir mi futura rotación"
            description="Comparte tus planes para encontrar a otros residentes."
            onPress={() => openRotationForm()}
            buttonLabel="Registrar planes"
          />
        )}
        {primaryUserReview ? (
          <View style={styles.hubActionCard}>
            <View>
              <Text style={styles.hubActionTitle}>Mi experiencia</Text>
              <Text style={styles.hubActionDescription}>
                {[
                  primaryUserReview.external_hospital_name || "Experiencia publicada",
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
            </View>
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
                  Editar
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
            icon="document-text"
            title="Añadir mi experiencia"
            description="Cuenta cómo fue tu rotación y ayuda a quien viene detrás."
            onPress={() => openPublish()}
            buttonLabel="Escribir reseña"
          />
        )}
      </View>

      <SectionTitle
        title="Experiencias destacadas"
        description="Centros y servicios mejor valorados por la comunidad."
      />
      {featuredReviews.length ? (
        featuredReviews.map((review) => (
          <MiniDestinationCard
            key={review.id}
            review={review}
            onPress={() => setRoute({ name: "detail", payload: { review } })}
          />
        ))
      ) : (
        <EmptyState
          icon="star-outline"
          title="Todavía no hay experiencias destacadas"
          description="Cuando se publiquen reseñas aprobadas aparecerán aquí."
        />
      )}
    </ScrollView>
  );

  const renderExplore = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
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
          onPress={() => {
            if (exploreFilters.country) {
              setOpenExploreFilter("city");
            }
          }}
        />
      </ScrollView>

      {upcomingMatches.length ? (
        <>
          <Text style={styles.subsectionLabel}>Van en tus fechas</Text>
          <View style={styles.matchesList}>
            {upcomingMatches.slice(0, 2).map((match) => (
              <MatchCard
                key={match.id}
                item={match}
                onContact={() =>
                  Alert.alert(
                    match.name,
                    [match.phone, match.email].filter(Boolean).join("\n") ||
                      "No hay contacto directo disponible."
                  )
                }
              />
            ))}
          </View>
        </>
      ) : null}

      {historicalMatches.length ? (
        <>
          <Text style={styles.subsectionLabel}>Han estado antes</Text>
          <View style={styles.matchesList}>
            {historicalMatches.slice(0, 2).map((review) => (
              <MatchCard
                key={review.id}
                item={{
                  name: `${review.reviewer_name} ${review.reviewer_surname}`.trim(),
                  meta: review.service_name || review.specialty_name || "Experiencia",
                  location: [review.city, review.country].filter(Boolean).join(", "),
                  dateLabel: formatDateRange(review.start_date, review.end_date),
                }}
                buttonLabel="Leer reseña"
                onContact={() => setRoute({ name: "detail", payload: { review } })}
              />
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle
        title="Explorar destinos"
        description="Reseñas validadas y publicadas por otros residentes."
      />

      <View style={styles.resultsRow}>
        <Text style={styles.resultsLabel}>
          {hasActiveExploreFilters
            ? `${exploreVisibleReviews.length} ${
                exploreVisibleReviews.length === 1 ? "resultado" : "resultados"
              }`
            : "Reseñas disponibles"}
        </Text>
        {hasActiveExploreFilters ? (
          <TouchableOpacity
            style={styles.resultsAction}
            onPress={() =>
              setExploreFilters({
                specialtyId: "",
                country: "",
                city: "",
                search: "",
              })
            }
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
              onPress={() => setRoute({ name: "detail", payload: { review } })}
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
        onSelect={(value) =>
          setExploreFilters((current) => ({ ...current, specialtyId: value }))
        }
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
        onSelect={(value) =>
          setExploreFilters((current) => ({
            ...current,
            country: value,
            city: "",
          }))
        }
        placeholder="Todos los países"
      />
      <SelectorModal
        visible={openExploreFilter === "city"}
        onClose={() => setOpenExploreFilter(null)}
        title="Filtrar por ciudad"
        options={cityOptions.map((option) => ({
          id: option.value,
          name: option.label,
        }))}
        value={exploreFilters.city}
        onSelect={(value) =>
          setExploreFilters((current) => ({ ...current, city: value }))
        }
        placeholder="Todas las ciudades"
      />
    </ScrollView>
  );

  const renderMatch = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle
        title="No estás solo"
        description="Conecta con residentes que comparten tu destino o que ya han pasado por él."
      />

      <Text style={styles.subsectionLabel}>Van en tus fechas</Text>
      {upcomingMatches.length ? (
        upcomingMatches.map((match) => (
          <MatchCard
            key={match.id}
            item={match}
            onContact={() =>
              Alert.alert(
                match.name,
                [match.phone, match.email].filter(Boolean).join("\n") ||
                  "No hay datos de contacto disponibles."
              )
            }
          />
        ))
      ) : (
        <EmptyState
          icon="people-outline"
          title="Aún no hay coincidencias"
          description="Cuando otro residente comparta fechas y destino similares aparecerá aquí."
        />
      )}

      <Text style={styles.subsectionLabel}>Han estado antes</Text>
      {historicalMatches.length ? (
        historicalMatches.map((review) => (
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
            buttonLabel="Leer reseña"
            onContact={() => setRoute({ name: "detail", payload: { review } })}
          />
        ))
      ) : (
        <EmptyState
          icon="time-outline"
          title="Todavía no hay experiencias relacionadas"
          description="Las experiencias previas publicadas por otros residentes aparecerán aquí."
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
              onPress={() => setShowPublishStartDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.dateButtonText}>
                {formatDateForDisplay(publishForm.startDate)}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={TEXT_MUTED} />
            </TouchableOpacity>
            {showPublishStartDatePicker ? (
              <DateTimePicker
                value={parseStoredDate(publishForm.startDate)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handlePublishStartDateChange}
              />
            ) : null}
          </View>

          <View style={styles.formColumn}>
            <Text style={styles.inputLabel}>Fecha de fin</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowPublishEndDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.dateButtonText}>
                {formatDateForDisplay(publishForm.endDate)}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={TEXT_MUTED}
              />
            </TouchableOpacity>
            {showPublishEndDatePicker ? (
              <DateTimePicker
                value={parseStoredDate(
                  publishForm.endDate || publishForm.startDate
                )}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handlePublishEndDateChange}
                minimumDate={parseStoredDate(publishForm.startDate)}
              />
            ) : null}
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

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Privacidad y contacto</Text>
          <PillGroup
            options={contactOptions}
            value={publishForm.preferredContactMethod}
            onChange={(value) =>
              setPublishForm((current) => ({
                ...current,
                preferredContactMethod: value,
              }))
            }
          />
          <Text style={styles.helpText}>
            Método elegido:{" "}
            {contactMethodLabels[publishForm.preferredContactMethod]}
          </Text>
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
            onPress={() => setShowRotationStartDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dateButtonText}>
              {formatDateForDisplay(rotationForm.startDate)}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
          {showRotationStartDatePicker ? (
            <DateTimePicker
              value={parseStoredDate(rotationForm.startDate)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleRotationStartDateChange}
            />
          ) : null}
        </View>

        <View style={styles.formColumn}>
          <Text style={styles.inputLabel}>Fecha de fin</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowRotationEndDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dateButtonText}>
              {formatDateForDisplay(rotationForm.endDate)}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
          {showRotationEndDatePicker ? (
            <DateTimePicker
              value={parseStoredDate(rotationForm.endDate || rotationForm.startDate)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleRotationEndDateChange}
              minimumDate={parseStoredDate(rotationForm.startDate)}
            />
          ) : null}
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

    const residentName = `${review.reviewer_name} ${
      review.reviewer_surname ? `${review.reviewer_surname[0]}.` : ""
    }`.trim();

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
          <Text style={styles.contactResidentName}>{residentName}</Text>
          <Text style={styles.contactResidentMeta}>
            {review.specialty_name || "Residente"}
            {review.reviewer_hospital_name
              ? ` · ${review.reviewer_hospital_name}`
              : ""}
          </Text>
        </View>

        <View style={styles.contactCardShell}>
          <Text style={styles.contactCardTitle}>
            Elige cómo quieres contactar con {residentName}
          </Text>

          <View style={styles.contactOptionsList}>
            {review.reviewer_phone ? (
              <ContactOptionCard
                icon="logo-whatsapp"
                color="#25D366"
                backgroundColor="#E8F8EE"
                title="WhatsApp"
                subtitle="Enviar mensaje por WhatsApp"
                onPress={() => handleOpenWhatsApp(review)}
              />
            ) : null}

            <ContactOptionCard
              icon="chatbubbles"
              color="#FFFFFF"
              backgroundColor="rgba(255,255,255,0.18)"
              title="Chat de la app"
              subtitle="Abrir hilo de preguntas en la app"
              onPress={() => handleOpenAppChat(review)}
              primary
            />

            {review.reviewer_email ? (
              <ContactOptionCard
                icon="mail"
                color={PRIMARY}
                backgroundColor={PRIMARY_SOFT}
                title="Email"
                subtitle="Enviar correo electrónico"
                onPress={() => handleOpenEmail(review)}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.privacyBanner}>
          <Ionicons name="shield-checkmark" size={18} color={PRIMARY} />
          <Text style={styles.privacyBannerText}>
            Tu privacidad es importante. Solo mostramos la información necesaria
            para el método de contacto elegido.
          </Text>
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
        onBack={() => setRoute({ name: "explore", payload: null })}
        onContact={(review) => handleOpenContact(review)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {route.name === "hub" ? (
          <View style={styles.headerSpacer} />
        ) : (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setRoute({ name: "hub", payload: null })}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={PRIMARY} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{routeTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {route.name !== "publish" &&
      route.name !== "contact" &&
      route.name !== "rotation" ? (
        <View style={styles.featureTabsRow}>
          <FeatureTab
            active={route.name === "hub"}
            icon="grid"
            label="Hub"
            onPress={() => setRoute({ name: "hub", payload: null })}
          />
          <FeatureTab
            active={route.name === "explore"}
            icon="search"
            label="Explorar"
            onPress={() => setRoute({ name: "explore", payload: null })}
          />
          <FeatureTab
            active={route.name === "match"}
            icon="people"
            label="Conectar"
            onPress={() => setRoute({ name: "match", payload: null })}
          />
        </View>
      ) : null}

      {route.name === "hub" && renderHub()}
      {route.name === "explore" && renderExplore()}
      {route.name === "match" && renderMatch()}
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
    </View>
  );
};

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
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: SURFACE,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: PRIMARY,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_CARD,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  featureTabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  featureTab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: SURFACE_CARD,
    paddingVertical: 12,
  },
  featureTabActive: {
    backgroundColor: PRIMARY_SOFT,
  },
  featureTabIcon: {
    marginRight: 6,
  },
  featureTabText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: "700",
  },
  featureTabTextActive: {
    color: PRIMARY,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 14,
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
    gap: 12,
  },
  hubActionCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  hubIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  hubIconWrapPrimary: {
    backgroundColor: PRIMARY_SOFT,
  },
  hubIconWrapAlt: {
    backgroundColor: SUCCESS_SOFT,
  },
  hubActionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 6,
  },
  hubActionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_MUTED,
  },
  hubActionButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    minHeight: 42,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 13,
  },
  hubActionButtonTextAlt: {
    color: PRIMARY,
  },
  hubDangerButton: {
    borderRadius: 999,
    minHeight: 42,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#FEECEC",
  },
  hubDangerButtonText: {
    color: COLORS.ERROR,
    fontWeight: "800",
    fontSize: 13,
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
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
    flexShrink: 1,
  },
  filterChipTextActive: {
    color: PRIMARY,
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
    backgroundColor: SURFACE_ALT,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateButtonText: {
    fontSize: 15,
    color: TEXT,
    fontWeight: "500",
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
  privacyBanner: {
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  privacyBannerText: {
    flex: 1,
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 20,
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
