import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  DebriefShell,
  debriefStyles,
} from "../components/shiftDebrief/DebriefShell";
import { FrequentProceduresList } from "../components/shiftDebrief/FrequentProceduresList";
import { ProcedurePickerModal } from "../components/shiftDebrief/ProcedurePickerModal";
import { ShiftDebriefSummary } from "../components/shiftDebrief/ShiftDebriefSummary";
import {
  canAddLibroProcedures,
  createLibroProcedure,
  getDebriefLibro,
  getFrequentProcedures,
  getShiftDebrief,
  getShiftForDebrief,
  saveFrequentProcedures,
  saveShiftDebrief,
  syncDebriefWithLibro,
} from "../services/shiftDebriefService";
import {
  AUTONOMY_OPTIONS,
  LEARNING_OPTIONS,
  RATING_OPTIONS,
  REFLECTION_FIELDS,
  buildProceduresSnapshot,
  formatProcedureTotal,
  getCountableProcedures,
  hasReflection,
  moveItem,
  procedureKey,
  resolveFrequentProcedures,
  sumLibroCountsForShift,
  summarizeDebrief,
} from "../utils/shiftDebrief";

/**
 * Postguardia interactiva (ClickUp 124b4z9vc56): «tu guardia en 60 segundos».
 *
 * Modos:
 *  - setup / frequents: elegir (o editar) los procedimientos frecuentes. La
 *    primera vez que entra, antes de nada; luego, desde «⚙️ Editar».
 *  - step 1-4: procedimientos, autonomía, aprendizajes y valoración. Cada
 *    «Siguiente» guarda solo (borrador) y se puede saltar todo.
 *  - done: la celebración, discreta.
 *  - reflection: la autoevaluación ampliada, opcional y privada por defecto.
 *  - detail: el registro guardado, con Resumen y Autoevaluación.
 *
 * Los procedimientos se escriben en el Libro (Actividad asistencial) y solo la
 * diferencia con lo que ya tenía en las fechas de la guardia: ver
 * utils/shiftDebrief.js.
 */

