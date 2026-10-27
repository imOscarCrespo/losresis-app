import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import TutoringPreparationView from "../components/tutoring/TutoringPreparationView";
import posthogLogger from "../services/posthogService";
import {
  TUTORING_RESIDENT_FIELDS,
  TUTORING_STATE,
  getResidentTutoring,
  getTutoringPreparations,
  saveTutoringPreparation,
  tutoringStateOf,
} from "../services/docenciaService";
import {
  PREPARATION_STATUS,
  buildPreparationPayload,
  canEditPreparation,
  preparationCounts,
  preparationStatusOf,
} from "../utils/tutoringPreparation";

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
 *
 * Lo del residente es su «Preparación de mi tutoría» (hospital_tutoring_preparation):
 * un borrador privado hasta que la envía. Los cuatro textos antiguos
 * (resident_answers) ya no se editan aquí; si los tiene, se enseñan en solo lectura.
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

const formatShortDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit" }).format(date);
};

const PREPARATION_COPY = {
  [PREPARATION_STATUS.NONE]: { label: "Sin iniciar", color: "#64748B", bg: "#F1F5F9" },
  [PREPARATION_STATUS.DRAFT]: { label: "Borrador", color: "#B45309", bg: "#FFFBEB" },
  [PREPARATION_STATUS.SENT]: { label: "Enviada", color: "#047857", bg: "#ECFDF5" },
};

const preparationLabel = (status, preparation) =>
  status === PREPARATION_STATUS.SENT && preparation?.sent_at
    ? `Enviada el ${formatShortDate(preparation.sent_at)}`
    : PREPARATION_COPY[status].label;

