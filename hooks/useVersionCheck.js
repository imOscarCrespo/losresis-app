import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { checkVersionUpdate, clearVersionCache } from "../services/versionService";
import Constants from "expo-constants";
import * as Application from "expo-application";

/**
 * Hook para verificar si la app necesita actualización desde Supabase
 * Usa caché en AsyncStorage para optimizar el rendimiento
 * @returns {object} { needsUpdate: boolean, currentVersion: string|null, isLoading: boolean }
 */
export const useVersionCheck = () => {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isForceUpdate, setIsForceUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [minVersion, setMinVersion] = useState(null);
  const [updateUrl, setUpdateUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const refreshVersionCheck = useCallback(
    async ({ force = false, reason = "manual" } = {}) => {
      try {
        setIsLoading(true);

        // Obtener versión actual de la app desde app.json (no del SDK)
        const expoConfigVersion = Constants.expoConfig?.version;
        const nativeVersion = Application.nativeApplicationVersion;
        const appVersion = Application.applicationVersion;

        // Usar expo-constants primero (lee de app.json), luego fallbacks
        const version = expoConfigVersion || nativeVersion || appVersion || null;

        console.log("🔍 [useVersionCheck] Versión detectada:", {
          expoConfigVersion, // Versión real de app.json
          nativeApplicationVersion: nativeVersion, // Puede ser SDK version
          applicationVersion: appVersion,
          resolvedVersion: version,
          platform: Platform.OS,
          force,
          reason,
        });

        setCurrentVersion(version);

        // Limpiar caché si la versión de la app cambió para evitar reutilizar
        // resultados calculados con otra build instalada.
        const storage =
          require("@react-native-async-storage/async-storage").default;
        const cachedVersion = await storage.getItem("@losresis:last_app_version");
        const versionChanged = !cachedVersion || cachedVersion !== version;
        const shouldForceRefresh = force || versionChanged;

        if (versionChanged) {
          console.log(
            "🔄 [useVersionCheck] Versión cambió o primera vez, limpiando caché:",
            {
              cachedVersion,
              currentVersion: version,
              reason,
            }
          );
          await clearVersionCache();
          await storage.setItem("@losresis:last_app_version", version || "");
        }

        // Verificar versión desde Supabase. Los eventos lifecycle (`startup`,
        // `resume`, `auth`) fuerzan refresh para no depender de una sesión nueva.
        const result = await checkVersionUpdate(shouldForceRefresh);

        console.log("📱 [useVersionCheck] Resultado de verificación:", {
          needsUpdate: result.needsUpdate,
          isForceUpdate: result.isForceUpdate,
          currentVersion: result.currentVersion,
          minVersion: result.minVersion,
          updateUrl: result.updateUrl,
          error: result.error,
          fromCache: result.fromCache,
          reason,
          forced: shouldForceRefresh,
        });

        setLastCheckedAt(Date.now());

        if (result.error) {
          console.warn(
            "⚠️ [useVersionCheck] Error verificando versión:",
            result.error
          );
          // En caso de error, no mostrar banner (no bloquear la app)
          setNeedsUpdate(false);
          setIsForceUpdate(false);
          setMinVersion(null);
          setUpdateUrl(null);
        } else {
          console.log("✅ [useVersionCheck] Estado final:", {
            needsUpdate: result.needsUpdate,
            isForceUpdate: !!result.isForceUpdate,
            willShowBanner: result.needsUpdate && !result.isForceUpdate,
            willBlockApp: result.needsUpdate && !!result.isForceUpdate,
            reason,
          });
          setNeedsUpdate(result.needsUpdate || false);
          setIsForceUpdate(result.isForceUpdate || false);
          setMinVersion(result.minVersion || null);
          setUpdateUrl(result.updateUrl || null);
        }
      } catch (error) {
        console.error("Error en useVersionCheck:", error);
        setNeedsUpdate(false);
        setIsForceUpdate(false);
        setMinVersion(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    refreshVersionCheck({ force: true, reason: "startup" });
  }, [refreshVersionCheck]);

  return {
    needsUpdate,
    isForceUpdate,
    currentVersion,
    minVersion,
    updateUrl,
    isLoading,
    lastCheckedAt,
    refreshVersionCheck,
  };
};
