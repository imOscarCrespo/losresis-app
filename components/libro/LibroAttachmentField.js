import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Icon } from "../Icon";
import {
  describeLibroAttachment,
  getLibroAttachmentUrl,
  removeLibroAttachment,
  uploadLibroAttachment,
} from "../../services/libroAttachmentService";

/**
 * El adjunto de un registro del Libro: la prueba de lo que el residente declara.
 *
 * Sube de verdad al bucket privado `libro-attachments`, y su tutor lo puede abrir
 * (política `libro_attachments_teaching_read`, limitada a los residentes de su
 * alcance). Antes esto era un campo de texto donde el residente escribía
 * "sesion.pdf": el fichero no existía en ningún sitio.
 *
 * Tres caminos, porque un certificado llega de tres maneras distintas: en papel (foto),
 * ya fotografiado en el carrete, o como PDF en el correo. Sin el tercero el residente
 * tenía que hacerle una captura de pantalla al PDF, que en un libro que sirve de
 * acreditación queda mal y pierde calidad.
 *
 * Los formatos que se admiten son los que declara el bucket: PDF, JPEG, PNG y WebP.
 */
export const LibroAttachmentField = ({
  value,
  userId,
  section,
  onChange,
  disabled = false,
}) => {
  const [busy, setBusy] = useState(false);
  const current = describeLibroAttachment(value);

  const pickAndUpload = async (source) => {
    // El explorador de ficheros no pide permiso: es el sistema quien elige y solo
    // entrega lo que el usuario ha señalado.
    if (source !== "document") {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Permiso necesario",
          source === "camera"
            ? "Necesitamos la cámara para hacer la foto del documento."
            : "Necesitamos acceso a tus fotos para adjuntar el documento."
        );
        return;
      }
    }

    let result;
    if (source === "camera") {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
    } else if (source === "library") {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
    } else {
      result = await DocumentPicker.getDocumentAsync({
        // Los mismos que declara el bucket: filtrar aquí evita que el residente elija
        // algo que el storage va a rechazar después de la espera de la subida.
        type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
        // Sin copiar a caché, el uri puede caducar antes de que termine la subida.
        copyToCacheDirectory: true,
        multiple: false,
      });
    }

    const asset = result?.assets?.[0];
    if (result?.canceled || !asset?.uri) return;

    setBusy(true);
    try {
      const uploaded = await uploadLibroAttachment({
        userId,
        section,
        file: {
          uri: asset.uri,
          // ImagePicker usa fileName/fileSize; DocumentPicker usa name/size.
          name: asset.name || asset.fileName || "documento.jpg",
          mimeType: asset.mimeType || "image/jpeg",
          size: asset.size ?? asset.fileSize ?? null,
        },
      });

      // Si había uno antes, se retira del bucket: dejarlo sería un huérfano que nadie
      // va a encontrar nunca.
      if (current?.path) {
        await removeLibroAttachment(current.path);
      }

      onChange?.(uploaded);
    } catch (error) {
      console.error("Error uploading attachment:", error);
      Alert.alert(
        "No se pudo adjuntar",
        error?.message || "Inténtalo de nuevo en un momento."
      );
    } finally {
      setBusy(false);
    }
  };

  const openCurrent = async () => {
    if (!current?.path) return;

    setBusy(true);
    try {
      const url = await getLibroAttachmentUrl(current.path);
      if (!url) {
        Alert.alert("No se pudo abrir", "Inténtalo de nuevo en un momento.");
        return;
      }
      await Linking.openURL(url);
    } finally {
      setBusy(false);
    }
  };

  const clearCurrent = () => {
    Alert.alert("Quitar documento", "Se borrará el fichero adjunto.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            if (current?.path) await removeLibroAttachment(current.path);
            onChange?.(null);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (busy) {
    return (
      <View style={styles.busy}>
        <ActivityIndicator size="small" color="#670CF5" />
      </View>
    );
  }

  if (current) {
    return (
      <View style={styles.current}>
        <Icon name="document-attach-outline" size={18} color="#670CF5" />
        <Text style={styles.currentName} numberOfLines={1}>
          {current.name}
        </Text>
        {current.path ? (
          <TouchableOpacity onPress={openCurrent} hitSlop={8}>
            <Text style={styles.action}>Ver</Text>
          </TouchableOpacity>
        ) : null}
        {!disabled ? (
          <TouchableOpacity onPress={clearCurrent} hitSlop={8}>
            <Text style={styles.actionDanger}>Quitar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (disabled) {
    return <Text style={styles.empty}>Sin documento adjunto</Text>;
  }

  return (
    <View style={styles.picker}>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => pickAndUpload("camera")}
        activeOpacity={0.85}
      >
        <Icon name="camera-outline" size={16} color="#670CF5" />
        <Text style={styles.pickerText}>Foto</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => pickAndUpload("library")}
        activeOpacity={0.85}
      >
        <Icon name="images-outline" size={16} color="#670CF5" />
        <Text style={styles.pickerText}>Carrete</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => pickAndUpload("document")}
        activeOpacity={0.85}
      >
        <Icon name="document-outline" size={16} color="#670CF5" />
        <Text style={styles.pickerText}>PDF</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LibroAttachmentField;

const styles = StyleSheet.create({
  busy: { paddingVertical: 14, alignItems: "center" },
  current: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  currentName: { flex: 1, fontSize: 13, fontWeight: "600", color: "#4C1D95" },
  action: { fontSize: 13, fontWeight: "700", color: "#670CF5" },
  actionDanger: { fontSize: 13, fontWeight: "700", color: "#DC2626" },
  empty: { fontSize: 13, color: "#94A3B8" },
  picker: { flexDirection: "row", gap: 8 },
  pickerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#F8FAFC",
  },
  pickerText: { fontSize: 12, fontWeight: "700", color: "#670CF5" },
});
