import { supabase } from "../config/supabase";

/**
 * Servicio para gestionar cursos y formaciones
 */

const ITEMS_PER_PAGE = 20;

const COURSE_SELECT = `
  *,
  hospital:hospitals(id, name, city, region),
  speciality:specialities(id, name)
`;

const PUBLISHED_STATUS = "published";
const RESIDENT_FALLBACK_ORG_NAME = "losresis_app";
const COURSE_MUTABLE_FIELDS = [
  "title",
  "event_dates",
  "teaching_hours",
  "price_text",
  "course_directors",
  "organization",
  "venue_name",
  "venue_address",
  "seats_available",
  "course_code",
  "more_info",
  "objectives",
  "registration_url",
  "hospital_id",
  "speciality_id",
];

const buildCourseMutationPayload = (courseData = {}) => {
  const payload = {};

  COURSE_MUTABLE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(courseData, field)) {
      payload[field] = courseData[field] ?? null;
    }
  });

  return payload;
};

const buildEmployerDisplayName = (userProfile) => {
  const fullName = [userProfile?.name, userProfile?.surname]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || RESIDENT_FALLBACK_ORG_NAME;
};

const getActiveEmployerAccountForUser = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("employer_account")
    .select("id, org_id, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ Error resolving active employer account for user:", error);
    throw error;
  }

  return data || null;
};

const getResidentPublisherProfile = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, name, surname, is_resident")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ Error fetching user profile for course publication:", error);
    throw error;
  }

  return data || null;
};

const getResidentFallbackOrg = async () => {
  const { data, error } = await supabase
    .from("employer_org")
    .select("id, name")
    .eq("name", RESIDENT_FALLBACK_ORG_NAME)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ Error fetching resident fallback org:", error);
    throw error;
  }

  return data || null;
};

const ensureResidentFallbackEmployerAccount = async (userId) => {
  const userProfile = await getResidentPublisherProfile(userId);

  if (!userProfile?.is_resident) {
    return null;
  }

  const fallbackOrg = await getResidentFallbackOrg();

  if (!fallbackOrg?.id) {
    throw {
      code: "RESIDENT_FALLBACK_ORG_MISSING",
      message:
        "Falta configurar la organización temporal losresis_app para publicar cursos.",
    };
  }

  const { data: existingAccount, error: existingAccountError } = await supabase
    .from("employer_account")
    .select("id, org_id, is_active")
    .eq("user_id", userId)
    .eq("org_id", fallbackOrg.id)
    .limit(1)
    .maybeSingle();

  if (existingAccountError) {
    console.error("❌ Error fetching resident fallback employer account:", existingAccountError);
    throw existingAccountError;
  }

  if (existingAccount?.is_active) {
    return existingAccount.org_id;
  }

  const displayName = buildEmployerDisplayName(userProfile);

  if (existingAccount?.id) {
    const { data: updatedAccount, error: updateError } = await supabase
      .from("employer_account")
      .update({
        is_active: true,
        role: "owner",
        display_name: displayName,
      })
      .eq("id", existingAccount.id)
      .select("org_id")
      .single();

    if (updateError) {
      console.error("❌ Error reactivating resident fallback employer account:", updateError);
      throw updateError;
    }

    return updatedAccount?.org_id || fallbackOrg.id;
  }

  const { data: insertedAccount, error: insertError } = await supabase
    .from("employer_account")
    .insert({
      user_id: userId,
      org_id: fallbackOrg.id,
      role: "owner",
      is_active: true,
      display_name: displayName,
    })
    .select("org_id")
    .single();

  if (insertError) {
    console.error("❌ Error creating resident fallback employer account:", insertError);
    throw insertError;
  }

  return insertedAccount?.org_id || fallbackOrg.id;
};

const getEmployerOrgIdForUser = async (userId) => {
  if (!userId) return null;

  const activeAccount = await getActiveEmployerAccountForUser(userId);
  if (activeAccount?.org_id) {
    console.log("🏢 Using active employer org for course publication:", activeAccount.org_id);
    return activeAccount.org_id;
  }

  const fallbackOrgId = await ensureResidentFallbackEmployerAccount(userId);
  console.log("🏢 Using resident fallback org for course publication:", fallbackOrgId);
  return fallbackOrgId;
};

const mapLikedCourses = (courses = [], likedCourseIds = []) => {
  const likedSet = new Set(likedCourseIds);
  return (courses || []).map((course) => ({
    ...course,
    is_liked: likedSet.has(course.id),
  }));
};

const filterActiveCourses = (courses = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  return (courses || [])
    .filter((course) => {
      if (!course.event_dates || course.event_dates.length === 0) {
        return false;
      }

      const dates = course.event_dates
        .map((date) => new Date(date))
        .sort((a, b) => a.getTime() - b.getTime());

      const lastDate = dates[dates.length - 1];

      return dates.some((date) => date >= today) || lastDate >= sevenDaysAgo;
    })
    .sort((a, b) => {
      const aNext = (a.event_dates || []).slice().sort()[0] || "9999-12-31";
      const bNext = (b.event_dates || []).slice().sort()[0] || "9999-12-31";
      return aNext.localeCompare(bNext);
    });
};

