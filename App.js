import React, { useState, useEffect, useRef } from "react";
import { AppState, Platform, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { ForceUpdateScreen } from "./components/ForceUpdateScreen";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { withTimeout } from "./utils/withTimeout";
import { useVersionCheck } from "./hooks/useVersionCheck";
import WelcomeScreen from "./screens/WelcomeScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ProfileEditScreen from "./screens/ProfileEditScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import { supabase } from "./config/supabase";
import {
  getSession,
  getCurrentUser,
  getUserProfile,
} from "./services/authService";
import { checkResidentReview } from "./services/communityService";
import { getResidentTransitionConfig } from "./services/residentTransitionConfigService";
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

// Techo de espera para las puertas de acceso. Ninguna llamada de Supabase trae
// timeout propio, así que sin esto una petición colgada deja el arranque
// bloqueado indefinidamente. Al agotarse caemos al estado "sin sesión", que es
// el mismo camino que ya seguía el catch de checkAuth.
const AUTH_GATE_TIMEOUT_MS = 12000;

// Instantánea equivalente a "no hemos podido resolver nada".
const UNRESOLVED_SNAPSHOT = {
  userResult: { success: false, user: null },
  profileResult: { success: false, profile: null },
  transitionConfigResult: { success: false, config: null },
  emailReviewResult: { success: false, request: null },
  reviewResult: { success: false, hasReview: false },
};

// Calcula si hay que saltarse el gate de reseñas para este perfil.
// Fail-open: si no podemos cargar la ventana MIR (`resident_transition_config`),
// concedemos bypass a cualquier R1 — preferimos no bloquear por un error de
// infra al usuario que está empezando residencia.
const resolveBypassFromConfig = (profile, configResult) => {
  const { success, config } = configResult || {};
  if (!success) {
    const residentYear = Number(profile?.resident_year || 0);
    return Boolean(profile?.is_resident && residentYear === 1);
  }
  return shouldBypassResidentReviewGate(profile, config);
};

const resolveBypassReviewRequirement = async (profile) =>
  resolveBypassFromConfig(profile, await getResidentTransitionConfig());

// Trae de una sola tanda todo lo que necesitan las puertas de acceso.
// Antes se encadenaban 6 llamadas secuenciales (versión → usuario → perfil →
// config MIR → revisión de email → review); ninguna depende del resultado de
// las otras, solo del userId, que ya viene en la sesión persistida. En red fría
// eso eran ~6 round-trips antes de pintar el primer píxel.
const fetchSignedInSnapshot = async (userId, { forceProfileRefresh }) => {
  const [
    userResult,
    profileResult,
    transitionConfigResult,
    emailReviewResult,
    reviewResult,
  ] = await Promise.all([
    getCurrentUser(),
    getUserProfile(userId, { forceRefresh: forceProfileRefresh }),
    getResidentTransitionConfig(),
    getEmailReviewRequest(userId),
    checkResidentReview(userId),
  ]);

  return {
    userResult,
    profileResult,
    transitionConfigResult,
    emailReviewResult,
    reviewResult,
  };
};

function AppContent() {
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

  const applySignedOutState = () => {
    setIsAuthenticated(false);
    setNeedsOnboarding(false);
    setResidentHasReview(true);
    setResidentReviewGateState(null);
    setResidentEmailRejected(false);
    setResidentSeasonalLocked(false);
    setCurrentUserId(null);
  };

  // Vuelca una instantánea ya resuelta sobre los estados de las puertas de
  // acceso. La comparten checkAuth y handleAuthSuccess: antes cada uno llevaba
  // su propia copia de esta lógica y ya se habían desincronizado.
  // Devuelve false si no se pudo identificar al usuario, para que cada llamante
  // decida a dónde mandarlo.
  const applySignedInSnapshot = async (snapshot, { countSession }) => {
    const {
      userResult,
      profileResult,
      transitionConfigResult,
      emailReviewResult,
      reviewResult,
    } = snapshot;

    const user = userResult?.success ? userResult.user : null;
    if (!user) return false;

    const profile = profileResult?.success ? profileResult.profile : null;

    if (!profile) {
      // Usuario autenticado pero sin perfil en la base de datos
      setIsAuthenticated(true);
      setNeedsOnboarding(true);
      setResidentHasReview(true); // No aplicar restricción si no hay perfil
      setResidentReviewGateState(null);
      setResidentEmailRejected(false);
      setResidentSeasonalLocked(false);
      setCurrentUserId(user.id);
      // Identificar usuario en PostHog sin perfil completo
      posthogLogger.identify(user.id, { email: user.email });
      return true;
    }

    const bypassReviewRequirement = resolveBypassFromConfig(
      profile,
      transitionConfigResult
    );

    // El rechazo del email aplica a cualquier usuario que solicitó revisión
    // manual, no solo a residentes (puede haber usuarios legacy degradados a
    // no-residentes por el código antiguo).
    setResidentEmailRejected(
      shouldRedirectForEmailReviewRejection(profile, emailReviewResult?.request)
    );

    if (profile.is_resident && !profile.is_super_admin) {
      // En caso de error, asumir que no tiene review para ser restrictivo
      const reviewCheckSuccess = Boolean(reviewResult?.success);
      const hasReview = reviewCheckSuccess && Boolean(reviewResult?.hasReview);

      setResidentHasReview(hasReview);
      console.log(
        `🔍 Residente verificado: ${hasReview ? "tiene" : "NO tiene"} review`
      );

      setResidentSeasonalLocked(isResidentLockedMissingCorporateEmail(profile));

      await syncResidentReviewGate({
        userId: user.id,
        hasReview,
        isResident: profile.is_resident,
        isSuperAdmin: profile.is_super_admin,
        bypassReviewRequirement,
        countSession,
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
    return true;
  };

  // Resuelve las puertas de acceso de una sesión ya persistida.
  // El userId sale de la sesión local, así que las cinco consultas se lanzan a
  // la vez en lugar de encadenarse.
  const loadSignedInSnapshot = async (userId, { forceProfileRefresh }) =>
    withTimeout(
      fetchSignedInSnapshot(userId, { forceProfileRefresh }),
      AUTH_GATE_TIMEOUT_MS,
      UNRESOLVED_SNAPSHOT
    );

  const checkAuth = async ({ forceProfileRefresh = true } = {}) => {
    try {
      // Primero verificar si hay sesión activa
      const { success, session } = await getSession();
      const userId = success && session ? session.user?.id : null;

      // NO intentar restaurar automáticamente con biometría al iniciar
      // Esto causa problemas en Expo Go y pide código de acceso
      // La restauración con Face ID solo ocurre cuando el usuario presiona el botón explícitamente

      if (!userId) {
        applySignedOutState();
        return;
      }

      // La verificación de versión ya la dispara useVersionCheck en su propio
      // efecto de arranque, en paralelo con esto. Repetirla aquí añadía un
      // round-trip que además serializaba todo lo que viene detrás.
      const snapshot = await loadSignedInSnapshot(userId, {
        forceProfileRefresh,
      });

      const resolved = await applySignedInSnapshot(snapshot, {
        countSession: true,
      });
      if (!resolved) applySignedOutState();
    } catch (error) {
      console.error("Error checking auth:", error);
      applySignedOutState();
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
    let resolved = false;
    try {
      const { success, session } = await getSession();
      const userId = success && session ? session.user?.id : null;

      const snapshot = userId
        ? await loadSignedInSnapshot(userId, { forceProfileRefresh: true })
        : UNRESOLVED_SNAPSHOT;

      resolved = await applySignedInSnapshot(snapshot, { countSession: true });
    } catch (error) {
      console.error("Error resolviendo la sesión tras el login:", error);
    }

    if (!resolved) {
      // Acaba de autenticarse pero no hemos podido resolver el usuario: se le
      // manda a onboarding, no al login, igual que hacía la versión anterior.
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
        const bypassReviewRequirement =
          await resolveBypassReviewRequirement(profile);
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
            const bypassReviewRequirement =
              await resolveBypassReviewRequirement(profile);
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

  // Nunca devolvemos null durante el arranque: en red fría eso dejaba una
  // pantalla en blanco de varios segundos y la app parecía haberse colgado.
  if (isLoading) {
    return <AppLoadingScreen />;
  }

  return (
    <>
      {isVersionCheckLoading ? (
        <AppLoadingScreen />
      ) : needsUpdate && isForceUpdate ? (
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
          <ProfileEditScreen
            rejectedEmailBanner={residentEmailRejected}
            lockedSeasonalBanner={residentSeasonalLocked && !residentEmailRejected}
            autoFocusWorkEmail
            onProfileUpdated={() =>
              checkAuth({ forceProfileRefresh: true })
            }
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
    </>
  );
}

// El SafeAreaProvider y la frontera de error van POR ENCIMA de AppContent. Si la
// frontera viviera dentro del return de AppContent, un throw del propio
// AppContent (por ejemplo al resolver las puertas de acceso) la arrastraría con
// él y seguiríamos teniendo un crash fatal.
export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  redirectSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
