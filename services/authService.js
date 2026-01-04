/**
 * Servicio de autenticación con Supabase
 * Maneja login con Google OAuth y verificación de sesión
 */

import { supabase } from "../config/supabase";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  saveTokensSecurely,
  isBiometricEnabled,
  clearStoredTokens,
} from "./biometricService";

// Clave para almacenar el userId en AsyncStorage
const USER_ID_KEY = "@losresis:userId";

// Necesario para que WebBrowser funcione correctamente
WebBrowser.maybeCompleteAuthSession();

/**
 * Función genérica para iniciar sesión con cualquier provider OAuth
 * @param {string} provider - Provider de OAuth ('google' | 'apple')
 * @param {string} redirectUrl - URL de redirección después del login
 * @returns {Promise<{success: boolean, error: string|null, data?: object}>}
 */
const signInWithOAuth = async (provider, redirectUrl) => {
  try {
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    console.log(`🔐 Iniciando OAuth con ${providerName}...`);
    console.log("📍 Redirect URL:", redirectUrl);

    // Asegurar que la URL de redirección sea la de la app móvil
    // Forzar siempre losresis://auth/callback para evitar que use la URL web
    const finalRedirectUrl = "losresis://auth/callback";
    console.log("🔗 URL de redirección forzada a móvil:", finalRedirectUrl);

    // Configurar opciones específicas por provider
    const oauthOptions = {
      redirectTo: finalRedirectUrl,
      // skipBrowserRedirect: false en Android para que funcione correctamente
      queryParams: {
        redirect_to: finalRedirectUrl, // Forzar explícitamente la URL de redirección
      },
    };

    // Google requiere prompt para selección de cuenta
    if (provider === "google") {
      oauthOptions.queryParams.prompt = "select_account";
    }

    // En Android, no usar skipBrowserRedirect para que el flujo funcione correctamente
    // En iOS funciona con skipBrowserRedirect, pero en Android puede causar problemas
    if (Platform.OS === "ios") {
      oauthOptions.skipBrowserRedirect = true;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: oauthOptions,
    });

    if (error) {
      console.error(`❌ Error en ${providerName} OAuth:`, error);
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
    // En Android, a veces el callback llega por deep linking en lugar de por el resultado directo
    let result;
    try {
      console.log("⏳ Esperando respuesta del navegador...");

      // Crear una promesa con timeout más corto (30 segundos) para detectar problemas de Chrome
      // Usar finalRedirectUrl en lugar de redirectUrl para asegurar consistencia
      const browserPromise = WebBrowser.openAuthSessionAsync(
        data.url,
        finalRedirectUrl
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout esperando respuesta del navegador")),
          30000 // Reducido a 30 segundos
        )
      );

      result = await Promise.race([browserPromise, timeoutPromise]);
      console.log("✅ Respuesta recibida del navegador");
    } catch (browserError) {
      console.error("❌ Error al abrir navegador:", browserError);

      // Si hay un timeout, puede ser que Chrome no funcione en el emulador
      // En ese caso, esperar y verificar si el callback llegó por deep linking
      if (browserError.message.includes("Timeout")) {
        console.log(
          "⏱️ Timeout esperando navegador (posible problema con Chrome en emulador)"
        );
        console.log("🔄 Esperando callback por deep linking...");

        // Esperar más tiempo para que el deep linking procese el callback
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Verificar múltiples veces si hay sesión
        for (let i = 0; i < 5; i++) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.log(
              "✅ Sesión encontrada después del timeout (callback llegó por deep linking)"
            );
            return {
              success: true,
              data: sessionData,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        console.error("❌ No se recibió callback por deep linking");
        console.error(
          "⚠️ IMPORTANTE: Los intent filters solo funcionan en builds de producción"
        );
        console.error(
          "⚠️ Si estás usando 'yarn run android', necesitas hacer un build de producción:"
        );
        console.error("⚠️ eas build --platform android --profile production");
        return {
          success: false,
          error:
            "El callback no llegó. Los intent filters solo funcionan en builds de producción. Haz un build con: eas build --platform android --profile production",
        };
      }

      return {
        success: false,
        error: `Error al abrir navegador: ${browserError.message}`,
      };
    }

    console.log("🔙 Resultado del navegador:", JSON.stringify(result, null, 2));
    console.log("📊 Tipo de resultado:", result?.type || "undefined");
    console.log("📊 URL recibida:", result?.url || "No hay URL");
    console.log("📊 Resultado completo:", result);

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
              console.log(
                "💾 userId guardado en caché:",
                manualSession.session.user.id
              );
            }

            // Guardar tokens de forma segura si la biometría está habilitada
            await saveTokensForBiometric(accessToken, refreshToken);

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
              console.log(
                "💾 userId guardado en caché:",
                codeSession.session.user.id
              );
            }

            // Guardar tokens de forma segura si la biometría está habilitada
            if (
              codeSession.session.access_token &&
              codeSession.session.refresh_token
            ) {
              await saveTokensForBiometric(
                codeSession.session.access_token,
                codeSession.session.refresh_token
              );
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
          console.log(
            "💾 userId guardado en caché:",
            sessionData.session.user.id
          );
        }

        // Guardar tokens de forma segura si la biometría está habilitada
        if (
          sessionData.session.access_token &&
          sessionData.session.refresh_token
        ) {
          await saveTokensForBiometric(
            sessionData.session.access_token,
            sessionData.session.refresh_token
          );
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
    } else if (result.type === "dismiss") {
      console.log("⚠️ Usuario cerró el navegador sin completar el login");
      console.log("🔄 Esperando callback por deep linking (dismiss)...");
      // En Android, a veces el callback viene después del dismiss por deep linking
      // Esperar más tiempo y verificar múltiples veces
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verificar múltiples veces si hay sesión
      for (let i = 0; i < 10; i++) {
        console.log(
          `🔄 Verificando sesión después de dismiss (intento ${i + 1}/10)...`
        );
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          console.log(
            "✅ Sesión encontrada después del dismiss (callback llegó por deep linking)"
          );
          return {
            success: true,
            data: sessionData,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.error(
        "❌ No se recibió callback por deep linking después de dismiss"
      );
      return {
        success: false,
        error: "El login no se completó. Por favor, intenta de nuevo.",
      };
    } else {
      console.error(
        "❌ Error en el flujo de OAuth:",
        JSON.stringify(result, null, 2)
      );
      console.error(
        "❌ Tipo de resultado inesperado:",
        result?.type || "undefined"
      );
      console.error("❌ Resultado completo:", result);

      // En Android, a veces el callback llega por deep linking aunque el resultado no sea "success"
      // Esperar un momento y verificar si hay sesión
      console.log(
        "🔄 Esperando callback por deep linking (tipo inesperado)..."
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verificar múltiples veces si hay sesión
      for (let i = 0; i < 5; i++) {
        console.log(`🔄 Verificando sesión (intento ${i + 1}/5)...`);
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          console.log(
            "✅ Sesión encontrada después del tipo inesperado (callback llegó por deep linking)"
          );
          return {
            success: true,
            data: sessionData,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Si result es undefined o null, puede ser un problema de deep linking
      if (!result || !result.type) {
        console.error(
          "❌ Resultado del navegador es undefined/null - posible problema de deep linking"
        );
        return {
          success: false,
          error:
            "No se recibió respuesta del navegador. Verifica que el deep linking esté configurado correctamente.",
        };
      }

      return {
        success: false,
        error: `Error en el flujo de autenticación (tipo: ${
          result.type || "desconocido"
        }). El callback puede haber llegado por deep linking, pero no se pudo establecer la sesión.`,
      };
    }
  } catch (error) {
    console.error(`❌ Error al iniciar sesión con ${provider}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Iniciar sesión con Google OAuth
 * @param {string} redirectUrl - URL de redirección después del login
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const signInWithGoogle = async (redirectUrl) => {
  return signInWithOAuth("google", redirectUrl);
};

/**
 * Iniciar sesión con Apple OAuth
 * @param {string} redirectUrl - URL de redirección después del login
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const signInWithApple = async (redirectUrl) => {
  return signInWithOAuth("apple", redirectUrl);
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

    // Limpiar tokens biométricos guardados
    await clearStoredTokens();

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

// ============================================================================
// FUNCIONES DE BIOMETRÍA
// ============================================================================

/**
 * Guardar tokens de forma segura para uso con biometría
 * Solo guarda si la biometría está habilitada
 * @param {string} accessToken - Token de acceso
 * @param {string} refreshToken - Token de refresco
 */
const saveTokensForBiometric = async (accessToken, refreshToken) => {
  try {
    if (!accessToken || !refreshToken) {
      console.warn("⚠️ No hay tokens para guardar");
      return;
    }

    const biometricEnabled = await isBiometricEnabled();
    console.log("🔐 Biometría habilitada:", biometricEnabled);

    if (biometricEnabled) {
      const result = await saveTokensSecurely(accessToken, refreshToken);
      if (result.success) {
        console.log("✅ Tokens guardados correctamente para biometría");
      } else {
        console.error("❌ Error al guardar tokens:", result.error);
      }
    } else {
      console.log("ℹ️ Biometría no habilitada, no se guardan tokens");
    }
  } catch (error) {
    console.error("❌ Error al guardar tokens para biometría:", error);
    // No fallar el login si esto falla
  }
};

/**
 * Restaurar sesión usando tokens guardados con biometría
 * @returns {Promise<{success: boolean, session: object|null, error: string|null}>}
 */
export const restoreSessionWithBiometric = async () => {
  try {
    const { getStoredTokens } = await import("./biometricService");
    const result = await getStoredTokens();
    const { accessToken, refreshToken, success, error } = result;

    if (!success || !accessToken || !refreshToken) {
      return {
        success: false,
        session: null,
        error: error || "No se pudieron obtener los tokens guardados",
      };
    }

    // Restaurar sesión con los tokens
    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      console.error("❌ Error al restaurar sesión:", sessionError);
      // Si los tokens son inválidos, limpiarlos
      await clearStoredTokens();
      return {
        success: false,
        session: null,
        error: sessionError.message,
      };
    }

    if (data?.session) {
      console.log("✅ Sesión restaurada con biometría");

      // Guardar userId en AsyncStorage
      if (data.session.user?.id) {
        await saveUserId(data.session.user.id);
      }

      return {
        success: true,
        session: data.session,
        error: null,
      };
    }

    return {
      success: false,
      session: null,
      error: "No se pudo restaurar la sesión",
    };
  } catch (error) {
    console.error("Error al restaurar sesión con biometría:", error);
    return {
      success: false,
      session: null,
      error: error.message,
    };
  }
};
