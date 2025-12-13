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
import { useHousingAds } from "../hooks/useHousingAds";
import { formatDateOnly } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import { getCurrentUser } from "../services/authService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_SIZE = (SCREEN_WIDTH - 64) / 3; // 3 columnas con padding

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

/**
 * Obtiene la URL de la imagen desde Supabase Storage
 */
const getImageUrl = (imagePath) => {
  if (!imagePath) return "";
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn("EXPO_PUBLIC_SUPABASE_URL is not defined");
    return "";
  }
  // El path en la base de datos es algo como "userId/filename.jpg"
  // Necesitamos construir la URL completa del bucket housing_ad
  return `${supabaseUrl}/storage/v1/object/public/housing_ad/${imagePath}`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Pantalla de detalle de anuncio de vivienda
 */
export default function HousingAdDetailScreen({ adId, onBack, userProfile, onEdit, onDelete }) {
  const { fetchHousingAdById, deleteHousingAd } = useHousingAds();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Cargar usuario actual
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const { success, user } = await getCurrentUser();
        if (success && user) {
          setCurrentUserId(user.id);
        }
      } catch (err) {
        console.error("Error loading current user:", err);
      }
    };
    loadCurrentUser();
  }, []);

  // Cargar anuncio
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

  // Verificar si es mi anuncio
  const isMyAd = useMemo(() => {
    return currentUserId && ad && ad.user_id === currentUserId;
  }, [currentUserId, ad]);

  // Manejar contacto
  const handleContact = useCallback((type, value) => {
    if (type === "email" && value) {
      Linking.openURL(`mailto:${value}`);
    } else if (type === "phone" && value) {
      Linking.openURL(`tel:${value}`);
    }
  }, []);

  // Manejar editar
  const handleEdit = useCallback(() => {
    if (onEdit && adId) {
      onEdit(adId);
    }
  }, [onEdit, adId]);

  // Manejar eliminar
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
              if (success && onDelete) {
                onDelete(adId);
              } else if (success && onBack) {
                onBack();
              }
            } catch (err) {
              Alert.alert("Error", "No se pudo eliminar el anuncio");
            }
          },
        },
      ]
    );
  }, [adId, deleteHousingAd, onDelete, onBack]);

  // Manejar cierre del modal de imagen
  const handleCloseImageModal = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // Manejar press en imagen
  const handleImagePress = useCallback((imagePath) => {
    const imageUrl = getImageUrl(imagePath);
    if (imageUrl) {
      setSelectedImage(imageUrl);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando anuncio...</Text>
        </View>
      </View>
    );
  }

  if (error || !ad) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={COLORS.ERROR} />
          <Text style={styles.errorTitle}>
            {error || "Anuncio no encontrado"}
          </Text>
          <Text style={styles.errorText}>
            El anuncio que buscas no existe o ha sido eliminado.
          </Text>
          <TouchableOpacity
            style={styles.backButtonError}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonErrorText}>Volver a Vivienda</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const kindColor = ad.kind === "offer" ? COLORS.SUCCESS : COLORS.PRIMARY;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header con botón de volver */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.backButtonText}>Volver a Vivienda</Text>
        </TouchableOpacity>
        {isMyAd && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={20} color={COLORS.PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={20} color={COLORS.ERROR} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Card principal */}
      <View style={styles.card}>
        {/* Badges */}
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
          {!ad.is_active && (
            <View style={styles.inactiveBadge}>
              <Ionicons name="eye-off-outline" size={14} color={COLORS.GRAY} />
              <Text style={styles.inactiveBadgeText}>Inactivo</Text>
            </View>
          )}
        </View>

        {/* Título */}
        <Text style={styles.title}>{ad.title}</Text>

        {/* Ciudad y precio */}
        <View style={styles.locationPriceContainer}>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={18} color={COLORS.PRIMARY} />
            <Text style={styles.locationText}>{ad.city}</Text>
          </View>
          {ad.price_eur && (
            <View style={styles.priceContainer}>
              <Ionicons name="cash" size={18} color={COLORS.SUCCESS} />
              <Text style={styles.priceText}>
                {formatPrice(ad.price_eur)}/mes
              </Text>
            </View>
          )}
        </View>

        {/* Información del usuario */}
        {ad.user && (
          <View style={styles.userContainer}>
            <Ionicons name="person-circle" size={18} color={COLORS.GRAY} />
            <Text style={styles.userText}>
              Por: {ad.user.name} {ad.user.surname}
            </Text>
          </View>
        )}

        {/* Fechas disponibles */}
        {(ad.available_from || ad.available_to) && (
          <View style={styles.dateContainer}>
            <Ionicons name="calendar" size={18} color={COLORS.GRAY} />
            <Text style={styles.dateText}>
              {ad.available_from && `Disponible desde: ${formatDateOnly(ad.available_from)}`}
              {ad.available_from && ad.available_to && "\n"}
              {ad.available_to && `Disponible hasta: ${formatDateOnly(ad.available_to)}`}
            </Text>
          </View>
        )}

        {/* Hospital más cercano */}
        {ad.hospital && (
          <View style={styles.hospitalContainer}>
            <Ionicons name="medical" size={18} color={COLORS.PURPLE} />
            <Text style={styles.hospitalText}>
              Hospital más cercano: {ad.hospital.name}
              {ad.hospital.city && ` (${ad.hospital.city})`}
            </Text>
          </View>
        )}

        {/* Descripción */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>Descripción</Text>
          <Text style={styles.descriptionText}>{ad.description}</Text>
        </View>

        {/* Información de contacto (solo si no es mi anuncio) */}
        {!isMyAd && (ad.contact_email || ad.contact_phone) && (
          <View style={styles.contactContainer}>
            <Text style={styles.contactTitle}>Contacto</Text>
            <View style={styles.contactItems}>
              {ad.contact_email && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleContact("email", ad.contact_email)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mail" size={20} color={COLORS.PRIMARY} />
                  <Text style={styles.contactText}>{ad.contact_email}</Text>
                </TouchableOpacity>
              )}
              {ad.contact_phone && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleContact("phone", ad.contact_phone)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={20} color={COLORS.SUCCESS} />
                  <Text style={styles.contactText}>{ad.contact_phone}</Text>
                </TouchableOpacity>
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

        {/* Imágenes */}
        {ad.images && ad.images.length > 0 && (
          <View style={styles.imagesContainer}>
            <Text style={styles.imagesTitle}>
              Imágenes ({ad.images.length})
            </Text>
            <View style={styles.imagesGrid}>
              {ad.images.map((image, index) => {
                const imageUrl = getImageUrl(image.object_path);
                if (!imageUrl) return null;

                return (
                  <TouchableOpacity
                    key={image.id || index}
                    style={styles.imageItem}
                    onPress={() => handleImagePress(image.object_path)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Fecha de creación */}
        <View style={styles.footerContainer}>
          <Text style={styles.createdDateText}>
            Publicado el {formatDateOnly(ad.created_at)}
          </Text>
        </View>
      </View>

      {/* Modal de imagen */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseImageModal}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={handleCloseImageModal}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color={COLORS.WHITE} />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.PRIMARY,
    fontWeight: "500",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    padding: 8,
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
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: COLORS.TEXT_MEDIUM,
    textAlign: "center",
    marginBottom: 24,
  },
  backButtonError: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  backButtonErrorText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 0,
    shadowColor: COLORS.BLACK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  kindBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  kindBadgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  inactiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.GRAY_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  inactiveBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.GRAY,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
    marginBottom: 16,
    lineHeight: 36,
  },
  locationPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationText: {
    fontSize: 16,
    color: COLORS.TEXT_DARK,
    fontWeight: "500",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceText: {
    fontSize: 18,
    color: COLORS.SUCCESS,
    fontWeight: "700",
  },
  userContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  userText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
    flex: 1,
    lineHeight: 20,
  },
  hospitalContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  hospitalText: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
  },
  descriptionContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: COLORS.TEXT_DARK,
    lineHeight: 24,
  },
  contactContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginBottom: 12,
  },
  contactItems: {
    gap: 12,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    padding: 12,
    borderRadius: 12,
  },
  contactText: {
    fontSize: 16,
    color: COLORS.TEXT_DARK,
    flex: 1,
  },
  preferredContactText: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
    marginTop: 8,
  },
  imagesContainer: {
    marginBottom: 20,
  },
  imagesTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginBottom: 12,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageItem: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  footerContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  createdDateText: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
    textAlign: "center",
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 10,
  },
  imageModalImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
  },
});

