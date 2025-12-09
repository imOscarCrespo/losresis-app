import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenLayout } from "../components/ScreenLayout";
import { SelectFilter } from "../components/SelectFilter";
import { useHospitals } from "../hooks/useHospitals";
import { calculateMIRProbabilities } from "../services/mirSimulatorService";

export default function MirSimulatorScreen({ onBack }) {
  const { specialties, uniqueRegions } = useHospitals();
  const [mirScore, setMirScore] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Preparar opciones para los selects
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

  // Validar si se puede calcular
  const canCalculate = mirScore && selectedSpecialty && !loading;

  const handleCalculate = async () => {
    if (!canCalculate) return;

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
        selectedRegion || null
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
    const prob = parseInt(probability.replace("%", ""));
    if (prob >= 75) return "#059669"; // green
    if (prob >= 50) return "#D97706"; // yellow/orange
    if (prob >= 25) return "#DC2626"; // orange/red
    return "#DC2626"; // red
  };

  const getProbabilityBgColor = (probability) => {
    if (probability === "NA") return "#F3F4F6";
    const prob = parseInt(probability.replace("%", ""));
    if (prob >= 75) return "#D1FAE5";
    if (prob >= 50) return "#FEF3C7";
    if (prob >= 25) return "#FEE2E2";
    return "#FEE2E2";
  };

  const renderResultItem = ({ item }) => {
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
          <Ionicons name="location" size={14} color="#666" />
          <Text style={styles.resultLocationText}>
            {item.hospital.city}, {item.hospital.region}
          </Text>
          {item.yearsUsed > 0 && (
            <View style={styles.yearsBadge}>
              <Text style={styles.yearsText}>
                {item.yearsUsed} {item.yearsUsed === 1 ? "año" : "años"} de
                datos
              </Text>
            </View>
          )}
        </View>

        {/* Historical grades */}
        <View style={styles.gradesGrid}>
          {item.grades.map((grade) => {
            const hasGrade = grade.grade !== null && grade.grade !== undefined;
            const isAbove = hasGrade && parseFloat(mirScore) <= grade.grade;

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
                <Text style={styles.gradeYear}>{grade.year}</Text>
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
                  {grade.grade ?? "N/A"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const handleHospitalPress = () => {
    if (onBack) onBack();
  };

  const handleStudentPress = () => {
    // Esta es la pantalla del simulador MIR (estudiante)
    // No hacer nada, ya estamos aquí
  };

  const handleReviewsPress = () => {
    if (onBack) onBack();
  };

  return (
    <ScreenLayout
      onHospitalPress={handleHospitalPress}
      onStudentPress={handleStudentPress}
      onReviewsPress={handleReviewsPress}
      activeTab="student"
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header con botón de volver */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Simulador MIR</Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <View style={styles.formRow}>
            {/* MIR Score Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tu posición en el MIR *</Text>
              <TextInput
                style={styles.numberInput}
                placeholder="1950"
                keyboardType="numeric"
                value={mirScore.toString()}
                onChangeText={(text) => {
                  const num = text === "" ? "" : parseFloat(text);
                  if (text === "" || (!isNaN(num) && num >= 0)) {
                    setMirScore(text);
                  }
                }}
                maxLength={5}
              />
            </View>

            {/* Specialty Selection */}
            <View style={styles.inputGroup}>
              <SelectFilter
                label="Filtrar por especialidad *"
                value={selectedSpecialty}
                onSelect={setSelectedSpecialty}
                options={specialtyOptions}
                placeholder="Selecciona una especialidad"
              />
            </View>

            {/* Region Selection */}
            <View style={styles.inputGroup}>
              <SelectFilter
                label="Filtrar por comunidad autónoma"
                value={selectedRegion}
                onSelect={setSelectedRegion}
                options={regionOptions}
                placeholder="Todas las comunidades autónomas"
              />
            </View>
          </View>

          {/* Calculate Button */}
          <TouchableOpacity
            style={[
              styles.calculateButton,
              !canCalculate && styles.calculateButtonDisabled,
            ]}
            onPress={handleCalculate}
            disabled={!canCalculate}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.calculateButtonText}>Calculando...</Text>
              </View>
            ) : (
              <Text style={styles.calculateButtonText}>
                Calcular probabilidades
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {results.length > 0 && (
          <View style={styles.resultsCard}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                Resultados de probabilidad
              </Text>
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

        {/* Help Text */}
        <View style={styles.helpCard}>
          <View style={styles.helpHeader}>
            <Ionicons name="school" size={20} color="#2563EB" />
            <Text style={styles.helpTitle}>
              ¿Cómo se calcula la probabilidad?
            </Text>
          </View>
          <Text style={styles.helpText}>
            La probabilidad se basa en los años disponibles de notas de corte
            (2019-2025). Solo se incluyen en el cálculo los años que tienen
            datos válidos. En el MIR, los números más bajos representan mejores
            posiciones (como un ranking). Si tu posición es igual o mejor
            (menor) que la nota de corte, podrías haber accedido ese año. El
            porcentaje muestra en cuántos de esos años con datos habrías tenido
            oportunidad de conseguir plaza.
          </Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formRow: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  numberInput: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1a1a1a",
  },
  calculateButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#8B5CF6",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  calculateButtonDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calculateButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  resultsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    margin: 16,
    marginTop: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  resultsHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    backgroundColor: "#F9FAFB",
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  resultsList: {
    padding: 16,
  },
  resultCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
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
    color: "#1a1a1a",
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
  },
  resultLocationText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
    marginRight: 8,
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
  gradesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  gradeCard: {
    borderRadius: 8,
    padding: 8,
    minWidth: 60,
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
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  gradeYear: {
    fontSize: 11,
    fontWeight: "500",
    color: "#666",
    marginBottom: 4,
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
    color: "#9CA3AF",
  },
  helpCard: {
    backgroundColor: "#DBEAFE",
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  helpHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
    marginLeft: 8,
  },
  helpText: {
    fontSize: 14,
    color: "#1E3A8A",
    lineHeight: 20,
  },
});
