import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { Icon } from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomMenuHeroHeader } from "../components/BottomMenuHeroHeader";
import { FilterModal } from "../components/FilterModal";
import { useUnreadNotificationsCount } from "../src/hooks/useUnreadNotificationsCount";
import { useHospitals } from "../hooks/useHospitals";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";

export default function HospitalsScreen({
  onHospitalSelect,
  onSectionChange,
  userProfile,
}) {
  const insets = useSafeAreaInsets();
  const { count: notificationCount } = useUnreadNotificationsCount(
    userProfile?.id
  );
  const [openModal, setOpenModal] = useState(null);

  const {
    filteredHospitals,
    specialties,
    searchTerm,
    setSearchTerm,
    selectedRegion,
    setSelectedRegion,
    selectedCity,
    setSelectedCity,
    selectedSpecialty,
    setSelectedSpecialty,
    sortMode,
    setSortMode,
    sponsorshipOnly,
    setSponsorshipOnly,
    uniqueRegions,
    availableCities,
    loadingHospitals,
    loadingSpecialtyFilter,
    clearFilters,
  } = useHospitals();

  useEffect(() => {
    posthogLogger.logScreen("HospitalsScreen");
  }, []);

  const specialtyOptions = useMemo(
    () => specialties.map((s) => ({ id: s.id, name: s.name })),
    [specialties]
  );
  const regionOptions = useMemo(
    () => uniqueRegions.map((r) => ({ id: r, name: r })),
    [uniqueRegions]
  );
  const cityOptions = useMemo(
    () => availableCities.map((c) => ({ id: c, name: c })),
    [availableCities]
  );
  const sortOptions = useMemo(
    () => [
      { id: "ranking", name: "Ranking" },
      { id: "alphabetical", name: "Alfabético" },
    ],
    []
  );

  const selectedSpecialtyName = useMemo(
    () => specialties.find((s) => s.id === selectedSpecialty)?.name ?? null,
    [specialties, selectedSpecialty]
  );
  const selectedSortName = useMemo(
    () => sortOptions.find((option) => option.id === sortMode)?.name ?? "Ranking",
    [sortMode, sortOptions]
  );

  const hasActiveFilters = !!(
    searchTerm ||
    selectedRegion ||
    selectedCity ||
    selectedSpecialty ||
    sponsorshipOnly ||
    sortMode !== "ranking"
  );
  const hospitalCountLabel = `${filteredHospitals.length} ${
    filteredHospitals.length === 1 ? "hospital" : "hospitales"
  }`;

  const handleHospitalItemPress = (hospital) => {
    onHospitalSelect?.(hospital, selectedSpecialty);
  };

  const renderHospitalItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handleHospitalItemPress(item)}
    >
      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={2}>
            {item.name}
          </Text>
          {item.is_sponsored && item.sponsorship_label ? (
            <View style={styles.rankingBadge}>
              <Text style={styles.rankingBadgeText}>{item.sponsorship_label}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardLocationRow}>
          <Icon name="location" size={14} color="#94A3B8" />
          <Text style={styles.cardLocation}>
            {item.city}, {item.region}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          {item.specialtyCount !== undefined && (
            <View style={styles.specialtyBadge}>
              <Text style={styles.specialtyBadgeText}>
                {item.specialtyCount} ESPECIALIDADES
              </Text>
            </View>
          )}
          <Icon name="arrow-forward" size={20} color={PRIMARY} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const isLoading = loadingHospitals || loadingSpecialtyFilter;

  return (
    <View style={styles.container}>
      <BottomMenuHeroHeader
        title="Hospitales"
        subtitle="Explora hospitales, compara ubicaciones y filtra por especialidad para encontrar tu mejor opción."
      />

      {/* Search bar */}
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
          style={[styles.chip, selectedSpecialty && styles.chipActive]}
          onPress={() => setOpenModal("specialty")}
        >
          <Icon
            name="medkit"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
          <Text
            style={[styles.chipText, selectedSpecialty && styles.chipTextActive]}
            numberOfLines={1}
          >
            {selectedSpecialtyName ?? "Especialidad"}
          </Text>
          <Icon
            name="chevron-down"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedRegion && styles.chipActive]}
          onPress={() => setOpenModal("region")}
        >
          <Icon
            name="map"
            size={16}
            color={selectedRegion ? PRIMARY : ACCENT}
          />
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
          style={[styles.chip, sortMode !== "ranking" && styles.chipActive]}
          onPress={() => setOpenModal("sort")}
        >
          <Icon
            name="swap-vertical"
            size={16}
            color={sortMode !== "ranking" ? PRIMARY : ACCENT}
          />
          <Text
            style={[styles.chipText, sortMode !== "ranking" && styles.chipTextActive]}
            numberOfLines={1}
          >
            {selectedSortName}
          </Text>
          <Icon
            name="chevron-down"
            size={16}
            color={sortMode !== "ranking" ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, sponsorshipOnly && styles.chipActive]}
          onPress={() => setSponsorshipOnly(!sponsorshipOnly)}
        >
          <Icon
            name="megaphone"
            size={16}
            color={sponsorshipOnly ? PRIMARY : ACCENT}
          />
          <Text
            style={[styles.chipText, sponsorshipOnly && styles.chipTextActive]}
            numberOfLines={1}
          >
            Patrocinados
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Hospital list */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando hospitales...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHospitals}
          renderItem={renderHospitalItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 24 + insets.bottom },
          ]}
          ListHeaderComponent={
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>
                {hasActiveFilters
                  ? hospitalCountLabel
                  : sortMode === "ranking"
                    ? "Ranking de hospitales"
                    : "Hospitales"}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity
                  style={styles.sectionAction}
                  onPress={clearFilters}
                  activeOpacity={0.75}
                >
                  <Text style={styles.sectionActionText}>Restablecer filtros</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.sectionCount}>{hospitalCountLabel}</Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No se encontraron hospitales</Text>
            </View>
          }
        />
      )}

      {/* Filter modals */}
      <FilterModal
        visible={openModal === "specialty"}
        onClose={() => setOpenModal(null)}
        title="Filtrar por especialidad"
        options={specialtyOptions}
        value={selectedSpecialty}
        onSelect={setSelectedSpecialty}
        placeholder="Todas las especialidades"
      />
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
        title="Ordenar hospitales"
        options={sortOptions}
        value={sortMode}
        onSelect={setSortMode}
        placeholder="Ranking"
      />
    </View>
  );
}

const BG_LIGHT = "#F8F9FE";

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
    marginTop: 16,
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
  chipClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  chipClearText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#EF4444",
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
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

  /* Hospital card */
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
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 22,
    flex: 1,
  },
  rankingBadge: {
    backgroundColor: `${SECONDARY}14`,
    borderWidth: 1,
    borderColor: `${SECONDARY}28`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rankingBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: SECONDARY,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  cardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    marginBottom: 12,
  },
  cardLocation: {
    fontSize: 12,
    color: "#64748B",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  specialtyBadge: {
    backgroundColor: `${PRIMARY}08`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  specialtyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.5,
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
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
  },
});
