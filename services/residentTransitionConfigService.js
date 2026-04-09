import { supabase } from "../config/supabase";

export const getResidentTransitionConfig = async () => {
  try {
    const { data, error } = await supabase
      .from("resident_transition_config")
      .select("*")
      .eq("key", "mir_r1_corporate_email_grace")
      .maybeSingle();

    if (error) {
      console.error("Error fetching resident transition config:", error);
      return {
        success: false,
        config: null,
        error: error.message,
      };
    }

    return {
      success: true,
      config: data || null,
      error: null,
    };
  } catch (error) {
    console.error("Exception fetching resident transition config:", error);
    return {
      success: false,
      config: null,
      error: error.message,
    };
  }
};
