import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
  InputAccessoryView,
} from "react-native";
import { COLORS } from "../constants/colors";

/**
 * IDs para la barra "Listo" sobre el teclado.
 * En iOS conviene usar un ID distinto por campo multilínea para que el accessory
 * se muestre siempre (compartir el mismo ID a veces solo lo asocia al primer input).
 * Uso: <TextInput inputAccessoryViewID={KEYBOARD_DISMISS_ACCESSORY_ID} ... />
 * Para un segundo campo: inputAccessoryViewID={KEYBOARD_DISMISS_ACCESSORY_ID_2}
 */
export const KEYBOARD_DISMISS_ACCESSORY_ID = "keyboardDismissAccessory";
export const KEYBOARD_DISMISS_ACCESSORY_ID_2 = "keyboardDismissAccessory2";

const DismissButton = ({ onPress }) => (
  <TouchableOpacity
    style={styles.button}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={styles.buttonText}>Listo</Text>
  </TouchableOpacity>
);

/**
 * Componente reutilizable para poder cerrar el teclado en campos multilínea.
 * - iOS: Rendera un InputAccessoryView que aparece sobre el teclado cuando
 *   un TextInput usa inputAccessoryViewID={KEYBOARD_DISMISS_ACCESSORY_ID}.
 * - Android: Muestra una barra "Listo" fija cuando el teclado está visible.
 * Uso: incluir una sola vez en la pantalla y asignar inputAccessoryViewID
 * a los TextInput multilínea que lo necesiten.
 */
export function KeyboardDismissAccessory() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleDismiss = () => Keyboard.dismiss();

  if (Platform.OS === "ios") {
    return (
      <>
        <InputAccessoryView nativeID={KEYBOARD_DISMISS_ACCESSORY_ID}>
          <View style={styles.bar}>
            <DismissButton onPress={handleDismiss} />
          </View>
        </InputAccessoryView>
        <InputAccessoryView nativeID={KEYBOARD_DISMISS_ACCESSORY_ID_2}>
          <View style={styles.bar}>
            <DismissButton onPress={handleDismiss} />
          </View>
        </InputAccessoryView>
      </>
    );
  }

  if (Platform.OS === "android" && keyboardVisible) {
    return (
      <View
        style={[styles.barAndroid, { bottom: keyboardHeight }]}
        pointerEvents="box-none"
      >
        <DismissButton onPress={handleDismiss} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.BORDER,
  },
  barAndroid: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    elevation: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
});