const formatShiftDate = (iso) => {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const PRIVACY_NOTICE =
  "No escribas nombres ni datos que permitan identificar a un paciente.";

export default function ShiftDebriefScreen({
  agendaEventId,
  userProfile,
  onBack,
}) {
  const userId = userProfile?.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [shift, setShift] = useState(null);
  const [debrief, setDebrief] = useState(null);
  const [book, setBook] = useState(null);
  const [nodes, setNodes] = useState([]);

  // null = nunca configurados.
  const [frequents, setFrequents] = useState(null);
  const [frequentsDraft, setFrequentsDraft] = useState([]);

  // Procedimientos en pantalla en el paso 1 y sus contadores (por procedureKey).
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});

  const [autonomy, setAutonomy] = useState(null);
  const [autonomyComment, setAutonomyComment] = useState("");
  const [showAutonomyComment, setShowAutonomyComment] = useState(false);
  const [learnings, setLearnings] = useState([]);
  const [learningNote, setLearningNote] = useState("");
  const [showLearningNote, setShowLearningNote] = useState(false);
  const [rating, setRating] = useState(null);
  const [improvementNote, setImprovementNote] = useState("");
  const [reflection, setReflection] = useState({});
  const [shareReflection, setShareReflection] = useState(false);

  const [mode, setMode] = useState("loading");
  const [returnMode, setReturnMode] = useState(null);
  const [step, setStep] = useState(1);
  const [detailTab, setDetailTab] = useState("summary");
  const [picker, setPicker] = useState(null); // "frequent" | "shift" | null
  const [saving, setSaving] = useState(false);

  const catalog = useMemo(() => getCountableProcedures(nodes), [nodes]);
  const areas = useMemo(
    () =>
      nodes
        .filter((node) => !node.parent_node_id)
        .sort((left, right) => (left.position ?? 0) - (right.position ?? 0)),
    [nodes],
  );
  // Sin áreas no hay dónde colgar la actividad: se queda en la guardia.
  const canAddToLibro = canAddLibroProcedures(book) && areas.length > 0;
  const libroWritable = Boolean(book && book.status === "active");

  const applyDebriefFields = (row) => {
    setAutonomy(row?.autonomy || null);
    setAutonomyComment(row?.autonomy_comment || "");
    setShowAutonomyComment(Boolean(row?.autonomy_comment));
    setLearnings(row?.learnings || []);
    setLearningNote(row?.learning_note || "");
    setShowLearningNote(Boolean(row?.learning_note));
    setRating(row?.rating || null);
    setImprovementNote(row?.improvement_note || "");
    setReflection(row?.reflection || {});
    setShareReflection(Boolean(row?.share_reflection_with_tutor));
  };

  const load = useCallback(async () => {
    if (!userId) return;
    if (!agendaEventId) {
      setMode("missing");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const shiftRow = await getShiftForDebrief(agendaEventId, userId);
      if (!shiftRow) {
        setShift(null);
        setMode("missing");
        return;
      }
      const [debriefRow, libro, savedFrequents] = await Promise.all([
        getShiftDebrief(agendaEventId),
        getDebriefLibro(userProfile),
        getFrequentProcedures(userId),
      ]);

      const libroCatalog = getCountableProcedures(libro.nodes);
      const resolved =
        savedFrequents === null
          ? null
          : resolveFrequentProcedures(savedFrequents, libroCatalog);
      const inLibro = sumLibroCountsForShift(libro.entries, shiftRow);

      // Lo frecuente, más lo que ya apuntó en el Libro durante la guardia (para
      // recuperarlo sin duplicar) y lo personalizado de esta guardia.
      const list = [...(resolved || [])];
      const keys = new Set(list.map(procedureKey));
      libroCatalog.forEach((item) => {
        if ((inLibro[item.node_id] || 0) > 0 && !keys.has(procedureKey(item))) {
          list.push({ node_id: item.node_id, name: item.name });
          keys.add(procedureKey(item));
        }
      });
      (debriefRow?.procedures || []).forEach((item) => {
        if (!item.node_id && !keys.has(procedureKey(item))) {
          list.push({ node_id: null, name: item.name });
          keys.add(procedureKey(item));
        }
      });

      const initialCounts = {};
      list.forEach((item) => {
        initialCounts[procedureKey(item)] = item.node_id
          ? inLibro[item.node_id] || 0
          : (debriefRow?.procedures || []).find(
              (saved) =>
                !saved.node_id && procedureKey(saved) === procedureKey(item),
            )?.count || 0;
      });

      setShift(shiftRow);
      setDebrief(debriefRow);
      setBook(libro.book);
      setNodes(libro.nodes);
      setFrequents(resolved);
      setItems(list);
      setCounts(initialCounts);
      applyDebriefFields(debriefRow);

      if (debriefRow?.status === "completed") {
        setMode("detail");
      } else if (resolved === null) {
        setFrequentsDraft([]);
        setMode("setup");
      } else {
        setStep(1);
        setMode("step");
      }
    } catch (error) {
      console.error("Error loading shift debrief:", error);
      setLoadError("No se ha podido cargar tu guardia.");
    } finally {
      setLoading(false);
    }
  }, [agendaEventId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const showSaveError = (error) => {
    console.error("Error saving shift debrief:", error);
    Alert.alert(
      "No se ha podido guardar",
      "Revisa tu conexión e inténtalo de nuevo.",
    );
  };

  // ---------------------------------------------------------------------------
  // Guardado
  // ---------------------------------------------------------------------------

  const currentFields = () => ({
    procedures: buildProceduresSnapshot(items, counts),
    autonomy,
    autonomy_comment: autonomyComment,
    learnings,
    learning_note: learningNote,
    rating,
    improvement_note: improvementNote,
  });

  /** Lleva los contadores al Libro (solo la diferencia). */
  const syncProcedures = async () => {
    // Desde los contadores y no desde la lista: un procedimiento que se quita de
    // la pantalla con el contador a cero también tiene que bajar en el Libro.
    const desired = {};
    Object.entries(counts).forEach(([key, value]) => {
      if (key.startsWith("node:")) desired[key.slice(5)] = value || 0;
    });
    await syncDebriefWithLibro({ userId, shift, book, desiredCounts: desired });
  };

  const persist = async ({
    withProcedures = false,
    complete = false,
    extra = {},
  } = {}) => {
    if (withProcedures) await syncProcedures();
    const row = await saveShiftDebrief({
      userId,
      shift,
      fields: { ...currentFields(), ...extra },
      complete,
    });
    setDebrief(row);
    return row;
  };

  const goToStep = async (nextStep) => {
    setSaving(true);
    try {
      await persist({ withProcedures: step === 1 });
      setStep(nextStep);
    } catch (error) {
      showSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleStepBack = () => {
    if (step > 1) {
      // Lo de este paso se guarda igual; si falla, se guardará al seguir.
      persist({ withProcedures: false }).catch(() => {});
      setStep(step - 1);
      return;
    }
    if (debrief?.status === "completed") {
      setMode("detail");
      return;
    }
    onBack?.();
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await persist({
        withProcedures: true,
        complete: debrief?.status !== "completed",
      });
      setMode("done");
    } catch (error) {
      showSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReflection = async () => {
    setSaving(true);
    try {
      await persist({
        extra: { reflection, share_reflection_with_tutor: shareReflection },
      });
      setDetailTab("reflection");
      setMode("detail");
    } catch (error) {
      showSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Procedimientos
  // ---------------------------------------------------------------------------

  const openFrequentsEditor = () => {
    setFrequentsDraft(frequents || []);
    setReturnMode(mode);
    setMode("frequents");
  };

  const handleSaveFrequents = async () => {
    setSaving(true);
    try {
      await saveFrequentProcedures(userId, frequentsDraft);
      setFrequents(frequentsDraft);
      // Los frecuentes primero y en su orden; lo demás de esta guardia, detrás.
      const draftKeys = new Set(frequentsDraft.map(procedureKey));
      setItems((prev) => [
        ...frequentsDraft,
        ...prev.filter(
          (item) =>
            !draftKeys.has(procedureKey(item)) &&
            (counts[procedureKey(item)] || 0) > 0,
        ),
      ]);
      if (mode === "setup") {
        setStep(1);
        setMode("step");
      } else {
        setMode(returnMode || "step");
      }
    } catch (error) {
      showSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProcedure = async (name, areaId) => {
    try {
      const created = await createLibroProcedure({
        userId,
        book,
        areaId,
        name,
      });
      setNodes((prev) => [
        ...prev,
        {
          id: created.node_id,
          name: created.name,
          parent_node_id: areaId,
          tracking_mode: "counter",
        },
      ]);
      return created;
    } catch (error) {
      showSaveError(error);
      return null;
    }
  };

  const addToFrequents = async (item) => {
    const next = [...(frequents || []), item];
    try {
      await saveFrequentProcedures(userId, next);
      setFrequents(next);
    } catch (error) {
      showSaveError(error);
    }
  };

  const handlePick = (item) => {
    const key = procedureKey(item);
    if (picker === "frequent") {
      setFrequentsDraft((prev) =>
        prev.some((existing) => procedureKey(existing) === key)
          ? prev
          : [...prev, item],
      );
      setPicker(null);
      return;
    }

    setPicker(null);
    setItems((prev) =>
      prev.some((existing) => procedureKey(existing) === key)
        ? prev
        : [...prev, item],
    );
    setCounts((prev) => ({ ...prev, [key]: Math.max(1, prev[key] || 0) }));

    if (!(frequents || []).some((existing) => procedureKey(existing) === key)) {
      Alert.alert(
        "¿Quieres añadirlo a tus procedimientos frecuentes?",
        item.name,
        [
          { text: "Solo para esta guardia", style: "cancel" },
          {
            text: "Sí, añadir a mis frecuentes",
            onPress: () => addToFrequents(item),
          },
        ],
      );
    }
  };

  const changeCount = (item, delta) => {
    const key = procedureKey(item);
    setCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + delta),
    }));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const shiftLabel = shift
    ? `Guardia · ${formatShiftDate(shift.event_date)}`
    : "Guardia";

  const pickerModal = (
    <ProcedurePickerModal
      visible={Boolean(picker)}
      catalog={catalog}
      excludeKeys={(picker === "frequent" ? frequentsDraft : items).map(
        procedureKey,
      )}
      areas={areas}
      canAddToLibro={canAddToLibro}
      onPick={handlePick}
      onCreate={handleCreateProcedure}
      onClose={() => setPicker(null)}
    />
  );

  if (loading || mode === "loading") {
    return (
      <HeroScreenLayout title="Mi guardia" onBack={onBack}>
        <View style={styles.center}>
          {loadError ? (
            <>
              <Text style={styles.centerText}>{loadError}</Text>
              <TouchableOpacity
                style={debriefStyles.ghostButton}
                onPress={load}
              >
                <Text style={debriefStyles.ghostButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator size="large" color="#670CF5" />
          )}
        </View>
      </HeroScreenLayout>
    );
  }

  if (mode === "missing") {
    return (
      <HeroScreenLayout title="Mi guardia" onBack={onBack}>
        <View style={styles.center}>
          <Icon name="moon-outline" size={28} color="#EA580C" />
          <Text style={styles.centerText}>
            Esta guardia ya no está en tu agenda.
          </Text>
        </View>
      </HeroScreenLayout>
    );
  }

  if (mode === "setup" || mode === "frequents") {
    const isSetup = mode === "setup";
    return (
      <DebriefShell
        title={
          isSetup ? "Personaliza tus guardias" : "Editar mis procedimientos"
        }
        onBack={isSetup ? onBack : () => setMode(returnMode || "step")}
        primaryLabel={
          isSetup ? "Guardar mis procedimientos frecuentes" : "Guardar"
        }
        onPrimary={handleSaveFrequents}
        saving={saving}
        overlay={pickerModal}
        testID="debrief-frequents"
      >
        {isSetup ? (
          <>
            <Text style={debriefStyles.lead}>
              Cada especialidad y cada guardia son diferentes. Selecciona los
              procedimientos que realizas habitualmente para poder registrarlos
              en segundos después de cada guardia.
            </Text>
          </>
        ) : (
          <Text style={debriefStyles.lead}>
            Añade, quita u ordena tus procedimientos frecuentes. Lo que ya
            registraste en otras guardias no cambia.
          </Text>
        )}
        <FrequentProceduresList
          items={frequentsDraft}
          onRemove={(index) =>
            setFrequentsDraft((prev) => prev.filter((_, i) => i !== index))
          }
          onMove={(index, direction) =>
            setFrequentsDraft((prev) => moveItem(prev, index, direction))
          }
          onAdd={() => setPicker("frequent")}
        />
      </DebriefShell>
    );
  }

  if (mode === "step") {
    const stepProps = {
      title: shiftLabel,
      onBack: handleStepBack,
      step,
      saving,
      overlay: pickerModal,
    };

    if (step === 1) {
      return (
        <DebriefShell
          {...stepProps}
          rightSlot={
            <TouchableOpacity
              onPress={openFrequentsEditor}
              testID="debrief-edit-frequents"
            >
              <Text style={styles.headerAction}>⚙️ Editar</Text>
            </TouchableOpacity>
          }
          primaryLabel="Siguiente"
          onPrimary={() => goToStep(2)}
          testID="debrief-step-1"
        >
          <Text style={debriefStyles.title}>
            🎯 ¿Qué has hecho en esta guardia?
          </Text>
          <Text style={debriefStyles.lead}>¡Vamos a sumar experiencia!</Text>

          {!libroWritable ? (
            <View style={debriefStyles.privacy}>
              <Icon
                name="information-circle-outline"
                size={16}
                color="#0369A1"
              />
              <Text style={debriefStyles.privacyText}>
                Tu Libro de este año está cerrado: los procedimientos se guardan
                en tu guardia, pero no suman en el Libro.
              </Text>
            </View>
          ) : null}

          {items.length ? (
            <View style={debriefStyles.card}>
              {items.map((item) => {
                const key = procedureKey(item);
                const value = counts[key] || 0;
                return (
                  <View key={key} style={styles.counterRow}>
                    <View style={styles.counterCopy}>
                      <Text style={styles.counterName}>{item.name}</Text>
                      {!item.node_id ? (
                        <Text style={styles.counterMeta}>
                          Solo en tus guardias
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.counterButton,
                        value === 0 && styles.counterButtonDisabled,
                      ]}
                      onPress={() => changeCount(item, -1)}
                      disabled={value === 0}
                      accessibilityLabel={`Restar ${item.name}`}
                      testID={`counter-minus-${item.name}`}
                    >
                      <Icon name="remove" size={18} color="#670CF5" />
                    </TouchableOpacity>
                    <Text
                      style={styles.counterValue}
                      testID={`counter-value-${item.name}`}
                    >
                      {value}
                    </Text>
                    <TouchableOpacity
                      style={[styles.counterButton, styles.counterButtonPlus]}
                      onPress={() => changeCount(item, 1)}
                      accessibilityLabel={`Sumar ${item.name}`}
                      testID={`counter-plus-${item.name}`}
                    >
                      <Icon name="add" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={debriefStyles.lead}>
              No tienes procedimientos frecuentes. Añade lo que hayas hecho
              abajo.
            </Text>
          )}

          <TouchableOpacity
            style={debriefStyles.ghostButton}
            onPress={() => setPicker("shift")}
            testID="debrief-add-other"
          >
            <Icon name="add" size={18} color="#670CF5" />
            <Text style={debriefStyles.ghostButtonText}>
              He realizado otro procedimiento
            </Text>
          </TouchableOpacity>
        </DebriefShell>
      );
    }

    if (step === 2) {
      return (
        <DebriefShell
          {...stepProps}
          primaryLabel="Siguiente"
          onPrimary={() => goToStep(3)}
          testID="debrief-step-2"
        >
          <Text style={debriefStyles.title}>
            💪 ¿Cómo te has desenvuelto durante esta guardia?
          </Text>
          {AUTONOMY_OPTIONS.map((option) => {
            const selected = autonomy === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.bigCard, selected && styles.cardSelected]}
                onPress={() => setAutonomy(option.value)}
                accessibilityState={{ selected }}
                testID={`autonomy-${option.value}`}
              >
                <Text style={styles.bigEmoji}>{option.emoji}</Text>
                <Text
                  style={[styles.bigCardText, selected && styles.selectedText]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {showAutonomyComment ? (
            <TextInput
              style={debriefStyles.input}
              value={autonomyComment}
              onChangeText={setAutonomyComment}
              placeholder="Opcional"
              placeholderTextColor="#94A3B8"
              multiline
            />
          ) : (
            <TouchableOpacity onPress={() => setShowAutonomyComment(true)}>
              <Text style={styles.link}>+ Quiero añadir un comentario</Text>
            </TouchableOpacity>
          )}
        </DebriefShell>
      );
    }

    if (step === 3) {
      return (
        <DebriefShell
          {...stepProps}
          primaryLabel="Siguiente"
          onPrimary={() => goToStep(4)}
          testID="debrief-step-3"
        >
          <Text style={debriefStyles.title}>
            🧠 ¿Qué te llevas de esta guardia?
          </Text>
          <Text style={debriefStyles.lead}>
            Puedes seleccionar varias opciones.
          </Text>
          <View style={styles.grid}>
            {LEARNING_OPTIONS.map((option) => {
              const selected = learnings.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.gridCard, selected && styles.cardSelected]}
                  onPress={() =>
                    setLearnings((prev) =>
                      selected
                        ? prev.filter((value) => value !== option.value)
                        : [...prev, option.value],
                    )
                  }
                  accessibilityState={{ selected }}
                  testID={`learning-${option.value}`}
                >
                  {selected ? (
                    <View
                      style={styles.check}
                      testID={`learning-checked-${option.value}`}
                    >
                      <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                  <Text style={styles.gridEmoji}>{option.emoji}</Text>
                  <Text
                    style={[styles.gridText, selected && styles.selectedText]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {showLearningNote ? (
            <>
              <TextInput
                style={debriefStyles.input}
                value={learningNote}
                onChangeText={setLearningNote}
                placeholder="¿Qué has aprendido o qué situación te gustaría recordar?"
                placeholderTextColor="#94A3B8"
                multiline
              />
              <Text style={styles.hint}>{PRIVACY_NOTICE}</Text>
            </>
          ) : (
            <TouchableOpacity onPress={() => setShowLearningNote(true)}>
              <Text style={styles.link}>+ Quiero explicar algo más</Text>
            </TouchableOpacity>
          )}
        </DebriefShell>
      );
    }

    return (
      <DebriefShell
        {...stepProps}
        primaryLabel="💜 Guardar mi guardia"
        onPrimary={handleFinish}
        testID="debrief-step-4"
      >
        <Text style={debriefStyles.title}>✨ ¿Cómo valorarías tu guardia?</Text>
        <View style={styles.ratingRow}>
          {RATING_OPTIONS.map((option) => {
            const selected = rating === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.ratingOption, selected && styles.cardSelected]}
                onPress={() => setRating(option.value)}
                accessibilityState={{ selected }}
                testID={`rating-${option.value}`}
              >
                <Text style={styles.ratingEmoji}>{option.emoji}</Text>
                <Text
                  style={[styles.ratingText, selected && styles.selectedText]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={debriefStyles.sectionLabel}>
          ¿Qué mejorarías para la próxima guardia?
        </Text>
        <TextInput
          style={debriefStyles.input}
          value={improvementNote}
          onChangeText={setImprovementNote}
          placeholder="Opcional"
          placeholderTextColor="#94A3B8"
          multiline
        />
      </DebriefShell>
    );
  }

  if (mode === "done") {
    const summary = summarizeDebrief(debrief);
    return (
      <DebriefShell
        title={shiftLabel}
        onBack={onBack}
        primaryLabel="Ver mi registro"
        onPrimary={() => {
          setDetailTab("summary");
          setMode("detail");
        }}
        secondaryLabel="Finalizar"
        onSecondary={onBack}
        testID="debrief-done"
      >
        <View style={styles.celebration}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={debriefStyles.title}>¡Guardia registrada!</Text>
          <Text style={debriefStyles.lead}>
            Una guardia más, una experiencia más.
          </Text>
        </View>
        <Text style={debriefStyles.sectionLabel}>Tu guardia en números</Text>
        <ShiftDebriefSummary debrief={debrief} />
        {summary.total > 0 || summary.learnings.length ? (
          <Text style={styles.allCounts}>✨ ¡Todo suma!</Text>
        ) : null}
        <TouchableOpacity
          style={debriefStyles.ghostButton}
          onPress={() => setMode("reflection")}
          testID="debrief-open-reflection"
        >
          <Text style={debriefStyles.ghostButtonText}>
            📝 Completar mi autoevaluación
          </Text>
        </TouchableOpacity>
      </DebriefShell>
    );
  }

  if (mode === "reflection") {
    return (
      <DebriefShell
        title="Autoevaluación ampliada"
        subtitle={shiftLabel}
        onBack={() =>
          setMode(debrief?.status === "completed" ? "detail" : "step")
        }
        primaryLabel="Guardar"
        onPrimary={handleSaveReflection}
        saving={saving}
        testID="debrief-reflection"
      >
        <Text style={styles.statusMeta}>{shiftLabel}</Text>
        <View style={debriefStyles.privacy}>
          <Icon name="shield-checkmark-outline" size={16} color="#0369A1" />
          <Text style={debriefStyles.privacyText}>
            Todo es opcional. {PRIVACY_NOTICE}
          </Text>
        </View>
        {REFLECTION_FIELDS.map((field) => (
          <View key={field.key} style={styles.field}>
            <Text style={debriefStyles.sectionLabel}>{field.title}</Text>
            <TextInput
              style={debriefStyles.input}
              value={reflection[field.key] || ""}
              onChangeText={(text) =>
                setReflection((prev) => ({ ...prev, [field.key]: text }))
              }
              placeholder={field.placeholder}
              placeholderTextColor="#94A3B8"
              multiline
              testID={`reflection-${field.key}`}
            />
          </View>
        ))}
        <View style={[debriefStyles.card, styles.shareRow]}>
          <View style={styles.shareCopy}>
            <Text style={styles.shareTitle}>Compartir con mi tutor</Text>
            <Text style={styles.hint}>
              Si no lo activas, esta reflexión es solo tuya. Tus procedimientos,
              autonomía, aprendizajes y valoración sí los podrá ver tu tutor.
            </Text>
          </View>
          <Switch
            value={shareReflection}
            onValueChange={setShareReflection}
            trackColor={{ true: "#670CF5" }}
            testID="reflection-share"
          />
        </View>
      </DebriefShell>
    );
  }

  // detail
  return (
    <DebriefShell
      title="Detalle de guardia"
      subtitle={shiftLabel}
      onBack={onBack}
      primaryLabel={
        detailTab === "summary"
          ? "Editar mi registro"
          : hasReflection(debrief?.reflection)
            ? "Editar mi autoevaluación"
            : "📝 Completar mi autoevaluación"
      }
      onPrimary={() => {
        if (detailTab === "summary") {
          setStep(1);
          setMode("step");
        } else {
          setMode("reflection");
        }
      }}
      overlay={pickerModal}
      testID="debrief-detail"
    >
      <View style={styles.statusRow}>
        <Text style={styles.statusMeta}>
          {`${formatShiftDate(shift?.event_date)} · ${
            shift?.metadata?.shift_duration
              ? `Guardia de ${shift.metadata.shift_duration}`
              : "Guardia"
          }`}
        </Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>Completada</Text>
        </View>
      </View>
      <View style={styles.tabs}>
        {[
          ["summary", "Resumen"],
          ["reflection", "Autoevaluación"],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, detailTab === key && styles.tabActive]}
            onPress={() => setDetailTab(key)}
            testID={`detail-tab-${key}`}
          >
            <Text
              style={[
                styles.tabText,
                detailTab === key && styles.tabTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {detailTab === "summary" ? (
        <>
          <ShiftDebriefSummary debrief={debrief} showNotes />
          <TouchableOpacity onPress={openFrequentsEditor}>
            <Text style={styles.link}>⚙️ Editar mis procedimientos</Text>
          </TouchableOpacity>
        </>
      ) : hasReflection(debrief?.reflection) ? (
        <>
          {REFLECTION_FIELDS.filter(
            (field) => debrief.reflection[field.key],
          ).map((field) => (
            <View key={field.key} style={debriefStyles.card}>
              <Text style={debriefStyles.sectionLabel}>{field.title}</Text>
              <Text style={styles.reflectionText}>
                {debrief.reflection[field.key]}
              </Text>
            </View>
          ))}
          <Text style={styles.hint}>
            {debrief.share_reflection_with_tutor
              ? "Compartida con tu tutor."
              : "Solo la ves tú: no la compartes con tu tutor."}
          </Text>
        </>
      ) : (
        <Text style={debriefStyles.lead}>
          Aún no has escrito tu autoevaluación de esta guardia. Es opcional.
        </Text>
      )}
    </DebriefShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  centerText: { fontSize: 15, color: "#475569", textAlign: "center" },
  headerAction: { fontSize: 14, fontWeight: "700", color: "#670CF5" },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
  },
  counterCopy: { flex: 1, gap: 1 },
  counterName: { fontSize: 15, fontWeight: "600", color: "#1B0977" },
  counterMeta: { fontSize: 11, color: "#94A3B8" },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1EBFF",
  },
  counterButtonPlus: { backgroundColor: "#670CF5" },
  counterButtonDisabled: { opacity: 0.4 },
  counterValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
  },
  bigCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E8EAF3",
  },
  cardSelected: { borderColor: "#670CF5", backgroundColor: "#F5F0FF" },
  bigEmoji: { fontSize: 30 },
  bigCardText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1B0977",
    lineHeight: 20,
  },
  selectedText: { color: "#670CF5", fontWeight: "700" },
  link: {
    fontSize: 14,
    fontWeight: "700",
    color: "#670CF5",
    paddingVertical: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCard: {
    width: "48%",
    flexGrow: 1,
    minHeight: 112,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E8EAF3",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  gridEmoji: { fontSize: 28 },
  gridText: {
    fontSize: 13,
    color: "#1B0977",
    textAlign: "center",
    lineHeight: 17,
  },
  hint: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  ratingRow: { flexDirection: "row", gap: 6 },
  ratingOption: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  ratingEmoji: { fontSize: 30 },
  ratingText: { fontSize: 11, color: "#475569", textAlign: "center" },
  celebration: { alignItems: "center", gap: 6, paddingVertical: 10 },
  celebrationEmoji: { fontSize: 44 },
  allCounts: {
    fontSize: 15,
    fontWeight: "700",
    color: "#670CF5",
    textAlign: "center",
  },
  field: { gap: 6 },
  shareRow: { flexDirection: "row", alignItems: "center" },
  shareCopy: { flex: 1, gap: 4 },
  shareTitle: { fontSize: 14, fontWeight: "800", color: "#1B0977" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusMeta: { fontSize: 13, color: "#64748B" },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
  },
  statusPillText: { fontSize: 12, fontWeight: "700", color: "#15803D" },
  tabs: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#EEF0F7",
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  tabTextActive: { color: "#670CF5", fontWeight: "800" },
  reflectionText: { fontSize: 14, color: "#334155", lineHeight: 20 },
});
