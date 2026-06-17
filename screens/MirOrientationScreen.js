import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  InteractionManager,
} from "react-native";
import { Icon } from "../components/Icon";
import { BottomMenuHeroHeader } from "../components/BottomMenuHeroHeader";
import { SelectFilter } from "../components/SelectFilter";
import { useHospitals } from "../hooks/useHospitals";
import { calculateMIROrientation } from "../services/mirSimulatorService";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const INDIGO = "#1B0977";
const BG_LIGHT = "#F8F9FE";

const getProbabilityColor = (probability) => {
  if (probability === "NA") return "#9CA3AF";
  const prob = parseInt(probability.replace("%", ""), 10);
  if (prob >= 75) return "#059669";
  if (prob >= 50) return "#D97706";
  return "#DC2626";
};

const getProbabilityBgColor = (probability) => {
  if (probability === "NA") return "#F3F4F6";
  const prob = parseInt(probability.replace("%", ""), 10);
  if (prob >= 75) return "#D1FAE5";
  if (prob >= 50) return "#FEF3C7";
  return "#FEE2E2";
};

export default function MirOrientationScreen({ onBack, userProfile, initialScore }) {
  const { uniqueRegions } = useHospitals();
  const scrollViewRef = useRef(null);
  const [mirScore, setMirScore] = useState(
    initialScore != null && initialScore !== "" ? String(initialScore) : ""
  );
  const [selectedRegion, setSelectedRegion] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedSpecialty, setExpandedSpecialty] = useState(null);
  const [pendingSpecialty, setPendingSpecialty] = useState(null);

  const regionOptions = useMemo(() => {
    return (uniqueRegions || [])
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((region) => ({ id: region, name: region }));
  }, [uniqueRegions]);

  useEffect(() => {
    posthogLogger.logScreen("MirOrientationScreen");
  }, []);

  const canCalculate = mirScore && !loading;

  const handleCalculate = async () => {
    if (!canCalculate) return;

    Keyboard.dismiss();
    setLoading(true);
    setExpandedSpecialty(null);
    setPendingSpecialty(null);
    try {
      const score =
        typeof mirScore === "string" ? parseFloat(mirScore) : mirScore;
      const region =
        selectedRegion &&
        typeof selectedRegion === "string" &&
        selectedRegion.trim() !== ""
          ? selectedRegion.trim()
          : null;

      posthogLogger.capture("mir_orientation_search_clicked", {
        mir_score: score,
        region: region,
        has_region_filter: region != null,
      });

      const { success, results: calculatedResults, error } =
        await calculateMIROrientation(score, region);

      if (success) {
        setResults(calculatedResults);
        setHasSearched(true);
        posthogLogger.capture("mir_orientation_search_completed", {
          mir_score: score,
          region: region,
          results_count: calculatedResults?.length || 0,
        });
      } else {
        console.error("Error calculating orientation:", error);
        alert(
          "Error al buscar especialidades: " + (error || "Error desconocido")
        );
      }
    } catch (error) {
      console.error("Exception calculating orientation:", error);
      alert("Error inesperado: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderHospitalRow = (hospital, slotsYear) => {
    // Ocultar de la rejilla histórica el año cuyas plazas estamos mostrando aparte
    // (no hay nota de corte aún para esa convocatoria).
    const filteredGrades = hospital.grades.filter((grade) => {
      const year =
        typeof grade.year === "string" ? parseInt(grade.year, 10) : grade.year;
      return slotsYear == null || year !== slotsYear;
    });

    return (
      <View key={hospital.hospital.id} style={styles.hospitalRow}>
        <View style={styles.hospitalHeader}>
          <Text style={styles.hospitalName}>{hospital.hospital.name}</Text>
          <View
            style={[
              styles.probabilityBadge,
              { backgroundColor: getProbabilityBgColor(hospital.probability) },
            ]}
          >
            <Text
              style={[
                styles.probabilityText,
                { color: getProbabilityColor(hospital.probability) },
              ]}
            >
              {hospital.probability === "NA" ? "Sin datos" : hospital.probability}
            </Text>
          </View>
        </View>

        <View style={styles.hospitalLocation}>
          <Icon name="location" size={13} color="#6B7280" />
          <Text style={styles.hospitalLocationText}>
            {hospital.hospital.city}, {hospital.hospital.region}
          </Text>
        </View>

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

  const handleToggleSpecialty = (specialtyId) => {
    if (expandedSpecialty === specialtyId) {
      setExpandedSpecialty(null);
      setPendingSpecialty(null);
      return;
    }
    setExpandedSpecialty(null);
    setPendingSpecialty(specialtyId);
    InteractionManager.runAfterInteractions(() => {
      setExpandedSpecialty(specialtyId);
      setPendingSpecialty(null);
    });
  };

  const renderSpecialtyCard = (specialty) => {
    const isExpanded = expandedSpecialty === specialty.specialityId;
    const isPending = pendingSpecialty === specialty.specialityId;
    const userScore = parseFloat(mirScore);
    let safeCount = 0;
    let variableCount = 0;
    let hardCount = 0;
    specialty.hospitals.forEach((h) => {
      const validGrades = h.grades
        .map((g) => parseFloat(g.grade))
        .filter((v) => !isNaN(v) && isFinite(v));
      if (validGrades.length === 0) return;
      const allPass = validGrades.every((g) => userScore <= g);
      const allFail = validGrades.every((g) => userScore > g);
      if (allPass) safeCount += 1;
      else if (allFail) hardCount += 1;
      else variableCount += 1;
    });

    const isInaccessible = safeCount === 0 && variableCount === 0;

    return (
      <View
        key={specialty.specialityId}
        style={[styles.specialtyCard, isInaccessible && styles.specialtyCardDisabled]}
      >
        <TouchableOpacity
          style={styles.specialtyHeader}
          onPress={() => handleToggleSpecialty(specialty.specialityId)}
          activeOpacity={0.85}
        >
          <View style={styles.specialtyHeaderText}>
            <Text
              style={[
                styles.specialtyName,
                isInaccessible && styles.specialtyNameDisabled,
              ]}
            >
              {specialty.specialityName}
            </Text>
            <View style={styles.specialtyMeta}>
              <View style={styles.countsPill}>
                <Text style={[styles.countsPillText, styles.countsPillSuccess]}>
                  {safeCount}
                </Text>
                <View style={styles.countsPillDivider} />
                <Text style={[styles.countsPillText, styles.countsPillWarning]}>
                  {variableCount}
                </Text>
                <View style={styles.countsPillDivider} />
                <Text style={[styles.countsPillText, styles.countsPillDanger]}>
                  {hardCount}
                </Text>
              </View>
            </View>
            {(specialty.gradeYearsRange ||
              (typeof specialty.totalHospitalCount === "number" &&
                specialty.totalHospitalCount !== specialty.hospitalCount)) && (
              <Text style={styles.specialtyDataNote}>
                {specialty.gradeYearsRange
                  ? `Cortes ${specialty.gradeYearsRange.minYear}–${specialty.gradeYearsRange.maxYear}`
                  : ""}
                {specialty.gradeYearsRange &&
                typeof specialty.totalHospitalCount === "number" &&
                specialty.totalHospitalCount !== specialty.hospitalCount
                  ? " · "
                  : ""}
                {typeof specialty.totalHospitalCount === "number" &&
                specialty.totalHospitalCount !== specialty.hospitalCount
                  ? `${specialty.totalHospitalCount - specialty.hospitalCount} hospital${
                      specialty.totalHospitalCount - specialty.hospitalCount === 1
                        ? ""
                        : "es"
                    } sin datos suficientes`
                  : ""}
              </Text>
            )}
          </View>
          {isPending ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Icon
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#94A3B8"
            />
          )}
        </TouchableOpacity>

        {isPending && (
          <View style={styles.specialtyLoading}>
            <ActivityIndicator size="small" color={PRIMARY} />
          </View>
        )}

        {isExpanded && (
          <View style={styles.specialtyBody}>
            {specialty.hospitals.map((h) =>
              renderHospitalRow(h, specialty.slotsYear)
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroShell}>
        <BottomMenuHeroHeader
          title="Orientador MIR"
          subtitle="Descubre qué especialidades y hospitales te da tu nota."
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
                  <Text style={styles.calculateButtonText}>Buscando...</Text>
                </View>
              ) : (
                <Text style={styles.calculateButtonText}>
                  Buscar especialidades
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {results.length > 0 && (
            <View style={styles.resultsCard}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>
                  Especialidades según tu nota
                </Text>
                <Text style={styles.resultsSubtitle}>
                  Ordenadas por número de hospitales accesibles. Toca una para
                  ver el detalle.
                </Text>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendSwatch, { backgroundColor: "#059669" }]}
                    />
                    <Text style={styles.legendText}>seguros</Text>
                  </View>
                  <View style={styles.legendDot} />
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendSwatch, { backgroundColor: "#D97706" }]}
                    />
                    <Text style={styles.legendText}>variables</Text>
                  </View>
                  <View style={styles.legendDot} />
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendSwatch, { backgroundColor: "#DC2626" }]}
                    />
                    <Text style={styles.legendText}>difíciles</Text>
                  </View>
                </View>
                <View style={styles.legendCaptionRow}>
                  <Icon
                    name="information-circle-outline"
                    size={13}
                    color="#94A3B8"
                  />
                  <Text style={styles.legendCaption}>
                    Hospitales accesibles todos los años (verde), algunos años
                    (naranja) o ninguno (rojo) con tu nota.
                  </Text>
                </View>
              </View>
              <View style={styles.resultsList}>
                {results.map(renderSpecialtyCard)}
              </View>
            </View>
          )}

          {hasSearched && !loading && results.length === 0 && (
            <View style={styles.emptyCard}>
              <Icon name="search" size={28} color="#94A3B8" />
              <Text style={styles.emptyText}>
                No se encontraron especialidades con datos para los filtros
                seleccionados.
              </Text>
            </View>
          )}

          <View style={styles.helpCard}>
            <View style={styles.helpHeader}>
              <Icon name="compass" size={20} color={PRIMARY} />
              <Text style={styles.helpTitle}>¿Cómo funciona?</Text>
            </View>
            <Text style={styles.helpText}>
              Introduce tu posición (número de orden) en el MIR y el orientador
              recorre todas las especialidades para mostrarte dónde encajarías.
              Un hospital se considera "accesible" si tu nota te habría dado
              plaza en al menos la mitad de los años con datos. Recuerda: en el
              MIR los números más bajos representan mejores posiciones.
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
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: "#64748B",
  },
  legendDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#CBD5E1",
  },
  legendCaptionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 6,
  },
  legendCaption: {
    flex: 1,
    fontSize: 11,
    color: "#94A3B8",
    lineHeight: 15,
  },
  resultsList: {
    padding: 16,
    gap: 12,
  },
  specialtyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  specialtyCardDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    opacity: 0.75,
  },
  specialtyNameDisabled: {
    color: "#94A3B8",
  },
  specialtyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  specialtyHeaderText: {
    flex: 1,
  },
  specialtyName: {
    fontSize: 16,
    fontWeight: "700",
    color: INDIGO,
    marginBottom: 6,
  },
  specialtyMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaBadgeSuccess: {
    backgroundColor: "#D1FAE5",
  },
  metaBadgeWarning: {
    backgroundColor: "#FEF3C7",
  },
  metaBadgeDanger: {
    backgroundColor: "#FEE2E2",
  },
  metaBadgeNeutral: {
    backgroundColor: "#F1F5F9",
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  metaBadgeTextSuccess: {
    color: "#059669",
  },
  metaBadgeTextWarning: {
    color: "#D97706",
  },
  metaBadgeTextDanger: {
    color: "#DC2626",
  },
  metaBadgeTextNeutral: {
    color: "#64748B",
  },
  countsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 8,
  },
  countsPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  countsPillDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#E2E8F0",
  },
  countsPillSuccess: {
    color: "#059669",
  },
  countsPillWarning: {
    color: "#D97706",
  },
  countsPillDanger: {
    color: "#DC2626",
  },
  specialtySlotsText: {
    fontSize: 12,
    color: "#D97706",
    fontWeight: "500",
  },
  specialtyDataNote: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
    lineHeight: 14,
  },
  specialtyLoading: {
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  specialtyBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  hospitalRow: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  hospitalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  hospitalName: {
    fontSize: 15,
    fontWeight: "600",
    color: INDIGO,
    flex: 1,
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
  hospitalLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  hospitalLocationText: {
    fontSize: 13,
    color: "#64748B",
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
  gradesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  emptyCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 28,
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
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
