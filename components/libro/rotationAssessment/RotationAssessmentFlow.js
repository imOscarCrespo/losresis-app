import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HeroScreenLayout } from "../../HeroScreenLayout";
import { ItemRating, RotationRubricView } from "./RotationRubricView";
import {
  completeRotationSelfAssessment,
  saveRotationSelfAssessmentDraft,
  startRotationSelfAssessment,
} from "../../../services/rotationAssessmentService";
import {
  PART_STATUS_LABEL,
  computeBlockScore,
  durationLabel,
  formatGrade,
  isRubricAnswerValid,
  linkableNodes,
  missingObjectives,
  missingRubricBlocks,
  nodeForAssessment,
  normalizeVersion,
  objectiveProgress,
  objectivesLabel,
  objectivesBlockOf,
  objectivesStatus,
  periodLabel,
  rubricStatus,
  selfAssessableBlocks,
  templateNodeFor,
} from "../../../utils/rotationAssessment";

/**
 * La autoevaluación de una rotación publicada por Docencia, dentro de Libro →
 * Rotaciones: detalle, objetivos, mi autoevaluación (un objetivo cada vez),
 * revisión antes de finalizar y rúbrica. Es una sola pantalla del Libro con su
 * propia pila, igual que la ficha: mientras está abierta es lo único que se pinta.
 *
 * Lo escrito y no guardado no se pierde en silencio: vive en este móvil
 * (AsyncStorage, por autoevaluación y parte) hasta que la base confirma el
 * guardado, y salir con cambios pendientes pregunta antes. Si la app se cierra o
 * la sesión caduca, al volver se recupera y se avisa.
 */

const CACHE_PREFIX = "rotationAssessmentDraft";
const cacheKey = (assessmentId, part) => `${CACHE_PREFIX}:${assessmentId}:${part}`;

const readCache = async (assessmentId, part) => {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(assessmentId, part));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const writeCache = (assessmentId, part, value) =>
  AsyncStorage.setItem(cacheKey(assessmentId, part), JSON.stringify(value)).catch(() => {});

const clearCache = (assessmentId, part) =>
  AsyncStorage.removeItem(cacheKey(assessmentId, part)).catch(() => {});

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
};

const isSessionError = (error) =>
  error?.code === "PGRST301" || /jwt|session/i.test(String(error?.message || ""));

/** El mensaje de error que se enseña: el de la base si es suyo (en español), si no uno genérico. */
const saveErrorMessage = (error, fallback) => {
  if (isSessionError(error)) {
    return "Tu sesión ha caducado. Vuelve a iniciar sesión: lo que has escrito sigue guardado en este móvil.";
  }
  if (error?.code === "P0001" && error?.message) return error.message;
  return fallback;
};

const sameJson = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});

/** Las respuestas de rúbrica sin el bloque `blockId` (la consecución va con los objetivos). */
const without = (answers, blockId) => {
  if (!blockId || !answers) return answers || {};
  const { [blockId]: _omit, ...rest } = answers;
  return rest;
};

