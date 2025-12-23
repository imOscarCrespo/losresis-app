import { supabase } from "../config/supabase";

/**
 * Servicio para gestionar cursos y formaciones
 */

const ITEMS_PER_PAGE = 20;

/**
 * Obtiene cursos con filtros y paginación
 * @param {Object} options - Opciones de búsqueda
 * @param {string} options.hospitalId - ID del hospital (opcional)
 * @param {string} options.specialityId - ID de la especialidad (opcional)
 * @param {number} options.page - Página actual (0-indexed)
 * @returns {Promise<Object>} Objeto con cursos y metadatos
 */
export const getCourses = async ({
  hospitalId = null,
  specialityId = null,
  page = 0,
}) => {
  try {
    const from = page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    // Build query
    let query = supabase
      .from("courses")
      .select(
        `
        *,
        hospital:hospitals(id, name, city, region),
        speciality:specialities(id, name)
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    // Apply filters
    if (hospitalId) {
      query = query.eq("hospital_id", hospitalId);
    }
    if (specialityId) {
      query = query.eq("speciality_id", specialityId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ Error fetching courses:", error);
      throw error;
    }

    // Filter active courses (at least one date >= today OR last date within last 7 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const activeCourses = (data || []).filter((course) => {
      if (!course.event_dates || course.event_dates.length === 0) return false;

      const dates = course.event_dates
        .map((d) => new Date(d))
        .sort((a, b) => a.getTime() - b.getTime());

      const lastDate = dates[dates.length - 1];

      // Keep if at least one date is in the future OR last date is within last 7 days
      return dates.some((d) => d >= today) || lastDate >= sevenDaysAgo;
    });

    console.log(
      `✅ Fetched ${activeCourses.length} active courses (page ${page + 1})`
    );

    return {
      courses: activeCourses,
      count: count || 0,
      hasMore: activeCourses.length === ITEMS_PER_PAGE,
    };
  } catch (error) {
    console.error("❌ Exception in getCourses:", error);
    throw error;
  }
};

/**
 * Crea un nuevo curso
 * @param {Object} courseData - Datos del curso
 * @returns {Promise<Object>} Curso creado
 */
export const createCourse = async (courseData) => {
  try {
    console.log("🎓 Creating course:", courseData);

    const courseToInsert = {
      title: courseData.title,
      event_dates: courseData.event_dates,
      teaching_hours: courseData.teaching_hours || null,
      price_text: courseData.price_text || null,
      course_directors: courseData.course_directors || null,
      organization: courseData.organization || null,
      venue_name: courseData.venue_name || null,
      venue_address: courseData.venue_address || null,
      seats_available: courseData.seats_available || null,
      course_code: courseData.course_code || null,
      more_info: courseData.more_info || null,
      objectives: courseData.objectives || null,
      registration_url: courseData.registration_url || null,
      hospital_id: courseData.hospital_id || null,
      speciality_id: courseData.speciality_id || null,
    };

    const { data, error } = await supabase
      .from("courses")
      .insert([courseToInsert])
      .select(
        `
        *,
        hospital:hospitals(id, name, city, region),
        speciality:specialities(id, name)
      `
      )
      .single();

    if (error) {
      console.error("❌ Error creating course:", error);
      throw error;
    }

    console.log("✅ Course created successfully");
    return data;
  } catch (error) {
    console.error("❌ Exception in createCourse:", error);
    throw error;
  }
};

/**
 * Actualiza un curso existente
 * @param {string} courseId - ID del curso
 * @param {Object} courseData - Datos a actualizar
 * @returns {Promise<Object>} Curso actualizado
 */
export const updateCourse = async (courseId, courseData) => {
  try {
    console.log("🔄 Updating course:", courseId);

    const courseToUpdate = {
      title: courseData.title,
      event_dates: courseData.event_dates,
      teaching_hours: courseData.teaching_hours || null,
      price_text: courseData.price_text || null,
      course_directors: courseData.course_directors || null,
      organization: courseData.organization || null,
      venue_name: courseData.venue_name || null,
      venue_address: courseData.venue_address || null,
      seats_available: courseData.seats_available || null,
      course_code: courseData.course_code || null,
      more_info: courseData.more_info || null,
      objectives: courseData.objectives || null,
      registration_url: courseData.registration_url || null,
      hospital_id: courseData.hospital_id || null,
      speciality_id: courseData.speciality_id || null,
    };

    const { data, error } = await supabase
      .from("courses")
      .update(courseToUpdate)
      .eq("id", courseId)
      .select(
        `
        *,
        hospital:hospitals(id, name, city, region),
        speciality:specialities(id, name)
      `
      )
      .single();

    if (error) {
      console.error("❌ Error updating course:", error);
      throw error;
    }

    console.log("✅ Course updated successfully");
    return data;
  } catch (error) {
    console.error("❌ Exception in updateCourse:", error);
    throw error;
  }
};

/**
 * Elimina un curso
 * @param {string} courseId - ID del curso
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
export const deleteCourse = async (courseId) => {
  try {
    console.log("🗑️ Deleting course:", courseId);

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId);

    if (error) {
      console.error("❌ Error deleting course:", error);
      throw error;
    }

    console.log("✅ Course deleted successfully");
    return true;
  } catch (error) {
    console.error("❌ Exception in deleteCourse:", error);
    throw error;
  }
};

/**
 * Obtiene un curso por ID
 * @param {string} courseId - ID del curso
 * @returns {Promise<Object>} Curso
 */
export const getCourseById = async (courseId) => {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select(
        `
        *,
        hospital:hospitals(id, name, city, region),
        speciality:specialities(id, name)
      `
      )
      .eq("id", courseId)
      .single();

    if (error) {
      console.error("❌ Error fetching course:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Exception in getCourseById:", error);
    throw error;
  }
};

export default {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseById,
};
