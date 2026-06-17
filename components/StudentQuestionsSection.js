import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { Icon } from "./Icon";
import { useStudentQuestions } from "../hooks/useStudentQuestions";
import { formatLongDate } from "../utils/dateUtils";
import { COLORS } from "../constants/colors";
import { KeyboardAwareTextInput } from "./KeyboardAwareTextInput";

/**
 * Componente de preguntas de estudiantes
 * Basado en la estructura del componente web
 */
export const StudentQuestionsSection = ({
  hospitalId,
  specialityId,
  userProfile,
  onInputFocus,
  onInputBlur,
  highlightedQuestionId = null,
  onHighlightedQuestionHandled,
}) => {
  const [newQuestion, setNewQuestion] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState([]);
  const [answerTexts, setAnswerTexts] = useState({});
  const [canAnswer, setCanAnswer] = useState(false);

  // Estados para editar
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingAnswer, setEditingAnswer] = useState(null);
  const [editText, setEditText] = useState("");

  const [questionsListHeight, setQuestionsListHeight] = useState(0);

  const questionsListRef = useRef(null);
  const questionLayoutsRef = useRef({});

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

  const scrollQuestionIntoView = useCallback(
    (questionId, animated = true) => {
      const layout = questionLayoutsRef.current[questionId];

      if (!layout) {
        questionsListRef.current?.scrollToEnd({ animated });
        return;
      }

      const topMargin = 12;
      const bottomMargin = 20;
      const questionBottom = layout.y + layout.height + bottomMargin;
      const visibleHeight = Math.max(questionsListHeight, 0);
      const targetY =
        visibleHeight > 0
          ? Math.max(questionBottom - visibleHeight, layout.y - topMargin, 0)
          : Math.max(layout.y - topMargin, 0);

      questionsListRef.current?.scrollTo({ y: targetY, animated });
    },
    [questionsListHeight]
  );

  const handleQuestionInputFocus = useCallback(
    (questionId = null) => {
      onInputFocus?.();

      requestAnimationFrame(() => {
        if (questionId) {
          scrollQuestionIntoView(questionId, false);
          return;
        }

        questionsListRef.current?.scrollToEnd({ animated: false });
      });
    },
    [onInputFocus, scrollQuestionIntoView]
  );

  const handleQuestionInputBlur = useCallback(() => {
    onInputBlur?.();
  }, [onInputBlur]);

  useEffect(() => {
    if (!highlightedQuestionId || questions.length === 0) return;

    setExpandedQuestions((prev) =>
      prev.includes(highlightedQuestionId)
        ? prev
        : [...prev, highlightedQuestionId]
    );

    const timeoutId = setTimeout(() => {
      scrollQuestionIntoView(highlightedQuestionId, false);
      onHighlightedQuestionHandled?.();
    }, 120);

    return () => clearTimeout(timeoutId);
  }, [
    highlightedQuestionId,
    onHighlightedQuestionHandled,
    questions.length,
    scrollQuestionIntoView,
  ]);

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
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconWrap}>
              <Icon
                name="chatbubbles-outline"
                size={18}
                color={COLORS.PRIMARY}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Preguntas de estudiantes</Text>
              <Text style={styles.subtitle}>
                Resuelve dudas reales sobre esta plaza con contexto de otros
                usuarios.
              </Text>
            </View>
          </View>
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
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconWrap}>
            <Icon
              name="chatbubbles-outline"
              size={18}
              color={COLORS.PRIMARY}
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Preguntas de estudiantes</Text>
            <Text style={styles.subtitle}>
              Consulta experiencias, detalles prácticos y respuestas de
              residentes o adjuntos.
            </Text>
          </View>
        </View>
        <View style={styles.headerCountBadge}>
          <Text style={styles.headerCountText}>{questions.length}</Text>
        </View>
      </View>

      {/* Formulario para nueva pregunta - Solo estudiantes y super admins */}
      {(userProfile?.is_student || userProfile?.is_super_admin) && (
        <View style={styles.composerCard}>
          <View style={styles.composerHeader}>
            <Text style={styles.composerTitle}>Haz una nueva pregunta</Text>
            <Text style={styles.composerHint}>
              Sé concreto para recibir respuestas útiles.
            </Text>
          </View>
          <KeyboardAwareTextInput
            style={styles.input}
            placeholder="Haz una pregunta sobre esta especialidad en este hospital..."
            placeholderTextColor={COLORS.GRAY}
            value={newQuestion}
            onChangeText={setNewQuestion}
            multiline
            maxLength={500}
            editable={!submitting}
            onFocus={() => handleQuestionInputFocus()}
            onBlur={handleQuestionInputBlur}
            keyboardAwareOptions={{ extraScrollSpace: 20 }}
          />
          <View style={styles.composerFooter}>
            <Text style={styles.characterCount}>{newQuestion.length}/500</Text>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newQuestion.trim() || submitting) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={handleSubmitQuestion}
              disabled={!newQuestion.trim() || submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Enviar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Lista de preguntas */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Icon
              name="chatbubbles-outline"
              size={28}
              color={COLORS.PRIMARY}
            />
          </View>
          <Text style={styles.emptyText}>
            {userProfile?.is_student || userProfile?.is_super_admin
              ? "Aún no hay preguntas. ¡Sé el primero en preguntar!"
              : "No hay preguntas de estudiantes aún."}
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={questionsListRef}
          style={styles.questionsList}
          contentContainerStyle={styles.questionsListContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          nestedScrollEnabled
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            if (nextHeight > 0 && nextHeight !== questionsListHeight) {
              setQuestionsListHeight(nextHeight);
            }
          }}
        >
          {questions.map((question) => (
            <View
              key={question.id}
              style={[
                styles.questionCard,
                highlightedQuestionId === question.id &&
                  styles.questionCardHighlighted,
              ]}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                questionLayoutsRef.current[question.id] = { y, height };
              }}
            >
              {/* Header de la pregunta */}
              <View style={styles.questionHeader}>
                <View style={styles.questionHeaderLeft}>
                  <View style={styles.avatarBadge}>
                    <Icon name="person" size={14} color={COLORS.PRIMARY} />
                  </View>
                  <View style={styles.questionAuthorBlock}>
                    <Text style={styles.questionAuthor}>
                      {question.user?.name} {question.user?.surname}
                    </Text>
                    <View style={styles.userBadge}>
                      <Text style={styles.userBadgeText}>
                        {getUserDisplayName(question.user)}
                      </Text>
                    </View>
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
                        <Icon
                          name="pencil"
                          size={16}
                          color={COLORS.PRIMARY}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteQuestion(question.id)}
                        style={styles.actionButton}
                      >
                        <Icon name="trash" size={16} color={COLORS.ERROR} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    onPress={() => toggleQuestionExpansion(question.id)}
                    style={styles.actionButton}
                  >
                    <Icon
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
                  <KeyboardAwareTextInput
                    style={styles.editInput}
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    maxLength={500}
                    editable={!submitting}
                    onFocus={() => handleQuestionInputFocus(question.id)}
                    onBlur={handleQuestionInputBlur}
                    keyboardAwareOptions={{ extraScrollSpace: 20 }}
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
                  <Icon name="time" size={12} color={COLORS.GRAY} />
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
                              <View style={styles.answerAvatarBadge}>
                                <Icon
                                  name="school"
                                  size={14}
                                  color={COLORS.PRIMARY}
                                />
                              </View>
                              <View style={styles.answerAuthorBlock}>
                                <Text style={styles.answerAuthor}>
                                  {answer.user?.name} {answer.user?.surname}
                                </Text>
                                <View style={styles.answerBadge}>
                                  <Text style={styles.answerBadgeText}>
                                    {getUserDisplayName(answer.user)}
                                  </Text>
                                </View>
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
                                  <Icon
                                    name="pencil"
                                    size={14}
                                    color={COLORS.PRIMARY}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleDeleteAnswer(answer.id)}
                                  style={styles.actionButton}
                                >
                                  <Icon
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
                              <KeyboardAwareTextInput
                                style={styles.editInput}
                                value={editText}
                                onChangeText={setEditText}
                                multiline
                                maxLength={500}
                                editable={!submitting}
                                onFocus={() => handleQuestionInputFocus(question.id)}
                                onBlur={handleQuestionInputBlur}
                                keyboardAwareOptions={{ extraScrollSpace: 20 }}
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
                            <Icon
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
                    <View style={styles.answerComposerCard}>
                      <KeyboardAwareTextInput
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
                        onFocus={() => handleQuestionInputFocus(question.id)}
                        onBlur={handleQuestionInputBlur}
                        keyboardAwareOptions={{ extraScrollSpace: 20 }}
                      />
                      <View style={styles.composerFooter}>
                        <Text style={styles.characterCount}>
                          {(answerTexts[question.id] || "").length}/500
                        </Text>
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
                              <Icon
                                name="send"
                                size={14}
                                color="#FFFFFF"
                              />
                              <Text style={styles.answerButtonText}>
                                Responder
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
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
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    shadowColor: "#0F172A",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${COLORS.PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${COLORS.PRIMARY}18`,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
  },
  headerCountBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.PRIMARY}10`,
    borderWidth: 1,
    borderColor: `${COLORS.PRIMARY}18`,
  },
  headerCountText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.PRIMARY,
  },
  loadingContainer: {
    paddingVertical: 28,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.GRAY,
  },
  composerCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  composerHeader: {
    gap: 4,
  },
  composerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
  },
  composerHint: {
    fontSize: 13,
    color: "#667085",
    lineHeight: 18,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    minHeight: 108,
    maxHeight: 164,
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
  },
  composerFooter: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  characterCount: {
    fontSize: 12,
    color: "#98A2B3",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    minWidth: 112,
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
    padding: 16,
    backgroundColor: COLORS.RED_LIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 14,
    textAlign: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: `${COLORS.PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    lineHeight: 20,
  },
  questionsList: {
    maxHeight: 400,
  },
  questionsListContent: {
    paddingBottom: 4,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#FCFCFD",
  },
  questionCardHighlighted: {
    borderColor: COLORS.PRIMARY,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  questionHeaderLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  avatarBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${COLORS.PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${COLORS.PRIMARY}18`,
  },
  questionAuthorBlock: {
    flex: 1,
    gap: 6,
    paddingTop: 1,
  },
  questionAuthor: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
  },
  userBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
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
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F4F7",
  },
  questionText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    lineHeight: 22,
    marginBottom: 12,
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
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
  },
  answersList: {
    gap: 12,
    marginBottom: 12,
  },
  answerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  answerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  answerHeaderLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  answerAvatarBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: `${COLORS.PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${COLORS.PRIMARY}18`,
  },
  answerAuthorBlock: {
    flex: 1,
    gap: 5,
    paddingTop: 1,
  },
  answerAuthor: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
  },
  answerBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
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
    marginBottom: 10,
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
  answerComposerCard: {
    marginTop: 8,
    marginLeft: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    minHeight: 88,
    maxHeight: 140,
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
  },
  answerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    minWidth: 116,
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
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    minHeight: 80,
    maxHeight: 150,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
  },
  editButtons: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
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
