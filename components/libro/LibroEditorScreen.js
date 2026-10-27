import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { HeroScreenLayout } from "../HeroScreenLayout";

/**
 * El andamio de las pantallas de registro del Libro del Residente.
 *
 * Todo lo que el residente registra —una rotación, un curso, un trabajo, un
 * procedimiento, la observación de una guardia— se rellenaba en un bottom sheet con
 * `maxHeight` y un ScrollView de 420 puntos dentro: con el teclado abierto quedaban
 * dos o tres campos a la vista y el botón de guardar fuera de pantalla.
 *
 * Ahora cada formulario es una PANTALLA, y se sale de ella por la flecha genérica de
 * arriba a la izquierda, la misma con la que se sale de cualquier otra pantalla de la
 * app. `HeroScreenLayout` es la convención de cabecera del proyecto (ver AGENTS.md),
 * así que la flecha y el título salen de ahí y no de un header propio.
 */
export const LibroEditorScreen = ({
  title,
  onClose,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  saving = false,
  destructiveLabel = null,
  onDestructive = null,
  // Una segunda acción al lado de la principal (p. ej. «Guardar borrador»).
  secondaryLabel = null,
  onSecondary = null,
  primaryTestID,
  secondaryTestID,
  // Con dos botones el pie se come media pantalla cuando sale el teclado y tapa
  // el campo que se está escribiendo: se esconde mientras está abierto.
  hideFooterWithKeyboard = false,
}) => {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!hideFooterWithKeyboard) return undefined;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const shown = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [hideFooterWithKeyboard]);

  return (
  <HeroScreenLayout title={title} onBack={onClose} keyboardAvoiding>
    <View style={styles.surface}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {keyboardOpen ? null : (
      <View style={styles.footer}>
        {secondaryLabel && onSecondary ? (
          <TouchableOpacity
            style={[styles.secondaryButton, saving && styles.primaryButtonDisabled]}
            onPress={onSecondary}
            disabled={saving}
            activeOpacity={0.85}
            testID={secondaryTestID}
          >
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          testID={primaryTestID}
          style={[
            styles.primaryButton,
            (primaryDisabled || saving) && styles.primaryButtonDisabled,
          ]}
          onPress={onPrimary}
          disabled={primaryDisabled || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          )}
        </TouchableOpacity>

        {destructiveLabel && onDestructive ? (
          <TouchableOpacity
            style={styles.destructiveButton}
            onPress={onDestructive}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.destructiveButtonText}>{destructiveLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      )}
    </View>
  </HeroScreenLayout>
  );
};

export default LibroEditorScreen;

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: "#F8F9FE",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "#E8EAF3",
    backgroundColor: "#FFFFFF",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#670CF5",
    backgroundColor: "#FFFFFF",
    marginBottom: 6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#670CF5",
  },
  destructiveButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  destructiveButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
});
