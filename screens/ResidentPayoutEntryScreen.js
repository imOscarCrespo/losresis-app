import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { Button } from "../components";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { COLORS } from "../constants/colors";
import {
  formatPayoutPeriodLabel,
  getPayoutMonthLabel,
  getResidentPayoutForMonth,
  upsertResidentPayout,
} from "../services/residentPayoutService";
import { getAgendaEvents } from "../services/agendaService";
import {
  buildPayoutMismatches,
  buildPendingPaymentDescription,
  countMonthShiftsByCategory,
  formatCountsSummary,
} from "../services/shiftPayrollService";

const GUARD_COUNT_FIELD_BY_CATEGORY = {
  weekday: "weekdayGuardCount",
  friday: "fridayGuardCount",
  saturday: "saturdayGuardCount",
  sunday: "sundayGuardCount",
  holiday: "holidayGuardCount",
};

const buildEmptyFormState = (year, month) => ({
  periodYear: year,
  periodMonth: month,
  grossTotalEur: "",
  hasGuards: false,
  weekdayGuardCount: 0,
  fridayGuardCount: 0,
  saturdayGuardCount: 0,
  sundayGuardCount: 0,
  holidayGuardCount: 0,
  strikeCount: "0",
  hasDoublePay: false,
  hasPendingPayment: false,
  pendingPaymentDescription: "",
});

const buildFormStateFromRow = (row) => {
  const weekdayGuardCount = Number(row.weekday_guard_count ?? row.guard_count ?? 0);
  const fridayGuardCount = Number(row.friday_guard_count ?? 0);
  const saturdayGuardCount = Number(row.saturday_guard_count ?? 0);
  const sundayGuardCount = Number(row.sunday_guard_count ?? 0);
  const holidayGuardCount = Number(row.holiday_guard_count ?? 0);

  return {
    periodYear: row.period_year,
    periodMonth: row.period_month,
    grossTotalEur: String(row.gross_total_eur ?? ""),
    hasGuards:
      weekdayGuardCount +
        fridayGuardCount +
        saturdayGuardCount +
        sundayGuardCount +
        holidayGuardCount >
      0,
    weekdayGuardCount,
    fridayGuardCount,
    saturdayGuardCount,
    sundayGuardCount,
    holidayGuardCount,
    strikeCount: String(row.strike_count ?? 0),
    hasDoublePay: Boolean(row.has_double_pay),
    hasPendingPayment: Boolean(row.has_pending_payment),
    pendingPaymentDescription: row.pending_payment_description ?? "",
  };
};

const GUARD_BREAKDOWN_FIELDS = [
  { key: "weekdayGuardCount", label: "Lunes a jueves" },
  { key: "fridayGuardCount", label: "Viernes" },
  { key: "saturdayGuardCount", label: "Sábado" },
  { key: "sundayGuardCount", label: "Domingo" },
  { key: "holidayGuardCount", label: "Festivo" },
];

