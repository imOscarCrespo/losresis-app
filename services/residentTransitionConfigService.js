import { supabase } from "../config/supabase";
import { getResidentTransitionConfigCatalog } from "./staticCatalogService";

const CONFIG_KEY = "mir_r1_corporate_email_grace";

const getStaticFallbackConfig = () =>
  getResidentTransitionConfigCatalog().find(
    (item) => item.key === CONFIG_KEY
  ) || null;

/**
 * Lee la configuración de la ventana de gracia (email corporativo R1)
 * SIEMPRE desde la base de datos, que es la fuente de verdad editable.
 * El catálogo estático solo se usa como fallback si la lectura de red falla,
 * para no romper el onboarding cuando el dispositivo está offline.
 */
export const getResidentTransitionConfig = async () => {
  try {
    const { data, error } = await supabase
      .from("resident_transition_config")
      .select("*")
      .eq("key", CONFIG_KEY)
      .maybeSingle();

    if (error) {
      console.warn(
        "⚠️ Error fetching resident transition config from DB, using static fallback:",
        error.message
      );
      return {
        success: true,
        config: getStaticFallbackConfig(),
        error: null,
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
      success: true,
      config: getStaticFallbackConfig(),
      error: error.message,
    };
  }
};
