import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ScreenLayout } from "../components/ScreenLayout";
import { PlaceholderScreen } from "../components/PlaceholderScreen";
import { SwipeBackWrapper } from "../components/SwipeBackWrapper";
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
import CourseDetailScreen from "./CourseDetailScreen";
import HomeDashboardScreen from "./HomeDashboardScreen";
import HousingScreen from "./HousingScreen";
import HousingAdDetailScreen from "./HousingAdDetailScreen";
import CreateHousingAdScreen from "./CreateHousingAdScreen";
import CreateCourseScreen from "./CreateCourseScreen";
import ContactScreen from "./ContactScreen";
import AgendaScreen from "./AgendaScreen";
import { ExternalRotationsScreen } from "./ExternalRotationsScreen";
import { LecturesScreen } from "./LecturesScreen";
import LeisureScreen from "./LeisureScreen";
import LeisureForumScreen from "./LeisureForumScreen";
import SportsSelectionScreen from "./SportsSelectionScreen";
import ThreadDetailScreen from "./ThreadDetailScreen";
import NotificationSettingsScreen from "../src/screens/settings/NotificationSettingsScreen";
import NotificationsScreen from "../src/screens/notifications/NotificationsScreen";
import { setNotificationNavigationHandler } from "../src/services/push/notificationRouter";
import SpecialityQuizScreen from "./SpecialityQuizScreen";
import GroupsScreen from "./GroupsScreen";
import GroupChatScreen from "./GroupChatScreen";
import RoommateScreen from "./RoommateScreen";
import { getCurrentUser, getUserProfile } from "../services/authService";
import { getFooterConfig } from "../constants/footerConfig";
import posthogLogger from "../services/posthogService";
import { DEV_USER_TYPE } from "../config/devConfig";

/**
 * Aplica el override de tipo de usuario definido en devConfig.js.
 * Solo actúa si DEV_USER_TYPE tiene un valor distinto de null.
 */
