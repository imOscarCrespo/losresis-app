import React, { useState, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { ForceUpdateScreen } from "./components/ForceUpdateScreen";
import { useVersionCheck } from "./hooks/useVersionCheck";
import WelcomeScreen from "./screens/WelcomeScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ProfileScreen from "./screens/ProfileScreen";
import { supabase } from "./config/supabase";
import {
  getSession,
  getCurrentUser,
  getUserProfile,
} from "./services/authService";
import { isProfileComplete } from "./services/userService";
import { getEmailReviewRequest } from "./services/emailReviewService";
import { checkResidentReview } from "./services/communityService";
import posthogLogger from "./services/posthogService";
import {
  getResidentReviewGateConfig,
  incrementResidentReviewGateSession,
  initializeResidentReviewGate,
  resetResidentReviewGate,
} from "./services/residentReviewGateService";
import { shouldBypassResidentReviewGate } from "./utils/residentAccess";
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
  const [residentReviewGateState, setResidentReviewGateState] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const gateSessionTrackedRef = useRef(null);
  const {
    needsUpdate,
    isForceUpdate,
    currentVersion,
    minVersion,
    updateUrl,
    isLoading: isVersionCheckLoading,
    refreshVersionCheck,
  } = useVersionCheck();

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

  useEffect(() => {
    if (AppState.currentState === "active") {
      supabase.auth.startAutoRefresh();
    }

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        supabase.auth.startAutoRefresh();
        refreshVersionCheck({ force: true, reason: "resume" }).catch((error) => {
          console.warn("Error verificando versión al reanudar:", error);
        });
        checkAuth({ forceProfileRefresh: true }).catch((error) => {
          console.warn("Error revalidando sesión al reanudar:", error);
        });
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => subscription.remove();
  }, [refreshVersionCheck]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        posthogLogger.reset();
        gateSessionTrackedRef.current = null;
        setCurrentUserId(null);
        setResidentHasReview(true);
        setResidentReviewGateState(null);
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
        setIsLoading(false);
        return;
      }

      if (event === "SIGNED_IN" && session) {
        checkAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncResidentReviewGate = async ({
    userId,
    hasReview,
    isResident,
    isSuperAdmin,
    bypassReviewRequirement = false,
    countSession = false,
  }) => {
    try {
      const initializedState = await initializeResidentReviewGate(userId, {
        hasReview,
        isResident,
        isSuperAdmin,
        bypassReviewRequirement,
      });

      if (
        !userId ||
        hasReview ||
        !isResident ||
        isSuperAdmin ||
        bypassReviewRequirement
      ) {
        setResidentReviewGateState(null);
        gateSessionTrackedRef.current = null;
        return null;
      }

      let nextState = initializedState;

      if (countSession && gateSessionTrackedRef.current !== userId) {
        nextState = await incrementResidentReviewGateSession(userId);
        gateSessionTrackedRef.current = userId;
      }

      setResidentReviewGateState(nextState);
      return nextState;
    } catch (error) {
      console.error("Error syncing resident review gate:", error);
      setResidentReviewGateState(null);
      return null;
    }
  };

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

  const checkAuth = async ({ forceProfileRefresh = true } = {}) => {
    try {
      // Primero verificar si hay sesión activa
      const { success, session } = await getSession();
      const hasSession = Boolean(success && session);

      // NO intentar restaurar automáticamente con biometría al iniciar
      // Esto causa problemas en Expo Go y pide código de acceso
      // La restauración con Face ID solo ocurre cuando el usuario presiona el botón explícitamente

      if (hasSession) {
        // Forzar refresh al restaurar una sesión persistida para que el badge
        // no dependa de un nuevo login.
        try {
          await refreshVersionCheck({
            force: true,
            reason: "session_restore",
          });
        } catch (error) {
          console.warn("Error verificando versión al iniciar:", error);
        }

        // Verificar si el usuario tiene perfil completo
        const { success: userSuccess, user } = await getCurrentUser();
        if (userSuccess && user) {
          const { success: profileSuccess, profile } = await getUserProfile(
            user.id,
            { forceRefresh: forceProfileRefresh }
          );

          if (profileSuccess && profile) {
            const bypassReviewRequirement =
              shouldBypassResidentReviewGate(profile);
            const { request: emailReviewRequest } = await getEmailReviewRequest(
              user.id
            );
            // Verificar si el perfil está completo
            const complete = isProfileComplete(profile, {
              emailReviewRequest,
              isEmailValid: true, // Asumimos válido en el check inicial
            });

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

              await syncResidentReviewGate({
                userId: user.id,
                hasReview: reviewCheckSuccess ? hasReview : false,
                isResident: profile.is_resident,
                isSuperAdmin: profile.is_super_admin,
                bypassReviewRequirement,
                countSession: true,
              });
            } else {
              // Si no es residente o es super admin, no aplicar restricción
              setResidentHasReview(true);
              await syncResidentReviewGate({
                userId: user.id,
                hasReview: true,
                isResident: profile.is_resident,
                isSuperAdmin: profile.is_super_admin,
              });
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
            setResidentReviewGateState(null);
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
          setResidentReviewGateState(null);
          setCurrentUserId(null);
        }
      } else {
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
        setResidentHasReview(true);
        setResidentReviewGateState(null);
        setCurrentUserId(null);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
      setNeedsOnboarding(false);
      setResidentHasReview(true);
      setResidentReviewGateState(null);
      setCurrentUserId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = async () => {
    // Refrescar versión tras auth para cubrir logins explícitos y cambios de
    // sesión sin depender del hook inicial.
    try {
      console.log("🔄 Verificando versión después del login...");
      await refreshVersionCheck({ force: true, reason: "auth" });
      console.log("✅ Verificación de versión completada");
    } catch (error) {
      console.warn("Error verificando versión después del login:", error);
    }

    // Después del login, verificar si necesita onboarding
    const { success: userSuccess, user } = await getCurrentUser();
    if (userSuccess && user) {
      const { success: profileSuccess, profile } = await getUserProfile(
        user.id,
        { forceRefresh: true }
      );

      if (profileSuccess && profile) {
        const { request: emailReviewRequest } = await getEmailReviewRequest(
          user.id
        );
        const complete = isProfileComplete(profile, {
          emailReviewRequest,
          isEmailValid: true,
        });
        const bypassReviewRequirement = shouldBypassResidentReviewGate(profile);

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

          await syncResidentReviewGate({
            userId: user.id,
            hasReview: reviewCheckSuccess ? hasReview : false,
            isResident: profile.is_resident,
            isSuperAdmin: profile.is_super_admin,
            bypassReviewRequirement,
            countSession: true,
          });
        } else {
          setResidentHasReview(true);
          await syncResidentReviewGate({
            userId: user.id,
            hasReview: true,
            isResident: profile.is_resident,
            isSuperAdmin: profile.is_super_admin,
          });
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
        setResidentReviewGateState(null);
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
      setResidentReviewGateState(null);
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
        user.id,
        { forceRefresh: true }
      );
      if (
        profileSuccess &&
        profile &&
        profile.is_resident &&
        !profile.is_super_admin
      ) {
        const bypassReviewRequirement = shouldBypassResidentReviewGate(profile);
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
          if (hasReview) {
            await resetResidentReviewGate(user.id);
            setResidentReviewGateState(null);
            posthogLogger.capture("resident_review_gate_unlocked_by_review", {
              user_id: user.id,
            });
          }
        }
      }
    }
  };

  const handleReviewDeleted = async () => {
    // Cuando se elimina una review, actualizar el estado para bloquear el acceso
    const { success: userSuccess, user } = await getCurrentUser();
    if (userSuccess && user) {
      const { success: profileSuccess, profile } = await getUserProfile(
        user.id,
        { forceRefresh: true }
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
          if (!hasReview) {
            const nextState = await syncResidentReviewGate({
              userId: user.id,
              hasReview: false,
              isResident: profile.is_resident,
              isSuperAdmin: profile.is_super_admin,
              bypassReviewRequirement,
            });
            posthogLogger.capture("resident_review_gate_reset_after_review_deleted", {
              user_id: user.id,
              status: nextState?.status || "soft",
            });
          }
        }
      }
    }
  };

  const handleSignOut = async () => {
    // Resetear identificación de usuario en PostHog
    posthogLogger.reset();
    gateSessionTrackedRef.current = null;
    setCurrentUserId(null);
    setResidentReviewGateState(null);
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
      {isVersionCheckLoading ? null : needsUpdate && isForceUpdate ? (
        <ForceUpdateScreen
          updateUrl={updateUrl}
          currentVersion={currentVersion}
          minVersion={minVersion}
        />
      ) : isAuthenticated && needsOnboarding ? (
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
          residentReviewGateState={residentReviewGateState}
          residentReviewGateConfig={getResidentReviewGateConfig()}
          onReviewCreated={handleReviewCreated}
          onReviewDeleted={handleReviewDeleted}
          showUpdateBanner={needsUpdate && !isForceUpdate}
          updateUrl={updateUrl}
        />
      ) : (
        <WelcomeScreen onAuthSuccess={handleAuthSuccess} />
      )}
    </SafeAreaProvider>
  );
}
