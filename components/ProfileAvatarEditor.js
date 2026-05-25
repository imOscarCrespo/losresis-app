import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../constants/colors";
import { uploadRoommateAvatar } from "../services/roommateService";
import { updateUserProfile } from "../services/userService";
import { getRoommateAvatarUrl } from "../utils/roommateUtils";

/**
 * Editor de foto de perfil para la pantalla "Mi perfil". Sube la imagen al
 * bucket `roommate-avatar` y guarda la ruta en `users.avatar_url`.
 */
export const ProfileAvatarEditor = ({
  userId,
  avatarUrl,
  userName,
  onAvatarUpdated,
}) => {
  const [uploading, setUploading] = useState(false);
  const [localUri, setLocalUri] = useState(null);

  const previewUri =
    localUri || (avatarUrl ? getRoommateAvatarUrl(avatarUrl) : null);

  const handlePick = async () => {
    if (!userId || uploading) return;
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permisos necesarios",
          "Se necesitan permisos para acceder a la galería de fotos."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        aspect: [4, 3],
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setLocalUri(asset.uri);
      setUploading(true);

      const uploadResult = await uploadRoommateAvatar(
        userId,
        asset,
        avatarUrl || null
      );
      if (!uploadResult.success) {
        Alert.alert(
          "Error",
          uploadResult.error || "No se pudo subir la imagen."
        );
        setLocalUri(null);
        return;
      }

      const updateResult = await updateUserProfile(userId, {
        avatar_url: uploadResult.path,
      });
      if (!updateResult.success) {
        Alert.alert(
          "Error",
          updateResult.error || "No se pudo actualizar el perfil."
        );
        setLocalUri(null);
        return;
      }
      onAvatarUpdated?.(uploadResult.path);
    } catch (err) {
      Alert.alert("Error", "No se pudo seleccionar la imagen.");
      setLocalUri(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrap}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.avatar} />
        ) : (
          <Ionicons name="person" size={36} color={COLORS.GRAY} />
        )}
        {uploading ? (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {userName?.trim() || "Tu perfil"}
        </Text>
        <Text style={styles.subtitle}>
          Tu foto se mostrará en tu perfil y en interacciones con otros usuarios.
        </Text>
        <Pressable
          onPress={handlePick}
          disabled={uploading || !userId}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
            (uploading || !userId) && styles.ctaDisabled,
          ]}
        >
          <Ionicons
            name="camera"
            size={16}
            color={COLORS.PRIMARY}
            style={styles.ctaIcon}
          />
          <Text style={styles.ctaText}>
            {previewUri ? "Cambiar foto" : "Añadir foto"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: 16,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.GRAY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.TEXT_LIGHT,
    marginBottom: 10,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: "#D8B4FE",
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaIcon: {
    marginRight: 6,
  },
  ctaText: {
    color: COLORS.PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
});
