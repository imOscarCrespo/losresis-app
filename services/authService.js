/**
 * Servicio de autenticación con Supabase
 * Maneja login con Google OAuth y verificación de sesión
 */

import { supabase } from "../config/supabase";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Clave para almacenar el userId en AsyncStorage
const USER_ID_KEY = "@losresis:userId";

// Necesario para que WebBrowser funcione correctamente
WebBrowser.maybeCompleteAuthSession();

/**
 * Iniciar sesión con Google OAuth
 * @param {string} redirectUrl - URL de redirección después del login
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const signInWithGoogle = async (redirectUrl) => {
  try {
    console.log("🔐 Iniciando OAuth con Google...");
    console.log("📍 Redirect URL:", redirectUrl);

    // Obtener la URL de OAuth de Supabase
    // IMPORTANTE: Usar la URL de la app móvil, no la web
    // La URL debe ser el scheme de la app (losresis://) no una URL web
    console.log("🔗 URL de redirección que se usará:", redirectUrl);

    // Asegurar que la URL de redirección sea la de la app móvil
    // Forzar siempre losresis://auth/callback para evitar que use la URL web
    const finalRedirectUrl = "losresis://auth/callback";
    console.log("🔗 URL de redirección forzada a móvil:", finalRedirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: finalRedirectUrl,
        skipBrowserRedirect: true, // Importante: no abrir el navegador automáticamente
        queryParams: {
          redirect_to: finalRedirectUrl, // Forzar explícitamente la URL de redirección
          prompt: "select_account", // Forzar selección de cuenta (no usar sesión guardada)
        },
      },
    });

    if (error) {
      console.error("❌ Error en Google OAuth:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data?.url) {
      console.error("❌ No se recibió URL de OAuth");
      return {
        success: false,
        error: "No se recibió URL de autenticación",
      };
    }

    console.log("🌐 Abriendo navegador con URL:", data.url);

    // Abrir el navegador con la URL de OAuth
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    console.log("🔙 Resultado del navegador:", result);

    if (result.type === "success" && result.url) {
      console.log("✅ URL de callback recibida:", result.url);

      // Extraer tokens del hash de la URL (#access_token=...)
      // Linking.parse() no extrae parámetros del hash, necesitamos hacerlo manualmente
      const extractHashParams = (url) => {
        const hashIndex = url.indexOf("#");
        if (hashIndex === -1) return {};

        const hash = url.substring(hashIndex + 1);
        const params = {};
        hash.split("&").forEach((param) => {
          const [key, value] = param.split("=");
          if (key && value) {
            params[key] = decodeURIComponent(value);
          }
        });
        return params;
      };

      const hashParams = extractHashParams(result.url);
      console.log("📋 Parámetros del hash extraídos:", Object.keys(hashParams));

      // Intentar obtener la sesión actual primero
      let { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      // Si no hay sesión, intentar establecerla con los tokens del hash
      if (sessionError || !sessionData?.session) {
        console.log(
          "🔄 No hay sesión activa, intentando establecer con tokens del hash..."
        );

        const accessToken = hashParams.access_token;
        const refreshToken = hashParams.refresh_token;

        if (accessToken && refreshToken) {
          console.log("🔑 Estableciendo sesión con tokens del hash...");
          const { data: manualSession, error: manualError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (manualError) {
            console.error(
              "❌ Error al establecer sesión manualmente:",
              manualError
            );
            return {
              success: false,
              error: manualError.message,
            };
          }

          if (manualSession?.session) {
            console.log("✅ Sesión establecida correctamente");
            
            // Guardar userId en AsyncStorage
            if (manualSession.session.user?.id) {
              await saveUserId(manualSession.session.user.id);
              console.log("💾 userId guardado en caché:", manualSession.session.user.id);
            }
            
            return {
              success: true,
              data: manualSession,
            };
          }
        }

        // Si aún no funciona, intentar usar exchangeCodeForSession si hay un code
        if (hashParams.code) {
          console.log("🔄 Intentando intercambiar código por sesión...");
          const { data: codeSession, error: codeError } =
            await supabase.auth.exchangeCodeForSession(hashParams.code);

          if (!codeError && codeSession?.session) {
            console.log("✅ Sesión obtenida mediante código");
            
            // Guardar userId en AsyncStorage
            if (codeSession.session.user?.id) {
              await saveUserId(codeSession.session.user.id);
              console.log("💾 userId guardado en caché:", codeSession.session.user.id);
            }
            
            return {
              success: true,
              data: codeSession,
            };
          }
        }

        return {
          success: false,
          error: sessionError?.message || "No se pudo establecer la sesión",
        };
      }

      if (sessionData?.session) {
        console.log("✅ Sesión obtenida correctamente");
        
        // Guardar userId en AsyncStorage
        if (sessionData.session.user?.id) {
          await saveUserId(sessionData.session.user.id);
          console.log("💾 userId guardado en caché:", sessionData.session.user.id);
        }
        
        return {
          success: true,
          data: sessionData,
        };
      } else {
        console.error("❌ No se pudo obtener la sesión");
        return {
          success: false,
          error: "No se pudo establecer la sesión",
        };
      }
    } else if (result.type === "cancel") {
      console.log("⚠️ Usuario canceló el login");
      return {
        success: false,
        error: "Login cancelado por el usuario",
      };
    } else {
      console.error("❌ Error en el flujo de OAuth:", result);
      return {
        success: false,
        error: "Error en el flujo de autenticación",
      };
    }
  } catch (error) {
    console.error("❌ Error al iniciar sesión con Google:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtener el usuario actual
 * @returns {Promise<{success: boolean, user: object|null, error: string|null}>}
 */
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return {
        success: false,
        user: null,
        error: error.message,
      };
    }

    return {
      success: true,
      user,
      error: null,
    };
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return {
      success: false,
      user: null,
      error: error.message,
    };
  }
};

