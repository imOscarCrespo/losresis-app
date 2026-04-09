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
 * URL del App Store para iOS.
 * Debe apuntar siempre a la ficha real de LosResis.
 */
export const APP_STORE_URL_IOS =
  "https://apps.apple.com/es/app/losresis/id6756607831?l=en-GB";

/**
 * URL de Google Play para Android
 * Reemplaza con tu package name real cuando lo tengas
 */
export const PLAY_STORE_URL_ANDROID =
  "https://play.google.com/store/apps/details?id=com.losresis.app";

/**
 * Override local para testear la pantalla bloqueante de actualización.
 * Desactívalo poniendo `enabled: false` cuando termines la prueba.
 */
export const DEV_FORCE_UPDATE_OVERRIDE = {
  enabled: false,
  minVersion: "999.0.0",
};
