import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { supabase } from "../../../config/supabase";

type NotificationSettingsScreenProps = {
  userId: string | undefined;
  onBack: () => void;
};

/** Map: notification_type -> push_enabled. Missing = enabled by default. */
type PreferencesMap = Record<string, boolean>;

const NOTIFICATION_OPTIONS: Array<{
  notification_type: string;
  title: string;
  description: string;
}> = [
  {
    notification_type: "new_review",
    title: "Nuevas reseñas",
    description:
      "Recibir una notificación cuando se publique una nueva reseña.",
  },
  {
    notification_type: "review_reply",
    title: "Respuestas a mis reseñas",
    description: "Cuando alguien responda a una reseña que escribiste.",
  },
  {
    notification_type: "new_comment",
    title: "Nuevos comentarios",
    description: "Cuando haya nuevos comentarios en tus reseñas.",
  },
  {
    notification_type: "new_message",
    title: "Mensajes privados",
    description: "Cuando recibas un nuevo mensaje.",
  },
];

export default function NotificationSettingsScreen({
  userId,
  onBack,
}: NotificationSettingsScreenProps) {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null
  );
  /** Preferences by notification_type. Default true when missing. */
  const [preferencesMap, setPreferencesMap] = useState<PreferencesMap>({});
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);

  const loadPermissionStatus = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const granted = status === "granted";
      setPermissionGranted(granted);
      console.log("[NotificationSettings] Permission status:", status);
    } catch (err) {
      console.error("[NotificationSettings] Error loading permission:", err);
      setPermissionGranted(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("notification_type, push_enabled")
        .eq("user_id", userId);

      if (error) {
        console.error(
          "[NotificationSettings] Error loading preferences:",
          error.message
        );
        setPreferencesMap({});
        return;
      }

      const map: PreferencesMap = {};
      (data ?? []).forEach((row: { notification_type: string; push_enabled: boolean }) => {
        map[row.notification_type] = row.push_enabled ?? true;
      });
      setPreferencesMap(map);
      console.log("[NotificationSettings] Preferences loaded:", map);
    } catch (err) {
      console.error("[NotificationSettings] Error loading preferences:", err);
      setPreferencesMap({});
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPermissionStatus();
  }, [loadPermissionStatus]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const getEnabled = (notificationType: string): boolean =>
    preferencesMap[notificationType] ?? true;

  const savePreference = async (
    notificationType: string,
    pushEnabledValue: boolean
  ): Promise<boolean> => {
    if (!userId) return false;
    setSavingType(notificationType);
    try {
      const { error } = await supabase
        .from("user_notification_preferences")
        .upsert(
          {
            user_id: userId,
            notification_type: notificationType,
            push_enabled: pushEnabledValue,
            in_app_enabled: true,
          },
          { onConflict: "user_id, notification_type" }
        );

      if (error) {
        console.error(
          "[NotificationSettings] Error saving preference:",
          error.message
        );
        Alert.alert(
          "Error",
          "No se pudo guardar la preferencia."
        );
        return false;
      }
      console.log("[NotificationSettings] Preference saved:", {
        notification_type: notificationType,
        push_enabled: pushEnabledValue,
      });
      return true;
    } catch (err) {
      console.error("[NotificationSettings] Error saving preference:", err);
      Alert.alert(
        "Error",
        "No se pudo guardar la preferencia."
      );
      return false;
    } finally {
      setSavingType(null);
    }
  };

  const handleSystemSwitchChange = async (value: boolean) => {
    if (value) {
      let status = permissionGranted;
      if (status === false || status === null) {
        const { status: newStatus } =
          await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          });
        const granted = newStatus === "granted";
        setPermissionGranted(granted);
        console.log(
          "[NotificationSettings] Permission after request:",
          newStatus
        );
        if (!granted) {
          Alert.alert(
            "Permisos necesarios",
            "Debes permitir notificaciones en ajustes del sistema"
          );
          return;
        }
      }
      setPreferencesMap((prev) => ({ ...prev, system: true }));
      const ok = await savePreference("system", true);
      if (!ok) setPreferencesMap((prev) => ({ ...prev, system: false }));
    } else {
      setPreferencesMap((prev) => ({ ...prev, system: false }));
      const ok = await savePreference("system", false);
      if (!ok) setPreferencesMap((prev) => ({ ...prev, system: true }));
    }
  };

  const handleOptionSwitchChange = async (
    notificationType: string,
    value: boolean
  ) => {
    setPreferencesMap((prev) => ({ ...prev, [notificationType]: value }));
    const ok = await savePreference(notificationType, value);
    if (!ok) {
      setPreferencesMap((prev) => ({ ...prev, [notificationType]: !value }));
    }
  };

  const isDisabled = loading || savingType !== null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>Notificaciones</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Notificaciones</Text>

        {permissionGranted === false && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Las notificaciones están desactivadas en el sistema. Puedes
              activarlas desde los ajustes del dispositivo.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.optionTitle}>Recibir notificaciones push</Text>
              <Text style={styles.optionDescription}>
                Activa las notificaciones push para recibir avisos en el
                dispositivo.
              </Text>
            </View>
            <Switch
              value={getEnabled("system")}
              onValueChange={handleSystemSwitchChange}
              disabled={isDisabled}
              trackColor={{ false: "#C7C7CC", true: "#34C759" }}
              thumbColor="#FFFFFF"
            />
          </View>

          {NOTIFICATION_OPTIONS.map((option) => (
            <View key={option.notification_type}>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                </View>
                <Switch
                  value={getEnabled(option.notification_type)}
                  onValueChange={(value) =>
                    handleOptionSwitchChange(option.notification_type, value)
                  }
                  disabled={isDisabled}
                  trackColor={{ false: "#C7C7CC", true: "#34C759" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  warningBox: {
    backgroundColor: "#FFF3CD",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: "#856404",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  rowText: {
    flex: 1,
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: "#3C3C43",
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginLeft: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
});
