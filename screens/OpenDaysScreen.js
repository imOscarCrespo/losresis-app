import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { FilterModal } from "../components/FilterModal";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { usePersistedFilters } from "../hooks/usePersistedFilters";
import {
  getMyOpenDayRegistrations,
  getUpcomingHospitalOpenDays,
  registerForHospitalOpenDay,
} from "../services/hospitalService";
import { formatDateOnly } from "../utils/dateUtils";
import { openURL } from "../utils/courseUtils";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const WHITE = "#FFFFFF";

const DEFAULT_FILTERS = {
  searchTerm: "",
  selectedRegion: "",
  selectedCity: "",
  sortMode: "date",
};

const getDateFromDayString = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getOpenDayParts = (value) => {
  const date = getDateFromDayString(value);
  if (!date) {
    return { day: "—", month: "" };
  }

  return {
    day: date.toLocaleDateString("es-ES", { day: "2-digit" }),
    month: date.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
  };
};

/**
 * Jornadas de puertas abiertas publicadas por los hospitales desde
 * losresis-panel. Solo salen las que aún no se han celebrado, y todas las de un
 * hospital: si publica tres, se ven las tres.
 *
 * Antes esta tarjeta vivía dentro del perfil de hospital al que se entra desde
 * Planes Formativos, donde solo la encontraba quien ya estaba mirando ese
 * hospital. Aquí las jornadas son su propio destino, y desde el detalle de un
 * hospital se entra filtrado por él (`hospitalId`).
 *
 * La lista se lee como la de hospitales — buscador, chips de comunidad / ciudad
 * / orden y una fila por hospital — y la jornada entera (imagen, descripción,
 * inscripción) se abre al pulsar la fila.
 */
