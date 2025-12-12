import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getHospitalSpecialties,
  getDetailedGrades,
} from "../services/hospitalService";

/**
 * Pantalla de detalle del hospital con especialidades y notas de corte
 * @param {object} props
 * @param {object} props.hospital - Objeto del hospital seleccionado
 * @param {string} props.selectedSpecialtyId - ID de especialidad filtrada (opcional)
 * @param {function} props.onBack - Callback para volver atrás
 */
export default function HospitalDetailScreen({
  hospital,
  selectedSpecialtyId,
  onBack,
}) {
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSpecialty, setExpandedSpecialty] = useState(null);
  const [detailedGrades, setDetailedGrades] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  useEffect(() => {
    if (hospital?.id) {
      fetchSpecialties();
    }
  }, [hospital?.id]);

  const fetchSpecialties = async () => {
    setLoading(true);
    try {
      const {
        success,
        specialties: specialtiesData,
        error,
      } = await getHospitalSpecialties(hospital.id);
      if (success) {
        console.log("📊 Specialties loaded:", specialtiesData.length);
        console.log("📊 First specialty sample:", specialtiesData[0]);
        setSpecialties(specialtiesData);
      } else {
        console.error("Error loading specialties:", error);
      }
    } catch (error) {
      console.error("Exception fetching specialties:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar especialidades si hay una seleccionada
  const filteredSpecialties = useMemo(() => {
    if (selectedSpecialtyId) {
      return specialties.filter((spec) => spec.id === selectedSpecialtyId);
    }
    return specialties;
  }, [specialties, selectedSpecialtyId]);

  const handleMoreInfo = async (specialty) => {
    // Si ya está expandida, colapsarla
    if (expandedSpecialty === specialty.id) {
      setExpandedSpecialty(null);
      setDetailedGrades((prev) => {
        const newState = { ...prev };
        delete newState[specialty.id];
        return newState;
      });
      return;
    }

    // Expandir y cargar datos detallados
    setExpandedSpecialty(specialty.id);
    setLoadingDetails((prev) => ({ ...prev, [specialty.id]: true }));

    try {
      const { success, grades, error } = await getDetailedGrades(
        hospital.id,
        specialty.id
      );

      if (success) {
        setDetailedGrades((prev) => ({
          ...prev,
          [specialty.id]: grades,
        }));
      } else {
        console.error("Error loading detailed grades:", error);
        setDetailedGrades((prev) => ({
          ...prev,
          [specialty.id]: [],
        }));
      }
    } catch (error) {
      console.error("Exception fetching detailed grades:", error);
      setDetailedGrades((prev) => ({
        ...prev,
        [specialty.id]: [],
      }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [specialty.id]: false }));
    }
  };

  const renderSpecialtyItem = ({ item }) => {
    // Debug: verificar los datos de la especialidad
    console.log("🎯 Rendering specialty:", item.name);
    console.log("🎯 Grades data:", {
      grade_2025: item.grade_2025,
      grade_2024: item.grade_2024,
      grade_2023: item.grade_2023,
      grade_2022: item.grade_2022,
      grade_2021: item.grade_2021,
      grade_2020: item.grade_2020,
      grade_2019: item.grade_2019,
    });

    // Años esperados para mostrar (igual que la web app)
    const grades = [
      { year: "2025", grade: item.grade_2025 },
      { year: "2024", grade: item.grade_2024 },
      { year: "2023", grade: item.grade_2023 },
      { year: "2022", grade: item.grade_2022 },
      { year: "2021", grade: item.grade_2021 },
      { year: "2020", grade: item.grade_2020 },
      { year: "2019", grade: item.grade_2019 },
    ];

    return (
      <View style={styles.specialtyCard}>
        <View style={styles.specialtyHeader}>
          <Text style={styles.specialtyName}>{item.name}</Text>
          {item.slots > 0 && (
            <View style={styles.slotsBadge}>
              <Text style={styles.slotsText}>{item.slots} plazas</Text>
            </View>
          )}
        </View>

        <View style={styles.cutOffSection}>
          <View style={styles.cutOffHeader}>
            <Ionicons name="bar-chart" size={16} color="#666" />
            <Text style={styles.cutOffHeaderText}>NOTAS DE CORTE POR AÑO</Text>
            <TouchableOpacity
              style={styles.moreInfoButton}
              onPress={() => handleMoreInfo(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.moreInfoButtonText}>
                {expandedSpecialty === item.id
                  ? "Menos info"
                  : "Más información"}
              </Text>
            </TouchableOpacity>
          </View>

          {expandedSpecialty !== item.id ? (
            // Vista condensada - mostrar todas las notas en grid
            <View style={styles.cutOffScoresGrid}>
              {grades.map((gradeItem) => {
                const hasScore =
                  gradeItem.grade !== null && gradeItem.grade !== undefined;

                return (
                  <View
                    key={gradeItem.year}
                    style={[
                      styles.cutOffScoreBadge,
                      !hasScore && styles.cutOffScoreBadgeEmpty,
                    ]}
                  >
                    <Text
                      style={[
                        styles.cutOffScoreYear,
                        !hasScore && styles.cutOffScoreYearEmpty,
                      ]}
                    >
                      {gradeItem.year}:
                    </Text>
                    <Text
                      style={[
                        styles.cutOffScoreValue,
                        !hasScore && styles.cutOffScoreValueEmpty,
                      ]}
                    >
                      {hasScore ? gradeItem.grade : "N/A"}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            // Vista expandida - tabla detallada
            <View style={styles.detailedTableContainer}>
              {loadingDetails[item.id] ? (
                <View style={styles.loadingDetailsContainer}>
                  <ActivityIndicator size="small" color="#8B5CF6" />
                  <Text style={styles.loadingDetailsText}>
                    Cargando detalles...
                  </Text>
                </View>
              ) : detailedGrades[item.id] &&
                detailedGrades[item.id].length > 0 ? (
                <View style={styles.table}>
                  {/* Header */}
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderText}>Año</Text>
                    <Text style={styles.tableHeaderText}>Plazas</Text>
                    <Text style={styles.tableHeaderText}>Notas de Corte</Text>
                  </View>

                  {/* Rows */}
                  {detailedGrades[item.id].map((gradeData, index) => (
                    <View
                      key={gradeData.year}
                      style={[
                        styles.tableRow,
                        index % 2 === 0
                          ? styles.tableRowEven
                          : styles.tableRowOdd,
                      ]}
                    >
                      <Text style={styles.tableCellYear}>{gradeData.year}</Text>
                      <View style={styles.tableCellCenter}>
                        <View style={styles.slotsBadgeSmall}>
                          <Text style={styles.slotsTextSmall}>
                            {gradeData.slots}{" "}
                            {gradeData.slots === 1 ? "plaza" : "plazas"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tableCellGrades}>
                        {gradeData.grades && gradeData.grades.length > 0 ? (
                          <View style={styles.gradesContainer}>
                            {gradeData.grades.map((gradeValue, gradeIndex) => (
                              <View
                                key={gradeIndex}
                                style={styles.detailedGradeBadge}
                              >
                                <Text style={styles.detailedGradeText}>
                                  {gradeValue}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.noDataText}>N/A</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDataText}>
                  No hay datos detallados disponibles para esta especialidad
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (!hospital) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No se encontró el hospital</Text>
      </View>
    );
  }

  return (
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
        </View>

        {/* Card de información del hospital */}
        <View style={styles.hospitalCard}>
          <View style={styles.hospitalIconContainer}>
            <Ionicons name="medical" size={32} color="#8B5CF6" />
          </View>
          <Text style={styles.hospitalName}>{hospital.name}</Text>

          <View style={styles.hospitalInfoRow}>
            <Ionicons name="location" size={16} color="#666" />
            <Text style={styles.hospitalLocation}>
              {hospital.city}, {hospital.region}
            </Text>
          </View>

          {hospital.specialtyCount !== undefined && (
            <View style={styles.hospitalInfoRow}>
              <Ionicons name="school" size={16} color="#8B5CF6" />
              <Text style={styles.specialtyCount}>
                {hospital.specialtyCount} especialidades disponibles
              </Text>
            </View>
          )}
        </View>

        {/* Header de especialidades */}
        <View style={styles.specialtiesHeader}>
          <Ionicons name="school" size={24} color="#8B5CF6" />
          <Text style={styles.specialtiesHeaderText}>
            Especialidades Disponibles
          </Text>
        </View>

        {/* Lista de especialidades */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Cargando especialidades...</Text>
          </View>
        ) : filteredSpecialties.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No se encontraron especialidades
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredSpecialties}
            renderItem={renderSpecialtyItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.specialtiesList}
          />
        )}
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 4,
  },
  hospitalCard: {
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
  hospitalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  hospitalName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  hospitalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  hospitalLocation: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  specialtyCount: {
    fontSize: 14,
    color: "#8B5CF6",
    marginLeft: 8,
  },
  specialtiesHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  specialtiesHeaderText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginLeft: 8,
  },
  specialtiesList: {
    padding: 16,
  },
  specialtyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  specialtyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  specialtyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#8B5CF6",
    flex: 1,
  },
  slotsBadge: {
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  slotsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  cutOffSection: {
    marginTop: 12,
  },
  cutOffHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  cutOffHeaderText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 6,
    fontWeight: "600",
    flex: 1,
  },
  cutOffScoresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cutOffScoreBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    minWidth: "30%",
    flex: 1,
    maxWidth: "32%",
  },
  cutOffScoreBadgeEmpty: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  cutOffScoreYear: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
  },
  cutOffScoreYearEmpty: {
    color: "#9CA3AF",
    fontWeight: "400",
  },
  cutOffScoreValue: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "700",
  },
  cutOffScoreValueEmpty: {
    color: "#9CA3AF",
    fontWeight: "400",
  },
  moreInfoButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  moreInfoButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#999",
  },
  detailedTableContainer: {
    marginTop: 12,
  },
  loadingDetailsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingDetailsText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#8B5CF6",
  },
  table: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3E8FF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#8B5CF6",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  tableRowEven: {
    backgroundColor: "#ffffff",
  },
  tableRowOdd: {
    backgroundColor: "#FAFAFA",
  },
  tableCellYear: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
    textAlign: "center",
  },
  tableCellCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tableCellGrades: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotsBadgeSmall: {
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  slotsTextSmall: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  gradesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
  },
  detailedGradeBadge: {
    backgroundColor: "#D1FAE5",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  detailedGradeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  noDataText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
});
