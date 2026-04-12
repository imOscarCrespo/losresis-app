import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { ScreenScaffold } from "../components/ScreenScaffold";
import {
  getQuizQuestions,
  startQuizSession,
  saveQuizAnswer,
  finishQuizSession,
  getQuizHistoryForUser,
  getTopSpecialitiesForSession,
  getTopSpecialitiesForSessionV3,
  QUIZ_VERSION_V2,
  QUIZ_VERSION_V3,
} from "../services/specialityQuizService";
import posthogLogger from "../services/posthogService";
import { MotionPressable } from "../components/MotionPressable";

const DIMENSION_WEIGHTS = {
  block_1_orientacion_cognitiva: 1.5,
  block_2_relacion_medico_paciente: 1.5,
  block_3_tolerancia_estres_entorno: 1.3,
  block_4_estilo_vida_equilibrio: 1.3,
  block_5_personalidad_profesional: 1.0,
  block_6_motivaciones_valores: 1.0,
};
const CURRENT_QUIZ_VERSION = QUIZ_VERSION_V3;

const PROFILE_DEFINITIONS = {
  1: {
    speciality_key: "perfil_a_diagnostico_analitico",
    profile_letter: "A",
    name: "Diagnóstico / Analítico",
    category: "diagnostico_analitico",
    shortDescription: "Razonamiento clínico complejo y profundidad diagnóstica.",
    description:
      "Te motiva comprender mecanismos, resolver enigmas diagnósticos y analizar casos complejos.",
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
      "Te motiva la acción directa, los procedimientos técnicos y ver resultados inmediatos.",
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
      "Valoras el acompañamiento al paciente, las relaciones longitudinales y el impacto humano.",
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
      "Te atrae la investigación, la docencia, la innovación y el impacto sistémico.",
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
const RESULT_TONES = [
  {
    background: "#EEF2FF",
    badge: "#4F46E5",
    accent: "#312E81",
  },
  {
    background: "#ECFDF5",
    badge: "#059669",
    accent: "#064E3B",
  },
  {
    background: "#FFF7ED",
    badge: "#EA580C",
    accent: "#9A3412",
  },
];

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
    quiz_version: CURRENT_QUIZ_VERSION,
    scores: {
      A: Number(weightedScores[1].toFixed(2)),
      B: Number(weightedScores[2].toFixed(2)),
      C: Number(weightedScores[3].toFixed(2)),
      D: Number(weightedScores[4].toFixed(2)),
    },
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

const normalizeTopResults = (items) => {
  const rankedItems = Array.isArray(items)
    ? items
        .filter(Boolean)
        .map((item, index) => ({
          ...item,
          score: Number(item?.score || 0),
          rank: Number(item?.rank || index + 1),
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.rank - b.rank;
        })
    : [];

  if (!rankedItems.length) return [];

  const totalScore = rankedItems.reduce((sum, item) => sum + item.score, 0);
  let normalized = [];

  if (totalScore <= 0) {
    normalized = rankedItems.map((item, index) => ({
      ...item,
      percentage: index === 0 ? 34 : 33,
    }));
  } else {
    const withFractions = rankedItems.map((item) => {
      const exactPercentage = (item.score / totalScore) * 100;
      return {
        ...item,
        percentage: Math.floor(exactPercentage),
        fractional: exactPercentage - Math.floor(exactPercentage),
      };
    });

    let remainder =
      100 - withFractions.reduce((sum, item) => sum + item.percentage, 0);

    withFractions
      .sort((a, b) => {
        if (b.fractional !== a.fractional) return b.fractional - a.fractional;
        if (b.score !== a.score) return b.score - a.score;
        return a.rank - b.rank;
      })
      .forEach((item) => {
        if (remainder <= 0) return;
        item.percentage += 1;
        remainder -= 1;
      });

    normalized = withFractions.sort((a, b) => a.rank - b.rank);
  }

  return normalized.map((item, index) => ({
    ...item,
    rank: index + 1,
    percentage: Number(item.percentage || 0),
    tone: RESULT_TONES[index] || RESULT_TONES[RESULT_TONES.length - 1],
  }));
};

const buildLegacySpecialityResults = (results) => {
  const profiles = PROFILE_ORDER.map((value) => {
    const definition = PROFILE_DEFINITIONS[value];
    const weightedScore = results?.rawScores?.weighted_scores?.[value] || 0;
    const totalWeightedPoints =
      results?.rawScores?.summary?.total_weighted_points || 0;
    const matchPercent = totalWeightedPoints
      ? Math.round((weightedScore / totalWeightedPoints) * 100)
      : 0;

    return {
      ...definition,
      value,
      weighted_score: Number(weightedScore.toFixed(2)),
      match_percent: matchPercent,
    };
  }).sort((a, b) => b.weighted_score - a.weighted_score);

  const specialities = profiles.flatMap((profile) => {
    const related = Array.isArray(profile.relatedSpecialities)
      ? profile.relatedSpecialities
      : [];
    const perSpecialityScore = related.length
      ? profile.weighted_score / related.length
      : 0;

    return related.map((name) => ({
      name,
      profileName: profile.name,
      score: perSpecialityScore,
      tone: profile.tone,
    }));
  });

  const totalScore = specialities.reduce((sum, item) => sum + item.score, 0);

  return specialities
    .map((item) => ({
      ...item,
      speciality_name: item.name,
      percentage: totalScore ? Math.round((item.score / totalScore) * 100) : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
};

const isPersistedSpecialityResult = (item) =>
  !!(item?.speciality_name || item?.speciality_key);

const getResultDisplayName = (item) =>
  item?.speciality_name || item?.name || "Especialidad";

const resolveSpecialityResults = (results) => {
  const topResults = Array.isArray(results?.topResults) ? results.topResults : [];

  if (topResults.length && topResults.every(isPersistedSpecialityResult)) {
    return normalizeTopResults(topResults);
  }

  return normalizeTopResults(buildLegacySpecialityResults(results));
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
    default:
      return dimension?.replaceAll("_", " ") || "Bloque";
  }
};

export default function SpecialityQuizScreen({ userProfile, onBack }) {
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
          getQuizQuestions(CURRENT_QUIZ_VERSION),
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
              session?.meta?.version === QUIZ_VERSION_V2 ||
              session?.meta?.version === QUIZ_VERSION_V3 ||
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
  const canStartQuiz = !!userId && totalQuestions > 0;

  const progress = useMemo(() => {
    if (!totalQuestions) return 0;
    return ((currentIndex + 1) / totalQuestions) * 100;
  }, [currentIndex, totalQuestions]);

  const handleStart = async () => {
    try {
      setSubmitting(true);
      const { success, data, error } = await startQuizSession(userId, {
        version: CURRENT_QUIZ_VERSION,
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
      let persistedTopResults = [];

      if (sessionId) {
        const topSpecialitiesRes = CURRENT_QUIZ_VERSION === QUIZ_VERSION_V3
          ? await getTopSpecialitiesForSessionV3(sessionId)
          : await getTopSpecialitiesForSession(sessionId);
        if (topSpecialitiesRes.success && Array.isArray(topSpecialitiesRes.data)) {
          persistedTopResults = normalizeTopResults(topSpecialitiesRes.data);
        } else {
          console.error(
            "Error calculando top de especialidades desde Supabase:",
            topSpecialitiesRes.error || "Respuesta inválida"
          );
        }
      }

      const finalTopResults = persistedTopResults.length
        ? persistedTopResults
        : CURRENT_QUIZ_VERSION === QUIZ_VERSION_V3
          ? []
          : normalizeTopResults(buildLegacySpecialityResults(builtResults));

      if (sessionId) {
        await finishQuizSession(
          sessionId,
          finalTopResults,
          builtResults.rawScores
        );
      }

      setResults({
        ...builtResults,
        topResults: finalTopResults,
      });
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
    const hasLegacySummary = !!session.raw_scores?.summary;
    if (!topResults.length && !hasLegacySummary) return;

    const summary = session.raw_scores?.summary || null;

    setResults({
      topResults,
      rawScores: session.raw_scores || {},
      summary,
    });
    setStep("results");
  };

  const renderWelcome = () => (
    <ScreenScaffold
      style={styles.safeArea}
      header={
        <ScreenHeader
          title="Test de orientación MIR"
          onBack={onBack}
          iconName="sparkles-outline"
          compact
          variant="brand"
        />
      }
      headerShellVariant="brand"
      contentSurfaceStyle={styles.contentSurface}
    >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentInner}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Orientación de especialidad</Text>
              <Text style={styles.heroTitle}>
                Descubre las especialidades MIR más afines para ti
              </Text>
              <Text style={styles.heroText}>
                Responde 18 preguntas y te mostraremos un ranking de
                especialidades afines según tus respuestas.
              </Text>

              <View style={styles.progressHeader}>
                <Text style={styles.progressHeaderLabel}>Duración estimada</Text>
                <Text style={styles.progressHeaderValue}>2-3 min</Text>
              </View>

              <View style={styles.stepBadgeRow}>
                <View style={styles.stepBadge}>
                  <Ionicons name="medkit-outline" size={14} color={PRIMARY} />
                  <Text style={styles.stepBadgeText}>Ranking de especialidades</Text>
                </View>
                <View style={styles.stepBadge}>
                  <Ionicons name="stats-chart-outline" size={14} color={PRIMARY} />
                  <Text style={styles.stepBadgeText}>Ranking personalizado</Text>
                </View>
              </View>

              <MotionPressable
                style={[
                  styles.primaryAction,
                  (submitting || !canStartQuiz) && styles.primaryActionDisabled,
                ]}
                onPress={handleStart}
                disabled={submitting || !canStartQuiz}
                scaleTo={0.985}
                pressedOpacity={0.96}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionText}>Empezar test</Text>
                )}
              </MotionPressable>

              {!userId && (
                <Text style={styles.heroSupportText}>
                  Inicia sesión como estudiante para guardar tus resultados.
                </Text>
              )}
              {userId && !totalQuestions && !loading && (
                <Text style={styles.heroSupportText}>
                  El cuestionario todavía no está disponible. Revisa que la migración
                  nueva esté aplicada en base de datos.
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Qué vas a obtener</Text>
              <View style={styles.featureList}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={PRIMARY} />
                  <Text style={styles.featureText}>Especialidades ordenadas de mayor a menor afinidad.</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={PRIMARY} />
                  <Text style={styles.featureText}>Un orden claro de tus especialidades más afines.</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={PRIMARY} />
                  <Text style={styles.featureText}>Una lectura resumida del patrón de respuestas que explica el resultado.</Text>
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
                    <MotionPressable
                      key={session.id}
                      style={styles.historyItem}
                      pressedStyle={styles.historyItemPressed}
                      onPress={() => handleOpenHistorySession(session)}
                      scaleTo={0.985}
                      pressedOpacity={0.97}
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
                          Dominante: {getResultDisplayName(first)}
                          {second ? ` · Secundario: ${getResultDisplayName(second)}` : ""}
                        </Text>
                      ) : (
                        <Text style={styles.historyEmpty}>
                          Test sin resultados guardados
                        </Text>
                      )}
                    </MotionPressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
    </ScreenScaffold>
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
            <MotionPressable
              key={option.id || `${question.id}-${option.order_index}`}
              style={[
                styles.optionCard,
                isSelected && styles.optionCardSelected,
              ]}
              pressedStyle={styles.optionCardPressed}
              onPress={() => handleAnswer(option.value)}
              scaleTo={0.982}
              pressedOpacity={0.97}
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
            </MotionPressable>
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
      <ScreenScaffold
        style={styles.safeArea}
        header={
          <ScreenHeader
            title="Test de orientación MIR"
            onBack={handleBackFromQuestions}
            compact
            variant="brand"
            rightSlot={
              <View style={styles.headerCounter}>
                <Text style={styles.headerCounterText}>
                  {currentIndex + 1}/{totalQuestions || "?"}
                </Text>
              </View>
            }
          />
        }
        headerShellVariant="brand"
        contentSurfaceStyle={styles.contentSurface}
      >
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
                    ? "Última pregunta. Al responderla calcularemos tus especialidades más afines."
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
      </ScreenScaffold>
    );
  };

  const renderSpecialityCard = (item, index) => {
    const tone = item.tone;

    return (
      <View
        key={`${getResultDisplayName(item)}-${index}`}
        style={[styles.specialityCard, { borderColor: tone?.badge || "#E8EAF3" }]}
      >
        <View style={styles.specialityCardTopRow}>
          <View
            style={[
              styles.specialityRankBadge,
              { backgroundColor: tone?.badge || COLORS.PRIMARY },
            ]}
          >
            <Text style={styles.specialityRankText}>#{index + 1}</Text>
          </View>
        </View>

        <Text style={styles.specialityName}>{getResultDisplayName(item)}</Text>
        <Text style={styles.specialityMeta}>Encaje destacado según tu patrón de respuestas</Text>

        <View
          style={[
            styles.specialityProfilePill,
            { backgroundColor: tone?.background || "#F8FAFC" },
          ]}
        >
          <Text
            style={[
              styles.specialityProfilePillText,
              { color: tone?.accent || INDIGO },
            ]}
          >
            Top {item.rank} del resultado final
          </Text>
        </View>
      </View>
    );
  };

  const renderResults = () => {
    const top = results?.topResults || [];
    const summary = results?.summary || results?.rawScores?.summary || null;
    const specialities = resolveSpecialityResults(results);

    return (
      <ScreenScaffold
        style={styles.safeArea}
        header={
          <ScreenHeader
            title="Tus especialidades MIR"
            onBack={handleBackFromResults}
            iconName="analytics-outline"
            compact
            variant="brand"
          />
        }
        headerShellVariant="brand"
        contentSurfaceStyle={styles.contentSurface}
      >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentInner}>
              {specialities.length > 0 && (
                <View style={styles.heroCard}>
                  <Text style={styles.heroEyebrow}>Resultado del test</Text>
                  <Text style={styles.heroTitle}>Especialidades más afines para ti</Text>
                  <Text style={styles.heroText}>
                    Este ranking resume qué especialidades encajan mejor con tus
                    respuestas.
                  </Text>
                  {specialities[0] && (
                    <View style={styles.topRecommendationCard}>
                      <Text style={styles.topRecommendationLabel}>Mejor encaje</Text>
                      <View style={styles.topRecommendationRow}>
                        <Text style={styles.topRecommendationName}>
                          {getResultDisplayName(specialities[0])}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {specialities.length > 0 && (
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionBar} />
                  <Text style={styles.sectionTitle}>Ranking de especialidades</Text>
                </View>
              )}

              {specialities.map((item, index) => renderSpecialityCard(item, index))}

              {!!summary?.dominant_profile && top.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.secondarySectionTitle}>Lectura del resultado</Text>
                  <Text style={styles.secondarySectionText}>
                    Tu patrón de respuestas se acerca más al perfil{" "}
                    {summary.dominant_profile.name}
                    {summary?.secondary_profile
                      ? `, con influencia secundaria de ${summary.secondary_profile.name}.`
                      : "."}
                  </Text>
                </View>
              )}

              {!specialities.length && (
                <View style={styles.card}>
                  <Text style={styles.infoText}>
                    No hemos podido calcular resultados. Repite el test.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
      </ScreenScaffold>
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
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerCounter: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  headerCounterText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  contentSurface: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
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
  historyItemPressed: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
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
  optionCardPressed: {
    backgroundColor: "#F8FAFF",
    borderColor: "#C7D2FE",
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
  topRecommendationCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  topRecommendationLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  topRecommendationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  topRecommendationName: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: INDIGO,
  },
  topRecommendationProbability: {
    fontSize: 24,
    fontWeight: "900",
    color: PRIMARY,
  },
  specialityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
  },
  specialityCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  specialityRankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  specialityRankText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  specialityProbability: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
  },
  specialityName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: INDIGO,
    marginBottom: 6,
  },
  specialityMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    marginBottom: 12,
  },
  specialityProfilePill: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  specialityProfilePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  secondarySectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: INDIGO,
    marginBottom: 8,
  },
  secondarySectionText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#475569",
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
