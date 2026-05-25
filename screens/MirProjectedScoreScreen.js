import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { BottomMenuHeroHeader } from "../components/BottomMenuHeroHeader";
import { DatePickerInput } from "../components/DatePickerInput";
import { getCurrentUser } from "../services/authService";
import {
  addMockResult,
  getMockResultsForUser,
  deleteMockResult,
  projectOrder,
  MIR_EXAM_DATE,
  MOCK_SOURCES,
} from "../services/mirProjectionService";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const INDIGO = "#1B0977";
const BG_LIGHT = "#F8F9FE";

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatInt = (n) =>
  Number.isFinite(Number(n)) ? Number(n).toLocaleString("es-ES") : null;

const sourceName = (id) =>
  MOCK_SOURCES.find((s) => s.id === id)?.name || (id ? id : null);

function OrderSparkline({ results }) {
  const W = 300;
  const H = 120;
  const PAD = 16;

  const points = useMemo(() => {
    const valid = (results || [])
      .map((r) => ({ t: new Date(r.taken_at).getTime(), y: r.reported_order }))
      .filter((p) => !Number.isNaN(p.t) && Number.isFinite(p.y))
      .sort((a, b) => a.t - b.t);
    return valid;
  }, [results]);

  if (points.length < 2) return null;

  const ts = points.map((p) => p.t);
  const ys = points.map((p) => p.y);
  const minT = Math.min(...ts);
  const maxT = Math.max(...ts);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanT = maxT - minT || 1;
  const spanY = maxY - minY || 1;

  const sx = (t) => PAD + ((t - minT) / spanT) * (W - 2 * PAD);
  const sy = (y) => PAD + ((y - minY) / spanY) * (H - 2 * PAD);

  const coords = points.map((p) => `${sx(p.t)},${sy(p.y)}`).join(" ");

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#E2E8F0" strokeWidth="1" />
        <Line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#E2E8F0" strokeWidth="1" />
        <Polyline
          points={coords}
          fill="none"
          stroke={PRIMARY}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <Circle key={i} cx={sx(p.t)} cy={sy(p.y)} r="4" fill={PRIMARY} />
        ))}
      </Svg>
      <View style={styles.chartAxisRow}>
        <Text style={styles.chartAxisLabel}>⬆︎ mejor (orden más bajo)</Text>
      </View>
    </View>
  );
}

const sanitizeIntInput = (text) => text.replace(/[^0-9]/g, "").slice(0, 6);

