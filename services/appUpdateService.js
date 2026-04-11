import { Linking, Platform } from "react-native";
import {
  APP_STORE_URL_IOS,
  PLAY_STORE_URL_ANDROID,
} from "../config/versionConfig";
import posthogLogger from "./posthogService";

export const getAppUpdateUrl = (updateUrl = null) =>
  updateUrl ||
  (Platform.OS === "ios" ? APP_STORE_URL_IOS : PLAY_STORE_URL_ANDROID);

export const openAppUpdateStore = async ({
  updateUrl = null,
  source = "unknown",
} = {}) => {
  const url = getAppUpdateUrl(updateUrl);

  posthogLogger.capture("App Update Clicked", {
    platform: Platform.OS,
    source,
    has_custom_update_url: !!updateUrl,
    target_url: url || null,
  });

  if (!url) {
    console.error("No hay URL de actualización disponible");
    return false;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }

    if (Platform.OS === "ios" && url.startsWith("https://")) {
      await Linking.openURL(url.replace("https://", "itms-apps://"));
      return true;
    }
  } catch (error) {
    console.error("Error opening store URL:", error);
  }

  try {
    if (Platform.OS === "ios") {
      await Linking.openURL("itms-apps://apps.apple.com");
    } else {
      await Linking.openURL("market://details?id=com.losresis.app");
    }
    return true;
  } catch (fallbackError) {
    console.error("Error al abrir tienda:", fallbackError);
    return false;
  }
};
