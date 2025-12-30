import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { useExternalRotations } from "../hooks/useExternalRotations";
import { useResidentReviewCheck } from "../hooks/useResidentReviewCheck";
import {
  useExternalRotationReview,
  useExternalRotationReviewsList,
} from "../hooks/useExternalRotationReviews";
import {
  ScreenHeader,
  Filters,
  ConfirmationModal,
  RotationModal,
  RotationReviewModal,
  MyRotationReviewCard,
  RotationMap,
  RotationCard,
  RotationReviewListCard,
  FloatingActionButton,
} from "../components";
import { supabase } from "../config/supabase";
import { Country, City } from "country-state-city";
import RotationReviewDetailScreen from "./RotationReviewDetailScreen";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla de Rotaciones Externas - Refactorizada
 * Permite ver y gestionar rotaciones externas de residentes
 */
export const ExternalRotationsScreen = ({ userProfile, navigation }) => {
  const userId = userProfile?.id;
  const isResident = userProfile?.is_resident;

  // Tab state
  const [activeTab, setActiveTab] = useState("map");
  const [selectedReviewId, setSelectedReviewId] = useState(null);

  // Modals state
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [showRotationDeleteConfirm, setShowRotationDeleteConfirm] =
    useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReviewDeleteConfirm, setShowReviewDeleteConfirm] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);

  // Filters state
  const [specialties, setSpecialties] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedMonthYear, setSelectedMonthYear] = useState("");
  const [selectedMapCountry, setSelectedMapCountry] = useState("");
  const [selectedMapCity, setSelectedMapCity] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("ExternalRotationsScreen");
  }, []);

  // Cargar especialidades
  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        const { data, error } = await supabase
          .from("specialities")
          .select("*")
          .order("name", { ascending: true });

        if (error) {
          console.error("Error fetching specialties:", error);
          return;
        }

        setSpecialties(data || []);
      } catch (error) {
        console.error("Exception fetching specialties:", error);
      }
    };

    fetchSpecialties();
  }, []);

  // Hooks de rotaciones
  const {
    rotations,
    userRotations,
    loading: loadingRotations,
    error: errorRotations,
    success: successRotations,
    createRotation,
    updateRotation,
    deleteRotation,
    clearError: clearRotationError,
    clearSuccess: clearRotationSuccess,
  } = useExternalRotations(userId, selectedSpecialty, selectedMonthYear);

  const existingRotation = userRotations.length > 0 ? userRotations[0] : null;

  // Hooks de reseñas
  const {
    reviews: allReviews,
    loading: loadingReviews,
    error: errorReviews,
    fetchReviews,
  } = useExternalRotationReviewsList(userId, selectedCountry, selectedCity);

  const {
    existingReview,
    questions: reviewQuestions,
    loading: loadingReview,
    loadingQuestions,
    error: errorReview,
    success: successReview,
    checkExisting: checkExistingReview,
    loadQuestions: loadReviewQuestions,
    createReview,
    updateReview: updateReviewData,
    deleteReview: deleteReviewData,
    clearError: clearReviewError,
    clearSuccess: clearReviewSuccess,
  } = useExternalRotationReview(userId, existingRotation?.id);

  // Cargar reseñas cuando se cambia a la tab de reseñas o cuando cambian los filtros
  useEffect(() => {
    if (activeTab === "reviews") {
      fetchReviews();
      if (existingRotation?.id) {
        checkExistingReview();
      }
    }
  }, [activeTab, existingRotation?.id, selectedCountry, selectedCity]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const monthYearOptions = useMemo(() => {
    const months = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const currentYear = new Date().getFullYear();
    const options = [{ value: "", label: "Todos los meses" }];

    for (let year = currentYear; year <= currentYear + 2; year++) {
      for (let month = 0; month < 12; month++) {
        options.push({
          value: `${year}-${String(month + 1).padStart(2, "0")}`,
          label: `${months[month]} ${year}`,
        });
      }
    }
    return options;
  }, []);

  // Opciones de países
  const countryOptions = useMemo(() => {
    try {
      const countries = Country.getAllCountries();
      return countries
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((country) => ({
          id: country.name,
          name: country.name,
        }));
    } catch (error) {
      console.error("Error cargando países:", error);
      return [];
    }
  }, []);

  // Opciones de ciudades del país seleccionado (para reseñas)
  const cityOptions = useMemo(() => {
    if (!selectedCountry) {
      return [];
    }
    try {
      const country = Country.getAllCountries().find(
        (c) => c.name === selectedCountry
      );
      if (!country) {
        return [];
      }
      const cities = City.getCitiesOfCountry(country.isoCode);
      return (cities || [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((city) => ({
          id: city.name,
          name: city.name,
        }));
    } catch (error) {
      console.error("Error cargando ciudades:", error);
      return [];
    }
  }, [selectedCountry]);

  // Opciones de ciudades del país seleccionado (para mapa)
  const mapCityOptions = useMemo(() => {
    if (!selectedMapCountry) {
      return [];
    }
    try {
      const country = Country.getAllCountries().find(
        (c) => c.name === selectedMapCountry
      );
      if (!country) {
        return [];
      }
      const cities = City.getCitiesOfCountry(country.isoCode);
      return (cities || [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((city) => ({
          id: city.name,
          name: city.name,
        }));
    } catch (error) {
      console.error("Error cargando ciudades:", error);
      return [];
    }
  }, [selectedMapCountry]);

  // Configurar los filtros para el componente genérico (tab de mapa)
  const filtersConfig = useMemo(() => {
    const specialtyOptions = specialties
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((specialty) => ({
        id: specialty.id,
        name: specialty.name,
      }));

    return [
      {
        id: "country",
        type: "select",
        label: "Filtrar por país",
        value: selectedMapCountry,
        onSelect: (value) => {
          setSelectedMapCountry(value);
          if (!value) {
            setSelectedMapCity("");
          }
        },
        options: countryOptions,
        placeholder: "Todos los países",
      },
      {
        id: "city",
        type: "select",
        label: "Filtrar por ciudad",
        value: selectedMapCity,
        onSelect: setSelectedMapCity,
        options: mapCityOptions,
        placeholder: selectedMapCountry
          ? "Todas las ciudades"
          : "Primero selecciona un país",
        disabled: !selectedMapCountry,
      },
      {
        id: "specialty",
        type: "select",
        label: "Filtrar por especialidad",
        value: selectedSpecialty,
        onSelect: setSelectedSpecialty,
        options: specialtyOptions,
        placeholder: "Todas las especialidades",
      },
      {
        id: "monthYear",
        type: "select",
        label: "Filtrar por mes/año",
        value: selectedMonthYear,
        onSelect: setSelectedMonthYear,
        options: monthYearOptions.map((opt) => ({
          id: opt.value,
          name: opt.label,
        })),
        placeholder: "Todos los meses",
      },
    ];
  }, [
    specialties,
    selectedSpecialty,
    selectedMonthYear,
    selectedMapCountry,
    selectedMapCity,
    monthYearOptions,
    countryOptions,
    mapCityOptions,
  ]);

  // Calcular región del mapa basada en el país seleccionado
  const mapRegion = useMemo(() => {
    // Si hay rotaciones filtradas, usarlas para calcular la región
    if (rotations.length > 0) {
      const lats = rotations.map((r) => r.latitude);
      const lngs = rotations.map((r) => r.longitude);

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const latDelta = Math.max((maxLat - minLat) * 1.5, 0.5);
      const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.5);

      return {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      };
    }

    // Si hay un país seleccionado pero no hay rotaciones, calcular región del país
    if (selectedMapCountry) {
      try {
        const country = Country.getAllCountries().find(
          (c) => c.name === selectedMapCountry
        );
        if (!country) {
          return null;
        }

        // Obtener ciudades del país para calcular bounds
        const cities = City.getCitiesOfCountry(country.isoCode);
        if (!cities || cities.length === 0) {
          // Si no hay ciudades, usar valores por defecto basados en el tamaño típico del país
          const isLargeCountry = [
            "US",
            "CA",
            "RU",
            "CN",
            "BR",
            "AU",
            "IN",
          ].includes(country.isoCode);
          return {
            latitude: 40.4168,
            longitude: -3.7038,
            latitudeDelta: isLargeCountry ? 15 : 3,
            longitudeDelta: isLargeCountry ? 15 : 3,
          };
        }

        // Calcular bounds de todas las ciudades del país
        const lats = cities
          .map((c) => parseFloat(c.latitude))
          .filter((lat) => !isNaN(lat));
        const lngs = cities
          .map((c) => parseFloat(c.longitude))
          .filter((lng) => !isNaN(lng));

        if (lats.length === 0 || lngs.length === 0) {
          const isLargeCountry = [
            "US",
            "CA",
            "RU",
            "CN",
            "BR",
            "AU",
            "IN",
          ].includes(country.isoCode);
          return {
            latitude: 40.4168,
            longitude: -3.7038,
            latitudeDelta: isLargeCountry ? 15 : 3,
            longitudeDelta: isLargeCountry ? 15 : 3,
          };
        }

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latDelta = Math.max((maxLat - minLat) * 1.5, 1);
        const lngDelta = Math.max((maxLng - minLng) * 1.5, 1);

        return {
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        };
      } catch (error) {
        console.error("Error calculando región del país:", error);
        return null;
      }
    }

    // Si no hay país ni rotaciones, mostrar vista por defecto (España)
    return {
      latitude: 40.4168,
      longitude: -3.7038,
      latitudeDelta: 10,
      longitudeDelta: 10,
    };
  }, [selectedMapCountry, rotations]);

  // Resetear ciudad del mapa cuando cambia el país del mapa
  useEffect(() => {
    if (selectedMapCountry && selectedMapCity) {
      const country = Country.getAllCountries().find(
        (c) => c.name === selectedMapCountry
      );
      if (country) {
        const cities = City.getCitiesOfCountry(country.isoCode);
        const cityExists = cities?.some((c) => c.name === selectedMapCity);
        if (!cityExists) {
          setSelectedMapCity("");
        }
      }
    } else if (!selectedMapCountry) {
      setSelectedMapCity("");
    }
  }, [selectedMapCountry]);

  // Resetear ciudad cuando cambia el país (para reseñas)
  useEffect(() => {
    if (selectedCountry && selectedCity) {
      // Verificar si la ciudad seleccionada pertenece al nuevo país
      const country = Country.getAllCountries().find(
        (c) => c.name === selectedCountry
      );
      if (country) {
        const cities = City.getCitiesOfCountry(country.isoCode);
        const cityExists = cities?.some((c) => c.name === selectedCity);
        if (!cityExists) {
          setSelectedCity("");
        }
      }
    } else if (!selectedCountry) {
      setSelectedCity("");
    }
  }, [selectedCountry]);

  // Verificar si hay filtros activos (tab de mapa)
  const hasActiveFilters = useMemo(() => {
    return !!(
      selectedMapCountry ||
      selectedMapCity ||
      selectedSpecialty ||
      selectedMonthYear
    );
  }, [
    selectedMapCountry,
    selectedMapCity,
    selectedSpecialty,
    selectedMonthYear,
  ]);

  // Verificar si hay filtros activos (tab de reseñas)
  const hasActiveReviewsFilters = useMemo(() => {
    return !!(selectedCountry || selectedCity);
  }, [selectedCountry, selectedCity]);

  const clearFilters = () => {
    setSelectedMapCountry("");
    setSelectedMapCity("");
    setSelectedSpecialty("");
    setSelectedMonthYear("");
  };

  // Configurar los filtros para el componente genérico (tab de reseñas)
  const reviewsFiltersConfig = useMemo(() => {
    return [
      {
        id: "country",
        type: "select",
        label: "Filtrar por país",
        value: selectedCountry,
        onSelect: (value) => {
          setSelectedCountry(value);
          if (!value) {
            setSelectedCity("");
          }
        },
        options: countryOptions,
        placeholder: "Todos los países",
      },
      {
        id: "city",
        type: "select",
        label: "Filtrar por ciudad",
        value: selectedCity,
        onSelect: setSelectedCity,
        options: cityOptions,
        placeholder: selectedCountry
          ? "Todas las ciudades"
          : "Primero selecciona un país",
        disabled: !selectedCountry,
      },
    ];
  }, [selectedCountry, selectedCity, countryOptions, cityOptions]);

  const clearReviewsFilters = () => {
    setSelectedCountry("");
    setSelectedCity("");
  };

  // ============================================================================
  // ROTATION HANDLERS
  // ============================================================================

  const handleOpenRotationModal = () => {
    setShowRotationModal(true);
  };

  const handleSubmitRotation = async (formData, hasEndDate) => {
    // Validaciones
    if (!formData.latitude || !formData.longitude) {
      Alert.alert("Error", "Las coordenadas son obligatorias");
      return;
    }

    if (!formData.start_date) {
      Alert.alert("Error", "La fecha de inicio es obligatoria");
      return;
    }

    const rotationData = {
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      start_date: formData.start_date.toISOString().split("T")[0],
      end_date:
        hasEndDate && formData.end_date
          ? formData.end_date.toISOString().split("T")[0]
          : null,
      country: formData.country || null,
      city: formData.city || null,
    };

    const success = existingRotation
      ? await updateRotation(existingRotation.id, rotationData, formData.phone)
      : await createRotation(rotationData, formData.phone);

    if (success) {
      setShowRotationModal(false);
    }
  };

  const handleDeleteRotation = async () => {
    if (!showRotationDeleteConfirm) return;

    const success = await deleteRotation(showRotationDeleteConfirm);
    if (success) {
      setShowRotationDeleteConfirm(null);
    }
  };

  // ============================================================================
  // REVIEW HANDLERS
  // ============================================================================

  const handleStartReview = () => {
    if (!existingRotation) {
      Alert.alert(
        "Rotación requerida",
        "Primero debes crear tu rotación externa para poder escribir una reseña"
      );
      return;
    }
    loadReviewQuestions();
    setShowReviewModal(true);
    setIsEditingReview(false);
  };

  const handleEditReview = () => {
    loadReviewQuestions();
    setShowReviewModal(true);
    setIsEditingReview(true);
  };

  const handleSubmitReview = async (reviewData) => {
    if (!existingRotation) {
      Alert.alert("Error", "No se encontró la rotación");
      return;
    }

    // Validar campos obligatorios
    if (
      !reviewData.hospitalName.trim() ||
      !reviewData.city.trim() ||
      !reviewData.country.trim()
    ) {
      Alert.alert(
        "Campos obligatorios",
        "Por favor, completa el nombre del hospital, ciudad y país"
      );
      return;
    }

    // Validar preguntas obligatorias
    const unansweredRequired = reviewQuestions.filter((q) => {
      if (q.is_optional) return false;
      const answer = reviewData.answers[q.id];
      if (q.type === "rating") {
        return !answer?.rating;
      } else if (q.type === "text") {
        return !answer?.textValue || answer?.textValue.trim() === "";
      }
      return true;
    });

    if (unansweredRequired.length > 0) {
      Alert.alert(
        "Preguntas obligatorias",
        "Por favor, responde todas las preguntas obligatorias antes de enviar la reseña"
      );
      return;
    }

    // Formatear respuestas
    const formattedAnswers = Object.entries(reviewData.answers)
      .filter(([questionId, answer]) => {
        // Solo incluir respuestas que tengan al menos un valor
        return (
          answer &&
          (answer.rating !== undefined ||
            (answer.textValue && answer.textValue.trim() !== ""))
        );
      })
      .map(([questionId, answer]) => ({
        question_id: String(questionId), // Asegurar que sea string
        rating_value:
          answer.rating !== undefined && answer.rating !== null
            ? Number(answer.rating)
            : null,
        text_value:
          answer.textValue && answer.textValue.trim() !== ""
            ? answer.textValue.trim()
            : null,
      }));

    const reviewPayload = {
      userId,
      rotationId: existingRotation.id,
      externalHospitalName: reviewData.hospitalName.trim(),
      city: reviewData.city.trim(),
      country: reviewData.country.trim(),
      answers: formattedAnswers,
      freeComment: reviewData.freeComment || null,
      isAnonymous: false, // Por defecto no es anónima
    };

    let success = false;
    if (existingReview) {
      success = await updateReviewData(existingReview.id, reviewPayload);
    } else {
      success = await createReview(reviewPayload);
    }

    if (success) {
      setShowReviewModal(false);
      fetchReviews();
      checkExistingReview();
    }
  };

  const handleDeleteReview = async () => {
    if (!existingReview) return;

    const success = await deleteReviewData(existingReview.id);
    if (success) {
      setShowReviewDeleteConfirm(false);
      fetchReviews();
      checkExistingReview();
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderAlerts = () => (
    <>
      {successRotations && (
        <View style={styles.successAlert}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.SUCCESS} />
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertText}>{successRotations}</Text>
          </View>
          <TouchableOpacity onPress={clearRotationSuccess}>
            <Ionicons name="close" size={20} color={COLORS.SUCCESS} />
          </TouchableOpacity>
        </View>
      )}

      {errorRotations && (
        <View style={styles.errorAlert}>
          <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertText}>{errorRotations}</Text>
          </View>
          <TouchableOpacity onPress={clearRotationError}>
            <Ionicons name="close" size={20} color={COLORS.ERROR} />
          </TouchableOpacity>
        </View>
      )}

      {successReview && (
        <View style={styles.successAlert}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.SUCCESS} />
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertText}>{successReview}</Text>
          </View>
          <TouchableOpacity onPress={clearReviewSuccess}>
            <Ionicons name="close" size={20} color={COLORS.SUCCESS} />
          </TouchableOpacity>
        </View>
      )}

      {errorReview && (
        <View style={styles.errorAlert}>
          <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
          <View style={styles.alertTextContainer}>
            <Text style={styles.alertText}>{errorReview}</Text>
          </View>
          <TouchableOpacity onPress={clearReviewError}>
            <Ionicons name="close" size={20} color={COLORS.ERROR} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderMapTab = () => (
    <RotationMap
      rotations={rotations}
      userId={userId}
      loading={loadingRotations}
      region={mapRegion}
    />
  );

  const renderReviewsTab = () => {
    if (loadingReviews) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando reseñas...</Text>
        </View>
      );
    }

    if (errorReviews) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.ERROR} />
          <Text style={styles.errorText}>{errorReviews}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchReviews}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (allReviews.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="document-text-outline"
            size={64}
            color={COLORS.GRAY}
          />
          <Text style={styles.emptyTitle}>Aún no hay reseñas disponibles</Text>
          <Text style={styles.emptySubtitle}>
            Sé el primero en compartir tu experiencia con una rotación externa.
          </Text>
        </View>
      );
    }

    return (
      <>
        {renderAlerts()}

        {/* Listado de reseñas */}
        <View style={styles.reviewsListContainer}>
          {allReviews.map((review) => (
            <RotationReviewListCard
              key={review.id}
              review={review}
              onPress={(review) => setSelectedReviewId(review.id)}
            />
          ))}
        </View>
      </>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Vista para no residentes
  if (!isResident) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Rotaciones Externas"
          subtitle="Funcionalidad para residentes"
          notificationCount={0}
          onNotificationPress={() => {}}
        />
        <View style={styles.messageCard}>
          <View style={styles.iconCircle}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={COLORS.ORANGE}
            />
          </View>
          <Text style={styles.messageTitle}>
            Funcionalidad solo para residentes
          </Text>
          <Text style={styles.messageText}>
            Esta funcionalidad está disponible únicamente para usuarios
            residentes.
          </Text>
        </View>
      </View>
    );
  }

  // Si hay una reseña seleccionada, mostrar la pantalla de detalle
  if (selectedReviewId) {
    return (
      <RotationReviewDetailScreen
        reviewId={selectedReviewId}
        onBack={() => setSelectedReviewId(null)}
        userProfile={userProfile}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Rotaciones Externas"
        subtitle={
          activeTab === "map" ? "Encuentra compañeros en tu destino" : "Reseñas"
        }
        notificationCount={0}
        onNotificationPress={() => {}}
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "map" && styles.activeTab]}
          onPress={() => setActiveTab("map")}
        >
          <Ionicons
            name="map"
            size={20}
            color={activeTab === "map" ? COLORS.PRIMARY : COLORS.GRAY}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "map" && styles.activeTabText,
            ]}
          >
            Futuras Rotaciones
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "reviews" && styles.activeTab]}
          onPress={() => setActiveTab("reviews")}
        >
          <Ionicons
            name="star"
            size={20}
            color={activeTab === "reviews" ? COLORS.PRIMARY : COLORS.GRAY}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "reviews" && styles.activeTabText,
            ]}
          >
            Reseñas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters - Tab de mapa */}
      {activeTab === "map" && (
        <Filters
          filters={filtersConfig}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {/* Filters - Tab de reseñas */}
      {activeTab === "reviews" && (
        <Filters
          filters={reviewsFiltersConfig}
          onClearFilters={clearReviewsFilters}
          hasActiveFilters={hasActiveReviewsFilters}
        />
      )}

      {/* Tab de Futuras Rotaciones - Mapa fuera del ScrollView */}
      {activeTab === "map" ? (
        <View style={styles.mapTabContainer}>
          <View style={styles.mapAlertsContainer}>{renderAlerts()}</View>
          {renderMapTab()}
          {/* Floating Action Button superpuesto al mapa */}
          <FloatingActionButton
            onPress={handleOpenRotationModal}
            icon={existingRotation ? "pencil" : "add"}
            backgroundColor={COLORS.PRIMARY}
            bottom={20}
            right={20}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {renderReviewsTab()}
        </ScrollView>
      )}

      {/* Floating Action Button - Solo en tab de reseñas */}
      {activeTab === "reviews" && (
        <FloatingActionButton
          onPress={existingReview ? handleEditReview : handleStartReview}
          icon={existingReview ? "pencil" : "add"}
          backgroundColor={COLORS.PRIMARY}
          bottom={20}
          right={20}
        />
      )}

      {/* Modals */}
      <RotationModal
        visible={showRotationModal}
        onClose={() => setShowRotationModal(false)}
        onSubmit={handleSubmitRotation}
        existingRotation={existingRotation}
        userPhone={userProfile?.phone}
        loading={loadingRotations}
      />

      <ConfirmationModal
        visible={!!showRotationDeleteConfirm}
        title="Confirmar Eliminación"
        message="¿Estás seguro de que quieres eliminar esta rotación?"
        onConfirm={handleDeleteRotation}
        onCancel={() => setShowRotationDeleteConfirm(null)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      <RotationReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
        existingReview={existingReview}
        existingRotation={existingRotation}
        questions={reviewQuestions}
        loadingQuestions={loadingQuestions}
        loading={loadingReview}
        isEditing={isEditingReview}
      />

      <ConfirmationModal
        visible={showReviewDeleteConfirm}
        title="Eliminar Reseña"
        message="¿Estás seguro de que quieres eliminar esta reseña? Esta acción no se puede deshacer."
        onConfirm={handleDeleteReview}
        onCancel={() => setShowReviewDeleteConfirm(false)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  mapTabContainer: {
    flex: 1,
    position: "relative",
  },
  mapAlertsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: COLORS.PRIMARY,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.GRAY,
  },
  activeTabText: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  loader: {
    marginTop: 32,
  },
  messageCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 32,
    margin: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.ORANGE + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
    textAlign: "center",
  },
  messageText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  successAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SUCCESS + "20",
    borderRadius: 12,
    padding: 12,
    marginTop: 0,
    marginBottom: 8,
    marginHorizontal: 16,
    gap: 12,
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.ERROR + "20",
    borderRadius: 12,
    padding: 12,
    marginTop: 0,
    marginBottom: 8,
    marginHorizontal: 16,
    gap: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
  },
  listContainer: {
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  userRotationsContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoCardText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
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
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    lineHeight: 20,
  },
  reviewsListContainer: {
    // El padding ya está en scrollContent, no duplicar
  },
  goToMapButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  goToMapButtonText: {
    color: COLORS.WHITE,
    fontWeight: "600",
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    marginTop: 12,
  },
});
