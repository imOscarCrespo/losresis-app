/**
 * Utilidades para el Footer y navegación
 */

/**
 * Verifica si un usuario tiene permisos de doctor/residente
 */
export const isDoctorOrResident = (userProfile) => {
  return userProfile?.is_doctor || userProfile?.is_resident;
};

/**
 * Verifica si un usuario tiene permisos de estudiante
 */
export const isStudent = (userProfile) => {
  return userProfile?.is_student;
};

/**
 * Verifica si un usuario es super admin
 */
export const isSuperAdmin = (userProfile) => {
  return userProfile?.is_super_admin;
};

/**
 * Verifica si un item de navegación debe ser visible según el perfil del usuario
 */
export const shouldShowItem = (item, userProfile) => {
  // Si no requiere permisos especiales, siempre visible
  if (!item.doctorOnly && !item.studentOnly && !item.superAdminOnly) {
    return true;
  }

  // Si no hay perfil, solo mostrar items sin restricciones
  if (!userProfile) {
    return false;
  }

  // Verificar permisos específicos
  if (item.doctorOnly && !isDoctorOrResident(userProfile)) {
    return false;
  }

  if (
    item.studentOnly &&
    !isStudent(userProfile) &&
    !isSuperAdmin(userProfile)
  ) {
    return false;
  }

  if (item.superAdminOnly && !isSuperAdmin(userProfile)) {
    return false;
  }

  return true;
};

/**
 * Filtra items de navegación según el perfil del usuario
 */
export const filterNavigationItems = (navigationItems, userProfile) => {
  if (!navigationItems || navigationItems.length === 0) {
    return [];
  }

  return navigationItems.filter((item) => shouldShowItem(item, userProfile));
};

/**
 * Convierte un icono (string o componente) a nombre de Ionicons
 */
export const getIconName = (icon) => {
  if (typeof icon === "string") {
    return icon;
  }

  // Mapeo de nombres de componentes Heroicons a Ionicons
  const HEROICON_TO_IONICON_MAP = {
    UsersIcon: "people",
    StarIcon: "star",
    BuildingOffice2Icon: "business",
    HeartIcon: "heart",
    CalculatorIcon: "calculator",
    ClockIcon: "time",
    AcademicCapIcon: "school",
    BookOpenIcon: "book",
    GlobeAltIcon: "globe",
    DocumentTextIcon: "document-text",
    ChatBubbleLeftRightIcon: "chatbubbles",
    BookmarkIcon: "bookmark",
    HomeIcon: "home",
    BriefcaseIcon: "briefcase",
    QuestionMarkCircleIcon: "help-circle",
    EnvelopeIcon: "mail",
    UserIcon: "person",
    MapPinIcon: "location",
  };

  if (icon && typeof icon === "object") {
    const componentName =
      icon.name || icon.displayName || icon.$$typeof?.toString();

    if (componentName && HEROICON_TO_IONICON_MAP[componentName]) {
      return HEROICON_TO_IONICON_MAP[componentName];
    }

    const keys = Object.keys(icon);
    for (const key of keys) {
      if (HEROICON_TO_IONICON_MAP[key]) {
        return HEROICON_TO_IONICON_MAP[key];
      }
    }
  }

  console.warn(`Footer: No se pudo determinar el icono para:`, icon);
  return "ellipse";
};

