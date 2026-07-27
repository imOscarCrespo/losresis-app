import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { COLORS } from "../constants/colors";
import posthogLogger from "../services/posthogService";
import {
  closeServiceReminder,
  createServiceReminder,
  daysOverdue,
  ensureServicio,
  findCasoByNhc,
  getResidentPeers,
  getServiceReminders,
  reopenServiceReminder,
  residentDisplayName,
} from "../services/serviceRemindersService";

const OVERDUE_BG = "#FEE4E2";
const OVERDUE_TEXT = "#B42318";

const toISODate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const formatShortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });

// "Recordatorios del servicio": la vista del Residente sobre el tablón
// compartido de losresis-panel (misma tabla `recordatorio`, mismo ciclo).
// Ve lo asignado a él y lo sin asignar de su servicio; cerrar es "Hecho".
// Ver CONTEXT.md → Recordatorio del servicio.
export default function ServiceRemindersScreen({ userProfile, onBack }) {
  const userId = userProfile?.id || null;
  const hospitalId = userProfile?.hospital_id || null;
  const specialityId = userProfile?.speciality_id || null;

  const [servicioId, setServicioId] = useState(null);
  const [lists, setLists] = useState({
    forMe: [],
    unassigned: [],
    recentlyClosed: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [composerVisible, setComposerVisible] = useState(false);
  const [peers, setPeers] = useState(null); // null = aún no cargados

  useEffect(() => {
    posthogLogger.logScreen("ServiceRemindersScreen");
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId || !hospitalId || !specialityId) {
        setLoading(false);
        return;
      }
      if (!silent) {
        setLoading(true);
      }
      try {
        setError(null);
        const id = servicioId || (await ensureServicio(hospitalId, specialityId));
        if (!servicioId) {
          setServicioId(id);
        }
        const data = await getServiceReminders(id, userId);
        setLists(data);
      } catch (err) {
        console.error("Error loading service reminders:", err);
        setError("No se pudieron cargar los recordatorios de tu servicio");
      } finally {
        setLoading(false);
      }
    },
    [userId, hospitalId, specialityId, servicioId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }, [load]);

  const markDone = useCallback(
    async (reminder) => {
      try {
        await closeServiceReminder(reminder.id, userId);
        await load({ silent: true });
      } catch (err) {
        console.error("Error closing reminder:", err);
        setError("No se pudo marcar como hecho");
      }
    },
    [userId, load]
  );

  const reopen = useCallback(
    async (reminder) => {
      try {
        await reopenServiceReminder(reminder.id);
        await load({ silent: true });
      } catch (err) {
        console.error("Error reopening reminder:", err);
        setError("No se pudo reabrir");
      }
    },
    [load]
  );

  const openComposer = useCallback(async () => {
    setComposerVisible(true);
    if (peers === null && hospitalId && specialityId) {
      try {
        setPeers(await getResidentPeers(hospitalId, specialityId));
      } catch (err) {
        console.error("Error loading resident peers:", err);
        setPeers([]);
      }
    }
  }, [peers, hospitalId, specialityId]);

  const handleCreate = useCallback(
    async ({ texto, fecha, nhc, destinatarioUserId }) => {
      const caso = nhc ? await findCasoByNhc(servicioId, nhc) : null;
      await createServiceReminder({
        servicioId,
        texto,
        fecha,
        casoId: caso?.id || null,
        destinatarioUserId,
        autorUserId: userId,
      });
      setComposerVisible(false);
      await load({ silent: true });
    },
    [servicioId, userId, load]
  );

  const ReminderCard = ({ reminder, closed = false }) => {
    const overdue = closed ? 0 : daysOverdue(reminder.fecha);
    return (
      <View style={[styles.card, !closed && overdue > 0 && styles.cardOverdue]}>
        <View style={styles.cardBody}>
          <Text style={[styles.cardText, closed && styles.cardTextClosed]}>
            {reminder.texto}
          </Text>
          <View style={styles.cardMetaRow}>
            {!closed && overdue > 0 ? (
              <View style={styles.overduePill}>
                <Text style={styles.overduePillText}>
                  Vencido hace {overdue} día{overdue === 1 ? "" : "s"}
                </Text>
              </View>
            ) : (
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>
                  {formatShortDate(reminder.fecha)}
                </Text>
              </View>
            )}
            {reminder.caso?.nhc ? (
              <Text style={styles.cardMeta}>NHC {reminder.caso.nhc}</Text>
            ) : null}
          </View>
        </View>
        {closed ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => reopen(reminder)}
            activeOpacity={0.85}
          >
            <Icon name="arrow-undo" size={16} color={COLORS.PRIMARY} />
            <Text style={styles.secondaryButtonText}>Reabrir</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => markDone(reminder)}
            activeOpacity={0.85}
          >
            <Icon name="checkmark" size={16} color="#FFFFFF" />
            <Text style={styles.doneButtonText}>Hecho</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const Section = ({ title, count, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
        {count > 0 ? ` · ${count}` : ""}
      </Text>
      {children}
    </View>
  );

  return (
    <HeroScreenLayout
      title="Recordatorios del servicio"
      subtitle="Lo que tu servicio comparte y lo que te señalan a ti"
      onBack={onBack}
      rightSlot={
        <TouchableOpacity
          style={styles.addButton}
          onPress={openComposer}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Nuevo recordatorio"
        >
          <Icon name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      }
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Section title="Para mí" count={lists.forMe.length}>
            {lists.forMe.length === 0 ? (
              <Text style={styles.emptyText}>
                Nada señalado a ti. Cuando alguien te asigne un recordatorio,
                recibirás un aviso y lo verás aquí.
              </Text>
            ) : (
              lists.forMe.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))
            )}
          </Section>

          <Section
            title="Del servicio · sin asignar"
            count={lists.unassigned.length}
          >
            {lists.unassigned.length === 0 ? (
              <Text style={styles.emptyText}>
                El tablón del servicio está vacío. Lo sin asignar es de quien
                esté de turno — cualquiera puede cerrarlo.
              </Text>
            ) : (
              lists.unassigned.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))
            )}
          </Section>

          {lists.recentlyClosed.length > 0 ? (
            <Section title="Hechos hoy" count={lists.recentlyClosed.length}>
              {lists.recentlyClosed.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} closed />
              ))}
            </Section>
          ) : null}
        </ScrollView>
      )}

      <ReminderComposer
        visible={composerVisible}
        peers={peers}
        currentUserId={userId}
        onClose={() => setComposerVisible(false)}
        onSubmit={handleCreate}
      />
    </HeroScreenLayout>
  );
}