/**
 * Obtener el perfil completo del usuario desde la tabla users
 * @param {string} userId - ID del usuario
 * @returns {Promise<{success: boolean, profile: object|null, error: string|null}>}
 */
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      return {
        success: false,
        profile: null,
        error: error.message,
      };
    }

    return {
      success: true,
      profile: data,
      error: null,
    };
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    return {
      success: false,
      profile: null,
      error: error.message,
    };
  }
};

/**
 * Verificar si el usuario tiene un perfil completo
 * @param {object} profile - Perfil del usuario
 * @returns {boolean}
 */
export const hasCompleteProfile = (profile) => {
  if (!profile) return false;
  return !!(profile.is_student || profile.is_resident || profile.is_doctor);
};

/**
 * Cerrar sesión y limpiar toda la información de autenticación
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const signOut = async () => {
  try {
    console.log("🔐 Cerrando sesión...");

    // Cerrar sesión en Supabase (esto elimina tokens y sesión)
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error("❌ Error al cerrar sesión en Supabase:", signOutError);
      return {
        success: false,
        error: signOutError.message,
      };
    }

    // Limpiar cualquier cache de sesión adicional
    // Supabase ya limpia automáticamente el storage local, pero forzamos una limpieza
    try {
      // Verificar que la sesión se haya eliminado
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        console.warn(
          "⚠️ La sesión aún existe después de signOut, forzando limpieza..."
        );
        // Intentar cerrar sesión nuevamente
        await supabase.auth.signOut();
      }
    } catch (checkError) {
      console.warn(
        "⚠️ Error al verificar sesión después de signOut:",
        checkError
      );
      // Continuar de todas formas
    }

    // Limpiar cookies del navegador para forzar selección de cuenta en el próximo login
    // Esto se hace automáticamente al usar prompt: "select_account", pero lo hacemos explícito
    try {
      // WebBrowser no tiene método directo para limpiar cookies, pero el prompt lo manejará
      console.log(
        "🧹 Sesión y tokens eliminados. El próximo login pedirá selección de cuenta."
      );
    } catch (cleanError) {
      console.warn("⚠️ Error al limpiar cookies:", cleanError);
    }

    // Limpiar userId de AsyncStorage
    await clearUserId();
    console.log("🧹 userId eliminado de caché");
    
    console.log("✅ Sesión cerrada correctamente");
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("❌ Error al cerrar sesión:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtener la sesión actual
 * @returns {Promise<{success: boolean, session: object|null, error: string|null}>}
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return {
        success: false,
        session: null,
        error: error.message,
      };
    }

    return {
      success: true,
      session: data.session,
      error: null,
    };
  } catch (error) {
    console.error("Error al obtener sesión:", error);
    return {
      success: false,
      session: null,
      error: error.message,
    };
  }
};

// ============================================================================
// FUNCIONES DE CACHÉ DE USERID
// ============================================================================

/**
 * Guardar userId en AsyncStorage
 * @param {string} userId - ID del usuario
 */
export const saveUserId = async (userId) => {
  try {
    await AsyncStorage.setItem(USER_ID_KEY, userId);
    console.log("💾 userId guardado:", userId);
  } catch (error) {
    console.error("Error al guardar userId:", error);
  }
};

/**
 * Obtener userId desde AsyncStorage
 * @returns {Promise<string|null>} - userId o null si no existe
 */
export const getCachedUserId = async () => {
  try {
    const userId = await AsyncStorage.getItem(USER_ID_KEY);
    return userId;
  } catch (error) {
    console.error("Error al obtener userId:", error);
    return null;
  }
};

/**
 * Limpiar userId de AsyncStorage
 */
export const clearUserId = async () => {
  try {
    await AsyncStorage.removeItem(USER_ID_KEY);
    console.log("🧹 userId eliminado de caché");
  } catch (error) {
    console.error("Error al limpiar userId:", error);
  }
};
