import { useState, useEffect, useCallback } from "react";
import {
  getCourses,
  getLikedCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from "../services/lectureService";
import { getCurrentUser, getUserProfile } from "../services/authService";
import { usePersistedFilters } from "./usePersistedFilters";

/**
 * Hook para gestionar cursos y formaciones
 * @returns {Object} Estado y funciones para gestionar cursos
 */
export const useLectures = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userSpecialityId, setUserSpecialityId] = useState(null);

  const {
    filters,
    isLoading: filtersLoading,
    updateFilter,
    updateFilters,
    clearAllFilters: clearPersistedFilters,
  } = usePersistedFilters(
    "lectures_v2",
    {
      searchTerm: "",
      hospital_id: "",
      speciality_id: "",
      showLikedCourses: false,
      showCreatedCourses: false,
      _userSpecialityDefaultApplied: false,
    },
    { enableDebounce: true, debounceMs: 500 }
  );

  const searchTerm = filters.searchTerm || "";
  const selectedHospital = filters.hospital_id || "";
  const selectedSpecialty = filters.speciality_id || "";
  const showLikedCourses = Boolean(filters.showLikedCourses);
  const showCreatedCourses = Boolean(filters.showCreatedCourses);

  // Cargar usuario actual para filtros y guardados
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { success, user } = await getCurrentUser();
        if (success && user) {
          setCurrentUserId(user.id);
          const profileResult = await getUserProfile(user.id);
          if (profileResult?.success && profileResult.profile?.speciality_id) {
            setUserSpecialityId(profileResult.profile.speciality_id);
          }
        }
      } catch (err) {
        console.error("Error loading current user:", err);
      }
    };
    loadUser();
  }, []);

  // Aplicar la especialidad del usuario como filtro por defecto la primera vez
  useEffect(() => {
    if (filtersLoading) return;
    if (!userSpecialityId) return;
    if (filters._userSpecialityDefaultApplied) return;
    updateFilters({
      speciality_id: filters.speciality_id || userSpecialityId,
      _userSpecialityDefaultApplied: true,
    });
  }, [
    filtersLoading,
    userSpecialityId,
    filters._userSpecialityDefaultApplied,
    filters.speciality_id,
    updateFilters,
  ]);

  // Clear error after some time
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch courses with filters and pagination
  const fetchCourses = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);

        const page = reset ? 0 : currentPage;
        const createdById =
          showCreatedCourses && currentUserId ? currentUserId : null;

        const result = showLikedCourses
          ? await getLikedCourses({
              userId: currentUserId,
              hospitalId: selectedHospital || null,
              specialityId: selectedSpecialty || null,
              createdById,
              page,
            })
          : await getCourses({
              hospitalId: selectedHospital || null,
              specialityId: selectedSpecialty || null,
              createdById,
              userId: currentUserId,
              page,
            });

        if (reset) {
          setCourses(result.courses);
          setCurrentPage(1);
        } else {
          setCourses((prev) => [...prev, ...result.courses]);
          setCurrentPage((prev) => prev + 1);
        }

        setHasMore(result.hasMore);
        setTotalCount(result.count);
      } catch (err) {
        console.error("Error fetching courses:", err);
        setError("Error al cargar los cursos");
      } finally {
        setLoading(false);
      }
    },
    [
      currentPage,
      selectedHospital,
      selectedSpecialty,
      showLikedCourses,
      showCreatedCourses,
      currentUserId,
    ]
  );

  // Load more courses (pagination)
  const loadMoreCourses = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchCourses(false);
  }, [hasMore, loading, fetchCourses]);

  // Refresh courses (reset and fetch from beginning)
  const refreshCourses = useCallback(async () => {
    setCurrentPage(0);
    await fetchCourses(true);
  }, [fetchCourses]);

  // Set filters and refresh
  const setFilters = useCallback((newFilters) => {
    updateFilters(newFilters);
    setCurrentPage(0);
    setCourses([]);
    setHasMore(true);
  }, [updateFilters]);

  const setSearchTerm = useCallback(
    (value) => updateFilter("searchTerm", value),
    [updateFilter]
  );

  const setSelectedHospital = useCallback(
    (value) => updateFilter("hospital_id", value),
    [updateFilter]
  );

  const setSelectedSpecialty = useCallback(
    (value) => updateFilter("speciality_id", value),
    [updateFilter]
  );

  const setShowLikedCourses = useCallback(
    (value) => updateFilter("showLikedCourses", Boolean(value)),
    [updateFilter]
  );

  const setShowCreatedCourses = useCallback(
    (value) => updateFilter("showCreatedCourses", Boolean(value)),
    [updateFilter]
  );

  // Clear filters
  const clearFilters = useCallback(() => {
    // Update atómico: limpia todos los filtros Y deja marcado el flag de
    // especialidad-por-defecto como aplicado, para que el efecto de
    // auto-aplicar no vuelva a setear la especialidad del usuario.
    updateFilters({
      searchTerm: "",
      hospital_id: "",
      speciality_id: "",
      showLikedCourses: false,
      showCreatedCourses: false,
      _userSpecialityDefaultApplied: true,
    });
    setCurrentPage(0);
    setCourses([]);
    setHasMore(true);
  }, [updateFilters]);

  // Create a new course
  const createNewCourse = useCallback(async (courseData) => {
    try {
      setLoading(true);
      setError(null);

      const newCourse = await createCourse(courseData);

      // Add to the beginning of the list
      setCourses((prev) => [newCourse, ...prev]);
      setTotalCount((prev) => prev + 1);

      return newCourse;
    } catch (err) {
      console.error("Error creating course:", err);
      setError("Error al crear el curso");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update an existing course
  const updateExistingCourse = useCallback(async (courseId, courseData) => {
    try {
      setLoading(true);
      setError(null);

      const updatedCourse = await updateCourse(courseId, courseData);

      // Update in the list
      setCourses((prev) =>
        prev.map((course) => (course.id === courseId ? updatedCourse : course))
      );

      return updatedCourse;
    } catch (err) {
      console.error("Error updating course:", err);
      setError("Error al actualizar el curso");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete a course
  const deleteExistingCourse = useCallback(async (courseId) => {
    try {
      setLoading(true);
      setError(null);

      await deleteCourse(courseId);

      // Remove from the list
      setCourses((prev) => prev.filter((course) => course.id !== courseId));
      setTotalCount((prev) => prev - 1);

      return true;
    } catch (err) {
      console.error("Error deleting course:", err);
      setError("Error al eliminar el curso");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load when filters or toggles cambian
  useEffect(() => {
    if (filtersLoading) {
      return;
    }
    fetchCourses(true);
  }, [
    selectedHospital,
    selectedSpecialty,
    showLikedCourses,
    showCreatedCourses,
    currentUserId,
    filtersLoading,
    fetchCourses,
  ]);

  return {
    // Data
    courses,
    loading,
    error,
    hasMore,
    totalCount,

    // Filters
    filters,
    searchTerm,
    setSearchTerm,
    selectedHospital,
    setSelectedHospital,
    selectedSpecialty,
    setSelectedSpecialty,
    setFilters,
    clearFilters,
    filtersLoading,

    // Actions
    fetchCourses,
    loadMoreCourses,
    createCourse: createNewCourse,
    updateCourse: updateExistingCourse,
    deleteCourse: deleteExistingCourse,
    refreshCourses,
    showLikedCourses,
    setShowLikedCourses,
    showCreatedCourses,
    setShowCreatedCourses,
    currentUserId,
  };
};

export default useLectures;
