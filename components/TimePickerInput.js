import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { Icon } from "./Icon";
import { PickerSheet } from "./PickerSheet";
import { COLORS } from "../constants/colors";

/**
 * Selector de hora nativo, hermano de DatePickerInput.
 *
 * El valor viaja como la columna `time` de Postgres ("HH:MM:00"); se pinta
 * recortado a "HH:MM" porque los segundos no se editan ni se muestran nunca.
 *
 * El picker se abre en un bottom sheet a ancho completo (ver PickerSheet), no
 * inline: el campo suele vivir en una columna de media pantalla y el spinner de
 * iOS no cabe ahí.
 *
 * @param {string} label - Etiqueta del campo
 * @param {string} value - Valor en formato HH:MM:SS (o HH:MM), "" si no hay hora
 * @param {function} onChange - Recibe "HH:MM:00", o "" al limpiar
 * @param {boolean} disabled - No abre el picker ni ofrece limpiar
 * @param {string} accentColor - Color del botón "Seleccionar" de iOS
 * @param {string} title - Título del sheet; por defecto la etiqueta del campo
 * @param {object} style - Estilos extra del contenedor (p. ej. flex en dos columnas)
 */
export const TimePickerInput = ({
  label,
  value,
  onChange,
  placeholder = "Sin hora",
  disabled = false,
  accentColor = COLORS.PRIMARY,
  title,
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

  const handleConfirm = (selectedTime) => {
    setShow(false);
    if (!selectedTime) return;
    const hours = String(selectedTime.getHours()).padStart(2, "0");
    const minutes = String(selectedTime.getMinutes()).padStart(2, "0");
    onChange(`${hours}:${minutes}:00`);
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

      <PickerSheet
        visible={show && !disabled}
        value={timeValue}
        mode="time"
        title={title || label}
        accentColor={accentColor}
        onConfirm={handleConfirm}
        onCancel={() => setShow(false)}
      />
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
});
