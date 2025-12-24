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
import ArticlesScreen from "./ArticlesScreen";
import ArticleDetailScreen from "./ArticleDetailScreen";
import HousingScreen from "./HousingScreen";
import HousingAdDetailScreen from "./HousingAdDetailScreen";
import CreateHousingAdScreen from "./CreateHousingAdScreen";
import ContactScreen from "./ContactScreen";
import ShiftsScreen from "./ShiftsScreen";
import { ExternalRotationsScreen } from "./ExternalRotationsScreen";
import { LecturesScreen } from "./LecturesScreen";
import { getCurrentUser, getUserProfile } from "../services/authService";
import { getFooterConfig } from "../constants/footerConfig";

export default function DashboardScreen({
  onSignOut,
  residentHasReview = true,
  onReviewCreated,
  onReviewDeleted,
}) {
  const [userProfile, setUserProfile] = useState(null);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState(null);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [selectedHousingAdId, setSelectedHousingAdId] = useState(null);
  const [creatingHousingAd, setCreatingHousingAd] = useState(false);
  const [editingHousingAdId, setEditingHousingAdId] = useState(null);
  const [previousSection, setPreviousSection] = useState(null); // Para volver a la sección correcta

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
    if (
      sectionId !== "hospitalDetail" &&
      sectionId !== "reviewDetail" &&
      sectionId !== "articleDetail" &&
      sectionId !== "housingDetail" &&
      sectionId !== "createHousingAd" &&
      sectionId !== "editHousingAd"
    ) {
      setSelectedHospital(null);
      setSelectedSpecialtyId(null);
      setSelectedReviewId(null);
      setSelectedArticleId(null);
      setSelectedHousingAdId(null);
      setCreatingHousingAd(false);
      setEditingHousingAdId(null);
      setPreviousSection(null); // Limpiar la sección anterior al cambiar de sección
    }
    // Si es reviewDetail, guardar el reviewId
    if (sectionId === "reviewDetail" && params.reviewId) {
      setSelectedReviewId(params.reviewId);
    }
    // Si es articleDetail, guardar el articleId
    if (sectionId === "articleDetail" && params.articleId) {
      setSelectedArticleId(params.articleId);
    }
    // Si es housingDetail, guardar el adId
    if (sectionId === "housingDetail" && params.adId) {
      setSelectedHousingAdId(params.adId);
    }
    // Si es createHousingAd, activar modo creación
    if (sectionId === "createHousingAd") {
      setCreatingHousingAd(true);
    }
    // Si es editHousingAd, activar modo edición
    if (sectionId === "editHousingAd" && params.adId) {
      setEditingHousingAdId(params.adId);
    }
  };

  const handleHospitalSelect = (hospital, specialtyId, fromSection = null) => {
    setSelectedHospital(hospital);
    setSelectedSpecialtyId(specialtyId || null);
    // Guardar la sección de origen para poder volver a ella
    setPreviousSection(fromSection || currentSection);
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
    // Volver a la sección de origen si existe, sino a la sección por defecto
    setCurrentSection(previousSection || getDefaultSection());
    setPreviousSection(null); // Limpiar la sección anterior
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

  // Si estamos en la pantalla de detalle del artículo
  if (selectedArticleId) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <ArticleDetailScreen
          articleId={selectedArticleId}
          onBack={() => {
            setSelectedArticleId(null);
            setCurrentSection("articulos");
          }}
          userProfile={userProfile}
        />
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del anuncio de vivienda
  if (selectedHousingAdId) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <HousingAdDetailScreen
          adId={selectedHousingAdId}
          onBack={() => {
            setSelectedHousingAdId(null);
            setCurrentSection("vivienda");
          }}
          userProfile={userProfile}
          onEdit={(adId) => {
            // Por ahora solo volvemos, luego se puede implementar edición
            console.log("Edit housing ad:", adId);
            setSelectedHousingAdId(null);
            setCurrentSection("vivienda");
          }}
          onDelete={(adId) => {
            // El delete se maneja dentro del componente
            setSelectedHousingAdId(null);
            setCurrentSection("vivienda");
          }}
        />
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de crear anuncio de vivienda
  if (creatingHousingAd) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <CreateHousingAdScreen
          onBack={() => {
            setCreatingHousingAd(false);
            setCurrentSection("vivienda");
          }}
          onSuccess={() => {
            // Anuncio creado exitosamente
            setCreatingHousingAd(false);
            setCurrentSection("vivienda");
          }}
          userProfile={userProfile}
        />
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de editar anuncio de vivienda
  if (editingHousingAdId) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <CreateHousingAdScreen
          adId={editingHousingAdId}
          onBack={() => {
            setEditingHousingAdId(null);
            setCurrentSection("vivienda");
          }}
          onSuccess={() => {
            // Anuncio editado exitosamente
            setEditingHousingAdId(null);
            setCurrentSection("vivienda");
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
            residentHasReview={residentHasReview}
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
        return (
          <ComunityScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
          />
        );

      case "myReview":
        return (
          <MyReviewScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            onReviewCreated={onReviewCreated}
            onReviewDeleted={onReviewDeleted}
          />
        );

      case "residenceLibrary":
        return (
          <ResidenceLibraryScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            residentHasReview={residentHasReview}
          />
        );

      // Pantalla de artículos
      case "articulos":
        return (
          <ArticlesScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
          />
        );

      // Pantalla de vivienda
      case "vivienda":
        return (
          <HousingScreen
            onSectionChange={handleSectionChange}
            currentSection={currentSection}
            userProfile={userProfile}
          />
        );

      // Pantalla de contacto
      case "contacto":
        return <ContactScreen userProfile={userProfile} />;

      // Pantalla de guardias
      case "guardias":
        return (
          <ShiftsScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            onNavigateToSection={handleSectionChange}
          />
        );

      // Secciones del menú (placeholder)
      case "libro-residente":
      case "rotaciones-externas":
        return (
          <ExternalRotationsScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
          />
        );

      case "cursos":
        return (
          <LecturesScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
          />
        );

      case "foro":
      case "jobs":
      case "faq-reseñas":
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
