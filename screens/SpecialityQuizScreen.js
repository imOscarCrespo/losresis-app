import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import {
  getQuizQuestions,
  startQuizSession,
  saveQuizAnswer,
  finishQuizSession,
  getQuizHistoryForUser,
} from "../services/specialityQuizService";
import posthogLogger from "../services/posthogService";

const DIMENSION_WEIGHTS = {
  block_1_orientacion_cognitiva: 1.5,
  block_2_relacion_medico_paciente: 1.5,
  block_3_tolerancia_estres_entorno: 1.3,
  block_4_estilo_vida_equilibrio: 1.3,
  block_5_personalidad_profesional: 1.0,
  block_6_motivaciones_valores: 1.0,
  block_7_orientacion_academica: 1.0,
};

const PROFILE_DEFINITIONS = {
  1: {
    speciality_key: "perfil_a_diagnostico_analitico",
    profile_letter: "A",
    name: "Diagnóstico / Analítico",
    category: "diagnostico_analitico",
    shortDescription: "Razonamiento clínico complejo y profundidad diagnóstica.",
    description:
      "Disfrutas desentrañando casos complejos, profundizando en mecanismos fisiopatológicos y afinando el juicio clínico con información detallada.",
    relatedSpecialities: [
      "Medicina Interna",
      "Neurología",
      "Reumatología",
      "Nefrología",
      "Neumología",
      "Enfermedades Infecciosas",
    ],
    tone: {
      background: "#EEF2FF",
      badge: "#4F46E5",
      accent: "#312E81",
    },
  },
  2: {
    speciality_key: "perfil_b_procedimental_tecnico",
    profile_letter: "B",
    name: "Procedimental / Técnico",
    category: "procedimental_tecnico",
    shortDescription: "Acción directa, decisión rápida y destreza manual.",
    description:
      "Tiendes a disfrutar los entornos intensos, los procedimientos exigentes y la resolución inmediata de problemas clínicos concretos.",
    relatedSpecialities: [
      "Cirugía General",
      "Traumatología",
      "Neurocirugía",
      "Cirugía Cardiovascular",
      "Urología",
      "Cardiología Intervencionista",
    ],
    tone: {
      background: "#ECFDF5",
      badge: "#059669",
      accent: "#064E3B",
    },
  },
  3: {
    speciality_key: "perfil_c_relacional_humanista",
    profile_letter: "C",
    name: "Relacional / Humanista",
    category: "relacional_humanista",
    shortDescription: "Relación longitudinal, acompañamiento y continuidad.",
    description:
      "Tu motivación principal parece estar en el vínculo con pacientes, la continuidad asistencial y el acompañamiento en procesos humanos complejos.",
    relatedSpecialities: [
      "Medicina de Familia",
      "Pediatría",
      "Geriatría",
      "Psiquiatría",
      "Cuidados Paliativos",
      "Oncología Médica",
    ],
    tone: {
      background: "#FFF7ED",
      badge: "#EA580C",
      accent: "#9A3412",
    },
  },
  4: {
    speciality_key: "perfil_d_academico_innovador",
    profile_letter: "D",
    name: "Académico / Innovador",
    category: "academico_innovador",
    shortDescription: "Investigación, docencia, innovación y sistemas.",
    description:
      "Te atraen la mejora estructural, la investigación, la docencia y los contextos donde se generan nuevas ideas, técnicas o modelos de atención.",
    relatedSpecialities: [
      "Medicina Preventiva",
      "Salud Pública",
      "Farmacología Clínica",
      "Genética",
      "Medicina Nuclear",
    ],
    tone: {
      background: "#F5F3FF",
      badge: "#7C3AED",
      accent: "#4C1D95",
    },
  },
};

const PROFILE_ORDER = [1, 2, 3, 4];
const PRIMARY = "#670CF5";
const INDIGO = "#1B0977";

const getDefinitionLabel = (definitionIndex) => {
  if (definitionIndex >= 4) return "Muy definido";
  if (definitionIndex >= 2) return "Bastante definido";
  if (definitionIndex >= 1) return "Mixto";
  return "Muy mixto";
};