const RadioDot = ({ selected }) => (
  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
    {selected ? <View style={styles.radioInner} /> : null}
  </View>
);

// Formulario de creación: texto, fecha (hoy por defecto), NHC opcional y
// destinatario opcional. Sin asignar = "de quien esté de turno" (el caso
// mayoritario del tablón); asignado = push al elegido, lo pone el trigger.
const ReminderComposer = ({ visible, peers, currentUserId, onClose, onSubmit }) => {
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(() => toISODate(new Date()));
  const [nhc, setNhc] = useState("");
  const [destinatarioUserId, setDestinatarioUserId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState(null);

  useEffect(() => {
    if (visible) {
      setTexto("");
      setFecha(toISODate(new Date()));
      setNhc("");
      setDestinatarioUserId(null);
      setSubmitError(null);
      setSaving(false);
    }
  }, [visible]);

  const peerOptions = useMemo(
    () => (peers || []).filter((peer) => peer.id !== currentUserId),
    [peers, currentUserId]
  );

  const handleDateChange = (event, selected) => {
    if (Platform.OS === "android") {
      setDatePickerVisible(false);
      if (event.type === "set" && selected) {
        setFecha(toISODate(selected));
      }
      return;
    }
    setTempDate(selected || null);
  };

  const confirmIosDate = () => {
    if (tempDate) {
      setFecha(toISODate(tempDate));
    }
    setDatePickerVisible(false);
    setTempDate(null);
  };

  const submit = async () => {
    if (!texto.trim() || saving) {
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({
        texto,
        fecha,
        nhc: nhc.trim() || null,
        destinatarioUserId,
      });
    } catch (err) {
      console.error("Error creating service reminder:", err);
      setSubmitError("No se pudo crear el recordatorio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.composerSheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.composerTitle}>Nuevo recordatorio</Text>
          <Text style={styles.composerSubtitle}>
            Lo verá tu servicio en el panel. Si no lo asignas a nadie, es de
            quien esté de turno.
          </Text>

          <ScrollView
            style={styles.composerScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Qué hay que acordarse</Text>
            <TextInput
              style={styles.textArea}
              value={texto}
              onChangeText={setTexto}
              placeholder="Llamar a Anatomía Patológica por la biopsia de la 402"
              placeholderTextColor={COLORS.GRAY}
              multiline
            />

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Para cuándo</Text>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setDatePickerVisible(true)}
                  activeOpacity={0.85}
                >
                  <Icon name="calendar-outline" size={16} color={COLORS.GRAY} />
                  <Text style={styles.dateFieldText}>
                    {formatShortDate(fecha)}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>NHC (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={nhc}
                  onChangeText={setNhc}
                  placeholder="Si es de un paciente"
                  placeholderTextColor={COLORS.GRAY}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Para quién</Text>
            <TouchableOpacity
              style={styles.peerRow}
              onPress={() => setDestinatarioUserId(null)}
              activeOpacity={0.8}
            >
              <RadioDot selected={destinatarioUserId === null} />
              <Text style={styles.peerRowText}>
                Sin asignar — de quien esté de turno
              </Text>
            </TouchableOpacity>
            {peers === null ? (
              <ActivityIndicator
                style={styles.peersLoading}
                color={COLORS.PRIMARY}
              />
            ) : (
              peerOptions.map((peer) => (
                <TouchableOpacity
                  key={peer.id}
                  style={styles.peerRow}
                  onPress={() => setDestinatarioUserId(peer.id)}
                  activeOpacity={0.8}
                >
                  <RadioDot selected={destinatarioUserId === peer.id} />
                  <Text style={styles.peerRowText}>
                    {residentDisplayName(peer)}
                    {peer.resident_year ? ` · R${peer.resident_year}` : ""}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            {submitError ? (
              <Text style={styles.errorText}>{submitError}</Text>
            ) : null}
          </ScrollView>

          <View style={styles.composerFooter}>
            <TouchableOpacity
              style={styles.footerCancel}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.footerCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.footerSubmit,
                (!texto.trim() || saving) && styles.footerSubmitDisabled,
              ]}
              onPress={submit}
              disabled={!texto.trim() || saving}
              activeOpacity={0.85}
            >
              <Text style={styles.footerSubmitText}>
                {saving ? "Guardando…" : "Crear recordatorio"}
              </Text>
            </TouchableOpacity>
          </View>

          {datePickerVisible ? (
            <View style={styles.dateSheet}>
              {Platform.OS === "ios" ? (
                <>
                  <View style={styles.dateSheetHeader}>
                    <TouchableOpacity
                      onPress={() => {
                        setDatePickerVisible(false);
                        setTempDate(null);
                      }}
                    >
                      <Text style={styles.dateSheetCancel}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={confirmIosDate}>
                      <Text style={styles.dateSheetConfirm}>Seleccionar</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={tempDate || new Date(`${fecha}T12:00:00`)}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    locale="es-ES"
                  />
                </>
              ) : (
                <DateTimePicker
                  value={new Date(`${fecha}T12:00:00`)}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  locale="es-ES"
                />
              )}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.GRAY,
  },
  errorText: {
    fontSize: 13,
    color: OVERDUE_TEXT,
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: OVERDUE_TEXT,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1E293B",
  },
  cardTextClosed: {
    color: COLORS.GRAY,
    textDecorationLine: "line-through",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  cardMeta: {
    fontSize: 12,
    color: COLORS.GRAY,
    fontVariant: ["tabular-nums"],
  },
  datePill: {
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  datePillText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  overduePill: {
    backgroundColor: OVERDUE_BG,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  overduePillText: {
    fontSize: 12,
    color: OVERDUE_TEXT,
    fontWeight: "600",
  },
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.SUCCESS,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  secondaryButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  composerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "88%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.GRAY_MEDIUM,
    marginBottom: 14,
  },
  composerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  composerSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.GRAY,
    marginTop: 4,
    marginBottom: 14,
  },
  composerScroll: {
    flexGrow: 0,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
    marginTop: 10,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.GRAY_MEDIUM,
    borderRadius: 12,
    padding: 12,
    minHeight: 76,
    fontSize: 14,
    color: "#1E293B",
    textAlignVertical: "top",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.GRAY_MEDIUM,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
  },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.GRAY_MEDIUM,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateFieldText: {
    fontSize: 14,
    color: "#1E293B",
  },
  peerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.GRAY_MEDIUM,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: COLORS.PRIMARY,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.PRIMARY,
  },
  peerRowText: {
    fontSize: 14,
    color: "#1E293B",
  },
  peersLoading: {
    marginVertical: 10,
  },
  composerFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_LIGHT,
    paddingTop: 14,
  },
  footerCancel: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  footerCancelText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  footerSubmit: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY,
  },
  footerSubmitDisabled: {
    opacity: 0.5,
  },
  footerSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  dateSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  dateSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  dateSheetCancel: {
    color: COLORS.GRAY,
    fontSize: 15,
  },
  dateSheetConfirm: {
    color: COLORS.PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
});
