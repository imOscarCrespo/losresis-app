import { supabase } from "../config/supabase";

export const CLINICAL_ASSISTANT_FEATURE_KEY = "clinical_assistant_chat";

export const getUserFeatureAccess = async (userId, featureKey) => {
  try {
    if (!userId || !featureKey) {
      return {
        success: true,
        enabled: false,
        error: null,
      };
    }

    const { data, error } = await supabase.rpc("can_use_feature", {
      p_feature_key: featureKey,
      p_user_id: userId,
    });

    if (error) {
      console.error("❌ Error fetching feature access:", error);
      return {
        success: false,
        enabled: false,
        error: error.message,
      };
    }

    return {
      success: true,
      enabled: Boolean(data),
      error: null,
    };
  } catch (error) {
    console.error("❌ Exception fetching feature access:", error);
    return {
      success: false,
      enabled: false,
      error: error.message,
    };
  }
};

export const getClinicalAssistantAccess = async (userId) =>
  getUserFeatureAccess(userId, CLINICAL_ASSISTANT_FEATURE_KEY);
