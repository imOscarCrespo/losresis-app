import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Icon } from "./Icon";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../constants/colors";
import { uploadRoommateAvatar } from "../services/roommateService";
import { updateUserProfile } from "../services/userService";
import { getRoommateAvatarUrl } from "../utils/roommateUtils";

/**
 * Avatar circular grande y centrado para la cabecera de "Mi perfil" (vista
 * tipo LinkedIn). Al pulsarlo abre la galería y sube la foto al bucket
 * `roommate-avatar`, guardando la ruta en `users.avatar_url`.
 */
export const ProfileHeaderAvatar = ({ userId, avatarUrl, onAvatarUpdated }) => {
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
        mediaTypes: ["images"],
        quality: 0.8,
        aspect: [1, 1],
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
        Alert.alert("Error", uploadResult.error || "No se pudo subir la imagen.");
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
    <Pressable
      onPress={handlePick}
      disabled={uploading || !userId}
      style={styles.wrap}
    >
      <View style={styles.avatarWrap}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.avatar} />
        ) : (
          <Icon name="person" size={56} color={COLORS.GRAY} />
        )}
        {uploading ? (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={styles.cameraBadge}>
        <Icon name="camera" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
};

const AVATAR_SIZE = 104;

const styles = StyleSheet.create({
  wrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignSelf: "center",
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.GRAY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#FFFFFF",
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
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
