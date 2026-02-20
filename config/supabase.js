import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Variables de entorno de Supabase
// En Expo, las variables deben empezar con EXPO_PUBLIC_ para ser accesibles
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validar que las variables estén definidas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan las variables de entorno de Supabase. " +
      "Asegúrate de tener EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env"
  );
}

// Crear cliente de Supabase (similar a tu configuración en Next.js)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Claves para caché de verificación de versión
const VERSION_CHECK_KEY = "@losresis:version_check";
const VERSION_CHECK_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica la versión de forma rápida usando caché
 * Esta función NO usa supabaseQuery para evitar recursión infinita
 * @returns {Promise<{needsUpdate: boolean, skip: boolean}>}
 */
const quickVersionCheck = async () => {
  try {
    // Verificar caché primero
    const cachedCheck = await AsyncStorage.getItem(VERSION_CHECK_KEY);
    if (cachedCheck) {
      try {
        const { needsUpdate, timestamp } = JSON.parse(cachedCheck);
        const now = Date.now();

        // Si el caché es válido, usar el resultado
        if (now - timestamp < VERSION_CHECK_DURATION) {
          return { needsUpdate, skip: false };
        }
      } catch (e) {
        // Si hay error parseando, continuar con verificación
      }
    }

    // Si no hay caché válido, hacer verificación rápida desde Supabase
    // Usamos el cliente directamente para evitar recursión
    let versionData = null;

    const { data, error } = await supabase
      .from("app_versions")
      .select("min_required_version")
      .eq("platform", Platform.OS)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Si falla, intentar sin filtro de plataforma
      const fallback = await supabase
        .from("app_versions")
        .select("min_required_version")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fallback.error || !fallback.data) {
        // Si no se puede verificar, permitir la llamada (no bloquear)
        return { needsUpdate: false, skip: true };
      }

      versionData = fallback.data;
    } else {
      versionData = data;
    }

    // Comparar versiones (lógica simplificada)
    const minVersion = versionData.min_required_version;
    const currentVersion =
      require("expo-application").nativeApplicationVersion ||
      require("expo-application").applicationVersion;

    if (!currentVersion || !minVersion) {
      return { needsUpdate: false, skip: true };
    }

    const current = currentVersion.split(".").map(Number);
    const required = minVersion.split(".").map(Number);
    let needsUpdate = false;

    for (let i = 0; i < Math.max(current.length, required.length); i++) {
      const currentPart = current[i] || 0;
      const requiredPart = required[i] || 0;
      if (currentPart < requiredPart) {
        needsUpdate = true;
        break;
      } else if (currentPart > requiredPart) {
        break;
      }
    }

    // Guardar en caché
    const checkCache = {
      needsUpdate,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(VERSION_CHECK_KEY, JSON.stringify(checkCache));

    return { needsUpdate, skip: false };
  } catch (error) {
    // En caso de error, permitir la llamada (no bloquear)
    console.warn("Error en verificación rápida de versión:", error);
    return { needsUpdate: false, skip: true };
  }
};

// Helper para manejar errores de Supabase (opcional, para facilitar el manejo de errores)
export const handleSupabaseError = (error) => {
  if (error) {
    console.error("Supabase Error:", error.message);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
  return null;
};

// Helper genérico para queries (opcional, para facilitar el manejo de respuestas)
// Ahora incluye verificación de versión antes de cada llamada
export const supabaseQuery = async (queryFn, skipVersionCheck = false) => {
  try {
    // Verificar versión antes de cada llamada (excepto si se especifica skipVersionCheck)
    // Esto evita hacer la verificación en llamadas internas del sistema de versión
    if (!skipVersionCheck) {
      const versionCheck = await quickVersionCheck();

      // Si necesita actualización y tenemos el resultado del caché, guardarlo
      // El componente UpdateBanner se encargará de mostrarse basándose en este estado
      if (versionCheck.needsUpdate && !versionCheck.skip) {
        // No bloqueamos la llamada, solo verificamos
        // El banner se mostrará basándose en el estado del hook useVersionCheck
      }
    }

    const { data, error } = await queryFn();
    const errorResult = handleSupabaseError(error);
    if (errorResult) return errorResult;

    return {
      success: true,
      data,
      error: null,
    };
  } catch (error) {
    console.error("Query Error:", error);
    return {
      success: false,
      error: error.message,
      data: null,
    };
  }
};

export default supabase;
