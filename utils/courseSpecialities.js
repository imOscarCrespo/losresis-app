// #124b4z9vn8t Un curso puede ir dirigido a varias especialidades
// (`speciality_ids`), a todas (`all_specialities`) o a ninguna (array vacío).
// `speciality_id` sigue siendo la primera, para apps antiguas.

export const ALL_SPECIALITIES_LABEL = "Todas las especialidades";

/**
 * Filtro PostgREST (`.or(...)`) para el listado: el curso incluye la
 * especialidad o es para todas.
 */
export const courseSpecialityOrFilter = (specialityId) =>
  `all_specialities.eq.true,speciality_ids.cs.{${specialityId}}`;

const courseSpecialityIds = (course) => {
  if (Array.isArray(course?.speciality_ids)) {
    return course.speciality_ids.filter(Boolean);
  }
  // Curso leído antes de la migración: solo trae speciality_id.
  return course?.speciality_id ? [course.speciality_id] : [];
};

/**
 * Nombres de las especialidades del curso.
 * @param {Object} course
 * @param {(id: string) => ({ name?: string } | null)} lookup
 * @returns {{ all: boolean, names: string[] }}
 */
export const getCourseSpecialityNames = (course, lookup = () => null) => {
  if (course?.all_specialities) return { all: true, names: [] };

  const names = courseSpecialityIds(course)
    .map((id) => {
      if (course?.speciality?.id === id && course.speciality.name) {
        return course.speciality.name;
      }
      return lookup(id)?.name || null;
    })
    // Una especialidad borrada deja su id en el array: se ignora.
    .filter(Boolean);

  return { all: false, names };
};

/** Texto de la ficha: todas las especialidades, separadas por comas. */
export const formatCourseSpecialities = (course, lookup) => {
  const { all, names } = getCourseSpecialityNames(course, lookup);
  if (all) return ALL_SPECIALITIES_LABEL;
  return names.length ? names.join(", ") : null;
};

/** Texto corto de la tarjeta del listado: «Cardiología +2». */
export const formatCourseSpecialityBadge = (course, lookup) => {
  const { all, names } = getCourseSpecialityNames(course, lookup);
  if (all) return ALL_SPECIALITIES_LABEL;
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
};
