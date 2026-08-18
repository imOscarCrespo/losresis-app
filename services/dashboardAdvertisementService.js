import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { supabase } from "../config/supabase";

export const getDashboardAudience = (userProfile) => {
  if (userProfile?.is_resident) return "resident";
  if (userProfile?.is_student) return "student";
  if (userProfile?.is_doctor) return "doctor";
  return "all";
};

const normalizePlacement = (placementScope) => placementScope || "dashboard";

const isAdWithinSchedule = (ad) => {
  const now = new Date();

  if (ad?.starts_at && new Date(ad.starts_at) > now) {
    return false;
  }

  if (ad?.ends_at && new Date(ad.ends_at) < now) {
    return false;
  }

  return true;
};

export const getAdvertisementsByPlacement = async (
  userProfile,
  placementScope = "dashboard"
) => {
  try {
    const audience = getDashboardAudience(userProfile);
    const placement = normalizePlacement(placementScope);
    const { data, error } = await supabase
      .from("dashboard_advertisement")
      .select("*")
      .eq("is_active", true)
      .in("placement_scope", ["all", placement])
      .in("role_scope", ["all", audience])
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching dashboard advertisements:", error);
      return {
        success: false,
      ads: [],
        error: error.message,
      };
    }

    return {
      success: true,
      ads: (data || []).filter(isAdWithinSchedule),
      error: null,
    };
  } catch (error) {
    console.error("❌ Exception fetching dashboard advertisements:", error);
    return {
      success: false,
      ads: [],
      error: error.message,
    };
  }
};

export const getDashboardAdvertisements = async (userProfile) =>
  getAdvertisementsByPlacement(userProfile, "dashboard");

/**
 * Un anuncio puede llevar a una sección interna (target_section, anuncios
 * nuestros) o a la web del patrocinador (target_url, anuncios comprados en
 * sponsors.losresis.com). La constraint de la tabla garantiza que nunca hay
 * los dos a la vez.
 */
export const getAdvertisementAction = (ad) => {
  if (ad?.target_url) return "url";
  if (ad?.target_section) return "section";
  return null;
};

export const isAdvertisementActionable = (ad) =>
  getAdvertisementAction(ad) !== null;

const isSafeExternalUrl = (url) =>
  typeof url === "string" && /^https?:\/\//i.test(url);

/**
 * Abre el destino de un anuncio. Devuelve true si lo ha gestionado.
 * Las URLs externas se abren en el navegador in-app para que el usuario no
 * salga de Losresis.
 */
export const openAdvertisement = async (ad, { onSectionChange } = {}) => {
  const action = getAdvertisementAction(ad);

  if (action === "section") {
    onSectionChange?.(ad.target_section);
    return true;
  }

  if (action === "url") {
    // Doble comprobación en cliente: nunca abrimos esquemas que no sean http(s).
    if (!isSafeExternalUrl(ad.target_url)) return false;

    try {
      await WebBrowser.openBrowserAsync(ad.target_url);
      return true;
    } catch (error) {
      console.warn("⚠️ No se pudo abrir el anuncio in-app:", error);
      return Linking.openURL(ad.target_url)
        .then(() => true)
        .catch(() => false);
    }
  }

  return false;
};
