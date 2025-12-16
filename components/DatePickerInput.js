import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

/**
 * Componente de input con date picker nativo
 * @param {string} label - Etiqueta del campo
 * @param {string} value - Valor en formato YYYY-MM-DD
 * @param {function} onChange - Callback cuando cambia la fecha
 * @param {string} placeholder - Texto cuando no hay fecha
 */
export const DatePickerInput = ({ label, value, onChange, placeholder = "Seleccionar fecha" }) => {
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

  const handleDateChange = (event, selectedDate) => {
    // En iOS el picker es permanente, en Android se cierra automáticamente
    if (Platform.OS === "android") {
      setShow(false);
    }

    if (event.type === "set" && selectedDate) {
      // Convertir Date a string YYYY-MM-DD
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      onChange(dateString);
    }
  };

  const handlePress = () => {
    setShow(true);
  };

  const handleClear = () => {
    onChange("");
    setShow(false);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={styles.input}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={20} color={COLORS.GRAY} />
        <Text style={[styles.inputText, !value && styles.inputPlaceholder]}>
          {formatDate(value)}
        </Text>
        {value && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.GRAY} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {show && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={dateValue}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            locale="es-ES"
            textColor={COLORS.TEXT_DARK}
          />
          {Platform.OS === "ios" && (
            <View style={styles.iosButtonsContainer}>
              <TouchableOpacity
                style={styles.iosButton}
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
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  iosButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: "600",
  },
});


