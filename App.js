import React, { useState, useEffect } from "react";
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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [residentHasReview, setResidentHasReview] = useState(true); // Por defecto true para no bloquear

  useEffect(() => {
    // Inicializar PostHog al iniciar la aplicación
    posthogLogger.initialize();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Primero verificar si hay sesión activa
      const { success, session } = await getSession();
      const hasSession = Boolean(success && session);

      // NO intentar restaurar automáticamente con biometría al iniciar
      // Esto causa problemas en Expo Go y pide código de acceso
      // La restauración con Face ID solo ocurre cuando el usuario presiona el botón explícitamente

      if (hasSession) {
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
            // Identificar usuario en PostHog sin perfil completo
            posthogLogger.identify(user.id, {
              email: user.email,
            });
          }
        } else {
          setIsAuthenticated(false);
          setNeedsOnboarding(false);
          setResidentHasReview(true);
        }
      } else {
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
        setResidentHasReview(true);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
      setNeedsOnboarding(false);
      setResidentHasReview(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = async () => {
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
        // Identificar usuario en PostHog sin perfil completo
        posthogLogger.identify(user.id, {
          email: user.email,
        });
      }
    } else {
      setIsAuthenticated(true);
      setNeedsOnboarding(true);
      setResidentHasReview(true);
    }
  };

  const handleProfileComplete = async () => {
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
    // Forzar que el usuario vuelva a hacer login
    setIsAuthenticated(false);
    setNeedsOnboarding(false);
    // Recargar la verificación de autenticación para asegurar que no hay sesión
    await checkAuth();
  };

  if (isLoading) {
    return null;
  }

  // Si está autenticado pero necesita onboarding, mostrar ProfileScreen en modo onboarding
  if (isAuthenticated && needsOnboarding) {
    return (
      <ProfileScreen
        isOnboarding={true}
        onProfileComplete={handleProfileComplete}
        onSignOut={handleSignOut}
        onHospitalPress={() => {}}
        onStudentPress={() => {}}
        onReviewsPress={() => {}}
      />
    );
  }

  // Si está autenticado y tiene perfil completo, mostrar Dashboard
  if (isAuthenticated) {
    return (
      <DashboardScreen
        onSignOut={handleSignOut}
        residentHasReview={residentHasReview}
        onReviewCreated={handleReviewCreated}
        onReviewDeleted={handleReviewDeleted}
      />
    );
  }

  // Si no está autenticado, mostrar WelcomeScreen
  return <WelcomeScreen onAuthSuccess={handleAuthSuccess} />;
}
