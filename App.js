import React, { useState, useEffect } from "react";
import WelcomeScreen from "./screens/WelcomeScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ProfileScreen from "./screens/ProfileScreen";
import { getSession, getCurrentUser, getUserProfile } from "./services/authService";
import { isProfileComplete } from "./services/userService";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { success, session } = await getSession();
      const hasSession = Boolean(success && session);
      
      if (hasSession) {
        // Verificar si el usuario tiene perfil completo
        const { success: userSuccess, user } = await getCurrentUser();
        if (userSuccess && user) {
          const { success: profileSuccess, profile } = await getUserProfile(user.id);
          
          if (profileSuccess && profile) {
            // Verificar si el perfil está completo
            const complete = isProfileComplete(profile, {
              hasActiveEmailReview: false, // No verificamos esto en el check inicial
              isEmailValid: true, // Asumimos válido en el check inicial
            });
            
            setIsAuthenticated(true);
            setNeedsOnboarding(!complete);
          } else {
            // Usuario autenticado pero sin perfil en la base de datos
            setIsAuthenticated(true);
            setNeedsOnboarding(true);
          }
        } else {
          setIsAuthenticated(false);
          setNeedsOnboarding(false);
        }
      } else {
        setIsAuthenticated(false);
        setNeedsOnboarding(false);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
      setNeedsOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = async () => {
    // Después del login, verificar si necesita onboarding
    const { success: userSuccess, user } = await getCurrentUser();
    if (userSuccess && user) {
      const { success: profileSuccess, profile } = await getUserProfile(user.id);
      
      if (profileSuccess && profile) {
        const complete = isProfileComplete(profile, {
          hasActiveEmailReview: false,
          isEmailValid: true,
        });
        setIsAuthenticated(true);
        setNeedsOnboarding(!complete);
      } else {
        // Usuario sin perfil
        setIsAuthenticated(true);
        setNeedsOnboarding(true);
      }
    } else {
      setIsAuthenticated(true);
      setNeedsOnboarding(true);
    }
  };

  const handleProfileComplete = async () => {
    // Recargar verificación de auth para actualizar el estado
    await checkAuth();
  };

  const handleSignOut = async () => {
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
        onHospitalPress={() => {}}
        onStudentPress={() => {}}
        onReviewsPress={() => {}}
      />
    );
  }

  // Si está autenticado y tiene perfil completo, mostrar Dashboard
  if (isAuthenticated) {
    return <DashboardScreen onSignOut={handleSignOut} />;
  }

  // Si no está autenticado, mostrar WelcomeScreen
  return <WelcomeScreen onAuthSuccess={handleAuthSuccess} />;
}
