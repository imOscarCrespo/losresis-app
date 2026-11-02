import React from "react";
import { Alert, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "../../../src/services/push/registerPushToken";
import { ResiNotesSheet, SheetOption } from "../ResiNotesSheet";
import { snoozeOptions } from "../../../utils/flashcards";

/**
 * Recordatorios del repaso (ClickUp 124b4z9w0z0, pasada B).
 *
 * Los avisos los manda la BD (send_due_resinotes_review_reminders, cron cada
 * 15 min) a la hora que elige el residente. Aquí solo se piden los permisos
 * del móvil y se pospone el aviso de hoy.
 */

/**
 * Pide permiso de notificaciones. Si se concede, registra el token del móvil
 * (por si al abrir la app se denegó) y devuelve true. Si no, explica cómo
 * activarlo y devuelve false: los recordatorios no se activan.
 */
export const ensureNotificationPermission = async (userId) => {
  let status;
  let canAskAgain = true;
  try {
    ({ status, canAskAgain } = await Notifications.getPermissionsAsync());
    if (status !== "granted" && canAskAgain !== false) {
      ({ status, canAskAgain } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      }));
    }
  } catch {
    status = "undetermined";
  }
  if (status === "granted") {
    registerPushToken(userId).catch(() => {});
    return true;
  }
  Alert.alert(
    "Activa las notificaciones",
    "Para recibir el recordatorio de tu repaso, permite las notificaciones de Los Resis en los ajustes del móvil. Mientras tanto, los recordatorios seguirán desactivados.",
    [
      { text: "Ahora no", style: "cancel" },
      { text: "Abrir ajustes", onPress: () => Linking.openSettings().catch(() => {}) },
    ]
  );
  return false;
};

/**
 * «Posponer» el aviso de hoy: en 1 hora, esta noche, mañana o desactivar los
 * recordatorios. `onPick({ snoozed_until })` o `onPick({ reminders_enabled: false })`.
 */
export const SnoozeSheet = ({ visible, reminderTime, onPick, onClose, extraOption = null }) => {
  const options = visible ? snoozeOptions(new Date(), reminderTime) : [];
  return (
    <ResiNotesSheet visible={visible} title="¿Cuándo te lo recordamos?" onClose={onClose} testID="review-snooze-sheet">
      {options.map((o) => (
        <SheetOption
          key={o.key}
          icon="time-outline"
          label={o.label}
          description={o.description}
          onPress={() => onPick({ snoozed_until: o.at.toISOString() })}
          testID={`review-snooze-${o.key}`}
        />
      ))}
      <SheetOption
        icon="notifications-off-outline"
        label="Desactivar recordatorios"
        onPress={() => onPick({ reminders_enabled: false, snoozed_until: null })}
        testID="review-snooze-off"
      />
      {extraOption}
    </ResiNotesSheet>
  );
};
