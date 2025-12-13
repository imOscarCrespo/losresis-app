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
import { prepareHospitalOptions, prepareCityOptions } from "../utils/profileOptions";
import { createHousingAd, updateHousingAd, getHousingAdById } from "../services/housingService";
import { getCachedUserId } from "../services/authService";
import { COLORS } from "../constants/colors";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Pantalla para crear o editar un anuncio de vivienda
 * @param {string} adId - ID del anuncio a editar (opcional, si no se proporciona, se crea uno nuevo)
 */
export default function CreateHousingAdScreen({ adId, onBack, onSuccess, userProfile }) {
  const isEditMode = !!adId;
  // Estados del formulario
  const [formData, setFormData] = useState({
    kind: "seek", // "seek" o "offer"
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
  const [existingImages, setExistingImages] = useState([]); // Imágenes que ya existen en el anuncio
  const [loading, setLoading] = useState(false);
  const [loadingAd, setLoadingAd] = useState(isEditMode);
  const [error, setError] = useState(null);

  // Hooks
  const { hospitals, uniqueCities } = useHospitals();

  // Preparar opciones para los selectores
  const hospitalOptions = useMemo(
    () => prepareHospitalOptions(hospitals),
    [hospitals]
  );

  const cityOptions = useMemo(
    () => prepareCityOptions(uniqueCities),
    [uniqueCities]
  );

  // Cargar anuncio si estamos en modo edición
  useEffect(() => {
    if (isEditMode && adId) {
      const loadAd = async () => {
        try {
          setLoadingAd(true);
          const { success, ad, error: err } = await getHousingAdById(adId);
          
          if (success && ad) {
            // Pre-llenar el formulario con los datos del anuncio
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
            
            // Guardar las imágenes existentes
            if (ad.images && ad.images.length > 0) {
              setExistingImages(ad.images);
            }
          } else {
            setError(err || "No se pudo cargar el anuncio");
          }
        } catch (err) {
          setError("Error al cargar el anuncio");
          console.error("Error loading ad:", err);
        } finally {
          setLoadingAd(false);
        }
      };
      
      loadAd();
    }
  }, [isEditMode, adId]);

  // Solicitar permisos para la galería
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permisos necesarios",
          "Se necesitan permisos para acceder a la galería de fotos."
        );
      }
    })();
  }, []);

  // Actualizar campo del formulario
  const updateFormData = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error cuando el usuario empiece a escribir
    if (error) setError(null);
  }, [error]);

  // Eliminar imagen existente
  const removeExistingImage = useCallback((index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Seleccionar imágenes
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
        const totalImages = existingImages.length + selectedImages.length;
        const newImages = result.assets.slice(0, 5 - totalImages);
        setSelectedImages((prev) => [...prev, ...newImages]);
      }
    } catch (err) {
      console.error("Error selecting images:", err);
      Alert.alert("Error", "No se pudieron seleccionar las imágenes");
    }
  }, [selectedImages, existingImages]);

  // Eliminar imagen
  const removeImage = useCallback((index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Validar formulario
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

  // Manejar envío del formulario
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditMode && adId) {
        // MODO EDICIÓN
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

        console.log("📤 Updating housing ad...", adId);

        const result = await updateHousingAd(adId, submitData);

        if (result.success) {
          Alert.alert(
            "¡Anuncio actualizado!",
            "Tu anuncio ha sido actualizado correctamente",
            [
              {
                text: "OK",
                onPress: () => {
                  if (onSuccess) onSuccess();
                  if (onBack) onBack();
                },
              },
            ]
          );
        } else {
          setError(result.error || "Error al actualizar el anuncio");
        }
      } else {
        // MODO CREACIÓN
        // Obtener userId desde caché
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

        console.log("📤 Creating housing ad...", {
          ...submitData,
          images: submitData.images.map((img) => img.fileName),
        });

        const result = await createHousingAd(submitData);

        if (result.success) {
          Alert.alert(
            "¡Anuncio creado!",
            "Tu anuncio de vivienda ha sido publicado correctamente",
            [
              {
                text: "OK",
                onPress: () => {
                  if (onSuccess) onSuccess();
                  if (onBack) onBack();
                },
              },
            ]
          );
        } else {
          setError(result.error || "Error al crear el anuncio");
        }
      }
    } catch (err) {
      console.error("Error submitting housing ad:", err);
      setError("Error inesperado al enviar el anuncio");
    } finally {
      setLoading(false);
    }
  }, [isEditMode, adId, formData, selectedImages, onBack, onSuccess]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? "Editar Anuncio" : "Crear Anuncio"}
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading Ad */}
        {loadingAd ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            <Text style={styles.loadingText}>Cargando anuncio...</Text>
          </View>
        ) : (
          <>
        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={COLORS.ERROR} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Kind Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de anuncio *</Text>
          <View style={styles.kindContainer}>
            <TouchableOpacity
              style={[
                styles.kindButton,
                formData.kind === "seek" && styles.kindButtonActiveSeek,
              ]}
              onPress={() => updateFormData("kind", "seek")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="search"
                size={24}
                color={formData.kind === "seek" ? COLORS.PRIMARY : COLORS.GRAY}
              />
              <Text
                style={[
                  styles.kindButtonTitle,
                  formData.kind === "seek" && styles.kindButtonTitleActive,
                ]}
              >
                Busco habitación
              </Text>
              <Text style={styles.kindButtonSubtitle}>
                Estoy buscando una habitación
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.kindButton,
                formData.kind === "offer" && styles.kindButtonActiveOffer,
              ]}
              onPress={() => updateFormData("kind", "offer")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="home"
                size={24}
                color={formData.kind === "offer" ? COLORS.SUCCESS : COLORS.GRAY}
              />
              <Text
                style={[
                  styles.kindButtonTitle,
                  formData.kind === "offer" && styles.kindButtonTitleActiveOffer,
                ]}
              >
                Ofrezco habitación
              </Text>
              <Text style={styles.kindButtonSubtitle}>
                Tengo una habitación disponible
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* City */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ciudad *</Text>
          <SelectFilter
            label=""
            value={formData.city}
            onSelect={(city) => updateFormData("city", city)}
            options={cityOptions}
            placeholder="Selecciona una ciudad"
            enableSearch={true}
          />
        </View>

        {/* Hospital */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hospital más cercano *</Text>
          <SelectFilter
            label=""
            value={formData.hospital_id}
            onSelect={(hospitalId) => updateFormData("hospital_id", hospitalId)}
            options={hospitalOptions}
            placeholder="Selecciona el hospital más cercano"
            enableSearch={true}
          />
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Título del anuncio *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(text) => updateFormData("title", text)}
            placeholder="Ej: Habitación cerca del Hospital La Paz"
            placeholderTextColor={COLORS.TEXT_LIGHT}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={formData.description}
            onChangeText={(text) => updateFormData("description", text)}
            placeholder="Describe la habitación, ubicación, condiciones, etc..."
            placeholderTextColor={COLORS.TEXT_LIGHT}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Price and Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Precio y disponibilidad</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Precio (€/mes)</Text>
            <TextInput
              style={styles.input}
              value={formData.price_eur}
              onChangeText={(text) => updateFormData("price_eur", text)}
              placeholder="Ej: 400"
              placeholderTextColor={COLORS.TEXT_LIGHT}
              keyboardType="numeric"
            />
          </View>

          <DatePickerInput
            label="Disponible desde"
            value={formData.available_from}
            onChange={(date) => updateFormData("available_from", date)}
            placeholder="Seleccionar fecha de inicio"
          />

          <DatePickerInput
            label="Disponible hasta"
            value={formData.available_to}
            onChange={(date) => updateFormData("available_to", date)}
            placeholder="Seleccionar fecha de fin"
          />
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de contacto *</Text>
          <Text style={styles.sectionSubtitle}>
            Debe proporcionar al menos un método de contacto
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email de contacto</Text>
            <TextInput
              style={styles.input}
              value={formData.contact_email}
              onChangeText={(text) => updateFormData("contact_email", text)}
              placeholder="tu@email.com"
              placeholderTextColor={COLORS.TEXT_LIGHT}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Teléfono de contacto</Text>
            <TextInput
              style={styles.input}
              value={formData.contact_phone}
              onChangeText={(text) => updateFormData("contact_phone", text)}
              placeholder="123 456 789"
              placeholderTextColor={COLORS.TEXT_LIGHT}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Método de contacto preferido</Text>
            <SelectFilter
              label=""
              value={formData.preferred_contact}
              onSelect={(method) => updateFormData("preferred_contact", method)}
              options={[
                { id: "email", name: "Email" },
                { id: "phone", name: "Teléfono" },
              ]}
              placeholder="Selecciona un método"
              enableSearch={false}
            />
          </View>
        </View>

        {/* Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Imágenes (máximo 5)</Text>

          {/* Existing Images (modo edición) */}
          {isEditMode && existingImages.length > 0 && (
            <View style={styles.imagesGrid}>
              {existingImages.map((image, index) => {
                const imageUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/housing_ad/${image.object_path}`;
                return (
                  <View key={`existing-${image.id}`} style={styles.imageItem}>
                    <Image source={{ uri: imageUrl }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeExistingImage(index)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={24} color={COLORS.ERROR} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* Selected Images (nuevas) */}
          {selectedImages.length > 0 && (
            <View style={styles.imagesGrid}>
              {selectedImages.map((image, index) => (
                <View key={`new-${index}`} style={styles.imageItem}>
                  <Image source={{ uri: image.uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={24} color={COLORS.ERROR} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add Images Button */}
          {(existingImages.length + selectedImages.length) < 5 && (
            <TouchableOpacity
              style={styles.addImagesButton}
              onPress={handleImageSelect}
              activeOpacity={0.7}
            >
              <Ionicons name="images" size={32} color={COLORS.GRAY} />
              <Text style={styles.addImagesText}>
                Seleccionar imágenes
              </Text>
              <Text style={styles.addImagesSubtext}>
                {existingImages.length + selectedImages.length}/5 imágenes
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.WHITE} />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEditMode ? "Actualizar Anuncio" : "Crear Anuncio"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
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
    backgroundColor: COLORS.BACKGROUND_LIGHT,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
  },
  headerPlaceholder: {
    width: 70,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.TEXT_MEDIUM,
  },
  contentContainer: {
    padding: 16,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.ERROR_LIGHT || "#FEE2E2",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ERROR,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
    marginBottom: 12,
  },
  kindContainer: {
    flexDirection: "row",
    gap: 12,
  },
  kindButton: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  kindButtonActiveSeek: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.BADGE_BLUE_BG || "#EFF6FF",
  },
  kindButtonActiveOffer: {
    borderColor: COLORS.SUCCESS,
    backgroundColor: COLORS.SUCCESS_LIGHT || "#F0FDF4",
  },
  kindButtonTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginTop: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  kindButtonTitleActive: {
    color: COLORS.PRIMARY,
  },
  kindButtonTitleActiveOffer: {
    color: COLORS.SUCCESS,
  },
  kindButtonSubtitle: {
    fontSize: 12,
    color: COLORS.TEXT_MEDIUM,
    textAlign: "center",
  },
  input: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
  },
  inputMultiline: {
    height: 100,
    paddingTop: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.TEXT_DARK,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroupHalf: {
    flex: 1,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  imageItem: {
    width: (100 / 3) + "%",
    aspectRatio: 1,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
  },
  addImagesButton: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  addImagesText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.TEXT_DARK,
    marginTop: 8,
  },
  addImagesSubtext: {
    fontSize: 12,
    color: COLORS.TEXT_MEDIUM,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  bottomSpacing: {
    height: 32,
  },
});