export default function ResidentPayoutEntryScreen({
  userProfile,
  onBack,
  initialYear = null,
  initialMonth = null,
  lockInitialPeriod = false,
}) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultYear = initialYear || currentYear;
  const defaultMonth = initialMonth || currentMonth;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periodLocked, setPeriodLocked] = useState(
    Boolean(lockInitialPeriod && initialYear && initialMonth)
  );
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(
    buildEmptyFormState(defaultYear, defaultMonth)
  );
  // null = aún cargando; [] = cargado (con o sin eventos)
  const [agendaEvents, setAgendaEvents] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadAgendaEvents = async () => {
      if (!userProfile?.id) {
        if (isMounted) setAgendaEvents([]);
        return;
      }

      try {
        const events = await getAgendaEvents(userProfile.id);
        if (isMounted) setAgendaEvents(events);
      } catch (error) {
        console.error("Error loading agenda shifts for payout:", error);
        if (isMounted) setAgendaEvents([]);
      }
    };

    loadAgendaEvents();

    return () => {
      isMounted = false;
    };
  }, [userProfile?.id]);

  const agendaCounts = useMemo(
    () =>
      countMonthShiftsByCategory(
        agendaEvents || [],
        formState.periodYear,
        formState.periodMonth
      ),
    [agendaEvents, formState.periodYear, formState.periodMonth]
  );

  const formGuardCounts = useMemo(
    () => ({
      weekday: Number(formState.weekdayGuardCount) || 0,
      friday: Number(formState.fridayGuardCount) || 0,
      saturday: Number(formState.saturdayGuardCount) || 0,
      sunday: Number(formState.sundayGuardCount) || 0,
      holiday: Number(formState.holidayGuardCount) || 0,
    }),
    [
      formState.weekdayGuardCount,
      formState.fridayGuardCount,
      formState.saturdayGuardCount,
      formState.sundayGuardCount,
      formState.holidayGuardCount,
    ]
  );

  const formMatchesAgenda = useMemo(
    () =>
      Object.entries(GUARD_COUNT_FIELD_BY_CATEGORY).every(
        ([category]) => formGuardCounts[category] === (agendaCounts[category] || 0)
      ),
    [formGuardCounts, agendaCounts]
  );

  // Prefill: en un mes sin registro previo y con el formulario intacto,
  // proponemos el desglose de guardias que ya conoce la agenda.
  useEffect(() => {
    if (loading || editingId || !agendaEvents || agendaCounts.total === 0) {
      return;
    }

    setFormState((prev) => {
      const formTotal = Object.values(GUARD_COUNT_FIELD_BY_CATEGORY).reduce(
        (sum, field) => sum + (Number(prev[field]) || 0),
        0
      );

      if (prev.hasGuards || formTotal > 0) {
        return prev;
      }

      return {
        ...prev,
        hasGuards: true,
        weekdayGuardCount: agendaCounts.weekday,
        fridayGuardCount: agendaCounts.friday,
        saturdayGuardCount: agendaCounts.saturday,
        sundayGuardCount: agendaCounts.sunday,
        holidayGuardCount: agendaCounts.holiday,
      };
    });
  }, [loading, editingId, agendaEvents, agendaCounts]);

  const applyAgendaCounts = () => {
    setFormState((prev) => ({
      ...prev,
      hasGuards: agendaCounts.total > 0,
      weekdayGuardCount: agendaCounts.weekday,
      fridayGuardCount: agendaCounts.friday,
      saturdayGuardCount: agendaCounts.saturday,
      sundayGuardCount: agendaCounts.sunday,
      holidayGuardCount: agendaCounts.holiday,
    }));
  };

  useEffect(() => {
    let isMounted = true;

    const loadExistingRow = async () => {
      if (!userProfile?.id) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const row = await getResidentPayoutForMonth(
          userProfile.id,
          formState.periodYear,
          formState.periodMonth
        );

        if (!isMounted) return;

        if (row) {
          setEditingId(row.id);
          setFormState(buildFormStateFromRow(row));
        } else {
          setEditingId(null);
          setFormState((prev) =>
            buildEmptyFormState(prev.periodYear, prev.periodMonth)
          );
        }
      } catch (error) {
        console.error("Error loading resident payout entry:", error);
        if (isMounted) {
          Alert.alert("Error", "No se ha podido cargar el registro.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadExistingRow();

    return () => {
      isMounted = false;
    };
  }, [formState.periodMonth, formState.periodYear, userProfile?.id]);

  const setFieldValue = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const updateCounterField = (field, delta) => {
    setFormState((prev) => ({
      ...prev,
      [field]: Math.max(0, Number(prev[field] || 0) + delta),
    }));
  };

  const selectMonth = (month) => {
    setPeriodLocked(false);
    setEditingId(null);
    setFormState((prev) => ({
      ...buildEmptyFormState(prev.periodYear, month),
    }));
  };

  const openMonthPicker = () => {
    if (periodLocked) return;

    Alert.alert(
      "Selecciona el mes",
      undefined,
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return {
          text: getPayoutMonthLabel(month, "long"),
          onPress: () => selectMonth(month),
        };
      }).concat([{ text: "Cancelar", style: "cancel" }])
    );
  };

  const persistPayout = async (parsedValues, pendingOverride = null) => {
    setSaving(true);
    try {
      await upsertResidentPayout({
        user_id: userProfile.id,
        period_year: formState.periodYear,
        period_month: formState.periodMonth,
        gross_total_eur: parsedValues.grossTotal,
        weekday_guard_count: parsedValues.weekdayGuardCount,
        friday_guard_count: parsedValues.fridayGuardCount,
        saturday_guard_count: parsedValues.saturdayGuardCount,
        sunday_guard_count: parsedValues.sundayGuardCount,
        holiday_guard_count: parsedValues.holidayGuardCount,
        strike_count: parsedValues.strikeCount,
        has_double_pay: formState.hasDoublePay,
        has_pending_payment: pendingOverride
          ? true
          : formState.hasPendingPayment,
        pending_payment_description: pendingOverride
          ? pendingOverride.description
          : formState.pendingPaymentDescription,
      });

      onBack?.();
    } catch (error) {
      console.error("Error saving resident payout:", error);
      Alert.alert("Error", "No se ha podido guardar la nómina.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const grossTotal = Number(String(formState.grossTotalEur).replace(",", "."));
    const strikeCount = Number(formState.strikeCount);
    const weekdayGuardCount = Number(formState.weekdayGuardCount);
    const fridayGuardCount = Number(formState.fridayGuardCount);
    const saturdayGuardCount = Number(formState.saturdayGuardCount);
    const sundayGuardCount = Number(formState.sundayGuardCount);
    const holidayGuardCount = Number(formState.holidayGuardCount);
    const guardBreakdown = [
      weekdayGuardCount,
      fridayGuardCount,
      saturdayGuardCount,
      sundayGuardCount,
      holidayGuardCount,
    ];

    if (!Number.isFinite(grossTotal) || grossTotal < 0) {
      Alert.alert("Importe no válido", "Introduce el total de la nómina en euros.");
      return;
    }

    if (guardBreakdown.some((count) => !Number.isInteger(count) || count < 0)) {
      Alert.alert("Guardias no válidas", "Cada contador de guardias debe ser 0 o superior.");
      return;
    }

    if (!Number.isInteger(strikeCount) || strikeCount < 0) {
      Alert.alert("Huelgas no válidas", "El número de huelgas debe ser 0 o superior.");
      return;
    }

    const parsedValues = {
      grossTotal,
      strikeCount,
      weekdayGuardCount,
      fridayGuardCount,
      saturdayGuardCount,
      sundayGuardCount,
      holidayGuardCount,
    };

    // Contraste agenda ↔ nómina: si la nómina recoge menos guardias de las
    // que hay en la agenda del mes, proponemos marcarlo como pago pendiente.
    const mismatches = buildPayoutMismatches(agendaCounts, {
      weekday: weekdayGuardCount,
      friday: fridayGuardCount,
      saturday: saturdayGuardCount,
      sunday: sundayGuardCount,
      holiday: holidayGuardCount,
    });

    if (mismatches.length > 0 && !formState.hasPendingPayment) {
      const periodLabel = formatPayoutPeriodLabel(
        formState.periodYear,
        formState.periodMonth
      );
      const missingSummary = mismatches
        .map((item) => `${item.missing} ${item.label}`)
        .join(", ");

      Alert.alert(
        "Guardias sin reflejar",
        `Según tu agenda, en ${periodLabel} hiciste ${agendaCounts.total} guardias y en esta nómina faltan ${missingSummary}. ¿Quieres marcarlo como pago pendiente para hacer seguimiento?`,
        [
          {
            text: "Marcar pendiente y guardar",
            onPress: () =>
              persistPayout(parsedValues, {
                description: buildPendingPaymentDescription(
                  mismatches,
                  periodLabel
                ),
              }),
          },
          {
            text: "Guardar sin marcar",
            onPress: () => persistPayout(parsedValues),
          },
          { text: "Cancelar", style: "cancel" },
        ]
      );
      return;
    }

    persistPayout(parsedValues);
  };

  return (
    <HeroScreenLayout
      title={editingId ? "Editar nómina" : "Nueva nómina"}
      subtitle={formatPayoutPeriodLabel(formState.periodYear, formState.periodMonth)}
      onBack={onBack}
      keyboardAvoiding
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#670CF5" />
          <Text style={styles.loadingText}>Cargando registro...</Text>
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.container}>
              {lockInitialPeriod && initialYear && initialMonth ? (
                <View style={styles.lockBanner}>
                  <Icon name="time-outline" size={18} color="#670CF5" />
                  <Text style={styles.lockBannerText}>
                    Registro sugerido para {formatPayoutPeriodLabel(formState.periodYear, formState.periodMonth)}.
                  </Text>
                </View>
              ) : null}

              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Mes</Text>
                <TouchableOpacity
                  style={[styles.selectButton, periodLocked && styles.selectButtonDisabled]}
                  onPress={openMonthPicker}
                  disabled={periodLocked}
                  activeOpacity={0.82}
                >
                  <View style={styles.selectButtonCopy}>
                    <Text style={styles.selectButtonLabel}>
                      {formatPayoutPeriodLabel(formState.periodYear, formState.periodMonth)}
                    </Text>
                    <Text style={styles.selectButtonHint}>
                      {editingId
                        ? "Se actualizará el registro de este mes"
                        : "Puedes cambiarlo si necesitas cargar otro mes"}
                    </Text>
                  </View>
                  <Icon name="chevron-down" size={18} color="#64748B" />
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Total nómina</Text>
                <TextInput
                  value={formState.grossTotalEur}
                  onChangeText={(value) => setFieldValue("grossTotalEur", value)}
                  keyboardType="decimal-pad"
                  placeholder="Ej. 2350"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />

                <View style={styles.dualFieldRow}>
                  <View style={styles.dualField}>
                    <Text style={styles.fieldLabel}>Huelgas</Text>
                    <TextInput
                      value={formState.strikeCount}
                      onChangeText={(value) => setFieldValue("strikeCount", value)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                    />
                  </View>
                </View>

                {agendaCounts.total > 0 ? (
                  <View style={styles.agendaHintCard}>
                    <Icon name="calendar-outline" size={18} color="#670CF5" />
                    <View style={styles.agendaHintCopy}>
                      <Text style={styles.agendaHintText}>
                        Según tu agenda, en{" "}
                        {getPayoutMonthLabel(formState.periodMonth, "long")}{" "}
                        hiciste {agendaCounts.total}{" "}
                        {agendaCounts.total === 1 ? "guardia" : "guardias"}:{" "}
                        {formatCountsSummary(agendaCounts)}.
                      </Text>
                      {!formMatchesAgenda ? (
                        <TouchableOpacity
                          onPress={applyAgendaCounts}
                          activeOpacity={0.82}
                        >
                          <Text style={styles.agendaHintAction}>
                            Usar recuento de la agenda
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Guardias</Text>
                    <Text style={styles.switchSubtitle}>
                      Desglosa tus guardias para registrar mejor los ingresos variables del mes.
                    </Text>
                  </View>
                  <Switch
                    value={formState.hasGuards}
                    onValueChange={(value) => {
                      if (!value) {
                        setFormState((prev) => ({
                          ...prev,
                          hasGuards: false,
                          weekdayGuardCount: 0,
                          fridayGuardCount: 0,
                          saturdayGuardCount: 0,
                          sundayGuardCount: 0,
                          holidayGuardCount: 0,
                        }));
                        return;
                      }

                      setFieldValue("hasGuards", true);
                    }}
                    trackColor={{ false: "#CBD5E1", true: "#C4B5FD" }}
                    thumbColor={formState.hasGuards ? "#670CF5" : "#FFFFFF"}
                  />
                </View>

                {formState.hasGuards ? (
                  <View style={styles.guardBreakdownPanel}>
                    <View style={styles.counterList}>
                      {GUARD_BREAKDOWN_FIELDS.map((item) => (
                        <View key={item.key} style={styles.counterRow}>
                          <Text style={styles.counterLabel}>{item.label}</Text>
                          <View style={styles.counterControl}>
                            <TouchableOpacity
                              style={styles.counterButton}
                              onPress={() => updateCounterField(item.key, -1)}
                              activeOpacity={0.82}
                            >
                              <Icon name="remove" size={18} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{formState[item.key]}</Text>
                            <TouchableOpacity
                              style={styles.counterButton}
                              onPress={() => updateCounterField(item.key, 1)}
                              activeOpacity={0.82}
                            >
                              <Icon name="add" size={18} color="#1E293B" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Paga doble</Text>
                    <Text style={styles.switchSubtitle}>Marca si este mes ha incluido paga extra.</Text>
                  </View>
                  <Switch
                    value={formState.hasDoublePay}
                    onValueChange={(value) => setFieldValue("hasDoublePay", value)}
                    trackColor={{ false: "#CBD5E1", true: "#C4B5FD" }}
                    thumbColor={formState.hasDoublePay ? "#670CF5" : "#FFFFFF"}
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Pago pendiente</Text>
                    <Text style={styles.switchSubtitle}>
                      Indica si te quedan importes por cobrar o te han abonado atrasos.
                    </Text>
                  </View>
                  <Switch
                    value={formState.hasPendingPayment}
                    onValueChange={(value) => {
                      setFieldValue("hasPendingPayment", value);
                      if (!value) {
                        setFieldValue("pendingPaymentDescription", "");
                      }
                    }}
                    trackColor={{ false: "#CBD5E1", true: "#C4B5FD" }}
                    thumbColor={formState.hasPendingPayment ? "#670CF5" : "#FFFFFF"}
                  />
                </View>

                {formState.hasPendingPayment ? (
                  <View style={styles.pendingPaymentField}>
                    <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
                    <TextInput
                      value={formState.pendingPaymentDescription}
                      onChangeText={(value) =>
                        setFieldValue("pendingPaymentDescription", value)
                      }
                      placeholder="Ej: pago de un curso, guardias atrasadas"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                    />
                  </View>
                ) : null}

                <Button
                  title={saving ? "Guardando..." : "Guardar nómina"}
                  onPress={handleSave}
                  loading={saving}
                  style={styles.primaryAction}
                  textStyle={styles.primaryActionText}
                />
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentSurface: {
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    padding: 16,
    gap: 16,
  },
  lockBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F4EEFF",
    borderRadius: 16,
    padding: 14,
  },
  lockBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#4C1D95",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  selectButtonDisabled: {
    opacity: 0.6,
  },
  selectButtonCopy: {
    flex: 1,
    marginRight: 12,
  },
  selectButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    textTransform: "capitalize",
  },
  selectButtonHint: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 16,
  },
  counterList: {
    gap: 10,
  },
  guardBreakdownPanel: {
    marginTop: -4,
    marginBottom: 16,
    paddingTop: 4,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  counterLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  counterControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  counterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  counterValue: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  dualFieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  dualField: {
    flex: 1,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  switchSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#64748B",
    marginTop: 2,
  },
  pendingPaymentField: {
    marginBottom: 4,
  },
  agendaHintCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F4EEFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  agendaHintCopy: {
    flex: 1,
    gap: 6,
  },
  agendaHintText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4C1D95",
  },
  agendaHintAction: {
    fontSize: 13,
    fontWeight: "700",
    color: "#670CF5",
  },
  primaryAction: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