const buildCoursesQuery = ({
  hospitalId = null,
  specialityId = null,
  createdById = null,
  from = null,
  to = null,
}) => {
  let query = supabase.from("courses").select(
    COURSE_SELECT,
    from != null && to != null ? { count: "exact" } : undefined
  );

  query = query.order("created_at", { ascending: false });

  if (hospitalId) {
    query = query.eq("hospital_id", hospitalId);
  }
  if (specialityId) {
    query = query.eq("speciality_id", specialityId);
  }
  if (createdById) {
    query = query.eq("created_by_id", createdById);
  }
  if (from != null && to != null) {
    query = query.range(from, to);
  }

  return query;
};

const getLikedCourseIdsByUser = async ({ userId, from = null, to = null }) => {
  let query = supabase.from("course_like").select(
    "course_id",
    from != null && to != null ? { count: "exact" } : undefined
  );

  query = query.eq("user_id", userId).order("created_at", { ascending: false });

  if (from != null && to != null) {
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("❌ Error fetching liked course ids:", error);
    throw error;
  }

  return {
    courseIds: (data || []).map((item) => item.course_id).filter(Boolean),
    count: count || 0,
  };
};

/**
 * Obtiene cursos con filtros y paginación
 * @param {Object} options - Opciones de búsqueda
 * @param {string} options.hospitalId - ID del hospital (opcional)
 * @param {string} options.specialityId - ID de la especialidad (opcional)
 * @param {string} options.createdById - ID del usuario creador
 * @param {string} options.userId - ID del usuario actual para marcar likes
 * @param {number} options.page - Página actual (0-indexed)
 * @returns {Promise<Object>} Objeto con cursos y metadatos
 */
export const getCourses = async ({
  hospitalId = null,
  specialityId = null,
  createdById = null,
  userId = null,
  page = 0,
}) => {
  try {
    const from = page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error, count } = await buildCoursesQuery({
      hospitalId,
      specialityId,
      createdById,
      from,
      to,
    });

    if (error) {
      console.error("❌ Error fetching courses:", error);
      throw error;
    }

    let likedCourseIds = [];
    if (userId) {
      const { courseIds } = await getLikedCourseIdsByUser({ userId });
      likedCourseIds = courseIds;
    }

    const courses = mapLikedCourses(data || [], likedCourseIds);
    const activeCourses = filterActiveCourses(courses);

    console.log(
      `✅ Fetched ${activeCourses.length} active courses (page ${page + 1})`
    );

    return {
      courses: activeCourses,
      count: count || 0,
      hasMore: to < (count || 0) - 1,
    };
  } catch (error) {
    console.error("❌ Exception in getCourses:", error);
    throw error;
  }
};

