import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ScreenLayout } from "../components/ScreenLayout";
import { PlaceholderScreen } from "../components/PlaceholderScreen";
import HospitalsScreen from "./HospitalsScreen";
import HospitalDetailScreen from "./HospitalDetailScreen";
import MirSimulatorScreen from "./MirSimulatorScreen";
import ProfileScreen from "./ProfileScreen";
import MenuScreen from "./MenuScreen";
import MyPreferencesScreen from "./MyPreferencesScreen";
import ComunityScreen from "./ComunityScreen";
import MyReviewScreen from "./MyReviewScreen";
import ResidenceLibraryScreen from "./ResidenceLibraryScreen";
import ReviewsScreen from "./ReviewsScreen";
import ReviewDetailScreen from "./ReviewDetailScreen";
import { getCurrentUser, getUserProfile } from "../services/authService";
import { getFooterConfig } from "../constants/footerConfig";

export default function DashboardScreen({ onSignOut }) {
  const [userProfile, setUserProfile] = useState(null);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState(null);
  const [selectedReviewId, setSelectedReviewId] = useState(null);

  // Determinar sección inicial según el tipo de usuario
  const getInitialSection = (profile) => {
    if (!profile) return "hospitales";
    const footerConfig = getFooterConfig(profile);
    return footerConfig[0]?.screen || "hospitales";
  };

  const [currentSection, setCurrentSection] = useState(() =>
    getInitialSection(null)
  );

  // Cargar perfil del usuario
  useEffect(() => {
    loadUserProfile();
  }, []);

  // Actualizar sección inicial cuando se carga el perfil
  useEffect(() => {
    if (userProfile && !loadingProfile) {
      const initialSection = getInitialSection(userProfile);
      setCurrentSection(initialSection);
    }
  }, [userProfile, loadingProfile]);

  const loadUserProfile = async () => {
    try {
      setLoadingProfile(true);
      const { success: userSuccess, user } = await getCurrentUser();
      if (userSuccess && user) {
        const { success: profileSuccess, profile } = await getUserProfile(
          user.id
        );
        if (profileSuccess && profile) {
          setUserProfile(profile);
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSectionChange = (sectionId, params = {}) => {
    setCurrentSection(sectionId);
    // Limpiar selecciones cuando cambiamos de sección
    if (sectionId !== "hospitalDetail" && sectionId !== "reviewDetail") {
      setSelectedHospital(null);
      setSelectedSpecialtyId(null);
      setSelectedReviewId(null);
    }
    // Si es reviewDetail, guardar el reviewId
    if (sectionId === "reviewDetail" && params.reviewId) {
      setSelectedReviewId(params.reviewId);
    }
  };

  const handleHospitalSelect = (hospital, specialtyId) => {
    setSelectedHospital(hospital);
    setSelectedSpecialtyId(specialtyId || null);
    // No cambiar currentSection aquí, se maneja en HospitalsScreen
  };

  // Obtener la primera sección del footer según el tipo de usuario
  const getDefaultSection = () => {
    const footerConfig = getFooterConfig(userProfile);
    return footerConfig[0]?.screen || "hospitales";
  };

  const handleBackFromDetail = () => {
    setSelectedHospital(null);
    setSelectedSpecialtyId(null);
    setCurrentSection(getDefaultSection());
  };

  const handleBackFromMirSimulator = () => {
    setCurrentSection(getDefaultSection());
  };

  const handleBackFromProfile = () => {
    setCurrentSection(getDefaultSection());
  };

  // Si estamos en la pantalla de detalle del hospital
  if (selectedHospital) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <HospitalDetailScreen
          hospital={selectedHospital}
          selectedSpecialtyId={selectedSpecialtyId}
          onBack={handleBackFromDetail}
        />
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle de reseña
  if (selectedReviewId) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <ReviewDetailScreen
          reviewId={selectedReviewId}
          onBack={() => {
            setSelectedReviewId(null);
            setCurrentSection("reseñas");
          }}
          userProfile={userProfile}
        />
      </ScreenLayout>
    );
  }

  // Renderizar según la sección activa
  const renderSection = () => {
    switch (currentSection) {
      // Secciones existentes
      case "hospitals":
      case "hospitales":
        return (
          <HospitalsScreen
            onHospitalSelect={handleHospitalSelect}
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
          />
        );

      case "mirSimulator":
      case "nota-mir":
        return <MirSimulatorScreen onBack={handleBackFromMirSimulator} />;

      case "profile":
      case "usuario":
        return (
          <ProfileScreen
            onBack={handleBackFromProfile}
            onSignOut={onSignOut}
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
          />
        );

      // Nuevas pantallas placeholder
      case "menu":
        return (
          <MenuScreen
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
          />
        );

      case "myPreferences":
        return (
          <MyPreferencesScreen
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
            onHospitalSelect={handleHospitalSelect}
          />
        );

      case "comunity":
        return <ComunityScreen />;

      case "myReview":
        return <MyReviewScreen />;

      case "residenceLibrary":
        return <ResidenceLibraryScreen />;

      // Secciones del menú (placeholder)
      case "guardias":
      case "libro-residente":
      case "rotaciones-externas":
      case "foro":
      case "cursos":
      case "articulos":
      case "vivienda":
      case "jobs":
      case "faq-reseñas":
      case "contacto":
        return <PlaceholderScreen title={currentSection} />;

      // Pantalla de reseñas
      case "reseñas":
        return (
          <ReviewsScreen
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
          />
        );

      default:
        // Fallback: mostrar placeholder genérico
        return <PlaceholderScreen title={currentSection} />;
    }
  };

  if (loadingProfile) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      userProfile={userProfile}
      activeSection={currentSection}
      isProfileIncomplete={isProfileIncomplete}
      onSectionChange={handleSectionChange}
    >
      {renderSection()}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
});
