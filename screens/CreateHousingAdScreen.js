import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { SelectFilter } from "../components/SelectFilter";
import { DatePickerInput } from "../components/DatePickerInput";
import { useHospitals } from "../hooks/useHospitals";
import {
  prepareHospitalOptions,
  prepareCityOptions,
} from "../utils/profileOptions";
import {
  createHousingAd,
  updateHousingAd,
  getHousingAdById,
} from "../services/housingService";
import { getCachedUserId } from "../services/authService";
import posthogLogger from "../services/posthogService";

// ============================================================================
// COLORS
// ============================================================================

const PRIMARY = "#670CF5";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F7F5FB";
const WHITE = "#FFFFFF";
const TEXT_DARK = "#1E293B";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#E8E0F5";
const ERROR = "#EF4444";
const ERROR_BG = "#FEF2F2";

// ============================================================================
// SECTION HEADER
// ============================================================================

const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIconWrap}>
      <Ionicons name={icon} size={16} color={PRIMARY} />
    </View>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateHousingAdScreen({
  adId,
  onBack,
  onSuccess,
  userProfile,
}) {
  const isEditMode = !!adId;

  const [formData, setFormData] = useState({
    kind: "seek",
    city: "",
    title: "",
    description: "",
    price_eur: "",
    available_from: "",
    available_to: "",
    hospital_id: "",
    contact_email: userProfile?.work_email || "",
    contact_phone: userProfile?.phone || "",
    preferred_contact: "email",
  });

  const [selectedImages, setSelectedImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAd, setLoadingAd] = useState(isEditMode);
  const [error, setError] = useState(null);

  const { hospitals, uniqueCities } = useHospitals();

  const hospitalOptions = useMemo(
    () => prepareHospitalOptions(hospitals),
    [hospitals]
  );

  const cityOptions = useMemo(
    () => prepareCityOptions(uniqueCities),
    [uniqueCities]
  );

  useEffect(() => {
    const screenName = isEditMode
      ? "CreateHousingAdScreen_Edit"
      : "CreateHousingAdScreen_Create";
    posthogLogger.logScreen(screenName, { adId, isEditMode });
  }, [isEditMode, adId]);

  useEffect(() => {
    if (isEditMode && adId) {
      const loadAd = async () => {
        try {
          setLoadingAd(true);
          const { success, ad, error: err } = await getHousingAdById(adId);
          if (success && ad) {
            setFormData({
              kind: ad.kind || "seek",
              city: ad.city || "",
              title: ad.title || "",
              description: ad.description || "",
              price_eur: ad.price_eur ? String(ad.price_eur) : "",
              available_from: ad.available_from || "",
              available_to: ad.available_to || "",
              hospital_id: ad.hospital_id || "",
              contact_email: ad.contact_email || "",
              contact_phone: ad.contact_phone || "",
              preferred_contact: ad.preferred_contact || "email",
            });
            if (ad.images && ad.images.length > 0) {
              setExistingImages(ad.images);
            }
          } else {
            setError(err || "No se pudo cargar el anuncio");
          }
        } catch (err) {
          setError("Error al cargar el anuncio");
        } finally {
          setLoadingAd(false);
        }
      };
      loadAd();
    }
  }, [isEditMode, adId]);

  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permisos necesarios",
          "Se necesitan permisos para acceder a la galería de fotos."
        );
      }
    })();
  }, []);

  const updateFormData = useCallback(
    (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (error) setError(null);
    },
    [error]
  );

  const removeExistingImage = useCallback((index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImageSelect = useCallback(async () => {
    const totalImages = existingImages.length + selectedImages.length;
    if (totalImages >= 5) {
      Alert.alert("Límite alcanzado", "Puedes tener un máximo de 5 imágenes");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets) {
        const remaining = 5 - existingImages.length - selectedImages.length;
        const newImages = result.assets.slice(0, remaining);
        setSelectedImages((prev) => [...prev, ...newImages]);
      }
    } catch (err) {
      Alert.alert("Error", "No se pudieron seleccionar las imágenes");
    }
  }, [selectedImages, existingImages]);

  const removeImage = useCallback((index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const validateForm = () => {
    if (!formData.city.trim()) {
      setError("La ciudad es obligatoria");
      return false;
    }
    if (!formData.hospital_id) {
      setError("El hospital más cercano es obligatorio");
      return false;
    }
    if (!formData.title.trim()) {
      setError("El título es obligatorio");
      return false;
    }
    if (!formData.description.trim()) {
      setError("La descripción es obligatoria");
      return false;
    }
    if (!formData.contact_email?.trim() && !formData.contact_phone?.trim()) {
      setError("Debe proporcionar al menos un método de contacto");
      return false;
    }
    return true;
  };

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      if (isEditMode && adId) {
        const submitData = {
          kind: formData.kind,
          city: formData.city,
          title: formData.title,
          description: formData.description,
          price_eur: formData.price_eur ? parseInt(formData.price_eur) : null,
          available_from: formData.available_from || null,
          available_to: formData.available_to || null,
          hospital_id: formData.hospital_id,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          preferred_contact: formData.preferred_contact || null,
        };

        const result = await updateHousingAd(adId, submitData);
        if (result.success) {
          Alert.alert(
            "¡Anuncio actualizado!",
            "Tu anuncio ha sido actualizado correctamente",
            [{ text: "OK", onPress: () => { onSuccess?.(); onBack?.(); } }]
          );
        } else {
          setError(result.error || "Error al actualizar el anuncio");
        }
      } else {
        const userId = await getCachedUserId();
        if (!userId) {
          setError("No se pudo obtener el usuario. Por favor, inicia sesión nuevamente.");
          return;
        }

        const submitData = {
          user_id: userId,
          kind: formData.kind,
          city: formData.city,
          title: formData.title,
          description: formData.description,
          price_eur: formData.price_eur ? parseInt(formData.price_eur) : null,
          available_from: formData.available_from || null,
          available_to: formData.available_to || null,
          hospital_id: formData.hospital_id,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          preferred_contact: formData.preferred_contact || null,
          images: selectedImages,
        };

        const result = await createHousingAd(submitData);
        if (result.success) {
          Alert.alert(
            "¡Anuncio publicado!",
            "Tu anuncio de vivienda ha sido publicado correctamente",
            [{ text: "OK", onPress: () => { onSuccess?.(); onBack?.(); } }]
          );
        } else {
          setError(result.error || "Error al crear el anuncio");
        }
      }
    } catch (err) {
      setError("Error inesperado al enviar el anuncio");
    } finally {
      setLoading(false);
    }
  }, [isEditMode, adId, formData, selectedImages, onBack, onSuccess]);

  const totalImageCount = existingImages.length + selectedImages.length;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
          disabled={loading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? "Editar anuncio" : "Crear anuncio"}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loadingAd ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Cargando anuncio...</Text>
          </View>
        ) : (
          <>
            {/* ── Error banner ── */}
            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={ERROR} />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* ── Kind selector ── */}
            <View style={styles.block}>
              <SectionHeader icon="home-outline" title="¿Qué estás buscando?" />
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    formData.kind === "seek" && styles.segmentBtnActive,
                  ]}
                  onPress={() => updateFormData("kind", "seek")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="search-outline"
                    size={16}
                    color={formData.kind === "seek" ? PRIMARY : TEXT_MEDIUM}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      formData.kind === "seek" && styles.segmentBtnTextActive,
                    ]}
                  >
                    Busco piso
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    formData.kind === "offer" && styles.segmentBtnActive,
                  ]}
                  onPress={() => updateFormData("kind", "offer")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="home-outline"
                    size={16}
                    color={formData.kind === "offer" ? PRIMARY : TEXT_MEDIUM}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      formData.kind === "offer" && styles.segmentBtnTextActive,
                    ]}
                  >
                    Ofrezco habitación
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Location ── */}
            <View style={styles.block}>
              <SectionHeader icon="location-outline" title="Ubicación" />

              <Text style={styles.inputLabel}>Ciudad *</Text>
              <SelectFilter
                label=""
                value={formData.city}
                onSelect={(c) => updateFormData("city", c)}
                options={cityOptions}
                placeholder="Selecciona una ciudad"
                enableSearch={true}
              />

              <View style={styles.spacer} />

              <Text style={styles.inputLabel}>Hospital más cercano *</Text>
              <SelectFilter
                label=""
                value={formData.hospital_id}
                onSelect={(h) => updateFormData("hospital_id", h)}
                options={hospitalOptions}
                placeholder="Selecciona el hospital más cercano"
                enableSearch={true}
              />
            </View>

            {/* ── Ad details ── */}
            <View style={styles.block}>
              <SectionHeader icon="document-text-outline" title="Detalles del anuncio" />

              <Text style={styles.inputLabel}>Título *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(t) => updateFormData("title", t)}
                placeholder="Ej: Habitación cerca del Hospital La Paz"
                placeholderTextColor={TEXT_LIGHT}
              />

              <View style={styles.spacer} />

              <Text style={styles.inputLabel}>Descripción *</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={formData.description}
                onChangeText={(t) => updateFormData("description", t)}
                placeholder="Describe la habitación, condiciones, puntos fuertes..."
                placeholderTextColor={TEXT_LIGHT}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* ── Price & availability ── */}
            <View style={styles.block}>
              <SectionHeader icon="cash-outline" title="Precio y disponibilidad" />

              <Text style={styles.inputLabel}>Precio mensual (€)</Text>
              <View style={styles.priceInputRow}>
                <View style={styles.pricePrefix}>
                  <Text style={styles.pricePrefixText}>€</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.priceInput]}
                  value={formData.price_eur}
                  onChangeText={(t) => updateFormData("price_eur", t)}
                  placeholder="Ej: 450"
                  placeholderTextColor={TEXT_LIGHT}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.spacer} />

              <View style={styles.datesRow}>
                <View style={styles.dateField}>
                  <DatePickerInput
                    label="Disponible desde"
                    value={formData.available_from}
                    onChange={(d) => updateFormData("available_from", d)}
                    placeholder="Fecha de inicio"
                  />
                </View>
                <View style={styles.dateField}>
                  <DatePickerInput
                    label="Hasta"
                    value={formData.available_to}
                    onChange={(d) => updateFormData("available_to", d)}
                    placeholder="Fecha de fin"
                  />
                </View>
              </View>
            </View>

            {/* ── Images ── */}
            <View style={styles.block}>
              <SectionHeader icon="images-outline" title="Fotos" />
              <Text style={styles.inputHint}>
                Añade hasta 5 fotos para dar más visibilidad a tu anuncio
              </Text>

              <View style={styles.imagesGrid}>
                {/* Existing images */}
                {isEditMode &&
                  existingImages.map((image, index) => {
                    const imageUrl = `${supabaseUrl}/storage/v1/object/public/housing_ad/${image.object_path}`;
                    return (
                      <View key={`existing-${image.id}`} style={styles.imageCell}>
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.imageThumb}
                        />
                        <TouchableOpacity
                          style={styles.removeImageBtn}
                          onPress={() => removeExistingImage(index)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close" size={12} color={WHITE} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                {/* New images */}
                {selectedImages.map((image, index) => (
                  <View key={`new-${index}`} style={styles.imageCell}>
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.imageThumb}
                    />
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={() => removeImage(index)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={12} color={WHITE} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add button */}
                {totalImageCount < 5 && (
                  <TouchableOpacity
                    style={styles.addImageCell}
                    onPress={handleImageSelect}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-outline" size={24} color={PRIMARY} />
                    <Text style={styles.addImageCellText}>
                      {totalImageCount === 0 ? "Añadir fotos" : "Añadir más"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {totalImageCount > 0 && (
                <Text style={styles.imageCount}>
                  {totalImageCount}/5 imágenes
                </Text>
              )}
            </View>

            {/* ── Contact ── */}
            <View style={styles.block}>
              <SectionHeader icon="call-outline" title="Información de contacto" />
              <Text style={styles.inputHint}>
                Proporciona al menos un método de contacto
              </Text>

              <Text style={styles.inputLabel}>Email de contacto</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_email}
                onChangeText={(t) => updateFormData("contact_email", t)}
                placeholder="tu@email.com"
                placeholderTextColor={TEXT_LIGHT}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.spacer} />

              <Text style={styles.inputLabel}>Teléfono de contacto</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_phone}
                onChangeText={(t) => updateFormData("contact_phone", t)}
                placeholder="123 456 789"
                placeholderTextColor={TEXT_LIGHT}
                keyboardType="phone-pad"
              />

              <View style={styles.spacer} />

              <Text style={styles.inputLabel}>Método de contacto preferido</Text>
              <SelectFilter
                label=""
                value={formData.preferred_contact}
                onSelect={(m) => updateFormData("preferred_contact", m)}
                options={[
                  { id: "email", name: "Email" },
                  { id: "phone", name: "Teléfono" },
                ]}
                placeholder="Selecciona un método"
                enableSearch={false}
              />
            </View>

            {/* ── Footer actions ── */}
            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onBack}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>
                      {isEditMode ? "Actualizar" : "Publicar anuncio"}
                    </Text>
                    {!isEditMode && (
                      <Ionicons name="arrow-forward" size={16} color={WHITE} />
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: WHITE,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY + "10",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: ACCENT,
    letterSpacing: -0.2,
  },
  headerRight: {
    width: 36,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  // ── Loading ──
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: TEXT_MEDIUM,
  },

  // ── Error ──
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: ERROR_BG,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: ERROR,
    lineHeight: 20,
  },

  // ── Block ──
  block: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // ── Section header ──
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

  // ── Segmented control ──
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: BG_LIGHT,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: WHITE,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_MEDIUM,
  },
  segmentBtnTextActive: {
    color: PRIMARY,
    fontWeight: "700",
  },

  // ── Inputs ──
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_DARK,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 13,
    color: TEXT_MEDIUM,
    marginBottom: 14,
    lineHeight: 18,
  },
  input: {
    backgroundColor: BG_LIGHT,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_DARK,
  },
  inputMultiline: {
    height: 100,
    paddingTop: 12,
  },
  spacer: {
    height: 14,
  },

  // ── Price input ──
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  pricePrefix: {
    backgroundColor: PRIMARY + "12",
    borderWidth: 1.5,
    borderRightWidth: 0,
    borderColor: BORDER,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pricePrefixText: {
    fontSize: 16,
    fontWeight: "700",
    color: PRIMARY,
  },
  priceInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },

  // ── Dates ──
  datesRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateField: {
    flex: 1,
  },

  // ── Images ──
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageCell: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  imageThumb: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  addImageCell: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: PRIMARY + "50",
    backgroundColor: PRIMARY + "06",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addImageCellText: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: "600",
    textAlign: "center",
  },
  imageCount: {
    marginTop: 10,
    fontSize: 12,
    color: TEXT_MEDIUM,
    textAlign: "right",
  },

  // ── Footer actions ──
  footerActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_MEDIUM,
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: WHITE,
  },
});
