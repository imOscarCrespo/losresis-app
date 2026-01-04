import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FaceIdLogo } from "../components/FaceIdLogo";
import {
  signInWithGoogle,
  signInWithApple,
  getCurrentUser,
  getUserProfile,
  saveUserId,
  restoreSessionWithBiometric,
} from "../services/authService";
import { isProfileComplete } from "../services/userService";
import {
  checkBiometricAvailability,
  isBiometricEnabled,
  hasBeenAskedAboutBiometric,
  markBiometricAsked,
  setBiometricEnabled,
  clearStoredTokens,
} from "../services/biometricService";
import { supabase } from "../config/supabase";
import * as Linking from "expo-linking";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";

const isDevelopment = __DEV__;
const isIOS = Platform.OS === "ios";

export default function WelcomeScreen({ onAuthSuccess }) {
  const [isChecking, setIsChecking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [signingInProvider, setSigningInProvider] = useState(null); // 'google' | 'apple' | 'biometric' | null
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [signingInWithBiometric, setSigningInWithBiometric] = useState(false);
  const [hasStoredTokensState, setHasStoredTokensState] = useState(false);
  const [pendingAuthSuccess, setPendingAuthSuccess] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Configurar deep linking para OAuth callback
    const setupDeepLinking = async () => {
      const url = await Linking.getInitialURLAsync();
      if (url) {
        handleAuthCallback(url);
      }

      // Escuchar URLs mientras la app está abierta
      const subscription = Linking.addEventListener("url", (event) => {
        handleAuthCallback(event.url);
      });

      return () => subscription.remove();
    };

    setupDeepLinking();

    // Verificar disponibilidad de biometría
    checkBiometricSetup();

    // Verificar si el usuario ya está autenticado
    checkAuth();
  }, []);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("WelcomeScreen");
  }, []);

  // Verificar configuración de biometría
  const checkBiometricSetup = async () => {
    try {
      const availability = await checkBiometricAvailability();
      setBiometricAvailable(availability.available);
      setBiometricType(availability.type);

      if (availability.available) {
        const enabled = await isBiometricEnabled();
        setBiometricEnabledState(enabled);

        // Siempre verificar si hay tokens guardados (incluso si no está habilitado)
        // Esto permite mostrar el estado correcto del botón
        const { hasStoredTokens } = await import(
          "../services/biometricService"
        );
        const hasTokens = await hasStoredTokens();
        setHasStoredTokensState(hasTokens);
      } else {
        setBiometricEnabledState(false);
        setHasStoredTokensState(false);
      }
    } catch (error) {
      console.error("Error al verificar biometría:", error);
      setBiometricEnabledState(false);
      setHasStoredTokensState(false);
    }
  };

  // Verificar si debemos mostrar el prompt después del login
  const checkBiometricPromptAfterLogin = async () => {
    try {
      const availability = await checkBiometricAvailability();
      if (!availability.available) {
        return false;
      }

      const enabled = await isBiometricEnabled();
      const hasBeenAsked = await hasBeenAskedAboutBiometric();

      console.log("🔍 Verificando prompt de biometría:", {
        enabled,
        hasBeenAsked,
        available: availability.available,
      });

      // Solo mostrar prompt si no está habilitado y no se ha preguntado
      if (!enabled && !hasBeenAsked) {
        // Marcar que hay un auth success pendiente
        setPendingAuthSuccess(true);
        setShowBiometricPrompt(true);
        console.log("✅ Modal de biometría mostrado");
        return true; // Indica que se mostró el prompt
      }

      console.log("ℹ️ No se muestra el modal:", {
        enabled,
        hasBeenAsked,
      });
      return false; // No se mostró el prompt
    } catch (error) {
      console.error("Error al verificar prompt de biometría:", error);
      return false;
    }
  };

  // Manejar respuesta del usuario sobre Face ID
  const handleBiometricPromptResponse = async (accept) => {
    setShowBiometricPrompt(false);
    await markBiometricAsked();

    if (accept) {
      const result = await setBiometricEnabled(true);
      if (result.success) {
        setBiometricEnabledState(true);

        // Esperar un momento para que la sesión se establezca completamente
        // Luego intentar guardar los tokens con retry
        const saveTokensWithRetry = async (retries = 3, delay = 500) => {
          for (let i = 0; i < retries; i++) {
            try {
              const {
                data: { session },
                error: sessionError,
              } = await supabase.auth.getSession();

              if (sessionError) {
                console.error("Error al obtener sesión:", sessionError);
                if (i < retries - 1) {
                  await new Promise((resolve) => setTimeout(resolve, delay));
                  continue;
                }
                return;
              }

              if (session?.access_token && session?.refresh_token) {
                const { saveTokensSecurely } = await import(
                  "../services/biometricService"
                );
                const saveResult = await saveTokensSecurely(
                  session.access_token,
                  session.refresh_token
                );
                if (saveResult.success) {
                  // Tokens guardados exitosamente
                  // Actualizar el estado para mostrar el botón
                  setHasStoredTokensState(true);
                  return;
                } else {
                  console.error(
                    "❌ Error al guardar tokens:",
                    saveResult.error
                  );
                  if (i < retries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    continue;
                  }
                }
              } else {
                if (i < retries - 1) {
                  await new Promise((resolve) => setTimeout(resolve, delay));
                  continue;
                } else {
                  console.error(
                    "❌ No se pudieron obtener tokens después de varios intentos"
                  );
                }
              }
            } catch (error) {
              console.error(
                `Error al guardar tokens (intento ${i + 1}):`,
                error
              );
              if (i < retries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }
        };

        // Iniciar el proceso de guardado con retry
        await saveTokensWithRetry();
      } else {
        Alert.alert("Error", result.error || "No se pudo activar Face ID");
      }
    }

    // Actualizar el estado de biometría después de la respuesta
    await checkBiometricSetup();

    // Si hay un auth success pendiente, ejecutarlo ahora
    if (pendingAuthSuccess) {
      setPendingAuthSuccess(false);
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    }
  };

  // Manejar login con Face ID
  const handleSignInWithBiometric = async () => {
    // Solo permitir si Face ID está habilitado y hay tokens guardados
    if (!biometricEnabled || !hasStoredTokensState) {
      Alert.alert(
        "Face ID no disponible",
        "Primero debes iniciar sesión y activar Face ID para poder usarlo."
      );
      return;
    }

    if (signingInWithBiometric || isChecking) {
      return;
    }

    try {
      setSigningInWithBiometric(true);
      setSigningInProvider("biometric");

      const restoreResult = await restoreSessionWithBiometric();

      if (restoreResult.success && restoreResult.session) {
        // Actualizar estado de biometría después de restaurar sesión
        await checkBiometricSetup();

        // Verificar perfil del usuario
        const { success: userSuccess, user } = await getCurrentUser();
        if (userSuccess && user) {
          const { success: profileSuccess, profile } = await getUserProfile(
            user.id
          );

          if (profileSuccess && profile) {
            const complete = isProfileComplete(profile, {
              hasActiveEmailReview: false,
              isEmailValid: true,
            });

            if (onAuthSuccess) {
              onAuthSuccess();
            }
          } else {
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          }
        } else {
          Alert.alert("Error", "No se pudo obtener la información del usuario");
        }
      } else {
        // Si falla, puede ser que los tokens expiraron
        // Limpiar tokens inválidos y actualizar estado
        await clearStoredTokens();
        await checkBiometricSetup();

        Alert.alert(
          "Face ID no disponible",
          restoreResult.error ||
            "No se pudo restaurar la sesión. Por favor, inicia sesión con Google o Apple."
        );
      }
    } catch (error) {
      console.error("Error en login con Face ID:", error);
      Alert.alert(
        "Error",
        "Ocurrió un error al intentar iniciar sesión con Face ID"
      );
    } finally {
      setSigningInWithBiometric(false);
      setSigningInProvider(null);
    }
  };

  const handleAuthCallback = async (url) => {
    try {
      console.log("🔗 handleAuthCallback recibió URL:", url);

      // Extraer parámetros tanto del query string como del hash
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

      const { queryParams } = Linking.parse(url);
      const hashParams = extractHashParams(url);

      console.log("📋 Query params:", Object.keys(queryParams || {}));
      console.log("📋 Hash params:", Object.keys(hashParams));

      // Buscar tokens tanto en queryParams como en hashParams
      const hasToken =
        queryParams?.access_token ||
        queryParams?.code ||
        hashParams?.access_token ||
        hashParams?.code;

      if (hasToken) {
        // Marcar que estamos procesando autenticación
        setIsProcessingAuth(true);

        // Intentar obtener la sesión actual primero
        let { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        // Si no hay sesión y tenemos tokens en el hash, establecerla manualmente
        if (
          (sessionError || !sessionData?.session) &&
          (hashParams?.access_token || hashParams?.refresh_token)
        ) {
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
              setIsProcessingAuth(false);
              return;
            }

            if (manualSession?.session) {
              console.log("✅ Sesión establecida correctamente desde hash");
              sessionData = manualSession;
            }
          } else if (hashParams?.code) {
            // Si hay un code, intentar intercambiarlo por sesión
            console.log("🔄 Intentando intercambiar código por sesión...");
            const { data: codeSession, error: codeError } =
              await supabase.auth.exchangeCodeForSession(hashParams.code);

            if (!codeError && codeSession?.session) {
              console.log("✅ Sesión obtenida mediante código");
              sessionData = codeSession;
            }
          }
        }

        if (sessionError && !sessionData?.session) {
          console.error("❌ Error al obtener sesión:", sessionError);
          setIsProcessingAuth(false);
          return;
        }

        const session = sessionData?.session;

        if (session) {
          // Guardar userId en caché
          if (session.user?.id) {
            await saveUserId(session.user.id);
          }

          // Guardar tokens para Face ID si está habilitado
          const enabled = await isBiometricEnabled();

          if (enabled && session.access_token && session.refresh_token) {
            const { saveTokensSecurely } = await import(
              "../services/biometricService"
            );
            const saveResult = await saveTokensSecurely(
              session.access_token,
              session.refresh_token
            );
            if (saveResult.success) {
              // Actualizar el estado para mostrar el botón
              setHasStoredTokensState(true);
            }
            // Resetear el estado de loading
            setIsChecking(false);
            setSigningInProvider(null);
            setIsProcessingAuth(false);
            // Notificar que la autenticación fue exitosa
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          } else if (!enabled) {
            // Si Face ID no está habilitado, verificar si debemos preguntar
            // Esperar un momento para que la UI se actualice y la sesión se establezca
            setTimeout(async () => {
              // Verificar nuevamente el estado antes de mostrar el modal
              const currentEnabled = await isBiometricEnabled();
              const currentAsked = await hasBeenAskedAboutBiometric();

              if (!currentEnabled && !currentAsked) {
                const promptShown = await checkBiometricPromptAfterLogin();
                // Solo notificar auth success si NO se mostró el prompt
                if (!promptShown && onAuthSuccess) {
                  onAuthSuccess();
                }
              } else {
                // Si ya está habilitado o ya se preguntó, continuar normalmente
                if (onAuthSuccess) {
                  onAuthSuccess();
                }
              }
              setIsProcessingAuth(false);
            }, 1500);
            // Resetear el estado de loading
            setIsChecking(false);
            setSigningInProvider(null);
            return; // Salir temprano, el callback se manejará en el setTimeout
          } else {
            // Resetear el estado de loading inmediatamente
            setIsChecking(false);
            setSigningInProvider(null);
            setIsProcessingAuth(false);
            // Notificar que la autenticación fue exitosa
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          }
        } else {
          setIsProcessingAuth(false);
        }
      }
    } catch (error) {
      console.error("❌ Error en handleAuthCallback:", error);
      setIsProcessingAuth(false);
    }
  };

  const checkAuth = async () => {
    if (isDevelopment) {
      setIsLoading(false);
      return;
    }

    if (isCheckingRef.current) {
      return;
    }

    try {
      isCheckingRef.current = true;
      setIsChecking(true);

      // Verificar estado de biometría cuando se carga la pantalla
      // Esto asegura que el botón se muestre correctamente si hay tokens guardados
      await checkBiometricSetup();

      const { success, user } = await getCurrentUser();

      if (success && user) {
        // Guardar userId en caché si aún no está guardado
        if (user.id) {
          await saveUserId(user.id);
        }

        const { success: profileSuccess, profile } = await getUserProfile(
          user.id
        );

        if (profileSuccess && profile) {
          const complete = isProfileComplete(profile, {
            hasActiveEmailReview: false,
            isEmailValid: true,
          });

          if (complete) {
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          } else {
            // Llamar a onAuthSuccess para que App.js maneje el onboarding
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          }
        } else {
          // Llamar a onAuthSuccess para que App.js maneje el onboarding
          if (onAuthSuccess) {
            onAuthSuccess();
          }
        }
      }
    } catch (error) {
      console.error("❌ Error checking auth:", error);
    } finally {
      setIsChecking(false);
      setIsLoading(false);
      isCheckingRef.current = false;
    }
  };

  /**
   * Función genérica para manejar sign in con cualquier provider
   * @param {'google' | 'apple'} provider - Provider de autenticación
   */
  const handleSignIn = async (provider) => {
    if (isChecking || signingInProvider) {
      return;
    }

    try {
      setIsChecking(true);
      setSigningInProvider(provider);

      // Obtener la URL de redirección
      // IMPORTANTE: Usar el scheme de la app móvil (losresis://)
      // NO usar URLs web (https://)
      let redirectUrl = Linking.createURL("/auth/callback", {
        scheme: "losresis",
      });

      // Si createURL devuelve una URL exp:// o http://, forzar losresis://
      if (!redirectUrl.startsWith("losresis://")) {
        redirectUrl = "losresis://auth/callback";
      }

      // Ejecutar el sign in correspondiente según el provider
      const signInFunction =
        provider === "google" ? signInWithGoogle : signInWithApple;
      const result = await signInFunction(redirectUrl);

      if (result.success) {
        // Si handleAuthCallback ya está procesando, no hacer nada aquí
        // El callback manejará el flujo completo
        if (isProcessingAuth) {
          setIsChecking(false);
          setSigningInProvider(null);
          return;
        }

        // Esperar un momento para que la sesión se establezca completamente
        // antes de verificar tokens y mostrar el prompt
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Verificar el perfil del usuario después del login
        const { success: userSuccess, user } = await getCurrentUser();

        // Verificar si debemos mostrar el prompt de biometría después del login
        // Esto debe hacerse independientemente de si se obtuvo el usuario o no
        const promptShown = await checkBiometricPromptAfterLogin();

        // Si se mostró el prompt, NO llamar a onAuthSuccess todavía
        // Se llamará después de que el usuario responda en handleBiometricPromptResponse
        if (promptShown) {
          // El modal se mostrará y esperará la respuesta del usuario
          // No redirigir todavía
          setIsChecking(false);
          setSigningInProvider(null);
          return;
        }

        // Solo notificar auth success si NO se mostró el prompt
        if (onAuthSuccess) {
          onAuthSuccess();
        }

        // Resetear el estado de loading del botón
        setIsChecking(false);
        setSigningInProvider(null);
      } else {
        console.error("❌ Error en OAuth:", result.error);
        setIsChecking(false);
        setSigningInProvider(null);
        Alert.alert(
          "Error al iniciar sesión",
          result.error ||
            "No se pudo completar el inicio de sesión. Por favor, intenta de nuevo.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("❌ Error en sign in:", error);
      setIsChecking(false);
      setSigningInProvider(null);
      alert("Error inesperado: " + error.message);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>¡Bienvenido!</Text>
            <Text style={styles.subtitle}>
              Accede a <Text style={styles.highlight}>LosResis</Text>
            </Text>
          </View>

          {/* Login Card */}
          <Card style={styles.loginCard}>
            {/* Description */}
            <Text style={styles.description}>
              Encuentra el hospital ideal para tu residencia médica.{"\n"}
              <Text style={styles.descriptionBold}>
                Opiniones reales, decisiones inteligentes.
              </Text>
            </Text>

            {/* Sign In Buttons */}
            <View style={styles.buttonContainer}>
              {/* Face ID Button - Siempre visible si Face ID está disponible */}
              {biometricAvailable && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.biometricButton,
                      (!biometricEnabled ||
                        !hasStoredTokensState ||
                        signingInWithBiometric ||
                        isChecking) &&
                        styles.biometricButtonDisabled,
                    ]}
                    onPress={handleSignInWithBiometric}
                    disabled={
                      !biometricEnabled ||
                      !hasStoredTokensState ||
                      signingInWithBiometric ||
                      isChecking
                    }
                  >
                    {signingInWithBiometric ? (
                      <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                    ) : (
                      <>
                        <FaceIdLogo
                          width={24}
                          height={24}
                          color={
                            biometricEnabled && hasStoredTokensState
                              ? COLORS.PRIMARY
                              : COLORS.TEXT_LIGHT
                          }
                        />
                        <View style={styles.biometricButtonTextContainer}>
                          <Text
                            style={[
                              styles.biometricButtonText,
                              (!biometricEnabled || !hasStoredTokensState) &&
                                styles.biometricButtonTextDisabled,
                            ]}
                          >
                            {biometricEnabled && hasStoredTokensState
                              ? `Accede con ${biometricType || "Face ID"}`
                              : `Inicia sesión primero para activar ${
                                  biometricType || "Face ID"
                                }`}
                          </Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                  <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>o</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </>
              )}

              {/* Apple Sign In Button - Solo en iOS */}
              {isIOS && (
                <>
                  <Button
                    title={
                      signingInProvider === "apple"
                        ? "Verificando perfil..."
                        : "Continuar con Apple"
                    }
                    onPress={() => handleSignIn("apple")}
                    loading={signingInProvider === "apple"}
                    disabled={!!isChecking || signingInWithBiometric}
                    variant="apple"
                    style={styles.appleButton}
                  />
                  <View style={{ height: 12 }} />
                </>
              )}

              {/* Google Sign In Button */}
              <Button
                title={
                  signingInProvider === "google"
                    ? "Verificando perfil..."
                    : "Continuar con Google"
                }
                onPress={() => handleSignIn("google")}
                loading={signingInProvider === "google"}
                disabled={!!isChecking || signingInWithBiometric}
                variant="google"
                style={styles.googleButton}
              />
            </View>

            {/* Supabase Auth Badge */}
            <View style={styles.authBadge}>
              <View style={styles.greenDot} />
              <View style={{ width: 8 }} />
              <Text style={styles.authText}>
                Protegido por <Text style={styles.authBold}>Supabase Auth</Text>
              </Text>
            </View>

            {/* New User Info */}
            <View style={styles.newUserContainer}>
              <Text style={styles.newUserTitle}>¿Nuevo en la plataforma?</Text>
              <Text style={styles.newUserText}>
                Tu cuenta se creará automáticamente al iniciar sesión
              </Text>
            </View>
          </Card>

          {/* Footer */}
          <Text style={styles.footer}>
            Conectando futuros médicos con su hospital ideal
          </Text>
        </View>
      </ScrollView>

      {/* Modal para preguntar sobre Face ID la primera vez */}
      <Modal
        visible={showBiometricPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // No permitir cerrar sin responder si hay auth success pendiente
          if (!pendingAuthSuccess) {
            handleBiometricPromptResponse(false);
          }
        }}
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <FaceIdLogo width={64} height={64} color={COLORS.PRIMARY} />
            </View>
            <Text style={styles.modalTitle}>
              ¿Quieres usar {biometricType || "Face ID"}?
            </Text>
            <Text style={styles.modalDescription}>
              Puedes iniciar sesión rápidamente usando tu{" "}
              {biometricType || "autenticación biométrica"} sin necesidad de
              ingresar tus credenciales cada vez.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => handleBiometricPromptResponse(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Ahora no</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => handleBiometricPromptResponse(true)}
              >
                <Text style={styles.modalButtonTextPrimary}>Activar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#6B46C1",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  highlight: {
    color: "#007AFF",
    fontWeight: "600",
  },
  loginCard: {
    marginBottom: 24,
  },
  description: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  descriptionBold: {
    fontWeight: "600",
    color: "#333",
  },
  buttonContainer: {
    marginBottom: 16,
  },
  appleButton: {
    width: "100%",
  },
  googleButton: {
    width: "100%",
  },
  authBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  authText: {
    fontSize: 12,
    color: "#666",
  },
  authBold: {
    fontWeight: "600",
  },
  newUserContainer: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  newUserTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E40AF",
    marginBottom: 4,
    textAlign: "center",
  },
  newUserText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 16,
  },
  footer: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.WHITE,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  biometricButtonDisabled: {
    opacity: 0.6,
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  biometricButtonTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  biometricButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  biometricButtonTextDisabled: {
    color: COLORS.TEXT_LIGHT,
    fontSize: 14,
    fontWeight: "500",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.BORDER,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginBottom: 12,
    textAlign: "center",
  },
  modalDescription: {
    fontSize: 15,
    color: COLORS.TEXT_MEDIUM,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.PRIMARY,
  },
  modalButtonSecondary: {
    backgroundColor: COLORS.GRAY_LIGHT,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  modalButtonTextPrimary: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextSecondary: {
    color: COLORS.TEXT_DARK,
    fontSize: 16,
    fontWeight: "600",
  },
});
