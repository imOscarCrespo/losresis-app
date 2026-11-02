import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

/**
 * Selectores de ficheros de ResiNotes. Devuelven [{uri, name, mimeType, size}]
 * (lo que espera resinotesService) o [] si el residente cancela.
 * Lanzan Error con userMessage si se deniega el permiso.
 */

const mimeFromName = (name = "") => {
  const ext = String(name).split(".").pop().toLowerCase();
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
      pdf: "application/pdf",
    }[ext] || null
  );
};

const fromImageAsset = (asset, index) => {
  const name = asset.fileName || `foto-${Date.now()}-${index + 1}.jpg`;
  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType || mimeFromName(name) || "image/jpeg",
    size: asset.fileSize ?? null,
  };
};

const permissionError = (what) => {
  const err = new Error("PERMISSION_DENIED");
  err.userMessage = `Permiso denegado: activa el acceso a ${what} en los ajustes del móvil.`;
  return err;
};

export const pickImagesFromLibrary = async ({ multiple = true } = {}) => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") throw permissionError("tus fotos");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? 10 : 1,
    // Con quality < 1 iOS convierte HEIC a JPEG, que se ve en cualquier sitio.
    quality: 0.85,
  });
  if (result.canceled) return [];
  return (result.assets || []).map(fromImageAsset);
};

export const takePhoto = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") throw permissionError("la cámara");

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
  if (result.canceled) return [];
  return (result.assets || []).map(fromImageAsset);
};

export const pickDocuments = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return (result.assets || []).map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType || mimeFromName(asset.name),
    size: asset.size ?? null,
  }));
};
