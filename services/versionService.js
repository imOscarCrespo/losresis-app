/**
 * Servicio para verificar la versión de la aplicación desde Supabase
 * Maneja caché en AsyncStorage para evitar llamadas innecesarias al backend
 */

import { supabase, supabaseQuery } from "../config/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Claves para AsyncStorage
const VERSION_CACHE_KEY = "@losresis:version_cache";
const VERSION_CHECK_KEY = "@losresis:version_check";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de caché

/**
 * Compara dos versiones semánticas (ej: "1.0.4" vs "1.0.5")
 * @param {string} currentVersion - Versión actual instalada
 * @param {string} requiredVersion - Versión mínima requerida
 * @returns {boolean} true si currentVersion es menor que requiredVersion
 */
const compareVersions = (currentVersion, requiredVersion) => {
  if (!currentVersion || !requiredVersion) {
    console.log('⚠️ [compareVersions] Versión faltante:', {
      currentVersion,
      requiredVersion,
    });
    return false;
  }

  // Limpiar espacios y convertir a string para asegurar comparación correcta
  const currentClean = String(currentVersion).trim();
  const requiredClean = String(requiredVersion).trim();

  // Si son exactamente iguales (después de limpiar), no necesita actualización
  if (currentClean === requiredClean) {
    console.log('✅ [compareVersions] Versiones idénticas, no necesita actualización:', {
      currentVersion: currentClean,
      requiredVersion: requiredClean,
    });
    return false;
  }

  const current = currentClean.split(".").map(Number);
  const required = requiredClean.split(".").map(Number);

  console.log('🔢 [compareVersions] Comparando:', {
    currentVersion: currentClean,
    requiredVersion: requiredClean,
    currentParts: current,
    requiredParts: required,
    areEqual: currentClean === requiredClean,
  });

  for (let i = 0; i < Math.max(current.length, required.length); i++) {
    const currentPart = current[i] || 0;
    const requiredPart = required[i] || 0;

    console.log(`  [compareVersions] Parte ${i}:`, {
      currentPart,
      requiredPart,
      comparison: currentPart < requiredPart ? 'needsUpdate' : currentPart > requiredPart ? 'newer' : 'equal',
    });

    if (currentPart < requiredPart) {
      console.log('✅ [compareVersions] RESULTADO: Necesita actualización');
      return true; // Necesita actualización
    } else if (currentPart > requiredPart) {
      console.log('✅ [compareVersions] RESULTADO: Versión actual es más nueva');
      return false; // Versión actual es más nueva
    }
  }

  console.log('✅ [compareVersions] RESULTADO: Versiones iguales, no necesita actualización');
  return false; // Versiones iguales, no necesita actualización
};

/**
 * Obtiene la versión actual de la app instalada desde app.json
 * Esta es la versión real de la app, no la del SDK de Expo
 * @returns {string|null} Versión de la app o null si no se puede obtener
 */
const getCurrentAppVersion = () => {
  try {
    // Prioridad 1: Usar expo-constants que lee directamente de app.json
    // Esta es la versión real de la app (ej: "1.0.4")
    const expoConfigVersion = Constants.expoConfig?.version;
    
    // Prioridad 2: Fallback a Application si expo-constants no está disponible
    const nativeVersion = Application.nativeApplicationVersion;
    const appVersion = Application.applicationVersion;
    
    // Prioridad 3: Leer directamente de app.json como último recurso
    let appJsonVersion = null;
    try {
      const appJson = require('../app.json');
      appJsonVersion = appJson?.expo?.version;
    } catch (e) {
      // Ignorar error
    }

    // Usar la versión de expo-constants primero (es la más confiable)
    const version = expoConfigVersion || appJsonVersion || nativeVersion || appVersion || null;

    console.log('📱 [getCurrentAppVersion] Versiones detectadas:', {
      expoConfigVersion: expoConfigVersion, // Esta es la que queremos usar
      appJsonVersion: appJsonVersion,
      nativeApplicationVersion: nativeVersion, // Puede ser versión del SDK
      applicationVersion: appVersion,
      resolvedVersion: version,
    });

    if (!version) {
      console.warn('⚠️ [getCurrentAppVersion] No se pudo obtener ninguna versión');
      return null;
    }

    return version;
  } catch (error) {
    console.error("Error obteniendo versión de la app:", error);
    return null;
  }
};

