import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCommunityUsers } from "../hooks/useCommunityUsers";
import { useCities } from "../hooks/useCities";
import { usePersistedFilters } from "../hooks/usePersistedFilters";
import { useUnreadNotificationsCount } from "../src/hooks/useUnreadNotificationsCount";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const CARD_BORDER = "#F1F5F9";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";
const DANGER = "#EF4444";
const INFO = "#2563EB";

let MapView = null;
let Marker = null;
let Callout = null;
let PROVIDER_DEFAULT = null;
let MAP_AVAILABLE = false;
let CLUSTERING_AVAILABLE = false;

try {
  try {
    const ClusteredMapView = require("react-native-map-clustering").default;
    MapView = ClusteredMapView;
    CLUSTERING_AVAILABLE = true;
  } catch (clusterError) {
    const MapModule = require("react-native-maps");
    MapView = MapModule.default;
  }

  const MapModule = require("react-native-maps");
  Marker = MapModule.Marker;
  Callout = MapModule.Callout;
  PROVIDER_DEFAULT = MapModule.PROVIDER_DEFAULT;
  MAP_AVAILABLE = true;
} catch (error) {
  console.log("⚠️ MapView no disponible - usando vista de lista.", error.message);
  MAP_AVAILABLE = false;
}

function RadioDot({ selected }) {
  return (
    <View
      style={[
        modal.radioDot,
        selected ? modal.radioDotSelected : modal.radioDotUnselected,
      ]}
    >
      {selected ? <View style={modal.radioDotInner} /> : null}
    </View>
  );
}

