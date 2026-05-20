import { getResidentTransitionConfigCatalog } from "./staticCatalogService";

export const getResidentTransitionConfig = async () => {
  try {
    const data = getResidentTransitionConfigCatalog().find(
      (item) => item.key === "mir_r1_corporate_email_grace"
    );

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