export default function MirProjectedScoreScreen({
  onBack,
  userProfile,
  onOpenSimulator,
  onOpenOrientation,
  onOpenProfile,
}) {
  const [userId, setUserId] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [formLabel, setFormLabel] = useState("");
  const [formDate, setFormDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [formBest, setFormBest] = useState("");
  const [formWorst, setFormWorst] = useState("");
  const [formAcademyOnly, setFormAcademyOnly] = useState("");
  const [formError, setFormError] = useState(null);

  const academyName = sourceName(userProfile?.mir_academy);
  const hasExpediente =
    userProfile?.mir_expediente !== null &&
    userProfile?.mir_expediente !== undefined &&
    userProfile?.mir_expediente !== "";

  useEffect(() => {
    posthogLogger.logScreen("MirProjectedScoreScreen");
  }, []);

  const loadResults = useCallback(async (uid) => {
    if (!uid) return;
    setLoading(true);
    const res = await getMockResultsForUser(uid);
    if (res.success) {
      setResults(res.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { success, user } = await getCurrentUser();
      if (active && success && user?.id) {
        setUserId(user.id);
        await loadResults(user.id);
      } else if (active) {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadResults]);

  const projection = useMemo(
    () => projectOrder(results, MIR_EXAM_DATE),
    [results]
  );

  useEffect(() => {
    if (projection) {
      posthogLogger.capture("projected_score_viewed", {
        projected_order_expected: projection.projectedOrder,
        num_mocks: projection.count,
        confidence: projection.confidence,
        range_width: projection.rangeWidth,
      });
    }
  }, [projection]);

  const resetForm = () => {
    setFormLabel("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormBest("");
    setFormWorst("");
    setFormAcademyOnly("");
    setFormError(null);
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert("Inicia sesión", "Necesitas iniciar sesión para guardar simulacros.");
      return;
    }

    const best = formBest ? parseInt(formBest, 10) : null;
    const worst = formWorst ? parseInt(formWorst, 10) : null;
    const academyOnly = formAcademyOnly ? parseInt(formAcademyOnly, 10) : null;

    if (!best && !worst) {
      setFormError("Introduce al menos el puesto MIR (mejor o peor caso).");
      return;
    }
    if (best && worst && best > worst) {
      setFormError("El mejor caso no puede ser mayor que el peor caso.");
      return;
    }

    setSaving(true);
    const res = await addMockResult(userId, {
      takenAt: formDate,
      source: userProfile?.mir_academy || null,
      simulacroLabel: formLabel || null,
      reportedOrderBest: best,
      reportedOrderWorst: worst,
      academyOnlyOrder: academyOnly,
    });
    setSaving(false);

    if (res.success) {
      posthogLogger.capture("mir_mock_result_added", {
        source: userProfile?.mir_academy || null,
        has_range: !!(best && worst),
        has_academy_only: academyOnly !== null,
      });
      setModalVisible(false);
      resetForm();
      await loadResults(userId);
    } else {
      setFormError(res.error || "No se pudo guardar el simulacro.");
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      "Eliminar simulacro",
      `¿Eliminar el simulacro del ${formatDate(item.taken_at)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const res = await deleteMockResult(item.id);
            if (res.success) {
              setResults((prev) => prev.filter((r) => r.id !== item.id));
            }
          },
        },
      ]
    );
  };

  const handleOpenSimulator = () => {
    if (!projection) return;
    posthogLogger.capture("projection_to_plaza_clicked", {
      projected_order_expected: projection.projectedOrder,
      speciality_id: userProfile?.speciality_id || null,
    });
    onOpenSimulator?.(projection.projectedOrder);
  };

  const handleOpenOrientation = () => {
    if (!projection) return;
    posthogLogger.capture("projection_to_orientation_clicked", {
      projected_order_expected: projection.projectedOrder,
    });
    onOpenOrientation?.(projection.projectedOrder);
  };

  const canSave = (!!formBest || !!formWorst) && !saving;

  const renderMockRow = (item) => {
    const best = item.reported_order_best;
    const worst = item.reported_order_worst;
    const single = item.reported_order;
    let rangeText;
    if (best && worst) {
      if (best === worst) rangeText = `MIR ~${formatInt(best)}`;
      else rangeText = `MIR ~${formatInt(best)}–${formatInt(worst)}`;
    } else if (single) {
      rangeText = `MIR ~${formatInt(single)}`;
    }
    const academyOnlyText = item.academy_only_order
      ? `${academyName || "Academia"} Nº ${formatInt(item.academy_only_order)}`
      : null;

    const titleParts = [item.simulacro_label, formatDate(item.taken_at)].filter(
      Boolean
    );
    if (!item.simulacro_label && sourceName(item.source)) {
      titleParts.unshift(sourceName(item.source));
    }

    const dataParts = [rangeText, academyOnlyText].filter(Boolean);

    return (
      <View key={item.id} style={styles.mockRow}>
        <View style={styles.mockRowLeft}>
          <Text style={styles.mockTitle}>{titleParts.join(" · ")}</Text>
          {dataParts.length > 0 && (
            <Text style={styles.mockData}>{dataParts.join("  ·  ")}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroShell}>
        <BottomMenuHeroHeader
          title="Nota proyectada"
          subtitle="Registra tus simulacros y estima tu número de orden final."
          leftSlot={
            onBack ? (
              <TouchableOpacity onPress={onBack} hitSlop={10}>
                <Ionicons name="chevron-back" size={26} color={INDIGO} />
              </TouchableOpacity>
            ) : null
          }
        />
      </View>

      <View style={styles.contentShell}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!hasExpediente && (
            <View style={styles.expedienteBanner}>
              <Ionicons name="school" size={18} color={PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expedienteBannerTitle}>
                  Añade tu expediente académico
                </Text>
                <Text style={styles.expedienteBannerText}>
                  Pondera el 10% en el cálculo oficial del MIR. Sin él, el
                  puesto estimado puede desviarse.
                </Text>
              </View>
              {onOpenProfile && (
                <TouchableOpacity
                  style={styles.expedienteBannerCta}
                  onPress={onOpenProfile}
                  activeOpacity={0.9}
                >
                  <Text style={styles.expedienteBannerCtaText}>Añadir</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {projection ? (
            <View style={styles.projectionCard}>
              <View style={styles.projectionHeader}>
                <Text style={styles.projectionLabel}>
                  Tu número de orden proyectado
                </Text>
              </View>

              <Text style={styles.projectionValue}>
                ≈ {projection.projectedOrder.toLocaleString("es-ES")}
              </Text>
              <Text style={styles.projectionRange}>
                Entre mejor y peor caso:{" "}
                {projection.best.toLocaleString("es-ES")} –{" "}
                {projection.worst.toLocaleString("es-ES")}
              </Text>
              {projection.confidence === "low" && (
                <Text style={styles.projectionHint}>
                  Con más simulacros este rango se estrechará.
                </Text>
              )}

              <OrderSparkline results={results} />

              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleOpenSimulator}
                activeOpacity={0.9}
              >
                <Ionicons name="school" size={18} color="#FFF" />
                <Text style={styles.ctaButtonText}>Ver qué plazas puedo coger</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ctaSecondaryButton}
                onPress={handleOpenOrientation}
                activeOpacity={0.9}
              >
                <Ionicons name="compass" size={18} color={PRIMARY} />
                <Text style={styles.ctaSecondaryButtonText}>
                  Ver qué especialidad me encaja
                </Text>
              </TouchableOpacity>

              <Text style={styles.projectionDisclaimer}>
                Estimación orientativa basada en la tendencia de tus simulacros. No es
                una predicción oficial. Lo que importa es tu propia evolución.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyProjection}>
              <Ionicons name="trending-up" size={28} color={PRIMARY} />
              <Text style={styles.emptyProjectionTitle}>
                {results.length === 0
                  ? "Registra tu primer simulacro"
                  : "Registra al menos 2 simulacros"}
              </Text>
              <Text style={styles.emptyProjectionText}>
                Copia los datos tal cual te los envía tu academia (NETO, puesto
                MIR y puesto entre alumnos) y proyectamos tu orden final.
              </Text>
              <TouchableOpacity
                style={styles.emptyCtaButton}
                onPress={() => {
                  resetForm();
                  setModalVisible(true);
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyCtaButtonText}>Añadir simulacro</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.listCard}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Tus simulacros</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  resetForm();
                  setModalVisible(true);
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.addButtonText}>Añadir</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 24 }} />
            ) : results.length === 0 ? (
              <Text style={styles.emptyListText}>
                Todavía no has registrado ningún simulacro.
              </Text>
            ) : (
              <View style={styles.list}>
                {[...results]
                  .sort((a, b) => new Date(b.taken_at) - new Date(a.taken_at))
                  .map(renderMockRow)}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Añadir simulacro</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalForm}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionHeader}>Identificación</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nombre del simulacro</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: SM-2"
                  placeholderTextColor="#94A3B8"
                  value={formLabel}
                  onChangeText={(text) => setFormLabel(text.slice(0, 24))}
                  maxLength={24}
                  autoFocus
                />
                <Text style={styles.fieldHint}>
                  Tal como lo llama tu academia (SM-1, Simulacro 3, etc.).
                </Text>
              </View>

              <View style={styles.field}>
                <DatePickerInput
                  label="Fecha del simulacro *"
                  value={formDate}
                  onChange={setFormDate}
                  placeholder="Selecciona la fecha"
                />
              </View>

              <Text style={styles.sectionHeader}>
                Datos del simulacro
                {academyName ? ` (lo que te envía ${academyName})` : ""}
              </Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Puesto en el MIR real *</Text>
                <View style={styles.rangeRow}>
                  <View style={styles.rangeCol}>
                    <Text style={styles.rangeSubLabel}>Mejor caso</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej: 1442"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={formBest}
                      onChangeText={(text) => setFormBest(sanitizeIntInput(text))}
                      maxLength={6}
                    />
                  </View>
                  <Text style={styles.rangeDash}>–</Text>
                  <View style={styles.rangeCol}>
                    <Text style={styles.rangeSubLabel}>Peor caso</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej: 1445"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={formWorst}
                      onChangeText={(text) => setFormWorst(sanitizeIntInput(text))}
                      maxLength={6}
                    />
                  </View>
                </View>
                <Text style={styles.fieldHint}>
                  La academia te lo da como rango (ej. 1.442–1.445). Si sólo tienes un
                  número, métalo en ambos.
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  Puesto entre alumnos de tu academia
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: 7417"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={formAcademyOnly}
                  onChangeText={(text) =>
                    setFormAcademyOnly(sanitizeIntInput(text))
                  }
                  maxLength={6}
                />
                <Text style={styles.fieldHint}>
                  El "Nº" que tu academia te asigna sólo entre sus presentados.
                </Text>
              </View>

              {formError && <Text style={styles.formError}>{formError}</Text>}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!canSave}
                activeOpacity={0.9}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_LIGHT },
  heroShell: { position: "relative" },
  contentShell: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  expedienteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3EBFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E0D2FF",
  },
  expedienteBannerTitle: { fontSize: 13, fontWeight: "700", color: INDIGO },
  expedienteBannerText: { fontSize: 12, color: "#475569", marginTop: 2 },
  expedienteBannerCta: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  expedienteBannerCtaText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  projectionCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
  },
  projectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  projectionLabel: { fontSize: 14, fontWeight: "600", color: "#64748B", flex: 1 },
  projectionValue: { fontSize: 40, fontWeight: "800", color: INDIGO, marginTop: 4 },
  projectionRange: { fontSize: 14, color: "#64748B", marginTop: 2 },
  projectionHint: { fontSize: 12, color: "#94A3B8", marginTop: 6, fontStyle: "italic" },

  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 20,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  ctaSecondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  ctaSecondaryButtonText: { color: PRIMARY, fontSize: 15, fontWeight: "700" },
  projectionDisclaimer: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 14,
    lineHeight: 17,
  },

  chartWrap: { marginTop: 20 },
  chartAxisRow: { marginTop: 6, alignItems: "flex-start" },
  chartAxisLabel: { fontSize: 11, color: "#94A3B8" },

  emptyProjection: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 16,
    marginTop: 12,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
  },
  emptyProjectionTitle: { fontSize: 17, fontWeight: "700", color: INDIGO },
  emptyProjectionText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyCtaButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },

  listCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listTitle: { fontSize: 18, fontWeight: "600", color: INDIGO },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addButtonText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  emptyListText: { fontSize: 14, color: "#94A3B8", paddingVertical: 12 },
  list: { gap: 10 },
  mockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mockRowLeft: { flex: 1, paddingRight: 12 },
  mockTitle: { fontSize: 15, fontWeight: "700", color: INDIGO },
  mockData: { fontSize: 13, color: "#475569", marginTop: 4, lineHeight: 18 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBackdrop: { flex: 1 },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAF3",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: INDIGO },
  modalForm: { padding: 20 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 4,
  },
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: INDIGO, marginBottom: 8 },
  input: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: INDIGO,
  },
  fieldHint: { fontSize: 12, color: "#94A3B8", marginTop: 6 },
  rangeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  rangeCol: { flex: 1 },
  rangeSubLabel: { fontSize: 12, color: "#64748B", marginBottom: 4 },
  rangeDash: { fontSize: 18, color: "#94A3B8", paddingBottom: 14 },
  formError: {
    fontSize: 13,
    color: "#DC2626",
    marginTop: 4,
    marginBottom: 8,
  },
  modalActions: { paddingHorizontal: 20, paddingTop: 4 },
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: "#CBD5E1" },
  saveButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
