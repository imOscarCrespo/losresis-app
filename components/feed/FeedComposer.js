import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Icon } from "../Icon";
import * as ImagePicker from "expo-image-picker";
import { createFeedPost } from "../../services/feedService";

const PRIMARY = "#670CF5";
const TEXT = "#1B0977";
const MUTED = "#6B7280";
const MAX_LEN = 500;

// Disparador compacto + modal de composición de un Post (texto obligatorio,
// imagen opcional). Ver docs/adr/0004-feed-actividad-de-guardia-por-conexion.md
export default function FeedComposer({ userId, onPosted }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setBody("");
    setImageUri(null);
    setSubmitting(false);
  };

  const close = () => {
    if (submitting) return;
    setOpen(false);
    reset();
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const res = await createFeedPost({ userId, body: trimmed, imageUri });
    if (res.success) {
      setOpen(false);
      reset();
      onPosted?.();
    } else {
      setSubmitting(false);
      Alert.alert("No se pudo publicar", res.error || "Inténtalo de nuevo.");
    }
  };

  const canSubmit = body.trim().length > 0 && !submitting;

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <View style={styles.triggerIcon}>
          <Icon name="create-outline" size={18} color={PRIMARY} />
        </View>
        <Text style={styles.triggerText}>Comparte algo con tus conexiones…</Text>
        <Icon name="image-outline" size={20} color={MUTED} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={close}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={close} disabled={submitting}>
                <Text style={styles.cancel}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Nueva publicación</Text>
              <TouchableOpacity
                onPress={submit}
                disabled={!canSubmit}
                style={[styles.publishBtn, !canSubmit && styles.publishBtnOff]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.publishText}>Publicar</Text>
                )}
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="¿Qué quieres compartir?"
              placeholderTextColor="#9CA3AF"
              multiline
              autoFocus
              maxLength={MAX_LEN}
              value={body}
              onChangeText={setBody}
            />

            {imageUri && (
              <View style={styles.previewWrap}>
                <Image source={{ uri: imageUri }} style={styles.preview} />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => setImageUri(null)}
                >
                  <Icon name="close" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.toolbar}>
              <TouchableOpacity style={styles.toolBtn} onPress={pickImage}>
                <Icon name="image-outline" size={22} color={PRIMARY} />
                <Text style={styles.toolBtnText}>
                  {imageUri ? "Cambiar foto" : "Añadir foto"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.counter}>
                {body.length}/{MAX_LEN}
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: "#1B0977",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  triggerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4EEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  triggerText: { flex: 1, color: MUTED, fontSize: 14 },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "#F8F9FE",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
    minHeight: "55%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cancel: { color: MUTED, fontSize: 15 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  publishBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    minWidth: 86,
    alignItems: "center",
  },
  publishBtnOff: { opacity: 0.4 },
  publishText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  input: {
    fontSize: 17,
    lineHeight: 24,
    color: "#1F2937",
    minHeight: 120,
    textAlignVertical: "top",
  },
  previewWrap: { marginTop: 12, alignSelf: "flex-start" },
  preview: { width: 160, height: 160, borderRadius: 14, backgroundColor: "#EEE" },
  removeImage: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  toolBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolBtnText: { color: PRIMARY, fontWeight: "600", fontSize: 14 },
  counter: { color: MUTED, fontSize: 13 },
});
