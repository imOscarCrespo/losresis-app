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
 * Componente de input con date picker nativo.
 *
 * El picker se abre en un bottom sheet a ancho completo (ver PickerSheet), no
 * inline: el campo suele vivir en una columna de media pantalla y el spinner de
 * fecha de iOS (tres ruedas) no cabe ahí.
 *
 * @param {string} label - Etiqueta del campo
 * @param {string} value - Valor en formato YYYY-MM-DD
 * @param {function} onChange - Callback cuando cambia la fecha
 * @param {string} placeholder - Texto cuando no hay fecha
 * @param {boolean} clearable - Ofrece la ✕ para dejar el campo vacío
 * @param {string} accentColor - Color del botón "Seleccionar" de iOS
 * @param {string} title - Título del sheet; por defecto la etiqueta del campo
 * @param {object} style - Estilos extra del contenedor
 */
export const DatePickerInput = ({
  label,
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  accentColor = COLORS.PRIMARY,
  title,
  clearable = true,
  minimumDate,
  maximumDate,
  style,
}) => {
  const [show, setShow] = useState(false);

  // Convertir string YYYY-MM-DD a Date object
  const dateValue = value ? new Date(value + "T00:00:00") : new Date();

  // Formatear fecha para mostrar
  const formatDate = (dateString) => {
    if (!dateString) return placeholder;
    try {
      const date = new Date(dateString + "T00:00:00");
      return date.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return placeholder;
    }
  };

  const handleConfirm = (selectedDate) => {
    setShow(false);
    if (!selectedDate) return;
    // Convertir Date a string YYYY-MM-DD
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    onChange(`${year}-${month}-${day}`);
  };

  const handlePress = () => {
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
        style={styles.input}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Icon name="calendar-outline" size={20} color={COLORS.GRAY} />
        <Text
          style={[styles.inputText, !value && styles.inputPlaceholder]}
          numberOfLines={1}
        >
          {formatDate(value)}
        </Text>
        {value && clearable ? (
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
        visible={show}
        value={dateValue}
        mode="date"
        title={title || label}
        accentColor={accentColor}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
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
    gap: 12,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
  },
  inputPlaceholder: {
    color: COLORS.TEXT_LIGHT,
  },
  clearButton: {
    padding: 4,
  },
});
