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
  {
    notification_type: "group_message",
    title: "Mensajes de grupos",
    description: "Cuando haya mensajes nuevos en grupos que no hayas silenciado.",
  },
  {
    notification_type: "roommate_match",
    title: "Matches de roomies",
    description: "Cuando hagas match mutuo con un posible compañero de piso.",
  },
  {
    notification_type: "agenda_event_reminder",
    title: "Recordatorios de agenda",
    description: "Cuando se acerque un evento con recordatorio configurado.",
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
  const enabledCount = NOTIFICATION_OPTIONS.filter((option) =>
    getEnabled(option.notification_type)
  ).length;

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={22} color="#670CF5" />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        Notificaciones
      </Text>
      <View style={styles.headerRight}>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {enabledCount}/{NOTIFICATION_OPTIONS.length}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.headerShell}>{renderHeader()}</View>
        <View style={styles.contentSurface}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#670CF5" />
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <View style={styles.headerShell}>{renderHeader()}</View>
      <View style={styles.contentSurface}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInner}>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Decide que quieres recibir</Text>
              <Text style={styles.heroText}>
                Activa solo los avisos que aportan valor y evita ruido innecesario.
              </Text>
            </View>

            {permissionGranted === false && (
              <View style={styles.warningBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#B45309"
                  style={styles.warningIcon}
                />
                <Text style={styles.warningText}>
                  Las notificaciones están desactivadas en el sistema. Puedes
                  activarlas desde los ajustes del dispositivo.
                </Text>
              </View>
            )}

            <View style={styles.card}>
              <View style={[styles.row, styles.rowFirst]}>
                <View style={styles.rowText}>
                  <Text style={styles.optionEyebrow}>Sistema</Text>
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
                  trackColor={{ false: "#CBD5E1", true: "#CDB7FF" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#CBD5E1"
                />
              </View>

              {NOTIFICATION_OPTIONS.map((option) => (
                <View key={option.notification_type}>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.optionEyebrow}>
                        {getEnabled(option.notification_type) ? "Activo" : "Pausado"}
                      </Text>
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
                      trackColor={{ false: "#CBD5E1", true: "#CDB7FF" }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor="#CBD5E1"
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentSurface: {
    flex: 1,
    backgroundColor: "#F8F9FE",
  },
  headerShell: {
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(103,12,245,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    width: 36,
    alignItems: "flex-end",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#1B0977",
    letterSpacing: -0.2,
    marginHorizontal: 8,
  },
  countBadge: {
    backgroundColor: "rgba(103,12,245,0.07)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.15)",
  },
  countText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#670CF5",
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 6,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  warningBox: {
    backgroundColor: "#FFF7ED",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FCD9BD",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  warningIcon: {
    marginTop: 1,
  },
  warningText: {
    fontSize: 14,
    color: "#9A3412",
    lineHeight: 20,
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  rowFirst: {
    paddingTop: 20,
  },
  rowText: {
    flex: 1,
    marginRight: 16,
  },
  optionEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#670CF5",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E2E8F0",
    marginLeft: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
  },
});