/**
 * Obtiene la versión mínima requerida desde Supabase
 * @param {boolean} forceRefresh - Si es true, ignora el caché
 * @returns {Promise<{success: boolean, minVersion: string|null, error: string|null}>}
 */
export const getMinRequiredVersion = async (forceRefresh = false) => {
  try {
    // Verificar caché primero (solo si no es forceRefresh)
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(VERSION_CACHE_KEY);
      if (cached) {
        try {
          const { minVersion, updateUrl, timestamp } = JSON.parse(cached);
          const now = Date.now();
          // Si el caché es válido (menos de 5 minutos), usarlo
          if (now - timestamp < CACHE_DURATION) {
            return {
              success: true,
              minVersion,
              updateUrl: updateUrl || null,
              error: null,
              fromCache: true,
            };
          }
        } catch (e) {
          // Si hay error parseando el caché, continuar con la llamada
          console.warn("Error parseando caché de versión:", e);
        }
      }
    }

    // Obtener versión desde Supabase (incluyendo update_url)
    // Usamos skipVersionCheck=true para evitar recursión infinita
    console.log('🔍 [getMinRequiredVersion] Consultando Supabase:', {
      platform: Platform.OS,
      forceRefresh,
    });

    const result = await supabaseQuery(
      () =>
        supabase
          .from("app_versions")
          .select("min_required_version, platform, update_url")
          .eq("platform", Platform.OS)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      true // skipVersionCheck
    );

    console.log('📊 [getMinRequiredVersion] Resultado de Supabase:', {
      success: result.success,
      data: result.data,
      min_required_version: result.data?.min_required_version,
      update_url: result.data?.update_url,
      platform: result.data?.platform,
      error: result.error,
    });

    if (!result.success) {
      // Si falla, intentar obtener versión sin filtro de plataforma (fallback)
      const fallbackResult = await supabaseQuery(
        () =>
          supabase
            .from("app_versions")
            .select("min_required_version, update_url")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
        true // skipVersionCheck
      );

      if (!fallbackResult.success) {
        return {
          success: false,
          minVersion: null,
          error: result.error || "No se pudo obtener la versión requerida",
        };
      }

      // Guardar en caché
      const cacheData = {
        minVersion: fallbackResult.data.min_required_version,
        updateUrl: fallbackResult.data.update_url,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(VERSION_CACHE_KEY, JSON.stringify(cacheData));

      return {
        success: true,
        minVersion: fallbackResult.data.min_required_version,
        updateUrl: fallbackResult.data.update_url,
        error: null,
        fromCache: false,
      };
    }

    // Guardar en caché
    const cacheData = {
      minVersion: result.data.min_required_version,
      updateUrl: result.data.update_url,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(VERSION_CACHE_KEY, JSON.stringify(cacheData));

    return {
      success: true,
      minVersion: result.data.min_required_version,
      updateUrl: result.data.update_url,
      error: null,
      fromCache: false,
    };
  } catch (error) {
    console.error("Error obteniendo versión mínima requerida:", error);
    return {
      success: false,
      minVersion: null,
      error: error.message,
    };
  }
};

/**
 * Verifica si la app necesita actualización
 * Usa caché para evitar múltiples llamadas
 * @param {boolean} forceRefresh - Si es true, ignora el caché y verifica de nuevo
 * @returns {Promise<{needsUpdate: boolean, currentVersion: string|null, minVersion: string|null, error: string|null}>}
 */
export const checkVersionUpdate = async (forceRefresh = false) => {
  try {
    const currentVersion = getCurrentAppVersion();

    // En desarrollo, si no hay versión, retornar false (no forzar actualización)
    if (!currentVersion && !__DEV__) {
      return {
        needsUpdate: false,
        currentVersion: null,
        minVersion: null,
        error: "No se pudo obtener la versión actual de la app",
      };
    }

    // Verificar caché del resultado de verificación
    if (!forceRefresh) {
      const cachedCheck = await AsyncStorage.getItem(VERSION_CHECK_KEY);
      if (cachedCheck) {
        try {
          const { needsUpdate, currentVersion: cachedCurrent, minVersion, updateUrl, timestamp } =
            JSON.parse(cachedCheck);
          const now = Date.now();
          const cacheAge = now - timestamp;

          console.log('💾 [checkVersionUpdate] Caché encontrado:', {
            cachedCurrent,
            currentVersion,
            cachedMinVersion: minVersion,
            needsUpdate,
            cacheAgeMinutes: Math.round(cacheAge / 1000 / 60),
            cacheValid: cacheAge < CACHE_DURATION,
            versionMatch: cachedCurrent === currentVersion,
          });

          // Si el caché es válido y la versión actual no ha cambiado, usarlo
          // PERO: Si la versión mínima requerida cambió en Supabase, debemos verificar de nuevo
          // Por eso solo usamos el caché si tiene menos de 2 minutos (más corto para detectar cambios)
          const SHORT_CACHE_DURATION = 2 * 60 * 1000; // 2 minutos para caché corto
          
          if (
            now - timestamp < SHORT_CACHE_DURATION &&
            cachedCurrent === currentVersion
          ) {
            console.log('✅ [checkVersionUpdate] Usando caché (válido, < 2 minutos)');
            return {
              needsUpdate,
              currentVersion,
              minVersion,
              updateUrl: updateUrl || null,
              error: null,
              fromCache: true,
            };
          } else {
            console.log('⚠️ [checkVersionUpdate] Caché inválido o versión cambió, consultando Supabase:', {
              cacheAgeMinutes: Math.round((now - timestamp) / 1000 / 60),
              versionMatch: cachedCurrent === currentVersion,
            });
          }
        } catch (e) {
          console.warn("Error parseando caché de verificación:", e);
        }
      } else {
        console.log('💾 [checkVersionUpdate] No hay caché, consultando Supabase');
      }
    } else {
      console.log('🔄 [checkVersionUpdate] Force refresh activado, ignorando caché');
    }

    // Obtener versión mínima requerida
    const versionResult = await getMinRequiredVersion(forceRefresh);

    console.log('📊 [checkVersionUpdate] Resultado de getMinRequiredVersion:', {
      success: versionResult.success,
      minVersion: versionResult.minVersion,
      updateUrl: versionResult.updateUrl,
      error: versionResult.error,
      fromCache: versionResult.fromCache,
    });

    if (!versionResult.success || !versionResult.minVersion) {
      console.error('❌ [checkVersionUpdate] Error obteniendo versión mínima:', {
        success: versionResult.success,
        minVersion: versionResult.minVersion,
        error: versionResult.error,
      });
      return {
        needsUpdate: false,
        currentVersion,
        minVersion: null,
        updateUrl: null,
        error: versionResult.error || "No se pudo obtener la versión requerida",
      };
    }

    // Comparar versiones
    console.log('🔄 [checkVersionUpdate] Comparando versiones:', {
      currentVersion,
      minVersion: versionResult.minVersion,
      currentType: typeof currentVersion,
      minType: typeof versionResult.minVersion,
      areEqual: currentVersion === versionResult.minVersion,
      currentLength: currentVersion?.length,
      minLength: versionResult.minVersion?.length,
    });

    const needsUpdate = compareVersions(
      currentVersion,
      versionResult.minVersion
    );

    console.log('📋 [checkVersionUpdate] Resultado final:', {
      needsUpdate,
      currentVersion,
      minVersion: versionResult.minVersion,
      updateUrl: versionResult.updateUrl,
      comparison: `"${currentVersion}" < "${versionResult.minVersion}" = ${needsUpdate}`,
      shouldShowBanner: needsUpdate,
    });

    // Guardar resultado en caché
    const checkCache = {
      needsUpdate,
      currentVersion,
      minVersion: versionResult.minVersion,
      updateUrl: versionResult.updateUrl || null,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(VERSION_CHECK_KEY, JSON.stringify(checkCache));

    return {
      needsUpdate,
      currentVersion,
      minVersion: versionResult.minVersion,
      updateUrl: versionResult.updateUrl || null,
      error: null,
      fromCache: false,
    };
  } catch (error) {
    console.error("Error verificando actualización:", error);
    return {
      needsUpdate: false,
      currentVersion: getCurrentAppVersion(),
      minVersion: null,
      updateUrl: null,
      error: error.message,
    };
  }
};

/**
 * Limpia el caché de versiones
 * Útil cuando se actualiza la app o se quiere forzar una nueva verificación
 */
export const clearVersionCache = async () => {
  try {
    await AsyncStorage.removeItem(VERSION_CACHE_KEY);
    await AsyncStorage.removeItem(VERSION_CHECK_KEY);
    return { success: true };
  } catch (error) {
    console.error("Error limpiando caché de versiones:", error);
    return { success: false, error: error.message };
  }
};
