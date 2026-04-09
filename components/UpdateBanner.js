import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { openAppUpdateStore } from "../services/appUpdateService";

const APP_NAME = "LosResis";

/**
 * Banner flotante que muestra un mensaje de actualización permanente.
 * Se muestra encima del menú inferior cuando la versión instalada es menor
 * que la versión mínima requerida (iOS y Android).
 * 
 * @param {object} props
 * @param {string|null} props.updateUrl - URL de actualización desde la base de datos
 */
export const UpdateBanner = ({ updateUrl }) => {
  const handleUpdatePress = async () => {
    await openAppUpdateStore({
      updateUrl,
      source: "update_banner",
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="arrow-down-circle" size={20} color="#FFFFFF" />
        <Text style={styles.text}>
          Actualiza {APP_NAME} para disfrutar de las últimas mejoras
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleUpdatePress}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Actualizar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 8,
    marginRight: 12,
  },
  button: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 90,
  },
  buttonText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
