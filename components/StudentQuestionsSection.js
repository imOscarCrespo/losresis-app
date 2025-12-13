import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStudentQuestions } from "../hooks/useStudentQuestions";
import { formatShortDate, formatLongDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";

/**
 * Componente de preguntas de estudiantes
 * Basado en la estructura del componente web
 */
export const StudentQuestionsSection = ({
  hospitalId,
  specialityId,
  userProfile,
}) => {
  const [newQuestion, setNewQuestion] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState([]);
  const [answerTexts, setAnswerTexts] = useState({});
  const [canAnswer, setCanAnswer] = useState(false);

  // Estados para editar
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingAnswer, setEditingAnswer] = useState(null);
  const [editText, setEditText] = useState("");

  // Estados para eliminar
  const [deletingQuestion, setDeletingQuestion] = useState(null);
  const [deletingAnswer, setDeletingAnswer] = useState(null);

  const {
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
  } = useStudentQuestions();

  // Cargar preguntas cuando cambia hospital/especialidad
  useEffect(() => {
    if (hospitalId && specialityId) {
      fetchQuestions(hospitalId, specialityId);
    }
  }, [hospitalId, specialityId, fetchQuestions]);

  // Verificar si el usuario puede responder
  useEffect(() => {
    const checkCanAnswer = async () => {
      if (userProfile && hospitalId && specialityId) {
        const canAnswerResult = await canAnswerQuestions(
          hospitalId,
          specialityId,
          userProfile
        );
        setCanAnswer(canAnswerResult);
      }
    };
    checkCanAnswer();
  }, [userProfile, hospitalId, specialityId, canAnswerQuestions]);

  const handleSubmitQuestion = async () => {
    if (!newQuestion.trim() || !userProfile) return;

    try {
      await createQuestion(
        hospitalId,
        specialityId,
        newQuestion.trim(),
        userProfile
      );
      setNewQuestion("");
    } catch (error) {
      Alert.alert("Error", "Error al crear la pregunta. Inténtalo de nuevo.");
    }
  };

  const handleSubmitAnswer = async (questionId) => {
    const answerText = answerTexts[questionId];
    if (!answerText?.trim() || !userProfile) return;

    try {
      await answerQuestion(questionId, answerText.trim(), userProfile);
      setAnswerTexts((prev) => ({ ...prev, [questionId]: "" }));
    } catch (error) {
      Alert.alert(
        "Error",
        "Error al responder la pregunta. Inténtalo de nuevo."
      );
    }
  };

  // Editar pregunta
  const handleEditQuestion = (questionId, currentText) => {
    setEditingQuestion(questionId);
    setEditText(currentText);
  };

  const handleSaveQuestionEdit = async () => {
    if (!editingQuestion || !editText.trim() || !userProfile) return;

    try {
      await editQuestion(editingQuestion, editText.trim(), userProfile);
      setEditingQuestion(null);
      setEditText("");
    } catch (error) {
      Alert.alert("Error", error.message || "Error al editar la pregunta.");
    }
  };

  const handleCancelQuestionEdit = () => {
    setEditingQuestion(null);
    setEditText("");
  };

  // Eliminar pregunta
  const handleDeleteQuestion = async (questionId) => {
    if (!userProfile) return;

    Alert.alert(
      "Eliminar pregunta",
      "¿Estás seguro de que quieres eliminar esta pregunta? Se eliminarán también todas las respuestas asociadas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteQuestion(questionId, userProfile);
              setDeletingQuestion(null);
            } catch (error) {
              Alert.alert(
                "Error",
                error.message || "Error al eliminar la pregunta."
              );
            }
          },
        },
      ]
    );
  };

  // Editar respuesta
  const handleEditAnswer = (answerId, currentText) => {
    setEditingAnswer(answerId);
    setEditText(currentText);
  };

  const handleSaveAnswerEdit = async () => {
    if (!editingAnswer || !editText.trim() || !userProfile) return;

    try {
      await editAnswer(editingAnswer, editText.trim(), userProfile);
      setEditingAnswer(null);
      setEditText("");
    } catch (error) {
      Alert.alert("Error", error.message || "Error al editar la respuesta.");
    }
  };

  const handleCancelAnswerEdit = () => {
    setEditingAnswer(null);
    setEditText("");
  };

  // Eliminar respuesta
  const handleDeleteAnswer = async (answerId) => {
    if (!userProfile) return;

    Alert.alert(
      "Eliminar respuesta",
      "¿Estás seguro de que quieres eliminar esta respuesta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAnswer(answerId, userProfile);
              setDeletingAnswer(null);
            } catch (error) {
              Alert.alert(
                "Error",
                error.message || "Error al eliminar la respuesta."
              );
            }
          },
        },
      ]
    );
  };

  const toggleQuestionExpansion = (questionId) => {
    setExpandedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const getUserDisplayName = (user) => {
    if (user?.is_student) return "Estudiante";
    if (user?.is_resident) return `R${user.resident_year || ""}`;
    if (user?.is_doctor) return "Doctor";
    return "Usuario";
  };

  const canEditOrDelete = (ownerId) => {
    if (!userProfile) return false;
    return userProfile.is_super_admin || userProfile.id === ownerId;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons
            name="chatbubbles-outline"
            size={20}
            color={COLORS.PRIMARY}
          />
          <Text style={styles.title}>Preguntas de Estudiantes</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando preguntas...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="chatbubbles-outline" size={20} color={COLORS.PRIMARY} />
        <Text style={styles.title}>
          Preguntas de Estudiantes ({questions.length})
        </Text>
      </View>

      {/* Formulario para nueva pregunta - Solo estudiantes y super admins */}
      {(userProfile?.is_student || userProfile?.is_super_admin) && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Haz una pregunta sobre esta especialidad en este hospital..."
            placeholderTextColor={COLORS.GRAY}
            value={newQuestion}
            onChangeText={setNewQuestion}
            multiline
            maxLength={500}
            editable={!submitting}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newQuestion.trim() || submitting) && styles.sendButtonDisabled,
            ]}
            onPress={handleSubmitQuestion}
            disabled={!newQuestion.trim() || submitting}
            activeOpacity={0.7}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.sendButtonText}>
                  {submitting ? "Enviando..." : "Enviar"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de preguntas */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={COLORS.GRAY} />
          <Text style={styles.emptyText}>
            {userProfile?.is_student || userProfile?.is_super_admin
              ? "Aún no hay preguntas. ¡Sé el primero en preguntar!"
              : "No hay preguntas de estudiantes aún."}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.questionsList} nestedScrollEnabled>
          {questions.map((question) => (
            <View key={question.id} style={styles.questionCard}>
              {/* Header de la pregunta */}
              <View style={styles.questionHeader}>
                <View style={styles.questionHeaderLeft}>
                  <Ionicons name="person" size={16} color={COLORS.GRAY} />
                  <Text style={styles.questionAuthor}>
                    {question.user?.name} {question.user?.surname}
                  </Text>
                  <View style={styles.userBadge}>
                    <Text style={styles.userBadgeText}>
                      {getUserDisplayName(question.user)}
                    </Text>
                  </View>
                </View>

                {/* Botones de acción */}
                <View style={styles.actionButtons}>
                  {canEditOrDelete(question.user_id) && (
                    <>
                      <TouchableOpacity
                        onPress={() =>
                          handleEditQuestion(
                            question.id,
                            question.question_text
                          )
                        }
                        style={styles.actionButton}
                      >
                        <Ionicons
                          name="pencil"
                          size={16}
                          color={COLORS.PRIMARY}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteQuestion(question.id)}
                        style={styles.actionButton}
                      >
                        <Ionicons name="trash" size={16} color={COLORS.ERROR} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    onPress={() => toggleQuestionExpansion(question.id)}
                    style={styles.actionButton}
                  >
                    <Ionicons
                      name={
                        expandedQuestions.includes(question.id)
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={16}
                      color={COLORS.GRAY}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Texto de la pregunta - Modo edición o visualización */}
              {editingQuestion === question.id ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.editInput}
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    maxLength={500}
                    editable={!submitting}
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={[styles.editButton, styles.saveButton]}
                      onPress={handleSaveQuestionEdit}
                      disabled={!editText.trim() || submitting}
                    >
                      <Text style={styles.editButtonText}>
                        {submitting ? "Guardando..." : "Guardar"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editButton, styles.cancelButton]}
                      onPress={handleCancelQuestionEdit}
                      disabled={submitting}
                    >
                      <Text style={styles.editButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.questionText}>
                  {question.question_text}
                </Text>
              )}

              {/* Info de la pregunta */}
              <View style={styles.questionInfo}>
                <View style={styles.questionInfoRow}>
                  <Ionicons name="time" size={12} color={COLORS.GRAY} />
                  <Text style={styles.questionDate}>
                    {formatLongDate(question.created_at)}
                  </Text>
                </View>
                <Text style={styles.answerCount}>
                  {question.answers?.length || 0} respuesta
                  {(question.answers?.length || 0) !== 1 ? "s" : ""}
                </Text>
              </View>

              {/* Sección de respuestas (expandida) */}
              {expandedQuestions.includes(question.id) && (
                <View style={styles.answersSection}>
                  {/* Lista de respuestas */}
                  {question.answers && question.answers.length > 0 && (
                    <View style={styles.answersList}>
                      {question.answers.map((answer) => (
                        <View key={answer.id} style={styles.answerCard}>
                          <View style={styles.answerHeader}>
                            <View style={styles.answerHeaderLeft}>
                              <Ionicons
                                name="school"
                                size={16}
                                color={COLORS.PRIMARY}
                              />
                              <Text style={styles.answerAuthor}>
                                {answer.user?.name} {answer.user?.surname}
                              </Text>
                              <View style={styles.answerBadge}>
                                <Text style={styles.answerBadgeText}>
                                  {getUserDisplayName(answer.user)}
                                </Text>
                              </View>
                            </View>

                            {/* Botones de acción de respuesta */}
                            {canEditOrDelete(answer.user_id) && (
                              <View style={styles.actionButtons}>
                                <TouchableOpacity
                                  onPress={() =>
                                    handleEditAnswer(
                                      answer.id,
                                      answer.answer_text
                                    )
                                  }
                                  style={styles.actionButton}
                                >
                                  <Ionicons
                                    name="pencil"
                                    size={14}
                                    color={COLORS.PRIMARY}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleDeleteAnswer(answer.id)}
                                  style={styles.actionButton}
                                >
                                  <Ionicons
                                    name="trash"
                                    size={14}
                                    color={COLORS.ERROR}
                                  />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>

                          {/* Texto de la respuesta - Modo edición o visualización */}
                          {editingAnswer === answer.id ? (
                            <View style={styles.editContainer}>
                              <TextInput
                                style={styles.editInput}
                                value={editText}
                                onChangeText={setEditText}
                                multiline
                                maxLength={500}
                                editable={!submitting}
                              />
                              <View style={styles.editButtons}>
                                <TouchableOpacity
                                  style={[styles.editButton, styles.saveButton]}
                                  onPress={handleSaveAnswerEdit}
                                  disabled={!editText.trim() || submitting}
                                >
                                  <Text style={styles.editButtonText}>
                                    {submitting ? "Guardando..." : "Guardar"}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.editButton,
                                    styles.cancelButton,
                                  ]}
                                  onPress={handleCancelAnswerEdit}
                                  disabled={submitting}
                                >
                                  <Text style={styles.editButtonText}>
                                    Cancelar
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <Text style={styles.answerText}>
                              {answer.answer_text}
                            </Text>
                          )}

                          <View style={styles.answerInfo}>
                            <Ionicons
                              name="time"
                              size={12}
                              color={COLORS.GRAY}
                            />
                            <Text style={styles.answerDate}>
                              {formatLongDate(answer.created_at)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Formulario para responder - Solo si puede responder */}
                  {canAnswer && (
                    <View style={styles.answerInputContainer}>
                      <TextInput
                        style={styles.answerInput}
                        placeholder="Responde a esta pregunta..."
                        placeholderTextColor={COLORS.GRAY}
                        value={answerTexts[question.id] || ""}
                        onChangeText={(text) =>
                          setAnswerTexts((prev) => ({
                            ...prev,
                            [question.id]: text,
                          }))
                        }
                        multiline
                        maxLength={500}
                        editable={!submitting}
                      />
                      <TouchableOpacity
                        style={[
                          styles.answerButton,
                          (!answerTexts[question.id]?.trim() || submitting) &&
                            styles.answerButtonDisabled,
                        ]}
                        onPress={() => handleSubmitAnswer(question.id)}
                        disabled={
                          !answerTexts[question.id]?.trim() || submitting
                        }
                        activeOpacity={0.7}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="send" size={14} color="#FFFFFF" />
                            <Text style={styles.answerButtonText}>
                              {submitting ? "Enviando..." : "Responder"}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 0,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.GRAY,
  },
  inputContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    minHeight: 44,
    maxHeight: 100,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    minWidth: 80,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.GRAY_MEDIUM,
    opacity: 0.6,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  errorContainer: {
    padding: 20,
    backgroundColor: COLORS.RED_LIGHT,
    borderRadius: 8,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 14,
    textAlign: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
  },
  questionsList: {
    maxHeight: 400,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  questionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  questionAuthor: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  userBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: COLORS.GREEN_LIGHT,
  },
  userBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.SUCCESS,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  questionText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    lineHeight: 20,
    marginBottom: 8,
  },
  questionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  questionInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  questionDate: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  answerCount: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  answersSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  answersList: {
    gap: 12,
    marginBottom: 12,
  },
  answerCard: {
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 8,
    padding: 12,
    marginLeft: 16,
  },
  answerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  answerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  answerAuthor: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  answerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: COLORS.BLUE_LIGHT,
  },
  answerBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  answerText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    lineHeight: 20,
    marginBottom: 8,
  },
  answerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  answerDate: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  answerInputContainer: {
    marginTop: 8,
    gap: 8,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    minHeight: 60,
    maxHeight: 120,
  },
  answerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  answerButtonDisabled: {
    backgroundColor: COLORS.GRAY_MEDIUM,
    opacity: 0.6,
  },
  answerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  editContainer: {
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    minHeight: 80,
    maxHeight: 150,
    marginBottom: 8,
  },
  editButtons: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  cancelButton: {
    backgroundColor: COLORS.GRAY,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
