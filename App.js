import React, { useState, useEffect, useRef } from "react";
import { AppState, Platform, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { ForceUpdateScreen } from "./components/ForceUpdateScreen";
import { useVersionCheck } from "./hooks/useVersionCheck";
import WelcomeScreen from "./screens/WelcomeScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ProfileScreen from "./screens/ProfileScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import { supabase } from "./config/supabase";
import {
  getSession,
  getCurrentUser,
  getUserProfile,
} from "./services/authService";
import { checkResidentReview } from "./services/communityService";
import {
  getEmailReviewRequest,
  subscribeToEmailReviewRequest,
  unsubscribeFromEmailReviewRequest,
} from "./services/emailReviewService";
import posthogLogger from "./services/posthogService";
import {
  getResidentReviewGateConfig,
  incrementResidentReviewGateSession,
  initializeResidentReviewGate,
  resetResidentReviewGate,
} from "./services/residentReviewGateService";
import {
  isResidentLockedMissingCorporateEmail,
  shouldBypassResidentReviewGate,
  shouldRedirectForEmailReviewRejection,
} from "./utils/residentAccess";
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
  const [residentEmailRejected, setResidentEmailRejected] = useState(false);
  const [residentSeasonalLocked, setResidentSeasonalLocked] = useState(false);
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

  // Suscripción realtime a user_email_review_requests del usuario actual:
  // si el admin cambia el status (p.ej. PENDING → REJECTED) mientras la app
  // está abierta, re-disparamos checkAuth para reaccionar inmediatamente.
  // Sin esto, el usuario seguía con acceso hasta cerrar y reabrir la app.
  useEffect(() => {
    if (!currentUserId) return undefined;

    const channel = subscribeToEmailReviewRequest(currentUserId, () => {
      checkAuth({ forceProfileRefresh: true }).catch((error) => {
        console.warn("Error refrescando auth tras cambio de email review:", error);
      });
    });

    return () => {
      unsubscribeFromEmailReviewRequest(channel).catch(() => {});
    };
  }, [currentUserId]);

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
        setResidentEmailRejected(false);
        setResidentSeasonalLocked(false);
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
        Constants.expoConfig?.version ||
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

            // El rechazo del email aplica a cualquier usuario que solicitó
            // revisión manual, no solo a residentes (puede haber usuarios
            // legacy degradados a no-residentes por el código antiguo).
            const { request: emailReviewRequest } =
              await getEmailReviewRequest(user.id);
            setResidentEmailRejected(
              shouldRedirectForEmailReviewRejection(profile, emailReviewRequest)
            );

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

              setResidentSeasonalLocked(
                isResidentLockedMissingCorporateEmail(profile)
              );

              await syncResidentReviewGate({
                userId: user.id,
                hasReview: reviewCheckSuccess ? hasReview : false,
                isResident: profile.is_resident,
                isSuperAdmin: profile.is_super_admin,
                bypassReviewRequirement,
                countSession: true,
              });
            } else {
              // Si no es residente, no aplica el lock seasonal MIR.
              setResidentSeasonalLocked(false);
              setResidentHasReview(true);
              await syncResidentReviewGate({
                userId: user.id,
                hasReview: true,
                isResident: profile.is_resident,
                isSuperAdmin: profile.is_super_admin,
              });
            }

            setIsAuthenticated(true);
            setNeedsOnboarding(profile.onboarding_completed !== true);
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
            setResidentEmailRejected(false);
            setResidentSeasonalLocked(false);
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
          setResidentEmailRejected(false);
          setResidentSeasonalLocked(false);
          setCurrentUserId(null);
        }
      } else {
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
        setResidentHasReview(true);
        setResidentReviewGateState(null);
        setResidentEmailRejected(false);
        setResidentSeasonalLocked(false);
        setCurrentUserId(null);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
      setNeedsOnboarding(false);
      setResidentHasReview(true);
      setResidentReviewGateState(null);
      setResidentEmailRejected(false);
      setResidentSeasonalLocked(false);
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
        const bypassReviewRequirement = shouldBypassResidentReviewGate(profile);

        // Misma política que en checkAuth: el rechazo del email se evalúa
        // para cualquier usuario, no solo residentes.
        const { request: emailReviewRequest } = await getEmailReviewRequest(
          user.id
        );
        setResidentEmailRejected(
          shouldRedirectForEmailReviewRejection(profile, emailReviewRequest)
        );

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

          setResidentSeasonalLocked(
            isResidentLockedMissingCorporateEmail(profile)
          );

          await syncResidentReviewGate({
            userId: user.id,
            hasReview: reviewCheckSuccess ? hasReview : false,
            isResident: profile.is_resident,
            isSuperAdmin: profile.is_super_admin,
            bypassReviewRequirement,
            countSession: true,
          });
        } else {
          setResidentSeasonalLocked(false);
          setResidentHasReview(true);
          await syncResidentReviewGate({
            userId: user.id,
            hasReview: true,
            isResident: profile.is_resident,
            isSuperAdmin: profile.is_super_admin,
          });
        }

        setIsAuthenticated(true);
        setNeedsOnboarding(profile.onboarding_completed !== true);
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
        setResidentEmailRejected(false);
        setResidentSeasonalLocked(false);
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
      setResidentEmailRejected(false);
      setResidentSeasonalLocked(false);
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
        <OnboardingScreen
          userId={currentUserId}
          onComplete={handleProfileComplete}
        />
      ) : isAuthenticated && (residentEmailRejected || residentSeasonalLocked) ? (
        // SafeAreaView aplica el inset top que normalmente añade ScreenLayout
        // en el flujo regular; aquí ProfileScreen se renderiza standalone, sin
        // ScreenLayout, así que sin esto el hero header quedaría detrás del
        // notch/status bar y se vería empujado hacia arriba por el banner.
        <SafeAreaView style={appStyles.redirectSafeArea} edges={["top", "left", "right"]}>
          <ProfileScreen
            onSignOut={handleSignOut}
            rejectedEmailBanner={residentEmailRejected}
            lockedSeasonalBanner={residentSeasonalLocked && !residentEmailRejected}
            onProfileUpdated={() =>
              checkAuth({ forceProfileRefresh: true })
            }
            onHospitalPress={() => {}}
            onStudentPress={() => {}}
            onReviewsPress={() => {}}
          />
        </SafeAreaView>
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

const appStyles = StyleSheet.create({
  redirectSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