function FilterModal({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  placeholder,
}) {
  const insets = useSafeAreaInsets();
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setTempValue(value);
    }
  }, [value, visible]);

  const listData = useMemo(() => {
    const data = [];
    if (value) {
      data.push({ id: "", name: placeholder });
    }
    data.push(...options);
    return data;
  }, [options, placeholder, value]);

  const handleConfirm = useCallback(() => {
    onSelect(tempValue);
    onClose();
  }, [onClose, onSelect, tempValue]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modal.container}>
        <View style={[modal.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={modal.backBtn} onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={modal.title}>{title}</Text>
          <View style={modal.backBtn} />
        </View>

        <ScrollView contentContainerStyle={modal.listContent}>
          {listData.map((item, index) => {
            const isClear = item.id === "";
            const isSelected = !isClear && item.id === tempValue;

            return (
              <Pressable
                key={`${String(item.id ?? "")}-${index}`}
                style={({ pressed }) => [
                  modal.option,
                  isSelected && modal.optionSelected,
                  isClear && modal.optionClear,
                  pressed && { opacity: 0.78 },
                ]}
                onPress={() => setTempValue(isClear ? "" : item.id)}
              >
                <Text
                  style={[
                    modal.optionName,
                    isSelected && modal.optionNameSelected,
                    isClear && modal.optionNameClear,
                  ]}
                >
                  {item.name}
                </Text>
                {isClear ? null : <RadioDot selected={isSelected} />}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[modal.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={modal.confirmBtn} onPress={handleConfirm}>
            <Text style={modal.confirmText}>Confirmar selección</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ResidentCard({ user }) {
  return (
    <View style={styles.userCard}>
      <View style={styles.userAvatar}>
        <Ionicons name="person-outline" size={22} color={PRIMARY} />
      </View>
      <View style={styles.userCardBody}>
        <Text style={styles.userName}>
          {user.name} {user.surname}
        </Text>

        <View style={styles.userMetaList}>
          {user.specialty_name ? (
            <View style={styles.userMetaRow}>
              <Ionicons name="medkit-outline" size={15} color={PRIMARY} />
              <Text style={styles.userMetaText}>{user.specialty_name}</Text>
            </View>
          ) : null}

          <View style={styles.userMetaRow}>
            <Ionicons name="location-outline" size={15} color={MUTED_LIGHT} />
            <Text style={styles.userMetaText}>{user.city}</Text>
          </View>

          {user.work_email ? (
            <View style={styles.userMetaRow}>
              <Ionicons name="mail-outline" size={15} color={INFO} />
              <Text style={styles.userMetaText}>{user.work_email}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function ComunityScreen({
  userProfile,
  navigation,
  residentReviewGateStatus = "soft",
}) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [openModal, setOpenModal] = useState(null);
  const [viewMode, setViewMode] = useState(MAP_AVAILABLE ? "map" : "list");
  const {
    filters,
    isLoading: filtersLoading,
    updateFilter,
    clearAllFilters: clearPersistedFilters,
  } = usePersistedFilters(
    "community",
    {
      selectedCity: "",
      selectedSpecialty: "",
    },
    { enableDebounce: true, debounceMs: 500 }
  );
  const selectedCity = filters.selectedCity || "";
  const selectedSpecialty = filters.selectedSpecialty || "";
  const setSelectedCity = useCallback(
    (value) => updateFilter("selectedCity", value),
    [updateFilter]
  );
  const setSelectedSpecialty = useCallback(
    (value) => updateFilter("selectedSpecialty", value),
    [updateFilter]
  );

  const { count: notificationCount } = useUnreadNotificationsCount(
    userProfile?.id
  );
  const { cityOptions } = useCities();
  const {
    users,
    specialties,
    loading: usersLoading,
    error: usersError,
    mapRegion,
  } = useCommunityUsers(selectedCity, selectedSpecialty, !filtersLoading);
  useEffect(() => {
    posthogLogger.logScreen("ComunityScreen");
  }, []);

  useEffect(() => {
    if (mapRef.current && users.length > 0 && viewMode === "map") {
      const timeout = setTimeout(() => {
        mapRef.current?.animateToRegion?.(mapRegion, 800);
      }, 120);

      return () => clearTimeout(timeout);
    }
  }, [mapRegion, users, viewMode]);

  const shouldShowReviewPrompt =
    userProfile?.is_resident &&
    !userProfile?.is_super_admin &&
    residentReviewGateStatus === "hard";

  const specialtyOptions = useMemo(
    () =>
      specialties.map((specialty) => ({
        id: specialty.id,
        name: specialty.name,
      })),
    [specialties]
  );

  const selectedCityName = useMemo(
    () => cityOptions.find((option) => option.id === selectedCity)?.name,
    [cityOptions, selectedCity]
  );
  const selectedSpecialtyName = useMemo(
    () => specialtyOptions.find((option) => option.id === selectedSpecialty)?.name,
    [selectedSpecialty, specialtyOptions]
  );

  const hasActiveFilters = Boolean(selectedCity || selectedSpecialty);
  const isLoadingAccess = filtersLoading || usersLoading;

  const cityCount = useMemo(() => new Set(users.map((user) => user.city)).size, [users]);

  const clearFilters = useCallback(() => {
    clearPersistedFilters();
  }, [clearPersistedFilters]);

  const renderMarker = useCallback(
    (user) => {
      if (!MAP_AVAILABLE || !Marker) return null;

      return (
        <Marker
          key={user.id}
          coordinate={{
            latitude: user.latitude,
            longitude: user.longitude,
          }}
          pinColor={PRIMARY}
        >
          {Callout ? (
            <Callout tooltip={false}>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutName}>
                  {user.name} {user.surname}
                </Text>
                {user.specialty_name ? (
                  <View style={styles.calloutRow}>
                    <Text style={styles.calloutLabel}>Especialidad</Text>
                    <Text style={styles.calloutValue}>{user.specialty_name}</Text>
                  </View>
                ) : null}
                {user.work_email ? (
                  <View style={styles.calloutRow}>
                    <Text style={styles.calloutLabel}>Email</Text>
                    <Text style={styles.calloutValue}>{user.work_email}</Text>
                  </View>
                ) : null}
                <View style={styles.calloutRow}>
                  <Text style={styles.calloutLabel}>Ciudad</Text>
                  <Text style={styles.calloutValue}>{user.city}</Text>
                </View>
              </View>
            </Callout>
          ) : null}
        </Marker>
      );
    },
    []
  );

  const mapProps = CLUSTERING_AVAILABLE
    ? {
        clusterColor: PRIMARY,
        clusterTextColor: "#FFFFFF",
        clusterFontFamily: "System",
        radius: 80,
        maxZoom: 18,
        minZoom: 3,
        extent: 512,
        nodeSize: 64,
        spiralEnabled: true,
        superClusterOptions: {
          radius: 80,
          maxZoom: 18,
          minZoom: 3,
          minPoints: 2,
        },
        renderCluster: (cluster) => {
          const { coordinate, pointCount, clusterId } = cluster;

          return (
            <Marker
              key={`cluster-${clusterId}`}
              coordinate={coordinate}
              onPress={() => {
                mapRef.current?.animateToRegion?.(
                  {
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude,
                    latitudeDelta: 0.5,
                    longitudeDelta: 0.5,
                  },
                  300
                );
              }}
            >
              <View style={styles.clusterContainer}>
                <View
                  style={[
                    styles.clusterBubble,
                    pointCount >= 10 && styles.clusterBubbleLarge,
                    pointCount >= 20 && styles.clusterBubbleXLarge,
                  ]}
                >
                  <Text style={styles.clusterText}>{pointCount}</Text>
                </View>
                <View style={styles.clusterHint}>
                  <Ionicons name="search" size={10} color={PRIMARY} />
                  <Text style={styles.clusterHintText}>Haz zoom</Text>
                </View>
              </View>
              {Callout ? (
                <Callout tooltip={false}>
                  <View style={styles.clusterCallout}>
                    <Text style={styles.clusterCalloutTitle}>
                      {pointCount} residentes en esta zona
                    </Text>
                    <Text style={styles.clusterCalloutText}>
                      Haz zoom para ver cada perfil
                    </Text>
                  </View>
                </Callout>
              ) : null}
            </Marker>
          );
        },
      }
    : {};

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.screenTitle}>Comunidad</Text>
            <Text style={styles.screenSubtitle}>
              Mapa de residentes activos para localizar compañeros por ciudad y especialidad.
            </Text>
          </View>

          <View style={styles.heroActions}>
            {MAP_AVAILABLE ? (
              <TouchableOpacity
                style={styles.modeButton}
                onPress={() => setViewMode(viewMode === "map" ? "list" : "map")}
              >
                <Ionicons
                  name={viewMode === "map" ? "list-outline" : "map-outline"}
                  size={18}
                  color={PRIMARY}
                />
                <Text style={styles.modeButtonText}>
                  {viewMode === "map" ? "Lista" : "Mapa"}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation?.navigate?.("notifications")}
            >
              <Ionicons name="notifications-outline" size={22} color={ACCENT} />
              {notificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{users.length}</Text>
            <Text style={styles.metricLabel}>residentes visibles</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{cityCount}</Text>
            <Text style={styles.metricLabel}>ciudades activas</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {selectedSpecialty ? "1" : specialtyOptions.length}
            </Text>
            <Text style={styles.metricLabel}>especialidades</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        <TouchableOpacity
          style={[styles.chip, selectedCity && styles.chipActive]}
          onPress={() => setOpenModal("city")}
        >
          <Ionicons
            name="location-outline"
            size={16}
            color={selectedCity ? PRIMARY : ACCENT}
          />
          <Text style={[styles.chipText, selectedCity && styles.chipTextActive]}>
            {selectedCityName || "Ciudad"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedCity ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedSpecialty && styles.chipActive]}
          onPress={() => setOpenModal("specialty")}
        >
          <Ionicons
            name="medkit-outline"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
          <Text
            style={[styles.chipText, selectedSpecialty && styles.chipTextActive]}
            numberOfLines={1}
          >
            {selectedSpecialtyName || "Especialidad"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        {hasActiveFilters ? (
          <TouchableOpacity style={styles.chipClear} onPress={clearFilters}>
            <Ionicons name="close-circle" size={16} color={DANGER} />
            <Text style={styles.chipClearText}>Limpiar</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {usersError ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={20} color={DANGER} />
          <Text style={styles.errorText}>{usersError}</Text>
        </View>
      ) : null}

      <View style={styles.stage}>
        <View style={styles.stageHeader}>
          <Text style={styles.stageTitle}>
            {viewMode === "map" ? "Mapa de residentes" : "Directorio de residentes"}
          </Text>
          <Text style={styles.stageSubtitle}>
            {MAP_AVAILABLE
              ? viewMode === "map"
                ? "Explora agrupaciones por zona y haz zoom para ver cada perfil."
                : "Vista alternativa en formato lista."
              : "Mapa no disponible en este build. Se muestra la lista como fallback."}
          </Text>
        </View>

        <View style={styles.stageBody}>
          {MAP_AVAILABLE && viewMode === "map" ? (
            <MapView
              ref={mapRef}
              style={[styles.map, shouldShowReviewPrompt && styles.mapBlurred]}
              provider={PROVIDER_DEFAULT}
              initialRegion={{
                latitude: 40.4168,
                longitude: -3.7038,
                latitudeDelta: 10,
                longitudeDelta: 10,
              }}
              showsUserLocation={false}
              showsMyLocationButton={false}
              zoomEnabled={!shouldShowReviewPrompt}
              scrollEnabled={!shouldShowReviewPrompt}
              pitchEnabled={false}
              rotateEnabled={false}
              {...mapProps}
            >
              {!shouldShowReviewPrompt ? users.map((user) => renderMarker(user)) : null}
            </MapView>
          ) : (
            <FlatList
              data={shouldShowReviewPrompt ? [] : users}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => <ResidentCard user={item} />}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                !MAP_AVAILABLE ? (
                  <View style={styles.infoCard}>
                    <Ionicons name="information-circle-outline" size={18} color={INFO} />
                    <Text style={styles.infoCardText}>
                      El mapa requiere un build nativo actualizado. Mientras tanto se muestra el directorio.
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !isLoadingAccess && !shouldShowReviewPrompt ? (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconWrap}>
                      <Ionicons name="people-outline" size={34} color={PRIMARY} />
                    </View>
                    <Text style={styles.emptyTitle}>No se encontraron residentes</Text>
                    <Text style={styles.emptyText}>
                      Ajusta ciudad o especialidad para ampliar los resultados.
                    </Text>
                  </View>
                ) : null
              }
            />
          )}

          {MAP_AVAILABLE &&
          viewMode === "map" &&
          !isLoadingAccess &&
          !shouldShowReviewPrompt &&
          users.length === 0 ? (
            <View style={styles.emptyMapOverlay}>
              <View style={styles.emptyMapCard}>
                <Ionicons name="people-outline" size={28} color={PRIMARY} />
                <Text style={styles.emptyMapTitle}>Sin resultados en el mapa</Text>
                <Text style={styles.emptyMapText}>
                  No hay residentes que coincidan con los filtros actuales.
                </Text>
              </View>
            </View>
          ) : null}

          {shouldShowReviewPrompt ? (
            <View style={styles.reviewPromptOverlay}>
              <View style={styles.reviewPromptCard}>
                <View style={styles.reviewPromptIcon}>
                  <Ionicons name="map-outline" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.reviewPromptTitle}>Desbloquea la comunidad</Text>
                <Text style={styles.reviewPromptText}>
                  Para ver el mapa y localizar a otros residentes, comparte antes tu experiencia con una reseña.
                </Text>
                <TouchableOpacity
                  style={styles.reviewPromptButton}
                  onPress={() => navigation?.navigate?.("myReview")}
                >
                  <Ionicons name="heart-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.reviewPromptButtonText}>
                    Compartir mi experiencia
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {isLoadingAccess ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.loadingText}>
                Cargando residentes...
              </Text>
            </View>
          ) : null}
        </View>
      </View>

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
        visible={openModal === "specialty"}
        onClose={() => setOpenModal(null)}
        title="Filtrar por especialidad"
        options={specialtyOptions}
        value={selectedSpecialty}
        onSelect={setSelectedSpecialty}
        placeholder="Todas las especialidades"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroCopy: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
    maxWidth: 260,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DANGER,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "700",
    color: PRIMARY,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    color: MUTED,
    lineHeight: 16,
  },
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 8,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingRight: 24,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipActive: {
    backgroundColor: `${PRIMARY}12`,
    borderColor: `${PRIMARY}28`,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT,
    maxWidth: 130,
  },
  chipTextActive: {
    color: PRIMARY,
  },
  chipClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  chipClearText: {
    fontSize: 13,
    fontWeight: "700",
    color: DANGER,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  errorText: {
    flex: 1,
    color: DANGER,
    fontSize: 14,
    lineHeight: 20,
  },
  stage: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    minHeight: 0,
  },
  stageHeader: {
    marginBottom: 10,
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  stageSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  stageBody: {
    flex: 1,
    minHeight: 0,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapBlurred: {
    opacity: 0.28,
  },
  listContent: {
    padding: 14,
    paddingBottom: 28,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 12,
    marginBottom: 12,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    color: "#1D4ED8",
    lineHeight: 19,
  },
  userCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 14,
    marginBottom: 10,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${PRIMARY}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  userCardBody: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
  },
  userMetaList: {
    gap: 8,
    marginTop: 10,
  },
  userMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userMetaText: {
    flex: 1,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: `${PRIMARY}12`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyMapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyMapCard: {
    maxWidth: 280,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 18,
    alignItems: "center",
  },
  emptyMapTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  emptyMapText: {
    marginTop: 6,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
    textAlign: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: MUTED,
  },
  reviewPromptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248,249,254,0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  reviewPromptCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  reviewPromptIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPromptTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  reviewPromptText: {
    marginTop: 10,
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
    textAlign: "center",
  },
  reviewPromptButton: {
    marginTop: 18,
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reviewPromptButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  calloutContainer: {
    minWidth: 210,
    maxWidth: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
  },
  calloutName: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
  },
  calloutRow: {
    marginTop: 4,
  },
  calloutLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED_LIGHT,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  calloutValue: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  clusterContainer: {
    alignItems: "center",
  },
  clusterBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  clusterBubbleLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  clusterBubbleXLarge: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  clusterText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  clusterHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clusterHintText: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
  },
  clusterCallout: {
    minWidth: 170,
    padding: 10,
  },
  clusterCalloutTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 4,
  },
  clusterCalloutText: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 18,
  },
});

const modal = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  option: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionSelected: {
    borderColor: `${PRIMARY}40`,
    backgroundColor: `${PRIMARY}10`,
  },
  optionClear: {
    backgroundColor: "#F8FAFC",
  },
  optionName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  optionNameSelected: {
    color: PRIMARY,
  },
  optionNameClear: {
    color: MUTED,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  radioDotSelected: {
    borderColor: PRIMARY,
  },
  radioDotUnselected: {
    borderColor: "#CBD5E1",
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
});
