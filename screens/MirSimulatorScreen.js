import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Keyboard,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomMenuHeroHeader } from "../components/BottomMenuHeroHeader";
import { SelectFilter } from "../components/SelectFilter";
import { useHospitals } from "../hooks/useHospitals";
import { calculateMIRProbabilities } from "../services/mirSimulatorService";
import posthogLogger from "../services/posthogService";
import { getAdvertisementsByPlacement } from "../services/dashboardAdvertisementService";

const PRIMARY = "#670CF5";
const INDIGO = "#1B0977";
const BG_LIGHT = "#F8F9FE";

export default function MirSimulatorScreen({ onBack, userProfile, initialScore }) {
  const { specialties, uniqueRegions } = useHospitals();
  const scrollViewRef = useRef(null);
  const [mirScore, setMirScore] = useState(
    initialScore != null && initialScore !== "" ? String(initialScore) : ""
  );
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultsCardY, setResultsCardY] = useState(null);
  const [shouldScrollToResults, setShouldScrollToResults] = useState(false);
  const [mirAds, setMirAds] = useState([]);

  const specialtyOptions = useMemo(() => {
    return (specialties || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((specialty) => ({
        id: specialty.id,
        name: specialty.name,
      }));
  }, [specialties]);

  const regionOptions = useMemo(() => {
    return (uniqueRegions || [])
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((region) => ({
        id: region,
        name: region,
      }));
  }, [uniqueRegions]);

  useEffect(() => {
    posthogLogger.logScreen("MirSimulatorScreen");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMirAds = async () => {
      const { success, ads } = await getAdvertisementsByPlacement(
        userProfile,
        "mir_results"
      );

      if (!isMounted) return;
      setMirAds(success ? ads : []);
    };

    loadMirAds();

    return () => {
      isMounted = false;
    };
  }, [
    userProfile?.id,
    userProfile?.is_student,
    userProfile?.is_resident,
    userProfile?.is_doctor,
  ]);

  useEffect(() => {
    if (!shouldScrollToResults || results.length === 0 || resultsCardY == null) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(resultsCardY - 16, 0),
        animated: true,
      });
      setShouldScrollToResults(false);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [results.length, resultsCardY, shouldScrollToResults]);

  const canCalculate = mirScore && selectedSpecialty && !loading;
  const interleavedResults = useMemo(() => {
    if (!results.length) return [];

    const items = [];
    let adCursor = 0;

    results.forEach((result, index) => {
      items.push({
        type: "result",
        id: `result-${result.hospital.id}`,
        result,
      });

      if (mirAds.length > 0 && (index + 1) % 2 === 0) {
        const ad = mirAds[adCursor % mirAds.length];
        items.push({
          type: "ad",
          id: `ad-${ad.id}-${index}`,
          ad,
        });
        adCursor += 1;
      }
    });

    return items;
  }, [results, mirAds]);

  const handleCalculate = async () => {
    if (!canCalculate) return;

    Keyboard.dismiss();
    setLoading(true);
    try {
      const score =
        typeof mirScore === "string" ? parseFloat(mirScore) : mirScore;
      const {
        success,
        results: calculatedResults,
        error,
      } = await calculateMIRProbabilities(
        score,
        selectedSpecialty,
        selectedRegion &&
          typeof selectedRegion === "string" &&
          selectedRegion.trim() !== ""
          ? selectedRegion.trim()
          : null
      );

      if (success) {
        setResults(calculatedResults);
        setShouldScrollToResults(true);
      } else {
        console.error("Error calculating probabilities:", error);
        alert(
          "Error al calcular las probabilidades: " +
            (error || "Error desconocido")
        );
      }
    } catch (error) {
      console.error("Exception calculating probabilities:", error);
      alert("Error inesperado: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getGradeTrend = (grades) => {
    const validGrades = grades
      .filter(
        (g) =>
          g.grade !== null &&
          g.grade !== undefined &&
          typeof g.grade === "number"
      )
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));

    if (validGrades.length < 2) return null;

    const n = validGrades.length;
    const years = validGrades.map((g) => parseInt(g.year));
    const values = validGrades.map((g) => g.grade);
    const minYear = years[0];
    const xNorm = years.map((y) => y - minYear);

    const sumX = xNorm.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = xNorm.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = xNorm.reduce((sum, x) => sum + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return "stable";

    const slope = (n * sumXY - sumX * sumY) / denom;
    const avgValue = sumY / n;
    const relativeSlope = avgValue !== 0 ? slope / avgValue : 0;

    if (relativeSlope > 0.02) return "up";
    if (relativeSlope < -0.02) return "down";
    return "stable";
  };

  const getProbabilityColor = (probability) => {
    if (probability === "NA") return "#9CA3AF";
    const prob = parseInt(probability.replace("%", ""), 10);
    if (prob >= 75) return "#059669";
    if (prob >= 50) return "#D97706";
    if (prob >= 25) return "#DC2626";
    return "#DC2626";
  };

  const getProbabilityBgColor = (probability) => {
    if (probability === "NA") return "#F3F4F6";
    const prob = parseInt(probability.replace("%", ""), 10);
    if (prob >= 75) return "#D1FAE5";
    if (prob >= 50) return "#FEF3C7";
    if (prob >= 25) return "#FEE2E2";
    return "#FEE2E2";
  };

  const renderResultCard = (item) => {
    const currentYear = new Date().getFullYear();
    const filteredGrades = item.grades.filter((grade) => {
      const year =
        typeof grade.year === "string" ? parseInt(grade.year, 10) : grade.year;
      return year !== currentYear;
    });

    const trend = getGradeTrend(filteredGrades);
    const trendConfig = {
      up: {
        icon: "trending-up",
        color: "#059669",
        bg: "#D1FAE5",
        border: "#A7F3D0",
      },
      down: {
        icon: "trending-down",
        color: "#DC2626",
        bg: "#FEE2E2",
        border: "#FECACA",
      },
      stable: {
        icon: "remove",
        color: "#64748B",
        bg: "#F1F5F9",
        border: "#E2E8F0",
      },
    };
    const tc = trend ? trendConfig[trend] : null;

    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultHospitalName}>{item.hospital.name}</Text>
          <View style={styles.resultBadges}>
            {tc && (
              <View
                style={[
                  styles.trendBadge,
                  { backgroundColor: tc.bg, borderColor: tc.border },
                ]}
              >
                <Ionicons name={tc.icon} size={13} color={tc.color} />
              </View>
            )}
            <View
              style={[
                styles.probabilityBadge,
                { backgroundColor: getProbabilityBgColor(item.probability) },
              ]}
            >
              <Text
                style={[
                  styles.probabilityText,
                  { color: getProbabilityColor(item.probability) },
                ]}
              >
                {item.probability === "NA" ? "Sin datos" : item.probability}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.resultLocation}>
          <Ionicons name="location" size={14} color="#6B7280" />
          <Text style={styles.resultLocationText}>
            {item.hospital.city}, {item.hospital.region}
          </Text>
          {item.yearsUsed > 0 && (
            <View style={styles.yearsBadge}>
              <Text style={styles.yearsText}>
                {item.yearsUsed} {item.yearsUsed === 1 ? "año" : "años"} de datos
              </Text>
            </View>
          )}
          {item.currentYearSlots != null && (
            <View style={styles.slotsBadge}>
              <Text style={styles.slotsText}>
                {item.currentYearSlots}{" "}
                {item.currentYearSlots === 1 ? "plaza" : "plazas"}
              </Text>
            </View>
          )}
        </View>

        {item.info_note ? (
          <Text style={styles.infoNoteText}>{item.info_note}</Text>
        ) : null}

        <View style={styles.gradesGrid}>
          {filteredGrades.map((grade) => {
            const gradeValue = grade.grade;
            const hasGrade =
              gradeValue != null &&
              gradeValue !== "" &&
              !isNaN(parseFloat(gradeValue)) &&
              isFinite(parseFloat(gradeValue));
            const isAbove =
              hasGrade && parseFloat(mirScore) <= parseFloat(gradeValue);

            return (
              <View
                key={grade.year}
                style={[
                  styles.gradeCard,
                  hasGrade
                    ? isAbove
                      ? styles.gradeCardSuccess
                      : styles.gradeCardFail
                    : styles.gradeCardEmpty,
                ]}
              >
                <Text
                  style={[styles.gradeYear, !hasGrade && styles.gradeYearEmpty]}
                >
                  {grade.year}
                </Text>
                <Text
                  style={[
                    styles.gradeValue,
                    hasGrade
                      ? isAbove
                        ? styles.gradeValueSuccess
                        : styles.gradeValueFail
                      : styles.gradeValueEmpty,
                  ]}
                >
                  {hasGrade ? gradeValue : "N/A"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMirAdCard = (ad) => {
    return (
      <View style={styles.inlineAdCard}>
        {ad?.image_url ? (
          <ImageBackground
            source={{ uri: ad.image_url }}
            style={styles.inlineAdImage}
            imageStyle={styles.inlineAdImageAsset}
          >
            <View style={styles.inlineAdBadge}>
              <Text style={styles.inlineAdBadgeText}>Ad</Text>
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.inlineAdImage, styles.inlineAdPlaceholder]}>
            <View style={styles.inlineAdBadge}>
              <Text style={styles.inlineAdBadgeText}>Ad</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderResultsListItem = ({ item }) => {
    if (item.type === "ad") {
      return renderMirAdCard(item.ad);
    }

    return renderResultCard(item.result);
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroShell}>
        <BottomMenuHeroHeader
          title="Simulador MIR"
          subtitle="Calcula tus probabilidades de obtener plaza."
        />
      </View>

      <View style={styles.contentShell}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tu posición en el MIR *</Text>
          <TextInput
            style={styles.numberInput}
            placeholder="Ej: 1950"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={mirScore}
            onChangeText={(text) => {
              const num = text === "" ? "" : parseFloat(text, 10);
              if (text === "" || (!isNaN(num) && num >= 0)) {
                setMirScore(text);
              }
            }}
            maxLength={5}
          />
        </View>

        <View style={styles.inputGroup}>
          <SelectFilter
            label="Filtrar por especialidad *"
            value={selectedSpecialty}
            onSelect={setSelectedSpecialty}
            options={specialtyOptions}
            placeholder="Selecciona una especialidad"
            style={styles.selectFilter}
          />
        </View>

        <View style={styles.inputGroup}>
          <SelectFilter
            label="Filtrar por comunidad autónoma"
            value={selectedRegion}
            onSelect={setSelectedRegion}
            options={regionOptions}
            placeholder="Todas las comunidades autónomas"
            style={styles.selectFilter}
          />
        </View>

            <TouchableOpacity
              style={[
                styles.calculateButton,
                !canCalculate && styles.calculateButtonDisabled,
              ]}
              onPress={handleCalculate}
              disabled={!canCalculate}
              activeOpacity={0.9}
            >
              {loading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.calculateButtonText}>Calculando...</Text>
                </View>
              ) : (
                <Text style={styles.calculateButtonText}>
                  Calcular probabilidades
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {results.length > 0 && (
            <View
              style={styles.resultsCard}
              onLayout={(event) => {
                setResultsCardY(event.nativeEvent.layout.y);
              }}
            >
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Resultados de probabilidad</Text>
                <Text style={styles.resultsSubtitle}>
                  Basado en las notas de corte de los últimos 7 años (2019-2025)
                </Text>
              </View>
              <FlatList
                data={interleavedResults}
                renderItem={renderResultsListItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.resultsList}
              />
            </View>
          )}

          <View style={styles.helpCard}>
            <View style={styles.helpHeader}>
              <Ionicons name="school" size={20} color={PRIMARY} />
              <Text style={styles.helpTitle}>
                ¿Cómo se calcula la probabilidad?
              </Text>
            </View>
            <Text style={styles.helpText}>
              La probabilidad se basa en los años disponibles de notas de corte
              (2019-2025). Solo se incluyen en el cálculo los años que tienen datos
              válidos. En el MIR, los números más bajos representan mejores
              posiciones. Si tu posición es igual o mejor (menor) que la nota de
              corte histórica, tu probabilidad aumenta significativamente.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  heroShell: {
    position: "relative",
  },
  contentShell: {
    flex: 1,
    position: "relative",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  formCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.8)",
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: INDIGO,
    marginBottom: 8,
  },
  numberInput: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: INDIGO,
  },
  selectFilter: {
    borderRadius: 16,
    borderColor: "#E2E8F0",
  },
  calculateButton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  calculateButtonDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calculateButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  resultsCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  resultsHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: INDIGO,
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: "#64748B",
  },
  resultsList: {
    padding: 16,
    gap: 12,
  },
  resultCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inlineAdCard: {
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.12)",
    padding: 12,
  },
  inlineAdImage: {
    minHeight: 132,
    borderRadius: 20,
    overflow: "hidden",
    padding: 16,
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  inlineAdImageAsset: {
    borderRadius: 20,
  },
  inlineAdPlaceholder: {
    backgroundColor: "#F6F0FF",
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.10)",
  },
  inlineAdBadge: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(15,23,42,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  inlineAdBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFF",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  resultHospitalName: {
    fontSize: 16,
    fontWeight: "600",
    color: INDIGO,
    flex: 1,
    marginRight: 8,
  },
  resultBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  trendBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  probabilityBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  probabilityText: {
    fontSize: 14,
    fontWeight: "600",
  },
  resultLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  resultLocationText: {
    fontSize: 14,
    color: "#64748B",
  },
  yearsBadge: {
    backgroundColor: "#DBEAFE",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  yearsText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "500",
  },
  slotsBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  slotsText: {
    fontSize: 12,
    color: "#D97706",
    fontWeight: "500",
  },
  infoNoteText: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 8,
  },
  gradesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  gradeCard: {
    borderRadius: 12,
    padding: 10,
    minWidth: 64,
    alignItems: "center",
    borderWidth: 1,
  },
  gradeCardSuccess: {
    backgroundColor: "#D1FAE5",
    borderColor: "#A7F3D0",
  },
  gradeCardFail: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  gradeCardEmpty: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  gradeYear: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    marginBottom: 4,
  },
  gradeYearEmpty: {
    color: "#94A3B8",
  },
  gradeValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  gradeValueSuccess: {
    color: "#059669",
  },
  gradeValueFail: {
    color: "#DC2626",
  },
  gradeValueEmpty: {
    color: "#94A3B8",
  },
  helpCard: {
    backgroundColor: "#EBF1FF",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  helpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: INDIGO,
  },
  helpText: {
    fontSize: 12,
    color: "rgba(27,9,119,0.75)",
    lineHeight: 20,
  },
});