export const RotationAssessmentFlow = ({
  card,
  nodes = [],
  rotations = [],
  assessments = [],
  contextLabel = "",
  canStart = false,
  onClose,
  onReload,
  onAssessmentSaved,
}) => {
  // Por defecto la autoevaluación de la tarjeta; "otros periodos" la cambian.
  const [selectedId, setSelectedId] = useState(null);
  const assessment = useMemo(() => {
    if (selectedId) {
      return [card.assessment, ...card.previous].find((item) => item?.id === selectedId) || card.assessment;
    }
    return card.assessment;
  }, [card, selectedId]);
  const version = useMemo(
    () => (assessment ? normalizeVersion(assessment.content) : card.version),
    [assessment, card.version]
  );
  const versionNumber = assessment ? assessment.version : card.versionNumber;
  const rotationName = version.rotation.name;
  // La valoración de cada objetivo se guarda en el bloque de consecución
  // (rubric_answers[bloque]), pero es parte de "Mi autoevaluación" (objetivos).
  const objectivesBlock = objectivesBlockOf(version);
  const objectivesBlockId = objectivesBlock?.id || null;

  const [screen, setScreen] = useState("detail");
  const [objectiveIndex, setObjectiveIndex] = useState(0);
  const [objectiveDraft, setObjectiveDraft] = useState({});
  const [rubricDraft, setRubricDraft] = useState({});
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [dirty, setDirty] = useState({ objectives: false, rubric: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { text, error }
  const [newPeriod, setNewPeriod] = useState(false);
  const busyRef = useRef(false);

  const objectivesState = objectivesStatus(assessment, version);
  const rubricState = rubricStatus(assessment, version);
  const objectivesEditable = !!assessment && !assessment.objectives_completed_at;
  const rubricEditable =
    !!assessment && !assessment.rubric_completed_at && selfAssessableBlocks(version).length > 0;

  // Al cambiar de autoevaluación se parte de lo guardado en la base, salvo que
  // en este móvil haya algo sin guardar más nuevo: entonces se recupera.
  // Solo depende del id: un refresco de la lista (que llega tarde, p. ej. tras
  // finalizar los objetivos) no puede pisar lo que se está escribiendo.
  useEffect(() => {
    let active = true;
    const serverObjectives = assessment?.objective_answers || {};
    const serverRubric = assessment?.rubric_answers || {};
    const serverReflection = assessment?.final_reflection || "";
    setObjectiveDraft(serverObjectives);
    setRubricDraft(serverRubric);
    setReflectionDraft(serverReflection);
    setDirty({ objectives: false, rubric: false });
    setNotice(null);

    if (!assessment?.id) return undefined;

    (async () => {
      const [objectivesCache, rubricCache] = await Promise.all([
        objectivesEditable ? readCache(assessment.id, "objectives") : null,
        rubricEditable ? readCache(assessment.id, "rubric") : null,
      ]);
      if (!active) return;
      let recovered = false;
      const serverRatings = objectivesBlockId ? serverRubric[objectivesBlockId] || {} : {};
      if (
        objectivesCache &&
        (!sameJson(objectivesCache.answers, serverObjectives) ||
          !sameJson(objectivesCache.ratings, serverRatings))
      ) {
        setObjectiveDraft(objectivesCache.answers || {});
        if (objectivesBlockId) {
          setRubricDraft((current) => ({
            ...current,
            [objectivesBlockId]: objectivesCache.ratings || {},
          }));
        }
        setDirty((current) => ({ ...current, objectives: true }));
        recovered = true;
      }
      if (
        rubricCache &&
        (!sameJson(rubricCache.answers, without(serverRubric, objectivesBlockId)) ||
          (rubricCache.reflection || "") !== serverReflection)
      ) {
        setRubricDraft((current) => ({
          ...without(rubricCache.answers, objectivesBlockId),
          ...(objectivesBlockId ? { [objectivesBlockId]: current[objectivesBlockId] || {} } : {}),
        }));
        setReflectionDraft(rubricCache.reflection || "");
        setDirty((current) => ({ ...current, rubric: true }));
        recovered = true;
      }
      if (recovered) {
        setNotice({
          text: "Hemos recuperado cambios que no habías guardado. Guárdalos para no perderlos.",
          error: false,
        });
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment?.id]);

  // Al finalizarse una parte, esa parte (y solo esa) pasa a lo guardado.
  useEffect(() => {
    if (objectivesEditable || !assessment) return;
    setObjectiveDraft(assessment.objective_answers || {});
    if (objectivesBlockId) {
      setRubricDraft((current) => ({
        ...current,
        [objectivesBlockId]: assessment.rubric_answers?.[objectivesBlockId] || {},
      }));
    }
    setDirty((current) => ({ ...current, objectives: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectivesEditable]);

  useEffect(() => {
    if (rubricEditable || !assessment) return;
    setRubricDraft((current) => ({
      ...(assessment.rubric_answers || {}),
      ...(objectivesBlockId ? { [objectivesBlockId]: current[objectivesBlockId] || {} } : {}),
    }));
    setReflectionDraft(assessment.final_reflection || "");
    setDirty((current) => ({ ...current, rubric: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubricEditable]);

  // Copia local de lo no guardado, por si la app se cierra o la sesión caduca.
  useEffect(() => {
    if (!assessment?.id || !dirty.objectives) return undefined;
    const timer = setTimeout(
      () =>
        writeCache(assessment.id, "objectives", {
          answers: objectiveDraft,
          ratings: objectivesBlockId ? rubricDraft[objectivesBlockId] || {} : {},
        }),
      400
    );
    return () => clearTimeout(timer);
  }, [assessment?.id, dirty.objectives, objectiveDraft, rubricDraft, objectivesBlockId]);

  useEffect(() => {
    if (!assessment?.id || !dirty.rubric) return undefined;
    const timer = setTimeout(
      () =>
        writeCache(assessment.id, "rubric", {
          answers: without(rubricDraft, objectivesBlockId),
          reflection: reflectionDraft,
        }),
      400
    );
    return () => clearTimeout(timer);
  }, [assessment?.id, dirty.rubric, rubricDraft, reflectionDraft, objectivesBlockId]);

  const runOnce = async (fn) => {
    // Pulsar dos veces Guardar o Finalizar no lanza dos operaciones.
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Guardar y finalizar
  // -------------------------------------------------------------------------

  const saveObjectives = async () => {
    if (!assessment?.id || !objectivesEditable) return true;
    try {
      const row = await saveRotationSelfAssessmentDraft(assessment.id, {
        objectiveAnswers: objectiveDraft,
        rubricAnswers: objectivesBlockId
          ? { [objectivesBlockId]: rubricDraft[objectivesBlockId] || {} }
          : undefined,
      });
      onAssessmentSaved?.(row);
      setDirty((current) => ({ ...current, objectives: false }));
      await clearCache(assessment.id, "objectives");
      return true;
    } catch (error) {
      setNotice({
        text: saveErrorMessage(error, "No hemos podido guardar tu autoevaluación."),
        error: true,
      });
      return false;
    }
  };

  const saveRubric = async () => {
    if (!assessment?.id || !rubricEditable) return true;
    // Un nivel con rango (6-7) sin la puntuación exacta no se puede guardar: la
    // base lo rechaza, y guardarlo sin ella sería quedarse con el intervalo.
    const pending = selfAssessableBlocks(version).filter((block) =>
      Object.values(rubricDraft[block.id] || {}).some(
        (answer) => answer && !isRubricAnswerValid(block, answer)
      )
    );
    if (pending.length) {
      setNotice({
        text: `Elige la puntuación exacta en «${pending.map((block) => block.title).join("», «")}» antes de guardar.`,
        error: true,
      });
      return false;
    }
    try {
      const row = await saveRotationSelfAssessmentDraft(assessment.id, {
        rubricAnswers: without(rubricDraft, objectivesBlockId),
        finalReflection: reflectionDraft,
      });
      onAssessmentSaved?.(row);
      setDirty((current) => ({ ...current, rubric: false }));
      await clearCache(assessment.id, "rubric");
      return true;
    } catch (error) {
      setNotice({
        text: saveErrorMessage(error, "No hemos podido guardar tu autoevaluación."),
        error: true,
      });
      return false;
    }
  };

  const handleSaveDraft = (part) =>
    runOnce(async () => {
      const ok = part === "objectives" ? await saveObjectives() : await saveRubric();
      if (ok) setNotice({ text: "Borrador guardado.", error: false });
    });

  const handleComplete = (part) =>
    runOnce(async () => {
      const saved = part === "objectives" ? await saveObjectives() : await saveRubric();
      if (!saved) return;
      try {
        const row = await completeRotationSelfAssessment(assessment.id, part);
        onAssessmentSaved?.(row);
        setNotice(null);
        if (part === "objectives") {
          setScreen("done");
        } else {
          setNotice({ text: "Has finalizado tu rúbrica.", error: false });
          setScreen("detail");
        }
        await onReload?.();
      } catch (error) {
        setNotice({
          text: saveErrorMessage(error, "No hemos podido finalizar tu autoevaluación. Inténtalo de nuevo."),
          error: true,
        });
      }
    });

  // -------------------------------------------------------------------------
  // Empezar (solo con un gesto explícito, nunca por abrir la tarjeta)
  // -------------------------------------------------------------------------

  const autoNode = !newPeriod && !card.assessment ? templateNodeFor(card.plan, nodes, assessments) : null;
  const candidates = useMemo(
    () => linkableNodes(nodes, rotations, assessments),
    [nodes, rotations, assessments]
  );

  const [afterStart, setAfterStart] = useState(null);

  // `period` va explícito: quien lo llama justo después de setNewPeriod(true)
  // todavía ve el valor anterior en el cierre.
  const start = (libroNodeId, target, period = newPeriod) =>
    runOnce(async () => {
      try {
        await startRotationSelfAssessment(card.rotationId, { libroNodeId, newPeriod: period });
        await onReload?.();
        setSelectedId(null);
        setNewPeriod(false);
        setScreen(target);
        setObjectiveIndex(0);
      } catch (error) {
        setNotice({
          text: saveErrorMessage(error, "No hemos podido empezar tu autoevaluación. Inténtalo de nuevo."),
          error: true,
        });
        setScreen("detail");
      }
    });

  /** Abre `target` con la autoevaluación abierta, empezándola si no existe. */
  const openEditable = (target) => {
    const open = card.assessment && !card.assessment.completed_at && !newPeriod;
    if (open || (assessment && !newPeriod)) {
      setSelectedId(null);
      setScreen(target);
      return;
    }
    if (!autoNode && candidates.length) {
      setAfterStart(target);
      setScreen("link");
      return;
    }
    start(null, target);
  };

  // -------------------------------------------------------------------------
  // Volver: con cambios sin guardar, se pregunta
  // -------------------------------------------------------------------------

  const unsavedPart =
    screen === "answer" || screen === "review"
      ? dirty.objectives && "objectives"
      : screen === "rubric"
        ? dirty.rubric && "rubric"
        : null;

  const leave = (to) => {
    // Salir de elegir ficha sin elegir deja de ser "otro periodo".
    if (screen === "link") setNewPeriod(false);
    if (to === "close") onClose?.();
    else setScreen(to);
  };

  const goBack = useCallback(() => {
    const target =
      {
        objectives: "detail",
        answer: "objectives",
        answers: "detail",
        review: "answer",
        rubric: "detail",
        link: "detail",
        done: "detail",
      }[screen] || "close";

    if (!unsavedPart || target === "answer") {
      leave(target);
      return;
    }

    Alert.alert(
      "Tienes cambios sin guardar",
      "Si sales ahora, perderás lo que has escrito desde la última vez que guardaste.",
      [
        { text: "Seguir editando", style: "cancel" },
        {
          text: "Salir sin guardar",
          style: "destructive",
          onPress: async () => {
            await clearCache(assessment.id, unsavedPart);
            if (unsavedPart === "objectives") {
              setObjectiveDraft(assessment.objective_answers || {});
              if (objectivesBlockId) {
                setRubricDraft((current) => ({
                  ...current,
                  [objectivesBlockId]: assessment.rubric_answers?.[objectivesBlockId] || {},
                }));
              }
            } else {
              setRubricDraft((current) => ({
                ...(assessment.rubric_answers || {}),
                ...(objectivesBlockId ? { [objectivesBlockId]: current[objectivesBlockId] || {} } : {}),
              }));
              setReflectionDraft(assessment.final_reflection || "");
            }
            setDirty((current) => ({ ...current, [unsavedPart]: false }));
            leave(target);
          },
        },
        {
          text: "Guardar y salir",
          onPress: () =>
            runOnce(async () => {
              const ok =
                unsavedPart === "objectives" ? await saveObjectives() : await saveRubric();
              if (ok) leave(target);
            }),
        },
      ]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, unsavedPart, assessment, objectiveDraft, rubricDraft, reflectionDraft, objectivesBlockId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]);

  // -------------------------------------------------------------------------
  // Pantallas
  // -------------------------------------------------------------------------

  const progress = objectiveProgress(version, objectiveDraft, rubricDraft);
  const node = nodeForAssessment(assessment, nodes) || autoNode;
  const nodeDates = [node?.progress?.payload?.start_date, node?.progress?.payload?.end_date]
    .map(formatDate)
    .filter(Boolean);
  // El periodo que indicó Docencia al generar manda sobre las fechas de la ficha.
  const period = periodLabel(assessment, formatDate);

  const Notice = notice ? (
    <View style={[styles.notice, notice.error && styles.noticeError]} testID="rotation-assessment-notice">
      <Text style={[styles.noticeText, notice.error && styles.noticeTextError]}>{notice.text}</Text>
    </View>
  ) : null;

  const Button = ({ label, onPress, variant = "primary", disabled = false, testID }) => (
    <TouchableOpacity
      style={[
        variant === "primary" ? styles.primaryButton : styles.secondaryButton,
        (disabled || busy) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
      testID={testID}
    >
      {busy && variant === "primary" ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={variant === "primary" ? styles.primaryText : styles.secondaryText}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  const versionLine = versionNumber
    ? `Versión ${versionNumber}${
        assessment?.published_at || card.plan?.published_at
          ? ` · publicada el ${formatDate(assessment?.published_at || card.plan?.published_at)}`
          : ""
      }`
    : "";

  const renderDetail = () => {
    const objectivesCount = version.objectives.length;
    const answered = objectiveProgress(
      version,
      assessment?.objective_answers,
      assessment?.rubric_answers
    ).answered;
    const canStartHere = canStart && !card.retired;
    const selfBlocks = selfAssessableBlocks(version);

    return (
      <>
        <View style={styles.card}>
          {contextLabel ? <Text style={styles.muted}>{contextLabel}</Text> : null}
          {version.rotation.durationMonths ? (
            <Text style={styles.body}>
              {`Duración prevista: ${durationLabel(version.rotation.durationMonths)}`}
            </Text>
          ) : null}
          {period ? (
            <Text style={styles.body}>{`Periodo: ${period}`}</Text>
          ) : nodeDates.length ? (
            <Text style={styles.body}>{`Fechas: ${nodeDates.join(" – ")}`}</Text>
          ) : null}
          {node ? <Text style={styles.muted}>{`En tu Libro: ${node.name}`}</Text> : null}
          {versionLine ? <Text style={styles.muted}>{versionLine}</Text> : null}
          {card.retired ? (
            <Text style={styles.muted}>
              Docencia ya no publica esta rotación para ti. Tu autoevaluación se conserva.
            </Text>
          ) : null}
          {assessment?.completed_at ? (
            <Text style={styles.statusDone}>
              {`Autoevaluación completada el ${formatDate(assessment.completed_at)}`}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Objetivos formativos</Text>
          <Text style={styles.body}>
            Consulta los objetivos que debes alcanzar durante esta rotación.
          </Text>
          {objectivesCount ? (
            <>
              <Text style={styles.strong}>{objectivesLabel(objectivesCount)}</Text>
              <Button
                label="Ver objetivos"
                variant="secondary"
                onPress={() => setScreen("objectives")}
                testID="rotation-view-objectives"
              />
            </>
          ) : (
            <Text style={styles.muted}>
              Esta rotación todavía no tiene objetivos formativos disponibles.
            </Text>
          )}
        </View>

        {objectivesCount ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mi autoevaluación</Text>
            <Text style={styles.body}>
              {objectivesBlock
                ? "Valora tu grado de consecución de cada objetivo formativo."
                : "Reflexiona sobre los conocimientos y competencias que has adquirido."}
            </Text>
            {objectivesState === "completed" ? (
              <>
                <Text style={styles.body}>
                  {assessment?.objectives_completed_at
                    ? `Enviaste tu autoevaluación el ${formatDate(assessment.objectives_completed_at)}.`
                    : "Has enviado tu autoevaluación."}
                </Text>
                <Text style={styles.strong}>
                  {`${answered} de ${objectivesCount} objetivos valorados`}
                </Text>
                <Button
                  label="Ver respuestas"
                  variant="secondary"
                  onPress={() => setScreen("answers")}
                  testID="rotation-view-answers"
                />
              </>
            ) : assessment && objectivesState === "draft" ? (
              <>
                <Text style={styles.body}>Tienes una autoevaluación sin enviar.</Text>
                <Text style={styles.strong}>
                  {`${answered} de ${objectivesCount} objetivos valorados`}
                </Text>
                <Button
                  label="Continuar autoevaluación"
                  onPress={() => openEditable("answer")}
                  testID="rotation-continue-assessment"
                />
              </>
            ) : (
              <>
                <Text style={styles.body}>Todavía no has empezado tu autoevaluación.</Text>
                {canStartHere || assessment ? (
                  <Button
                    label="Empezar autoevaluación"
                    onPress={() => openEditable("answer")}
                    testID="rotation-start-assessment"
                  />
                ) : (
                  <Text style={styles.muted}>No puedes empezarla desde este año.</Text>
                )}
              </>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rúbrica de evaluación</Text>
          <Text style={styles.body}>
            Consulta los criterios de evaluación establecidos por Docencia.
          </Text>
          {rubricState === "unavailable" ? (
            <Text style={styles.muted}>La rúbrica de esta rotación todavía no está disponible.</Text>
          ) : (
            <>
              <Text style={styles.strong}>{`Estado: ${PART_STATUS_LABEL[rubricState]}`}</Text>
              {rubricState === "completed"
                ? selfBlocks.map((block) => {
                    const result = computeBlockScore(block, assessment?.rubric_answers?.[block.id]);
                    if (block.kind !== "criteria") return null;
                    return (
                      <Text key={block.id} style={styles.body}>
                        {result.reason === "ok"
                          ? `${block.title} · Resultado de mi autoevaluación: ${formatGrade(result.grade)}/${result.outOf}`
                          : result.reason === "no_applicable"
                            ? `${block.title} · Sin puntuación aplicable`
                            : `${block.title} · Sin nota calculable`}
                      </Text>
                    );
                  })
                : null}
              {rubricState === "consult" || rubricState === "completed" ? (
                <Button
                  label={rubricState === "consult" ? "Consultar criterios" : "Ver mi rúbrica"}
                  variant="secondary"
                  onPress={() => setScreen("rubric")}
                  testID="rotation-open-rubric"
                />
              ) : canStartHere || assessment ? (
                <Button
                  label={rubricState === "draft" ? "Continuar mi rúbrica" : "Completar mi rúbrica"}
                  onPress={() => openEditable("rubric")}
                  testID="rotation-open-rubric"
                />
              ) : (
                <Button
                  label="Consultar criterios"
                  variant="secondary"
                  onPress={() => setScreen("rubric")}
                  testID="rotation-open-rubric"
                />
              )}
            </>
          )}
        </View>

        {card.previous.length || (card.assessment && selectedId) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Otros periodos</Text>
            {[card.assessment, ...card.previous]
              .filter((item) => item && item.id !== assessment?.id)
              .map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    setSelectedId(item.id === card.assessment?.id ? null : item.id);
                    setScreen("detail");
                  }}
                >
                  <Text style={styles.link}>
                    {[
                      periodLabel(item, formatDate),
                      item.completed_at
                        ? `Completada el ${formatDate(item.completed_at)}`
                        : `Empezada el ${formatDate(item.created_at)} · sin finalizar`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        ) : null}

        {canStartHere && !card.generated && card.assessment?.completed_at && !selectedId ? (
          <Button
            label="Autoevaluar otro periodo de esta rotación"
            variant="secondary"
            testID="rotation-new-period"
            onPress={() =>
              Alert.alert(
                "Otro periodo",
                "Si vuelves a hacer esta rotación en otro periodo, empiezas una autoevaluación nueva. La anterior se conserva tal cual.",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Empezar",
                    onPress: () => {
                      setNewPeriod(true);
                      if (candidates.length) {
                        setAfterStart("answer");
                        setScreen("link");
                      } else {
                        start(null, "answer", true);
                      }
                    },
                  },
                ]
              )
            }
          />
        ) : null}
      </>
    );
  };

  const renderLink = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>¿Cuál de tus rotaciones del Libro es?</Text>
        <Text style={styles.body}>
          Así tu autoevaluación queda unida a la ficha donde apuntas sus fechas. Si todavía no
          la tienes en tu Libro, sigue sin elegir ninguna.
        </Text>
      </View>
      {candidates.map((candidate) => (
        <TouchableOpacity
          key={candidate.id}
          style={styles.option}
          onPress={() => start(candidate.id, afterStart || "answer")}
          disabled={busy}
          activeOpacity={0.85}
        >
          <Text style={styles.strong}>{candidate.name}</Text>
          {candidate.center ? <Text style={styles.muted}>{candidate.center}</Text> : null}
        </TouchableOpacity>
      ))}
      <Button
        label="No la tengo en mi Libro"
        variant="secondary"
        onPress={() => start(null, afterStart || "answer")}
        testID="rotation-link-none"
      />
    </>
  );

  const renderObjectives = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Objetivos formativos</Text>
        <Text style={styles.muted}>{rotationName}</Text>
      </View>
      {version.objectives.map((objective, index) => (
        <View key={objective.id} style={styles.card}>
          <Text style={styles.label}>{`Objetivo ${index + 1}`}</Text>
          {objective.title ? <Text style={styles.strong}>{objective.title}</Text> : null}
          {objective.description ? <Text style={styles.body}>{objective.description}</Text> : null}
        </View>
      ))}
      {objectivesState === "completed" ? (
        <Button label="Ver mis respuestas" variant="secondary" onPress={() => setScreen("answers")} />
      ) : canStart || assessment ? (
        <Button
          label="Realizar autoevaluación"
          onPress={() => openEditable("answer")}
          testID="rotation-do-assessment"
        />
      ) : null}
    </>
  );

  const renderAnswer = () => {
    const total = version.objectives.length;
    const index = Math.min(objectiveIndex, Math.max(total - 1, 0));
    const objective = version.objectives[index];
    if (!objective) return null;
    const missing = missingObjectives(version, objectiveDraft, rubricDraft);

    return (
      <>
        <Text style={styles.label} testID="rotation-objective-counter">
          {`Objetivo ${index + 1} de ${total}`}
        </Text>
        {objectivesBlock ? (
          <View style={styles.card}>
            <ItemRating
              block={objectivesBlock}
              item={objective}
              answer={rubricDraft[objectivesBlock.id]?.[objective.id]}
              editable={objectivesEditable}
              testPrefix={`objective-${index}`}
              standalone
              onChange={(answer) => {
                setRubricDraft((current) => ({
                  ...current,
                  [objectivesBlock.id]: { ...(current[objectivesBlock.id] || {}), [objective.id]: answer },
                }));
                setDirty((current) => ({ ...current, objectives: true }));
                setNotice(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Objetivo</Text>
            {objective.title ? <Text style={styles.strong}>{objective.title}</Text> : null}
            {objective.description ? <Text style={styles.body}>{objective.description}</Text> : null}
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {objectivesBlock ? "Reflexión (opcional)" : "Mi autoevaluación"}
          </Text>
          <TextInput
            style={[styles.input, objectivesBlock && styles.inputShort]}
            value={objectiveDraft[objective.id] || ""}
            onChangeText={(text) => {
              setObjectiveDraft((current) => ({ ...current, [objective.id]: text }));
              setDirty((current) => ({ ...current, objectives: true }));
              setNotice(null);
            }}
            placeholder="Explica qué has aprendido, qué actividades has realizado y cómo valoras tu grado de consecución de este objetivo."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            editable={objectivesEditable}
            testID="rotation-objective-answer"
          />
        </View>
        <Text style={styles.muted}>{`${progress.answered} de ${total} objetivos valorados`}</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Button
              label="Anterior"
              variant="secondary"
              disabled={index === 0}
              onPress={() => setObjectiveIndex(index - 1)}
              testID="rotation-objective-prev"
            />
          </View>
          <View style={styles.rowItem}>
            <Button
              label="Siguiente"
              variant="secondary"
              disabled={index >= total - 1}
              onPress={() => setObjectiveIndex(index + 1)}
              testID="rotation-objective-next"
            />
          </View>
        </View>
        {Notice}
        <Button
          label="Guardar borrador"
          variant="secondary"
          disabled={!dirty.objectives || !objectivesEditable}
          onPress={() => handleSaveDraft("objectives")}
          testID="rotation-save-draft"
        />
        <Button
          label="Enviar autoevaluación"
          // Una autoevaluación ya enviada no se reenvía: solo se consulta.
          disabled={missing.length > 0 || !objectivesEditable}
          onPress={() =>
            runOnce(async () => {
              const ok = await saveObjectives();
              if (ok) {
                setNotice(null);
                setScreen("review");
              }
            })
          }
          testID="rotation-finish-assessment"
        />
        {missing.length ? (
          <Text style={styles.muted}>
            {`Para enviarla, valora también: ${missing.join(", ")}.`}
          </Text>
        ) : null}
      </>
    );
  };

  const renderAnswersList = (title) => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.muted}>{rotationName}</Text>
        <Text style={styles.strong}>
          {`${objectiveProgress(version, objectiveDraft, rubricDraft).answered} de ${version.objectives.length} objetivos valorados`}
        </Text>
        {versionLine ? <Text style={styles.muted}>{versionLine}</Text> : null}
        {assessment?.objectives_completed_at ? (
          <Text style={styles.muted}>
            {`Enviada el ${formatDate(assessment.objectives_completed_at)}`}
          </Text>
        ) : null}
      </View>
      {version.objectives.map((objective, index) => {
        const reflection = objectiveDraft[objective.id];
        return (
          <View key={objective.id} style={styles.card}>
            <Text style={styles.label}>{`Objetivo ${index + 1}`}</Text>
            {objectivesBlock ? (
              <ItemRating
                block={objectivesBlock}
                item={objective}
                answer={rubricDraft[objectivesBlock.id]?.[objective.id]}
                editable={false}
                testPrefix={`objective-review-${index}`}
                standalone
              />
            ) : (
              <>
                {objective.title ? <Text style={styles.strong}>{objective.title}</Text> : null}
                {objective.description ? <Text style={styles.body}>{objective.description}</Text> : null}
              </>
            )}
            {reflection && reflection.trim() ? (
              <Text style={styles.answer}>{reflection}</Text>
            ) : !objectivesBlock ? (
              <Text style={styles.answer}>Sin respuesta</Text>
            ) : null}
          </View>
        );
      })}
    </>
  );

  const renderReview = () => (
    <>
      <Text style={styles.body}>
        Comprueba tus valoraciones antes de enviarlas. Una vez enviada, tu autoevaluación ya no se
        puede cambiar y Docencia podrá consultarla.
      </Text>
      {renderAnswersList("Revisa tu autoevaluación")}
      {Notice}
      <Button
        label="Seguir editando"
        variant="secondary"
        onPress={() => setScreen("answer")}
        testID="rotation-keep-editing"
      />
      <Button
        label="Confirmar envío"
        onPress={() => handleComplete("objectives")}
        testID="rotation-confirm-finish"
      />
    </>
  );

  const renderDone = () => (
    <View style={styles.card} testID="rotation-assessment-done">
      <Text style={styles.cardTitle}>Autoevaluación enviada</Text>
      <Text style={styles.body}>{`Has enviado tu autoevaluación de ${rotationName}.`}</Text>
      <Button label="Volver a la rotación" onPress={() => setScreen("detail")} />
    </View>
  );

  const renderRubric = () => {
    const missing = missingRubricBlocks(version, rubricDraft);
    const showReflection = selfAssessableBlocks(version).length > 0 && !!assessment;
    return (
      <>
        {Notice}
        <RotationRubricView
          version={version}
          rubricAnswers={rubricDraft}
          finalReflection={reflectionDraft}
          editable={rubricEditable}
          showReflection={showReflection}
          onChangeAnswer={(blockId, itemId, answer) => {
            setRubricDraft((current) => {
              const block = { ...(current[blockId] || {}) };
              if (answer) block[itemId] = answer;
              else delete block[itemId];
              return { ...current, [blockId]: block };
            });
            setDirty((current) => ({ ...current, rubric: true }));
            setNotice(null);
          }}
          onChangeReflection={(text) => {
            setReflectionDraft(text);
            setDirty((current) => ({ ...current, rubric: true }));
            setNotice(null);
          }}
        />
        {rubricEditable ? (
          <>
            <Button
              label="Guardar borrador"
              variant="secondary"
              disabled={!dirty.rubric}
              onPress={() => handleSaveDraft("rubric")}
              testID="rubric-save-draft"
            />
            <Button
              label="Finalizar mi rúbrica"
              disabled={missing.length > 0}
              onPress={() =>
                Alert.alert(
                  "Revisa tu rúbrica",
                  "Una vez finalizada no podrás cambiar tus valoraciones.",
                  [
                    { text: "Seguir editando", style: "cancel" },
                    { text: "Confirmar finalización", onPress: () => handleComplete("rubric") },
                  ]
                )
              }
              testID="rubric-finish"
            />
            {missing.length ? (
              <Text style={styles.muted}>
                {`Para finalizar, valora todos los criterios de: ${missing.join(", ")}.`}
              </Text>
            ) : null}
          </>
        ) : null}
      </>
    );
  };

  const titles = {
    detail: rotationName,
    link: "Mi rotación",
    objectives: "Objetivos formativos",
    answer: "Mi autoevaluación",
    answers: "Mis respuestas",
    review: "Revisa tu autoevaluación",
    done: "Autoevaluación enviada",
    rubric: "Rúbrica de evaluación",
  };

  const content = {
    detail: renderDetail,
    link: renderLink,
    objectives: renderObjectives,
    answer: renderAnswer,
    answers: () => renderAnswersList("Mis respuestas"),
    review: renderReview,
    done: renderDone,
    rubric: renderRubric,
  }[screen];

  return (
    <HeroScreenLayout
      title={titles[screen]}
      subtitle={screen === "detail" ? null : rotationName}
      onBack={goBack}
      keyboardAvoiding
    >
      <ScrollView
        // Cada subpantalla empieza arriba: sin la key heredaba el scroll de la anterior.
        key={screen}
        style={styles.surface}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {screen === "detail" || screen === "link" ? Notice : null}
        {content()}
      </ScrollView>
    </HeroScreenLayout>
  );
};

export default RotationAssessmentFlow;

const styles = StyleSheet.create({
  surface: { flex: 1, backgroundColor: "#F8F9FE" },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  option: {
    gap: 2,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#1B0977" },
  label: { fontSize: 12, fontWeight: "800", color: "#6D28D9", textTransform: "uppercase" },
  strong: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  body: { fontSize: 14, color: "#334155", lineHeight: 20 },
  muted: { fontSize: 13, color: "#64748B", lineHeight: 18 },
  answer: {
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 20,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
  },
  link: { fontSize: 14, fontWeight: "700", color: "#670CF5", paddingVertical: 4 },
  statusDone: { fontSize: 14, fontWeight: "800", color: "#047857" },
  inputShort: { minHeight: 110 },
  input: {
    minHeight: 180,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    fontSize: 14,
    lineHeight: 20,
    color: "#0F172A",
  },
  row: { flexDirection: "row", gap: 10 },
  rowItem: { flex: 1 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
    paddingHorizontal: 16,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  secondaryText: { fontSize: 14, fontWeight: "700", color: "#670CF5" },
  notice: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  noticeError: { backgroundColor: "#FFF1F2", borderColor: "#FECDD3" },
  noticeText: { fontSize: 13, color: "#047857", lineHeight: 18 },
  noticeTextError: { color: "#9F1239" },
});
