import React, { useMemo, memo, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { Icon } from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHousingAds } from "../hooks/useHousingAds";
import { useHospitals } from "../hooks/useHospitals";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { COLORS } from "../constants/colors";
import { formatDateOnly } from "../utils/dateUtils";
import posthogLogger from "../services/posthogService";

// ============================================================================
// COLORS
// ============================================================================

const PRIMARY = "#670CF5";
const SECONDARY = PRIMARY;
const ACCENT = "#1B0977";
const BG_LIGHT = COLORS.BACKGROUND;
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#F1F5F9";
const ERROR = "#EF4444";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

// ============================================================================
// FILTER OPTIONS
// ============================================================================

const KIND_OPTIONS = [
  { id: "offer", name: "Oferta" },
  { id: "seek", name: "Búsqueda" },
];

const PRICE_OPTIONS = [
  { id: "300", name: "Hasta 300 €" },
  { id: "500", name: "Hasta 500 €" },
  { id: "800", name: "Hasta 800 €" },
  { id: "1200", name: "Hasta 1.200 €" },
  { id: "1800", name: "Hasta 1.800 €" },
];

// ============================================================================
// UTILITIES
// ============================================================================

const formatPrice = (price) => {
  if (!price) return null;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(price);
};

const getInitials = (name, surname) => {
  const first = name ? name[0].toUpperCase() : "";
  const last = surname ? surname[0].toUpperCase() : "";
  return first + last || "?";
};

