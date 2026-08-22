import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import posthogLogger from "../services/posthogService";
import {
  TUTORING_RESIDENT_FIELDS,
  TUTORING_STATE,
  getResidentTutoring,
  saveTutoringResidentAnswers,
  tutoringStateOf,
} from "../services/docenciaService";

/**
 * Las tutorías del residente.
 *
 * Una tutoría es UN registro compartido con su tutor, no dos copias. El residente no
 * la crea ni la programa: la programa el tutor desde el panel, y aquí la consulta.
 *
 * `shared_at` decide qué ve: la cita (fecha, tutor, estado) siempre; el contenido que
 * escribe el tutor solo cuando lo comparte. Eso lo aplica la vista
 * hospital_tutoring_for_resident, no esta pantalla: aquí los campos llegan ya en
 * blanco si no toca verlos.
 */

const STATE_COPY = {
  [TUTORING_STATE.UPCOMING]: { label: "Próxima", color: "#2563EB", bg: "#EFF6FF" },
  [TUTORING_STATE.PENDING]: {
    label: "Pendiente de completar",
    color: "#B45309",
    bg: "#FFFBEB",
  },
  [TUTORING_STATE.DONE]: { label: "Realizada", color: "#059669", bg: "#ECFDF5" },
  [TUTORING_STATE.CANCELLED]: { label: "Cancelada", color: "#64748B", bg: "#F1F5F9" },
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const CONTENT_FIELDS = [
  { key: "topics", label: "Temas tratados" },
  { key: "competencies_reviewed", label: "Competencias revisadas" },
  { key: "goals_achieved", label: "Objetivos alcanzados" },
  { key: "improvements", label: "A mejorar" },
  { key: "next_goals", label: "Objetivos para la próxima" },
  { key: "notes", label: "Observaciones" },
];

export default function TutoringScreen({ userProfile, onBack }) {
  const userId = userProfile?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  // Lo que el residente aporta. Se edita en el mismo detalle donde lee lo del tutor.
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await getResidentTutoring(userId);
      setItems(rows);
    } catch (error) {
      console.error("Error loading tutoring:", error);
      setItems([]);
    }
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    posthogLogger.logScreen("TutoringScreen");
    setLoading(true);
    // El guard evita el setState tras desmontar si el residente sale mientras carga.
    load().finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [load]);

  useEffect(() => {
    if (!openItem) return;
    setAnswers(openItem.resident_answers || {});
  }, [openItem]);

  const handleSaveAnswers = async () => {
    setSaving(true);
    try {
      await saveTutoringResidentAnswers(openItem.id, answers);
      posthogLogger.capture("resident_tutoring_answers_saved", {
        campos: Object.values(answers).filter((v) => String(v || "").trim()).length,
      });
      await load();
      setOpenItem(null);
    } catch (error) {
      Alert.alert("No se pudo guardar", "Inténtalo de nuevo en un momento.");
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    const now = new Date();
    const withState = items.map((item) => ({
      item,
      state: tutoringStateOf(item, now),
    }));

    return {
      upcoming: withState.filter((row) => row.state === TUTORING_STATE.UPCOMING),
      pending: withState.filter((row) => row.state === TUTORING_STATE.PENDING),
      rest: withState.filter(
        (row) =>
          row.state === TUTORING_STATE.DONE ||
          row.state === TUTORING_STATE.CANCELLED
      ),
    };
  }, [items]);

  const renderCard = ({ item, state }) => {
    const copy = STATE_COPY[state];

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        onPress={() => setOpenItem(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardDate}>{formatDateTime(item.scheduled_at)}</Text>
          <View style={[styles.badge, { backgroundColor: copy.bg }]}>
            <Text style={[styles.badgeText, { color: copy.color }]}>{copy.label}</Text>
          </View>
        </View>
        <Text style={styles.cardTutor}>
          {item.tutor_name || "Tu tutor"}
          {item.place ? ` · ${item.place}` : ""}
        </Text>
        {!item.is_shared && state === TUTORING_STATE.DONE ? (
          <Text style={styles.cardHint}>
            Tu tutor todavía no ha compartido el contenido.
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderGroup = (title, rows) =>
    rows.length ? (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{title}</Text>
        {rows.map(renderCard)}
      </View>
    ) : null;

  return (
    <HeroScreenLayout
      title="Tutorías"
      subtitle="Las reuniones que programa tu tutor"
      onBack={onBack}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#670CF5" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
              tintColor="#670CF5"
            />
          }
        >
          {items.length ? (
            <>
              {renderGroup("Próximas", groups.upcoming)}
              {renderGroup("Pendientes de completar", groups.pending)}
              {renderGroup("Historial", groups.rest)}
            </>
          ) : (
            <View style={styles.empty}>
              <Icon name="people-outline" size={24} color="#670CF5" />
              <Text style={styles.emptyTitle}>Todavía no tienes tutorías</Text>
              <Text style={styles.emptyText}>
                Cuando tu tutor programe una, la verás aquí y en tu Agenda.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={!!openItem}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenItem(null)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => setOpenItem(null)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>
                  {openItem ? formatDateTime(openItem.scheduled_at) : ""}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {openItem?.tutor_name || "Tu tutor"}
                  {openItem?.place ? ` · ${openItem.place}` : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setOpenItem(null)}
              >
                <Icon name="close" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent}>
              {openItem?.is_shared ? (
                CONTENT_FIELDS.filter((field) => openItem[field.key]).length ? (
                  CONTENT_FIELDS.filter((field) => openItem[field.key]).map((field) => (
                    <View key={field.key} style={styles.block}>
                      <Text style={styles.blockLabel}>{field.label}</Text>
                      <Text style={styles.blockText}>{openItem[field.key]}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.blockText}>
                    Tu tutor la ha compartido pero no ha escrito contenido.
                  </Text>
                )
              ) : (
                <View style={styles.notice}>
                  <Icon name="lock-closed-outline" size={16} color="#92400E" />
                  <Text style={styles.noticeText}>
                    El contenido de esta tutoría todavía no está compartido. Verás lo
                    que escriba tu tutor en cuanto la cierre.
                  </Text>
                </View>
              )}

              {/* Su parte. Va aparte de la del tutor a propósito: son el mismo
                  registro, pero cada uno escribe en lo suyo. Y su tutor lo ve en
                  cuanto lo guarda, sin esperar a que comparta la tutoría. */}
              {openItem?.status !== "cancelled" ? (
                <View style={styles.residentBlock}>
                  <Text style={styles.residentTitle}>Tu parte</Text>
                  <Text style={styles.residentHint}>
                    Lo que escribas aquí lo ve tu tutor en cuanto lo guardes.
                  </Text>

                  {TUTORING_RESIDENT_FIELDS.map((field) => (
                    <View key={field.key} style={styles.block}>
                      <Text style={styles.blockLabel}>{field.label}</Text>
                      <TextInput
                        style={styles.input}
                        value={answers[field.key] || ""}
                        onChangeText={(text) =>
                          setAnswers((prev) => ({ ...prev, [field.key]: text }))
                        }
                        placeholder="Escribe lo que quieras dejar anotado"
                        placeholderTextColor="#94A3B8"
                        multiline
                      />
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSaveAnswers}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Guardar mi parte</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 18, paddingBottom: 40 },
  group: { gap: 8 },
  groupTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardDate: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1B0977",
    textTransform: "capitalize",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cardTutor: { fontSize: 13, color: "#64748B" },
  cardHint: { fontSize: 12, color: "#94A3B8", fontStyle: "italic" },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 26,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#1B0977" },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  overlayTouchable: { flex: 1 },
  sheet: {
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sheetHeaderCopy: { flex: 1, gap: 4 },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
    textTransform: "capitalize",
  },
  sheetSubtitle: { fontSize: 13, color: "#64748B" },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  sheetBody: { maxHeight: 460 },
  sheetBodyContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  block: { gap: 4 },
  blockLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  blockText: { fontSize: 14, color: "#0F172A", lineHeight: 21 },
  notice: {
    flexDirection: "row",
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  noticeText: { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 19 },
  residentBlock: {
    marginTop: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
  },
  residentTitle: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  residentHint: { fontSize: 12, color: "#64748B", lineHeight: 17, marginTop: -8 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
    marginTop: 4,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
