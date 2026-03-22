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