const applyDevUserType = (profile) => {
  if (!DEV_USER_TYPE || !profile) return profile;

  const overrides = {
    is_resident: false,
    is_student: false,
    is_doctor: false,
    is_super_admin: false,
  };

  if (DEV_USER_TYPE === "resident") {
    overrides.is_resident = true;
  } else if (DEV_USER_TYPE === "student") {
    overrides.is_student = true;
  } else if (DEV_USER_TYPE === "admin") {
    overrides.is_resident = true;
    overrides.is_super_admin = true;
  }

  console.log(`🛠️ [DEV] Simulando usuario tipo: "${DEV_USER_TYPE}"`);
  return { ...profile, ...overrides };
};

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
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedHousingAdId, setSelectedHousingAdId] = useState(null);
  const [creatingHousingAd, setCreatingHousingAd] = useState(false);
  const [editingHousingAdId, setEditingHousingAdId] = useState(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [previousSection, setPreviousSection] = useState(null); // Para volver a la sección correcta
  const [leisureForumType, setLeisureForumType] = useState(null); // Tipo de foro: "Fiesta" o "Deporte"
  const [selectedThreadId, setSelectedThreadId] = useState(null); // ID del thread seleccionado
  const [selectedGroupId, setSelectedGroupId] = useState(null); // ID del grupo de chat
  const [selectedGroupName, setSelectedGroupName] = useState(null); // Nombre del grupo de chat
  const [roommateInitialTab, setRoommateInitialTab] = useState("discover");
  const [selectedRoommateMatchId, setSelectedRoommateMatchId] = useState(null);

  // Determinar sección inicial según el tipo de usuario (primera pestaña = Inicio)
  const getInitialSection = (profile) => {
    if (!profile) return "inicio";
    const footerConfig = getFooterConfig(profile);
    return footerConfig[0]?.screen || "inicio";
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

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("DashboardScreen");
  }, []);

  // Tracking de cambios de sección
  useEffect(() => {
    if (currentSection) {
      posthogLogger.logScreen(`DashboardScreen_${currentSection}`, {
        section: currentSection,
      });
    }
  }, [currentSection]);

  useEffect(() => {
    const cleanup = setNotificationNavigationHandler((data) => {
      if (data?.destination_section === "groupChat" && data?.group_id) {
        handleSectionChange("groupChat", {
          groupId: data.group_id,
          groupName: data.group_name || "Grupo",
        });
        return;
      }

      if (data?.entity_type === "review" && data?.entity_id) {
        handleSectionChange("reviewDetail", { reviewId: data.entity_id });
        return;
      }

      if (data?.entity_type === "comment" && data?.entity_id) {
        handleSectionChange("threadDetail", { threadId: data.entity_id });
        return;
      }

      if (data?.entity_type === "roommate_match" && data?.entity_id) {
        handleSectionChange("roomies", {
          initialTab: "matches",
          matchId: data.entity_id,
        });
      }
    });

    return cleanup;
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoadingProfile(true);
      const { success: userSuccess, user } = await getCurrentUser();
      if (userSuccess && user) {
        const { success: profileSuccess, profile } = await getUserProfile(
          user.id
        );
        if (profileSuccess && profile) {
          setUserProfile(applyDevUserType(profile));
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
      sectionId !== "courseDetail" &&
      sectionId !== "housingDetail" &&
      sectionId !== "createHousingAd" &&
      sectionId !== "editHousingAd" &&
      sectionId !== "createCourse" &&
      sectionId !== "editCourse" &&
      sectionId !== "groupChat"
    ) {
      setSelectedHospital(null);
      setSelectedSpecialtyId(null);
      setSelectedReviewId(null);
      setSelectedArticleId(null);
      setSelectedCourseId(null);
      setSelectedHousingAdId(null);
      setCreatingHousingAd(false);
      setEditingHousingAdId(null);
      setCreatingCourse(false);
      setEditingCourseId(null);
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
    // Si es courseDetail, guardar el courseId
    if (sectionId === "courseDetail" && params.courseId) {
      setSelectedCourseId(params.courseId);
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
    // Si es createCourse, activar pantalla de crear curso
    if (sectionId === "createCourse") {
      setCreatingCourse(true);
    }
    // Si es editCourse, activar pantalla de editar curso
    if (sectionId === "editCourse" && params.courseId) {
      setEditingCourseId(params.courseId);
    }
    // Si es leisureForum, guardar el tipo de foro
    if (sectionId === "leisureForum" && params.forumType) {
      setLeisureForumType(params.forumType);
    }
    // Si volvemos a ocio o sportsSelection, limpiar el tipo de foro
    if (sectionId === "ocio" || sectionId === "sportsSelection") {
      setLeisureForumType(null);
    }
    // Si es threadDetail, guardar el threadId
    if (sectionId === "threadDetail" && params.threadId) {
      setSelectedThreadId(params.threadId);
    }
    // Si volvemos desde threadDetail, limpiar el threadId
    if (sectionId === "leisureForum") {
      setSelectedThreadId(null);
    }
    // Si es groupChat, guardar groupId y nombre
    if (sectionId === "groupChat" && params.groupId) {
      setSelectedGroupId(params.groupId);
      setSelectedGroupName(params.groupName || "Grupo");
    }
    // Si volvemos desde groupChat, limpiar
    if (sectionId === "grupos") {
      setSelectedGroupId(null);
      setSelectedGroupName(null);
    }
    if (sectionId === "roomies") {
      setRoommateInitialTab(params.initialTab || "discover");
      setSelectedRoommateMatchId(params.matchId || null);
    } else {
      setRoommateInitialTab("discover");
      setSelectedRoommateMatchId(null);
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
    return footerConfig[0]?.screen || "inicio";
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

  const handleBackFromThreadDetail = () => {
    setSelectedThreadId(null);
    setCurrentSection("leisureForum");
  };

  const handleBackFromGroupChat = () => {
    setSelectedGroupId(null);
    setSelectedGroupName(null);
    setCurrentSection("grupos");
  };

  // Si estamos en el chat de un grupo
  if (selectedGroupId) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection="grupos"
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
        hideFooter
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromGroupChat}>
          <GroupChatScreen
            groupId={selectedGroupId}
            groupName={selectedGroupName}
            userProfile={userProfile}
            onBack={handleBackFromGroupChat}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del thread
  if (selectedThreadId) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection="ocio"
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromThreadDetail}>
          <ThreadDetailScreen
            threadId={selectedThreadId}
            onBack={handleBackFromThreadDetail}
            userProfile={userProfile}
            onSectionChange={handleSectionChange}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del hospital
  if (selectedHospital) {
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromDetail}>
          <HospitalDetailScreen
            hospital={selectedHospital}
            selectedSpecialtyId={selectedSpecialtyId}
            onBack={handleBackFromDetail}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle de reseña
  if (selectedReviewId) {
    const handleBackFromReview = () => {
      setSelectedReviewId(null);
      setCurrentSection("reseñas");
    };
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromReview}>
          <ReviewDetailScreen
            reviewId={selectedReviewId}
            onBack={handleBackFromReview}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del artículo
  if (selectedArticleId) {
    const handleBackFromArticle = () => {
      setSelectedArticleId(null);
      setCurrentSection("articulos");
    };
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromArticle}>
          <ArticleDetailScreen
            articleId={selectedArticleId}
            onBack={handleBackFromArticle}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de crear curso
  if (creatingCourse) {
    const handleBackFromCreateCourse = () => {
      setCreatingCourse(false);
      setCurrentSection("cursos");
    };
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromCreateCourse}>
          <CreateCourseScreen
            onBack={handleBackFromCreateCourse}
            onSuccess={() => {
              setCreatingCourse(false);
              setCurrentSection("cursos");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de editar curso
  if (editingCourseId) {
    const handleBackFromEditCourse = () => {
      setEditingCourseId(null);
      setCurrentSection("cursos");
    };
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromEditCourse}>
          <CreateCourseScreen
            courseId={editingCourseId}
            onBack={handleBackFromEditCourse}
            onSuccess={() => {
              setEditingCourseId(null);
              setCurrentSection("cursos");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del curso
  if (selectedCourseId) {
    const handleBackFromCourse = () => {
      setSelectedCourseId(null);
      setCurrentSection("cursos");
    };
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromCourse}>
          <CourseDetailScreen
            courseId={selectedCourseId}
            onBack={handleBackFromCourse}
            onEdit={(courseId) => {
              setSelectedCourseId(null);
              setEditingCourseId(courseId);
              setCurrentSection("cursos");
            }}
            onDelete={() => {
              setSelectedCourseId(null);
              setCurrentSection("cursos");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de detalle del anuncio de vivienda
  if (selectedHousingAdId) {
    const handleBackFromHousing = () => {
      setSelectedHousingAdId(null);
      setCurrentSection("vivienda");
    };
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromHousing}>
          <HousingAdDetailScreen
            adId={selectedHousingAdId}
            onBack={handleBackFromHousing}
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
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de crear anuncio de vivienda
  if (creatingHousingAd) {
    const handleBackFromCreateHousing = () => {
      setCreatingHousingAd(false);
      setCurrentSection("vivienda");
    };
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromCreateHousing}>
          <CreateHousingAdScreen
            onBack={handleBackFromCreateHousing}
            onSuccess={() => {
              // Anuncio creado exitosamente
              setCreatingHousingAd(false);
              setCurrentSection("vivienda");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Si estamos en la pantalla de editar anuncio de vivienda
  if (editingHousingAdId) {
    const handleBackFromEditHousing = () => {
      setEditingHousingAdId(null);
      setCurrentSection("vivienda");
    };
    return (
      <ScreenLayout
        userProfile={userProfile}
        activeSection={currentSection}
        isProfileIncomplete={isProfileIncomplete}
        onSectionChange={handleSectionChange}
      >
        <SwipeBackWrapper onSwipeBack={handleBackFromEditHousing}>
          <CreateHousingAdScreen
            adId={editingHousingAdId}
            onBack={handleBackFromEditHousing}
            onSuccess={() => {
              // Anuncio editado exitosamente
              setEditingHousingAdId(null);
              setCurrentSection("vivienda");
            }}
            userProfile={userProfile}
          />
        </SwipeBackWrapper>
      </ScreenLayout>
    );
  }

  // Renderizar según la sección activa
  const renderSection = () => {
    switch (currentSection) {
      case "inicio":
        return (
          <HomeDashboardScreen
            userProfile={userProfile}
            onHospitalSelect={handleHospitalSelect}
            onSectionChange={handleSectionChange}
          />
        );

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

      case "specialityQuiz":
        return (
          <SpecialityQuizScreen
            userProfile={userProfile}
            onSectionChange={handleSectionChange}
          />
        );

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

      case "notificationSettings":
        return (
          <NotificationSettingsScreen
            userId={userProfile?.id}
            onBack={() => handleSectionChange("usuario")}
          />
        );

      case "notifications":
        return (
          <NotificationsScreen
            userId={userProfile?.id}
            onBack={() => handleSectionChange("usuario")}
            onNavigateToEntity={(screenId, entityId) => {
              if (screenId === "reviewDetail") {
                handleSectionChange("reviewDetail", { reviewId: entityId });
              } else if (screenId === "threadDetail") {
                handleSectionChange("threadDetail", { threadId: entityId });
              } else if (screenId === "roomies") {
                handleSectionChange("roomies", {
                  initialTab: "matches",
                  matchId: entityId,
                });
              } else if (screenId === "groupChat") {
                handleSectionChange("groupChat", {
                  groupId: entityId.groupId,
                  groupName: entityId.groupName,
                });
              }
            }}
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
      case "libro-residente":
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

      case "roomies":
        return (
          <RoommateScreen
            userProfile={userProfile}
            initialTab={roommateInitialTab}
            initialMatchId={selectedRoommateMatchId}
          />
        );

      // Pantalla de ocio
      case "ocio":
        return (
          <LeisureScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
          />
        );

      // Pantalla de selección de deportes
      case "sportsSelection":
        return (
          <SportsSelectionScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
          />
        );

      // Pantalla del foro de ocio (Fiesta o Deporte)
      case "leisureForum":
        return (
          <LeisureForumScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
            forumType={leisureForumType}
          />
        );

      // Pantalla de contacto
      case "contacto":
        return (
          <ContactScreen
            userProfile={userProfile}
            onBack={() => handleSectionChange("usuario")}
          />
        );

      // Pantalla de agenda
      case "agenda":
      case "guardias":
        return (
          <AgendaScreen
            userProfile={userProfile}
            navigation={{ navigate: handleSectionChange }}
            onNavigateToSection={handleSectionChange}
          />
        );

      // Secciones del menú (placeholder)
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

      case "grupos":
        return (
          <GroupsScreen
            onSectionChange={handleSectionChange}
            userProfile={userProfile}
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
      activeSection={currentSection === "roomies" ? "vivienda" : currentSection}
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
