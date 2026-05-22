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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

export default function MirOrientationScreen({ onBack, userProfile }) {
  const { uniqueRegions } = useHospitals();
  const scrollViewRef = useRef(null);
  const [mirScore, setMirScore] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedSpecialty, setExpandedSpecialty] = useState(null);

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
    try {
      const score =
        typeof mirScore === "string" ? parseFloat(mirScore) : mirScore;
      const region =
        selectedRegion &&
        typeof selectedRegion === "string" &&
        selectedRegion.trim() !== ""
          ? selectedRegion.trim()
          : null;

      const { success, results: calculatedResults, error } =
        await calculateMIROrientation(score, region);

      if (success) {
        setResults(calculatedResults);
        setHasSearched(true);
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

  const renderHospitalRow = (hospital) => {
    const currentYear = new Date().getFullYear();
    const filteredGrades = hospital.grades.filter((grade) => {
      const year =
        typeof grade.year === "string" ? parseInt(grade.year, 10) : grade.year;
      return year !== currentYear;
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
          <Ionicons name="location" size={13} color="#6B7280" />
          <Text style={styles.hospitalLocationText}>
            {hospital.hospital.city}, {hospital.hospital.region}
          </Text>
          {hospital.currentYearSlots != null && (
            <View style={styles.slotsBadge}>
              <Text style={styles.slotsText}>
                {hospital.currentYearSlots}{" "}
                {hospital.currentYearSlots === 1 ? "plaza" : "plazas"}
              </Text>
            </View>
          )}
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

  const renderSpecialtyCard = (specialty) => {
    const isExpanded = expandedSpecialty === specialty.specialityId;

    return (
      <View key={specialty.specialityId} style={styles.specialtyCard}>
        <TouchableOpacity
          style={styles.specialtyHeader}
          onPress={() =>
            setExpandedSpecialty(isExpanded ? null : specialty.specialityId)
          }
          activeOpacity={0.85}
        >
          <View style={styles.specialtyHeaderText}>
            <Text style={styles.specialtyName}>{specialty.specialityName}</Text>
            <View style={styles.specialtyMeta}>
              <View
                style={[
                  styles.metaBadge,
                  specialty.accessibleCount > 0
                    ? styles.metaBadgeSuccess
                    : styles.metaBadgeNeutral,
                ]}
              >
                <Text
                  style={[
                    styles.metaBadgeText,
                    specialty.accessibleCount > 0
                      ? styles.metaBadgeTextSuccess
                      : styles.metaBadgeTextNeutral,
                  ]}
                >
                  {specialty.accessibleCount} de {specialty.hospitalCount}{" "}
                  {specialty.hospitalCount === 1 ? "hospital" : "hospitales"}{" "}
                  accesibles
                </Text>
              </View>
              {specialty.totalCurrentYearSlots > 0 && (
                <Text style={styles.specialtySlotsText}>
                  {specialty.totalCurrentYearSlots} plazas
                </Text>
              )}
            </View>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.specialtyBody}>
            {specialty.hospitals.map(renderHospitalRow)}
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
              </View>
              <View style={styles.resultsList}>
                {results.map(renderSpecialtyCard)}
              </View>
            </View>
          )}

          {hasSearched && !loading && results.length === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons name="search" size={28} color="#94A3B8" />
              <Text style={styles.emptyText}>
                No se encontraron especialidades con datos para los filtros
                seleccionados.
              </Text>
            </View>
          )}

          <View style={styles.helpCard}>
            <View style={styles.helpHeader}>
              <Ionicons name="compass" size={20} color={PRIMARY} />
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
    marginHorizontal: 24,
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
    marginHorizontal: 24,
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
  specialtyCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
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
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaBadgeSuccess: {
    backgroundColor: "#D1FAE5",
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
  metaBadgeTextNeutral: {
    color: "#64748B",
  },
  specialtySlotsText: {
    fontSize: 12,
    color: "#D97706",
    fontWeight: "500",
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
    marginHorizontal: 24,
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
    marginHorizontal: 24,
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
