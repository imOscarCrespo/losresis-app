import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { Button } from "../components";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  formatPayoutPeriodLabel,
  getResidentPayoutForMonth,
  saveResidentPayoutExpenses,
} from "../services/residentPayoutService";
import {
  PAYOUT_EXPENSE_CATEGORIES,
  buildExpenseSummary,
  centsToEuros,
  formatEuroAmount,
  formatEuroInput,
  parseEuroInputToCents,
} from "../utils/payoutExpenses";

const buildInputsFromRow = (row) =>
  PAYOUT_EXPENSE_CATEGORIES.reduce((acc, category) => {
    acc[category.key] = row ? formatEuroInput(row[category.key]) : "";
    return acc;
  }, {});

export default function ResidentPayoutExpensesScreen({
  userProfile,
  onBack,
  initialYear = null,
  initialMonth = null,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payout, setPayout] = useState(null);
  // Un fallo de carga no es "no hay nómina": se muestra aparte y se puede reintentar.
  const [loadError, setLoadError] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [inputs, setInputs] = useState(() => buildInputsFromRow(null));

  useEffect(() => {
    let isMounted = true;

    const loadPayout = async () => {
      if (!userProfile?.id || !initialYear || !initialMonth) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(false);
      try {
        const row = await getResidentPayoutForMonth(
          userProfile.id,
          initialYear,
          initialMonth
        );
        if (!isMounted) return;
        setPayout(row);
        setInputs(buildInputsFromRow(row));
      } catch (error) {
        console.error("Error loading payout expenses:", error);
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPayout();

    return () => {
      isMounted = false;
    };
  }, [initialMonth, initialYear, userProfile?.id, reloadCount]);

  // Céntimos por categoría; null si el texto del campo no es un importe válido.
  const centsByKey = useMemo(
    () =>
      PAYOUT_EXPENSE_CATEGORIES.reduce((acc, category) => {
        acc[category.key] = parseEuroInputToCents(inputs[category.key]);
        return acc;
      }, {}),
    [inputs]
  );

  const hasInvalidInput = Object.values(centsByKey).some((cents) => cents === null);

  const summary = useMemo(
    () => buildExpenseSummary(payout?.gross_total_eur, centsByKey),
    [payout?.gross_total_eur, centsByKey]
  );

  const handleSave = async () => {
    if (hasInvalidInput) {
      Alert.alert(
        "Importe no válido",
        "Revisa los importes marcados: deben ser cantidades en euros de 0 o más."
      );
      return;
    }

    setSaving(true);
    try {
      await saveResidentPayoutExpenses({
        payoutId: payout.id,
        userId: userProfile.id,
        expensesEurByKey: PAYOUT_EXPENSE_CATEGORIES.reduce((acc, category) => {
          acc[category.key] = centsToEuros(centsByKey[category.key]);
          return acc;
        }, {}),
      });
      onBack?.();
    } catch (error) {
      console.error("Error saving payout expenses:", error);
      Alert.alert(
        "No se han guardado los gastos",
        "Revisa tu conexión e inténtalo de nuevo. Tus importes siguen en pantalla."
      );
    } finally {
      setSaving(false);
    }
  };

  const remainingAbs = Math.abs(summary.remainingEur);
  const resultTone = summary.isOverBudget
    ? "over"
    : summary.remainingEur > 0
      ? "positive"
      : "neutral";

  return (
    <HeroScreenLayout
      title="Organizar mis gastos"
      subtitle={
        initialYear && initialMonth
          ? formatPayoutPeriodLabel(initialYear, initialMonth)
          : undefined
      }
      onBack={onBack}
      keyboardAvoiding
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#670CF5" />
          <Text style={styles.loadingText}>Cargando gastos...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.emptyContainer}>
          <Icon name="alert-circle-outline" size={32} color="#670CF5" />
          <Text style={styles.emptyTitle}>No se han podido cargar tus gastos</Text>
          <Text style={styles.emptyText}>
            Revisa tu conexión e inténtalo de nuevo.
          </Text>
          <Button
            title="Reintentar"
            onPress={() => setReloadCount((count) => count + 1)}
            style={styles.retryAction}
            textStyle={styles.primaryActionText}
          />
        </View>
      ) : !payout ? (
        <View style={styles.emptyContainer}>
          <Icon name="wallet-outline" size={32} color="#670CF5" />
          <Text style={styles.emptyTitle}>Registra primero tu nómina</Text>
          <Text style={styles.emptyText}>
            Para organizar tus gastos necesitamos saber cuánto has cobrado este mes.
          </Text>
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Ingresos del mes</Text>
              <Text style={styles.summaryIncome}>
                {formatEuroAmount(summary.incomeEur)}
              </Text>

              <View style={styles.summaryRow}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryBoxValue}>
                    {formatEuroAmount(summary.expensesEur)}
                  </Text>
                  <Text style={styles.summaryBoxLabel}>Gastos</Text>
                </View>
                <View
                  style={[
                    styles.summaryBox,
                    resultTone === "positive" && styles.summaryBoxPositive,
                    resultTone === "over" && styles.summaryBoxOver,
                  ]}
                >
                  <Text
                    style={[
                      styles.summaryBoxValue,
                      resultTone === "over" && styles.overText,
                    ]}
                  >
                    {formatEuroAmount(remainingAbs)}
                  </Text>
                  <Text
                    style={[
                      styles.summaryBoxLabel,
                      resultTone === "over" && styles.overText,
                    ]}
                  >
                    {summary.isOverBudget ? "Te pasas" : "Te quedan"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.categoryList}>
              {PAYOUT_EXPENSE_CATEGORIES.map((category) => {
                const isInvalid = centsByKey[category.key] === null;
                return (
                  <View key={category.key} style={styles.categoryRow}>
                    <View style={styles.categoryIcon}>
                      <Icon name={category.icon} size={20} color="#670CF5" />
                    </View>
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryLabel}>{category.label}</Text>
                      <Text style={styles.categoryHint} numberOfLines={1}>
                        {category.hint}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.amountField,
                        isInvalid && styles.amountFieldInvalid,
                      ]}
                    >
                      <TextInput
                        value={inputs[category.key]}
                        onChangeText={(value) =>
                          setInputs((prev) => ({ ...prev, [category.key]: value }))
                        }
                        keyboardType="decimal-pad"
                        // El campo va alineado a la derecha: al tocarlo el cursor quedaría
                        // delante del importe. Seleccionarlo permite reescribirlo directamente.
                        selectTextOnFocus
                        placeholder="0"
                        placeholderTextColor="#94A3B8"
                        style={styles.amountInput}
                        accessibilityLabel={`Gasto en ${category.label}`}
                        testID={`expense-input-${category.key}`}
                        maxLength={12}
                      />
                      <Text style={styles.amountCurrency}>€</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View
              style={[
                styles.resultCard,
                resultTone === "positive" && styles.resultCardPositive,
                resultTone === "over" && styles.resultCardOver,
              ]}
            >
              <Icon
                name={summary.isOverBudget ? "alert-circle-outline" : "wallet-outline"}
                size={26}
                color={summary.isOverBudget ? "#B45309" : resultTone === "positive" ? "#16A34A" : "#670CF5"}
              />
              <View style={styles.resultCopy} testID="expense-result">
                {summary.isOverBudget ? (
                  <>
                    <Text style={styles.resultTitle}>
                      Superas lo cobrado en{" "}
                      <Text style={styles.resultAmount}>{formatEuroAmount(remainingAbs)}</Text>
                    </Text>
                    <Text style={styles.resultText}>
                      Los gastos que has registrado son mayores que tu nómina de este mes.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.resultTitle}>
                      Te quedan{" "}
                      <Text style={styles.resultAmount}>
                        {formatEuroAmount(summary.remainingEur)}
                      </Text>{" "}
                      este mes
                    </Text>
                    <Text style={styles.resultText}>
                      Después de los gastos que has registrado, este es el dinero que tienes
                      disponible.
                    </Text>
                  </>
                )}
              </View>
            </View>

            <Button
              title={saving ? "Guardando..." : "Guardar gastos"}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={styles.primaryAction}
              textStyle={styles.primaryActionText}
            />
          </ScrollView>
        </TouchableWithoutFeedback>
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B0977",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: "#F4EEFF",
    borderRadius: 24,
    padding: 18,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4C1D95",
    marginBottom: 6,
  },
  summaryIncome: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1B0977",
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 4,
  },
  summaryBoxPositive: {
    backgroundColor: "#DCFCE7",
  },
  summaryBoxOver: {
    backgroundColor: "#FEF3C7",
  },
  summaryBoxValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1B0977",
  },
  summaryBoxLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  overText: {
    color: "#92400E",
  },
  categoryList: {
    gap: 10,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F4EEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCopy: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  categoryHint: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  amountField: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 104,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
  },
  amountFieldInvalid: {
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  amountInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "right",
    paddingVertical: 8,
  },
  amountCurrency: {
    marginLeft: 4,
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#F4EEFF",
  },
  resultCardPositive: {
    backgroundColor: "#ECFDF5",
  },
  resultCardOver: {
    backgroundColor: "#FFFBEB",
  },
  resultCopy: {
    flex: 1,
    gap: 6,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  resultAmount: {
    fontSize: 20,
    fontWeight: "900",
  },
  resultText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  retryAction: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#670CF5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
