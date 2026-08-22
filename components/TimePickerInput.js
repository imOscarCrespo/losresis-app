import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Keyboard,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Icon } from "./Icon";
import { COLORS } from "../constants/colors";

/**
 * Selector de hora nativo, hermano de DatePickerInput.
 *
 * El valor viaja como la columna `time` de Postgres ("HH:MM:00"); se pinta
 * recortado a "HH:MM" porque los segundos no se editan ni se muestran nunca.
 *
 * @param {string} label - Etiqueta del campo
 * @param {string} value - Valor en formato HH:MM:SS (o HH:MM), "" si no hay hora
 * @param {function} onChange - Recibe "HH:MM:00", o "" al limpiar
 * @param {boolean} disabled - No abre el picker ni ofrece limpiar
 * @param {string} accentColor - Color del botón "Cerrar" de iOS
 * @param {object} style - Estilos extra del contenedor (p. ej. flex en dos columnas)
 */
export const TimePickerInput = ({
  label,
  value,
  onChange,
  placeholder = "Sin hora",
  disabled = false,
  accentColor = COLORS.PRIMARY,
  style,
}) => {
  const [show, setShow] = useState(false);

  // Convertir "HH:MM:SS" a Date object (la fecha da igual, solo se lee la hora)
  const timeValue = (() => {
    const base = new Date();
    const [hours, minutes] = String(value || "").split(":");
    base.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
    return base;
  })();

  const formatTime = (timeString) => {
    if (!timeString) return placeholder;
    return String(timeString).slice(0, 5);
  };

  const handleTimeChange = (event, selectedTime) => {
    // En iOS el picker es permanente, en Android se cierra automáticamente
    if (Platform.OS === "android") {
      setShow(false);
    }

    if (event.type === "set" && selectedTime) {
      const hours = String(selectedTime.getHours()).padStart(2, "0");
      const minutes = String(selectedTime.getMinutes()).padStart(2, "0");
      onChange(`${hours}:${minutes}:00`);
    }
  };

  const handlePress = () => {
    if (disabled) return;
    Keyboard.dismiss();
    setShow(true);
  };

  const handleClear = () => {
    onChange("");
    setShow(false);
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.input, disabled && styles.inputDisabled]}
        onPress={handlePress}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        <Icon
          name="time-outline"
          size={20}
          color={disabled ? COLORS.GRAY_MEDIUM : COLORS.GRAY}
        />
        <Text
          style={[
            styles.inputText,
            !value && styles.inputPlaceholder,
            disabled && styles.inputTextDisabled,
          ]}
          numberOfLines={1}
        >
          {formatTime(value)}
        </Text>
        {value && !disabled ? (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            activeOpacity={0.7}
          >
            <Icon name="close-circle" size={20} color={COLORS.GRAY} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {show && !disabled && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={timeValue}
            mode="time"
            is24Hour
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
            locale="es-ES"
            textColor={COLORS.TEXT_DARK}
          />
          {Platform.OS === "ios" && (
            <View style={styles.iosButtonsContainer}>
              <TouchableOpacity
                style={[styles.iosButton, { backgroundColor: accentColor }]}
                onPress={() => setShow(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.iosButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.TEXT_DARK,
    marginBottom: 8,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  inputDisabled: {
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
  },
  inputPlaceholder: {
    color: COLORS.TEXT_LIGHT,
  },
  inputTextDisabled: {
    color: COLORS.GRAY_MEDIUM,
  },
  clearButton: {
    padding: 4,
  },
  pickerContainer: {
    marginTop: 8,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: "hidden",
  },
  iosButtonsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  iosButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  iosButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: "600",
  },
});
