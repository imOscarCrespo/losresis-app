import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  TouchableOpacity,
  ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FaceIdLogo } from "../components/FaceIdLogo";
import { LosResisLogo } from "../components/LosResisLogo";
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
  const insets = useSafeAreaInsets();
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

      // Tracking de inicio de autenticación
      posthogLogger.capture("Auth Started", {
        provider,
        platform: Platform.OS,
      });

      // Ejecutar el sign in correspondiente según el provider
      const signInFunction =
        provider === "google" ? signInWithGoogle : signInWithApple;
      const result = await signInFunction(redirectUrl);

      if (result.success) {
        // Autenticación completada correctamente (signup/login)
        posthogLogger.capture("Auth Completed", {
          provider,
          platform: Platform.OS,
        });
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        {/* Hero: pantalla completa arriba, contenido con inset para Dynamic Island/notch */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={{
              uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuAN2ZQrWQHhKMf3XXkD0upVsZsRwLEN_aRgeKcpgkaVXPq6JzmO_DQ_bAPTI3-3uOV-1inQlcfSeLFGpmomhX4gynnDlq26xCup1lfrDj1EhdmnIkjop5ci7PGRSSzutvJponn9Pvjbz_ANmfEbfOF6X5ySesI701-LI0ulSPWpWQukniZSl18PXUMlBbcT0FZLQ62RHTd6dQ-65yf_2gRPR4kcoSg2W41c3vlLndS0dr4dOIDoKKVeeDKQdZFOz9uouoA0a5oU-d-B",
            }}
            style={styles.heroBackground}
            imageStyle={styles.heroBackgroundImage}
            resizeMode="cover"
            blurRadius={2}
          >
            <View style={styles.heroOverlay} />
            <View
              style={[
                styles.heroContent,
                { paddingTop: Math.max(insets.top, 24) },
              ]}
            >
              <View style={styles.heroContentCenter}>
                <View style={styles.heroLogoRow}>
                  <LosResisLogo width={160} height={160} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Bottom sheet: fondo hasta el borde inferior, contenido respetando el home indicator */}
        <View style={styles.bottomSheet}>
          <View style={styles.bottomHandleContainer}>
            <View style={styles.bottomHandle} />
          </View>
          <View
            style={[
              styles.bottomContent,
              { paddingBottom: 24 + insets.bottom },
            ]}
          >
            <View style={styles.welcomeHeader}>
              <Text style={styles.welcomeTitle}>Bienvenido de nuevo</Text>
              <Text style={styles.welcomeSubtitle}>
                Accede a tu plataforma MIR personalizada
              </Text>
            </View>

            <View style={styles.actionsContainer}>
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

              {/* Apple Sign In Button - Solo en iOS */}
              {isIOS && (
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
              )}

              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Face ID Button - Siempre visible si Face ID está disponible */}
              {biometricAvailable && (
                <TouchableOpacity
                  style={[
                    styles.biometricCard,
                    (!biometricEnabled ||
                      !hasStoredTokensState ||
                      signingInWithBiometric ||
                      isChecking) &&
                      styles.biometricCardDisabled,
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
                      <View style={styles.biometricIconContainer}>
                        <FaceIdLogo
                          width={32}
                          height={32}
                          color={COLORS.PRIMARY}
                        />
                      </View>
                      <View style={styles.biometricTextContainer}>
                        <Text style={styles.biometricTitle}>Acceso rápido</Text>
                        <Text style={styles.biometricSubtitle}>
                          {biometricEnabled && hasStoredTokensState
                            ? `Toca para entrar con ${
                                biometricType || "Face ID"
                              }`
                            : `Activa ${
                                biometricType || "Face ID"
                              } después de iniciar sesión`}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={COLORS.PRIMARY}
                      />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.bottomNote}>
              Si es tu primera vez, inicia sesión para crear tu cuenta
              automáticamente.
            </Text>
          </View>
        </View>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#171022",
  },
  container: {
    flex: 1,
    backgroundColor: "#171022",
  },
  screen: {
    flex: 1,
    backgroundColor: "#171022",
  },
  heroContainer: {
    height: "55%",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  heroBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroBackgroundImage: {
    transform: [{ scale: 1.05 }],
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(100, 10, 245, 0.68)",
  },
  heroContent: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  heroContentCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroLogoRow: {
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "56%",
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  bottomHandleContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  bottomHandle: {
    width: 48,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  bottomContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  welcomeHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  welcomeSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  actionsContainer: {
    gap: 16,
  },
  appleButton: {
    width: "100%",
    height: 56,
    borderRadius: 16,
  },
  googleButton: {
    width: "100%",
    height: 56,
    borderRadius: 16,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.BORDER,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.TEXT_LIGHT,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  biometricCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(103, 12, 245, 0.2)",
    backgroundColor: "rgba(103, 12, 245, 0.04)",
    gap: 12,
  },
  biometricCardDisabled: {
    opacity: 0.7,
  },
  biometricIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.WHITE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  biometricTextContainer: {
    flex: 1,
  },
  biometricTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  biometricSubtitle: {
    fontSize: 12,
    color: "#6B7280",
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
  bottomNote: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    color: "#1B0977",
  },
});
