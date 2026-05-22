import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { DirectChatButton } from "../components";
import { useHousingAds } from "../hooks/useHousingAds";
import { formatDateOnly } from "../utils/dateUtils";
import { getCurrentUser } from "../services/authService";
import { openDirectChat } from "../services/directChatsService";
import posthogLogger from "../services/posthogService";

// ============================================================================
// COLORS — same palette as CreateHousingAdScreen
// ============================================================================

const PRIMARY = "#670CF5";
const SECONDARY = PRIMARY;
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const WHITE = "#FFFFFF";
const TEXT_DARK = "#1E293B";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#E8E0F5";
const ERROR = "#EF4444";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const THUMB_SIZE = (SCREEN_WIDTH - 16 * 2 - 32 - 10 * 2) / 3; // 3-col grid

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

const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/housing_ad/${imagePath}`;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Encabezado de bloque — igual al de CreateHousingAdScreen */
const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIconWrap}>
      <Ionicons name={icon} size={16} color={PRIMARY} />
    </View>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

/** Fila de información con icono + etiqueta + valor */
const InfoRow = ({ icon, iconColor = PRIMARY, label, value }) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIconCircle, { backgroundColor: iconColor + "15" }]}>
      <Ionicons name={icon} size={15} color={iconColor} />
    </View>
    <View style={styles.infoTextGroup}>
      {label ? <Text style={styles.infoLabel}>{label}</Text> : null}
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HousingAdDetailScreen({
  adId,
  onBack,
  onEdit,
  onDelete,
  onSectionChange,
}) {
  const { fetchHousingAdById, deleteHousingAd } = useHousingAds();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [openingChat, setOpeningChat] = useState(false);

  useEffect(() => {
    posthogLogger.logScreen("HousingAdDetailScreen", { adId });
  }, [adId]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const { success, user } = await getCurrentUser();
        if (!success || !user) return;

        setCurrentUserId(user.id);
      } catch (err) {
        // silent
      }
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const loadAd = async () => {
      if (!adId) {
        setError("ID de anuncio requerido");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const fetchedAd = await fetchHousingAdById(adId);
        if (fetchedAd) {
          setAd(fetchedAd);
        } else {
          setError("No se pudo cargar el anuncio");
        }
      } catch (err) {
        setError(err.message || "Error al cargar el anuncio");
      } finally {
        setLoading(false);
      }
    };
    loadAd();
  }, [adId, fetchHousingAdById]);

  const isMyAd = useMemo(
    () => !!(currentUserId && ad && ad.user_id === currentUserId),
    [currentUserId, ad]
  );

  const canOpenAppChat = useMemo(
    () => Boolean(!isMyAd && ad?.user?.id),
    [ad?.user?.id, isMyAd]
  );

  const handleContact = useCallback((type, value) => {
    if (type === "email" && value) Linking.openURL(`mailto:${value}`);
    else if (type === "phone" && value) Linking.openURL(`tel:${value}`);
  }, []);

  const handleOpenChat = useCallback(async () => {
    if (!ad?.user?.id) {
      Alert.alert("Error", "No se pudo identificar al residente del anuncio.");
      return;
    }

    try {
      setOpeningChat(true);

      const otherUserName =
        `${ad.user.name || ""} ${ad.user.surname || ""}`.trim() || "Usuario";
      const response = await openDirectChat({
        otherUserId: ad.user.id,
        otherUserName,
        onSectionChange,
      });

      if (!response.success || !response.chat?.group_id) {
        Alert.alert(
          "Error",
          response.error || "No se pudo abrir la conversación privada."
        );
        return;
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error?.message || "No se pudo abrir la conversación privada."
      );
    } finally {
      setOpeningChat(false);
    }
  }, [
    ad?.user?.id,
    ad?.user?.name,
    ad?.user?.surname,
    onSectionChange,
  ]);

  const handleEdit = useCallback(() => {
    if (onEdit && adId) onEdit(adId);
  }, [onEdit, adId]);

  const handleDelete = useCallback(() => {
    if (!adId) return;
    Alert.alert(
      "Eliminar anuncio",
      "¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const success = await deleteHousingAd(adId);
              if (success && onDelete) onDelete(adId);
              else if (success && onBack) onBack();
            } catch {
              Alert.alert("Error", "No se pudo eliminar el anuncio");
            }
          },
        },
      ]
    );
  }, [adId, deleteHousingAd, onDelete, onBack]);

  const handleImagePress = useCallback((imagePath) => {
    const url = getImageUrl(imagePath);
    if (url) setSelectedImage(url);
  }, []);

  const heroProps = {
    title: "Vivienda",
    onBack,
    rightSlot: isMyAd ? (
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={handleEdit}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={18} color={WHITE} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerIconBtn, styles.headerDangerBtn]}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={WHITE} />
        </TouchableOpacity>
      </View>
    ) : null,
  };

  // ── Loading state ──
  if (loading) {
    return (
      <HeroScreenLayout {...heroProps}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.stateText}>Cargando anuncio...</Text>
        </View>
      </HeroScreenLayout>
    );
  }

  // ── Error state ──
  if (error || !ad) {
    return (
      <HeroScreenLayout {...heroProps}>
        <View style={styles.stateContainer}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={ERROR} />
          </View>
          <Text style={styles.errorTitle}>{error || "Anuncio no encontrado"}</Text>
          <Text style={styles.errorSubtitle}>
            El anuncio que buscas no existe o ha sido eliminado.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Volver a Vivienda</Text>
          </TouchableOpacity>
        </View>
      </HeroScreenLayout>
    );
  }

  const kindIsOffer = ad.kind === "offer";
  const heroImageUrl =
    ad.images && ad.images.length > 0
      ? getImageUrl(ad.images[0].object_path)
      : null;

  return (
    <HeroScreenLayout {...heroProps}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero image ── */}
        {heroImageUrl ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => handleImagePress(ad.images[0].object_path)}
          >
            <Image
              source={{ uri: heroImageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            {/* Kind + inactive badges over hero */}
            <View style={styles.heroBadges}>
              <View
                style={[
                  styles.kindBadge,
                  { backgroundColor: kindIsOffer ? SECONDARY : PRIMARY },
                ]}
              >
                <Text style={styles.kindBadgeText}>
                  {kindIsOffer ? "Oferta" : "Búsqueda"}
                </Text>
              </View>
              {!ad.is_active && (
                <View style={styles.inactiveBadge}>
                  <Ionicons name="eye-off-outline" size={11} color={TEXT_MEDIUM} />
                  <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          /* No image — show badges inline */
          <View style={styles.noimgBadges}>
            <View
              style={[
                styles.kindBadge,
                { backgroundColor: kindIsOffer ? SECONDARY : PRIMARY },
              ]}
            >
              <Text style={styles.kindBadgeText}>
                {kindIsOffer ? "Oferta" : "Búsqueda"}
              </Text>
            </View>
            {!ad.is_active && (
              <View style={styles.inactiveBadge}>
                <Ionicons name="eye-off-outline" size={11} color={TEXT_MEDIUM} />
                <Text style={styles.inactiveBadgeText}>Inactivo</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Title + Price block ── */}
        <View style={styles.block}>
          <Text style={styles.adTitle}>{ad.title}</Text>
          {ad.price_eur ? (
            <View style={styles.priceRow}>
              <Ionicons name="cash-outline" size={18} color={SECONDARY} />
              <Text style={styles.priceText}>{formatPrice(ad.price_eur)}/mes</Text>
            </View>
          ) : null}
        </View>

        {/* ── Ubicación ── */}
        <View style={styles.block}>
          <SectionHeader icon="location-outline" title="Ubicación" />
          {ad.city ? (
            <InfoRow
              icon="map-outline"
              iconColor={PRIMARY}
              label="Ciudad"
              value={ad.city}
            />
          ) : null}
          {ad.hospital ? (
            <InfoRow
              icon="medical-outline"
              iconColor={SECONDARY}
              label="Hospital más cercano"
              value={
                ad.hospital.name +
                (ad.hospital.city ? ` · ${ad.hospital.city}` : "")
              }
            />
          ) : null}
        </View>

        {/* ── Disponibilidad ── */}
        {(ad.available_from || ad.available_to) ? (
          <View style={styles.block}>
            <SectionHeader icon="calendar-outline" title="Disponibilidad" />
            {ad.available_from ? (
              <InfoRow
                icon="arrow-forward-outline"
                iconColor={PRIMARY}
                label="Disponible desde"
                value={formatDateOnly(ad.available_from)}
              />
            ) : null}
            {ad.available_to ? (
              <InfoRow
                icon="arrow-back-outline"
                iconColor={TEXT_MEDIUM}
                label="Disponible hasta"
                value={formatDateOnly(ad.available_to)}
              />
            ) : null}
          </View>
        ) : null}

        {/* ── Descripción ── */}
        <View style={styles.block}>
          <SectionHeader icon="document-text-outline" title="Descripción" />
          <Text style={styles.descriptionText}>{ad.description}</Text>
        </View>

        {/* ── Publicado por ── */}
        {ad.user ? (
          <View style={styles.block}>
            <SectionHeader icon="person-outline" title="Publicado por" />
            <View style={styles.authorRow}>
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>
                  {(ad.user.name?.[0] || "").toUpperCase()}
                  {(ad.user.surname?.[0] || "").toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.authorName} numberOfLines={1} ellipsizeMode="tail">
                  {(() => {
                    const fullName = `${ad.user.name || ""} ${ad.user.surname || ""}`.trim();
                    const MAX = 24;
                    return fullName.length > MAX ? `${fullName.slice(0, MAX).trimEnd()}...` : fullName;
                  })()}
                </Text>
                {isMyAd && (
                  <Text style={styles.authorSubline}>Tu anuncio</Text>
                )}
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Contactar ── */}
        {!isMyAd && (canOpenAppChat || ad.contact_email || ad.contact_phone) ? (
          <View style={styles.block}>
            <SectionHeader icon="call-outline" title="Contactar" />
            {!canOpenAppChat && ad.preferred_contact ? (
              <Text style={styles.preferredLabel}>
                Método preferido:{" "}
                <Text style={styles.preferredValue}>
                  {ad.preferred_contact === "email" ? "Email" : "Teléfono"}
                </Text>
              </Text>
            ) : null}
            <View style={styles.contactBtns}>
              {canOpenAppChat ? (
                <DirectChatButton
                  style={styles.contactBtnPrimary}
                  onPress={handleOpenChat}
                  disabled={openingChat}
                  loading={openingChat}
                />
              ) : null}
              {ad.contact_email ? (
                <TouchableOpacity
                  style={
                    canOpenAppChat
                      ? styles.contactBtnSecondary
                      : styles.contactBtnPrimary
                  }
                  onPress={() => handleContact("email", ad.contact_email)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mail-outline" size={18} color={WHITE} />
                  <Text style={styles.contactBtnText}>{ad.contact_email}</Text>
                </TouchableOpacity>
              ) : null}
              {ad.contact_phone ? (
                <TouchableOpacity
                  style={styles.contactBtnSecondary}
                  onPress={() => handleContact("phone", ad.contact_phone)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="call-outline" size={18} color={WHITE} />
                  <Text style={styles.contactBtnText}>{ad.contact_phone}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── Fotos ── */}
        {ad.images && ad.images.length > 1 ? (
          <View style={styles.block}>
            <SectionHeader
              icon="images-outline"
              title={`Fotos (${ad.images.length})`}
            />
            <View style={styles.thumbGrid}>
              {ad.images.map((image, index) => {
                const url = getImageUrl(image.object_path);
                if (!url) return null;
                return (
                  <TouchableOpacity
                    key={image.id || index}
                    style={styles.thumbCell}
                    onPress={() => handleImagePress(image.object_path)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── Footer ── */}
        <Text style={styles.footerDate}>
          Publicado el {formatDateOnly(ad.created_at)}
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Image lightbox ── */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={26} color={WHITE} />
          </TouchableOpacity>
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
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

  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerDangerBtn: {
    backgroundColor: "rgba(239,68,68,0.22)",
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // ── Loading / Error states ──
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  stateText: {
    marginTop: 14,
    fontSize: 15,
    color: TEXT_MEDIUM,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ERROR + "10",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: TEXT_MEDIUM,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  retryBtnText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "700",
  },

  // ── Hero image ──
  heroImage: {
    width: "100%",
    height: 240,
    backgroundColor: "#F1F5F9",
  },
  heroBadges: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    gap: 8,
  },
  noimgBadges: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  kindBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  kindBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: 0.2,
  },
  inactiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: TEXT_MEDIUM,
  },

  // ── Block ──
  block: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // ── Section header (same as CreateHousingAdScreen) ──
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: PRIMARY + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: ACCENT,
  },

  // ── Title + price block ──
  adTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 30,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceText: {
    fontSize: 20,
    fontWeight: "700",
    color: SECONDARY,
  },

  // ── Info rows ──
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  infoIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  infoTextGroup: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_LIGHT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: TEXT_DARK,
    fontWeight: "500",
    lineHeight: 20,
  },

  // ── Description ──
  descriptionText: {
    fontSize: 15,
    color: TEXT_DARK,
    lineHeight: 24,
  },

  // ── Author ──
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SECONDARY + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: SECONDARY,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  authorSubline: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "500",
    marginTop: 2,
  },

  // ── Contact ──
  preferredLabel: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    marginBottom: 12,
  },
  preferredValue: {
    fontWeight: "600",
    color: PRIMARY,
  },
  contactBtns: {
    gap: 10,
  },
  contactBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: PRIMARY,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  contactBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SECONDARY,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  contactBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: WHITE,
  },

  // ── Photo thumbnails ──
  thumbGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  thumbCell: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },

  // ── Footer date ──
  footerDate: {
    textAlign: "center",
    fontSize: 12,
    color: TEXT_LIGHT,
    marginTop: 20,
  },

  // ── Lightbox ──
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxCloseBtn: {
    position: "absolute",
    top: 52,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
  },
});