const sortQuestionOptions = (question) => {
  const options = Array.isArray(question?.options) ? [...question.options] : [];
  return options.sort((a, b) => a.order_index - b.order_index);
};

const buildQuizResults = (questions, allAnswers) => {
  const weightedScores = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
  const rawCounts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };

  let totalWeightedPoints = 0;

  questions.forEach((question) => {
    const selectedValue = allAnswers[question.id];
    if (!PROFILE_DEFINITIONS[selectedValue]) return;

    const weight = DIMENSION_WEIGHTS[question.dimension] || 1;
    weightedScores[selectedValue] += weight;
    rawCounts[selectedValue] += 1;
    totalWeightedPoints += weight;
  });

  const sortedProfiles = PROFILE_ORDER.map((value) => {
    const definition = PROFILE_DEFINITIONS[value];
    const weightedScore = weightedScores[value];
    const rawCount = rawCounts[value];
    const matchPercent = totalWeightedPoints
      ? Math.round((weightedScore / totalWeightedPoints) * 100)
      : 0;

    return {
      ...definition,
      value,
      weighted_score: Number(weightedScore.toFixed(2)),
      raw_count: rawCount,
      score: Number(weightedScore.toFixed(2)),
      match_percent: matchPercent,
    };
  }).sort((a, b) => b.weighted_score - a.weighted_score);

  const dominant = sortedProfiles[0] || null;
  const secondary = sortedProfiles[1] || null;
  const definitionIndex = dominant && secondary
    ? Number((dominant.weighted_score - secondary.weighted_score).toFixed(2))
    : 0;

  const summary = {
    dominant_profile: dominant,
    secondary_profile: secondary,
    definition_index: definitionIndex,
    definition_label: getDefinitionLabel(definitionIndex),
    total_weighted_points: Number(totalWeightedPoints.toFixed(2)),
  };

  const rawScores = {
    weighted_scores: weightedScores,
    raw_counts: rawCounts,
    summary,
  };

  return {
    topResults: sortedProfiles.slice(0, 3),
    rawScores,
    summary,
  };
};

const getDimensionLabel = (dimension) => {
  switch (dimension) {
    case "block_1_orientacion_cognitiva":
      return "Orientación cognitiva";
    case "block_2_relacion_medico_paciente":
      return "Relación médico-paciente";
    case "block_3_tolerancia_estres_entorno":
      return "Estrés y entorno";
    case "block_4_estilo_vida_equilibrio":
      return "Estilo de vida";
    case "block_5_personalidad_profesional":
      return "Personalidad profesional";
    case "block_6_motivaciones_valores":
      return "Motivaciones y valores";
    case "block_7_orientacion_academica":
      return "Orientación académica";
    default:
      return dimension?.replaceAll("_", " ") || "Bloque";
  }
};

