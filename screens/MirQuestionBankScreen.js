import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { Icon } from "../components/Icon";
import { SelectFilter } from "../components/SelectFilter";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";
import {
  getMirDrillPool,
  getMirFilterOptions,
  getMirQuestion,
  getMirQuestionRanking,
  getMirReviewLists,
  getMirUserSummary,
  pickNextFromPool,
  saveMirQuestionNote,
  setMirQuestionImportant,
  submitMirAnswer,
} from "../services/mirQuestionBankService";

const PRIMARY = COLORS.PRIMARY;
const SUCCESS = "#10B981";
const DANGER = "#EF4444";

const ATTRIBUTION =
  "Preguntas del examen MIR · Ministerio de Sanidad (España). Fuentes: MIR_AI_F29 (MIT) y antidote-casimedicos (CC0).";

const TABS = [
  { key: "drill", label: "Practicar", icon: "school-outline" },
  { key: "review", label: "Repaso", icon: "bookmark-outline" },
  { key: "ranking", label: "Ranking", icon: "sparkles-outline" },
];

const REVIEW_FILTERS = [
  { key: "important", label: "Importantes", icon: "star-outline" },
  { key: "note", label: "Con nota", icon: "create-outline" },
  { key: "failed", label: "Falladas", icon: "close-circle" },
];

