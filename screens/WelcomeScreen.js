import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import {
  signInWithGoogle,
  getCurrentUser,
  getUserProfile,
  hasCompleteProfile,
} from "../services/authService";
import { supabase } from "../config/supabase";
import * as Linking from "expo-linking";

const isDevelopment = __DEV__;

export default function WelcomeScreen({ onAuthSuccess }) {
  const [isChecking, setIsChecking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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

    // Verificar si el usuario ya está autenticado
    checkAuth();
  }, []);

  const handleAuthCallback = async (url) => {
    console.log("🔗 Callback recibido:", url);

    try {
      // Extraer los parámetros de la URL
      const { queryParams } = Linking.parse(url);

      if (queryParams?.access_token || queryParams?.code) {
        // El usuario se autenticó, verificar sesión
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("❌ Error al obtener sesión:", sessionError);
          return;
        }

        if (session) {
          console.log("✅ Usuario autenticado via callback, redirigiendo...");
          setIsChecking(false);

          // Verificar perfil y navegar
          const { success: profileSuccess, profile } = await getUserProfile(
            session.user.id
          );

          if (profileSuccess && profile && hasCompleteProfile(profile)) {
            console.log("✅ Perfil completo, navegando al dashboard");
          } else {
            console.log(
              "⚠️ Perfil incompleto, navegando al dashboard para completarlo"
            );
          }

          // Notificar que la autenticación fue exitosa
          if (onAuthSuccess) {
            onAuthSuccess();
          }
        }
      }
    } catch (error) {
      console.error("❌ Error en handleAuthCallback:", error);
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

      const { success, user } = await getCurrentUser();

      if (success && user) {
        console.log("✅ Usuario ya autenticado, verificando perfil...");

        const { success: profileSuccess, profile } = await getUserProfile(
          user.id
        );

        if (profileSuccess && profile) {
          console.log("✅ Perfil de usuario obtenido:", profile);

          if (hasCompleteProfile(profile)) {
            console.log("✅ Usuario con perfil completo, redirigiendo...");
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          } else {
            console.log(
              "⚠️ Usuario sin tipo definido, redirigiendo al dashboard"
            );
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          }
        } else {
          console.log("⚠️ Perfil no existe, redirigiendo al dashboard");
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

  const handleSignIn = async () => {
    if (isChecking) {
      console.log("⚠️ Sign in already in progress, skipping...");
      return;
    }

    // En desarrollo, simular login
    // if (isDevelopment) {
    //   console.log("🚀 Development: Simulando login...");
    //   if (navigation) {
    //     navigation.navigate("Dashboard");
    //   }
    //   return;
    // }

    try {
      setIsChecking(true);

      // Obtener la URL de redirección
      // IMPORTANTE: Usar el scheme de la app móvil (losresis://)
      // NO usar URLs web (https://)
      let redirectUrl = Linking.createURL("/auth/callback", {
        scheme: "losresis",
      });

      // Si createURL devuelve una URL exp:// o http://, forzar losresis://
      if (!redirectUrl.startsWith("losresis://")) {
        redirectUrl = "losresis://auth/callback";
        console.log("🔄 Forzando URL móvil:", redirectUrl);
      }

      console.log("🔗 Redirect URL creada:", redirectUrl);

      const result = await signInWithGoogle(redirectUrl);

      if (result.success) {
        console.log("✅ Login exitoso");
        // Verificar el perfil del usuario después del login
        const { success: userSuccess, user } = await getCurrentUser();
        if (userSuccess && user) {
          console.log("✅ Usuario autenticado:", user.email);

          // Notificar que la autenticación fue exitosa
          if (onAuthSuccess) {
            onAuthSuccess();
          }
        }
      } else {
        console.error("❌ Error en OAuth:", result.error);
        alert("Error al iniciar sesión: " + result.error);
      }

      setIsChecking(false);
    } catch (error) {
      console.error("❌ Error en sign in:", error);
      setIsChecking(false);
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

            {/* Google Sign In Button */}
            <View style={styles.buttonContainer}>
              <Button
                title={
                  isChecking ? "Verificando perfil..." : "Continuar con Google"
                }
                onPress={handleSignIn}
                loading={!!isChecking}
                disabled={!!isChecking}
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
});
