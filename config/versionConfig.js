import appJson from "../app.json";

/**
 * Configuración de versiones de la aplicación
 * 
 * NOTA: La versión mínima requerida ahora se obtiene desde Supabase (tabla app_versions)
 * Este archivo solo contiene URLs del App Store/Play Store
 * 
 * Para actualizar la versión mínima requerida, usa la tabla app_versions en Supabase
 * Ver: database/app_versions.sql
 */
// DEPRECATED: MIN_REQUIRED_VERSION ahora viene de Supabase
// export const MIN_REQUIRED_VERSION = appJson.expo.version;

/**
 * URL del App Store para iOS
 * TESTING: Usando WhatsApp como ejemplo para probar el redireccionamiento
 * Cuando tengas tu App ID real, reemplázalo con: "https://apps.apple.com/app/idTU_APP_ID"
 * O usa el esquema nativo: "itms-apps://apps.apple.com/app/idTU_APP_ID"
 */
export const APP_STORE_URL_IOS = "https://apps.apple.com/app/id310633997"; // TESTING: WhatsApp para probar redireccionamiento
// export const APP_STORE_URL_IOS = "itms-apps://apps.apple.com/app/id310633997"; // Alternativa con esquema nativo

/**
 * URL de Google Play para Android
 * Reemplaza con tu package name real cuando lo tengas
 */
export const PLAY_STORE_URL_ANDROID =
  "https://play.google.com/store/apps/details?id=com.losresis.app";