export const getLikedCourses = async ({
  userId,
  hospitalId = null,
  specialityId = null,
  createdById = null,
  page = 0,
}) => {
  try {
    if (!userId) {
      return {
        courses: [],
        count: 0,
        hasMore: false,
      };
    }

    const from = page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { courseIds } = await getLikedCourseIdsByUser({ userId });

    if (courseIds.length === 0) {
      return {
        courses: [],
        count: 0,
        hasMore: false,
      };
    }

    let query = buildCoursesQuery({
      hospitalId,
      specialityId,
      createdById,
    }).in("id", courseIds);

    const { data, error } = await query;

    if (error) {
      console.error("❌ Error fetching liked courses:", error);
      throw error;
    }

    const courseById = new Map((data || []).map((course) => [course.id, course]));
    const orderedCourses = filterActiveCourses(
      courseIds
        .map((courseId) => courseById.get(courseId))
        .filter(Boolean)
        .map((course) => ({
          ...course,
          is_liked: true,
        }))
    );

    return {
      courses: orderedCourses.slice(from, to + 1),
      count: orderedCourses.length,
      hasMore: to < orderedCourses.length - 1,
    };
  } catch (error) {
    console.error("❌ Exception in getLikedCourses:", error);
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

    const finalStatus = courseData.status || PUBLISHED_STATUS;
    const shouldPublish = finalStatus === PUBLISHED_STATUS;
    const resolvedOrgId =
      courseData.org_id ||
      (shouldPublish ? await getEmployerOrgIdForUser(courseData.created_by_id) : null);

    console.log("🏢 Resolved org_id for createCourse:", {
      created_by_id: courseData.created_by_id,
      resolvedOrgId,
      shouldPublish,
    });

    if (shouldPublish && !resolvedOrgId) {
      throw {
        code: "COURSE_ORG_REQUIRED",
        message: "No se puede publicar el curso sin org_id",
      };
    }

    const courseToInsert = {
      ...buildCourseMutationPayload(courseData),
      status: finalStatus,
      published_at:
        courseData.published_at || (shouldPublish ? new Date().toISOString() : null),
      ...(resolvedOrgId ? { org_id: resolvedOrgId } : {}),
      ...(courseData.created_by_id && { created_by_id: courseData.created_by_id }),
    };

    console.log("🧾 Final createCourse payload:", courseToInsert);

    const { data, error } = await supabase
      .from("courses")
      .insert([courseToInsert])
      .select(COURSE_SELECT)
      .single();

    if (error) {
      console.error("❌ Error creating course:", error);
      throw error;
    }

    console.log("✅ Course created successfully");
    return {
      ...data,
      is_liked: false,
    };
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

    let publishedAt = courseData.published_at;
    let resolvedOrgId = courseData.org_id;
    let currentCourse = null;

    if (
      courseData.status === PUBLISHED_STATUS &&
      (publishedAt === undefined || !resolvedOrgId)
    ) {
      const { data, error: currentCourseError } = await supabase
        .from("courses")
        .select("status, published_at, org_id, created_by_id")
        .eq("id", courseId)
        .maybeSingle();

      if (currentCourseError) {
        console.error("❌ Error fetching current course status:", currentCourseError);
        throw currentCourseError;
      }

      currentCourse = data;

      if (currentCourse?.status !== PUBLISHED_STATUS || !currentCourse?.published_at) {
        publishedAt = new Date().toISOString();
      }

      if (!resolvedOrgId && currentCourse?.org_id) {
        resolvedOrgId = currentCourse.org_id;
      }

      if (!resolvedOrgId) {
        resolvedOrgId = await getEmployerOrgIdForUser(
          courseData.created_by_id || currentCourse?.created_by_id
        );
      }
    }

    console.log("🏢 Resolved org_id for updateCourse:", {
      courseId,
      created_by_id: courseData.created_by_id || currentCourse?.created_by_id,
      resolvedOrgId,
    });

    if (courseData.status === PUBLISHED_STATUS && !resolvedOrgId) {
      throw {
        code: "COURSE_ORG_REQUIRED",
        message: "No se puede publicar el curso sin org_id",
      };
    }

    const courseToUpdate = {
      ...buildCourseMutationPayload(courseData),
      ...(courseData.status ? { status: courseData.status } : {}),
      ...(publishedAt !== undefined ? { published_at: publishedAt } : {}),
      ...(resolvedOrgId ? { org_id: resolvedOrgId } : {}),
    };

    console.log("🧾 Final updateCourse payload:", courseToUpdate);

    const { data, error } = await supabase
      .from("courses")
      .update(courseToUpdate)
      .eq("id", courseId)
      .select(COURSE_SELECT)
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
 * Elimina un curso.
 * La tabla courses debe tener la columna created_by_id (UUID).
 * En Supabase, conviene usar RLS para que solo el creador (o admin) pueda eliminar:
 *   DELETE: auth.uid() = created_by_id (o rol admin).
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
 * Comprueba si el usuario ha guardado el curso
 * @param {string} userId - ID del usuario
 * @param {string} courseId - ID del curso
 * @returns {Promise<boolean>} Estado del guardado
 */
export const isCourseLiked = async (userId, courseId) => {
  try {
    if (!userId || !courseId) {
      return false;
    }

    const { data, error } = await supabase
      .from("course_like")
      .select("course_id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (error) {
      console.error("❌ Error checking course like:", error);
      throw error;
    }

    return Boolean(data?.course_id);
  } catch (error) {
    console.error("❌ Exception in isCourseLiked:", error);
    throw error;
  }
};

/**
 * Crea o elimina el guardado de un curso para un usuario
 * @param {string} userId - ID del usuario
 * @param {string} courseId - ID del curso
 * @returns {Promise<boolean>} Nuevo estado del guardado
 */
export const toggleCourseLike = async (userId, courseId) => {
  try {
    if (!userId || !courseId) {
      throw new Error("User ID and course ID are required");
    }

    const liked = await isCourseLiked(userId, courseId);

    if (liked) {
      const { error } = await supabase
        .from("course_like")
        .delete()
        .eq("user_id", userId)
        .eq("course_id", courseId);

      if (error) {
        console.error("❌ Error deleting course like:", error);
        throw error;
      }

      return false;
    }

    const { error } = await supabase
      .from("course_like")
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
        },
        { onConflict: "user_id,course_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error("❌ Error creating course like:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("❌ Exception in toggleCourseLike:", error);
    throw error;
  }
};

/**
 * Obtiene un curso por ID
 * @param {string} courseId - ID del curso
 * @param {string} userId - ID del usuario actual (opcional)
 * @returns {Promise<Object>} Curso
 */
export const getCourseById = async (courseId, userId = null) => {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select(COURSE_SELECT)
      .eq("id", courseId)
      .single();

    if (error) {
      console.error("❌ Error fetching course:", error);
      throw error;
    }

    const liked = userId ? await isCourseLiked(userId, courseId) : false;

    return {
      ...data,
      is_liked: liked,
    };
  } catch (error) {
    console.error("❌ Exception in getCourseById:", error);
    throw error;
  }
};

export default {
  getCourses,
  getLikedCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  isCourseLiked,
  toggleCourseLike,
  getCourseById,
};
