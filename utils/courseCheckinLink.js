// Enlace de fichaje que proyecta el panel en la sala:
//   losresis://course-checkin?c=<course_id>&k=<código de 6 dígitos>
// Solo se reconoce ese host; cualquier otro enlace (p. ej. auth/callback)
// devuelve null y lo sigue tratando quien lo trataba.

const CHECKIN_PREFIX = /^losresis:\/\/course-checkin\/?(?:\?|$)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readQueryParam = (query, name) => {
  for (const pair of query.split("&")) {
    const [key, ...rest] = pair.split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("=").replace(/\+/g, " "));
      } catch {
        return null;
      }
    }
  }
  return null;
};

/** { courseId, checkinCode } o null si no es un enlace de fichaje válido. */
export const parseCourseCheckinUrl = (url) => {
  if (typeof url !== "string" || !CHECKIN_PREFIX.test(url)) {
    return null;
  }
  const query = (url.split("?")[1] || "").split("#")[0];
  const courseId = readQueryParam(query, "c");
  const checkinCode = (readQueryParam(query, "k") || "").replace(/\D/g, "");

  if (!courseId || !UUID.test(courseId) || checkinCode.length !== 6) {
    return null;
  }
  return { courseId, checkinCode };
};