const getFirstImageUrl = (ad) => {
  if (!ad.images || ad.images.length === 0) return null;
  const img = ad.images[0];
  if (!img.object_path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/housing_ad/${img.object_path}`;
};

// ============================================================================
// RADIO DOT — exact copy from HospitalsScreen
// ============================================================================

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

// ============================================================================
// FILTER MODAL — exact copy from HospitalsScreen
// ============================================================================

function FilterModal({ visible, onClose, title, options, value, onSelect, placeholder }) {
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
        <View style={[modal.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={modal.backBtn} onPress={handleClose}>
            <Icon name="arrow-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={modal.title}>{title}</Text>
          <View style={modal.backBtn} />
        </View>

        {/* Search */}
        <View style={modal.searchWrap}>
          <View style={modal.searchInner}>
            <Icon name="search" size={20} color="#94A3B8" />
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
                <Icon name="close-circle" size={18} color="#94A3B8" />
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
        <View style={[modal.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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

// ============================================================================
// HOUSING AD CARD
// ============================================================================

const HousingAdCard = memo(({ ad, currentUserId, onPress, onDelete, onEdit }) => {
  const isMyAd = ad.user_id === currentUserId;
  const imageUrl = getFirstImageUrl(ad);

  const handlePress = useCallback(() => onPress?.(ad.id), [ad.id, onPress]);
  const handleEdit = useCallback(
    (e) => { e.stopPropagation(); onEdit?.(ad.id); },
    [ad.id, onEdit]
  );
  const handleDelete = useCallback(
    (e) => { e.stopPropagation(); onDelete?.(ad.id); },
    [ad.id, onDelete]
  );

  const kindIsOffer = ad.kind === "offer";
  const kindColor = kindIsOffer ? SECONDARY : COLORS.SUCCESS;
  const kindLabel = kindIsOffer ? "Oferta" : "Búsqueda";

  const locationText = useMemo(() => {
    const parts = [];
    if (ad.city) parts.push(ad.city);
    if (ad.hospital?.name) parts.push(`Cerca de ${ad.hospital.name}`);
    return parts.join(" · ");
  }, [ad.city, ad.hospital]);

  return (
    <TouchableOpacity
      style={[styles.card, !ad.is_active && styles.cardInactive]}
      onPress={handlePress}
      activeOpacity={0.88}
    >
      {/* Photo */}
      {kindIsOffer ? (
        <>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Icon name="home-outline" size={36} color="#CBD5E1" />
            </View>
          )}

          <View style={[styles.kindBadge, { backgroundColor: kindColor }]}>
            <Text style={styles.kindBadgeText}>{kindLabel}</Text>
          </View>

          {isMyAd && (
            <View style={styles.myAdBadge}>
              <Text style={styles.myAdBadgeText}>✦ Mío</Text>
            </View>
          )}

          {!ad.is_active && (
            <View style={styles.inactiveBadge}>
              <Icon name="eye-off-outline" size={11} color={TEXT_MEDIUM} />
              <Text style={styles.inactiveBadgeText}>Inactivo</Text>
            </View>
          )}
        </>
      ) : null}

      <View style={styles.cardContent}>
        {!kindIsOffer && (
          <View style={styles.badgeRow}>
            <View style={[styles.kindBadgeInline, { backgroundColor: kindColor }]}>
              <Text style={styles.kindBadgeText}>{kindLabel}</Text>
            </View>
            {isMyAd && (
              <View style={styles.myAdBadgeInline}>
                <Text style={styles.myAdBadgeText}>✦ Mío</Text>
              </View>
            )}
            {!ad.is_active && (
              <View style={styles.inactiveBadgeInline}>
                <Icon name="eye-off-outline" size={11} color={TEXT_MEDIUM} />
                <Text style={styles.inactiveBadgeText}>Inactivo</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.titlePriceRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{ad.title}</Text>
          {ad.price_eur ? (
            <Text style={styles.priceText}>{formatPrice(ad.price_eur)}/mes</Text>
          ) : null}
        </View>

        {locationText ? (
          <View style={styles.locationRow}>
            <Icon name="location-outline" size={13} color={TEXT_MEDIUM} />
            <Text style={styles.locationText} numberOfLines={1}>{locationText}</Text>
          </View>
        ) : null}

        <Text style={styles.cardDescription} numberOfLines={2}>{ad.description}</Text>

        {(ad.available_from || ad.available_to) ? (
          <View style={styles.datesRow}>
            <Icon name="calendar-outline" size={12} color={TEXT_LIGHT} />
            <Text style={styles.datesText}>
              {ad.available_from && `Desde ${formatDateOnly(ad.available_from)}`}
              {ad.available_from && ad.available_to && "  —  "}
              {ad.available_to && `Hasta ${formatDateOnly(ad.available_to)}`}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          {!isMyAd && ad.user ? (
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(ad.user.name, ad.user.surname)}
                </Text>
              </View>
              <Text style={styles.authorName} numberOfLines={1}>
                {ad.user.name} {ad.user.surname}
              </Text>
            </View>
          ) : isMyAd ? (
            <View style={styles.authorRow}>
              <View style={[styles.avatar, { backgroundColor: PRIMARY + "18" }]}>
                <Icon name="person" size={13} color={PRIMARY} />
              </View>
              <Text style={[styles.authorName, { color: PRIMARY }]}>Mi anuncio</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {isMyAd ? (
            <View style={styles.ownAdActions}>
              {onEdit && (
                <TouchableOpacity style={styles.iconBtn} onPress={handleEdit} activeOpacity={0.7}>
                  <Icon name="pencil-outline" size={17} color={PRIMARY} />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity style={styles.iconBtn} onPress={handleDelete} activeOpacity={0.7}>
                  <Icon name="trash-outline" size={17} color={ERROR} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.contactBtn} onPress={handlePress} activeOpacity={0.8}>
              <Text style={styles.contactBtnText}>Ver detalles</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

HousingAdCard.displayName = "HousingAdCard";

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function HousingScreen({ onSectionChange, onBack }) {
  const {
    housingAds,
    loading,
    error,
    hasMore,
    totalCount,
    filtersLoading,
    city,
    setCity,
    kind,
    setKind,
    hospitalId,
    setHospitalId,
    hospitalOptions,
    maxPrice,
    setMaxPrice,
    showMyAds,
    setShowMyAds,
    clearFilters,
    loadMoreHousingAds,
    refreshHousingAds,
    deleteHousingAd,
    currentUserId,
  } = useHousingAds();

  const { uniqueCities } = useHospitals();
  const [refreshing, setRefreshing] = useState(false);
  const [openModal, setOpenModal] = useState(null); // "city" | "hospital" | "price" | null

  useEffect(() => {
    posthogLogger.logScreen("HousingScreen");
  }, []);

  const cityOptions = useMemo(() => {
    return [...(uniqueCities || [])].sort().map((c) => ({ id: c, name: c }));
  }, [uniqueCities]);

  const hasActiveFilters = !!(city || hospitalId || maxPrice || showMyAds);
  const adCountLabel = `${totalCount} ${
    totalCount === 1 ? "anuncio" : "anuncios"
  }`;

  // Display labels for chips
  const hospitalLabel = hospitalId
    ? hospitalOptions.find((o) => o.id === hospitalId)?.name ?? "Hospital"
    : "Hospital";
  const priceLabel = maxPrice
    ? PRICE_OPTIONS.find((o) => o.id === String(maxPrice))?.name ?? "Precio"
    : "Precio";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshHousingAds();
    setRefreshing(false);
  }, [refreshHousingAds]);

  const handleAdPress = useCallback(
    (adId) => { onSectionChange?.("housingDetail", { adId }); },
    [onSectionChange]
  );
  const handleCreateAd = useCallback(
    () => { onSectionChange?.("createHousingAd"); },
    [onSectionChange]
  );
  const handleEditAd = useCallback(
    (adId) => { onSectionChange?.("editHousingAd", { adId }); },
    [onSectionChange]
  );
  const handleDeleteAd = useCallback(
    async (adId) => {
      Alert.alert(
        "Eliminar anuncio",
        "¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              const success = await deleteHousingAd(adId);
              if (!success) Alert.alert("Error", "No se pudo eliminar el anuncio");
            },
          },
        ]
      );
    },
    [deleteHousingAd]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <HousingAdCard
        ad={item}
        currentUserId={currentUserId}
        onPress={handleAdPress}
        onEdit={handleEditAd}
        onDelete={handleDeleteAd}
      />
    ),
    [currentUserId, handleAdPress, handleEditAd, handleDeleteAd]
  );

  const ListHeader = (
    <View style={styles.listHeader}>
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        {/* Ciudad */}
        <TouchableOpacity
          style={[styles.chip, city && styles.chipActive]}
          onPress={() => setOpenModal("city")}
        >
          <Icon name="business" size={16} color={city ? PRIMARY : ACCENT} />
          <Text
            style={[styles.chipText, city && styles.chipTextActive]}
            numberOfLines={1}
          >
            {city || "Ciudad"}
          </Text>
          <Icon name="chevron-down" size={16} color={city ? PRIMARY : ACCENT} />
        </TouchableOpacity>

        {/* Hospital */}
        <TouchableOpacity
          style={[styles.chip, hospitalId && styles.chipActive]}
          onPress={() => setOpenModal("hospital")}
        >
          <Icon
            name="business-outline"
            size={16}
            color={hospitalId ? PRIMARY : ACCENT}
          />
          <Text
            style={[styles.chipText, hospitalId && styles.chipTextActive]}
            numberOfLines={1}
          >
            {hospitalLabel}
          </Text>
          <Icon
            name="chevron-down"
            size={16}
            color={hospitalId ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        {/* Precio */}
        <TouchableOpacity
          style={[styles.chip, maxPrice && styles.chipActive]}
          onPress={() => setOpenModal("price")}
        >
          <Icon name="cash" size={16} color={maxPrice ? PRIMARY : ACCENT} />
          <Text
            style={[styles.chipText, maxPrice && styles.chipTextActive]}
            numberOfLines={1}
          >
            {priceLabel}
          </Text>
          <Icon name="chevron-down" size={16} color={maxPrice ? PRIMARY : ACCENT} />
        </TouchableOpacity>

      </ScrollView>

      {/* Kind segmented control */}
      <View style={styles.segmented}>
        {KIND_OPTIONS.map((opt) => {
          const isActive = kind === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.segmentedItem, isActive && styles.segmentedItemActive]}
              onPress={() => setKind(opt.id)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.segmentedItemText,
                  isActive && styles.segmentedItemTextActive,
                ]}
              >
                {opt.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Section label */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>
          {hasActiveFilters ? adCountLabel : "Anuncios disponibles"}
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
          <Text style={styles.sectionCount}>{adCountLabel}</Text>
        )}
      </View>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Icon name="home-outline" size={40} color={PRIMARY} />
      </View>
      <Text style={styles.emptyTitle}>Sin anuncios disponibles</Text>
      <Text style={styles.emptySubtitle}>
        {hasActiveFilters
          ? "Prueba con otros filtros o limpia la búsqueda"
          : "Sé el primero en publicar un anuncio de vivienda"}
      </Text>
    </View>
  );

  const ListFooter =
    loading && hasMore ? (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={PRIMARY} />
        <Text style={styles.loadingMoreText}>Cargando más...</Text>
      </View>
    ) : (
      <View style={{ height: 100 }} />
    );
  const heroProps = {
    title: "Vivienda",
    onBack,
    rightSlot: (
      <TouchableOpacity
        style={[styles.myAdsChip, showMyAds && styles.myAdsChipActive]}
        onPress={() => setShowMyAds(!showMyAds)}
        activeOpacity={0.7}
      >
        <Icon
          name={showMyAds ? "person" : "person-outline"}
          size={14}
          color={showMyAds ? PRIMARY : WHITE}
        />
        <Text style={[styles.myAdsChipText, showMyAds && styles.myAdsChipTextActive]}>
          Mis anuncios
        </Text>
      </TouchableOpacity>
    ),
  };

  if ((loading || filtersLoading) && housingAds.length === 0) {
    return (
      <HeroScreenLayout {...heroProps}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando anuncios...</Text>
        </View>
      </HeroScreenLayout>
    );
  }

  if (error) {
    return (
      <HeroScreenLayout {...heroProps}>
        <View style={styles.stateContainer}>
          <Icon name="alert-circle" size={48} color={ERROR} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshHousingAds}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </HeroScreenLayout>
    );
  }

  return (
    <HeroScreenLayout
      {...heroProps}
      overlay={
        <>
          <FloatingActionButton
            onPress={handleCreateAd}
            icon="add"
            backgroundColor={SECONDARY}
          />
          <FilterModal
            visible={openModal === "city"}
            onClose={() => setOpenModal(null)}
            title="Filtrar por ciudad"
            options={cityOptions}
            value={city}
            onSelect={setCity}
            placeholder="Todas las ciudades"
          />
          <FilterModal
            visible={openModal === "hospital"}
            onClose={() => setOpenModal(null)}
            title="Filtrar por hospital"
            options={hospitalOptions}
            value={hospitalId}
            onSelect={setHospitalId}
            placeholder="Todos los hospitales"
          />
          <FilterModal
            visible={openModal === "price"}
            onClose={() => setOpenModal(null)}
            title="Filtrar por precio"
            options={PRICE_OPTIONS}
            value={maxPrice ? String(maxPrice) : ""}
            onSelect={(id) => setMaxPrice(id ? Number(id) : null)}
            placeholder="Todos los precios"
          />
        </>
      }
    >
      <FlatList
        data={housingAds}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
        onEndReached={() => { if (hasMore && !loading) loadMoreHousingAds(); }}
        onEndReachedThreshold={0.4}
      />
    </HeroScreenLayout>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  listContent: {
    paddingBottom: 16,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },

  myAdsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  myAdsChipActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  myAdsChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: WHITE,
  },
  myAdsChipTextActive: {
    color: PRIMARY,
  },

  // ── Filter chips — same as HospitalsScreen ──
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 4,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
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
    color: ERROR,
  },

  // ── Segmented control (Oferta / Búsqueda) ──
  segmented: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedItemActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: ACCENT,
  },
  segmentedItemTextActive: {
    color: WHITE,
    fontWeight: "700",
  },

  // ── Section label ──
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 6,
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

  // ── Card ──
  card: {
    backgroundColor: WHITE,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardInactive: {
    opacity: 0.6,
  },
  cardImage: {
    width: "100%",
    height: 170,
    backgroundColor: "#F1F5F9",
  },
  cardImagePlaceholder: {
    width: "100%",
    height: 140,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  kindBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  kindBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 0.3,
  },
  myAdBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FFF4E0",
    borderWidth: 1,
    borderColor: "#FBBF24",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  myAdBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
  },
  inactiveBadge: {
    position: "absolute",
    top: 42,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inactiveBadgeText: {
    fontSize: 11,
    color: TEXT_MEDIUM,
    fontWeight: "500",
  },
  cardContent: {
    padding: 14,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  kindBadgeInline: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  myAdBadgeInline: {
    backgroundColor: "#FFF4E0",
    borderWidth: 1,
    borderColor: "#FBBF24",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  inactiveBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  titlePriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 22,
  },
  priceText: {
    fontSize: 15,
    fontWeight: "700",
    color: SECONDARY,
    flexShrink: 0,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_MEDIUM,
  },
  cardDescription: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    lineHeight: 19,
    marginBottom: 10,
  },
  datesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  datesText: {
    fontSize: 12,
    color: TEXT_LIGHT,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SECONDARY + "20",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: SECONDARY,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_MEDIUM,
    flex: 1,
  },
  contactBtn: {
    backgroundColor: SECONDARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexShrink: 0,
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: WHITE,
  },
  ownAdActions: {
    flexDirection: "row",
    gap: 4,
  },
  iconBtn: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: "#F8F9FE",
  },

  // ── States ──
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG_LIGHT,
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    color: TEXT_MEDIUM,
  },
  errorText: {
    fontSize: 15,
    color: ERROR,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  retryButtonText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PRIMARY + "10",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_MEDIUM,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  loadingMoreText: {
    fontSize: 14,
    color: TEXT_MEDIUM,
  },
});

// ============================================================================
// MODAL STYLES — exact copy from HospitalsScreen
// ============================================================================

const modal = StyleSheet.create({
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
  empty: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
  },
});
