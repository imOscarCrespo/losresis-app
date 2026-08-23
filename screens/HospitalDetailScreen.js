import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import {
  getDetailedGrades,
  getHospitalSpecialties,
  getSpecialtyById,
} from "../services/hospitalService";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const WHITE = "#FFFFFF";
const TEXT_MEDIUM = "#64748B";
const TEXT_LIGHT = "#94A3B8";
const BORDER = "#F1F5F9";
const ERROR = "#EF4444";

const SectionTitle = ({ title, rightLabel = null }) => (
  <View style={styles.sectionRow}>
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
    {rightLabel ? <Text style={styles.sectionCount}>{rightLabel}</Text> : null}
  </View>
);

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
    posthogLogger.logScreen("HospitalDetailScreen", {
      hospitalId: hospital?.id,
      specialtyId: selectedSpecialtyId,
    });
  }, [hospital?.id, selectedSpecialtyId]);

  useEffect(() => {
    setExpandedSpecialty(null);
    setDetailedGrades({});
  }, [hospital?.id]);

  useEffect(() => {
    if (!hospital?.id) return;
    fetchSpecialties();
  }, [hospital?.id, selectedSpecialtyId]);

  const fetchSpecialties = async () => {
    setLoading(true);
    try {
      const { success, specialties: specialtiesData, error } =
        await getHospitalSpecialties(hospital.id);

      if (success) {
        let finalSpecialties = specialtiesData;

        if (selectedSpecialtyId) {
          const isInList = specialtiesData.some(
            (spec) => spec.id === selectedSpecialtyId
          );
          if (!isInList) {
            const { success: specSuccess, specialty } = await getSpecialtyById(
              selectedSpecialtyId
            );
            if (specSuccess && specialty) {
              finalSpecialties = [
                {
                  id: specialty.id,
                  name: specialty.name,
                  description: "",
                  years: [],
                  slots: undefined,
                },
                ...specialtiesData,
              ];
            }
          }
        }
        setSpecialties(finalSpecialties);
      } else {
        console.error("Error loading specialties:", error);
      }
    } catch (error) {
      console.error("Exception fetching specialties:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSpecialties = useMemo(() => {
    if (selectedSpecialtyId) {
      return specialties.filter((spec) => spec.id === selectedSpecialtyId);
    }
    return specialties;
  }, [specialties, selectedSpecialtyId]);

  const handleMoreInfo = async (specialty) => {
    if (expandedSpecialty === specialty.id) {
      setExpandedSpecialty(null);
      setDetailedGrades((prev) => {
        const next = { ...prev };
        delete next[specialty.id];
        return next;
      });
      return;
    }

    setExpandedSpecialty(specialty.id);
    setLoadingDetails((prev) => ({ ...prev, [specialty.id]: true }));

    try {
      const { success, grades, error } = await getDetailedGrades(
        hospital.id,
        specialty.id
      );
      if (success) {
        setDetailedGrades((prev) => ({ ...prev, [specialty.id]: grades }));
      } else {
        console.error("Error loading detailed grades:", error);
        setDetailedGrades((prev) => ({ ...prev, [specialty.id]: [] }));
      }
    } catch (error) {
      console.error("Exception fetching detailed grades:", error);
      setDetailedGrades((prev) => ({ ...prev, [specialty.id]: [] }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [specialty.id]: false }));
    }
  };

  const MiniBarChart = ({ grades }) => {
    if (!grades || grades.length === 0) {
      return <Text style={styles.noDataText}>Sin datos disponibles</Text>;
    }

    const validVals = grades
      .filter((g) => g.grade !== null && g.grade !== undefined)
      .map((g) => g.grade);
    const maxVal = validVals.length > 0 ? Math.max(...validVals) : 1;
    const TRACK_H = 72;
    const BAR_W = 28;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScroll}
      >
        {grades.map((item, idx) => {
          const hasScore = item.grade !== null && item.grade !== undefined;
          const fillH = hasScore
            ? Math.max(8, Math.round((item.grade / maxVal) * TRACK_H))
            : 8;
          const isNewest = idx === 0;
          return (
            <View key={item.year} style={styles.chartCol}>
              <Text
                style={[
                  styles.chartValue,
                  isNewest && hasScore && styles.chartValueNewest,
                  !hasScore && styles.chartValueEmpty,
                ]}
              >
                {hasScore ? item.grade : "—"}
              </Text>
              <View style={[styles.chartTrack, { height: TRACK_H }]}>
                <View
                  style={[
                    styles.chartFill,
                    { height: fillH, width: BAR_W },
                    isNewest && hasScore && styles.chartFillNewest,
                    !hasScore && styles.chartFillEmpty,
                  ]}
                />
              </View>
              <Text style={[styles.chartYear, isNewest && styles.chartYearNewest]}>
                {String(item.year).slice(2)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderSpecialtyItem = (item) => {
    const grades = (item.years || [])
      .map((yearData) => ({
        year: yearData.year.toString(),
        grade: yearData.grade,
      }))
      .sort((a, b) => parseInt(b.year, 10) - parseInt(a.year, 10));

    const isExpanded = expandedSpecialty === item.id;

    return (
      <View key={item.id} style={styles.specialtyCard}>
        <View style={styles.specialtyHeader}>
          <Text style={styles.specialtyName} numberOfLines={2}>
            {item.name}
          </Text>
          {item.slots > 0 && (
            <View style={styles.slotsBadge}>
              <Text style={styles.slotsText}>{item.slots} plazas</Text>
            </View>
          )}
        </View>

        {item.info_note ? <Text style={styles.infoNote}>{item.info_note}</Text> : null}

        <View style={styles.cutOffSection}>
          <View style={styles.cutOffHeader}>
            <View style={styles.cutOffLabelRow}>
              <Icon name="bar-chart" size={14} color={TEXT_MEDIUM} />
              <Text style={styles.cutOffLabel}>NOTAS DE CORTE</Text>
            </View>
            <TouchableOpacity
              style={[styles.moreInfoBtn, isExpanded && styles.moreInfoBtnActive]}
              onPress={() => handleMoreInfo(item)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.moreInfoBtnText,
                  isExpanded && styles.moreInfoBtnTextActive,
                ]}
              >
                {isExpanded ? "Ver menos" : "Ver más"}
              </Text>
              <Icon
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={13}
                color={isExpanded ? WHITE : PRIMARY}
              />
            </TouchableOpacity>
          </View>

          {!isExpanded ? (
            <MiniBarChart grades={grades} />
          ) : (
            <View style={styles.tableWrap}>
              {loadingDetails[item.id] ? (
                <View style={styles.loadingDetailsRow}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text style={styles.loadingDetailsText}>Cargando detalles...</Text>
                </View>
              ) : detailedGrades[item.id] && detailedGrades[item.id].length > 0 ? (
                <View style={styles.table}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.tableHeadText, { flex: 1 }]}>Año</Text>
                    <Text style={[styles.tableHeadText, { flex: 1 }]}>Plazas</Text>
                    <Text style={[styles.tableHeadText, { flex: 2 }]}>Notas de corte</Text>
                  </View>

                  {detailedGrades[item.id].map((gradeData, index) => (
                    <View
                      key={gradeData.year}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                      ]}
                    >
                      <Text style={[styles.tableCellYear, { flex: 1 }]}>
                        {gradeData.year}
                      </Text>
                      <View style={[{ flex: 1, alignItems: "center" }]}>
                        <View style={styles.slotsBadgeSmall}>
                          <Text style={styles.slotsTextSmall}>
                            {gradeData.slots}{" "}
                            {gradeData.slots === 1 ? "plaza" : "plazas"}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.gradesCellWrap, { flex: 2 }]}>
                        {gradeData.grades && gradeData.grades.length > 0 ? (
                          <View style={styles.gradesCellInner}>
                            {gradeData.grades.map((gradeValue, gradeIndex) => (
                              <View
                                key={`${gradeData.year}-${gradeIndex}`}
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
                  Sin datos detallados para esta especialidad
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
      <View style={styles.stateContainer}>
        <View style={styles.stateIconWrap}>
          <Icon name="alert-circle-outline" size={36} color={ERROR} />
        </View>
        <Text style={styles.errorTitle}>Hospital no encontrado</Text>
      </View>
    );
  }

  return (
    <HeroScreenLayout title="Hospitales" onBack={onBack}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.scrollContent}>
        <View style={styles.hospitalCard}>
          <View style={styles.hospitalIconWrap}>
            <Icon name="business" size={26} color={PRIMARY} />
          </View>
          <Text style={styles.hospitalName}>{hospital.name}</Text>

          <View style={styles.hospitalMeta}>
            <View style={styles.metaRow}>
              <Icon name="location-outline" size={14} color={TEXT_MEDIUM} />
              <Text style={styles.metaText}>
                {hospital.city}, {hospital.region}
              </Text>
            </View>
            {hospital.specialtyCount !== undefined && (
              <View style={styles.metaRow}>
                <Icon name="school" size={14} color={PRIMARY} />
                <Text style={[styles.metaText, styles.metaTextAccent]}>
                  {hospital.specialtyCount} especialidades MIR
                </Text>
              </View>
            )}
          </View>
        </View>

        <SectionTitle
          title="Especialidades disponibles"
          rightLabel={
            !loading
              ? `${filteredSpecialties.length} ${
                  filteredSpecialties.length === 1 ? "ESPECIALIDAD" : "ESPECIALIDADES"
                }`
              : null
          }
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Cargando especialidades...</Text>
          </View>
        ) : filteredSpecialties.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Icon name="school-outline" size={36} color={PRIMARY} />
            </View>
            <Text style={styles.emptyTitle}>Sin especialidades</Text>
            <Text style={styles.emptySubtitle}>
              No se encontraron especialidades para este hospital
            </Text>
          </View>
        ) : (
          <View style={styles.specialtiesList}>
            {filteredSpecialties.map(renderSpecialtyItem)}
          </View>
        )}
        </View>
      </ScrollView>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_LIGHT },
  scrollContent: { padding: 16, paddingTop: 14, paddingBottom: 32 },
  hospitalCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  hospitalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: `${PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
  },
  hospitalName: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 12,
    lineHeight: 27,
    letterSpacing: -0.2,
  },
  hospitalMeta: { gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13, color: TEXT_MEDIUM },
  metaTextAccent: { color: PRIMARY, fontWeight: "600" },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 6,
    gap: 12,
  },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  sectionBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: PRIMARY },
  sectionLabel: { fontSize: 17, fontWeight: "700", color: ACCENT },
  sectionCount: { fontSize: 10, fontWeight: "700", color: PRIMARY, letterSpacing: 0.8 },
  loadingContainer: { alignItems: "center", paddingVertical: 36, gap: 12 },
  loadingText: { fontSize: 14, color: TEXT_MEDIUM, textAlign: "center" },
  emptyContainer: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: `${PRIMARY}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: ACCENT, marginBottom: 6, textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: TEXT_MEDIUM, textAlign: "center", lineHeight: 19 },
  stateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
    backgroundColor: BG_LIGHT,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${ERROR}10`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorTitle: { fontSize: 17, fontWeight: "700", color: ACCENT, textAlign: "center" },
  specialtiesList: { gap: 12 },
  specialtyCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 12,
  },
  specialtyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  specialtyName: { fontSize: 15, fontWeight: "700", color: ACCENT, flex: 1, lineHeight: 21 },
  slotsBadge: {
    backgroundColor: `${PRIMARY}10`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${PRIMARY}25`,
    flexShrink: 0,
  },
  slotsText: { fontSize: 11, fontWeight: "700", color: PRIMARY },
  infoNote: { fontSize: 13, color: TEXT_MEDIUM, marginBottom: 10, lineHeight: 18 },
  cutOffSection: { marginTop: 4 },
  cutOffHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cutOffLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cutOffLabel: { fontSize: 11, fontWeight: "700", color: TEXT_MEDIUM, letterSpacing: 0.5 },
  moreInfoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}30`,
    backgroundColor: `${PRIMARY}10`,
  },
  moreInfoBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  moreInfoBtnText: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  moreInfoBtnTextActive: { color: WHITE },
  chartScroll: { paddingVertical: 10, paddingHorizontal: 2, alignItems: "flex-end", gap: 6 },
  chartCol: { alignItems: "center", gap: 5, width: 44 },
  chartValue: { fontSize: 11, fontWeight: "700", color: `${SECONDARY}99`, textAlign: "center" },
  chartValueNewest: { color: SECONDARY, fontSize: 12 },
  chartValueEmpty: { color: TEXT_LIGHT, fontWeight: "400" },
  chartTrack: {
    width: 28,
    justifyContent: "flex-end",
    backgroundColor: `${SECONDARY}10`,
    borderRadius: 6,
    overflow: "hidden",
  },
  chartFill: { borderRadius: 6, backgroundColor: `${SECONDARY}55` },
  chartFillNewest: { backgroundColor: SECONDARY },
  chartFillEmpty: { backgroundColor: "#E2E8F0", height: 8 },
  chartYear: { fontSize: 10, fontWeight: "600", color: TEXT_MEDIUM, textAlign: "center" },
  chartYearNewest: { color: PRIMARY, fontWeight: "700" },
  noDataText: {
    fontSize: 12,
    color: TEXT_LIGHT,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  tableWrap: { marginTop: 4 },
  loadingDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  loadingDetailsText: { fontSize: 13, color: TEXT_MEDIUM },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, overflow: "hidden" },
  tableHead: {
    flexDirection: "row",
    backgroundColor: `${PRIMARY}08`,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${PRIMARY}20`,
  },
  tableHeadText: { fontSize: 11, fontWeight: "700", color: PRIMARY, textAlign: "center", letterSpacing: 0.3 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    alignItems: "center",
  },
  tableRowEven: { backgroundColor: WHITE },
  tableRowOdd: { backgroundColor: BG_LIGHT },
  tableCellYear: { fontSize: 13, fontWeight: "600", color: ACCENT, textAlign: "center" },
  slotsBadgeSmall: {
    backgroundColor: `${PRIMARY}10`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
  },
  slotsTextSmall: { fontSize: 11, fontWeight: "700", color: PRIMARY },
  gradesCellWrap: { alignItems: "center", justifyContent: "center" },
  gradesCellInner: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4 },
  detailedGradeBadge: {
    backgroundColor: `${SECONDARY}18`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${SECONDARY}30`,
  },
  detailedGradeText: { fontSize: 11, fontWeight: "700", color: SECONDARY },
});
