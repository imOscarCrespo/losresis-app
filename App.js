import React, { useState, useEffect } from "react";
import WelcomeScreen from "./screens/WelcomeScreen";
import DashboardScreen from "./screens/DashboardScreen";
import { getSession } from "./services/authService";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { success, session } = await getSession();
      setIsAuthenticated(Boolean(success && session));
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleSignOut = async () => {
    // Forzar que el usuario vuelva a hacer login
    setIsAuthenticated(false);
    // Recargar la verificación de autenticación para asegurar que no hay sesión
    await checkAuth();
  };

  if (isLoading) {
    return null;
  }

  // Renderizar condicionalmente sin navegación por ahora
  if (isAuthenticated) {
    return <DashboardScreen onSignOut={handleSignOut} />;
  }

  return <WelcomeScreen onAuthSuccess={handleAuthSuccess} />;
}
