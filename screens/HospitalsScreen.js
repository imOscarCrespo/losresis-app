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
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnreadNotificationsCount } from "../src/hooks/useUnreadNotificationsCount";
import { useHospitals } from "../hooks/useHospitals";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";

function RadioDot({ selected }) {
  return (
    <View
      style={[
        modal.radioDot,
        selected ? modal.radioDotSelected : modal.radioDotUnselected,
      ]}
    >
      {selected && <View style={modal.radioDotInner} />}
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
  const [search, setSearch] = useState("");
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    if (visible) setTempValue(value);
  }, [visible, value]);

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  const handleConfirm = () => {
    onSelect(tempValue);
    setSearch("");
    onClose();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(lower));
  }, [options, search]);

  const listData = useMemo(() => {
    const data = [];
    if (value) data.push({ id: "", name: placeholder });
    data.push(...filtered);
    return data;
  }, [filtered, value, placeholder]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#FFF" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View
          style={[modal.header, { paddingTop: Math.max(insets.top, 16) }]}
        >
          <TouchableOpacity style={modal.backBtn} onPress={handleClose}>
            <Ionicons name="arrow-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={modal.title}>{title}</Text>
          <View style={modal.backBtn} />
        </View>

        {/* Search */}
        <View style={modal.searchWrap}>
          <View style={modal.searchInner}>
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              style={modal.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar..."
              placeholderTextColor="#94A3B8"
              returnKeyType="done"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Options list */}
        <FlatList
          data={listData}
          keyExtractor={(item, i) => String(item.id ?? "") + i}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={modal.listContent}
          renderItem={({ item }) => {
            const isSelected = item.id !== "" && item.id === tempValue;
            const isClear = item.id === "";
            return (
              <Pressable
                style={({ pressed }) => [
                  modal.option,
                  isSelected && modal.optionSelected,
                  isClear && modal.optionClear,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => setTempValue(isClear ? "" : item.id)}
              >
                <View style={modal.optionBody}>
                  <Text
                    style={[
                      modal.optionName,
                      isSelected && modal.optionNameSelected,
                      isClear && modal.optionNameClear,
                    ]}
                  >
                    {item.name}
                  </Text>
                </View>
                {!isClear && <RadioDot selected={isSelected} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={modal.empty}>
              <Text style={modal.emptyText}>Sin resultados</Text>
            </View>
          }
        />

        {/* Confirm button */}
        <View
          style={[
            modal.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <TouchableOpacity
            style={modal.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text style={modal.confirmText}>Confirmar selección</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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

  const selectedSpecialtyName = useMemo(
    () => specialties.find((s) => s.id === selectedSpecialty)?.name ?? null,
    [specialties, selectedSpecialty]
  );

  const hasActiveFilters = !!(
    searchTerm ||
    selectedRegion ||
    selectedCity ||
    selectedSpecialty
  );

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
        </View>

        <View style={styles.cardLocationRow}>
          <Ionicons name="location" size={14} color="#94A3B8" />
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
          <Ionicons name="arrow-forward" size={20} color={PRIMARY} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const isLoading = loadingHospitals || loadingSpecialtyFilter;

  return (
    <View style={styles.container}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Hospitales</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {filteredHospitals.length}{" "}
            {filteredHospitals.length === 1 ? "HOSPITAL" : "HOSPITALES"}
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons
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
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
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
          <Ionicons
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
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedRegion && styles.chipActive]}
          onPress={() => setOpenModal("region")}
        >
          <Ionicons
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
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedRegion ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedCity && styles.chipActive]}
          onPress={() => setOpenModal("city")}
        >
          <Ionicons
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
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedCity ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        {hasActiveFilters && (
          <TouchableOpacity style={styles.chipClear} onPress={clearFilters}>
            <Ionicons name="close-circle" size={16} color="#EF4444" />
            <Text style={styles.chipClearText}>Limpiar</Text>
          </TouchableOpacity>
        )}
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
                {hasActiveFilters ? "Resultados" : "Hospitales destacados"}
              </Text>
              <Text style={styles.sectionCount}>
                {filteredHospitals.length}{" "}
                {filteredHospitals.length === 1 ? "hospital" : "hospitales"}
              </Text>
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
    </View>
  );
}

const BG_LIGHT = "#F8F9FE";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },

  /* Title row */
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: `${PRIMARY}12`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}25`,
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
  },

  /* Search */
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    marginHorizontal: 16,
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
    marginBottom: 6,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 22,
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

const modal = StyleSheet.create({
  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    paddingTop: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: ACCENT,
    textAlign: "center",
    letterSpacing: -0.3,
  },

  /* Search */
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: ACCENT,
    padding: 0,
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: `${PRIMARY}08`,
  },
  optionClear: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  optionBody: {
    flex: 1,
  },
  optionName: {
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  optionNameSelected: {
    color: PRIMARY,
    fontWeight: "700",
  },
  optionNameClear: {
    color: "#EF4444",
    fontWeight: "600",
  },

  /* Radio dot */
  radioDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioDotSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  radioDotUnselected: {
    borderColor: "#CBD5E1",
    backgroundColor: "transparent",
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFF",
  },

  /* Footer */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  /* Empty */
  empty: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
  },
});
