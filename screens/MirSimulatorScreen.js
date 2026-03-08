import React, { useState, useMemo, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SelectFilter } from "../components/SelectFilter";
import { useHospitals } from "../hooks/useHospitals";
import { calculateMIRProbabilities } from "../services/mirSimulatorService";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const INDIGO = "#1B0977";
const BG_LIGHT = "#F8FAFC";

export default function MirSimulatorScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const { specialties, uniqueRegions } = useHospitals();
  const [mirScore, setMirScore] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const canCalculate = mirScore && selectedSpecialty && !loading;

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

  const renderResultItem = ({ item }) => {
    const currentYear = new Date().getFullYear();
    const filteredGrades = item.grades.filter((grade) => {
      const year =
        typeof grade.year === "string" ? parseInt(grade.year, 10) : grade.year;
      return year !== currentYear;
    });

    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultHospitalName}>{item.hospital.name}</Text>
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header púrpura */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Ionicons name="menu" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconButton}>
              <Ionicons name="notifications-outline" size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </View>
        <Text style={styles.headerTitle}>Simulador MIR</Text>
        <Text style={styles.headerSubtitle}>
          Calcula tus probabilidades de obtener plaza
        </Text>
      </View>

      {/* Card del formulario (solapa el header) */}
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

      {/* Resultados */}
      {results.length > 0 && (
        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Resultados de probabilidad</Text>
            <Text style={styles.resultsSubtitle}>
              Basado en las notas de corte de los últimos 7 años (2019-2025)
            </Text>
          </View>
          <FlatList
            data={results}
            renderItem={renderResultItem}
            keyExtractor={(item) => item.hospital.id}
            scrollEnabled={false}
            contentContainerStyle={styles.resultsList}
          />
        </View>
      )}

      {/* Caja informativa */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  header: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingHorizontal: 24,
    paddingBottom: 48,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
  },
  formCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 24,
    marginTop: -24,
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
    overflow: "hidden",
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
  },
  resultCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
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
