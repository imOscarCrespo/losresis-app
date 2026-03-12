import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import {
  getAllSpecialityProfiles,
  getQuizQuestions,
  startQuizSession,
  saveQuizAnswer,
  finishQuizSession,
  getQuizHistoryForUser,
} from "../services/specialityQuizService";
import posthogLogger from "../services/posthogService";

/**
 * Pantalla principal del Test de Especialidad.
 * Flujo:
 *  - Paso 1: Bienvenida
 *  - Paso 2: Preguntas (carrusel lineal)
 *  - Paso 3: Resultados (top 3 especialidades sugeridas)
 */
export default function SpecialityQuizScreen({ userProfile, onSectionChange }) {
  const userId = userProfile?.id;

  const [step, setStep] = useState("welcome"); // welcome | questions | results
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [specialityProfiles, setSpecialityProfiles] = useState([]);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);

  // Cargar definición del test al montar
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const [questionsRes, profilesRes, historyRes] = await Promise.all([
          getQuizQuestions(),
          getAllSpecialityProfiles(),
          userId
            ? getQuizHistoryForUser(userId, 3)
            : Promise.resolve({ success: true, data: [] }),
        ]);

        if (questionsRes.success && Array.isArray(questionsRes.data)) {
          const sortedQuestions = [...questionsRes.data].sort(
            (a, b) => a.order_index - b.order_index
          );
          if (isMounted) {
            setQuestions(sortedQuestions);
          }
        } else {
          console.error(
            "Error al cargar preguntas:",
            questionsRes.error || "Respuesta inválida"
          );
        }

        if (profilesRes.success && Array.isArray(profilesRes.data)) {
          if (isMounted) {
            setSpecialityProfiles(profilesRes.data);
          }
        } else {
          console.error(
            "Error al cargar perfiles de especialidad:",
            profilesRes.error || "Respuesta inválida"
          );
        }

        if (historyRes.success && Array.isArray(historyRes.data)) {
          if (isMounted) {
            setHistory(historyRes.data);
          }
        } else if (!historyRes.success) {
          console.error(
            "Error al cargar histórico de tests:",
            historyRes.error || "Respuesta inválida"
          );
        }
      } catch (error) {
        console.error("Error cargando datos del test de especialidad:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Tracking de pantalla
    posthogLogger.logScreen("SpecialityQuizScreen");
    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] || null;

  const progress = useMemo(() => {
    if (!totalQuestions) return 0;
    // +1 porque el usuario está contestando la pregunta actual
    return ((currentIndex + 1) / totalQuestions) * 100;
  }, [currentIndex, totalQuestions]);

  const handleStart = async () => {
    try {
      setSubmitting(true);
      const { success, data, error } = await startQuizSession(userId, {
        version: "v1",
      });
      if (!success || !data) {
        console.error("No se pudo iniciar la sesión de test:", error);
        return;
      }
      setSessionId(data.id);
      setStep("questions");
      setCurrentIndex(0);
      setAnswers({});
    } catch (error) {
      console.error("Error iniciando sesión de test:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = async (value) => {
    if (!currentQuestion) return;

    const questionId = currentQuestion.id;

    const newAnswers = {
      ...answers,
      [questionId]: value,
    };
    setAnswers(newAnswers);

    if (sessionId) {
      // Guardar en Supabase pero sin bloquear la UX
      saveQuizAnswer(sessionId, questionId, value).catch((error) => {
        console.error("Error guardando respuesta del test:", error);
      });
    }

    // Avanzar a la siguiente pregunta o calcular resultados
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleFinish(newAnswers);
    }
  };

  const handleBackFromQuestions = () => {
    if (currentIndex === 0) {
      setStep("welcome");
      return;
    }
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  /**
   * Heurística sencilla de scoring basada en las NUEVAS dimensiones del cuestionario.
   * No pretende ser un modelo MIR perfecto, sino una guía divertida.
   */
  const calculateScores = (allAnswers, profiles) => {
    if (!profiles || !profiles.length) return { topResults: [], rawScores: {} };

    // Reducir respuestas por dimensión (media simple 1–5)
    const dimensionValues = {};
    questions.forEach((q) => {
      const value = allAnswers[q.id];
      if (typeof value !== "number") return;
      if (!dimensionValues[q.dimension]) {
        dimensionValues[q.dimension] = { sum: 0, count: 0 };
      }
      dimensionValues[q.dimension].sum += value;
      dimensionValues[q.dimension].count += 1;
    });

    const getDim = (dim) => {
      const item = dimensionValues[dim];
      if (!item || !item.count) return 0;
      return item.sum / item.count;
    };

    // Alias de dimensiones para legibilidad
    const workLifeBalance = getDim("work_life_balance");
    const onCallTolerance = getDim("on_call_tolerance");
    const proceduralInterest = getDim("procedural_interest");
    const emergencyTolerance = getDim("emergency_tolerance");
    const researchInterest = getDim("research_interest");
    const patientRelationship = getDim("patient_relationship");
    const patientContact = getDim("patient_contact");
    const technologyInterest = getDim("technology_interest");
    const uncertaintyTolerance = getDim("uncertainty_tolerance");
    const empathyCommunication = getDim("empathy_communication");

    const rawScores = {};

    profiles.forEach((profile) => {
      let score = 0;

      // Peso base por categoría según cuestionario
      switch (profile.category) {
        case "quirurgica":
          score += proceduralInterest * 2.0;
          score += emergencyTolerance * 1.5;
          score += onCallTolerance * 1.0;
          score += (6 - workLifeBalance) * 0.5; // menos foco en WLB
          break;
        case "urgencias_criticos":
          score += emergencyTolerance * 2.0;
          score += proceduralInterest * 1.0;
          score += onCallTolerance * 1.2;
          score += (6 - workLifeBalance) * 0.8;
          break;
        case "medica":
          score += researchInterest * 1.5;
          score += uncertaintyTolerance * 1.2;
          score += patientRelationship * 1.2;
          break;
        case "atencion_primaria":
          score += patientRelationship * 2.0;
          score += workLifeBalance * 1.2;
          score += empathyCommunication * 1.0;
          break;
        case "diagnostica":
          score += researchInterest * 1.5;
          score += technologyInterest * 1.2;
          score += (6 - patientContact) * 1.0;
          break;
        case "salud_publica":
          score += workLifeBalance * 1.5;
          score += researchInterest * 1.0;
          break;
        default:
          break;
      }

      // Ajustes por especialidad concreta (ejemplos representativos)
      if (profile.speciality_key === "dermatologia") {
        score += workLifeBalance * 1.5;
      }
      if (profile.speciality_key === "medicina_urgencias") {
        score += emergencyTolerance * 2.0;
      }
      if (profile.speciality_key === "medicina_familiar") {
        score += patientRelationship * 1.8;
        score += workLifeBalance * 0.8;
      }
      if (profile.speciality_key === "cirugia_plastica") {
        score += proceduralInterest * 1.8;
        score += technologyInterest * 0.8;
      }
      if (profile.speciality_key === "medicina_preventiva_salud_publica") {
        score += researchInterest * 1.2;
      }

      rawScores[profile.speciality_key] = score;
    });

    const sorted = [...profiles]
      .map((p) => ({
        speciality_key: p.speciality_key,
        name: p.name,
        category: p.category,
        description: p.description,
        score: rawScores[p.speciality_key] || 0,
      }))
      .sort((a, b) => b.score - a.score);

    const topResults = sorted.slice(0, 3);

    return {
      topResults,
      rawScores,
    };
  };

  const handleFinish = async (allAnswers) => {
    try {
      setSubmitting(true);

      const { topResults, rawScores } = calculateScores(
        allAnswers,
        specialityProfiles
      );
      setResults({ topResults, rawScores });

      if (sessionId) {
        await finishQuizSession(sessionId, topResults, rawScores);
      }

      setStep("results");
    } catch (error) {
      console.error("Error finalizando test de especialidad:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackFromResults = () => {
    setStep("welcome");
    setCurrentIndex(0);
    setAnswers({});
    setSessionId(null);
    setResults(null);
  };

  const handleOpenHistorySession = (session) => {
    const topResults = Array.isArray(session.top_results)
      ? session.top_results
      : [];
    if (!topResults.length) return;

    setResults({
      topResults,
      rawScores: session.raw_scores || {},
    });
    setStep("results");
  };

  const handleGoToHospitals = (specialityName) => {
    if (onSectionChange) {
      onSectionChange("hospitales", {
        specialityName,
      });
    }
  };

  const renderWelcome = () => {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Test de especialidad</Text>
        </View>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.welcomeContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.welcomeCard}>
            <View style={styles.emojiRow}>
              <Text style={styles.bigEmoji}>🧠</Text>
              <Text style={styles.bigEmoji}>🩺</Text>
              <Text style={styles.bigEmoji}>⚡️</Text>
            </View>
            <Text style={styles.welcomeTitle}>
              ¿Qué especialidad encaja contigo?
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Responde unas pocas preguntas sobre cómo te ves trabajando y te
              proponemos las{" "}
              <Text style={styles.welcomeHighlight}>
                3 especialidades con más encaje
              </Text>
              .
            </Text>

            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={COLORS.PRIMARY}
                />
                <Text style={styles.chipText}>2–3 minutos</Text>
              </View>
              <View style={styles.chip}>
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={COLORS.PRIMARY}
                />
                <Text style={styles.chipText}>Basado en valores y estilo</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                submitting && styles.primaryButtonDisabled,
              ]}
              onPress={handleStart}
              disabled={submitting || !userId}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Empezar test</Text>
              )}
            </TouchableOpacity>

            {!userId && (
              <Text style={styles.infoText}>
                Inicia sesión como estudiante para guardar tus resultados y
                repetir el test cuando quieras.
              </Text>
            )}
          </View>

          {userId && history.length > 0 && (
            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>Tus tests anteriores</Text>
              {history.map((session) => {
                const date = session.started_at
                  ? new Date(session.started_at)
                  : null;
                const dateLabel = date
                  ? date.toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "Fecha desconocida";

                const top = Array.isArray(session.top_results)
                  ? session.top_results
                  : [];
                const first = top[0];
                const second = top[1];

                return (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.historyItem}
                    onPress={() => handleOpenHistorySession(session)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.historyItemHeader}>
                      <Text style={styles.historyDate}>{dateLabel}</Text>
                      {session.finished_at && (
                        <View style={styles.historyBadge}>
                          <Text style={styles.historyBadgeText}>
                            Completado
                          </Text>
                        </View>
                      )}
                    </View>
                    {first && (
                      <Text style={styles.historyMain}>
                        Top 1: {first.name}
                        {second ? ` · Top 2: ${second.name}` : ""}
                      </Text>
                    )}
                    {!first && (
                      <Text style={styles.historyEmpty}>
                        Test sin resultados guardados
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderLikertOptions = (question) => {
    const labels = ["Muy poco", "Poco", "Algo", "Bastante", "Muchísimo"];
    const selectedValue = answers[question.id];

    return (
      <View style={styles.likertRow}>
        {labels.map((label, index) => {
          const value = index + 1;
          const isSelected = selectedValue === value;
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.likertOption,
                isSelected && styles.likertOptionSelected,
              ]}
              onPress={() => handleAnswer(value)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.likertLabel,
                  isSelected && styles.likertLabelSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderEntornoOptions = (question) => {
    // Opciones específicas para la dimensión "entorno"
    const options = [
      {
        id: "alta_tecnologia",
        label: "Hospital grande y tecnología puntera",
        value: 5,
      },
      {
        id: "mixto",
        label: "Un poco de todo",
        value: 3,
      },
      {
        id: "comunitario",
        label: "Centro de salud / comunidad",
        value: 1,
      },
    ];

    const selected = answers[question.id];

    return (
      <View style={styles.entornoRow}>
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.entornoOption,
                isSelected && styles.entornoOptionSelected,
              ]}
              onPress={() => handleAnswer(opt.value)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.entornoLabel,
                  isSelected && styles.entornoLabelSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderQuestion = () => {
    if (!currentQuestion) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackFromQuestions}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Test de especialidad</Text>
          </View>
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          </View>
        </View>
      );
    }

    const isLast = currentIndex === totalQuestions - 1;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackFromQuestions}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pregunta {currentIndex + 1}</Text>
          <Text style={styles.headerSubtitle}>de {totalQuestions || "?"}</Text>
        </View>

        {/* Barra de progreso */}
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.questionContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{currentQuestion.text}</Text>

            {currentQuestion.question_type === "likert"
              ? renderLikertOptions(currentQuestion)
              : renderEntornoOptions(currentQuestion)}

            <Text style={styles.helperText}>
              {isLast
                ? "Al responder esta pregunta calcularemos tu top 3 de especialidades."
                : "Puedes cambiar tus respuestas volviendo atrás en cualquier momento."}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderResults = () => {
    const top = results?.topResults || [];

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackFromResults}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tus especialidades top</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              Hemos encontrado estas 3 especialidades que encajan especialmente
              bien contigo:
            </Text>
            <Text style={styles.resultsSubtitle}>
              No es una predicción MIR, sino una brújula basada en tus valores,
              estilo de vida y preferencias.
            </Text>
          </View>

          {top.map((item, index) => {
            const badgeLabel =
              item.category === "quirurgica"
                ? "Quirúrgica"
                : item.category === "medica"
                ? "Médica"
                : item.category === "atencion_primaria"
                ? "Atención primaria"
                : item.category === "urgencias_criticos"
                ? "Urgencias y críticos"
                : item.category === "diagnostica"
                ? "Diagnóstica"
                : "Salud pública";

            const score = item.score || 0;
            const scorePercent = Math.max(
              0,
              Math.min(100, Math.round((score / (score + 10 || 1)) * 100))
            );

            return (
              <View
                key={item.speciality_key || index}
                style={styles.resultCard}
              >
                <View style={styles.resultBadgeRow}>
                  <View style={styles.rankCircle}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{badgeLabel}</Text>
                  </View>
                </View>

                <Text style={styles.resultName}>{item.name}</Text>

                <View style={styles.matchRow}>
                  <Text style={styles.matchLabel}>Match aproximado</Text>
                  <Text style={styles.matchValue}>{scorePercent}%</Text>
                </View>
                <View style={styles.matchBarBackground}>
                  <View
                    style={[styles.matchBarFill, { width: `${scorePercent}%` }]}
                  />
                </View>

                {!!item.description && (
                  <Text style={styles.resultDescription} numberOfLines={4}>
                    {item.description}
                  </Text>
                )}

                <View style={styles.resultActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => handleGoToHospitals(item.name)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color={COLORS.PRIMARY}
                    />
                    <Text style={styles.secondaryButtonText}>
                      Ver hospitales
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {top.length === 0 && (
            <View style={styles.loadingCenter}>
              <Text style={styles.infoText}>
                No hemos podido calcular resultados. Prueba a repetir el test.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (step === "welcome") return renderWelcome();
  if (step === "questions") return renderQuestion();
  if (step === "results") return renderResults();

  return renderWelcome();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  headerSubtitle: {
    marginLeft: 6,
    fontSize: 14,
    color: "#6B7280",
  },
  content: {
    flex: 1,
  },
  welcomeContent: {
    padding: 16,
    paddingBottom: 32,
  },
  welcomeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
    gap: 8,
  },
  bigEmoji: {
    fontSize: 28,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 22,
  },
  welcomeHighlight: {
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    color: "#1D4ED8",
    fontWeight: "500",
  },
  historyCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  historyItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  historyItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 13,
    color: "#6B7280",
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#ECFDF3",
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#15803D",
  },
  historyMain: {
    fontSize: 13,
    color: "#111827",
    marginTop: 2,
  },
  historyEmpty: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  infoText: {
    marginTop: 12,
    fontSize: 13,
    color: "#6B7280",
  },
  questionContent: {
    padding: 16,
    paddingBottom: 32,
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 20,
  },
  likertRow: {
    flexDirection: "column",
    gap: 10,
  },
  likertOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#F9FAFB",
  },
  likertOptionSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: COLORS.PRIMARY,
  },
  likertLabel: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
  likertLabelSelected: {
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  entornoRow: {
    flexDirection: "column",
    gap: 10,
  },
  entornoOption: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F3F4F6",
  },
  entornoOptionSelected: {
    backgroundColor: "#DBEAFE",
  },
  entornoLabel: {
    fontSize: 14,
    color: "#111827",
  },
  entornoLabelSelected: {
    fontWeight: "600",
    color: "#1D4ED8",
  },
  helperText: {
    marginTop: 16,
    fontSize: 13,
    color: "#6B7280",
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.PRIMARY,
  },
  resultsContent: {
    padding: 16,
    paddingBottom: 32,
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  resultBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.PRIMARY,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  categoryBadgeText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "500",
  },
  resultName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  matchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  matchLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  matchValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  matchBarBackground: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginBottom: 8,
  },
  matchBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.PRIMARY,
  },
  resultDescription: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
    marginTop: 4,
  },
  resultActions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 13,
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  repeatButton: {
    marginTop: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  repeatButtonText: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: "600",
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
});
