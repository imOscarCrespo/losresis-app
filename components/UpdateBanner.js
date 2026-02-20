import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { APP_STORE_URL_IOS, PLAY_STORE_URL_ANDROID } from "../config/versionConfig";

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
    try {
      // Usar URL de la base de datos si está disponible, sino usar fallback
      const url = updateUrl || (Platform.OS === 'ios' ? APP_STORE_URL_IOS : PLAY_STORE_URL_ANDROID);
      
      if (!url) {
        console.error("No hay URL de actualización disponible");
        return;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.error("No se puede abrir la URL:", url);
        // Para iOS, intentar con el esquema nativo alternativo
        if (Platform.OS === 'ios' && url.startsWith('https://')) {
          const nativeUrl = url.replace("https://", "itms-apps://");
          try {
            await Linking.openURL(nativeUrl);
          } catch (nativeErr) {
            console.error("Error con esquema nativo:", nativeErr);
          }
        }
      }
    } catch (err) {
      console.error("Error opening store:", err);
      // Fallback: intentar abrir directamente la tienda
      try {
        if (Platform.OS === 'ios') {
          await Linking.openURL("itms-apps://apps.apple.com");
        } else {
          await Linking.openURL("market://details?id=com.losresis.app");
        }
      } catch (fallbackErr) {
        console.error("Error al abrir tienda:", fallbackErr);
      }
    }
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