export default function SpecialityQuizScreen({ userProfile }) {
  const userId = userProfile?.id;

  const [step, setStep] = useState("welcome");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const [questionsRes, historyRes] = await Promise.all([
          getQuizQuestions(),
          userId
            ? getQuizHistoryForUser(userId, 3)
            : Promise.resolve({ success: true, data: [] }),
        ]);

        if (questionsRes.success && Array.isArray(questionsRes.data)) {
          const sortedQuestions = [...questionsRes.data]
            .map((question) => ({
              ...question,
              options: sortQuestionOptions(question),
            }))
            .sort((a, b) => a.order_index - b.order_index);

          if (isMounted) {
            setQuestions(sortedQuestions);
          }
        } else {
          console.error(
            "Error al cargar preguntas:",
            questionsRes.error || "Respuesta inválida"
          );
        }

        if (historyRes.success && Array.isArray(historyRes.data)) {
          const compatibleHistory = historyRes.data.filter(
            (session) =>
              session?.meta?.version === "v2_profiles_abcd" ||
              !!session?.raw_scores?.summary
          );
          if (isMounted) {
            setHistory(compatibleHistory);
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

    posthogLogger.logScreen("SpecialityQuizScreen");
    loadData();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] || null;

  const progress = useMemo(() => {
    if (!totalQuestions) return 0;
    return ((currentIndex + 1) / totalQuestions) * 100;
  }, [currentIndex, totalQuestions]);

  const handleStart = async () => {
    try {
      setSubmitting(true);
      const { success, data, error } = await startQuizSession(userId, {
        version: "v2_profiles_abcd",
      });

      if (!success || !data) {
        console.error("No se pudo iniciar la sesión de test:", error);
        return;
      }

      setSessionId(data.id);
      setStep("questions");
      setCurrentIndex(0);
      setAnswers({});
      setResults(null);
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
      saveQuizAnswer(sessionId, questionId, value).catch((error) => {
        console.error("Error guardando respuesta del test:", error);
      });
    }

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    handleFinish(newAnswers);
  };

  const handleFinish = async (allAnswers) => {
    try {
      setSubmitting(true);
      const builtResults = buildQuizResults(questions, allAnswers);
      setResults(builtResults);

      if (sessionId) {
        await finishQuizSession(
          sessionId,
          builtResults.topResults,
          builtResults.rawScores
        );
      }

      setStep("results");
    } catch (error) {
      console.error("Error finalizando test de especialidad:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackFromQuestions = () => {
    if (currentIndex === 0) {
      setStep("welcome");
      return;
    }
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleBackFromResults = () => {
    setStep("welcome");
    setCurrentIndex(0);
    setAnswers({});
    setSessionId(null);
    setResults(null);
  };

  const handleOpenHistorySession = (session) => {
    const topResults = Array.isArray(session.top_results) ? session.top_results : [];
    if (!topResults.length) return;

    const summary = session.raw_scores?.summary || null;

    setResults({
      topResults,
      rawScores: session.raw_scores || {},
      summary,
    });
    setStep("results");
  };

  const renderWelcome = () => (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.headerShell}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Test de orientación MIR</Text>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles-outline" size={18} color={PRIMARY} />
          </View>
        </View>
      </View>

      <View style={styles.contentSurface}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInner}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Orientación de especialidad</Text>
              <Text style={styles.heroTitle}>
                Descubre qué perfil MIR encaja más contigo
              </Text>
              <Text style={styles.heroText}>
                Responde 28 preguntas y te mostraremos tu perfil dominante, tu
                perfil secundario y las especialidades más afines.
              </Text>

              <View style={styles.progressHeader}>
                <Text style={styles.progressHeaderLabel}>Duración estimada</Text>
                <Text style={styles.progressHeaderValue}>3-4 min</Text>
              </View>

              <View style={styles.stepBadgeRow}>
                <View style={styles.stepBadge}>
                  <Ionicons name="analytics-outline" size={14} color={PRIMARY} />
                  <Text style={styles.stepBadgeText}>Perfiles A/B/C/D</Text>
                </View>
                <View style={styles.stepBadge}>
                  <Ionicons name="git-compare-outline" size={14} color={PRIMARY} />
                  <Text style={styles.stepBadgeText}>Perfil dominante</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryAction,
                  (submitting || !userId) && styles.primaryActionDisabled,
                ]}
                onPress={handleStart}
                disabled={submitting || !userId}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionText}>Empezar test</Text>
                )}
              </TouchableOpacity>

              {!userId && (
                <Text style={styles.heroSupportText}>
                  Inicia sesión como estudiante para guardar tus resultados.
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Qué vas a obtener</Text>
              <View style={styles.featureList}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={PRIMARY} />
                  <Text style={styles.featureText}>Perfil dominante y perfil secundario.</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={PRIMARY} />
                  <Text style={styles.featureText}>Índice de definición para ver si tu perfil es mixto o claro.</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={PRIMARY} />
                  <Text style={styles.featureText}>Especialidades afines según tu resultado.</Text>
                </View>
              </View>
            </View>

            {userId && history.length > 0 && (
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionBar} />
                  <Text style={styles.sectionTitle}>Tus tests anteriores</Text>
                </View>
                {history.map((session) => {
                  const date = session.started_at ? new Date(session.started_at) : null;
                  const dateLabel = date
                    ? date.toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Fecha desconocida";

                  const top = Array.isArray(session.top_results) ? session.top_results : [];
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
                            <Text style={styles.historyBadgeText}>Completado</Text>
                          </View>
                        )}
                      </View>
                      {first ? (
                        <Text style={styles.historyMain}>
                          Dominante: {first.name}
                          {second ? ` · Secundario: ${second.name}` : ""}
                        </Text>
                      ) : (
                        <Text style={styles.historyEmpty}>
                          Test sin resultados guardados
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );

  const renderQuestionOptions = (question) => {
    const options = Array.isArray(question?.options) ? question.options : [];
    const selectedValue = answers[question.id];

    return (
      <View style={styles.optionsList}>
        {options.map((option) => {
          const profile = PROFILE_DEFINITIONS[option.value];
          const isSelected = selectedValue === option.value;

          return (
            <TouchableOpacity
              key={option.id || `${question.id}-${option.order_index}`}
              style={[
                styles.optionCard,
                isSelected && styles.optionCardSelected,
              ]}
              onPress={() => handleAnswer(option.value)}
              activeOpacity={0.85}
            >
              <View style={styles.optionHeader}>
                <View
                  style={[
                    styles.optionLetterBadge,
                    isSelected && styles.optionLetterBadgeSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLetterText,
                      isSelected && styles.optionLetterTextSelected,
                    ]}
                  >
                    {profile?.profile_letter || option.order_index}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderQuestion = () => {
    if (!currentQuestion) {
      return (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      );
    }

    const isLast = currentIndex === totalQuestions - 1;

    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.headerShell}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackFromQuestions}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={INDIGO} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Test de orientación MIR</Text>
            <View style={styles.headerCounter}>
              <Text style={styles.headerCounterText}>
                {currentIndex + 1}/{totalQuestions || "?"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.contentSurface}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentInner}>
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>
                  {getDimensionLabel(currentQuestion.dimension)}
                </Text>
                <Text style={styles.heroTitle}>Pregunta {currentIndex + 1}</Text>
                <Text style={styles.heroText}>
                  {isLast
                    ? "Última pregunta. Al responderla calcularemos tu perfil dominante."
                    : "Selecciona la opción que mejor refleje tu preferencia."}
                </Text>

                <View style={styles.progressHeader}>
                  <Text style={styles.progressHeaderLabel}>Progreso</Text>
                  <Text style={styles.progressHeaderValue}>{Math.round(progress)}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{currentQuestion.text}</Text>
                {renderQuestionOptions(currentQuestion)}
                <Text style={styles.helperText}>
                  Puedes cambiar tus respuestas volviendo atrás.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  };

  const renderProfileCard = (item, index) => {
    const tone = item.tone || PROFILE_DEFINITIONS[item.value]?.tone;
    const relatedSpecialities = Array.isArray(item.relatedSpecialities)
      ? item.relatedSpecialities
      : [];

    return (
      <View
        key={item.speciality_key || item.name || index}
        style={[styles.resultCard, { backgroundColor: tone?.background || "#FFF" }]}
      >
        <View style={styles.resultTopRow}>
          <View
            style={[
              styles.rankCircle,
              { backgroundColor: tone?.badge || COLORS.PRIMARY },
            ]}
          >
            <Text style={styles.rankText}>{item.profile_letter || index + 1}</Text>
          </View>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: tone?.badge || COLORS.PRIMARY },
            ]}
          >
            <Text style={styles.categoryBadgeText}>
              {index === 0 ? "Dominante" : index === 1 ? "Secundario" : "Complementario"}
            </Text>
          </View>
        </View>

        <Text style={[styles.resultName, { color: tone?.accent || "#111827" }]}>
          {item.name}
        </Text>

        <View style={styles.matchRow}>
          <Text style={styles.matchLabel}>Peso acumulado</Text>
          <Text style={styles.matchValue}>{item.match_percent || 0}%</Text>
        </View>
        <View style={styles.matchBarBackground}>
          <View
            style={[
              styles.matchBarFill,
              {
                width: `${item.match_percent || 0}%`,
                backgroundColor: tone?.badge || COLORS.PRIMARY,
              },
            ]}
          />
        </View>

        {!!item.shortDescription && (
          <Text style={styles.resultIntro}>{item.shortDescription}</Text>
        )}
        {!!item.description && (
          <Text style={styles.resultDescription}>{item.description}</Text>
        )}
        {relatedSpecialities.length > 0 && (
          <Text style={styles.relatedSpecialities}>
            Especialidades afines: {relatedSpecialities.join(", ")}.
          </Text>
        )}
      </View>
    );
  };

  const renderResults = () => {
    const top = results?.topResults || [];
    const summary = results?.summary || results?.rawScores?.summary || null;

    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.headerShell}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackFromResults}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={INDIGO} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tu perfil MIR</Text>
            <View style={styles.headerIcon}>
              <Ionicons name="analytics-outline" size={18} color={PRIMARY} />
            </View>
          </View>
        </View>

        <View style={styles.contentSurface}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentInner}>
              {summary?.dominant_profile && (
                <View style={styles.heroCard}>
                  <Text style={styles.heroEyebrow}>Resultado principal</Text>
                  <Text style={styles.heroTitle}>
                    Perfil dominante: {summary.dominant_profile.name}
                  </Text>
                  {summary?.secondary_profile && (
                    <Text style={styles.heroText}>
                      Perfil secundario: {summary.secondary_profile.name}
                    </Text>
                  )}
                  <View style={styles.summaryMetaRow}>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryPillText}>
                        Índice {summary?.definition_index ?? 0}
                      </Text>
                    </View>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryPillText}>
                        {summary?.definition_label || "Sin definir"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {top.length > 0 && (
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionBar} />
                  <Text style={styles.sectionTitle}>Perfiles relacionados</Text>
                </View>
              )}

              {top.map((item, index) => renderProfileCard(item, index))}

              {!top.length && (
                <View style={styles.card}>
                  <Text style={styles.infoText}>
                    No hemos podido calcular resultados. Repite el test.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
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
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerShell: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F3FF",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: INDIGO,
  },
  headerCounter: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F5F3FF",
  },
  headerCounterText: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  contentSurface: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: INDIGO,
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  progressHeaderLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  progressHeaderValue: {
    fontSize: 13,
    fontWeight: "800",
    color: PRIMARY,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E9D5FF",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: PRIMARY,
  },
  heroSupportText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  stepBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  stepBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: INDIGO,
  },
  primaryAction: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryActionDisabled: {
    opacity: 0.6,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: INDIGO,
  },
  featureList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
    textAlign: "center",
  },
  historyItem: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#166534",
  },
  historyMain: {
    fontSize: 15,
    lineHeight: 22,
    color: "#111827",
    fontWeight: "600",
  },
  historyEmpty: {
    fontSize: 14,
    color: "#6B7280",
  },
  optionsList: {
    gap: 10,
    marginTop: 14,
  },
  optionCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    backgroundColor: "#FFFFFF",
  },
  optionCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: "#F5F3FF",
  },
  optionHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  optionLetterBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  optionLetterBadgeSelected: {
    backgroundColor: PRIMARY,
  },
  optionLetterText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
  },
  optionLetterTextSelected: {
    color: "#FFFFFF",
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#111827",
    fontWeight: "600",
  },
  optionTextSelected: {
    color: "#2E1065",
  },
  helperText: {
    marginTop: 18,
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
  },
  summaryMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F5F3FF",
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
  },
  resultCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  resultTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  rankCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  categoryBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  resultName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    marginBottom: 14,
  },
  matchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  matchLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  matchValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  matchBarBackground: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
    marginBottom: 14,
  },
  matchBarFill: {
    height: 8,
    borderRadius: 999,
  },
  resultIntro: {
    fontSize: 15,
    lineHeight: 22,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 8,
  },
  resultDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: "#374151",
  },
  relatedSpecialities: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: "#374151",
    fontWeight: "600",
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
  },
});
