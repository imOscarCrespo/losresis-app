import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { Button } from "../components";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  getPayoutMonthLabel,
  getResidentPayoutForMonth,
} from "../services/residentPayoutService";
import {
  PAYOUT_EXPENSE_CATEGORIES,
  formatEuroAmount,
  getPayoutPendingToOrganize,
} from "../utils/payoutExpenses";

// Paso siguiente a guardar una nómina nueva (ClickUp 124b4z9w0da): invita a organizar el
// dinero con el organizador que ya existe. Lee la nómina guardada, no la del formulario.
export default function ResidentPayoutSavedScreen({
  userProfile,
  initialYear = null,
  initialMonth = null,
  onOrganize,
  onDismiss,
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [payout, setPayout] = useState(null);

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
        if (isMounted) setPayout(row);
      } catch (error) {
        console.error("Error loading saved payout:", error);
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

  const openOrganizer = () =>
    onOrganize?.({ initialYear, initialMonth });

  const pending = getPayoutPendingToOrganize(payout);
  const amountEur = payout?.gross_total_eur ?? 0;
  const canOrganize = amountEur > 0;
  const monthLabel = getPayoutMonthLabel(initialMonth, "long");

  return (
    <HeroScreenLayout title="Nómina guardada" onBack={onDismiss}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#670CF5" />
        </View>
      ) : loadError || !payout ? (
        <View style={styles.centered}>
          <Icon name="alert-circle-outline" size={32} color="#670CF5" />
          <Text style={styles.errorTitle}>No se ha podido cargar tu nómina</Text>
          <Text style={styles.errorText}>
            Revisa tu conexión e inténtalo de nuevo.
          </Text>
          <Button
            title="Reintentar"
            onPress={() => setReloadCount((count) => count + 1)}
            style={styles.primaryAction}
            textStyle={styles.primaryActionText}
          />
          <TouchableOpacity onPress={onDismiss} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>Volver a Nóminas</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successCard} testID="payout-saved-card">
            <View style={styles.successIconRing}>
              <View style={styles.successIcon}>
                <Icon name="checkmark" size={22} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.successTitle}>¡Nómina guardada!</Text>
            <Text style={styles.successText}>
              Tus ingresos de {monthLabel} ya están registrados.
            </Text>
          </View>

          {canOrganize ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.sectionTitle}>Dale un sitio a tu dinero</Text>
                <Text style={styles.sectionText}>
                  Organiza tus ingresos entre los gastos de tu día a día y tus planes.
                </Text>
              </View>

              <View style={styles.incomeCard}>
                <Text style={styles.incomeLabel}>Ingresos del mes</Text>
                <Text style={styles.incomeValue} testID="payout-saved-income">
                  {formatEuroAmount(amountEur)}
                </Text>
              </View>

              <Text style={styles.listTitle}>Tus apartados</Text>
              <View style={styles.categoryList}>
                {PAYOUT_EXPENSE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.key}
                    style={styles.categoryRow}
                    onPress={openOrganizer}
                    activeOpacity={0.85}
                  >
                    <View style={styles.categoryIcon}>
                      <Icon name={category.icon} size={20} color="#670CF5" />
                    </View>
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryLabel}>{category.label}</Text>
                      <Text style={styles.categoryHint} numberOfLines={1}>
                        {category.hint}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color="#64748B" />
                  </TouchableOpacity>
                ))}
              </View>

              {pending ? (
                <View style={styles.pendingBanner}>
                  <Icon name="wallet-outline" size={24} color="#16A34A" />
                  <Text style={styles.pendingText}>
                    Tienes{" "}
                    <Text style={styles.pendingAmount}>
                      {formatEuroAmount(pending.amountEur)}
                    </Text>{" "}
                    para organizar
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                testID="payout-saved-organize"
                style={styles.organizeButton}
                onPress={openOrganizer}
                activeOpacity={0.88}
              >
                <Text style={styles.organizeButtonText}>
                  {payout.is_expenses_organized ? "Ver mis gastos" : "Organizar mi dinero"}
                </Text>
                <Icon name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                testID="payout-saved-dismiss"
                onPress={onDismiss}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionText}>Ahora no</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Nómina de 0 €: no hay nada que repartir.
            <Button
              title="Volver a Nóminas"
              onPress={onDismiss}
              style={styles.primaryAction}
              textStyle={styles.primaryActionText}
            />
          )}
        </ScrollView>
      )}
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B0977",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  successCard: {
    backgroundColor: "#F4EEFF",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 6,
  },
  successIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1B0977",
    textAlign: "center",
  },
  successText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },
  introBlock: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1B0977",
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 21,
    color: "#475569",
  },
  incomeCard: {
    backgroundColor: "#F4EEFF",
    borderRadius: 20,
    padding: 18,
    gap: 4,
  },
  incomeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#670CF5",
  },
  incomeValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1B0977",
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: -6,
  },
  categoryList: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ECFDF3",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  pendingText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  pendingAmount: {
    fontSize: 18,
    fontWeight: "900",
  },
  organizeButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  organizeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  primaryAction: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    alignSelf: "stretch",
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryAction: {
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: "#670CF5",
    fontSize: 15,
    fontWeight: "800",
  },
});
