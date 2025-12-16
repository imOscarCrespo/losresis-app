import React, { useMemo, memo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHousingAds } from "../hooks/useHousingAds";
import { useHospitals } from "../hooks/useHospitals";
import { Filters } from "../components/Filters";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { prepareHospitalOptions } from "../utils/profileOptions";
import { formatLongDate, formatDateOnly } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Formatea el precio en euros
 */
const formatPrice = (price) => {
  if (!price) return null;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(price);
};

/**
 * Obtiene el nombre de visualización del tipo de anuncio
 */
const getKindDisplayName = (kind) => {
  if (kind === "offer") return "Oferta";
  if (kind === "seek") return "Búsqueda";
  return kind || "Desconocido";
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Card de anuncio de vivienda
 * Memoizado para evitar re-renders innecesarios
 */
const HousingAdCard = memo(
  ({ ad, currentUserId, onPress, onDelete, onEdit }) => {
    const handlePress = useCallback(() => {
      if (onPress) {
        onPress(ad.id);
      }
    }, [ad.id, onPress]);

    const handleDelete = useCallback(
      (e) => {
        e.stopPropagation(); // Evitar que se active el onPress del card
        if (onDelete) {
          onDelete(ad.id);
        }
      },
      [ad.id, onDelete]
    );

    const handleEdit = useCallback(
      (e) => {
        e.stopPropagation(); // Evitar que se active el onPress del card
        if (onEdit) {
          onEdit(ad.id);
        }
      },
      [ad.id, onEdit]
    );

    const isMyAd = ad.user_id === currentUserId;
    const kindColor = ad.kind === "offer" ? COLORS.SUCCESS : COLORS.PRIMARY;

    return (
      <TouchableOpacity
        style={[styles.adCard, isMyAd && styles.adCardMine]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Header con badges y botón eliminar */}
        <View style={styles.cardHeader}>
          <View style={styles.badgesContainer}>
            <View
              style={[
                styles.kindBadge,
                {
                  backgroundColor:
                    kindColor === COLORS.SUCCESS
                      ? COLORS.SUCCESS_LIGHT
                      : COLORS.BADGE_BLUE_BG,
                },
              ]}
            >
              <Text
                style={[
                  styles.kindBadgeText,
                  {
                    color:
                      kindColor === COLORS.SUCCESS
                        ? COLORS.SUCCESS
                        : COLORS.BADGE_BLUE_TEXT,
                  },
                ]}
              >
                {getKindDisplayName(ad.kind)}
              </Text>
            </View>
            {isMyAd && (
              <View style={styles.myAdBadge}>
                <Text style={styles.myAdBadgeText}>✨ Mío</Text>
              </View>
            )}
            {!ad.is_active && (
              <View style={styles.inactiveBadge}>
                <Ionicons
                  name="eye-off-outline"
                  size={12}
                  color={COLORS.GRAY}
                />
                <Text style={styles.inactiveBadgeText}>Inactivo</Text>
              </View>
            )}
            {ad.images && ad.images.length > 0 && (
              <View style={styles.imagesBadge}>
                <Ionicons
                  name="images-outline"
                  size={12}
                  color={COLORS.SUCCESS}
                />
                <Text style={styles.imagesBadgeText}>
                  {ad.images.length} img
                </Text>
              </View>
            )}
          </View>
          {/* Botones de acción para mis anuncios */}
          {isMyAd && (onEdit || onDelete) && (
            <View style={styles.actionButtons}>
              {onEdit && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleEdit}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={20}
                    color={COLORS.PRIMARY}
                  />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={COLORS.ERROR}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Título */}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {ad.title}
        </Text>

        {/* Ciudad y precio */}
        <View style={styles.locationPriceContainer}>
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={16} color={COLORS.GRAY} />
            <Text style={styles.locationText} numberOfLines={1}>
              {ad.city}
            </Text>
          </View>
          {ad.price_eur && (
            <View style={styles.priceContainer}>
              <Ionicons name="cash-outline" size={16} color={COLORS.GRAY} />
              <Text style={styles.priceText}>
                {formatPrice(ad.price_eur)}/mes
              </Text>
            </View>
          )}
        </View>

        {/* Descripción */}
        <Text style={styles.cardDescription} numberOfLines={2}>
          {ad.description}
        </Text>

        {/* Fechas disponibles */}
        {(ad.available_from || ad.available_to) && (
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.GRAY} />
            <Text style={styles.dateText}>
              {ad.available_from &&
                `Desde: ${formatDateOnly(ad.available_from)}`}
              {ad.available_from && ad.available_to && " - "}
              {ad.available_to && `Hasta: ${formatDateOnly(ad.available_to)}`}
            </Text>
          </View>
        )}

        {/* Información del usuario (si no es mi anuncio) */}
        {!isMyAd && ad.user && (
          <View style={styles.userContainer}>
            <Text style={styles.userText}>
              Por: {ad.user.name} {ad.user.surname}
            </Text>
          </View>
        )}

        {/* Información de contacto (si no es mi anuncio) */}
        {!isMyAd && (ad.contact_email || ad.contact_phone) && (
          <View style={styles.contactContainer}>
            <Text style={styles.contactLabel}>Contacto:</Text>
            <View style={styles.contactItems}>
              {ad.contact_email && (
                <View style={styles.contactItem}>
                  <Ionicons name="mail-outline" size={12} color={COLORS.GRAY} />
                  <Text style={styles.contactText} numberOfLines={1}>
                    {ad.contact_email}
                  </Text>
                </View>
              )}
              {ad.contact_phone && (
                <View style={styles.contactItem}>
                  <Ionicons name="call-outline" size={12} color={COLORS.GRAY} />
                  <Text style={styles.contactText} numberOfLines={1}>
                    {ad.contact_phone}
                  </Text>
                </View>
              )}
            </View>
            {ad.preferred_contact && (
              <Text style={styles.preferredContactText}>
                Preferido:{" "}
                {ad.preferred_contact === "email" ? "Email" : "Teléfono"}
              </Text>
            )}
          </View>
        )}

        {/* Footer con fecha de creación */}
        <View style={styles.cardFooter}>
          <Text style={styles.createdDateText}>
            {formatDateOnly(ad.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
);

HousingAdCard.displayName = "HousingAdCard";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Pantalla de listado de anuncios de vivienda
 */
export default function HousingScreen({
  onSectionChange,
  currentSection,
  userProfile,
}) {
  const {
    housingAds,
    loading,
    error,
    hasMore,
    totalCount,
    city,
    setCity,
    kind,
    setKind,
    hospitalId,
    setHospitalId,
    showMyAds,
    setShowMyAds,
    clearFilters,
    loadMoreHousingAds,
    refreshHousingAds,
    deleteHousingAd,
    currentUserId,
  } = useHousingAds();

  const { hospitals } = useHospitals();
  const [refreshing, setRefreshing] = React.useState(false);

  // Preparar opciones para los filtros
  const hospitalOptions = useMemo(() => {
    const prepared = prepareHospitalOptions(hospitals);
    return [{ id: "", name: "Todos los hospitales" }, ...prepared];
  }, [hospitals]);

  const kindOptions = useMemo(
    () => [
      { id: "", name: "Todos los tipos" },
      { id: "offer", name: "Oferta" },
      { id: "seek", name: "Búsqueda" },
    ],
    []
  );

  // Configurar los filtros para el componente genérico
  const filtersConfig = useMemo(() => {
    return [
      {
        id: "city",
        type: "search",
        label: "Ciudad",
        value: city,
        onChange: setCity,
        placeholder: "Madrid, Barcelona...",
      },
      {
        id: "kind",
        type: "select",
        label: "Tipo de anuncio",
        value: kind,
        onSelect: setKind,
        options: kindOptions,
        placeholder: "Seleccionar tipo",
      },
      {
        id: "hospital",
        type: "select",
        label: "Hospital más cercano",
        value: hospitalId,
        onSelect: setHospitalId,
        options: hospitalOptions,
        placeholder: "Seleccionar hospital",
      },
    ];
  }, [
    city,
    setCity,
    kind,
    setKind,
    hospitalId,
    setHospitalId,
    kindOptions,
    hospitalOptions,
  ]);

  // Verificar si hay filtros activos
  const hasActiveFilters = useMemo(() => {
    return !!(city || kind || hospitalId || showMyAds);
  }, [city, kind, hospitalId, showMyAds]);

  // Manejar refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshHousingAds();
    setRefreshing(false);
  }, [refreshHousingAds]);

  // Manejar press en un anuncio
  const handleAdPress = useCallback(
    (adId) => {
      if (onSectionChange && adId) {
        onSectionChange("housingDetail", { adId });
      }
    },
    [onSectionChange]
  );

  // Manejar creación de nuevo anuncio
  const handleCreateAd = useCallback(() => {
    if (onSectionChange) {
      onSectionChange("createHousingAd");
    }
  }, [onSectionChange]);

  // Manejar edición de anuncio
  const handleEditAd = useCallback(
    (adId) => {
      if (onSectionChange && adId) {
        onSectionChange("editHousingAd", { adId });
      }
    },
    [onSectionChange]
  );

  // Manejar eliminación de anuncio
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
              if (success) {
                Alert.alert("Éxito", "Anuncio eliminado correctamente");
              } else {
                Alert.alert("Error", "No se pudo eliminar el anuncio");
              }
            },
          },
        ]
      );
    },
    [deleteHousingAd]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Vivienda</Text>
            <Text style={styles.resultsText}>
              Mostrando{" "}
              <Text style={styles.resultsNumber}>{housingAds.length}</Text> de{" "}
              {totalCount} anuncios
            </Text>
          </View>
          {/* Toggle Mis Anuncios */}
          <TouchableOpacity
            style={[styles.myAdsToggle, showMyAds && styles.myAdsToggleActive]}
            onPress={() => setShowMyAds(!showMyAds)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showMyAds ? "person" : "person-outline"}
              size={18}
              color={showMyAds ? COLORS.WHITE : COLORS.PRIMARY}
            />
            <Text
              style={[
                styles.myAdsToggleText,
                showMyAds && styles.myAdsToggleTextActive,
              ]}
            >
              Mis anuncios
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters Section */}
      <Filters
        filters={filtersConfig}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Content */}
      {loading && housingAds.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando anuncios...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.ERROR} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={refreshHousingAds}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : housingAds.length === 0 ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.emptyContentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.PRIMARY]}
            />
          }
        >
          <View style={styles.emptyContainer}>
            <Ionicons name="home-outline" size={64} color={COLORS.GRAY} />
            <Text style={styles.emptyTitle}>No hay anuncios disponibles</Text>
            <Text style={styles.emptySubtitle}>
              Sé el primero en publicar un anuncio de vivienda
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.PRIMARY]}
            />
          }
          onScrollEndDrag={() => {
            if (hasMore && !loading) {
              loadMoreHousingAds();
            }
          }}
          onEndReached={loadMoreHousingAds}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
        >
          {housingAds.map((ad) => (
            <HousingAdCard
              key={ad.id}
              ad={ad}
              currentUserId={currentUserId}
              onPress={handleAdPress}
              onEdit={handleEditAd}
              onDelete={handleDeleteAd}
            />
          ))}
          {loading && hasMore && (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color={COLORS.PRIMARY} />
              <Text style={styles.loadingMoreText}>
                Cargando más anuncios...
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Botón flotante para crear nuevo anuncio */}
      <FloatingActionButton
        onPress={handleCreateAd}
        icon="add"
        backgroundColor={COLORS.PRIMARY}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
  },
  header: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.TEXT_DARK,
    marginBottom: 4,
  },
  myAdsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.WHITE,
  },
  myAdsToggleActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  myAdsToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  myAdsToggleTextActive: {
    color: COLORS.WHITE,
  },
  resultsText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
  },
  resultsNumber: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.TEXT_MEDIUM,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.ERROR,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.BLACK,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
    textAlign: "center",
  },
  adCard: {
    backgroundColor: COLORS.CARD_BACKGROUND,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.BLACK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  adCardMine: {
    borderWidth: 2,
    borderColor: COLORS.WARNING,
    backgroundColor: "#FFFBF0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  badgesContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 8,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  kindBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kindBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  myAdBadge: {
    backgroundColor: COLORS.WARNING,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  myAdBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  inactiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.GRAY_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inactiveBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.GRAY,
  },
  imagesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.SUCCESS_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imagesBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.SUCCESS,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
    marginBottom: 8,
  },
  locationPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 100,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priceText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
    fontWeight: "600",
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.TEXT_DARK,
    lineHeight: 20,
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.TEXT_MEDIUM,
  },
  userContainer: {
    marginBottom: 8,
  },
  userText: {
    fontSize: 13,
    color: COLORS.TEXT_MEDIUM,
  },
  contactContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginBottom: 8,
  },
  contactItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 200,
  },
  contactText: {
    fontSize: 12,
    color: COLORS.TEXT_DARK,
  },
  preferredContactText: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
    marginTop: 4,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingTop: 12,
    marginTop: 8,
  },
  createdDateText: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingMoreText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
  },
});