export default function OpenDaysScreen({
  hospitalId = null,
  hospitalName = null,
  userProfile,
  onBack,
}) {
  const insets = useSafeAreaInsets();
  const userId = userProfile?.id || null;

  const [openDays, setOpenDays] = useState([]);
  const [registeredIds, setRegisteredIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registeringId, setRegisteringId] = useState(null);
  // El filtro que llega del detalle del hospital se puede quitar sin salir.
  const [filterHospitalId, setFilterHospitalId] = useState(hospitalId);
  // La jornada abierta en detalle. Se guarda el id y no la fila para que un
  // refresco mientras está abierta no deje datos viejos en pantalla.
  const [selectedOpenDayId, setSelectedOpenDayId] = useState(null);
  const [openModal, setOpenModal] = useState(null);

  const isMountedRef = useRef(true);

  const { filters, updateFilter, clearAllFilters } = usePersistedFilters(
    "openDays",
    DEFAULT_FILTERS,
    { enableDebounce: true, debounceMs: 500 }
  );

  const searchTerm = filters.searchTerm || "";
  const selectedRegion = filters.selectedRegion || "";
  const selectedCity = filters.selectedCity || "";
  const sortMode = filters.sortMode || "date";

  const setSearchTerm = useCallback(
    (value) => updateFilter("searchTerm", value),
    [updateFilter]
  );
  const setSelectedRegion = useCallback(
    (value) => updateFilter("selectedRegion", value),
    [updateFilter]
  );
  const setSelectedCity = useCallback(
    (value) => updateFilter("selectedCity", value),
    [updateFilter]
  );
  const setSortMode = useCallback(
    (value) => updateFilter("sortMode", value),
    [updateFilter]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setFilterHospitalId(hospitalId);
  }, [hospitalId]);

  // `isActive` descarta el resultado de una carga que ya no interesa: se ha
  // vuelto atrás y la pantalla está desmontada, o el usuario ha cambiado
  // mientras llegaba la respuesta.
  const fetchOpenDays = useCallback(
    async (isActive = () => isMountedRef.current) => {
      try {
        const [openDaysResult, registrationsResult] = await Promise.all([
          getUpcomingHospitalOpenDays(),
          getMyOpenDayRegistrations(userId),
        ]);

        if (!openDaysResult.success) {
          console.error("Error loading open days:", openDaysResult.error);
        }
        if (!registrationsResult.success) {
          console.error(
            "Error loading my open day registrations:",
            registrationsResult.error
          );
        }

        if (!isActive()) return;

        setOpenDays(openDaysResult.success ? openDaysResult.openDays : []);
        setRegisteredIds(new Set(registrationsResult.openDayIds || []));
      } catch (error) {
        console.error("Exception fetching open days:", error);
        if (!isActive()) return;
        setOpenDays([]);
        setRegisteredIds(new Set());
      }
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;
    const isActive = () => !cancelled && isMountedRef.current;

    const load = async () => {
      setLoading(true);
      await fetchOpenDays(isActive);
      if (isActive()) {
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [fetchOpenDays]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOpenDays();
    if (isMountedRef.current) {
      setRefreshing(false);
    }
  }, [fetchOpenDays]);

  // Las jornadas del hospital de origen, antes de aplicar buscador y chips: de
  // aquí salen las opciones de comunidad y ciudad, para no ofrecer un filtro
  // que dejaría la lista vacía.
  const scopedOpenDays = useMemo(
    () =>
      filterHospitalId
        ? openDays.filter((openDay) => openDay.hospital_id === filterHospitalId)
        : openDays,
    [openDays, filterHospitalId]
  );

  const regionOptions = useMemo(
    () =>
      [...new Set(scopedOpenDays.map((o) => o.hospital_region).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((region) => ({ id: region, name: region })),
    [scopedOpenDays]
  );

  const cityOptions = useMemo(() => {
    const source = selectedRegion
      ? scopedOpenDays.filter((o) => o.hospital_region === selectedRegion)
      : scopedOpenDays;

    return [...new Set(source.map((o) => o.hospital_city).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((city) => ({ id: city, name: city }));
  }, [scopedOpenDays, selectedRegion]);

  const sortOptions = useMemo(
    () => [
      { id: "date", name: "Fecha" },
      { id: "alphabetical", name: "Alfabético" },
    ],
    []
  );

  const selectedSortName = useMemo(
    () => sortOptions.find((option) => option.id === sortMode)?.name ?? "Fecha",
    [sortMode, sortOptions]
  );

  // Cambiar de comunidad puede dejar seleccionada una ciudad que ya no está en
  // ella; ahí el filtro de ciudad se cae solo en vez de vaciar la lista.
  useEffect(() => {
    if (!selectedRegion || !selectedCity || scopedOpenDays.length === 0) return;

    const stillAvailable = cityOptions.some(
      (option) => option.id === selectedCity
    );
    if (!stillAvailable) {
      setSelectedCity("");
    }
  }, [
    selectedRegion,
    selectedCity,
    cityOptions,
    scopedOpenDays.length,
    setSelectedCity,
  ]);

  const visibleOpenDays = useMemo(() => {
    // Entrando desde un hospital la lista ya es "sus jornadas": aplicar encima
    // el buscador y los chips guardados de la última visita la dejaría vacía
    // sin que se entienda por qué. Los filtros vuelven al quitar el chip.
    if (filterHospitalId) return scopedOpenDays;

    const search = searchTerm.trim().toLowerCase();

    const filtered = scopedOpenDays.filter((openDay) => {
      const matchesSearch =
        !search || (openDay.hospital_name || "").toLowerCase().includes(search);
      const matchesRegion =
        !selectedRegion || openDay.hospital_region === selectedRegion;
      const matchesCity =
        !selectedCity ||
        (openDay.hospital_city || "").toLowerCase() ===
          selectedCity.toLowerCase();

      return matchesSearch && matchesRegion && matchesCity;
    });

    if (sortMode === "alphabetical") {
      return [...filtered].sort((a, b) =>
        (a.hospital_name || "").localeCompare(b.hospital_name || "", "es")
      );
    }

    // Por fecha ya vienen ordenadas de la query (evento más próximo primero).
    return filtered;
  }, [
    scopedOpenDays,
    filterHospitalId,
    searchTerm,
    selectedRegion,
    selectedCity,
    sortMode,
  ]);

  const hasActiveFilters = Boolean(
    !filterHospitalId &&
      (searchTerm || selectedRegion || selectedCity || sortMode !== "date")
  );
  const openDayCountLabel = `${visibleOpenDays.length} ${
    visibleOpenDays.length === 1 ? "jornada" : "jornadas"
  }`;

  const selectedOpenDay = useMemo(
    () => openDays.find((openDay) => openDay.id === selectedOpenDayId) || null,
    [openDays, selectedOpenDayId]
  );

  // Si la jornada abierta se despublica y desaparece en un refresco, se vuelve
  // a la lista en vez de quedarse en un detalle vacío.
  useEffect(() => {
    if (selectedOpenDayId && !selectedOpenDay) {
      setSelectedOpenDayId(null);
    }
  }, [selectedOpenDayId, selectedOpenDay]);

  useEffect(() => {
    if (loading) return;
    posthogLogger.logScreen("OpenDaysScreen", {
      jornadaCount: openDays.length,
      hospitalFilter: filterHospitalId || null,
    });
  }, [loading, openDays.length, filterHospitalId]);

  const handleRegistration = async (openDay) => {
    if (!openDay?.id || registeredIds.has(openDay.id)) return;

    if (!userId) {
      Alert.alert(
        "Inicia sesión",
        "Necesitas haber iniciado sesión para inscribirte a una jornada de puertas abiertas."
      );
      return;
    }

    setRegisteringId(openDay.id);
    try {
      const { success, error } = await registerForHospitalOpenDay(
        openDay.id,
        userId
      );

      if (!success) {
        Alert.alert(
          "Error",
          error || "No se pudo completar la inscripción a la jornada."
        );
        return;
      }

      setRegisteredIds((current) => new Set(current).add(openDay.id));
      posthogLogger.capture("hospital_open_day_registered", {
        open_day_id: openDay.id,
        hospital_id: openDay.hospital_id,
        source: "open_days_screen",
      });
      Alert.alert("Inscripción completada", "Tu plaza ha quedado registrada.");
    } catch (error) {
      console.error("Exception registering for open day:", error);
      Alert.alert("Error", "No se pudo completar la inscripción a la jornada.");
    } finally {
      setRegisteringId(null);
    }
  };

  const handleOpenDayUrl = (openDay) => {
    if (!openDay?.cta_url) return;

    openURL(openDay.cta_url, () => {
      Alert.alert("Error", "No se pudo abrir la jornada.");
    });
  };

  // Fila de la lista: solo el hospital, como en el listado de hospitales. Todo
  // lo demás de la jornada está a un toque, en el detalle.
  const renderOpenDayItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => setSelectedOpenDayId(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Ver la jornada de ${item.hospital_name}`}
    >
      <View style={styles.cardInner}>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.hospital_name}
        </Text>
        <Icon name="arrow-forward" size={20} color={PRIMARY} />
      </View>
    </TouchableOpacity>
  );

  // Con filtro activo el nombre sale del hospital de origen y no de la lista:
  // si su jornada se despublica entre pantallas, el chip sigue explicando qué
  // se está filtrando en vez de quedarse vacío.
  const filterLabel = filterHospitalId
    ? hospitalName ||
      openDays.find((openDay) => openDay.hospital_id === filterHospitalId)
        ?.hospital_name ||
      "Hospital"
    : null;

  const renderListHeader = () => (
    <View>
      {filterHospitalId ? (
        <View style={styles.hospitalFilterRow}>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText} numberOfLines={1}>
              {filterLabel}
            </Text>
            <TouchableOpacity
              onPress={() => setFilterHospitalId(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Quitar el filtro de hospital"
            >
              <Icon name="close" size={14} color={PRIMARY} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setFilterHospitalId(null)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.filterClearText}>Ver todas</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>
          {hasActiveFilters ? openDayCountLabel : "Jornadas"}
        </Text>
        {hasActiveFilters ? (
          <TouchableOpacity
            style={styles.sectionAction}
            onPress={clearAllFilters}
            activeOpacity={0.75}
          >
            <Text style={styles.sectionActionText}>Restablecer filtros</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.sectionCount}>{openDayCountLabel}</Text>
        )}
      </View>
    </View>
  );

  const renderDetail = (openDay) => {
    const dateParts = getOpenDayParts(openDay.event_date);
    const isRegistered = registeredIds.has(openDay.id);
    const isRegistering = registeringId === openDay.id;
    const hasExternalUrl = Boolean(openDay.cta_url);
    const urlLabel = openDay.cta_label?.trim() || "Ver jornada";
    const location = [openDay.hospital_city, openDay.hospital_region]
      .filter(Boolean)
      .join(", ");

    return (
      <HeroScreenLayout
        title="Jornada"
        onBack={() => setSelectedOpenDayId(null)}
        containerStyle={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.detailContent,
            { paddingBottom: 24 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.openDayHero}>
            <View style={styles.openDayGlowLarge} />
            <View style={styles.openDayGlowSmall} />
            <View style={styles.openDayContent}>
              {openDay.image_public_url ? (
                <Image
                  source={{ uri: openDay.image_public_url }}
                  style={styles.openDayImage}
                  resizeMode="cover"
                />
              ) : null}

              <View style={styles.openDayBadge}>
                <Icon name="calendar-outline" size={14} color={WHITE} />
                <Text style={styles.openDayBadgeText}>Próximo evento</Text>
              </View>

              <View style={styles.openDayTextBlock}>
                <Text style={styles.openDayHospital} numberOfLines={2}>
                  {openDay.hospital_name}
                </Text>
                {location ? (
                  <Text style={styles.openDayLocation}>{location}</Text>
                ) : null}
                <Text style={styles.openDayTitle}>{openDay.title}</Text>
                {openDay.description ? (
                  <Text style={styles.openDayDescription}>
                    {openDay.description}
                  </Text>
                ) : null}
                <Text style={styles.openDayFullDate}>
                  {formatDateOnly(openDay.event_date)}
                </Text>
              </View>

              <View style={styles.openDayFooter}>
                <View style={styles.openDayDateCard}>
                  <Text style={styles.openDayDateDay}>{dateParts.day}</Text>
                  <Text style={styles.openDayDateMonth}>{dateParts.month}</Text>
                </View>

                <View style={styles.openDayActions}>
                  <TouchableOpacity
                    style={[
                      styles.openDayCta,
                      isRegistered && styles.openDayCtaRegistered,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => handleRegistration(openDay)}
                    disabled={isRegistering || isRegistered}
                  >
                    {isRegistering ? (
                      <ActivityIndicator size="small" color={PRIMARY} />
                    ) : (
                      <Text style={styles.openDayCtaText}>
                        {isRegistered ? "Inscrito" : "Inscribirme"}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {hasExternalUrl ? (
                    <TouchableOpacity
                      style={styles.openDaySecondaryCta}
                      activeOpacity={0.85}
                      onPress={() => handleOpenDayUrl(openDay)}
                    >
                      <Text style={styles.openDaySecondaryCtaText}>
                        {urlLabel}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </HeroScreenLayout>
    );
  };

  if (selectedOpenDay) {
    return renderDetail(selectedOpenDay);
  }

  return (
    <HeroScreenLayout
      title="Jornadas"
      onBack={onBack}
      containerStyle={styles.container}
    >
      {/* Search bar */}
      {filterHospitalId ? null : (
        <>
        <View style={styles.searchWrap}>
          <Icon
            name="search"
            size={20}
            color="#94A3B8"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar hospital por nombre"
            placeholderTextColor="#94A3B8"
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <Icon name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersRow}
        >
          <TouchableOpacity
            style={[styles.chip, selectedRegion && styles.chipActive]}
            onPress={() => setOpenModal("region")}
          >
            <Icon name="map" size={16} color={selectedRegion ? PRIMARY : ACCENT} />
            <Text
              style={[styles.chipText, selectedRegion && styles.chipTextActive]}
              numberOfLines={1}
            >
              {selectedRegion || "Comunidad"}
            </Text>
            <Icon
              name="chevron-down"
              size={16}
              color={selectedRegion ? PRIMARY : ACCENT}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, selectedCity && styles.chipActive]}
            onPress={() => setOpenModal("city")}
          >
            <Icon
              name="business"
              size={16}
              color={selectedCity ? PRIMARY : ACCENT}
            />
            <Text
              style={[styles.chipText, selectedCity && styles.chipTextActive]}
              numberOfLines={1}
            >
              {selectedCity || "Ciudad"}
            </Text>
            <Icon
              name="chevron-down"
              size={16}
              color={selectedCity ? PRIMARY : ACCENT}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, sortMode !== "date" && styles.chipActive]}
            onPress={() => setOpenModal("sort")}
          >
            <Icon
              name="swap-vertical"
              size={16}
              color={sortMode !== "date" ? PRIMARY : ACCENT}
            />
            <Text
              style={[
                styles.chipText,
                sortMode !== "date" && styles.chipTextActive,
              ]}
              numberOfLines={1}
            >
              {selectedSortName}
            </Text>
            <Icon
              name="chevron-down"
              size={16}
              color={sortMode !== "date" ? PRIMARY : ACCENT}
            />
          </TouchableOpacity>
        </ScrollView>
        </>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando jornadas...</Text>
        </View>
      ) : (
        <FlatList
          data={visibleOpenDays}
          renderItem={renderOpenDayItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 24 + insets.bottom },
          ]}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="calendar-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? "No hay jornadas con estos filtros."
                  : filterHospitalId
                    ? "Este hospital no tiene jornadas de puertas abiertas pendientes."
                    : "Todavía no hay jornadas de puertas abiertas publicadas."}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity
                  onPress={clearAllFilters}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text style={styles.filterClearText}>
                    Restablecer filtros
                  </Text>
                </TouchableOpacity>
              ) : filterHospitalId ? (
                <TouchableOpacity
                  onPress={() => setFilterHospitalId(null)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text style={styles.filterClearText}>
                    Ver todas las jornadas
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* Filter modals */}
      <FilterModal
        visible={openModal === "region"}
        onClose={() => setOpenModal(null)}
        title="Filtrar por comunidad autónoma"
        options={regionOptions}
        value={selectedRegion}
        onSelect={setSelectedRegion}
        placeholder="Todas las comunidades"
      />
      <FilterModal
        visible={openModal === "city"}
        onClose={() => setOpenModal(null)}
        title="Filtrar por ciudad"
        options={cityOptions}
        value={selectedCity}
        onSelect={setSelectedCity}
        placeholder="Todas las ciudades"
      />
      <FilterModal
        visible={openModal === "sort"}
        onClose={() => setOpenModal(null)}
        title="Ordenar jornadas"
        options={sortOptions}
        value={sortMode}
        onSelect={setSortMode}
        placeholder="Fecha"
      />
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },

  /* Search */
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 12,
    paddingLeft: 44,
    paddingRight: 16,
    position: "relative",
    marginBottom: 4,
  },
  searchIcon: {
    position: "absolute",
    left: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ACCENT,
    padding: 0,
  },

  /* Filter chips */
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 8,
    marginBottom: 4,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingRight: 24,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipActive: {
    backgroundColor: `${PRIMARY}12`,
    borderColor: `${PRIMARY}30`,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT,
    flexShrink: 1,
    maxWidth: 110,
  },
  chipTextActive: {
    color: PRIMARY,
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    flexGrow: 1,
  },
  hospitalFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 4,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 8,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionAction: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}10`,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    backgroundColor: `${PRIMARY}0F`,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
    flexShrink: 1,
  },
  filterClearText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },

  /* Fila de jornada */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 22,
    flex: 1,
  },

  /* Detalle de la jornada */
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  openDayHero: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: PRIMARY,
    padding: 22,
    position: "relative",
  },
  openDayGlowLarge: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    top: -60,
    right: -50,
  },
  openDayGlowSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    bottom: -30,
    right: 24,
  },
  openDayContent: { gap: 16 },
  // La imagen que sube el hospital desde el panel. Va dentro del hero, encima
  // del badge: es lo primero que se ve de la jornada.
  openDayImage: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  openDayBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  openDayBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  openDayTextBlock: { gap: 6 },
  // En una lista nacional el hospital es lo que sitúa la jornada, así que va
  // antes del título y no escondido en el cuerpo.
  openDayHospital: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  openDayLocation: {
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    marginTop: -2,
  },
  openDayTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: WHITE },
  openDayDescription: { fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.88)" },
  openDayFullDate: { fontSize: 12, color: "rgba(255,255,255,0.82)", fontWeight: "600", marginTop: 2 },
  openDayFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  openDayActions: {
    flex: 1,
    gap: 10,
  },
  openDayDateCard: {
    minWidth: 84,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  openDayDateDay: { fontSize: 24, fontWeight: "800", color: WHITE, lineHeight: 28 },
  openDayDateMonth: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.76)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  openDayCta: {
    backgroundColor: WHITE,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  openDayCtaRegistered: { backgroundColor: "rgba(255,255,255,0.92)" },
  openDayCtaText: { fontSize: 15, fontWeight: "700", color: PRIMARY },
  openDaySecondaryCta: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  openDaySecondaryCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: WHITE,
  },

  /* Loading / Empty */
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#64748B",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 21,
  },
});
