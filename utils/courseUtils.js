/**
 * Utilidades para manejo de cursos y fechas
 */

/**
 * Obtiene la próxima fecha de evento de un curso
 * @param {string[]} eventDates - Array de fechas del evento
 * @returns {Date} Próxima fecha o primera fecha si todas son pasadas
 */
export const getNextEventDate = (eventDates) => {
  if (!eventDates || eventDates.length === 0) {
    return new Date();
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const futureDates = eventDates
    .map((date) => new Date(date))
    .filter((date) => date >= now)
    .sort((a, b) => a.getTime() - b.getTime());

  return futureDates.length > 0 ? futureDates[0] : new Date(eventDates[0]);
};

/**
 * Verifica si un curso está próximo (dentro de los próximos 30 días)
 * @param {string[]} eventDates - Array de fechas del evento
 * @returns {boolean} True si el curso está próximo
 */
export const isCourseUpcoming = (eventDates) => {
  if (!eventDates || eventDates.length === 0) {
    return false;
  }

  const nextDate = getNextEventDate(eventDates);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  return nextDate >= now && nextDate <= thirtyDaysFromNow;
};

/**
 * Filtra cursos por término de búsqueda
 * @param {Array} courses - Array de cursos
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Array} Cursos filtrados
 */
export const filterCoursesBySearch = (courses, searchTerm) => {
  if (!searchTerm) return courses;

  const searchLower = searchTerm.toLowerCase();
  return courses.filter(
    (course) =>
      course.title?.toLowerCase().includes(searchLower) ||
      course.organization?.toLowerCase().includes(searchLower) ||
      course.venue_name?.toLowerCase().includes(searchLower) ||
      course.course_directors?.toLowerCase().includes(searchLower)
  );
};

/**
 * Abre una URL en el navegador
 * @param {string} url - URL a abrir
 * @param {function} onError - Callback de error
 */
export const openURL = async (url, onError) => {
  if (!url) return;

  const { Linking, Alert } = require("react-native");

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "No se puede abrir esta URL");
      if (onError) onError(new Error("URL not supported"));
    }
  } catch (error) {
    console.error("Error opening URL:", error);
    Alert.alert("Error", "No se pudo abrir el enlace");
    if (onError) onError(error);
  }
};
