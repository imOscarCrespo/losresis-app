import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { COLORS } from "../constants/colors";
import { openAppUpdateStore } from "../services/appUpdateService";

const APP_NAME = "LosResis";

export const ForceUpdateScreen = ({
  updateUrl,
  currentVersion = null,
  minVersion = null,
}) => {
  const handleUpdatePress = async () => {
    await openAppUpdateStore({
      updateUrl,
      source: "force_update_screen",
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <Icon name="cloud-download-outline" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Actualización obligatoria</Text>
          <Text style={styles.message}>
            Necesitas actualizar {APP_NAME} para seguir usando la aplicación.
          </Text>
          {minVersion ? (
            <Text style={styles.versionText}>
              {currentVersion
                ? `Versión instalada ${currentVersion}. Mínima requerida ${minVersion}.`
                : `Versión mínima requerida ${minVersion}.`}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.button}
            onPress={handleUpdatePress}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Ir a la tienda</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  card: {
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.PRIMARY_DARK,
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.TEXT_MEDIUM,
    textAlign: "center",
    marginBottom: 12,
  },
  versionText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.PRIMARY,
    textAlign: "center",
    marginBottom: 28,
    fontWeight: "600",
  },
  button: {
    width: "100%",
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.WHITE,
  },
});
