import React, { useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { Button, ScreenHeader, ScreenScaffold } from "../components";
import {
  formatPayoutPeriodLabel,
  getPayoutMonthLabel,
  getResidentPayoutForMonth,
  upsertResidentPayout,
} from "../services/residentPayoutService";

const buildEmptyFormState = (year, month) => ({
  periodYear: year,
  periodMonth: month,
  grossTotalEur: "",
  guardCount: "0",
  strikeCount: "0",
  hasDoublePay: false,
  hasPendingPayment: false,
});

const buildFormStateFromRow = (row) => ({
  periodYear: row.period_year,
  periodMonth: row.period_month,
  grossTotalEur: String(row.gross_total_eur ?? ""),
  guardCount: String(row.guard_count ?? 0),
  strikeCount: String(row.strike_count ?? 0),
  hasDoublePay: Boolean(row.has_double_pay),
  hasPendingPayment: Boolean(row.has_pending_payment),
});

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

  const handleSave = async () => {
    const grossTotal = Number(String(formState.grossTotalEur).replace(",", "."));
    const guardCount = Number(formState.guardCount);
    const strikeCount = Number(formState.strikeCount);

    if (!Number.isFinite(grossTotal) || grossTotal < 0) {
      Alert.alert("Importe no válido", "Introduce el total de la nómina en euros.");
      return;
    }

    if (!Number.isInteger(guardCount) || guardCount < 0) {
      Alert.alert("Guardias no válidas", "El número de guardias debe ser 0 o superior.");
      return;
    }

    if (!Number.isInteger(strikeCount) || strikeCount < 0) {
      Alert.alert("Huelgas no válidas", "El número de huelgas debe ser 0 o superior.");
      return;
    }

    setSaving(true);
    try {
      await upsertResidentPayout({
        user_id: userProfile.id,
        period_year: formState.periodYear,
        period_month: formState.periodMonth,
        gross_total_eur: grossTotal,
        guard_count: guardCount,
        strike_count: strikeCount,
        has_double_pay: formState.hasDoublePay,
        has_pending_payment: formState.hasPendingPayment,
      });

      onBack?.();
    } catch (error) {
      console.error("Error saving resident payout:", error);
      Alert.alert("Error", "No se ha podido guardar la nómina.");
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <ScreenHeader
      title={editingId ? "Editar nómina" : "Nueva nómina"}
      subtitle={formatPayoutPeriodLabel(formState.periodYear, formState.periodMonth)}
      onBack={onBack}
      compact
      iconName="cash-outline"
    />
  );

  return (
    <ScreenScaffold
      header={header}
      contentSurfaceStyle={styles.contentSurface}
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
                  <Ionicons name="time-outline" size={18} color="#670CF5" />
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
                  <Ionicons name="chevron-down" size={18} color="#64748B" />
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
                    <Text style={styles.fieldLabel}>Guardias</Text>
                    <TextInput
                      value={formState.guardCount}
                      onChangeText={(value) => setFieldValue("guardCount", value)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                    />
                  </View>
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
                      Indica si te han abonado importes pendientes de otro mes.
                    </Text>
                  </View>
                  <Switch
                    value={formState.hasPendingPayment}
                    onValueChange={(value) => setFieldValue("hasPendingPayment", value)}
                    trackColor={{ false: "#CBD5E1", true: "#C4B5FD" }}
                    thumbColor={formState.hasPendingPayment ? "#670CF5" : "#FFFFFF"}
                  />
                </View>

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
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  contentSurface: {
    backgroundColor: "#F8FAFC",
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