export default function MirQuestionBankScreen({ userProfile, onBack }) {
  const userId = userProfile?.id;

  const [activeTab, setActiveTab] = useState("drill");
  const [filterOptions, setFilterOptions] = useState({ specialties: [], years: [] });
  const [specialty, setSpecialty] = useState(null);
  const [examYear, setExamYear] = useState(null);

  // Pool del drill: se carga una vez por cambio de filtro; la elección de la
  // siguiente pregunta es local (menos egress y sin repetir hasta agotar).
  const [pool, setPool] = useState({ candidateIds: [], answeredAt: {} });

  // Pregunta en curso (drill o re-práctica desde Repaso).
  const [current, setCurrent] = useState(null);
  const [poolInfo, setPoolInfo] = useState({ total: 0, answered: 0, roundCompleted: false });
  const [mode, setMode] = useState("drill");
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [isImportant, setIsImportant] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const [reviewLists, setReviewLists] = useState({ important: [], withNote: [], failed: [] });
  const [reviewFilter, setReviewFilter] = useState("important");
  const [loadingReview, setLoadingReview] = useState(false);
  const [summary, setSummary] = useState(null);

  const [ranking, setRanking] = useState({ hardest: [], easiest: [] });
  const [rankingMode, setRankingMode] = useState("hardest");
  const [loadingRanking, setLoadingRanking] = useState(false);
  // Detalle de solo lectura al pulsar una fila del ranking (no registra intento).
  const [rankingDetail, setRankingDetail] = useState(null);
  const [loadingRankingDetail, setLoadingRankingDetail] = useState(false);

  useEffect(() => {
    posthogLogger.logScreen("MirQuestionBankScreen");
    posthogLogger.capture("mir_question_bank_opened");
    getMirFilterOptions().then((res) => {
      if (res.success) setFilterOptions({ specialties: res.specialties, years: res.years });
    });
  }, []);

  const resetQuestionUi = () => {
    setSelectedOption(null);
    setAnswerResult(null);
    setNoteDraft("");
    setNoteSaved(false);
    setIsImportant(false);
  };

  const applyQuestionPayload = (question, state) => {
    setCurrent(question);
    setIsImportant(Boolean(state?.is_important));
    setNoteDraft(state?.note || "");
  };

  const serveFromPool = useCallback(
    async (candidateIds, answeredAt) => {
      setLoadingQuestion(true);
      resetQuestionUi();
      setMode("drill");

      const pick = pickNextFromPool(candidateIds, answeredAt);
      setPoolInfo({
        total: candidateIds.length,
        answered: pick.answeredInPool,
        roundCompleted: pick.roundCompleted,
      });

      if (!pick.questionId) {
        setCurrent(null);
        setLoadingQuestion(false);
        return;
      }

      const res = await getMirQuestion(userId, pick.questionId);
      if (res.success) {
        applyQuestionPayload(res.question, res.state);
      } else {
        setCurrent(null);
      }
      setLoadingQuestion(false);
    },
    [userId]
  );

  const loadDrillPool = useCallback(
    async (filters) => {
      if (!userId) return;
      setLoadingQuestion(true);
      const res = await getMirDrillPool(userId, filters);
      if (!res.success) {
        setCurrent(null);
        setLoadingQuestion(false);
        return;
      }
      setPool({ candidateIds: res.candidateIds, answeredAt: res.answeredAt });
      await serveFromPool(res.candidateIds, res.answeredAt);
    },
    [userId, serveFromPool]
  );

  useEffect(() => {
    loadDrillPool({ specialty, examYear });
  }, [loadDrillPool, specialty, examYear]);

  const loadNextDrillQuestion = useCallback(() => {
    serveFromPool(pool.candidateIds, pool.answeredAt);
  }, [serveFromPool, pool]);

  const loadReviewData = useCallback(async () => {
    if (!userId) return;
    setLoadingReview(true);
    const [lists, userSummary] = await Promise.all([
      getMirReviewLists(userId),
      getMirUserSummary(userId),
    ]);
    if (lists.success) {
      setReviewLists(lists);
      // Si la lista activa esta vacia, saltar a la primera con contenido para
      // que el usuario no aterrice en una pestana vacia y crea que no funciona.
      setReviewFilter((prev) => {
        const byKey = {
          important: lists.important,
          note: lists.withNote,
          failed: lists.failed,
        };
        if (byKey[prev].length > 0) return prev;
        const firstWithContent = REVIEW_FILTERS.find((f) => byKey[f.key].length > 0);
        return firstWithContent ? firstWithContent.key : prev;
      });
    }
    if (userSummary.success) setSummary(userSummary);
    setLoadingReview(false);
  }, [userId]);

  useEffect(() => {
    if (activeTab === "review" && !mode.startsWith("review")) loadReviewData();
    if (activeTab === "ranking") {
      setLoadingRanking(true);
      getMirQuestionRanking().then((res) => {
        if (res.success) setRanking({ hardest: res.hardest, easiest: res.easiest });
        setLoadingRanking(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const openReviewQuestion = async (questionId) => {
    posthogLogger.capture("mir_question_bank_review_question_opened", {
      list: reviewFilter,
    });
    setLoadingQuestion(true);
    resetQuestionUi();
    setMode("review");
    const res = await getMirQuestion(userId, questionId);
    if (res.success) applyQuestionPayload(res.question, res.state);
    setLoadingQuestion(false);
  };

  const closeReviewQuestion = () => {
    setMode("drill");
    resetQuestionUi();
    setCurrent(null);
    loadReviewData();
    loadNextDrillQuestion();
  };

  const handleAnswer = async (position) => {
    if (answerResult || submitting || !current) return;
    setSubmitting(true);
    setSelectedOption(position);

    const res = await submitMirAnswer(userId, current.id, position, mode);
    if (res.success) {
      setAnswerResult({ isCorrect: res.isCorrect });
      posthogLogger.capture("mir_question_bank_question_answered", {
        question_source_id: current.source_id,
        specialty: current.specialty,
        exam_year: current.exam_year,
        mode,
        is_correct: res.isCorrect,
        has_image: current.has_image,
        pool_total: poolInfo.total,
      });
      if (
        mode === "drill" &&
        poolInfo.total > 0 &&
        !poolInfo.roundCompleted &&
        poolInfo.answered + 1 >= poolInfo.total
      ) {
        posthogLogger.capture("mir_question_bank_round_completed", {
          specialty,
          exam_year: examYear,
          pool_total: poolInfo.total,
        });
      }
      if (mode === "drill") {
        // Reflejar la respuesta en el pool local para no repetirla en la ronda.
        setPool((prev) => ({
          ...prev,
          answeredAt: { ...prev.answeredAt, [current.id]: new Date().toISOString() },
        }));
        setPoolInfo((prev) => ({ ...prev, answered: prev.answered + 1 }));
      }
    } else {
      setSelectedOption(null);
    }
    setSubmitting(false);
  };

  const handleToggleImportant = async () => {
    if (!current) return;
    const next = !isImportant;
    setIsImportant(next);
    const res = await setMirQuestionImportant(userId, current.id, next);
    if (!res.success) {
      setIsImportant(!next);
      return;
    }
    posthogLogger.capture("mir_question_bank_question_flagged", {
      question_source_id: current.source_id,
      is_important: next,
    });
  };

  const handleSaveNote = async () => {
    if (!current) return;
    setSavingNote(true);
    const res = await saveMirQuestionNote(userId, current.id, noteDraft);
    setSavingNote(false);
    setNoteSaved(res.success);
    if (res.success) {
      posthogLogger.capture("mir_question_bank_note_saved", {
        question_source_id: current.source_id,
        note_length: noteDraft.trim().length,
        cleared: noteDraft.trim().length === 0,
      });
    }
  };

  const renderTabs = () => (
    <View style={styles.tabsRow}>
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, active && styles.tabBtnActive]}
            onPress={() => {
              if (tab.key !== activeTab) {
                posthogLogger.capture("mir_question_bank_tab_changed", { tab: tab.key });
              }
              setActiveTab(tab.key);
              if (tab.key !== "ranking") setRankingDetail(null);
              if (tab.key !== "review" && mode === "review") {
                setMode("drill");
                loadNextDrillQuestion();
              }
            }}
            activeOpacity={0.8}
          >
            <Icon name={tab.icon} size={16} color={active ? "#FFFFFF" : PRIMARY} />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderOption = (option) => {
    const answered = Boolean(answerResult);
    const isSelected = selectedOption === option.position;
    const isCorrectOption = answered && option.position === current.correct_option;
    const isWrongSelection = answered && isSelected && !isCorrectOption;

    return (
      <TouchableOpacity
        key={option.position}
        style={[
          styles.optionRow,
          isCorrectOption && styles.optionRowCorrect,
          isWrongSelection && styles.optionRowWrong,
        ]}
        onPress={() => handleAnswer(option.position)}
        disabled={answered || submitting}
        activeOpacity={0.75}
      >
        <View
          style={[
            styles.optionBullet,
            isCorrectOption && styles.optionBulletCorrect,
            isWrongSelection && styles.optionBulletWrong,
          ]}
        >
          <Text
            style={[
              styles.optionBulletText,
              (isCorrectOption || isWrongSelection) && styles.optionBulletTextAnswered,
            ]}
          >
            {option.position}
          </Text>
        </View>
        <Text style={styles.optionText}>{option.text}</Text>
        {isCorrectOption && <Icon name="checkmark-circle" size={20} color={SUCCESS} />}
        {isWrongSelection && <Icon name="close-circle" size={20} color={DANGER} />}
      </TouchableOpacity>
    );
  };

  const renderQuestionCard = () => {
    if (loadingQuestion) {
      return <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />;
    }

    if (!current) {
      return (
        <View style={styles.emptyBox}>
          <Icon name="help-circle-outline" size={36} color="#94A3B8" />
          <Text style={styles.emptyText}>
            No hay preguntas disponibles con este filtro.
          </Text>
        </View>
      );
    }

    const answered = Boolean(answerResult);

    return (
      <View style={styles.questionCard}>
        <View style={styles.questionMetaRow}>
          <View style={styles.badgesWrap}>
            {current.specialty ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{current.specialty}</Text>
              </View>
            ) : null}
            {current.exam_year ? (
              <View style={[styles.badge, styles.badgeYear]}>
                <Text style={styles.badgeText}>MIR {current.exam_year}</Text>
              </View>
            ) : null}
            {mode === "review" ? (
              <View style={[styles.badge, styles.badgeReview]}>
                <Text style={styles.badgeText}>Repaso</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={handleToggleImportant}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              isImportant ? "Quitar marca de importante" : "Marcar como importante"
            }
          >
            <Icon
              name={isImportant ? "star" : "star-outline"}
              size={24}
              color={isImportant ? "#F59E0B" : "#94A3B8"}
            />
          </TouchableOpacity>
        </View>

        {current.clinical_case ? (
          <Text style={styles.clinicalCase}>{current.clinical_case}</Text>
        ) : null}

        <Text style={styles.questionText}>{current.question}</Text>

        {current.has_image && current.image_url ? (
          <Image
            source={{ uri: current.image_url }}
            style={styles.questionImage}
            resizeMode="contain"
          />
        ) : null}

        <View style={styles.optionsWrap}>
          {(current.options || []).map((option) => renderOption(option))}
        </View>

        {answered && (
          <View
            style={[
              styles.resultBox,
              answerResult.isCorrect ? styles.resultBoxCorrect : styles.resultBoxWrong,
            ]}
          >
            <Icon
              name={answerResult.isCorrect ? "checkmark-circle" : "close-circle"}
              size={20}
              color={answerResult.isCorrect ? SUCCESS : DANGER}
            />
            <Text style={styles.resultText}>
              {answerResult.isCorrect
                ? "¡Correcta!"
                : `Incorrecta. La respuesta correcta es la ${current.correct_option}.`}
            </Text>
          </View>
        )}

        {answered && current.explanation ? (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationTitle}>Explicación</Text>
            <Text style={styles.explanationText}>{current.explanation}</Text>
          </View>
        ) : null}

        {answered && (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>Tu nota</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Apunta lo que quieras repasar de esta pregunta…"
              placeholderTextColor="#94A3B8"
              value={noteDraft}
              onChangeText={(text) => {
                setNoteDraft(text);
                setNoteSaved(false);
              }}
              multiline
            />
            <TouchableOpacity
              style={[styles.noteSaveBtn, savingNote && styles.noteSaveBtnDisabled]}
              onPress={handleSaveNote}
              disabled={savingNote}
              activeOpacity={0.8}
            >
              <Text style={styles.noteSaveText}>
                {savingNote ? "Guardando…" : noteSaved ? "Nota guardada ✓" : "Guardar nota"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {answered && mode === "drill" && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => loadNextDrillQuestion()}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Siguiente pregunta</Text>
            <Icon name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {answered && mode === "review" && (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={closeReviewQuestion}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Volver al repaso</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDrillTab = () => (
    <>
      <View style={styles.filtersRow}>
        <SelectFilter
          label="Especialidad"
          value={specialty}
          onSelect={(value) => setSpecialty(value || null)}
          options={filterOptions.specialties.map((s) => ({ value: s, label: s }))}
          placeholder="Todas"
          style={styles.filterItem}
        />
        <SelectFilter
          label="Año"
          value={examYear}
          onSelect={(value) => setExamYear(value || null)}
          options={filterOptions.years.map((y) => ({ value: y, label: `MIR ${y}` }))}
          placeholder="Todos"
          enableSearch={false}
          style={styles.filterItem}
        />
      </View>

      {poolInfo.total > 0 && (
        <Text style={styles.progressText}>
          {Math.min(poolInfo.answered, poolInfo.total)} de {poolInfo.total} respondidas
          en este filtro
        </Text>
      )}

      {poolInfo.roundCompleted && !loadingQuestion && current && (
        <View style={styles.roundBanner}>
          <Icon name="checkmark-circle" size={18} color={SUCCESS} />
          <Text style={styles.roundBannerText}>
            ¡Has respondido todas las preguntas de este filtro! Seguimos con las que
            hace más tiempo que no ves.
          </Text>
        </View>
      )}

      {renderQuestionCard()}
    </>
  );

  const reviewRowsForFilter = () => {
    if (reviewFilter === "important") return reviewLists.important;
    if (reviewFilter === "note") return reviewLists.withNote;
    return reviewLists.failed;
  };

  const renderReviewTab = () => {
    if (mode === "review") return renderQuestionCard();

    const rows = reviewRowsForFilter();

    return (
      <>
        {summary && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryValue}>{summary.answeredQuestions}</Text>
              <Text style={styles.summaryLabel}>respondidas</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={[styles.summaryValue, { color: SUCCESS }]}>
                {summary.totalCorrect}
              </Text>
              <Text style={styles.summaryLabel}>aciertos</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={[styles.summaryValue, { color: DANGER }]}>
                {summary.totalFailed}
              </Text>
              <Text style={styles.summaryLabel}>fallos</Text>
            </View>
          </View>
        )}

        <View style={styles.reviewFilterRow}>
          {REVIEW_FILTERS.map((f) => {
            const active = reviewFilter === f.key;
            const count =
              f.key === "important"
                ? reviewLists.important.length
                : f.key === "note"
                ? reviewLists.withNote.length
                : reviewLists.failed.length;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.reviewFilterChip, active && styles.reviewFilterChipActive]}
                onPress={() => setReviewFilter(f.key)}
                activeOpacity={0.8}
              >
                <Icon name={f.icon} size={14} color={active ? "#FFFFFF" : "#475569"} />
                <Text
                  style={[
                    styles.reviewFilterText,
                    active && styles.reviewFilterTextActive,
                  ]}
                >
                  {f.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loadingReview ? (
          <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="bookmark-outline" size={36} color="#94A3B8" />
            <Text style={styles.emptyText}>
              {reviewFilter === "important"
                ? "Aún no has marcado preguntas como importantes. Toca la estrella al responder una pregunta para guardarla aquí."
                : reviewFilter === "note"
                ? "Aún no has escrito notas. Después de responder una pregunta puedes apuntar lo que quieras repasar."
                : "Todavía no tienes preguntas falladas. ¡Sigue así!"}
            </Text>
          </View>
        ) : (
          rows.map((row) => (
            <TouchableOpacity
              key={row.question_id}
              style={styles.reviewCard}
              onPress={() => openReviewQuestion(row.question_id)}
              activeOpacity={0.8}
            >
              <View style={styles.reviewCardHeader}>
                <Text style={styles.reviewCardMeta}>
                  {[row.mir_questions.specialty, row.mir_questions.exam_year && `MIR ${row.mir_questions.exam_year}`]
                    .filter(Boolean)
                    .join(" · ") || "MIR"}
                </Text>
                <View style={styles.reviewCardIcons}>
                  {row.is_important && <Icon name="star" size={14} color="#F59E0B" />}
                  {row.note ? <Icon name="create-outline" size={14} color={PRIMARY} /> : null}
                  {row.times_failed > 0 && (
                    <Text style={styles.reviewFailCount}>✕{row.times_failed}</Text>
                  )}
                </View>
              </View>
              <Text style={styles.reviewCardQuestion} numberOfLines={3}>
                {row.mir_questions.question}
              </Text>
              {row.note ? (
                <Text style={styles.reviewCardNote} numberOfLines={2}>
                  📝 {row.note}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </>
    );
  };

  const openRankingDetail = async (questionId) => {
    posthogLogger.capture("mir_question_bank_ranking_question_opened", {
      list: rankingMode,
    });
    setLoadingRankingDetail(true);
    const res = await getMirQuestion(userId, questionId);
    setRankingDetail(res.success ? res.question : null);
    setLoadingRankingDetail(false);
  };

  const renderRankingDetail = () => {
    if (loadingRankingDetail) {
      return <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />;
    }
    if (!rankingDetail) return null;

    return (
      <View style={styles.questionCard}>
        <View style={styles.questionMetaRow}>
          <View style={styles.badgesWrap}>
            {rankingDetail.specialty ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{rankingDetail.specialty}</Text>
              </View>
            ) : null}
            {rankingDetail.exam_year ? (
              <View style={[styles.badge, styles.badgeYear]}>
                <Text style={styles.badgeText}>MIR {rankingDetail.exam_year}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {rankingDetail.clinical_case ? (
          <Text style={styles.clinicalCase}>{rankingDetail.clinical_case}</Text>
        ) : null}

        <Text style={styles.questionText}>{rankingDetail.question}</Text>

        {rankingDetail.has_image && rankingDetail.image_url ? (
          <Image
            source={{ uri: rankingDetail.image_url }}
            style={styles.questionImage}
            resizeMode="contain"
          />
        ) : null}

        <View style={styles.optionsWrap}>
          {(rankingDetail.options || []).map((option) => {
            const isCorrect = option.position === rankingDetail.correct_option;
            return (
              <View
                key={option.position}
                style={[styles.optionRow, isCorrect && styles.optionRowCorrect]}
              >
                <View
                  style={[styles.optionBullet, isCorrect && styles.optionBulletCorrect]}
                >
                  <Text
                    style={[
                      styles.optionBulletText,
                      isCorrect && styles.optionBulletTextAnswered,
                    ]}
                  >
                    {option.position}
                  </Text>
                </View>
                <Text style={styles.optionText}>{option.text}</Text>
                {isCorrect && (
                  <Icon name="checkmark-circle" size={20} color={SUCCESS} />
                )}
              </View>
            );
          })}
        </View>

        {rankingDetail.explanation ? (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationTitle}>Explicación</Text>
            <Text style={styles.explanationText}>{rankingDetail.explanation}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => setRankingDetail(null)}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>Volver al ranking</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRankingTab = () => {
    if (rankingDetail || loadingRankingDetail) return renderRankingDetail();

    const rows = rankingMode === "hardest" ? ranking.hardest : ranking.easiest;

    return (
      <>
        <View style={styles.reviewFilterRow}>
          <TouchableOpacity
            style={[
              styles.reviewFilterChip,
              rankingMode === "hardest" && styles.reviewFilterChipActive,
            ]}
            onPress={() => {
              setRankingMode("hardest");
              setRankingDetail(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.reviewFilterText,
                rankingMode === "hardest" && styles.reviewFilterTextActive,
              ]}
            >
              Más falladas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.reviewFilterChip,
              rankingMode === "easiest" && styles.reviewFilterChipActive,
            ]}
            onPress={() => {
              setRankingMode("easiest");
              setRankingDetail(null);
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.reviewFilterText,
                rankingMode === "easiest" && styles.reviewFilterTextActive,
              ]}
            >
              Más fáciles
            </Text>
          </TouchableOpacity>
        </View>

        {loadingRanking ? (
          <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="sparkles-outline" size={36} color="#94A3B8" />
            <Text style={styles.emptyText}>
              Aún hay pocas respuestas de la comunidad. El ranking aparecerá cuando
              haya más datos.
            </Text>
          </View>
        ) : (
          rows.map((row, index) => (
            <TouchableOpacity
              key={row.id}
              style={styles.rankingCard}
              onPress={() => openRankingDetail(row.id)}
              activeOpacity={0.8}
            >
              <View style={styles.rankingPosition}>
                <Text style={styles.rankingPositionText}>{index + 1}</Text>
              </View>
              <View style={styles.rankingBody}>
                <Text style={styles.reviewCardMeta}>
                  {[row.specialty, row.exam_year && `MIR ${row.exam_year}`]
                    .filter(Boolean)
                    .join(" · ") || "MIR"}
                </Text>
                <Text style={styles.reviewCardQuestion} numberOfLines={3}>
                  {row.question}
                </Text>
                <Text style={styles.rankingStats}>
                  {Math.round(row.failRate * 100)}% de fallos ·{" "}
                  {row.times_answered} respuestas
                </Text>
              </View>
              <View style={styles.rankingChevron}>
                <Icon name="chevron-forward" size={16} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </>
    );
  };

  return (
    <HeroScreenLayout
      title="Preguntas MIR"
      subtitle="Practica con preguntas reales de convocatorias oficiales"
      onBack={onBack}
      bottomContent={renderTabs()}
      keyboardAvoiding
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "drill" && renderDrillTab()}
        {activeTab === "review" && renderReviewTab()}
        {activeTab === "ranking" && renderRankingTab()}

        <Text style={styles.attribution}>{ATTRIBUTION}</Text>
      </ScrollView>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(103,12,245,0.08)",
  },
  tabBtnActive: {
    backgroundColor: PRIMARY,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  filtersRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterItem: {
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
  },
  roundBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  roundBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#065F46",
  },
  loader: {
    marginVertical: 40,
  },
  emptyBox: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  questionMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  badge: {
    backgroundColor: "rgba(103,12,245,0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeYear: {
    backgroundColor: "#F1F5F9",
  },
  badgeReview: {
    backgroundColor: "#FEF3C7",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  clinicalCase: {
    fontSize: 13,
    color: "#475569",
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 19,
  },
  questionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    lineHeight: 22,
    marginBottom: 12,
  },
  questionImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    marginBottom: 12,
  },
  optionsWrap: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  optionRowCorrect: {
    borderColor: SUCCESS,
    backgroundColor: "#ECFDF5",
  },
  optionRowWrong: {
    borderColor: DANGER,
    backgroundColor: "#FEF2F2",
  },
  optionBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  optionBulletCorrect: {
    backgroundColor: SUCCESS,
  },
  optionBulletWrong: {
    backgroundColor: DANGER,
  },
  optionBulletText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  optionBulletTextAnswered: {
    color: "#FFFFFF",
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
    lineHeight: 20,
  },
  resultBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  resultBoxCorrect: {
    backgroundColor: "#ECFDF5",
  },
  resultBoxWrong: {
    backgroundColor: "#FEF2F2",
  },
  resultText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  explanationBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },
  noteBox: {
    marginTop: 12,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    minHeight: 70,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
  },
  noteSaveBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(103,12,245,0.08)",
  },
  noteSaveBtnDisabled: {
    opacity: 0.6,
  },
  noteSaveText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 14,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  reviewFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  reviewFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
  },
  reviewFilterChipActive: {
    backgroundColor: PRIMARY,
  },
  reviewFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  reviewFilterTextActive: {
    color: "#FFFFFF",
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reviewCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewCardMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  reviewCardIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewFailCount: {
    fontSize: 11,
    fontWeight: "700",
    color: DANGER,
  },
  reviewCardQuestion: {
    fontSize: 13,
    color: "#0F172A",
    lineHeight: 19,
  },
  reviewCardNote: {
    fontSize: 12,
    color: "#475569",
    marginTop: 6,
    fontStyle: "italic",
  },
  rankingCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rankingPosition: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(103,12,245,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankingPositionText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
  rankingBody: {
    flex: 1,
    gap: 4,
  },
  rankingStats: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  rankingChevron: {
    alignSelf: "center",
  },
  attribution: {
    fontSize: 10,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 15,
  },
});
