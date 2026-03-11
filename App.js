import React, { useState, useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import WelcomeScreen from "./screens/WelcomeScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ProfileScreen from "./screens/ProfileScreen";
import {
  getSession,
  getCurrentUser,
  getUserProfile,
} from "./services/authService";
import { isProfileComplete } from "./services/userService";
import { checkResidentReview } from "./services/communityService";
import posthogLogger from "./services/posthogService";
import { checkVersionUpdate } from "./services/versionService";
import {
  configureNotificationHandler,
  ensureAndroidNotificationChannel,
} from "./src/services/push/notificationConfig";
import { addNotificationResponseListener } from "./src/services/push/notificationListener";
import { useRegisterPushToken } from "./src/hooks/useRegisterPushToken";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [residentHasReview, setResidentHasReview] = useState(true); // Por defecto true para no bloquear
  const [currentUserId, setCurrentUserId] = useState(null);

  useRegisterPushToken(currentUserId);

  useEffect(() => {
    configureNotificationHandler();
    ensureAndroidNotificationChannel();
    const removeListener = addNotificationResponseListener();
    return () => removeListener();
  }, []);

  useEffect(() => {
    // Inicializar PostHog al iniciar la aplicación
    posthogLogger.initialize();
    trackAppOpenAndSession();
    checkAuth();
  }, []);

  const trackAppOpenAndSession = async () => {
    try {
      const appVersion =
        Application.nativeApplicationVersion ||
        Application.applicationVersion ||
        "unknown";
      const os = Platform.OS;
      const deviceType = Platform.isPad ? "tablet" : "phone";

      // Evento de apertura de app
      posthogLogger.capture("App Opened", {
        app_version: appVersion,
        os,
        device_type: deviceType,
      });

      // Inicio de sesión de uso (session en sentido de uso, no auth)
      posthogLogger.capture("Session Started", {
        app_version: appVersion,
        os,
        device_type: deviceType,
      });

      // Evento Daily Active (una vez al día por dispositivo)
      const LAST_ACTIVE_KEY = "@losresis:lastActiveDate";
      const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const lastActiveDate = await AsyncStorage.getItem(LAST_ACTIVE_KEY);

      if (lastActiveDate !== todayKey) {
        posthogLogger.capture("Daily Active", {
          app_version: appVersion,
          os,
          device_type: deviceType,
          day_of_week: new Date().getDay(),
        });
        await AsyncStorage.setItem(LAST_ACTIVE_KEY, todayKey);
      }
    } catch (error) {
      console.warn("Error tracking app/session analytics:", error);
    }
  };

  const checkAuth = async () => {
    try {
      // Primero verificar si hay sesión activa
      const { success, session } = await getSession();
      const hasSession = Boolean(success && session);

      // NO intentar restaurar automáticamente con biometría al iniciar
      // Esto causa problemas en Expo Go y pide código de acceso
      // La restauración con Face ID solo ocurre cuando el usuario presiona el botón explícitamente

      if (hasSession) {
        // Verificar versión de la app al iniciar (si hay sesión activa)
        // Esto asegura que siempre tengamos la versión más reciente cuando el usuario abre la app
        try {
          await checkVersionUpdate(true); // forceRefresh = true para obtener la versión más reciente
        } catch (error) {
          console.warn("Error verificando versión al iniciar:", error);
          // No bloquear el flujo si falla la verificación de versión
        }

        // Verificar si el usuario tiene perfil completo
        const { success: userSuccess, user } = await getCurrentUser();
        if (userSuccess && user) {
          const { success: profileSuccess, profile } = await getUserProfile(
            user.id
          );

          if (profileSuccess && profile) {
            // Verificar si el perfil está completo
            const complete = isProfileComplete(profile, {
              hasActiveEmailReview: false, // No verificamos esto en el check inicial
              isEmailValid: true, // Asumimos válido en el check inicial
            });

            // Si es residente (y no es super admin), verificar si tiene review
            if (profile.is_resident && !profile.is_super_admin) {
              const { success: reviewCheckSuccess, hasReview } =
                await checkResidentReview(user.id);
              if (reviewCheckSuccess) {
                setResidentHasReview(hasReview);
                console.log(
                  `🔍 Residente verificado: ${
                    hasReview ? "tiene" : "NO tiene"
                  } review`
                );
              } else {
                // En caso de error, asumir que no tiene review para ser restrictivo
                setResidentHasReview(false);
              }
            } else {
              // Si no es residente o es super admin, no aplicar restricción
              setResidentHasReview(true);
            }

            setIsAuthenticated(true);
            setNeedsOnboarding(!complete);
            setCurrentUserId(user.id);
            // Identificar usuario en PostHog
            posthogLogger.identify(user.id, {
              email: user.email,
              is_resident: profile.is_resident,
              is_student: profile.is_student,
              is_super_admin: profile.is_super_admin,
            });
          } else {
            // Usuario autenticado pero sin perfil en la base de datos
            setIsAuthenticated(true);
            setNeedsOnboarding(true);
            setResidentHasReview(true); // No aplicar restricción si no hay perfil
            setCurrentUserId(user.id);
            // Identificar usuario en PostHog sin perfil completo
            posthogLogger.identify(user.id, {
              email: user.email,
            });
          }
        } else {
          setIsAuthenticated(false);
          setNeedsOnboarding(false);
          setResidentHasReview(true);
          setCurrentUserId(null);
        }
      } else {
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
        setResidentHasReview(true);
        setCurrentUserId(null);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
      setNeedsOnboarding(false);
      setResidentHasReview(true);
      setCurrentUserId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = async () => {
    // Verificar versión de la app después del login (siempre consultar al backend)
    try {
      console.log("🔄 Verificando versión después del login...");
      await checkVersionUpdate(true); // forceRefresh = true para ignorar caché y consultar Supabase
      console.log("✅ Verificación de versión completada");
    } catch (error) {
      console.warn("Error verificando versión después del login:", error);
      // No bloquear el flujo si falla la verificación de versión
    }

    // Después del login, verificar si necesita onboarding
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

        // Si es residente (y no es super admin), verificar si tiene review
        if (profile.is_resident && !profile.is_super_admin) {
          const { success: reviewCheckSuccess, hasReview } =
            await checkResidentReview(user.id);
          if (reviewCheckSuccess) {
            setResidentHasReview(hasReview);
            console.log(
              `🔍 Residente verificado: ${
                hasReview ? "tiene" : "NO tiene"
              } review`
            );
          } else {
            setResidentHasReview(false);
          }
        } else {
          setResidentHasReview(true);
        }

        setIsAuthenticated(true);
        setNeedsOnboarding(!complete);
        setCurrentUserId(user.id);
        // Identificar usuario en PostHog después del login
        posthogLogger.identify(user.id, {
          email: user.email,
          is_resident: profile.is_resident,
          is_student: profile.is_student,
          is_super_admin: profile.is_super_admin,
        });
      } else {
        // Usuario sin perfil
        setIsAuthenticated(true);
        setNeedsOnboarding(true);
        setResidentHasReview(true);
        setCurrentUserId(user.id);
        // Identificar usuario en PostHog sin perfil completo
        posthogLogger.identify(user.id, {
          email: user.email,
        });
      }
    } else {
      setIsAuthenticated(true);
      setNeedsOnboarding(true);
      setResidentHasReview(true);
      setCurrentUserId(null);
    }
  };

  const handleProfileComplete = async () => {
    // Onboarding completado
    posthogLogger.capture("Onboarding Completed", {
      completed_at: new Date().toISOString(),
    });
    // Recargar verificación de auth para actualizar el estado
    await checkAuth();
  };

  const handleReviewCreated = async () => {
    // Cuando se crea una review, actualizar el estado para habilitar todas las funcionalidades
    const { success: userSuccess, user } = await getCurrentUser();
    if (userSuccess && user) {
      const { success: profileSuccess, profile } = await getUserProfile(
        user.id
      );
      if (
        profileSuccess &&
        profile &&
        profile.is_resident &&
        !profile.is_super_admin
      ) {
        // Verificar si ahora tiene review
        const { success: reviewCheckSuccess, hasReview } =
          await checkResidentReview(user.id);
        if (reviewCheckSuccess) {
          setResidentHasReview(hasReview);
          console.log(
            `✅ Review creada - Residente ahora ${
              hasReview ? "tiene" : "NO tiene"
            } review`
          );
        }
      }
    }
  };

  const handleReviewDeleted = async () => {
    // Cuando se elimina una review, actualizar el estado para bloquear el acceso
    const { success: userSuccess, user } = await getCurrentUser();
    if (userSuccess && user) {
      const { success: profileSuccess, profile } = await getUserProfile(
        user.id
      );
      if (
        profileSuccess &&
        profile &&
        profile.is_resident &&
        !profile.is_super_admin
      ) {
        // Verificar si ahora tiene review (debería ser false)
        const { success: reviewCheckSuccess, hasReview } =
          await checkResidentReview(user.id);
        if (reviewCheckSuccess) {
          setResidentHasReview(hasReview);
          console.log(
            `❌ Review eliminada - Residente ahora ${
              hasReview ? "tiene" : "NO tiene"
            } review`
          );
        }
      }
    }
  };

  const handleSignOut = async () => {
    // Resetear identificación de usuario en PostHog
    posthogLogger.reset();
    setCurrentUserId(null);
    // Forzar que el usuario vuelva a hacer login
    setIsAuthenticated(false);
    setNeedsOnboarding(false);
    // Recargar la verificación de autenticación para asegurar que no hay sesión
    await checkAuth();
  };

  if (isLoading) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {/* Si está autenticado pero necesita onboarding, mostrar ProfileScreen en modo onboarding */}
      {isAuthenticated && needsOnboarding ? (
        <ProfileScreen
        isOnboarding={true}
        onProfileComplete={handleProfileComplete}
        onSignOut={handleSignOut}
          onHospitalPress={() => {}}
          onStudentPress={() => {}}
          onReviewsPress={() => {}}
        />
      ) : isAuthenticated ? (
        <DashboardScreen
          onSignOut={handleSignOut}
          residentHasReview={residentHasReview}
          onReviewCreated={handleReviewCreated}
          onReviewDeleted={handleReviewDeleted}
        />
      ) : (
        <WelcomeScreen onAuthSuccess={handleAuthSuccess} />
      )}
    </SafeAreaProvider>
  );
}
