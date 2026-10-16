import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Icon } from "../components/Icon";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { COLORS } from "../constants/colors";
import {
  buildPayoutChartData,
  formatPayoutPeriodLabel,
  getResidentPayoutsByYear,
} from "../services/residentPayoutService";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const MonthBarChart = ({ data, width, onSelectMonth }) => {
  const chartHeight = 220;
  const leftPadding = 10;
  const rightPadding = 10;
  const topPadding = 16;
  const bottomPadding = 42;
  const usableHeight = chartHeight - topPadding - bottomPadding;
  const maxValue = Math.max(...data.map((item) => item.total), 0);
  const safeMax = maxValue > 0 ? maxValue : 1;
  const step = (width - leftPadding - rightPadding) / data.length;
  const barWidth = Math.min(18, Math.max(12, step * 0.45));

  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={chartHeight}>
        <Line
          x1={leftPadding}
          x2={width - rightPadding}
          y1={chartHeight - bottomPadding}
          y2={chartHeight - bottomPadding}
          stroke="#CBD5E1"
          strokeWidth="1"
        />
        {data.map((item, index) => {
          const barHeight = (item.total / safeMax) * usableHeight;
          const x = leftPadding + step * index + (step - barWidth) / 2;
          const y = chartHeight - bottomPadding - barHeight;
          const touchX = leftPadding + step * index;

          return (
            <React.Fragment key={item.month}>
              <Rect
                x={touchX}
                y={topPadding}
                width={step}
                height={chartHeight - topPadding}
                fill="transparent"
                onPress={() => onSelectMonth?.(item.month)}
              />
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 4)}
                rx="6"
                fill={item.total > 0 ? "#670CF5" : "#E2E8F0"}
                onPress={() => onSelectMonth?.(item.month)}
              />
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - 16}
                fontSize="10"
                fontWeight="700"
                fill="#64748B"
                textAnchor="middle"
                onPress={() => onSelectMonth?.(item.month)}
              >
                {item.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

const PayoutListRow = ({ row, onPress }) => {
  const guardCount = Number(row.guard_count || 0);
  const isOrganized = Boolean(row.is_expenses_organized);

  return (
    <TouchableOpacity
      testID={`payout-row-${row.period_year}-${row.period_month}`}
      style={styles.payoutRow}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.payoutRowIcon}>
        <Icon name="cash-outline" size={18} color="#670CF5" />
      </View>
      <View style={styles.payoutRowCopy}>
        <Text style={styles.payoutRowTitle}>
          {capitalize(formatPayoutPeriodLabel(row.period_year, row.period_month))}
        </Text>
        <View style={styles.payoutRowMeta}>
          {guardCount > 0 ? (
            <Text style={styles.payoutRowMetaText}>
              {guardCount} {guardCount === 1 ? "guardia" : "guardias"} ·{" "}
            </Text>
          ) : null}
          <Text
            style={styles.payoutRowMetaText}
            testID={`payout-row-status-${row.period_year}-${row.period_month}`}
          >
            {isOrganized ? "Organizado" : "Sin organizar"}
          </Text>
          <View
            style={[
              styles.statusDot,
              isOrganized ? styles.statusDotOrganized : styles.statusDotPending,
            ]}
          />
        </View>
      </View>
      <Text style={styles.payoutRowAmount}>{formatCurrency(row.gross_total_eur)}</Text>
      <Icon name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
};

export default function ResidentPayoutsScreen({
  userProfile,
  onBack,
  onCreateEntry,
  onOpenDetail,
}) {
  const { width } = useWindowDimensions();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [yearRows, setYearRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRows = useCallback(
    async (yearToLoad) => {
      if (!userProfile?.id) {
        setYearRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const rows = await getResidentPayoutsByYear(userProfile.id, yearToLoad);
        setYearRows(rows);
      } finally {
        setLoading(false);
      }
    },
    [userProfile?.id]
  );

  useEffect(() => {
    loadRows(selectedYear);
  }, [loadRows, selectedYear]);

  const summary = useMemo(
    () =>
      yearRows.reduce(
        (acc, row) => {
          acc.total += Number(row.gross_total_eur || 0);
          return acc;
        },
        { total: 0 }
      ),
    [yearRows]
  );
  const chartData = useMemo(() => buildPayoutChartData(yearRows), [yearRows]);
  const listRows = useMemo(
    () => [...yearRows].sort((a, b) => Number(b.period_month) - Number(a.period_month)),
    [yearRows]
  );
  const chartWidth = Math.max(width - 48, 320);
  const handleSelectChartMonth = (month) => {
    const selectedRow = yearRows.find(
      (row) =>
        Number(row.period_year) === Number(selectedYear) &&
        Number(row.period_month) === Number(month)
    );

    if (selectedRow) {
      onOpenDetail?.({
        initialYear: selectedYear,
        initialMonth: month,
      });
      return;
    }

    onCreateEntry?.({
      initialYear: selectedYear,
      initialMonth: month,
      lockInitialPeriod: false,
    });
  };

  return (
    <HeroScreenLayout
      title="Nóminas"
      subtitle="Controla cuánto cobras cada mes según tus guardias y otros ingresos"
      onBack={onBack}
      overlay={
        !loading ? (
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={onCreateEntry}
            activeOpacity={0.9}
          >
            <Icon name="add" size={22} color="#FFFFFF" />
            <Text style={styles.floatingButtonText}>Nuevo registro</Text>
          </TouchableOpacity>
        ) : null
      }
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#670CF5" />
          <Text style={styles.loadingText}>Cargando nóminas...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroEyebrow}>RESUMEN {selectedYear}</Text>
              <View style={styles.yearSwitcher}>
                <TouchableOpacity
                  style={styles.yearButton}
                  onPress={() => setSelectedYear((prev) => prev - 1)}
                  activeOpacity={0.8}
                >
                  <Icon name="chevron-back" size={16} color="#1B0977" />
                </TouchableOpacity>
                <Text style={styles.yearLabel}>{selectedYear}</Text>
                <TouchableOpacity
                  style={styles.yearButton}
                  onPress={() => setSelectedYear((prev) => prev + 1)}
                  activeOpacity={0.8}
                >
                  <Icon name="chevron-forward" size={16} color="#1B0977" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total ganado</Text>
              <Text style={styles.totalValue}>{formatCurrency(summary.total)}</Text>
            </View>

            <Text style={styles.heroSupportText}>
              Registra tus guardias del mes con contadores rápidos y entiende mejor
              de dónde salen tus ingresos.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Ingresos por mes</Text>
            </View>
            <MonthBarChart
              data={chartData}
              width={chartWidth}
              onSelectMonth={handleSelectChartMonth}
            />
          </View>

          <View style={styles.listSection}>
            <Text style={styles.listTitle}>Tus nóminas</Text>
            {listRows.length ? (
              listRows.map((row) => (
                <PayoutListRow
                  key={row.id}
                  row={row}
                  onPress={() =>
                    onOpenDetail?.({
                      initialYear: row.period_year,
                      initialMonth: row.period_month,
                    })
                  }
                />
              ))
            ) : (
              <Text style={styles.listEmptyText}>
                Aún no has registrado nóminas en {selectedYear}.
              </Text>
            )}
          </View>
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    // Deja sitio al botón flotante "Nuevo registro" sobre la última fila.
    paddingBottom: 104,
  },
  listSection: {
    gap: 10,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B0977",
    marginLeft: 4,
  },
  listEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    marginLeft: 4,
  },
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  payoutRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F4EEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  payoutRowCopy: {
    flex: 1,
  },
  payoutRowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  payoutRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  payoutRowMetaText: {
    fontSize: 12,
    color: "#64748B",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 6,
  },
  statusDotOrganized: {
    backgroundColor: "#22C55E",
  },
  statusDotPending: {
    backgroundColor: "#CBD5E1",
  },
  payoutRowAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B0977",
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.08)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#670CF5",
  },
  yearSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  yearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  yearLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
    minWidth: 52,
    textAlign: "center",
  },
  totalCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#F4EEFF",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#670CF5",
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1B0977",
  },
  heroSupportText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1B0977",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  chartWrap: {
    alignItems: "center",
  },
  ghostButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F4EEFF",
  },
  ghostButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#670CF5",
  },
  lockBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F4EEFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  lockBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#4C1D95",
  },
  floatingButton: {
    position: "absolute",
    right: 18,
    bottom: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#670CF5",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: "#670CF5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    zIndex: 20,
    elevation: 12,
  },
  floatingButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