const hasLegacyAnswers = (tutoring) =>
  TUTORING_RESIDENT_FIELDS.some((field) =>
    String(tutoring?.resident_answers?.[field.key] || "").trim()
  );

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
  // Por id y no la fila: tras guardar se recarga y el detalle enseña lo nuevo.
  const [openId, setOpenId] = useState(null);
  const [preparingId, setPreparingId] = useState(null);
  // tutoring_id → su preparación. null = no se pudo cargar: sin ella no se deja
  // editar, porque guardar encima de un borrador que no se ha leído lo borraría.
  const [preparations, setPreparations] = useState({});

  const load = useCallback(async () => {
    if (!userId) return;
    let rows = [];
    try {
      rows = await getResidentTutoring(userId);
      setItems(rows);
    } catch (error) {
      console.error("Error loading tutoring:", error);
      setItems([]);
      return;
    }
    try {
      const preps = await getTutoringPreparations(rows.map((row) => row.id));
      setPreparations(Object.fromEntries(preps.map((prep) => [prep.tutoring_id, prep])));
    } catch (error) {
      console.error("Error loading tutoring preparations:", error);
      setPreparations(null);
    }
  }, [userId]);

  const openItem = useMemo(
    () => items.find((item) => item.id === openId) || null,
    [items, openId]
  );
  const preparingItem = useMemo(
    () => items.find((item) => item.id === preparingId) || null,
    [items, preparingId]
  );

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

  // Lanza si falla: el formulario se queda abierto con lo escrito y avisa.
  const handleSavePreparation = async (answers, goals, send) => {
    const payload = buildPreparationPayload(answers, goals);
    const saved = await saveTutoringPreparation(
      preparingId,
      payload.answers,
      payload.proposedGoals,
      send
    );
    posthogLogger.capture("resident_tutoring_preparation_saved", {
      sent: saved?.status === "sent",
      ...preparationCounts(answers, goals),
    });
    await load();
    closePreparation();
  };

  // Al salir del formulario se vuelve al detalle de la tutoría, no a la lista.
  const closePreparation = () => {
    setOpenId(preparingId);
    setPreparingId(null);
  };

  const preparationOf = (id) => (preparations ? preparations[id] || null : null);

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

  const renderPreparationChip = (item, testID) => {
    const preparation = preparationOf(item.id);
    const status = preparationStatusOf(preparation);
    // En las cerradas solo se enseña si llegó a prepararla.
    if (!canEditPreparation(item) && status === PREPARATION_STATUS.NONE) return null;
    if (!preparations) return null;
    const copy = PREPARATION_COPY[status];

    return (
      <View testID={testID} style={[styles.prepChip, { backgroundColor: copy.bg }]}>
        <Icon name="document-text-outline" size={13} color={copy.color} />
        <Text style={[styles.prepChipText, { color: copy.color }]}>
          Preparación: {preparationLabel(status, preparation)}
        </Text>
      </View>
    );
  };

  const renderCard = ({ item, state }) => {
    const copy = STATE_COPY[state];

    return (
      <TouchableOpacity
        key={item.id}
        testID={`tutoring-card-${item.id}`}
        style={styles.card}
        onPress={() => setOpenId(item.id)}
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
        {renderPreparationChip(item)}
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

  if (preparingItem) {
    return (
      <TutoringPreparationView
        tutoring={preparingItem}
        preparation={preparationOf(preparingItem.id)}
        subtitle={formatDateTime(preparingItem.scheduled_at)}
        onSave={handleSavePreparation}
        onClose={closePreparation}
      />
    );
  }

  const openPreparation = openItem ? preparationOf(openItem.id) : null;
  const openPreparationStatus = preparationStatusOf(openPreparation);

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
        onRequestClose={() => setOpenId(null)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => setOpenId(null)}
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
                onPress={() => setOpenId(null)}
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

              {/* Su parte: la preparación. Va aparte de lo del tutor a propósito:
                  cada uno escribe en lo suyo, y la suya es un borrador privado
                  hasta que la envía. */}
              {openItem && openItem.status !== "cancelled" ? (
                <View style={styles.residentBlock}>
                  <View style={styles.residentHeader}>
                    <Text style={styles.residentTitle}>Preparación de mi tutoría</Text>
                    {renderPreparationChip(openItem, "tutoring-detail-preparation-status")}
                  </View>
                  {!preparations ? (
                    <Text style={styles.residentHint}>
                      No se ha podido cargar tu preparación. Desliza hacia abajo en la
                      lista para recargar.
                    </Text>
                  ) : canEditPreparation(openItem) ? (
                    <>
                      <Text style={styles.residentHint}>
                        {openPreparationStatus === PREPARATION_STATUS.SENT
                          ? "Tu tutor ya la tiene. Puedes seguir editándola hasta la tutoría."
                          : "Reflexiona sobre este período antes de la reunión. Tu tutor la verá cuando la envíes."}
                      </Text>
                      <TouchableOpacity
                        testID="tutoring-open-preparation"
                        style={styles.saveButton}
                        onPress={() => {
                          setPreparingId(openItem.id);
                          setOpenId(null);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.saveButtonText}>
                          {openPreparationStatus === PREPARATION_STATUS.NONE
                            ? "Preparar mi tutoría"
                            : openPreparationStatus === PREPARATION_STATUS.DRAFT
                            ? "Continuar preparación"
                            : "Ver o editar mi preparación"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : openPreparationStatus !== PREPARATION_STATUS.NONE ? (
                    <TouchableOpacity
                      testID="tutoring-open-preparation"
                      style={styles.secondaryButton}
                      onPress={() => {
                        setPreparingId(openItem.id);
                        setOpenId(null);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryButtonText}>Ver mi preparación</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.residentHint}>
                      No preparaste esta tutoría.
                    </Text>
                  )}
                </View>
              ) : null}

              {/* Los cuatro textos de antes de la preparación guiada: no se migran
                  ni se editan, pero son suyos y se siguen viendo. */}
              {openItem && hasLegacyAnswers(openItem) ? (
                <View style={styles.residentBlock}>
                  <Text style={styles.residentTitle}>Lo que escribiste antes</Text>
                  {TUTORING_RESIDENT_FIELDS.filter((field) =>
                    String(openItem.resident_answers?.[field.key] || "").trim()
                  ).map((field) => (
                    <View key={field.key} style={styles.block}>
                      <Text style={styles.blockLabel}>{field.label}</Text>
                      <Text style={styles.blockText}>
                        {openItem.resident_answers[field.key]}
                      </Text>
                    </View>
                  ))}
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
  residentHeader: { gap: 8, alignItems: "flex-start" },
  residentTitle: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  residentHint: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  prepChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  prepChipText: { fontSize: 11, fontWeight: "700" },
  saveButton: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
    marginTop: 4,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#670CF5",
  },
  secondaryButtonText: { color: "#670CF5", fontSize: 15, fontWeight: "700" },
});
