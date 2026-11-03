import React, { useCallback, useRef } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../Icon";
import { COLORS } from "../../constants/colors";

/**
 * Hoja inferior de ResiNotes (menú «¿Qué quieres guardar?», acciones de un
 * elemento, formularios de carpeta y enlace, selector de carpeta).
 */
// Lo que tarda como mucho la hoja en cerrarse (slide de iOS ~300 ms). Respaldo por si
// onDismiss no llega.
const SHEET_CLOSE_FALLBACK_MS = 800;

/**
 * Ejecuta algo cuando la hoja ha terminado de cerrarse.
 *
 * Un selector nativo (documentos, fotos, cámara) no se puede abrir mientras un
 * Modal se está cerrando: iOS lo presenta encima del Modal y lo cierra con él.
 * El selector de documentos se quedaba entonces colgado («Different document
 * picking in progress») y la subida de PDFs de ResiNotes fallaba.
 * Uso: pasar onSheetDismiss como onDismiss de la hoja y llamar a
 * runAfterSheetClose(fn) justo después de ocultarla.
 */
export const useRunAfterSheetClose = () => {
  const pending = useRef(null);
  const onSheetDismiss = useCallback(() => {
    const fn = pending.current;
    pending.current = null;
    if (fn) fn();
  }, []);
  const runAfterSheetClose = useCallback(
    (fn) => {
      pending.current = fn;
      setTimeout(onSheetDismiss, SHEET_CLOSE_FALLBACK_MS);
    },
    [onSheetDismiss]
  );
  return { runAfterSheetClose, onSheetDismiss };
};

export const ResiNotesSheet = ({ visible, title, onClose, onDismiss, children, footer = null, testID }) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismiss}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* accessible={false}: un Pressable accesible esconde a sus hijos a VoiceOver. */}
        <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
            onPress={() => {}}
            accessible={false}
            testID={testID}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Icon name="close" size={22} color={COLORS.TEXT_LIGHT} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/** Una fila de acción dentro de una hoja: icono, texto y descripción opcional. */
export const SheetOption = ({ icon, emoji, label, description, onPress, danger = false, testID }) => (
  <TouchableOpacity
    style={styles.option}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
  >
    <View style={[styles.optionIcon, danger && styles.optionIconDanger]}>
      {emoji ? (
        <Text style={styles.optionEmoji}>{emoji}</Text>
      ) : (
        <Icon name={icon} size={20} color={danger ? COLORS.ERROR : COLORS.PRIMARY} />
      )}
    </View>
    <View style={styles.optionText}>
      <Text style={[styles.optionLabel, danger && styles.optionLabelDanger]}>{label}</Text>
      {description ? <Text style={styles.optionDescription}>{description}</Text> : null}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "88%",
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.GRAY_MEDIUM,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.PRIMARY_DARK,
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconDanger: { backgroundColor: COLORS.RED_LIGHT },
  optionEmoji: { fontSize: 20 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16, fontWeight: "600", color: COLORS.TEXT_DARK },
  optionLabelDanger: { color: COLORS.ERROR },
  optionDescription: { fontSize: 13, color: COLORS.TEXT_LIGHT, marginTop: 2 },
});

export default ResiNotesSheet;
