/**
 * Servicio de autenticación biométrica (Face ID / Touch ID)
 * Maneja la verificación biométrica y el almacenamiento seguro de tokens
 */

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Claves para almacenar tokens de forma segura
const ACCESS_TOKEN_KEY = "biometric_access_token";
const REFRESH_TOKEN_KEY = "biometric_refresh_token";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";

/**
 * Verificar si la autenticación biométrica está disponible en el dispositivo
 * @returns {Promise<{available: boolean, type: string|null, error: string|null}>}
 */
export const checkBiometricAvailability = async () => {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return {
        available: false,
        type: null,
        error: "Este dispositivo no soporta autenticación biométrica",
      };
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      return {
        available: false,
        type: null,
        error: "No hay biometría configurada en este dispositivo",
      };
    }

    // Obtener los tipos de autenticación disponibles
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    let biometricType = "biometric";

    if (
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ) {
      biometricType = "Face ID";
    } else if (
      types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    ) {
      biometricType = Platform.OS === "ios" ? "Touch ID" : "Huella dactilar";
    }

    return {
      available: true,
      type: biometricType,
      error: null,
    };
  } catch (error) {
    console.error("Error al verificar disponibilidad biométrica:", error);
    return {
      available: false,
      type: null,
      error: error.message,
    };
  }
};

/**
 * Autenticar al usuario usando biometría
 * @param {string} reason - Razón para la autenticación (se muestra al usuario)
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const authenticateWithBiometric = async (
  reason = "Autenticarse en la app"
) => {
  try {
    const availability = await checkBiometricAvailability();
    if (!availability.available) {
      return {
        success: false,
        error: availability.error || "Biometría no disponible",
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancelar",
      disableDeviceFallback: false, // Permitir código PIN como alternativa
      fallbackLabel: "Usar código de acceso",
    });

    if (result.success) {
      return {
        success: true,
        error: null,
      };
    } else if (result.error === "user_cancel") {
      return {
        success: false,
        error: "Autenticación cancelada por el usuario",
      };
    } else {
      return {
        success: false,
        error: result.error || "Error en la autenticación biométrica",
      };
    }
  } catch (error) {
    console.error("Error en autenticación biométrica:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Guardar tokens de forma segura para uso con biometría
 * @param {string} accessToken - Token de acceso
 * @param {string} refreshToken - Token de refresco
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const saveTokensSecurely = async (accessToken, refreshToken) => {
  try {
    if (!accessToken || !refreshToken) {
      return {
        success: false,
        error: "Tokens inválidos",
      };
    }

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, {
      requireAuthentication: false, // No requerir autenticación para guardar
      authenticationPrompt: "Guardar credenciales de forma segura",
    });

    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, {
      requireAuthentication: false,
      authenticationPrompt: "Guardar credenciales de forma segura",
    });

    console.log("✅ Tokens guardados de forma segura");
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Error al guardar tokens:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtener tokens guardados de forma segura
 * Requiere autenticación biométrica para acceder
 * @returns {Promise<{success: boolean, accessToken: string|null, refreshToken: string|null, error: string|null}>}
 */
export const getStoredTokens = async () => {
  try {
    // Primero autenticar con biometría
    const authResult = await authenticateWithBiometric(
      "Acceder a tus credenciales guardadas"
    );

    if (!authResult.success) {
      return {
        success: false,
        accessToken: null,
        refreshToken: null,
        error: authResult.error,
      };
    }

    // Si la autenticación fue exitosa, obtener los tokens
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY, {
      requireAuthentication: false, // Ya autenticamos arriba
    });

    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, {
      requireAuthentication: false,
    });

    if (!accessToken || !refreshToken) {
      return {
        success: false,
        accessToken: null,
        refreshToken: null,
        error: "No se encontraron tokens guardados",
      };
    }

    return {
      success: true,
      accessToken,
      refreshToken,
      error: null,
    };
  } catch (error) {
    console.error("Error al obtener tokens:", error);
    return {
      success: false,
      accessToken: null,
      refreshToken: null,
      error: error.message,
    };
  }
};

/**
 * Verificar si hay tokens guardados (sin autenticar)
 * En Expo Go, esto puede causar que se pida el código de acceso
 * @returns {Promise<boolean>}
 */
export const hasStoredTokens = async () => {
  try {
    // Intentar acceder sin autenticación
    // En Expo Go, esto puede fallar o pedir código de acceso
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY, {
      requireAuthentication: false,
    });
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, {
      requireAuthentication: false,
    });
    return !!(accessToken && refreshToken);
  } catch (error) {
    // En Expo Go, puede fallar silenciosamente
    // No es un error crítico, simplemente no hay tokens disponibles
    console.log(
      "ℹ️ No se pudieron verificar tokens (normal en Expo Go):",
      error.message
    );
    return false;
  }
};

/**
 * Eliminar tokens guardados
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const clearStoredTokens = async () => {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    console.log("✅ Tokens eliminados");
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Error al eliminar tokens:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Habilitar o deshabilitar la autenticación biométrica
 * @param {boolean} enabled - Si debe estar habilitada
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const setBiometricEnabled = async (enabled) => {
  try {
    if (enabled) {
      // Verificar disponibilidad antes de habilitar
      const availability = await checkBiometricAvailability();
      if (!availability.available) {
        return {
          success: false,
          error: availability.error || "Biometría no disponible",
        };
      }
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
    } else {
      // Si se deshabilita, también eliminar los tokens guardados
      await clearStoredTokens();
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    }
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Error al cambiar estado de biometría:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verificar si la autenticación biométrica está habilitada
 * @returns {Promise<boolean>}
 */
export const isBiometricEnabled = async () => {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === "true";
  } catch (error) {
    console.error("Error al verificar estado de biometría:", error);
    return false;
  }
};

/**
 * Verificar si el usuario ya ha sido preguntado sobre Face ID
 * @returns {Promise<boolean>}
 */
export const hasBeenAskedAboutBiometric = async () => {
  try {
    const asked = await SecureStore.getItemAsync("biometric_asked");
    return asked === "true";
  } catch (error) {
    console.error("Error al verificar si se preguntó sobre biometría:", error);
    return false;
  }
};

/**
 * Marcar que el usuario ya fue preguntado sobre Face ID
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const markBiometricAsked = async () => {
  try {
    await SecureStore.setItemAsync("biometric_asked", "true");
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Error al marcar pregunta de biometría:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
