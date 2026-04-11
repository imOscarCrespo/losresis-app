import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, ScreenHeader, ScreenScaffold } from "../components";
import { COLORS } from "../constants/colors";
import {
  formatPayoutPeriodLabel,
  getResidentPayoutForMonth,
} from "../services/residentPayoutService";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const DETAIL_FIELDS = [
  { key: "weekday_guard_count", label: "Lunes a jueves" },
  { key: "friday_guard_count", label: "Viernes" },
  { key: "saturday_guard_count", label: "Sábado" },
  { key: "sunday_guard_count", label: "Domingo" },
  { key: "holiday_guard_count", label: "Festivo" },
];

const BooleanPill = ({ value, trueLabel = "Sí", falseLabel = "No" }) => (
  <View
    style={[
      styles.booleanPill,
      value ? styles.booleanPillActive : styles.booleanPillInactive,
    ]}
  >
    <Text
      style={[
        styles.booleanPillText,
        value ? styles.booleanPillTextActive : styles.booleanPillTextInactive,
      ]}
    >
      {value ? trueLabel : falseLabel}
    </Text>
  </View>
);

export default function ResidentPayoutDetailScreen({
  userProfile,
  onBack,
  onEdit,
  initialYear = null,
  initialMonth = null,
}) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadRow = async () => {
      if (!userProfile?.id || !initialYear || !initialMonth) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await getResidentPayoutForMonth(
          userProfile.id,
          initialYear,
          initialMonth
        );

        if (!isMounted) return;

        if (!result) {
          Alert.alert("Registro no encontrado", "No se ha encontrado la nómina de este mes.");
          onBack?.();
          return;
        }

        setRow(result);
      } catch (error) {
        console.error("Error loading resident payout detail:", error);
        if (isMounted) {
          Alert.alert("Error", "No se ha podido cargar el detalle de la nómina.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRow();

    return () => {
      isMounted = false;
    };
  }, [initialMonth, initialYear, onBack, userProfile?.id]);

  const guardRows = useMemo(() => {
    if (!row) return [];

    return DETAIL_FIELDS.map((item) => ({
      label: item.label,
      value: Number(row[item.key] ?? 0),
    })).filter((item) => item.value > 0);
  }, [row]);

  const header = (
    <ScreenHeader
      title="Detalle nómina"
      subtitle={formatPayoutPeriodLabel(initialYear, initialMonth)}
      onBack={onBack}
      compact
      iconName="cash-outline"
    />
  );

  return (
    <ScreenScaffold header={header} contentSurfaceStyle={styles.contentSurface}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#670CF5" />
          <Text style={styles.loadingText}>Cargando detalle...</Text>
        </View>
      ) : row ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total nómina</Text>
            <Text style={styles.heroValue}>{formatCurrency(row.gross_total_eur)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Resumen del mes</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Huelgas</Text>
              <Text style={styles.detailValue}>{row.strike_count}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Paga doble</Text>
              <BooleanPill value={Boolean(row.has_double_pay)} />
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pago pendiente</Text>
              <BooleanPill value={Boolean(row.has_pending_payment)} />
            </View>

            {row.has_pending_payment && row.pending_payment_description ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>Descripción</Text>
                <Text style={styles.noteValue}>{row.pending_payment_description}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Guardias</Text>
            {guardRows.length ? (
              guardRows.map((item) => (
                <View key={item.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue}>{item.value}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No hay guardias registradas este mes.</Text>
            )}
          </View>

          <Button
            title="Editar nómina"
            onPress={() =>
              onEdit?.({
                initialYear,
                initialMonth,
                lockInitialPeriod: false,
              })
            }
            style={styles.primaryAction}
            textStyle={styles.primaryActionText}
          />
        </ScrollView>
      ) : null}
    </ScreenScaffold>
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
    padding: 16,
    gap: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.08)",
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#670CF5",
    marginBottom: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroValue: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1B0977",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B0977",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: "#334155",
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  booleanPill: {
    minWidth: 48,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  booleanPillActive: {
    backgroundColor: "#EDE9FE",
  },
  booleanPillInactive: {
    backgroundColor: "#E2E8F0",
  },
  booleanPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  booleanPillTextActive: {
    color: "#6D28D9",
  },
  booleanPillTextInactive: {
    color: "#475569",
  },
  noteBlock: {
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    padding: 14,
    gap: 6,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  noteValue: {
    fontSize: 14,
    lineHeight: 20,
    color: "#0F172A",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  primaryAction: {
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
