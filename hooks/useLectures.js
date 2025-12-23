import { useState, useEffect, useCallback } from 'react';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../services/lectureService';

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

  // Filters
  const [filters, setFiltersState] = useState({
    hospital_id: '',
    speciality_id: '',
  });

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

        const result = await getCourses({
          hospitalId: filters.hospital_id || null,
          specialityId: filters.speciality_id || null,
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
        console.error('Error fetching courses:', err);
        setError('Error al cargar los cursos');
      } finally {
        setLoading(false);
      }
    },
    [filters, currentPage]
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
    setFiltersState(newFilters);
    setCurrentPage(0);
    setCourses([]);
    setHasMore(true);
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({
      hospital_id: '',
      speciality_id: '',
    });
  }, [setFilters]);

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
      console.error('Error creating course:', err);
      setError('Error al crear el curso');
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
      console.error('Error updating course:', err);
      setError('Error al actualizar el curso');
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
      console.error('Error deleting course:', err);
      setError('Error al eliminar el curso');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load when filters change
  useEffect(() => {
    fetchCourses(true);
  }, [filters]);

  return {
    // Data
    courses,
    loading,
    error,
    hasMore,
    totalCount,

    // Filters
    filters,
    setFilters,
    clearFilters,

    // Actions
    fetchCourses,
    loadMoreCourses,
    createCourse: createNewCourse,
    updateCourse: updateExistingCourse,
    deleteCourse: deleteExistingCourse,
    refreshCourses,
  };
};

export default useLectures;

