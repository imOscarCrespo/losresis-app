import { useState, useEffect, useCallback } from "react";
import {
  getStudentQuestions,
  createStudentQuestion,
  answerStudentQuestion,
  canAnswerQuestions as checkCanAnswerQuestions,
  editStudentQuestion,
  deleteStudentQuestion,
  editStudentAnswer,
  deleteStudentAnswer,
} from "../services/studentQuestionsService";

/**
 * Hook personalizado para manejar las preguntas de estudiantes
 * Basado en la estructura del hook web
 */
export const useStudentQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Cargar preguntas para un hospital y especialidad
  const fetchQuestions = useCallback(async (hospitalId, specialityId) => {
    if (!hospitalId || !specialityId) return;

    setLoading(true);
    setError(null);

    try {
      const {
        success,
        questions: questionsData,
        error: err,
      } = await getStudentQuestions(hospitalId, specialityId);

      if (success) {
        setQuestions(questionsData || []);
      } else {
        setError(err || "Error al cargar las preguntas");
      }
    } catch (err) {
      setError(err.message || "Error inesperado al cargar las preguntas");
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear nueva pregunta (solo estudiantes y super admins)
  const createQuestion = useCallback(
    async (hospitalId, specialityId, questionText, userProfile) => {
      if (!userProfile?.is_student && !userProfile?.is_super_admin) {
        throw new Error(
          "Solo estudiantes y super admins pueden crear preguntas"
        );
      }

      setSubmitting(true);
      setError(null);

      try {
        const {
          success,
          question,
          error: err,
        } = await createStudentQuestion(
          hospitalId,
          specialityId,
          userProfile.id,
          questionText
        );

        if (success) {
          setQuestions((prev) => [question, ...prev]);
          return question;
        } else {
          setError(err || "Error al crear la pregunta");
          throw new Error(err || "Error al crear la pregunta");
        }
      } catch (err) {
        const errorMsg = err.message || "Error inesperado al crear la pregunta";
        setError(errorMsg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  // Responder a una pregunta (solo residentes/doctores/super admins con reseña)
  const answerQuestion = useCallback(
    async (questionId, answerText, userProfile) => {
      if (
        !userProfile?.is_resident &&
        !userProfile?.is_doctor &&
        !userProfile?.is_super_admin
      ) {
        throw new Error(
          "Solo residentes, doctores y super admins pueden responder"
        );
      }

      setSubmitting(true);
      setError(null);

      try {
        const {
          success,
          answer,
          error: err,
        } = await answerStudentQuestion(questionId, userProfile.id, answerText);

        if (success) {
          // Actualizar la pregunta con la nueva respuesta
          setQuestions((prev) =>
            prev.map((q) =>
              q.id === questionId
                ? { ...q, answers: [answer, ...(q.answers || [])] }
                : q
            )
          );
          return answer;
        } else {
          setError(err || "Error al responder la pregunta");
          throw new Error(err || "Error al responder la pregunta");
        }
      } catch (err) {
        const errorMsg = err.message || "Error inesperado al responder";
        setError(errorMsg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  // Verificar si el usuario puede responder preguntas
  const canAnswerQuestions = useCallback(
    async (hospitalId, specialityId, userProfile) => {
      if (
        !userProfile?.is_resident &&
        !userProfile?.is_doctor &&
        !userProfile?.is_super_admin
      ) {
        return false;
      }

      // Super admins siempre pueden responder
      if (userProfile.is_super_admin) {
        return true;
      }

      try {
        const {
          success,
          canAnswer,
          error: err,
        } = await checkCanAnswerQuestions(
          hospitalId,
          specialityId,
          userProfile.id
        );

        if (success) {
          return canAnswer;
        } else {
          console.error("Error checking if user can answer:", err);
          return false;
        }
      } catch (err) {
        console.error("Exception checking if user can answer:", err);
        return false;
      }
    },
    []
  );

  // Editar una pregunta (solo el propietario o super admin)
  const editQuestion = useCallback(
    async (questionId, newText, userProfile) => {
      if (!userProfile?.is_super_admin) {
        // Verificar que el usuario es el propietario
        const question = questions.find((q) => q.id === questionId);
        if (!question || question.user_id !== userProfile.id) {
          throw new Error("Solo puedes editar tus propias preguntas");
        }
      }

      setSubmitting(true);
      setError(null);

      try {
        const {
          success,
          question,
          error: err,
        } = await editStudentQuestion(questionId, newText);

        if (success) {
          setQuestions((prev) =>
            prev.map((q) => (q.id === questionId ? question : q))
          );
          return question;
        } else {
          setError(err || "Error al editar la pregunta");
          throw new Error(err || "Error al editar la pregunta");
        }
      } catch (err) {
        const errorMsg = err.message || "Error inesperado al editar";
        setError(errorMsg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [questions]
  );

  // Eliminar una pregunta (solo el propietario o super admin)
  const deleteQuestion = useCallback(
    async (questionId, userProfile) => {
      if (!userProfile?.is_super_admin) {
        // Verificar que el usuario es el propietario
        const question = questions.find((q) => q.id === questionId);
        if (!question || question.user_id !== userProfile.id) {
          throw new Error("Solo puedes eliminar tus propias preguntas");
        }
      }

      setSubmitting(true);
      setError(null);

      try {
        const { success, error: err } = await deleteStudentQuestion(questionId);

        if (success) {
          setQuestions((prev) => prev.filter((q) => q.id !== questionId));
          return true;
        } else {
          setError(err || "Error al eliminar la pregunta");
          throw new Error(err || "Error al eliminar la pregunta");
        }
      } catch (err) {
        const errorMsg = err.message || "Error inesperado al eliminar";
        setError(errorMsg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [questions]
  );

  // Editar una respuesta (solo el propietario o super admin)
  const editAnswer = useCallback(
    async (answerId, newText, userProfile) => {
      if (!userProfile?.is_super_admin) {
        // Verificar que el usuario es el propietario
        const answer = questions
          .flatMap((q) => q.answers || [])
          .find((a) => a.id === answerId);
        if (!answer || answer.user_id !== userProfile.id) {
          throw new Error("Solo puedes editar tus propias respuestas");
        }
      }

      setSubmitting(true);
      setError(null);

      try {
        const {
          success,
          answer,
          error: err,
        } = await editStudentAnswer(answerId, newText);

        if (success) {
          setQuestions((prev) =>
            prev.map((q) => ({
              ...q,
              answers: (q.answers || []).map((a) =>
                a.id === answerId ? answer : a
              ),
            }))
          );
          return answer;
        } else {
          setError(err || "Error al editar la respuesta");
          throw new Error(err || "Error al editar la respuesta");
        }
      } catch (err) {
        const errorMsg = err.message || "Error inesperado al editar";
        setError(errorMsg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [questions]
  );

  // Eliminar una respuesta (solo el propietario o super admin)
  const deleteAnswer = useCallback(
    async (answerId, userProfile) => {
      if (!userProfile?.is_super_admin) {
        // Verificar que el usuario es el propietario
        const answer = questions
          .flatMap((q) => q.answers || [])
          .find((a) => a.id === answerId);
        if (!answer || answer.user_id !== userProfile.id) {
          throw new Error("Solo puedes eliminar tus propias respuestas");
        }
      }

      setSubmitting(true);
      setError(null);

      try {
        const { success, error: err } = await deleteStudentAnswer(answerId);

        if (success) {
          setQuestions((prev) =>
            prev.map((q) => ({
              ...q,
              answers: (q.answers || []).filter((a) => a.id !== answerId),
            }))
          );
          return true;
        } else {
          setError(err || "Error al eliminar la respuesta");
          throw new Error(err || "Error al eliminar la respuesta");
        }
      } catch (err) {
        const errorMsg = err.message || "Error inesperado al eliminar";
        setError(errorMsg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [questions]
  );

  return {
    questions,
    loading,
    error,
    submitting,
    fetchQuestions,
    createQuestion,
    answerQuestion,
    canAnswerQuestions,
    editQuestion,
    deleteQuestion,
    editAnswer,
    deleteAnswer,
  };
};
