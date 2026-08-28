import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/colors";

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Bottom sheet a ancho completo para el picker nativo.
 *
 * Existe porque el spinner de iOS tiene un ancho intrínseco de ~320pt y no
 * encoge sus ruedas: pintado inline dentro de una columna estrecha (dos campos
 * en fila) las ruedas de la derecha quedaban recortadas e inalcanzables. El
 * sheet lo saca del layout del formulario, así que da igual lo estrecho que sea
 * el campo que lo abre.
 *
 * En Android no hay sheet: el picker nativo ya es un diálogo modal propio.
 *
 * @param {boolean} visible - Muestra el sheet (o lanza el diálogo en Android)
 * @param {Date} value - Valor inicial del picker
 * @param {"date"|"time"} mode - Modo del picker nativo
 * @param {function} onConfirm - Recibe el Date elegido
 * @param {function} onCancel - Se cierra sin cambiar nada
 * @param {string} title - Título del sheet (normalmente la etiqueta del campo)
 * @param {string} accentColor - Color del botón "Seleccionar"
 */
export const PickerSheet = ({
  visible,
  value,
  mode = "date",
  onConfirm,
  onCancel,
  title,
  accentColor = COLORS.PRIMARY,
  minimumDate,
  maximumDate,
}) => {
  const insets = useSafeAreaInsets();
  const [tempValue, setTempValue] = useState(value);

  // El spinner de iOS es un borrador hasta que se pulsa "Seleccionar", así que
  // se rearma con el valor real cada vez que se abre.
  useEffect(() => {
    if (visible) setTempValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  if (Platform.OS !== "ios") {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        is24Hour
        display="default"
        onChange={(event, selectedValue) => {
          if (event.type === "set" && selectedValue) onConfirm(selectedValue);
          else onCancel();
        }}
        locale="es-ES"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
      />
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      supportedOrientations={["portrait", "landscape"]}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={HIT_SLOP}
              activeOpacity={0.7}
            >
              <Text style={styles.cancel}>Cancelar</Text>
            </TouchableOpacity>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => onConfirm(tempValue)}
              hitSlop={HIT_SLOP}
              activeOpacity={0.7}
            >
              <Text style={[styles.confirm, { color: accentColor }]}>
                Seleccionar
              </Text>
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={tempValue}
            mode={mode}
            is24Hour
            display="spinner"
            onChange={(event, selectedValue) => {
              if (selectedValue) setTempValue(selectedValue);
            }}
            locale="es-ES"
            textColor={COLORS.TEXT_DARK}
            style={styles.picker}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
  },
  cancel: {
    color: COLORS.GRAY,
    fontSize: 15,
  },
  confirm: {
    fontSize: 15,
    fontWeight: "700",
  },
  picker: {
    width: "100%",
  },
});
